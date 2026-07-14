// 这个文件启动本地 AI API 代理，负责密钥、流式转发、缓存和输出校验。
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  buildChallengePrompt,
  buildCollisionPrompt,
  buildDiscussionPrompt,
  buildDiscussionBranchPrompt,
  buildDiscussionResponsePrompt,
  buildExpandMindNodePrompt,
  buildIdeasPrompt,
  buildMindMapPrompt,
  buildMixIdeasPrompt,
  buildRefinePrompt,
  buildRerollMindMapPrompt,
  buildTransformPrompt,
  buildWordsPrompt,
  type ChatPrompt,
} from "./promptBuilder";
import { loadServerConfig } from "./config";
import {
  normalizeBrainstormMap,
  normalizeCollisionRecommendation,
  normalizeIdeaCards,
  normalizeIdeaChallenge,
  normalizeIdeaDiscussion,
  normalizeIdeaDiscussionIntervention,
  normalizeDiscussionBranchExpansion,
  normalizeIdeaRefinement,
  normalizeMindMapExpansion,
  normalizeMindMapReroll,
  normalizeMixedIdeaSeed,
  normalizeTransformedIdea,
  normalizeWordGroups,
} from "./modelOutput";
import { LlmDeadlineExceededError, LlmGateway, LlmOverloadedError } from "./llmGateway";
import { applyOriginPolicy } from "./originPolicy";
import { ResponseCache } from "./responseCache";
import { requestChatCompletion } from "./relayClient";
import { IDEA_DISCUSSION_LINEUPS, IDEA_DISCUSSION_MECHANISMS, IDEA_DISCUSSION_ROLES, isCollisionRecipeId, isIdeaChallengeRole, isIdeaDiscussionDirectionKey, isIdeaDiscussionInterventionType } from "../src/types/idea";
import type { BrainstormMap, CollisionRecipeId, DimensionGroup, DimensionWord, IdeaCard, IdeaChallengeRole, IdeaDiscussion, IdeaDiscussionDirectionKey, IdeaDiscussionInterventionType, IdeaDiscussionRole, IdeaDiscussionSetup, Intensity, TransformDirection } from "../src/types/idea";

interface WordsBody {
  topic: string;
  intensity: Intensity;
  cacheNonce?: string;
}

interface MindMapBody {
  topic: string;
  intensity: Intensity;
}

interface ExpandMindNodeBody {
  topic: string;
  intensity: Intensity;
  map: BrainstormMap;
  nodeId: string;
}

interface RerollMindMapBody {
  topic: string;
  intensity: Intensity;
  map: BrainstormMap;
}

interface CollisionBody {
  topic: string;
  groups: DimensionGroup[];
}

interface IdeasBody {
  topic: string;
  sourceWords: DimensionWord[];
  collisionRecipe?: CollisionRecipeId;
}

interface TransformBody {
  idea: IdeaCard;
  direction: TransformDirection;
}

interface RefineBody {
  idea: IdeaCard;
}

interface ChallengeBody {
  idea: IdeaCard;
  role: IdeaChallengeRole;
}

interface DiscussionBody {
  idea: IdeaCard;
  setup: IdeaDiscussionSetup;
}

interface DiscussionResponseBody {
  idea: IdeaCard;
  discussion: IdeaDiscussion;
  type: IdeaDiscussionInterventionType;
  prompt: string;
  targetRole: IdeaDiscussionRole;
  sourceRole?: IdeaDiscussionRole;
  sourceClaim?: string;
}

interface DiscussionBranchBody {
  idea: IdeaCard;
  discussion: IdeaDiscussion;
  directionKey: IdeaDiscussionDirectionKey;
  opposite?: boolean;
  map: BrainstormMap;
  parentNodeId: string;
}

interface MixBody {
  ideas: IdeaCard[];
}

const config = loadServerConfig();
const cache = new ResponseCache<unknown>(config.cacheTtlMs, config.cacheMaxEntries);
const gateway = new LlmGateway({
  cache,
  model: config.model,
  maxConcurrentRequests: config.maxConcurrentRequests,
  maxQueuedRequests: config.maxQueuedRequests,
  requestDeadlineMs: config.requestDeadlineMs,
  requestModel: (prompt, onDelta, signal) => requestChatCompletion(prompt, config, onDelta, { signal }),
});

// 写入 SSE 响应头。
function writeSseHead(response: ServerResponse): void {
  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
}

