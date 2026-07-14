// 这个文件统一封装 AI 请求；AI 不可用时把错误暴露给界面，而不是伪造本地结果。
import type { BrainstormMap, CollisionRecipeId, CollisionRecommendation, DimensionGroup, DimensionWord, IdeaCard, IdeaChallenge, IdeaChallengeRole, IdeaDiscussion, IdeaDiscussionDirectionKey, IdeaDiscussionIntervention, IdeaDiscussionInterventionType, IdeaDiscussionRole, IdeaDiscussionSetup, IdeaRefinement, Intensity, MindMapExpansion, MixedIdeaSeed, TransformDirection } from "../types/idea";

interface GenerateWordsRequest {
  topic: string;
  intensity: Intensity;
  cacheNonce?: string;
  onProgress?: (text: string) => void;
  signal?: AbortSignal;
}

interface GenerateMindMapRequest {
  topic: string;
  intensity: Intensity;
  onProgress?: (text: string) => void;
  signal?: AbortSignal;
}

interface ExpandMindNodeRequest {
  topic: string;
  intensity: Intensity;
  map: BrainstormMap;
  nodeId: string;
  onProgress?: (text: string) => void;
  signal?: AbortSignal;
}

interface RerollMindMapRequest {
  topic: string;
  intensity: Intensity;
  map: BrainstormMap;
  onProgress?: (text: string) => void;
  signal?: AbortSignal;
}

interface RecommendCollisionRequest {
  topic: string;
  groups: DimensionGroup[];
  onProgress?: (text: string) => void;
  signal?: AbortSignal;
}

interface GenerateIdeasRequest {
  topic: string;
  sourceWords: DimensionWord[];
  collisionRecipe?: CollisionRecipeId;
  onProgress?: (text: string) => void;
  signal?: AbortSignal;
}

interface TransformIdeaRequest {
  idea: IdeaCard;
  direction: TransformDirection;
  onProgress?: (text: string) => void;
  signal?: AbortSignal;
}

interface RefineIdeaRequest {
  idea: IdeaCard;
  onProgress?: (text: string) => void;
  signal?: AbortSignal;
}

interface ChallengeIdeaRequest {
  idea: IdeaCard;
  role: IdeaChallengeRole;
  onProgress?: (text: string) => void;
  signal?: AbortSignal;
}

interface DiscussionRequest {
  idea: IdeaCard;
  setup?: IdeaDiscussionSetup;
  onProgress?: (text: string) => void;
  signal?: AbortSignal;
}

interface DiscussionResponseRequest {
  idea: IdeaCard;
  discussion: IdeaDiscussion;
  type: IdeaDiscussionInterventionType;
  prompt: string;
  targetRole: IdeaDiscussionRole;
  sourceRole?: IdeaDiscussionRole;
  sourceClaim?: string;
  onProgress?: (text: string) => void;
  signal?: AbortSignal;
}

interface DiscussionBranchRequest {
  idea: IdeaCard;
  discussion: IdeaDiscussion;
  directionKey: IdeaDiscussionDirectionKey;
  opposite?: boolean;
  map: BrainstormMap;
  parentNodeId: string;
  onProgress?: (text: string) => void;
  signal?: AbortSignal;
}

interface MixIdeasRequest {
  ideas: IdeaCard[];
  onProgress?: (text: string) => void;
  signal?: AbortSignal;
}

const API_BASE_URL = "/api/idea";

// 发送 JSON 请求，并读取服务端 SSE 流。
async function postStream<TRequest, TResponse>(path: string, body: TRequest, onProgress?: (text: string) => void, signal?: AbortSignal): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    return (await response.json()) as TResponse;
  }

  return readEventStream<TResponse>(response, onProgress);
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const contentType = response.headers.get("Content-Type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await response.json()) as unknown;
      if (body && typeof body === "object" && "error" in body && typeof (body as { error?: unknown }).error === "string") {
        return (body as { error: string }).error;
      }
    }

    const text = await response.text();
    return text.trim().length > 0 ? text.trim() : `AI 接口返回 ${response.status}`;
  } catch {
    return `AI 接口返回 ${response.status}`;
  }
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
      const value = line.slice("data:".length);
      data.push(value.startsWith(" ") ? value.slice(1) : value);
    }
  }

  if (data.length === 0) {
    return undefined;
  }

  return { event, data: data.join("\n") };
}

function readEventData(data: string): unknown {
  try {
    return JSON.parse(data) as unknown;
  } catch {
    return data;
  }
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
        const payload = readEventData(event.data);
        onProgress?.(typeof payload === "string" ? payload : event.data);
      }

      if (event.event === "error") {
        const payload = readEventData(event.data);
        throw new Error(typeof payload === "string" ? payload : event.data);
      }

      if (event.event === "done") {
        return readEventData(event.data) as TResponse;
      }
    }

    if (done) {
      break;
    }
  }

  throw new Error("AI 流式响应没有完成事件");
}

// 生成维度词。
export async function generateWords(request: GenerateWordsRequest): Promise<DimensionGroup[]> {
  const response = await postStream<Omit<GenerateWordsRequest, "onProgress" | "signal">, { groups: DimensionGroup[] }>(
    "/words",
    { topic: request.topic, intensity: request.intensity, cacheNonce: request.cacheNonce },
    request.onProgress,
    request.signal,
  );
  return response.groups;
}

// 生成发散思维导图。
export async function generateMindMap(request: GenerateMindMapRequest): Promise<BrainstormMap> {
  const response = await postStream<Omit<GenerateMindMapRequest, "onProgress" | "signal">, { map: BrainstormMap }>(
    "/map",
    { topic: request.topic, intensity: request.intensity },
    request.onProgress,
    request.signal,
  );
  return response.map;
}

