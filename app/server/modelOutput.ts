// 这个文件解析和校验模型输出，保证前端拿到结构稳定的数据。
import { createId } from "../src/lib/id";
import { layoutMindMapExpansionNodes, layoutMindMapNodes } from "./mindMapLayout";
import {
  DIMENSION_GROUPS,
  DIMENSION_GROUP_DESCRIPTIONS,
  MIND_NODE_CATEGORIES,
  REFINEMENT_ACTION_TYPES,
  REFINEMENT_DIRECTION_TYPES,
  REFINEMENT_MVP_HORIZONS,
  REFINEMENT_ROLES,
  IDEA_DISCUSSION_ROLES,
  IDEA_DISCUSSION_ROUND_TYPES,
  type IdeaDiscussion,
  type IdeaDiscussionContribution,
  type IdeaDiscussionDirection,
  type IdeaDiscussionDirectionKey,
  type IdeaDiscussionIntervention,
  type IdeaDiscussionInterventionType,
  type IdeaDiscussionRole,
  type IdeaDiscussionRound,
  type BrainstormMap,
  type CollisionRecommendation,
  type DimensionGroup,
  type DimensionGroupType,
  type DimensionWord,
  type IdeaCard,
  type IdeaChallenge,
  type IdeaChallengeRole,
  type IdeaRefinement,
  type MindEdge,
  type MindMapExpansion,
  type MindNode,
  type MindNodeCategory,
  type MixedIdeaSeed,
  type RefinementAction,
  type RefinementDirection,
  type RefinementMvpStep,
  type RefinementRole,
  type RefinementRoleFeedback,
  type StuckType,
  type TransformDirection,
} from "../src/types/idea";

interface RawWord {
  text?: unknown;
  source?: unknown;
}

interface RawWordGroup {
  type?: unknown;
  words?: unknown;
}

interface RawIdea {
  title?: unknown;
  summary?: unknown;
  whyInteresting?: unknown;
  firstVersion?: unknown;
}

interface RawMindNode {
  replaceNodeId?: unknown;
  parentId?: unknown;
  label?: unknown;
  category?: unknown;
  level?: unknown;
  reason?: unknown;
  source?: unknown;
}

interface RawMindEdge {
  from?: unknown;
  to?: unknown;
  label?: unknown;
}

interface RawRoleFeedback {
  role?: unknown;
  feedback?: unknown;
}

interface RawRefinementDirection {
  type?: unknown;
  title?: unknown;
  description?: unknown;
  firstStep?: unknown;
}

interface RawMvpStep {
  horizon?: unknown;
  goal?: unknown;
  build?: unknown;
  proof?: unknown;
}

interface RawRefinementAction {
  type?: unknown;
  label?: unknown;
  description?: unknown;
}

interface RawCollisionSelection {
  groupType?: unknown;
  text?: unknown;
}

// 从模型可能包裹代码块的文本中提取 JSON。
export function parseModelJson(output: string): unknown {
  const trimmed = output.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");

  try {
    return JSON.parse(trimmed);
  } catch {
    const startCandidates = [trimmed.indexOf("{"), trimmed.indexOf("[")].filter((index) => index >= 0);
    const start = Math.min(...startCandidates);
    const end = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
    if (!Number.isFinite(start) || end <= start) {
      throw new Error("模型输出不是 JSON");
    }

    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

// 判断是否为六类合法维度之一。
function isDimensionGroupType(value: unknown): value is DimensionGroupType {
  return typeof value === "string" && DIMENSION_GROUPS.includes(value as DimensionGroupType);
}

// 判断是否为合法导图节点分类。
function isMindNodeCategory(value: unknown): value is MindNodeCategory {
  return typeof value === "string" && MIND_NODE_CATEGORIES.includes(value as MindNodeCategory);
}

// 判断是否为合法卡住类型。
function readStuckType(value: unknown): StuckType {
  return typeof value === "string" && ["没方向", "有技术没需求", "有兴趣没形态", "有产品没差异化"].includes(value) ? (value as StuckType) : "没方向";
}

// 读取对象属性。
function readRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("模型输出结构不是对象");
  }

  return value as Record<string, unknown>;
}

// 读取非空字符串。
function readText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

