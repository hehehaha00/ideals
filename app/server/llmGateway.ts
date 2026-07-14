// 这个文件提供 LLM 网关层：缓存、in-flight 去重和并发控制。
import type { ChatPrompt } from "./promptBuilder";
import { parseModelJson } from "./modelOutput";
import { createCacheKey, type ResponseCache } from "./responseCache";

type ReleaseSlot = () => void;

export interface LlmGatewayMeta {
  cacheHit: boolean;
  deduped: boolean;
  requestId: string;
}

interface QueueItem {
  resolve: (release: ReleaseSlot) => void;
  reject: (error: Error) => void;
  signal?: AbortSignal;
  onAbort: () => void;
}

interface Subscriber {
  onDelta?: (text: string) => void;
  signal?: AbortSignal;
  onAbort: () => void;
  abortPromise: Promise<never>;
  rejectAbort: (error: Error) => void;
  ready: boolean;
  pendingDeltas: string[];
}

interface InFlightEntry<TValue> {
  promise: Promise<TValue>;
  controller: AbortController;
  subscribers: Set<Subscriber>;
  deltaHistory: string[];
  settled: boolean;
}

export interface LlmGatewayResult<TValue> extends LlmGatewayMeta {
  value: TValue;
}

export interface LlmGatewayStartedRequest<TValue> {
  meta: LlmGatewayMeta;
  result: Promise<LlmGatewayResult<TValue>>;
}

export interface LlmGatewayRunRequest<TValue> {
  operation: string;
  prompt: ChatPrompt;
  cachePayload: unknown;
  normalize: (raw: unknown) => TValue;
  onMeta?: (meta: LlmGatewayMeta) => void;
  onDelta?: (text: string) => void;
  signal?: AbortSignal;
}

export interface LlmGatewayOptions {
  cache: ResponseCache<unknown>;
  model: string;
  maxConcurrentRequests: number;
  maxQueuedRequests?: number;
  requestDeadlineMs?: number;
  requestModel: (prompt: ChatPrompt, onDelta?: (text: string) => void, signal?: AbortSignal) => Promise<string>;
}

// 队列已满时返回明确且可识别的错误。
export class LlmOverloadedError extends Error {
  public constructor() {
    super("AI 请求过多，请稍后重试");
    this.name = "LlmOverloadedError";
  }
}

// 请求超过端到端截止时间时返回明确且可识别的错误。
export class LlmDeadlineExceededError extends Error {
  public constructor() {
    super("AI 请求超过截止时间");
    this.name = "LlmDeadlineExceededError";
  }
}

let requestCounter = 0;

function createRequestId(): string {
  requestCounter += 1;
  return `llm_${Date.now().toString(36)}_${requestCounter.toString(36)}`;
}

export class LlmGateway {
  private readonly inFlight = new Map<string, InFlightEntry<unknown>>();
  private readonly queue: QueueItem[] = [];
  private activeRequests = 0;

  public constructor(private readonly options: LlmGatewayOptions) {}

  public async run<TValue>(request: LlmGatewayRunRequest<TValue>): Promise<LlmGatewayResult<TValue>> {
    return await this.start(request).result;
  }

