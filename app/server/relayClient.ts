// 这个文件封装 OpenAI 兼容中转站的 chat completions 请求和流式解析。
import type { ChatPrompt } from "./promptBuilder";

export interface RelayConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
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

// 请求中转站并返回完整模型文本。
export async function requestChatCompletion(prompt: ChatPrompt, config: RelayConfig, onDelta?: (text: string) => void): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${normalizeBaseUrl(config.baseUrl)}/v1/chat/completions`, {
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
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`中转站返回 ${response.status}: ${errorText.slice(0, 300)}`);
    }

    const contentType = response.headers.get("Content-Type") ?? "";
    if (!contentType.includes("text/event-stream")) {
      return extractMessageContent(await response.json());
    }

    return readRelayStream(response, onDelta);
  } finally {
    clearTimeout(timer);
  }
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

        const delta = extractDeltaContent(JSON.parse(data) as unknown);
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