// 读取炼化结果中的必填文案，缺失时让本次 AI 响应失败。
function readRequiredText(value: unknown, field: string, scope = "模型炼化"): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  throw new Error(`${scope}缺少 ${field}`);
}

function readRequiredIdeaText(value: unknown, field: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  throw new Error(`模型脑洞缺少${field}`);
}

// 读取导图层级。
function readMindLevel(value: unknown): MindNode["level"] {
  return value === 0 || value === 1 || value === 2 || value === 3 ? value : 1;
}

// 普通发散节点至少从第一层开始，只有中心主题允许处于第零层。
function readBranchMindLevel(value: unknown): Exclude<MindNode["level"], 0> {
  const level = readMindLevel(value);
  return level === 0 ? 1 : level;
}

function cleanMethodJargon(value: string): string {
  return value
    .replace(/黑匣子|黑盒/g, "隐藏机制")
    .replace(/远联想/g, "远距类比")
    .replace(/\s+/g, " ")
    .trim();
}

function shortenMindLabel(value: string, category: MindNodeCategory): string {
  let label = cleanMethodJargon(value)
    .replace(/(.+?)的反面需求(?:的反面需求)+/g, "$1的反面需求")
    .replace(/反面需求(?:的反面需求)+/g, "反面需求")
    .replace(/(.{1,8})的反面需求/g, "$1反面")
    .replace(/(.{1,8})的隐藏机制/g, "$1机制")
    .replace(/[，。；：、,.]/g, "")
    .trim();

  if (label.length === 0) {
    label = `${category}节点`;
  }

  return label.length > 12 ? label.slice(0, 12) : label;
}

// 从来源词里整理卡片路径。
function sourcePathFromWords(sourceWords: DimensionWord[]): string[] {
  return Array.from(new Set(sourceWords.flatMap((word) => word.sourcePath ?? [word.text])));
}

// 把模型维度词输出整理成前端可用结构。
export function normalizeWordGroups(output: unknown): DimensionGroup[] {
  const record = readRecord(output);
  if (!Array.isArray(record.groups)) {
    throw new Error("模型没有返回维度词 groups");
  }

  return DIMENSION_GROUPS.map((type) => {
    const rawGroup = (record.groups as RawWordGroup[]).find((group) => group.type === type);
    if (!rawGroup || !Array.isArray(rawGroup.words) || rawGroup.words.length === 0) {
      throw new Error(`模型缺少${type}维度词`);
    }

    const words = (rawGroup.words as RawWord[]).slice(0, 8).map<DimensionWord>((word, index) => ({
      id: createId(`${type}_${index}`),
      text: readRequiredText(word.text, `${type}词`, "模型维度词"),
      groupType: type,
      locked: false,
      selected: index === 0,
      source: readText(word.source, "AI 发散"),
    }));

    return {
      type,
      label: type,
      description: DIMENSION_GROUP_DESCRIPTIONS[type],
      words,
    };
  });
}

