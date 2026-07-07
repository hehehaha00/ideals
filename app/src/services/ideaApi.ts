// 这个文件统一封装 AI 请求；接口不可用时自动回退到本地灵感引擎。
import { generateFallbackIdeas, generateFallbackWords, transformFallbackIdea } from "../lib/ideaEngine";
import type { DimensionGroup, DimensionWord, IdeaCard, Intensity, TransformDirection } from "../types/idea";

interface GenerateWordsRequest {
  topic: string;
  intensity: Intensity;
}

interface GenerateIdeasRequest {
  topic: string;
  sourceWords: DimensionWord[];
}

interface TransformIdeaRequest {
  idea: IdeaCard;
  direction: TransformDirection;
}

const API_BASE_URL = import.meta.env.VITE_IDEA_API_URL as string | undefined;

// 发送 JSON 请求，并把非 2xx 响应转成明确错误。
async function postJson<TRequest, TResponse>(path: string, body: TRequest): Promise<TResponse> {
  if (!API_BASE_URL) {
    throw new Error("AI 接口未配置");
  }

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

  return (await response.json()) as TResponse;
}

// 生成维度词，失败时使用本地词库。
export async function generateWords(request: GenerateWordsRequest): Promise<DimensionGroup[]> {
  try {
    return await postJson<GenerateWordsRequest, DimensionGroup[]>("/words", request);
  } catch {
    return generateFallbackWords(request.topic, request.intensity);
  }
}

// 生成脑洞卡片，失败时使用本地模板。
export async function generateIdeas(request: GenerateIdeasRequest): Promise<IdeaCard[]> {
  try {
    return await postJson<GenerateIdeasRequest, IdeaCard[]>("/ideas", request);
  } catch {
    return generateFallbackIdeas(request.topic, request.sourceWords);
  }
}

// 生成脑洞变形，失败时使用本地变形文案。
export async function transformIdea(request: TransformIdeaRequest): Promise<IdeaCard> {
  try {
    return await postJson<TransformIdeaRequest, IdeaCard>("/transform", request);
  } catch {
    return transformFallbackIdea(request.idea, request.direction);
  }
}
