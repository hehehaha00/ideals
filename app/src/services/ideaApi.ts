// 这个文件统一封装 AI 请求；接口不可用时自动回退到本地灵感引擎。
import { generateFallbackIdeas, generateFallbackWords, transformFallbackIdea } from "../lib/ideaEngine";
import type { DimensionGroup, DimensionWord, IdeaCard, Intensity, TransformDirection } from "../types/idea";

interface GenerateWordsRequest {
  topic: string;
  intensity: Intensity;
  onProgress?: (text: string) => void;
}

interface GenerateIdeasRequest {
  topic: string;
  sourceWords: DimensionWord[];
  onProgress?: (text: string) => void;
}

interface TransformIdeaRequest {
  idea: IdeaCard;
  direction: TransformDirection;
  onProgress?: (text: string) => void;
}

const API_BASE_URL = "/api/idea";

// 发送 JSON 请求，并读取服务端 SSE 流。
async function postStream<TRequest, TResponse>(path: string, body: TRequest, onProgress?: (text: string) => void): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`AI 接口返回 ${response.status}`);
  }

  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    return (await response.json()) as TResponse;
  }

  return readEventStream<TResponse>(response, onProgress);
}

// 从 SSE 文本块里解析 event 和 data。
function parseEventBlock(block: string): { event: string; data: string } | undefined {
  const lines = block.split(/\r?\n/);
  let event = "message";
  const data: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    }
    if (line.startsWith("data:")) {
      data.push(line.slice("data:".length).trim());
    }
  }

  if (data.length === 0) {
    return undefined;
  }

  return { event, data: data.join("\n") };
}

// 读取服务端流式事件，delta 用于 UI 进度，done 返回最终 JSON。
async function readEventStream<TResponse>(response: Response, onProgress?: (text: string) => void): Promise<TResponse> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("浏览器不支持读取流式响应");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    const blocks = buffer.split(/\n\n/);
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const event = parseEventBlock(block);
      if (!event) {
        continue;
      }

      if (event.event === "delta") {
        onProgress?.(event.data);
      }

      if (event.event === "error") {
        throw new Error(event.data);
      }

      if (event.event === "done") {
        return JSON.parse(event.data) as TResponse;
      }
    }

    if (done) {
      break;
    }
  }

  throw new Error("AI 流式响应没有完成事件");
}

// 生成维度词，失败时使用本地词库。
export async function generateWords(request: GenerateWordsRequest): Promise<DimensionGroup[]> {
  try {
    const response = await postStream<Omit<GenerateWordsRequest, "onProgress">, { groups: DimensionGroup[] }>(
      "/words",
      { topic: request.topic, intensity: request.intensity },
      request.onProgress,
    );
    return response.groups;
  } catch {
    return generateFallbackWords(request.topic, request.intensity);
  }
}

// 生成脑洞卡片，失败时使用本地模板。
export async function generateIdeas(request: GenerateIdeasRequest): Promise<IdeaCard[]> {
  try {
    const response = await postStream<Omit<GenerateIdeasRequest, "onProgress">, { ideas: IdeaCard[] }>(
      "/ideas",
      { topic: request.topic, sourceWords: request.sourceWords },
      request.onProgress,
    );
    return response.ideas;
  } catch {
    return generateFallbackIdeas(request.topic, request.sourceWords);
  }
}

// 生成脑洞变形，失败时使用本地变形文案。
export async function transformIdea(request: TransformIdeaRequest): Promise<IdeaCard> {
  try {
    const response = await postStream<Omit<TransformIdeaRequest, "onProgress">, { idea: IdeaCard }>(
      "/transform",
      { idea: request.idea, direction: request.direction },
      request.onProgress,
    );
    return response.idea;
  } catch {
    return transformFallbackIdea(request.idea, request.direction);
  }
}