// 把模型导图输出整理成前端可用结构。
export function normalizeBrainstormMap(output: unknown, topic: string): BrainstormMap {
  const record = readRecord(output);
  if (!Array.isArray(record.nodes) || record.nodes.length === 0) {
    throw new Error("模型没有返回导图 nodes");
  }

  const center: MindNode = {
    id: createId("mind_center"),
    label: topic,
    category: "中心",
    level: 0,
    x: 50,
    y: 50,
    selectable: false,
    locked: true,
    selected: false,
    reason: "用户输入的中心主题。",
    source: "用户输入",
  };
  const rawNodes = (record.nodes as RawMindNode[]).filter((node) => readText(node.label, "").length > 0).slice(0, 28);
  const nodes: MindNode[] = [center];
  const labelToId = new Map<string, string>([["中心", center.id], [topic, center.id]]);

  rawNodes.forEach((rawNode, index) => {
    const category = isMindNodeCategory(rawNode.category) && rawNode.category !== "中心" ? rawNode.category : "远联想";
    const rawLabel = readText(rawNode.label, `${category}节点`);
    const label = shortenMindLabel(rawLabel, category);
    const id = createId(`ai_mind_${index}`);
    const node: MindNode = {
      id,
      label,
      category,
      level: readBranchMindLevel(rawNode.level),
      x: 50,
      y: 50,
      selectable: true,
      locked: false,
      selected: false,
      reason: cleanMethodJargon(readText(rawNode.reason, "这是一个可继续碰撞的发散节点。")),
      source: cleanMethodJargon(readText(rawNode.source, "AI 发散")),
    };
    nodes.push(node);
    labelToId.set(rawLabel, id);
    labelToId.set(label, id);
  });

  const positionById = new Map(layoutMindMapNodes(nodes.slice(1)).map((position) => [position.id, position]));
  nodes.slice(1).forEach((node) => {
    const position = positionById.get(node.id);
    if (position) {
      node.x = position.x;
      node.y = position.y;
    }
  });

  const rawEdges = Array.isArray(record.edges) ? (record.edges as RawMindEdge[]) : [];
  const edges: MindEdge[] = rawEdges
    .map((edge, index) => {
      const from = labelToId.get(readText(edge.from, "中心")) ?? center.id;
      const to = labelToId.get(readText(edge.to, ""));
      if (!to || from === to) {
        return undefined;
      }

      return {
        id: createId(`ai_edge_${index}`),
        from,
        to,
        label: cleanMethodJargon(readText(edge.label, "联想")),
      };
    })
    .filter((edge): edge is MindEdge => Boolean(edge));

  for (const node of nodes.slice(1)) {
    if (!edges.some((edge) => edge.to === node.id)) {
      edges.push({ id: createId(`ai_edge_auto_${node.id}`), from: center.id, to: node.id, label: node.category });
    }
  }

  const recommendedLabels = Array.isArray(record.recommendedNodeLabels) ? record.recommendedNodeLabels.map((label) => readText(label, "")) : [];
  const recommendedNodeIds = recommendedLabels.map((label) => labelToId.get(label)).filter((id): id is string => Boolean(id)).slice(0, 6);
  const fallbackRecommended = nodes.slice(1, 7).map((node) => node.id);
  const selectedIds = recommendedNodeIds.length > 0 ? recommendedNodeIds : fallbackRecommended;
  const selectedIdSet = new Set(selectedIds);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const nodesWithParents = nodes.map((node, index) => {
    if (node.id === center.id) {
      return node;
    }

    const rawParent = readText(rawNodes[index - 1]?.parentId, "");
    const explicitParentId = labelToId.get(rawParent) ?? (nodeById.has(rawParent) ? rawParent : undefined);
    const edgeParentId = edges.find((edge) => edge.to === node.id)?.from;
    const parentId = [explicitParentId, edgeParentId, center.id].find((candidate) => {
      const parent = candidate ? nodeById.get(candidate) : undefined;
      return Boolean(parent && parent.id !== node.id && parent.level < node.level);
    }) ?? center.id;

    return { ...node, parentId };
  });

  return {
    id: createId("ai_mind_map"),
    topic,
    stuckType: readStuckType(record.stuckType),
    center,
    nodes: nodesWithParents.map((node) => ({ ...node, selected: selectedIdSet.has(node.id) })),
    edges,
    recommendedNodeIds: selectedIds,
    createdAt: new Date().toISOString(),
  };
}