  // 同步完成缓存、去重或队列准入，确保过载时调用方尚未发送响应头。
  public start<TValue>(request: LlmGatewayRunRequest<TValue>): LlmGatewayStartedRequest<TValue> {
    const requestId = createRequestId();
    const cacheKey = createCacheKey(request.operation, this.options.model, request.cachePayload);
    const cached = this.options.cache.getEntry(cacheKey);
    if (cached) {
      const meta = { cacheHit: true, deduped: false, requestId };
      request.onMeta?.(meta);
      return {
        meta,
        result: Promise.resolve({ ...meta, value: cached.value as TValue }),
      };
    }

    const existing = this.inFlight.get(cacheKey) as InFlightEntry<TValue> | undefined;
    if (existing) {
      const meta = { cacheHit: false, deduped: true, requestId };
      request.onMeta?.(meta);
      const subscriber = this.addSubscriber(existing, request);
      return {
        meta,
        result: this.waitForEntry(existing, subscriber).then((value) => ({ ...meta, value })),
      };
    }

    if (request.signal?.aborted) {
      throw new Error("请求已取消");
    }

    const controller = new AbortController();
    const slotReservation = this.reserveSlot(controller.signal);
    const entry = this.createInFlightEntry<TValue>(controller);
    const subscriber = this.addSubscriber(entry, request);
    const meta = { cacheHit: false, deduped: false, requestId };
    request.onMeta?.(meta);
    this.inFlight.set(cacheKey, entry as InFlightEntry<unknown>);

    entry.promise = this.runWithDeadline(entry.controller, async () =>
      this.runWithReservedSlot(slotReservation, entry.controller.signal, async () => {
        const modelText = await this.options.requestModel(
          request.prompt,
          (delta) => {
            if (!entry.controller.signal.aborted) {
              this.broadcastDelta(entry, delta);
            }
          },
          entry.controller.signal,
        );
        if (entry.controller.signal.aborted) {
          throw this.readAbortError(entry.controller.signal);
        }
        const normalized = request.normalize(parseModelJson(modelText));
        this.options.cache.set(cacheKey, normalized);
        return normalized;
      }),
    );

    entry.promise.then(
      () => this.finishEntry(cacheKey, entry),
      () => this.finishEntry(cacheKey, entry),
    );

    return {
      meta,
      result: this.waitForEntry(entry, subscriber).then((value) => ({ ...meta, value })),
    };
  }

  private createInFlightEntry<TValue>(controller = new AbortController()): InFlightEntry<TValue> {
    return {
      promise: new Promise<TValue>(() => undefined),
      controller,
      subscribers: new Set<Subscriber>(),
      deltaHistory: [],
      settled: false,
    };
  }

  private addSubscriber<TValue>(entry: InFlightEntry<TValue>, request: LlmGatewayRunRequest<TValue>): Subscriber {
    if (request.signal?.aborted) {
      throw new Error("请求已取消");
    }

    let rejectAbort!: (error: Error) => void;
    const subscriber: Subscriber = {
      onDelta: request.onDelta,
      signal: request.signal,
      onAbort: () => undefined,
      abortPromise: new Promise<never>((_resolve, reject) => {
        rejectAbort = reject;
      }),
      rejectAbort: (error) => rejectAbort(error),
      ready: false,
      pendingDeltas: [],
    };

    subscriber.onAbort = () => {
      this.removeSubscriber(entry, subscriber);
      subscriber.rejectAbort(new Error("请求已取消"));
    };

    entry.subscribers.add(subscriber);
    subscriber.signal?.addEventListener("abort", subscriber.onAbort, { once: true });

    const deltaHistory = [...entry.deltaHistory];
    queueMicrotask(() => {
      if (!entry.subscribers.has(subscriber) || subscriber.signal?.aborted) {
        return;
      }
      try {
        for (const delta of [...deltaHistory, ...subscriber.pendingDeltas]) {
          subscriber.onDelta?.(delta);
        }
        subscriber.pendingDeltas = [];
        subscriber.ready = true;
      } catch {
        this.removeSubscriber(entry, subscriber);
      }
    });

    return subscriber;
  }

  private async waitForEntry<TValue>(entry: InFlightEntry<TValue>, subscriber: Subscriber): Promise<TValue> {
    try {
      return await Promise.race([entry.promise, subscriber.abortPromise]);
    } finally {
      this.removeSubscriber(entry, subscriber);
    }
  }

  private broadcastDelta<TValue>(entry: InFlightEntry<TValue>, delta: string): void {
    entry.deltaHistory.push(delta);

    for (const subscriber of Array.from(entry.subscribers)) {
      if (subscriber.signal?.aborted) {
        continue;
      }

      if (!subscriber.ready) {
        subscriber.pendingDeltas.push(delta);
        continue;
      }

      try {
        subscriber.onDelta?.(delta);
      } catch {
        this.removeSubscriber(entry, subscriber);
      }
    }
  }