// 写入单个 SSE 事件。
function writeSseEvent(response: ServerResponse, event: string, data: unknown): void {
  if (response.destroyed || response.writableEnded) {
    return;
  }

  const payload = JSON.stringify(data);
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

// 校验可选碰撞配方；字段出现但值未知时让路由返回 400。
function readOptionalCollisionRecipe(record: Record<string, unknown>): CollisionRecipeId | undefined {
  const value = record.collisionRecipe;
  if (value === undefined) {
    return undefined;
  }
  if (!isCollisionRecipeId(value)) {
    throw new Error("未知碰撞配方 collisionRecipe");
  }
  return value;
}

// 校验反共识挑战角色，未知角色直接返回请求错误。
function readChallengeRole(record: Record<string, unknown>): IdeaChallengeRole {
  const role = readStringField(record, "role");
  if (!isIdeaChallengeRole(role)) {
    throw new Error("未知挑战角色 role");
  }
  return role;
}

// 校验讨论阵容和机制；自定义阵容也必须保持 3 到 4 个不同角色。
function readDiscussionSetup(record: Record<string, unknown>): IdeaDiscussionSetup {
  const value = record.setup;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("缺少讨论设置 setup");
  const setup = value as Record<string, unknown>;
  if (!IDEA_DISCUSSION_LINEUPS.includes(setup.lineup as IdeaDiscussionSetup["lineup"])) throw new Error("未知讨论阵容");
  if (!IDEA_DISCUSSION_MECHANISMS.includes(setup.mechanism as IdeaDiscussionSetup["mechanism"])) throw new Error("未知讨论机制");
  if (!Array.isArray(setup.participants)) throw new Error("讨论角色格式错误");
  const participants = setup.participants.filter((role): role is IdeaDiscussionRole => IDEA_DISCUSSION_ROLES.includes(role as IdeaDiscussionRole));
  if (participants.length < 3 || participants.length > 4 || participants.length !== setup.participants.length || new Set(participants).size !== participants.length) throw new Error("讨论必须选择 3 到 4 个不同角色");
  return { lineup: setup.lineup as IdeaDiscussionSetup["lineup"], mechanism: setup.mechanism as IdeaDiscussionSetup["mechanism"], participants };
}

// 校验一场讨论，并保证它属于当前脑洞。
function readDiscussion(record: Record<string, unknown>, idea: IdeaCard, requireInterventionCapacity = false): IdeaDiscussion {
  const value = record.discussion;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("缺少 discussion");
  }
  const discussion = value as IdeaDiscussion;
  if (discussion.ideaId !== idea.id) {
    throw new Error("discussion 与 idea 不匹配");
  }
  if (requireInterventionCapacity) {
    if (discussion.interventions !== undefined && !Array.isArray(discussion.interventions)) {
      throw new Error("discussion interventions 格式错误");
    }
    if ((discussion.interventions?.length ?? 0) >= 3) {
      throw new Error("每场讨论最多介入三次");
    }
  }
  return discussion;
}

// 校验固定讨论角色。
function readDiscussionRole(record: Record<string, unknown>, key: "targetRole" | "sourceRole", optional = false): IdeaDiscussionRole | undefined {
  const value = record[key];
  if (optional && value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || !IDEA_DISCUSSION_ROLES.includes(value as IdeaDiscussionRole)) {
    throw new Error(`未知讨论角色 ${key}`);
  }
  return value as IdeaDiscussionRole;
}

// 校验用户介入动作。
function readDiscussionInterventionType(record: Record<string, unknown>): IdeaDiscussionInterventionType {
  const value = record.type;
  if (!isIdeaDiscussionInterventionType(value)) {
    throw new Error("未知讨论介入动作 type");
  }
  return value;
}

// 校验讨论收束方向。
function readDiscussionDirectionKey(record: Record<string, unknown>): IdeaDiscussionDirectionKey {
  const value = record.directionKey;
  if (!isIdeaDiscussionDirectionKey(value)) {
    throw new Error("未知讨论方向 directionKey");
  }
  return value;
}

// 读取可选文本；字段出现时禁止空字符串。
function readOptionalTextField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`字段 ${key} 不能为空`);
  }
  return value.trim();
}

// 校验脑洞卡片。
function readIdea(record: Record<string, unknown>): IdeaCard {
  const value = record.idea;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("缺少 idea");
  }

  return value as IdeaCard;
}

// 校验导图对象。
function readBrainstormMap(record: Record<string, unknown>): BrainstormMap {
  const value = record.map;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("缺少 map");
  }

  return value as BrainstormMap;
}