// 把模型的节点扩展结果整理成可并入现有导图的新节点和边。
export function normalizeMindMapExpansion(output: unknown, map: BrainstormMap, parentNodeId: string): MindMapExpansion {
  const record = readRecord(output);
  if (!Array.isArray(record.nodes) || record.nodes.length === 0) {
    throw new Error("模型没有返回扩展 nodes");
  }

  const parentNode = map.nodes.find((node) => node.id === parentNodeId);
  if (!parentNode) {
    throw new Error("当前节点不存在");
  }

  const existingLabels = new Set(map.nodes.map((node) => node.label));
  const seenLabels = new Set<string>();
  const rawNodes = (record.nodes as RawMindNode[]).filter((node) => readText(node.label, "").length > 0).slice(0, 10);
  const nodes: MindNode[] = [];
  const labelToId = new Map<string, string>();

  rawNodes.forEach((rawNode, index) => {
    const category = isMindNodeCategory(rawNode.category) && rawNode.category !== "中心" ? rawNode.category : "远联想";
    const rawLabel = readText(rawNode.label, `${category}节点`);
    const label = shortenMindLabel(rawLabel, category);
    if (existingLabels.has(label) || seenLabels.has(label)) {
      return;
    }

    seenLabels.add(label);
    const angle = (-38 + index * 19) * (Math.PI / 180);
    const level = Math.max(readMindLevel(rawNode.level), Math.min(3, parentNode.level + 1)) as MindNode["level"];
    const radius = 16 + nodes.length * 3;
    const id = createId(`ai_expand_${index}`);
    nodes.push({
      id,
      label,
      category,
      level,
      x: Math.max(8, Math.min(92, parentNode.x + Math.cos(angle) * radius)),
      y: Math.max(10, Math.min(90, parentNode.y + Math.sin(angle) * radius)),
      selectable: true,
      locked: false,
      selected: false,
      reason: cleanMethodJargon(readText(rawNode.reason, `从“${parentNode.label}”继续发散出的新节点。`)),
      source: cleanMethodJargon(readText(rawNode.source, "AI 继续发散")),
      parentId: parentNode.id,
    });
    labelToId.set(rawLabel, id);
    labelToId.set(label, id);
  });

  if (nodes.length === 0) {
    throw new Error("模型扩展结果与已有节点重复");
  }

  const expansionPositionById = new Map(layoutMindMapExpansionNodes(map.nodes, parentNode, nodes).map((position) => [position.id, position]));
  nodes.forEach((node) => {
    const position = expansionPositionById.get(node.id);
    if (position) {
      node.x = position.x;
      node.y = position.y;
    }
  });

  const edges = nodes.map<MindEdge>((node, index) => ({
    id: createId(`ai_expand_edge_${index}`),
    from: parentNode.id,
    to: node.id,
    label: node.source ?? node.category,
  }));
  const recommendedLabels = Array.isArray(record.recommendedNodeLabels) ? record.recommendedNodeLabels.map((label) => readText(label, "")) : [];
  const recommendedNodeIds = recommendedLabels.map((label) => labelToId.get(label) ?? labelToId.get(shortenMindLabel(label, "远联想"))).filter((id): id is string => Boolean(id));
  const fallbackRecommended = nodes.slice(0, 4).map((node) => node.id);

  return {
    nodes,
    edges,
    recommendedNodeIds: recommendedNodeIds.length > 0 ? Array.from(new Set(recommendedNodeIds)).slice(0, 4) : fallbackRecommended,
  };
}

// 把模型重掷结果合并回现有导图，只允许替换未锁定节点的内容。
export function normalizeMindMapReroll(output: unknown, map: BrainstormMap): BrainstormMap {
  const record = readRecord(output);
  if (!Array.isArray(record.nodes) || record.nodes.length === 0) {
    throw new Error("模型没有返回重掷 nodes");
  }

  const unlockedNodes = map.nodes.filter((node) => node.selectable && !node.locked && node.category !== "中心");
  if (unlockedNodes.length === 0) {
    return map;
  }

  const unlockedIds = new Set(unlockedNodes.map((node) => node.id));
  const stableLabels = new Set(map.nodes.filter((node) => !unlockedIds.has(node.id)).map((node) => node.label));
  const seenLabels = new Set<string>();
  const replacementById = new Map<string, MindNode>();

  for (const rawNode of record.nodes as RawMindNode[]) {
    const replaceNodeId = readRequiredText(rawNode.replaceNodeId, "replaceNodeId", "模型重掷");
    if (!unlockedIds.has(replaceNodeId)) {
      throw new Error(`模型重掷包含不能替换的节点 ${replaceNodeId}`);
    }

    const original = unlockedNodes.find((node) => node.id === replaceNodeId);
    if (!original) {
      throw new Error(`模型重掷找不到原节点 ${replaceNodeId}`);
    }

    const category = isMindNodeCategory(rawNode.category) && rawNode.category !== "中心" ? rawNode.category : original.category;
    const label = shortenMindLabel(readRequiredText(rawNode.label, "label", "模型重掷"), category);
    if (stableLabels.has(label) || seenLabels.has(label)) {
      throw new Error("模型重掷结果重复");
    }

    seenLabels.add(label);
    replacementById.set(replaceNodeId, {
      ...original,
      label,
      category,
      reason: cleanMethodJargon(readRequiredText(rawNode.reason, "reason", "模型重掷")),
      source: cleanMethodJargon(readText(rawNode.source, "AI 重掷")),
    });
  }

  const missingNodes = unlockedNodes.filter((node) => !replacementById.has(node.id));
  if (missingNodes.length > 0) {
    throw new Error(`模型重掷缺少节点 ${missingNodes.map((node) => node.label).join("、")}`);
  }

  if (!Array.isArray(record.recommendedNodeIds) || record.recommendedNodeIds.length === 0) {
    throw new Error("模型重掷缺少 recommendedNodeIds");
  }

  const allNodeIds = new Set(map.nodes.map((node) => node.id));
  const recommendedNodeIds = Array.from(new Set(record.recommendedNodeIds.map((id) => readText(id, "")).filter((id) => allNodeIds.has(id)))).slice(0, 8);
  if (recommendedNodeIds.length === 0) {
    throw new Error("模型重掷推荐节点无效");
  }
  const selectedIdSet = new Set(recommendedNodeIds);

  return {
    ...map,
    nodes: map.nodes.map((node) => {
      const replacement = replacementById.get(node.id);
      const nextNode = replacement ?? node;
      return nextNode.selectable ? { ...nextNode, selected: selectedIdSet.has(nextNode.id) } : nextNode;
    }),
    recommendedNodeIds,
  };
}

