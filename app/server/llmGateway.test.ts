// 这个文件验证 LLM 网关的缓存、in-flight 去重和并发控制。
// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { LlmDeadlineExceededError, LlmGateway, LlmOverloadedError } from "./llmGateway";
import { createCacheKey, ResponseCache } from "./responseCache";

const prompt = { system: "system", user: "user" };
const sharedRequest = {
  operation: "map",
  prompt,
  cachePayload: { topic: "same" },
  normalize: (raw: unknown) => raw,
};

describe("LlmGateway", () => {
  it("shares one in-flight request for the same operation and payload", async () => {
    let release!: () => void;
    const requestModel = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          release = () => resolve("{\"value\":\"ok\"}");
        }),
    );
    const gateway = new LlmGateway({
      cache: new ResponseCache<unknown>(10_000, 10),
      model: "gpt-5.5",
      maxConcurrentRequests: 2,
      requestModel,
    });

    const first = gateway.run({
      operation: "map",
      prompt,
      cachePayload: { topic: "same" },
      normalize: (raw) => raw,
    });
    const second = gateway.run({
      operation: "map",
      prompt,
      cachePayload: { topic: "same" },
      normalize: (raw) => raw,
    });

    await Promise.resolve();
    expect(requestModel).toHaveBeenCalledTimes(1);
    release();

    const results = await Promise.all([first, second]);
    expect(results[0]).toMatchObject({ value: { value: "ok" }, cacheHit: false, deduped: false });
    expect(results[1]).toMatchObject({ value: { value: "ok" }, cacheHit: false, deduped: true });
  });

  it("returns cached results without calling the model again", async () => {
    const requestModel = vi.fn().mockResolvedValue("{\"value\":\"cached\"}");
    const gateway = new LlmGateway({
      cache: new ResponseCache<unknown>(10_000, 10),
      model: "gpt-5.5",
      maxConcurrentRequests: 2,
      requestModel,
    });

    await gateway.run({
      operation: "words",
      prompt,
      cachePayload: { topic: "cache me" },
      normalize: (raw) => raw,
    });
    const second = await gateway.run({
      operation: "words",
      prompt,
      cachePayload: { topic: "cache me" },
      normalize: (raw) => raw,
    });

    expect(second).toMatchObject({ value: { value: "cached" }, cacheHit: true, deduped: false });
    expect(requestModel).toHaveBeenCalledTimes(1);
  });

  it("returns cached falsy normalized values without calling the model again", async () => {
    const requestModel = vi.fn().mockResolvedValue("false");
    const gateway = new LlmGateway({
      cache: new ResponseCache<unknown>(10_000, 10),
      model: "gpt-5.5",
      maxConcurrentRequests: 2,
      requestModel,
    });

    await gateway.run({
      operation: "words",
      prompt,
      cachePayload: { topic: "cache false" },
      normalize: (raw) => raw,
    });
    const second = await gateway.run({
      operation: "words",
      prompt,
      cachePayload: { topic: "cache false" },
      normalize: (raw) => raw,
    });

    expect(second).toMatchObject({ value: false, cacheHit: true, deduped: false });
    expect(requestModel).toHaveBeenCalledTimes(1);
  });

  it("keeps a shared upstream request alive when the first subscriber aborts", async () => {
    let emitDelta!: (text: string) => void;
    let finish!: () => void;
    let upstreamSignal: AbortSignal | undefined;
    const firstController = new AbortController();
    const secondController = new AbortController();
    const firstDeltas: string[] = [];
    const secondDeltas: string[] = [];
    const requestModel = vi.fn(
      (_prompt, onDelta: ((text: string) => void) | undefined, signal: AbortSignal | undefined) =>
        new Promise<string>((resolve, reject) => {
          upstreamSignal = signal;
          signal?.addEventListener("abort", () => reject(new Error("upstream aborted")));
          emitDelta = (text: string) => onDelta?.(text);
          finish = () => resolve("{\"value\":\"ok\"}");
        }),
    );
    const gateway = new LlmGateway({
      cache: new ResponseCache<unknown>(10_000, 10),
      model: "gpt-5.5",
      maxConcurrentRequests: 2,
      requestModel,
    });

    const first = gateway
      .run({
        ...sharedRequest,
        onDelta: (delta) => firstDeltas.push(delta),
        signal: firstController.signal,
      })
      .catch((error: unknown) => error);

    await vi.waitFor(() => expect(requestModel).toHaveBeenCalledTimes(1));

    const second = gateway.run({
      ...sharedRequest,
      onDelta: (delta) => secondDeltas.push(delta),
      signal: secondController.signal,
    });

    firstController.abort();

    expect(upstreamSignal?.aborted).toBe(false);
    emitDelta("shared");
    finish();

    expect(await first).toBeInstanceOf(Error);
    await expect(second).resolves.toMatchObject({ value: { value: "ok" }, cacheHit: false, deduped: true });
    expect(firstDeltas).toEqual([]);
    expect(secondDeltas).toEqual(["shared"]);
  });

  it("emits dedupe metadata before a shared request settles", async () => {
    let finish!: () => void;
    const metaEvents: Array<{ cacheHit: boolean; deduped: boolean; requestId: string }> = [];
    const requestModel = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finish = () => resolve("{\"value\":\"ok\"}");
        }),
    );
    const gateway = new LlmGateway({
      cache: new ResponseCache<unknown>(10_000, 10),
      model: "gpt-5.5",
      maxConcurrentRequests: 2,
      requestModel,
    });

    const first = gateway.run({ ...sharedRequest, onMeta: (meta) => metaEvents.push(meta) });
    await vi.waitFor(() => expect(requestModel).toHaveBeenCalledTimes(1));

    const second = gateway.run({ ...sharedRequest, onMeta: (meta) => metaEvents.push(meta) });
    await Promise.resolve();

    expect(metaEvents).toEqual([
      expect.objectContaining({ cacheHit: false, deduped: false }),
      expect.objectContaining({ cacheHit: false, deduped: true }),
    ]);

    finish();
    await Promise.all([first, second]);
  });

  it("limits concurrent upstream model calls", async () => {
    let active = 0;
    let maxActive = 0;
    const requestModel = vi.fn(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
      return "{\"value\":\"ok\"}";
    });
    const gateway = new LlmGateway({
      cache: new ResponseCache<unknown>(10_000, 10),
      model: "gpt-5.5",
      maxConcurrentRequests: 1,
      requestModel,
    });

    await Promise.all([
      gateway.run({ operation: "map", prompt, cachePayload: { topic: "a" }, normalize: (raw) => raw }),
      gateway.run({ operation: "map", prompt, cachePayload: { topic: "b" }, normalize: (raw) => raw }),
      gateway.run({ operation: "map", prompt, cachePayload: { topic: "c" }, normalize: (raw) => raw }),
    ]);

    expect(maxActive).toBe(1);
    expect(requestModel).toHaveBeenCalledTimes(3);
  });

  it("rejects a new request with a typed overload error when the queue is full", async () => {
    let releaseFirst!: () => void;
    let callCount = 0;
    const requestModel = vi.fn(() => {
      callCount += 1;
      if (callCount > 1) {
        return Promise.resolve("{\"value\":\"ok\"}");
      }
      return new Promise<string>((resolve) => {
        releaseFirst = () => resolve("{\"value\":\"ok\"}");
      });
    });
    const gateway = new LlmGateway({
      cache: new ResponseCache<unknown>(10_000, 10),
      model: "gpt-5.5",
      maxConcurrentRequests: 1,
      maxQueuedRequests: 1,
      requestDeadlineMs: 10_000,
      requestModel,
    });

    const first = gateway.run({ ...sharedRequest, cachePayload: { topic: "first" } });
    await vi.waitFor(() => expect(requestModel).toHaveBeenCalledTimes(1));
    const second = gateway.run({ ...sharedRequest, cachePayload: { topic: "second" } });
    const third = gateway.run({ ...sharedRequest, cachePayload: { topic: "third" } });

    await expect(third).rejects.toBeInstanceOf(LlmOverloadedError);
    releaseFirst();
    await Promise.all([first, second]);
    await vi.waitFor(() => expect(requestModel).toHaveBeenCalledTimes(2));
  });

  it("counts queue waiting time toward the end-to-end deadline", async () => {
    vi.useFakeTimers();
    const requestModel = vi.fn(() => new Promise<string>(() => undefined));
    const gateway = new LlmGateway({
      cache: new ResponseCache<unknown>(10_000, 10),
      model: "gpt-5.5",
      maxConcurrentRequests: 1,
      maxQueuedRequests: 1,
      requestDeadlineMs: 100,
      requestModel,
    });

    void gateway.run({ ...sharedRequest, cachePayload: { topic: "first" } }).catch(() => undefined);
    await vi.advanceTimersByTimeAsync(1);
    const queued = gateway.run({ ...sharedRequest, cachePayload: { topic: "queued" } });
    const rejection = expect(queued).rejects.toBeInstanceOf(LlmDeadlineExceededError);

    await vi.advanceTimersByTimeAsync(100);
    await rejection;
    // 上游尚未真实结束时继续占用槽位，排队请求不会造成实际并发超限。
    expect(requestModel).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("rejects at the deadline even when the upstream ignores abort", async () => {
    vi.useFakeTimers();
    const requestModel = vi.fn(() => new Promise<string>(() => undefined));
    const gateway = new LlmGateway({
      cache: new ResponseCache<unknown>(10_000, 10),
      model: "gpt-5.5",
      maxConcurrentRequests: 1,
      maxQueuedRequests: 1,
      requestDeadlineMs: 100,
      requestModel,
    });

    const running = gateway.run({ ...sharedRequest, cachePayload: { topic: "ignores abort" } });
    const rejection = expect(running).rejects.toBeInstanceOf(LlmDeadlineExceededError);

    await vi.advanceTimersByTimeAsync(100);
    await rejection;
    vi.useRealTimers();
  });

  it("removes a cancelled queue item so a later request can use its capacity", async () => {
    let releaseFirst!: () => void;
    const queuedController = new AbortController();
    let callCount = 0;
    const requestModel = vi.fn(() => {
      callCount += 1;
      if (callCount > 1) {
        return Promise.resolve("{\"value\":\"ok\"}");
      }
      return new Promise<string>((resolve) => {
        releaseFirst = () => resolve("{\"value\":\"ok\"}");
      });
    });
    const gateway = new LlmGateway({
      cache: new ResponseCache<unknown>(10_000, 10),
      model: "gpt-5.5",
      maxConcurrentRequests: 1,
      maxQueuedRequests: 1,
      requestDeadlineMs: 10_000,
      requestModel,
    });

    const first = gateway.run({ ...sharedRequest, cachePayload: { topic: "first" } });
    await vi.waitFor(() => expect(requestModel).toHaveBeenCalledTimes(1));
    const cancelled = gateway.run({ ...sharedRequest, cachePayload: { topic: "cancelled" }, signal: queuedController.signal });
    queuedController.abort();
    await expect(cancelled).rejects.toThrow("请求已取消");

    const replacement = gateway.run({ ...sharedRequest, cachePayload: { topic: "replacement" } });
    releaseFirst();
    await expect(Promise.all([first, replacement])).resolves.toHaveLength(2);
    expect(requestModel).toHaveBeenCalledTimes(2);
  });

  it("keeps the slot until an abort-ignoring upstream settles and discards its late result", async () => {
    vi.useFakeTimers();
    const cache = new ResponseCache<unknown>(10_000, 10);
    const firstNormalize = vi.fn((raw: unknown) => raw);
    let releaseFirst!: () => void;
    let callCount = 0;
    const requestModel = vi.fn(() => {
      callCount += 1;
      if (callCount === 1) {
        return new Promise<string>((resolve) => {
          releaseFirst = () => resolve("{\"value\":\"late\"}");
        });
      }
      return Promise.resolve("{\"value\":\"next\"}");
    });
    const gateway = new LlmGateway({
      cache,
      model: "gpt-5.5",
      maxConcurrentRequests: 1,
      maxQueuedRequests: 1,
      requestDeadlineMs: 100,
      requestModel,
    });

    const firstPayload = { topic: "late" };
    const first = gateway.run({ ...sharedRequest, cachePayload: firstPayload, normalize: firstNormalize });
    const firstRejection = expect(first).rejects.toBeInstanceOf(LlmDeadlineExceededError);
    await vi.advanceTimersByTimeAsync(100);
    await firstRejection;

    const second = gateway.run({ ...sharedRequest, cachePayload: { topic: "next" } });
    await Promise.resolve();
    await Promise.resolve();
    const callsBeforeUpstreamSettled = requestModel.mock.calls.length;

    releaseFirst();
    await vi.advanceTimersByTimeAsync(0);
    await second;

    expect(callsBeforeUpstreamSettled).toBe(1);
    expect(firstNormalize).not.toHaveBeenCalled();
    expect(cache.getEntry(createCacheKey("map", "gpt-5.5", firstPayload))).toBeUndefined();
    vi.useRealTimers();
  });

  it("rejects overload synchronously before metadata or in-flight work starts", async () => {
    let releaseFirst!: () => void;
    let callCount = 0;
    const requestModel = vi.fn(() => {
      callCount += 1;
      if (callCount === 1) {
        return new Promise<string>((resolve) => {
          releaseFirst = () => resolve("{\"value\":\"first\"}");
        });
      }
      return Promise.resolve("{\"value\":\"queued\"}");
    });
    const gateway = new LlmGateway({
      cache: new ResponseCache<unknown>(10_000, 10),
      model: "gpt-5.5",
      maxConcurrentRequests: 1,
      maxQueuedRequests: 1,
      requestDeadlineMs: 10_000,
      requestModel,
    });

    const first = gateway.run({ ...sharedRequest, cachePayload: { topic: "first" } });
    await vi.waitFor(() => expect(requestModel).toHaveBeenCalledTimes(1));
    const second = gateway.run({ ...sharedRequest, cachePayload: { topic: "second" } });
    const onMeta = vi.fn();
    let thrown: unknown;
    try {
      gateway.start({ ...sharedRequest, cachePayload: { topic: "third" }, onMeta });
    } catch (error) {
      thrown = error;
    }

    releaseFirst();
    await Promise.all([first, second]);

    expect(thrown).toBeInstanceOf(LlmOverloadedError);
    expect(onMeta).not.toHaveBeenCalled();
    expect(requestModel).toHaveBeenCalledTimes(2);
  });

  it("does not replay deduped deltas synchronously before the caller writes response headers", async () => {
    let emitDelta!: (text: string) => void;
    let finish!: () => void;
    const requestModel = vi.fn(
      (_prompt, onDelta: ((text: string) => void) | undefined) =>
        new Promise<string>((resolve) => {
          emitDelta = (text: string) => onDelta?.(text);
          finish = () => resolve("{\"value\":\"ok\"}");
        }),
    );
    const gateway = new LlmGateway({
      cache: new ResponseCache<unknown>(10_000, 10),
      model: "gpt-5.5",
      maxConcurrentRequests: 1,
      maxQueuedRequests: 1,
      requestDeadlineMs: 10_000,
      requestModel,
    });

    const first = gateway.run(sharedRequest);
    await vi.waitFor(() => expect(requestModel).toHaveBeenCalledTimes(1));
    emitDelta("history");
    const replayed: string[] = [];
    const second = gateway.start({ ...sharedRequest, onDelta: (delta) => replayed.push(delta) });

    expect(replayed).toEqual([]);
    await Promise.resolve();
    expect(replayed).toEqual(["history"]);

    finish();
    await Promise.all([first, second.result]);
  });
});