// 校验维度词分组。
function readDimensionGroups(record: Record<string, unknown>): DimensionGroup[] {
  const value = record.groups;
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("缺少 groups");
  }

  return value as DimensionGroup[];
}

// 校验脑洞卡片数组。
function readIdeas(record: Record<string, unknown>): IdeaCard[] {
  const value = record.ideas;
  if (!Array.isArray(value) || value.length < 2 || value.length > 3) {
    throw new Error("需要选择 2 到 3 个想法");
  }

  return value as IdeaCard[];
}

// 处理一次 AI 请求：缓存命中直接返回，否则请求中转站并校验输出。
async function handleAiOperation(response: ServerResponse, operation: string, prompt: ChatPrompt, cachePayload: unknown, normalize: (raw: unknown) => unknown): Promise<void> {
  if (!config.apiKey) {
    response.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "AI key 未配置" }));
    return;
  }

  const abortController = new AbortController();
  response.once("close", () => abortController.abort());

  let started;
  try {
    started = gateway.start({
      operation,
      prompt,
      cachePayload,
      normalize,
      onDelta: (delta) => writeSseEvent(response, "delta", delta),
      signal: abortController.signal,
    });
  } catch (error) {
    if (error instanceof LlmOverloadedError) {
      response.writeHead(429, { "Content-Type": "application/json; charset=utf-8", "Retry-After": "1" });
      response.end(JSON.stringify({ error: "AI 服务繁忙，排队已满，请稍后重试" }));
      return;
    }
    throw error;
  }

  writeSseHead(response);
  writeSseEvent(response, "meta", started.meta);

  try {
    const result = await started.result;
    writeSseEvent(response, "done", result.value);
  } catch (error) {
    const message = error instanceof LlmOverloadedError
      ? "AI 服务繁忙，排队已满，请稍后重试"
      : error instanceof LlmDeadlineExceededError
        ? "AI 请求超时，请稍后重试"
        : error instanceof Error
          ? error.message
          : "AI 请求失败";
    if (!abortController.signal.aborted) {
      writeSseEvent(response, "error", message);
    }
  } finally {
    if (!response.destroyed && !response.writableEnded) {
      response.end();
    }
  }
}