// 把模型碰撞推荐映射回现有词 id，禁止模型新增或改写候选词。
export function normalizeCollisionRecommendation(output: unknown, groups: DimensionGroup[]): CollisionRecommendation {
  const record = readRecord(output);
  if (!Array.isArray(record.selections)) {
    throw new Error("模型没有返回碰撞 selections");
  }

  const selectedWordIds = DIMENSION_GROUPS.map((groupType) => {
    const selection = (record.selections as RawCollisionSelection[]).find((item) => item.groupType === groupType);
    if (!selection) {
      throw new Error(`模型碰撞缺少 ${groupType}`);
    }

    const text = readRequiredText(selection.text, `${groupType}候选词`, "模型碰撞");
    const group = groups.find((item) => item.type === groupType);
    const word = group?.words.find((item) => item.text === text);
    if (!word) {
      throw new Error(`模型选择了不存在的候选词：${groupType}/${text}`);
    }

    return word.id;
  });

  return {
    selectedWordIds,
    reason: readRequiredText(record.reason, "推荐理由", "模型碰撞"),
  };
}

// 把模型脑洞输出整理成前端可用卡片。
export function normalizeIdeaCards(output: unknown, sourceWords: DimensionWord[]): IdeaCard[] {
  const record = readRecord(output);
  if (!Array.isArray(record.ideas) || record.ideas.length === 0) {
    throw new Error("模型没有返回可用脑洞");
  }

  return (record.ideas as RawIdea[]).slice(0, 5).map<IdeaCard>((idea, index) => ({
    id: createId(`ai_idea_${index}`),
    title: readRequiredIdeaText(idea.title, "标题"),
    summary: readRequiredIdeaText(idea.summary, "一句话解释"),
    whyInteresting: readRequiredIdeaText(idea.whyInteresting, "有趣点"),
    firstVersion: readRequiredIdeaText(idea.firstVersion, "第一版"),
    sourceWords,
    sourcePath: sourcePathFromWords(sourceWords),
    createdAt: new Date().toISOString(),
  }));
}

// 把模型变形输出整理成单张卡片。
export function normalizeTransformedIdea(output: unknown, original: IdeaCard, direction: TransformDirection): IdeaCard {
  const record = readRecord(output);
  const rawIdea = readRecord(record.idea);

  return {
    id: createId("ai_transform"),
    parentId: original.id,
    transformDirection: direction,
    title: readRequiredIdeaText(rawIdea.title, "标题"),
    summary: readRequiredIdeaText(rawIdea.summary, "一句话解释"),
    whyInteresting: readRequiredIdeaText(rawIdea.whyInteresting, "有趣点"),
    firstVersion: readRequiredIdeaText(rawIdea.firstVersion, "第一版"),
    sourceWords: original.sourceWords,
    sourcePath: original.sourcePath,
    createdAt: new Date().toISOString(),
  };
}