// 基于当前节点继续让 AI 扩展一批新导图节点。
export async function expandMindNode(request: ExpandMindNodeRequest): Promise<MindMapExpansion> {
  const response = await postStream<Omit<ExpandMindNodeRequest, "onProgress" | "signal">, { expansion: MindMapExpansion }>(
    "/map/expand",
    { topic: request.topic, intensity: request.intensity, map: request.map, nodeId: request.nodeId },
    request.onProgress,
    request.signal,
  );
  return response.expansion;
}

// 让 AI 重掷当前导图的未锁定节点。
export async function rerollMindMap(request: RerollMindMapRequest): Promise<BrainstormMap> {
  const response = await postStream<Omit<RerollMindMapRequest, "onProgress" | "signal">, { map: BrainstormMap }>(
    "/map/reroll",
    { topic: request.topic, intensity: request.intensity, map: request.map },
    request.onProgress,
    request.signal,
  );
  return response.map;
}

// 让 AI 从已有维度词里推荐一组碰撞组合。
export async function recommendCollision(request: RecommendCollisionRequest): Promise<CollisionRecommendation> {
  const response = await postStream<Omit<RecommendCollisionRequest, "onProgress" | "signal">, { recommendation: CollisionRecommendation }>(
    "/collision",
    { topic: request.topic, groups: request.groups },
    request.onProgress,
    request.signal,
  );
  return response.recommendation;
}

// 生成脑洞卡片。
export async function generateIdeas(request: GenerateIdeasRequest): Promise<IdeaCard[]> {
  const response = await postStream<Omit<GenerateIdeasRequest, "onProgress" | "signal">, { ideas: IdeaCard[] }>(
    "/ideas",
    {
      topic: request.topic,
      sourceWords: request.sourceWords,
      ...(request.collisionRecipe ? { collisionRecipe: request.collisionRecipe } : {}),
    },
    request.onProgress,
    request.signal,
  );
  return response.ideas;
}

// 生成脑洞变形。
export async function transformIdea(request: TransformIdeaRequest): Promise<IdeaCard> {
  const response = await postStream<Omit<TransformIdeaRequest, "onProgress" | "signal">, { idea: IdeaCard }>(
    "/transform",
    { idea: request.idea, direction: request.direction },
    request.onProgress,
    request.signal,
  );
  return response.idea;
}

// 炼化脑洞卡片。
export async function refineIdea(request: RefineIdeaRequest): Promise<IdeaRefinement> {
  const response = await postStream<Omit<RefineIdeaRequest, "onProgress" | "signal">, { refinement: IdeaRefinement }>("/refine", { idea: request.idea }, request.onProgress, request.signal);
  return response.refinement;
}

// 让指定角色从反共识角度挑战一张脑洞卡片。
export async function requestChallenge(request: ChallengeIdeaRequest): Promise<IdeaChallenge> {
  const response = await postStream<Omit<ChallengeIdeaRequest, "onProgress" | "signal">, { challenge: IdeaChallenge }>(
    "/challenge",
    { idea: request.idea, role: request.role },
    request.onProgress,
    request.signal,
  );
  return response.challenge;
}

// 召集固定四角色进行三轮结构化讨论。
export async function requestDiscussion(request: DiscussionRequest): Promise<IdeaDiscussion> {
  const setup = request.setup ?? { lineup: "standard", mechanism: "relay", participants: ["用户代言人", "反常识派", "跨界连接者", "现实构建者"] } satisfies IdeaDiscussionSetup;
  const response = await postStream<Omit<DiscussionRequest, "onProgress" | "signal">, { discussion: IdeaDiscussion }>(
    "/discussion",
    { idea: request.idea, ...(request.setup ? { setup } : {}) },
    request.onProgress,
    request.signal,
  );
  return response.discussion;
}

// 让指定角色回应一次用户介入，不把报告退化成无限聊天。
export async function respondToDiscussion(request: DiscussionResponseRequest): Promise<IdeaDiscussionIntervention> {
  const response = await postStream<Omit<DiscussionResponseRequest, "onProgress" | "signal">, { intervention: IdeaDiscussionIntervention }>(
    "/discussion/respond",
    {
      idea: request.idea,
      discussion: request.discussion,
      type: request.type,
      prompt: request.prompt,
      targetRole: request.targetRole,
      ...(request.sourceRole ? { sourceRole: request.sourceRole } : {}),
      ...(request.sourceClaim ? { sourceClaim: request.sourceClaim } : {}),
    },
    request.onProgress,
    request.signal,
  );
  return response.intervention;
}

// 沿讨论的一个收束方向生成可并入无限画布的新分支。
export async function branchFromDiscussion(request: DiscussionBranchRequest): Promise<MindMapExpansion> {
  const response = await postStream<Omit<DiscussionBranchRequest, "onProgress" | "signal">, { expansion: MindMapExpansion }>(
    "/discussion/branch",
    { idea: request.idea, discussion: request.discussion, directionKey: request.directionKey, opposite: request.opposite, map: request.map, parentNodeId: request.parentNodeId },
    request.onProgress,
    request.signal,
  );
  return response.expansion;
}

// 混合 2 到 3 张孵化箱想法，返回新的发散起点。
export async function mixIdeas(request: MixIdeasRequest): Promise<MixedIdeaSeed> {
  const response = await postStream<Omit<MixIdeasRequest, "onProgress" | "signal">, { seed: MixedIdeaSeed }>("/mix", { ideas: request.ideas }, request.onProgress, request.signal);
  return response.seed;
}