// 处理路由。
async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const origin = typeof request.headers.origin === "string" ? request.headers.origin : undefined;
  const originResult = applyOriginPolicy(origin, config.allowedOrigins, (name, value) => response.setHeader(name, value));
  if (!originResult.allowed) {
    response.writeHead(403, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "请求来源不被允许" }));
    return;
  }

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
      const cacheNonce = typeof body.cacheNonce === "string" && body.cacheNonce.trim().length > 0 ? body.cacheNonce : undefined;
      const payload: WordsBody = { topic: readStringField(body, "topic"), intensity: readStringField(body, "intensity") as Intensity, cacheNonce };
      await handleAiOperation(response, "words", buildWordsPrompt(payload), payload, (raw) => ({ groups: normalizeWordGroups(raw) }));
      return;
    }

    if (request.url === "/api/idea/map") {
      const payload: MindMapBody = { topic: readStringField(body, "topic"), intensity: readStringField(body, "intensity") as Intensity };
      await handleAiOperation(response, "map", buildMindMapPrompt(payload), payload, (raw) => ({ map: normalizeBrainstormMap(raw, payload.topic) }));
      return;
    }

    if (request.url === "/api/idea/map/expand") {
      const payload: ExpandMindNodeBody = {
        topic: readStringField(body, "topic"),
        intensity: readStringField(body, "intensity") as Intensity,
        map: readBrainstormMap(body),
        nodeId: readStringField(body, "nodeId"),
      };
      await handleAiOperation(response, "map.expand", buildExpandMindNodePrompt(payload), payload, (raw) => ({
        expansion: normalizeMindMapExpansion(raw, payload.map, payload.nodeId),
      }));
      return;
    }

    if (request.url === "/api/idea/map/reroll") {
      const payload: RerollMindMapBody = {
        topic: readStringField(body, "topic"),
        intensity: readStringField(body, "intensity") as Intensity,
        map: readBrainstormMap(body),
      };
      await handleAiOperation(response, "map.reroll", buildRerollMindMapPrompt(payload), payload, (raw) => ({
        map: normalizeMindMapReroll(raw, payload.map),
      }));
      return;
    }

    if (request.url === "/api/idea/collision") {
      const payload: CollisionBody = { topic: readStringField(body, "topic"), groups: readDimensionGroups(body) };
      await handleAiOperation(response, "collision", buildCollisionPrompt(payload), payload, (raw) => ({
        recommendation: normalizeCollisionRecommendation(raw, payload.groups),
      }));
      return;
    }

    if (request.url === "/api/idea/ideas") {
      const collisionRecipe = readOptionalCollisionRecipe(body);
      const payload: IdeasBody = {
        topic: readStringField(body, "topic"),
        sourceWords: readSourceWords(body),
        ...(collisionRecipe ? { collisionRecipe } : {}),
      };
      await handleAiOperation(response, "ideas", buildIdeasPrompt(payload), payload, (raw) => ({ ideas: normalizeIdeaCards(raw, payload.sourceWords) }));
      return;
    }

    if (request.url === "/api/idea/transform") {
      const payload: TransformBody = { idea: readIdea(body), direction: readStringField(body, "direction") as TransformDirection };
      await handleAiOperation(response, "transform", buildTransformPrompt(payload), payload, (raw) => ({ idea: normalizeTransformedIdea(raw, payload.idea, payload.direction) }));
      return;
    }

    if (request.url === "/api/idea/refine") {
      const payload: RefineBody = { idea: readIdea(body) };
      await handleAiOperation(response, "refine", buildRefinePrompt(payload), payload, (raw) => ({ refinement: normalizeIdeaRefinement(raw, payload.idea) }));
      return;
    }

    if (request.url === "/api/idea/challenge") {
      const payload: ChallengeBody = { idea: readIdea(body), role: readChallengeRole(body) };
      await handleAiOperation(response, "challenge", buildChallengePrompt(payload), payload, (raw) => ({
        challenge: normalizeIdeaChallenge(raw, payload.idea, payload.role),
      }));
      return;
    }

    if (request.url === "/api/idea/discussion") {
      const payload: DiscussionBody = { idea: readIdea(body), setup: readDiscussionSetup(body) };
      await handleAiOperation(response, "discussion", buildDiscussionPrompt(payload), payload, (raw) => ({
        discussion: { ...normalizeIdeaDiscussion(raw, payload.idea, payload.setup.participants), lineup: payload.setup.lineup, mechanism: payload.setup.mechanism },
      }));
      return;
    }

    if (request.url === "/api/idea/discussion/respond") {
      const idea = readIdea(body);
      const prompt = readStringField(body, "prompt");
      if (prompt.length > 180) {
        throw new Error("讨论介入最多 180 字");
      }
      const sourceRole = readDiscussionRole(body, "sourceRole", true);
      const sourceClaim = readOptionalTextField(body, "sourceClaim");
      const payload: DiscussionResponseBody = {
        idea,
        discussion: readDiscussion(body, idea, true),
        type: readDiscussionInterventionType(body),
        prompt,
        targetRole: readDiscussionRole(body, "targetRole") as IdeaDiscussionRole,
        ...(sourceRole ? { sourceRole } : {}),
        ...(sourceClaim ? { sourceClaim } : {}),
      };
      await handleAiOperation(response, "discussion.respond", buildDiscussionResponsePrompt(payload), payload, (raw) => ({
        intervention: normalizeIdeaDiscussionIntervention(raw, payload),
      }));
      return;
    }

    if (request.url === "/api/idea/discussion/branch") {
      const idea = readIdea(body);
      const map = readBrainstormMap(body);
      const parentNodeId = readStringField(body, "parentNodeId");
      if (!map.nodes.some((node) => node.id === parentNodeId)) {
        throw new Error("分支父节点不存在");
      }
      const payload: DiscussionBranchBody = {
        idea,
        discussion: readDiscussion(body, idea),
        directionKey: readDiscussionDirectionKey(body),
        opposite: body.opposite === true,
        map,
        parentNodeId,
      };
      await handleAiOperation(response, "discussion.branch", buildDiscussionBranchPrompt(payload), payload, (raw) => ({
        expansion: normalizeDiscussionBranchExpansion(raw, payload.map, payload.parentNodeId, {
          ideaId: payload.idea.id,
          discussionId: payload.discussion.id,
          directionKey: payload.directionKey,
          ...(payload.opposite ? { opposite: true } : {}),
        }),
      }));
      return;
    }

    if (request.url === "/api/idea/mix") {
      const payload: MixBody = { ideas: readIdeas(body) };
      await handleAiOperation(response, "mix", buildMixIdeasPrompt(payload), payload, (raw) => ({ seed: normalizeMixedIdeaSeed(raw) }));
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