// 把模型炼化输出整理成前端可用结构。
export function normalizeIdeaRefinement(output: unknown, idea: IdeaCard): IdeaRefinement {
  const record = readRecord(output);
  const refinementRecord = readRecord(record.refinement ?? record);
  const vitalityRecord = readRecord(refinementRecord.vitality);
  const rawRoundtable = refinementRecord.roundtable;
  const rawDirections = refinementRecord.directions;
  const rawMvpLadder = refinementRecord.mvpLadder;
  const rawActions = refinementRecord.actions;

  if (!Array.isArray(rawRoundtable)) {
    throw new Error("模型炼化缺少 roundtable");
  }
  if (!Array.isArray(rawDirections)) {
    throw new Error("模型炼化缺少 directions");
  }
  if (!Array.isArray(rawMvpLadder)) {
    throw new Error("模型炼化缺少 mvpLadder");
  }
  if (!Array.isArray(rawActions)) {
    throw new Error("模型炼化缺少 actions");
  }

  const roundtable = REFINEMENT_ROLES.map<RefinementRoleFeedback>((role) => {
    const raw = (rawRoundtable as RawRoleFeedback[]).find((item) => item.role === role);
    if (!raw) {
      throw new Error(`模型炼化缺少 ${role} 反馈`);
    }

    return {
      role,
      feedback: readRequiredText(raw.feedback, `${role}反馈`),
    };
  });

  const directions = REFINEMENT_DIRECTION_TYPES.map<RefinementDirection>((type) => {
    const raw = (rawDirections as RawRefinementDirection[]).find((item) => item.type === type);
    if (!raw) {
      throw new Error(`模型炼化缺少 ${type} 方向`);
    }

    return {
      type,
      title: readRequiredText(raw.title, `${type}标题`),
      description: readRequiredText(raw.description, `${type}描述`),
      firstStep: readRequiredText(raw.firstStep, `${type}第一步`),
    };
  });

  const mvpLadder = REFINEMENT_MVP_HORIZONS.map<RefinementMvpStep>((horizon) => {
    const raw = (rawMvpLadder as RawMvpStep[]).find((item) => item.horizon === horizon);
    if (!raw) {
      throw new Error(`模型炼化缺少 ${horizon}`);
    }

    return {
      horizon,
      goal: readRequiredText(raw.goal, `${horizon}目标`),
      build: readRequiredText(raw.build, `${horizon}制作内容`),
      proof: readRequiredText(raw.proof, `${horizon}验证信号`),
    };
  });

  const actions = REFINEMENT_ACTION_TYPES.map<RefinementAction>((type) => {
    const raw = (rawActions as RawRefinementAction[]).find((item) => item.type === type);
    if (!raw) {
      throw new Error(`模型炼化缺少 ${type} 动作`);
    }

    return {
      type,
      label: readRequiredText(raw.label, `${type}标签`),
      description: readRequiredText(raw.description, `${type}说明`),
    };
  });

  return {
    id: createId("ai_refinement"),
    ideaId: idea.id,
    vitality: {
      targetUser: readRequiredText(vitalityRecord.targetUser, "目标用户"),
      triggerScene: readRequiredText(vitalityRecord.triggerScene, "触发场景"),
      coreEmotion: readRequiredText(vitalityRecord.coreEmotion, "核心情绪"),
      existingAlternative: readRequiredText(vitalityRecord.existingAlternative, "已有替代方案"),
      smallestPlayableVersion: readRequiredText(vitalityRecord.smallestPlayableVersion, "最小可玩版本"),
    },
    roundtable,
    directions,
    mvpLadder,
    actions,
    createdAt: new Date().toISOString(),
  };
}

// 把模型挑战输出绑定到请求脑洞和角色，并拒绝缺失的核心字段。
export function normalizeIdeaChallenge(output: unknown, idea: IdeaCard, role: IdeaChallengeRole): IdeaChallenge {
  const record = readRecord(output);
  const wrappedChallenge = record.challenge;
  const challengeRecord = wrappedChallenge && typeof wrappedChallenge === "object" && !Array.isArray(wrappedChallenge)
    ? readRecord(wrappedChallenge)
    : record;
  return {
    ideaId: idea.id,
    role,
    challenge: readRequiredText(challengeRecord.challenge, "具体质疑", "模型挑战"),
    risk: readRequiredText(challengeRecord.risk, "实际风险", "模型挑战"),
    newDirection: readRequiredText(challengeRecord.newDirection, "新方向", "模型挑战"),
    createdAt: new Date().toISOString(),
  };
}

