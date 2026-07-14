// 这个文件封装 OpenAI 兼容中转站的 chat completions 请求和流式解析。
import { fetch as undiciFetch, ProxyAgent, type Dispatcher } from "undici";
import type { ChatPrompt } from "./promptBuilder";

export interface RelayConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  retryCount?: number;
  retryBaseDelayMs?: number;
  proxyUrl?: string;
}

export type RelayErrorCode = "timeout" | "aborted" | "upstream_status" | "invalid_response" | "network";

export class RelayError extends Error {
  public constructor(
    message: string,
    public readonly code: RelayErrorCode,
    public readonly retryable: boolean,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "RelayError";
  }
}

interface AttemptSignal {
  signal: AbortSignal;
  cleanup: () => void;
  timedOut: () => boolean;
  parentAborted: () => boolean;
}

interface RequestChatCompletionOptions {
  signal?: AbortSignal;
}

// 去掉末尾斜杠，避免拼 URL 时出现双斜杠。
export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

// 安全读取普通对象。
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

// 从非流式 chat completion 中提取 message.content。
export function extractMessageContent(payload: unknown): string {
  const record = asRecord(payload);
  const choices = Array.isArray(record?.choices) ? record.choices : [];
  const firstChoice = asRecord(choices[0]);
  const message = asRecord(firstChoice?.message);
  const content = message?.content;

  if (typeof content !== "string") {
    throw new Error("中转站没有返回 message.content");
  }

  return content;
}

// 从流式 chunk 中提取 delta.content。
export function extractDeltaContent(payload: unknown): string {
  const record = asRecord(payload);
  const choices = Array.isArray(record?.choices) ? record.choices : [];
  const firstChoice = asRecord(choices[0]);
  const delta = asRecord(firstChoice?.delta);
  const content = delta?.content;

  return typeof content === "string" ? content : "";
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function createAttemptSignal(timeoutMs: number, parentSignal?: AbortSignal): AttemptSignal {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const parentAbort = () => controller.abort();

  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort();
    } else {
      parentSignal.addEventListener("abort", parentAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      parentSignal?.removeEventListener("abort", parentAbort);
    },
    timedOut: () => timedOut,
    parentAborted: () => Boolean(parentSignal?.aborted) && !timedOut,
  };
}

function toRelayError(error: unknown, attemptSignal?: AttemptSignal): RelayError {
  if (error instanceof RelayError) {
    return error;
  }

  if (attemptSignal?.timedOut()) {
    return new RelayError("中转站请求超时", "timeout", true);
  }

  if (attemptSignal?.parentAborted()) {
    return new RelayError("请求已取消", "aborted", false);
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return new RelayError("请求已取消", "aborted", false);
  }

  if (error instanceof SyntaxError) {
    return new RelayError("中转站返回了无法解析的 JSON", "invalid_response", false);
  }

  const message = error instanceof Error ? error.message : "中转站网络请求失败";
  return new RelayError(message, "network", true);
}

function retryDelayMs(baseDelayMs: number, attemptIndex: number): number {
  const delay = baseDelayMs * 2 ** attemptIndex;
  const jitter = delay > 0 ? Math.floor(Math.random() * Math.min(100, delay)) : 0;
  return delay + jitter;
}

function normalizeNonNegativeInteger(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.floor(value ?? fallback));
}

async function waitBeforeRetry(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (delayMs <= 0) {
    return;
  }
  if (signal?.aborted) {
    throw new RelayError("请求已取消", "aborted", false);
  }

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, delayMs);
    const onAbort = () => {
      cleanup();
      reject(new RelayError("请求已取消", "aborted", false));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

// 请求中转站并返回完整模型文本。
async function requestChatCompletionOnce(prompt: ChatPrompt, config: RelayConfig, onDelta?: (text: string) => void, options: RequestChatCompletionOptions = {}): Promise<string> {
  const attemptSignal = createAttemptSignal(config.timeoutMs, options.signal);
  const dispatcher = config.proxyUrl ? new ProxyAgent(config.proxyUrl) : undefined;
  const relayFetch = config.proxyUrl ? (undiciFetch as unknown as typeof fetch) : fetch;
  const requestOptions: RequestInit & { dispatcher?: Dispatcher } = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      temperature: 0.9,
      stream: true,
    }),
    signal: attemptSignal.signal,
    dispatcher,
  };

  try {
    const response = await relayFetch(`${normalizeBaseUrl(config.baseUrl)}/v1/chat/completions`, requestOptions);

    if (!response.ok) {
      const errorText = await response.text();
      const retryable = isRetryableStatus(response.status);
      throw new RelayError(`中转站返回 ${response.status}: ${errorText.slice(0, 300)}`, "upstream_status", retryable, response.status);
    }

    const contentType = response.headers.get("Content-Type") ?? "";
    if (!contentType.includes("text/event-stream")) {
      try {
        return extractMessageContent(await response.json());
      } catch (error) {
        throw toRelayError(error, attemptSignal);
      }
    }

    return readRelayStream(response, onDelta);
  } catch (error) {
    throw toRelayError(error, attemptSignal);
  } finally {
    attemptSignal.cleanup();
  }
}

// 请求中转站并返回完整模型文本，支持有限重试。
export async function requestChatCompletion(prompt: ChatPrompt, config: RelayConfig, onDelta?: (text: string) => void, options: RequestChatCompletionOptions = {}): Promise<string> {
  const retryCount = normalizeNonNegativeInteger(config.retryCount, 0);
  const retryBaseDelayMs = normalizeNonNegativeInteger(config.retryBaseDelayMs, 300);
  let emittedDelta = false;
  const wrappedDelta = (text: string) => {
    emittedDelta = true;
    onDelta?.(text);
  };

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      return await requestChatCompletionOnce(prompt, config, wrappedDelta, options);
    } catch (error) {
      const relayError = error instanceof RelayError ? error : toRelayError(error);
      const canRetry = relayError.retryable && !emittedDelta && attempt < retryCount && !options.signal?.aborted;
      if (!canRetry) {
        throw relayError;
      }
      await waitBeforeRetry(retryDelayMs(retryBaseDelayMs, attempt), options.signal);
    }
  }

  throw new RelayError("中转站请求失败", "network", true);
}

// 读取 OpenAI 兼容 SSE，把 delta 拼成完整文本。
async function readRelayStream(response: Response, onDelta?: (text: string) => void): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("中转站流式响应不可读");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    const blocks = buffer.split(/\n\n/);
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      for (const line of block.split(/\r?\n/)) {
        if (!line.startsWith("data:")) {
          continue;
        }

        const data = line.slice("data:".length).trim();
        if (data === "[DONE]") {
          return fullText;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(data) as unknown;
        } catch {
          throw new RelayError("中转站流式响应不是 JSON", "invalid_response", false);
        }

        const delta = extractDeltaContent(parsed);
        if (delta.length > 0) {
          fullText += delta;
          onDelta?.(delta);
        }
      }
    }

    if (done) {
      break;
    }
  }

  return fullText;
}
