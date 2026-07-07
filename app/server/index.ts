// 这个文件启动本地 AI API 代理，负责密钥、流式转发、缓存和输出校验。
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { buildIdeasPrompt, buildTransformPrompt, buildWordsPrompt, type ChatPrompt } from "./promptBuilder";
import { loadServerConfig } from "./config";
import { normalizeIdeaCards, normalizeTransformedIdea, normalizeWordGroups, parseModelJson } from "./modelOutput";
import { createCacheKey, ResponseCache } from "./responseCache";
import { requestChatCompletion } from "./relayClient";
import type { DimensionWord, IdeaCard, Intensity, TransformDirection } from "../src/types/idea";

interface WordsBody {
  topic: string;
  intensity: Intensity;
}

interface IdeasBody {
  topic: string;
  sourceWords: DimensionWord[];
}

interface TransformBody {
  idea: IdeaCard;
  direction: TransformDirection;
}

const config = loadServerConfig();
const cache = new ResponseCache<unknown>(config.cacheTtlMs);

// 写入 SSE 响应头。
function writeSseHead(response: ServerResponse): void {
  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
}

// 写入单个 SSE 事件。
function writeSseEvent(response: ServerResponse, event: string, data: unknown): void {
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  response.write(`event: ${event}\n`);
  response.write(`data: ${payload}\n\n`);
}

// 读取 JSON 请求体，并限制最大长度。
async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalLength = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalLength += buffer.length;
    if (totalLength > 100_000) {
      throw new Error("请求内容太长");
    }
    chunks.push(buffer);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

// 安全读取对象。
function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("请求体必须是对象");
  }

  return value as Record<string, unknown>;
}

// 校验字符串字段。
function readStringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`缺少字段 ${key}`);
  }

  return value.trim();
}

// 校验维度词数组。
function readSourceWords(record: Record<string, unknown>): DimensionWord[] {
  const value = record.sourceWords;
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("缺少 sourceWords");
  }

  return value as DimensionWord[];
}

// 校验脑洞卡片。
function readIdea(record: Record<string, unknown>): IdeaCard {
  const value = record.idea;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("缺少 idea");
  }

  return value as IdeaCard;
}

// 处理一次 AI 请求：缓存命中直接返回，否则请求中转站并校验输出。
async function handleAiOperation(response: ServerResponse, operation: string, prompt: ChatPrompt, cachePayload: unknown, normalize: (raw: unknown) => unknown): Promise<void> {
  if (!config.apiKey) {
    response.writeHead(503, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" });
    response.end(JSON.stringify({ error: "AI key 未配置" }));
    return;
  }

  writeSseHead(response);
  const cacheKey = createCacheKey(operation, config.model, cachePayload);
  const cached = cache.get(cacheKey);
  if (cached) {
    writeSseEvent(response, "meta", { cacheHit: true });
    writeSseEvent(response, "done", cached);
    response.end();
    return;
  }

  try {
    const modelText = await requestChatCompletion(prompt, config, (delta) => writeSseEvent(response, "delta", delta));
    const normalized = normalize(parseModelJson(modelText));
    cache.set(cacheKey, normalized);
    writeSseEvent(response, "done", normalized);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 请求失败";
    writeSseEvent(response, "error", message);
  } finally {
    response.end();
  }
}

// 处理路由。
async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method !== "POST" || !request.url?.startsWith("/api/idea/")) {
    response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  try {
    const body = asRecord(await readJsonBody(request));

    if (request.url === "/api/idea/words") {
      const payload: WordsBody = { topic: readStringField(body, "topic"), intensity: readStringField(body, "intensity") as Intensity };
      await handleAiOperation(response, "words", buildWordsPrompt(payload), payload, (raw) => ({ groups: normalizeWordGroups(raw) }));
      return;
    }

    if (request.url === "/api/idea/ideas") {
      const payload: IdeasBody = { topic: readStringField(body, "topic"), sourceWords: readSourceWords(body) };
      await handleAiOperation(response, "ideas", buildIdeasPrompt(payload), payload, (raw) => ({ ideas: normalizeIdeaCards(raw, payload.sourceWords) }));
      return;
    }

    if (request.url === "/api/idea/transform") {
      const payload: TransformBody = { idea: readIdea(body), direction: readStringField(body, "direction") as TransformDirection };
      await handleAiOperation(response, "transform", buildTransformPrompt(payload), payload, (raw) => ({ idea: normalizeTransformedIdea(raw, payload.idea, payload.direction) }));
      return;
    }

    response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "Not found" }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "请求处理失败";
    response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: message }));
  }
}

createServer((request, response) => {
  void handleRequest(request, response);
}).listen(config.port, "127.0.0.1", () => {
  console.log(`Idea AI proxy listening on http://127.0.0.1:${config.port}`);
});