  private removeSubscriber<TValue>(entry: InFlightEntry<TValue>, subscriber: Subscriber): void {
    if (!entry.subscribers.delete(subscriber)) {
      return;
    }

    subscriber.signal?.removeEventListener("abort", subscriber.onAbort);
    if (entry.subscribers.size === 0 && !entry.settled && !entry.controller.signal.aborted) {
      entry.controller.abort();
    }
  }

  private finishEntry<TValue>(cacheKey: string, entry: InFlightEntry<TValue>): void {
    entry.settled = true;
    for (const subscriber of entry.subscribers) {
      subscriber.signal?.removeEventListener("abort", subscriber.onAbort);
    }
    entry.subscribers.clear();
    if (this.inFlight.get(cacheKey) === entry) {
      this.inFlight.delete(cacheKey);
    }
  }

  private async runWithReservedSlot<TValue>(slotReservation: Promise<ReleaseSlot>, signal: AbortSignal | undefined, task: () => Promise<TValue>): Promise<TValue> {
    const release = await slotReservation;
    let onAbort = (): void => undefined;
    const abortPromise = new Promise<never>((_resolve, reject) => {
      onAbort = () => reject(this.readAbortError(signal));
      if (signal?.aborted) {
        onAbort();
      } else {
        signal?.addEventListener("abort", onAbort, { once: true });
      }
    });
    const taskPromise = task();
    void taskPromise.then(release, release);
    try {
      return await Promise.race([taskPromise, abortPromise]);
    } finally {
      signal?.removeEventListener("abort", onAbort);
    }
  }

  // 用同一个时钟覆盖排队、重试和上游读取阶段。
  private async runWithDeadline<TValue>(controller: AbortController, task: () => Promise<TValue>): Promise<TValue> {
    const deadlineMs = Math.max(1, this.options.requestDeadlineMs ?? 90_000);
    const deadlineError = new LlmDeadlineExceededError();
    const timer = setTimeout(() => controller.abort(deadlineError), deadlineMs);

    try {
      return await task();
    } catch (error) {
      if (controller.signal.reason instanceof LlmDeadlineExceededError) {
        throw controller.signal.reason;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  private reserveSlot(signal?: AbortSignal): Promise<ReleaseSlot> {
    if (signal?.aborted) {
      throw this.readAbortError(signal);
    }

    if (this.activeRequests < Math.max(1, this.options.maxConcurrentRequests)) {
      this.activeRequests += 1;
      return Promise.resolve(() => this.releaseSlot());
    }

    if (this.queue.length >= Math.max(0, this.options.maxQueuedRequests ?? 12)) {
      throw new LlmOverloadedError();
    }

    return new Promise<ReleaseSlot>((resolve, reject) => {
      const item: QueueItem = {
        resolve,
        reject,
        signal,
        onAbort: () => {
          this.removeQueueItem(item);
          reject(this.readAbortError(signal));
        },
      };
      signal?.addEventListener("abort", item.onAbort, { once: true });
      this.queue.push(item);
    });
  }

  private releaseSlot(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    const next = this.queue.shift();
    if (!next) {
      return;
    }

    next.signal?.removeEventListener("abort", next.onAbort);
    if (next.signal?.aborted) {
      next.reject(new Error("请求已取消"));
      this.releaseSlot();
      return;
    }

    this.activeRequests += 1;
    next.resolve(() => this.releaseSlot());
  }

  private removeQueueItem(item: QueueItem): void {
    const index = this.queue.indexOf(item);
    if (index >= 0) {
      this.queue.splice(index, 1);
    }
    item.signal?.removeEventListener("abort", item.onAbort);
  }

  // 优先传递截止时间原因，其余中止统一为请求取消。
  private readAbortError(signal: AbortSignal | undefined): Error {
    return signal?.reason instanceof Error ? signal.reason : new Error("请求已取消");
  }
}