// 严格校验多角色讨论，避免缺轮次或脏字段进入工作区。
export function normalizeIdeaDiscussion(output: unknown, idea: IdeaCard, participants: IdeaDiscussionRole[] = ["用户代言人", "反常识派", "跨界连接者", "现实构建者"]): IdeaDiscussion {
  const record = readRecord(output);
  const discussionRecord = readRecord(record.discussion ?? record);
  const rawRounds = discussionRecord.rounds;
  if (!Array.isArray(rawRounds) || rawRounds.length !== IDEA_DISCUSSION_ROUND_TYPES.length) {
    throw new Error("模型讨论必须包含三轮");
  }

  const rounds = IDEA_DISCUSSION_ROUND_TYPES.map<IdeaDiscussionRound>((type, index) => {
    const rawRound = readRecord(rawRounds[index]);
    if (rawRound.type !== type) {
      throw new Error(`模型讨论轮次必须为 ${type}`);
    }
    if (!Array.isArray(rawRound.contributions) || rawRound.contributions.length === 0) {
      throw new Error(`${type} 轮缺少 contributions`);
    }
    if (rawRound.contributions.length > participants.length) {
      throw new Error(`${type} 轮贡献不能超过本场角色数，最多四条`);
    }
    const contributions = (rawRound.contributions as unknown[]).map<IdeaDiscussionContribution>((rawContribution) => {
      const item = readRecord(rawContribution);
      if (!IDEA_DISCUSSION_ROLES.includes(item.role as (typeof IDEA_DISCUSSION_ROLES)[number]) || !participants.includes(item.role as IdeaDiscussionRole)) {
        throw new Error("模型讨论包含未知角色或本场未选择的角色");
      }
      const sparkValue = item.spark;
      let spark: IdeaDiscussionContribution["spark"];
      if (sparkValue !== undefined) {
        const sparkRecord = readRecord(sparkValue);
        spark = {
          id: readRequiredText(sparkRecord.id, "火花 id", "模型讨论"),
          text: readRequiredText(sparkRecord.text, "火花内容", "模型讨论"),
        };
      }
      const buildsOn = item.buildsOn === undefined ? undefined : readRequiredText(item.buildsOn, "buildsOn", "模型讨论");
      return {
        role: item.role as IdeaDiscussionContribution["role"],
        claim: readRequiredText(item.claim, "claim", "模型讨论"),
        tension: readRequiredText(item.tension, "tension", "模型讨论"),
        ...(spark ? { spark } : {}),
        ...(buildsOn ? { buildsOn } : {}),
      };
    });
    if (type === "judgment") {
      const judgmentRoles = contributions.map((contribution) => contribution.role);
      const hasEveryRoleOnce = judgmentRoles.length === participants.length
        && new Set(judgmentRoles).size === participants.length
        && participants.every((role) => judgmentRoles.includes(role));
      if (!hasEveryRoleOnce) {
        throw new Error("judgment 轮必须包含四个固定角色或本场全部角色各一次");
      }
    }
    const contributionRoles = contributions.map((contribution) => contribution.role);
    if (new Set(contributionRoles).size !== contributionRoles.length) {
      throw new Error(`${type} 轮同一角色最多贡献一条`);
    }
    return { type, contributions };
  });

  const sparkIds = rounds.flatMap((round) => round.contributions.flatMap((contribution) => contribution.spark ? [contribution.spark.id] : []));
  if (new Set(sparkIds).size !== sparkIds.length) {
    throw new Error("模型讨论火花 id 必须唯一");
  }

  if (!discussionRecord.synthesis) {
    throw new Error("模型讨论缺少 synthesis");
  }
  const synthesisRecord = readRecord(discussionRecord.synthesis);
  const normalizeDirection = (key: string): IdeaDiscussionDirection => {
    const direction = readRecord(synthesisRecord[key]);
    return {
      title: readRequiredText(direction.title, `${key} title`, "模型讨论"),
      description: readRequiredText(direction.description, `${key} description`, "模型讨论"),
      nextStep: readRequiredText(direction.nextStep, `${key} nextStep`, "模型讨论"),
    };
  };
  return {
    id: readText(discussionRecord.id, createId("ai_discussion")),
    ideaId: idea.id,
    createdAt: readText(discussionRecord.createdAt, new Date().toISOString()),
    status: "completed",
    participants: [...participants],
    rounds,
    synthesis: {
      conservativeDirection: normalizeDirection("conservativeDirection"),
      radicalDirection: normalizeDirection("radicalDirection"),
      unexpectedDirection: normalizeDirection("unexpectedDirection"),
    },
    collectedSparkIds: [],
    interventions: [],
  };
}

interface DiscussionInterventionBinding {
  type: IdeaDiscussionInterventionType;
  prompt: string;
  targetRole: IdeaDiscussionRole;
  sourceRole?: IdeaDiscussionRole;
  sourceClaim?: string;
}

// 严格解析一次有限介入，身份和用户输入只采用请求值。
export function normalizeIdeaDiscussionIntervention(output: unknown, binding: DiscussionInterventionBinding): IdeaDiscussionIntervention {
  const record = readRecord(output);
  const interventionRecord = readRecord(record.intervention ?? record);
  if (!Array.isArray(interventionRecord.responses) || interventionRecord.responses.length < 1 || interventionRecord.responses.length > 2) {
    throw new Error("模型介入必须返回 1 到 2 条回应");
  }
  const responses = interventionRecord.responses.map<IdeaDiscussionContribution>((rawResponse) => {
    const item = readRecord(rawResponse);
    if (!IDEA_DISCUSSION_ROLES.includes(item.role as IdeaDiscussionRole)) {
      throw new Error("模型介入包含未知角色");
    }
    return {
      role: item.role as IdeaDiscussionRole,
      claim: readRequiredText(item.claim, "claim", "模型介入"),
      tension: readRequiredText(item.tension, "tension", "模型介入"),
    };
  });
  if (responses[0]?.role !== binding.targetRole) {
    throw new Error("模型介入第一条回应必须来自目标角色");
  }
  if (new Set(responses.map((response) => response.role)).size !== responses.length) {
    throw new Error("模型介入回应角色不能重复");
  }
  return {
    id: createId("discussion_intervention"),
    type: binding.type,
    prompt: binding.prompt,
    targetRole: binding.targetRole,
    ...(binding.sourceRole ? { sourceRole: binding.sourceRole } : {}),
    ...(binding.sourceClaim ? { sourceClaim: binding.sourceClaim } : {}),
    responses,
    createdAt: new Date().toISOString(),
  };
}

interface DiscussionBranchOrigin {
  ideaId: string;
  discussionId: string;
  directionKey: IdeaDiscussionDirectionKey;
  opposite?: boolean;
}

// 复用标准导图扩展，并把最终节点数量与讨论谱系收紧。
export function normalizeDiscussionBranchExpansion(output: unknown, map: BrainstormMap, parentNodeId: string, origin: DiscussionBranchOrigin): MindMapExpansion {
  const expansion = normalizeMindMapExpansion(output, map, parentNodeId);
  if (expansion.nodes.length < 4 || expansion.nodes.length > 6) {
    throw new Error("讨论方向分支必须包含 4 到 6 个有效节点");
  }
  return {
    ...expansion,
    nodes: expansion.nodes.map((node) => ({ ...node, discussionOrigin: { ...origin } })),
  };
}

// 把模型混合输出整理成可以重新发散的主题种子。
export function normalizeMixedIdeaSeed(output: unknown): MixedIdeaSeed {
  const record = readRecord(output);
  const rawTitles = record.sourceIdeaTitles;

  return {
    mixedTopic: readRequiredText(record.mixedTopic, "混合主题"),
    theme: readRequiredText(record.theme, "共同母题"),
    tension: readRequiredText(record.tension, "核心张力"),
    startingPrompt: readRequiredText(record.startingPrompt, "起点句子"),
    sourceIdeaTitles: Array.isArray(rawTitles) ? rawTitles.map((title) => readText(title, "")).filter(Boolean).slice(0, 3) : [],
    createdAt: new Date().toISOString(),
  };
}
