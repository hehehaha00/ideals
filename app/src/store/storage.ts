// 这个文件负责保存工作区和孵化箱，并兼容旧收藏数据与局部损坏内容。
import {
  DIMENSION_GROUPS,
  IDEA_CHALLENGE_ROLES,
  IDEA_DISCUSSION_ROLES,
  IDEA_DISCUSSION_LINEUPS,
  IDEA_DISCUSSION_MECHANISMS,
  IDEA_DISCUSSION_ROUND_TYPES,
  IDEA_DISCUSSION_STATUSES,
  isCollisionRecipeId,
  isIdeaDiscussionDirectionKey,
  isIdeaDiscussionInterventionType,
  MIND_NODE_CATEGORIES,
  REFINEMENT_ACTION_TYPES,
  REFINEMENT_DIRECTION_TYPES,
  REFINEMENT_MVP_HORIZONS,
  REFINEMENT_ROLES,
  TRANSFORM_DIRECTIONS,
  type BrainstormMap,
  type FavoriteIdea,
  type IdeaCard,
  type IdeaChallenge,
  type IdeaDiscussion,
  type IdeaDiscussionContribution,
  type IdeaDiscussionDirection,
  type IdeaDiscussionIntervention,
  type IdeaDiscussionRound,
  type IdeaDiscussionSynthesis,
  type IdeaExecutionPlan,
  type IdeaExecutionTask,
  type IdeaOriginSnapshot,
  type IdeaRefinement,
  type IncubatorEntry,
  type MindEdge,
  type MindNode,
  type MindNodeGroup,
  type MixedIdeaSeed,
  type StoredIdeaState,
  type WorkspaceSnapshot,
} from "../types/idea";

const STORAGE_V1_KEY = "idea-lab:v1";
const STORAGE_V2_KEY = "idea-lab:v2";

const EMPTY_STATE: StoredIdeaState = {
  version: 2,
  incubatorEntries: [],
};

export type StorageWriteResult = { ok: true } | { ok: false; message: string };

// 判断未知值是否是普通对象。
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// 判断未知值是否是非空字符串。
function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

// 判断未知值是否是可安全恢复的有限数值。
function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

// 校验脑洞来源快照；活动节点缺失或不在来源集合时回退到最后一个来源节点。
function parseIdeaOrigin(value: unknown): IdeaOriginSnapshot | undefined {
  if (
    !isRecord(value) ||
    !isString(value.mapId) ||
    !Array.isArray(value.sourceNodeIds) ||
    value.sourceNodeIds.length === 0 ||
    !value.sourceNodeIds.every(isString) ||
    !isRecord(value.viewport) ||
    !isFiniteNumber(value.viewport.panX) ||
    !isFiniteNumber(value.viewport.panY) ||
    !isFiniteNumber(value.viewport.scale) ||
    value.viewport.scale <= 0 ||
    (value.activeNodeId !== undefined && !isString(value.activeNodeId))
  ) {
    return undefined;
  }
  const activeNodeId =
    isString(value.activeNodeId) && value.sourceNodeIds.includes(value.activeNodeId)
      ? value.activeNodeId
      : value.sourceNodeIds.at(-1);
  if (!activeNodeId) return undefined;
  return {
    mapId: value.mapId,
    sourceNodeIds: value.sourceNodeIds,
    activeNodeId,
    viewport: {
      panX: value.viewport.panX,
      panY: value.viewport.panY,
      scale: value.viewport.scale,
    },
    ...(isCollisionRecipeId(value.collisionRecipe) ? { collisionRecipe: value.collisionRecipe } : {}),
  };
}

// 校验维度词并只保留合法的可选路径。
function parseDimensionWord(value: unknown): IdeaCard["sourceWords"][number] | undefined {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    typeof value.text !== "string" ||
    !DIMENSION_GROUPS.includes(value.groupType as (typeof DIMENSION_GROUPS)[number]) ||
    typeof value.locked !== "boolean" ||
    typeof value.selected !== "boolean" ||
    typeof value.source !== "string"
  ) {
    return undefined;
  }
  return {
    id: value.id,
    text: value.text,
    groupType: value.groupType as IdeaCard["sourceWords"][number]["groupType"],
    locked: value.locked,
    selected: value.selected,
    source: value.source,
    ...(Array.isArray(value.sourcePath) && value.sourcePath.every((item) => typeof item === "string") ? { sourcePath: value.sourcePath } : {}),
  };
}

// 校验脑洞并逐项过滤损坏的来源词。
function parseIdeaCard(value: unknown): IdeaCard | undefined {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    typeof value.title !== "string" ||
    typeof value.summary !== "string" ||
    typeof value.whyInteresting !== "string" ||
    typeof value.firstVersion !== "string" ||
    !Array.isArray(value.sourceWords) ||
    typeof value.createdAt !== "string"
  ) {
    return undefined;
  }
  const origin = parseIdeaOrigin(value.origin);
  return {
    id: value.id,
    title: value.title,
    summary: value.summary,
    whyInteresting: value.whyInteresting,
    firstVersion: value.firstVersion,
    sourceWords: value.sourceWords.map(parseDimensionWord).filter((item): item is NonNullable<typeof item> => Boolean(item)),
    createdAt: value.createdAt,
    ...(Array.isArray(value.sourcePath) && value.sourcePath.every((item) => typeof item === "string") ? { sourcePath: value.sourcePath } : {}),
    ...(origin ? { origin } : {}),
    ...(isString(value.parentId) ? { parentId: value.parentId } : {}),
    ...(TRANSFORM_DIRECTIONS.includes(value.transformDirection as (typeof TRANSFORM_DIRECTIONS)[number])
      ? { transformDirection: value.transformDirection as IdeaCard["transformDirection"] }
      : {}),
  };
}

// 校验导图节点。
function parseMindNode(value: unknown): MindNode | undefined {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    typeof value.label !== "string" ||
    !MIND_NODE_CATEGORIES.includes(value.category as (typeof MIND_NODE_CATEGORIES)[number]) ||
    typeof value.level !== "number" ||
    ![0, 1, 2, 3].includes(value.level) ||
    !isFiniteNumber(value.x) ||
    !isFiniteNumber(value.y) ||
    typeof value.selectable !== "boolean" ||
    typeof value.locked !== "boolean" ||
    typeof value.selected !== "boolean" ||
    typeof value.reason !== "string"
  ) {
    return undefined;
  }
  const discussionOrigin = isRecord(value.discussionOrigin) &&
    isString(value.discussionOrigin.ideaId) &&
    isString(value.discussionOrigin.discussionId) &&
    isIdeaDiscussionDirectionKey(value.discussionOrigin.directionKey)
    ? {
        ideaId: value.discussionOrigin.ideaId,
        discussionId: value.discussionOrigin.discussionId,
        directionKey: value.discussionOrigin.directionKey,
        ...(value.discussionOrigin.opposite === true ? { opposite: true } : {}),
      }
    : undefined;
  return {
    id: value.id,
    label: value.label,
    category: value.category as MindNode["category"],
    level: value.level as MindNode["level"],
    x: value.x,
    y: value.y,
    selectable: value.selectable,
    locked: value.locked,
    selected: value.selected,
    reason: value.reason,
    ...(typeof value.source === "string" ? { source: value.source } : {}),
    ...(typeof value.parentId === "string" ? { parentId: value.parentId } : {}),
    ...(typeof value.collapsed === "boolean" ? { collapsed: value.collapsed } : {}),
    ...(typeof value.note === "string" && value.note.trim() ? { note: value.note.trim() } : {}),
    ...(isString(value.groupId) ? { groupId: value.groupId } : {}),
    ...(discussionOrigin ? { discussionOrigin } : {}),
  };
}

// 按节点在导图中的稳定顺序恢复分组，并过滤不存在、不可选或重复占用的引用。
function parseMindNodeGroups(value: unknown, nodes: MindNode[], centerId: string): { groups: MindNodeGroup[]; nodes: MindNode[] } {
  const rawGroups = Array.isArray(value) ? value : [];
  const selectableNodes = nodes.filter((node) => node.selectable && node.id !== centerId);
  const occupiedNodeIds = new Set<string>();
  const groupIds = new Set<string>();
  const groups: MindNodeGroup[] = [];

  for (const rawGroup of rawGroups) {
    if (
      !isRecord(rawGroup) ||
      !isString(rawGroup.id) ||
      groupIds.has(rawGroup.id) ||
      typeof rawGroup.name !== "string" ||
      !rawGroup.name.trim() ||
      !Array.isArray(rawGroup.nodeIds) ||
      typeof rawGroup.createdAt !== "string"
    ) {
      continue;
    }
    const requestedIds = new Set(rawGroup.nodeIds.filter(isString));
    const nodeIds = selectableNodes
      .filter((node) => requestedIds.has(node.id) && !occupiedNodeIds.has(node.id))
      .map((node) => node.id);
    if (nodeIds.length < 2) continue;
    groupIds.add(rawGroup.id);
    nodeIds.forEach((id) => occupiedNodeIds.add(id));
    groups.push({ id: rawGroup.id, name: rawGroup.name.trim(), nodeIds, createdAt: rawGroup.createdAt });
  }

  const groupByNodeId = new Map(groups.flatMap((group) => group.nodeIds.map((nodeId) => [nodeId, group.id] as const)));
  const normalizedNodes = nodes.map((node) => {
    const groupId = groupByNodeId.get(node.id);
    const { groupId: _storedGroupId, ...rest } = node;
    return groupId ? { ...rest, groupId } : rest;
  });
  return { groups, nodes: normalizedNodes };
}

// 校验导图连线。
function parseMindEdge(value: unknown): MindEdge | undefined {
  if (!isRecord(value) || !isString(value.id) || !isString(value.from) || !isString(value.to) || typeof value.label !== "string") {
    return undefined;
  }
  return { id: value.id, from: value.from, to: value.to, label: value.label };
}

// 校验最后一次混合结果的全部稳定字段。
function parseMixedIdeaSeed(value: unknown): MixedIdeaSeed | undefined {
  if (
    !isRecord(value) ||
    typeof value.mixedTopic !== "string" ||
    typeof value.theme !== "string" ||
    typeof value.tension !== "string" ||
    typeof value.startingPrompt !== "string" ||
    !Array.isArray(value.sourceIdeaTitles) ||
    !value.sourceIdeaTitles.every((title) => typeof title === "string") ||
    typeof value.createdAt !== "string"
  ) {
    return undefined;
  }
  return {
    mixedTopic: value.mixedTopic,
    theme: value.theme,
    tension: value.tension,
    startingPrompt: value.startingPrompt,
    sourceIdeaTitles: value.sourceIdeaTitles,
    createdAt: value.createdAt,
  };
}

// 校验炼化结果，并逐项过滤各列表中的损坏成员。
function parseRefinement(value: unknown, expectedIdeaId?: string): IdeaRefinement | undefined {
  if (!isRecord(value) || !isString(value.id) || !isString(value.ideaId) || (expectedIdeaId && value.ideaId !== expectedIdeaId) || !isRecord(value.vitality)) {
    return undefined;
  }
  const vitality = value.vitality;
  const vitalityKeys = ["targetUser", "triggerScene", "coreEmotion", "existingAlternative", "smallestPlayableVersion"] as const;
  if (!vitalityKeys.every((key) => typeof vitality[key] === "string")) {
    return undefined;
  }
  if (!Array.isArray(value.roundtable) || !Array.isArray(value.directions) || !Array.isArray(value.mvpLadder) || !Array.isArray(value.actions) || typeof value.createdAt !== "string") {
    return undefined;
  }
  const roundtable = value.roundtable.filter(
    (item): item is IdeaRefinement["roundtable"][number] =>
      isRecord(item) && REFINEMENT_ROLES.includes(item.role as (typeof REFINEMENT_ROLES)[number]) && typeof item.feedback === "string",
  );
  const directions = value.directions.filter(
    (item): item is IdeaRefinement["directions"][number] =>
      isRecord(item) &&
      REFINEMENT_DIRECTION_TYPES.includes(item.type as (typeof REFINEMENT_DIRECTION_TYPES)[number]) &&
      typeof item.title === "string" &&
      typeof item.description === "string" &&
      typeof item.firstStep === "string",
  );
  const mvpLadder = value.mvpLadder.filter(
    (item): item is IdeaRefinement["mvpLadder"][number] =>
      isRecord(item) &&
      REFINEMENT_MVP_HORIZONS.includes(item.horizon as (typeof REFINEMENT_MVP_HORIZONS)[number]) &&
      typeof item.goal === "string" &&
      typeof item.build === "string" &&
      typeof item.proof === "string",
  );
  const actions = value.actions.filter(
    (item): item is IdeaRefinement["actions"][number] =>
      isRecord(item) &&
      REFINEMENT_ACTION_TYPES.includes(item.type as (typeof REFINEMENT_ACTION_TYPES)[number]) &&
      typeof item.label === "string" &&
      typeof item.description === "string",
  );
  return {
    id: value.id,
    ideaId: value.ideaId,
    vitality: vitality as unknown as IdeaRefinement["vitality"],
    roundtable,
    directions,
    mvpLadder,
    actions,
    createdAt: value.createdAt,
  };
}

// 校验单条反共识挑战，确保它属于预期脑洞且所有文本字段完整。
function parseIdeaChallenge(value: unknown, expectedIdeaId: string): IdeaChallenge | undefined {
  if (
    !isRecord(value) ||
    value.ideaId !== expectedIdeaId ||
    !IDEA_CHALLENGE_ROLES.includes(value.role as (typeof IDEA_CHALLENGE_ROLES)[number]) ||
    !isString(value.challenge) ||
    !isString(value.risk) ||
    !isString(value.newDirection) ||
    !isString(value.createdAt)
  ) {
    return undefined;
  }
  return {
    ideaId: expectedIdeaId,
    role: value.role as IdeaChallenge["role"],
    challenge: value.challenge,
    risk: value.risk,
    newDirection: value.newDirection,
    createdAt: value.createdAt,
  };
}

// 逐项过滤挑战，同角色重复时保留最后一条，并按固定角色顺序恢复。
function parseIdeaChallenges(value: unknown, expectedIdeaId: string): IdeaChallenge[] {
  if (!Array.isArray(value)) return [];
  const challengeByRole = new Map<IdeaChallenge["role"], IdeaChallenge>();
  for (const rawChallenge of value) {
    const challenge = parseIdeaChallenge(rawChallenge, expectedIdeaId);
    if (challenge) challengeByRole.set(challenge.role, challenge);
  }
  return IDEA_CHALLENGE_ROLES.flatMap((role) => {
    const challenge = challengeByRole.get(role);
    return challenge ? [challenge] : [];
  });
}

// 校验讨论中的单个灵感火花；损坏火花不会拖累有效观点。
function parseIdeaDiscussionSpark(value: unknown): IdeaDiscussionContribution["spark"] {
  if (!isRecord(value) || !isString(value.id) || !isString(value.text)) return undefined;
  return { id: value.id, text: value.text };
}

// 校验单条角色观点，并只保留合法的可选关联字段。
function parseIdeaDiscussionContribution(value: unknown): IdeaDiscussionContribution | undefined {
  if (
    !isRecord(value) ||
    !IDEA_DISCUSSION_ROLES.includes(value.role as (typeof IDEA_DISCUSSION_ROLES)[number]) ||
    !isString(value.claim) ||
    !isString(value.tension)
  ) {
    return undefined;
  }
  const spark = parseIdeaDiscussionSpark(value.spark);
  return {
    role: value.role as IdeaDiscussionContribution["role"],
    claim: value.claim,
    tension: value.tension,
    ...(spark ? { spark } : {}),
    ...(isString(value.buildsOn) ? { buildsOn: value.buildsOn } : {}),
  };
}

// 校验用户介入记录；回应必须是 1-2 条且每条使用不同角色。
function parseIdeaDiscussionIntervention(value: unknown): IdeaDiscussionIntervention | undefined {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    !isIdeaDiscussionInterventionType(value.type) ||
    typeof value.prompt !== "string" ||
    !value.prompt.trim() ||
    value.prompt.length > 180 ||
    !IDEA_DISCUSSION_ROLES.includes(value.targetRole as (typeof IDEA_DISCUSSION_ROLES)[number]) ||
    !isString(value.createdAt) ||
    !Array.isArray(value.responses) ||
    value.responses.length < 1 ||
    value.responses.length > 2
  ) {
    return undefined;
  }
  const hasSourceRole = value.sourceRole !== undefined;
  const hasSourceClaim = value.sourceClaim !== undefined;
  if (hasSourceRole !== hasSourceClaim) return undefined;
  if (
    hasSourceRole &&
    (!IDEA_DISCUSSION_ROLES.includes(value.sourceRole as (typeof IDEA_DISCUSSION_ROLES)[number]) ||
      typeof value.sourceClaim !== "string" ||
      !value.sourceClaim.trim())
  ) {
    return undefined;
  }
  const responses = value.responses
    .map(parseIdeaDiscussionContribution)
    .filter((item): item is IdeaDiscussionContribution => Boolean(item));
  if (responses.length !== value.responses.length || new Set(responses.map((response) => response.role)).size !== responses.length) {
    return undefined;
  }
  if (responses[0]?.role !== value.targetRole) return undefined;
  return {
    id: value.id,
    type: value.type,
    prompt: value.prompt,
    targetRole: value.targetRole as IdeaDiscussionIntervention["targetRole"],
    ...(hasSourceRole ? { sourceRole: value.sourceRole as IdeaDiscussionIntervention["sourceRole"] } : {}),
    ...(hasSourceClaim ? { sourceClaim: value.sourceClaim as string } : {}),
    responses,
    createdAt: value.createdAt,
  };
}

// 按场次逐条恢复介入，最多保留前三条合法记录。
function parseIdeaDiscussionInterventions(value: unknown): IdeaDiscussionIntervention[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(parseIdeaDiscussionIntervention)
    .filter((item): item is IdeaDiscussionIntervention => Boolean(item))
    .slice(0, 3);
}

// 校验一轮讨论；未知轮次和没有有效观点的空轮次会被跳过。
function parseIdeaDiscussionRound(value: unknown): IdeaDiscussionRound | undefined {
  if (
    !isRecord(value) ||
    !IDEA_DISCUSSION_ROUND_TYPES.includes(value.type as (typeof IDEA_DISCUSSION_ROUND_TYPES)[number]) ||
    !Array.isArray(value.contributions)
  ) {
    return undefined;
  }
  const contributions = value.contributions
    .map(parseIdeaDiscussionContribution)
    .filter((item): item is IdeaDiscussionContribution => Boolean(item));
  const roles = contributions.map((contribution) => contribution.role);
  if (contributions.length === 0 || contributions.length > IDEA_DISCUSSION_ROLES.length || new Set(roles).size !== roles.length) return undefined;
  return { type: value.type as IdeaDiscussionRound["type"], contributions };
}

// 校验主持人收束出的单个方向。
function parseIdeaDiscussionDirection(value: unknown): IdeaDiscussionDirection | undefined {
  if (!isRecord(value) || !isString(value.title) || !isString(value.description) || !isString(value.nextStep)) return undefined;
  return { title: value.title, description: value.description, nextStep: value.nextStep };
}

// 校验完整的三方向收束结果。
function parseIdeaDiscussionSynthesis(value: unknown): IdeaDiscussionSynthesis | undefined {
  if (!isRecord(value)) return undefined;
  const conservativeDirection = parseIdeaDiscussionDirection(value.conservativeDirection);
  const radicalDirection = parseIdeaDiscussionDirection(value.radicalDirection);
  const unexpectedDirection = parseIdeaDiscussionDirection(value.unexpectedDirection);
  if (!conservativeDirection || !radicalDirection || !unexpectedDirection) return undefined;
  return { conservativeDirection, radicalDirection, unexpectedDirection };
}

// 校验一场讨论；完成态必须包含收束结果，中止态允许保留部分轮次。
function parseIdeaDiscussion(value: unknown, expectedIdeaId: string): IdeaDiscussion | undefined {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    value.ideaId !== expectedIdeaId ||
    !isString(value.createdAt) ||
    !IDEA_DISCUSSION_STATUSES.includes(value.status as (typeof IDEA_DISCUSSION_STATUSES)[number]) ||
    !Array.isArray(value.participants) ||
    !Array.isArray(value.rounds) ||
    !Array.isArray(value.collectedSparkIds)
  ) {
    return undefined;
  }
  const participants = value.participants.filter(
    (role): role is IdeaDiscussion["participants"][number] =>
      IDEA_DISCUSSION_ROLES.includes(role as (typeof IDEA_DISCUSSION_ROLES)[number]),
  );
  if (participants.length < 3 || participants.length > 4 || new Set(participants).size !== participants.length) {
    return undefined;
  }
  const hasMalformedKnownRound = value.rounds.some((rawRound) => {
    if (!isRecord(rawRound) || !IDEA_DISCUSSION_ROUND_TYPES.includes(rawRound.type as (typeof IDEA_DISCUSSION_ROUND_TYPES)[number])) return false;
    return !parseIdeaDiscussionRound(rawRound);
  });
  if (hasMalformedKnownRound) return undefined;
  const rounds = value.rounds.map(parseIdeaDiscussionRound).filter((item): item is IdeaDiscussionRound => Boolean(item));
  const synthesis = parseIdeaDiscussionSynthesis(value.synthesis);
  if (value.status === "completed") {
    const roundTypes = new Set(rounds.map((round) => round.type));
    const isOrdered = rounds.every((round, index) => round.type === IDEA_DISCUSSION_ROUND_TYPES[index]);
    if (!synthesis || rounds.length !== IDEA_DISCUSSION_ROUND_TYPES.length || roundTypes.size !== IDEA_DISCUSSION_ROUND_TYPES.length || !isOrdered) return undefined;
  }
  const sparkIds = new Set(
    rounds.flatMap((round) => round.contributions.flatMap((contribution) => (contribution.spark ? [contribution.spark.id] : []))),
  );
  const sparkIdList = rounds.flatMap((round) => round.contributions.flatMap((contribution) => (contribution.spark ? [contribution.spark.id] : [])));
  if (sparkIdList.length !== sparkIds.size) return undefined;
  const interventions = parseIdeaDiscussionInterventions(value.interventions);
  return {
    id: value.id,
    ideaId: expectedIdeaId,
    createdAt: value.createdAt,
    status: value.status as IdeaDiscussion["status"],
    participants,
    ...(IDEA_DISCUSSION_LINEUPS.includes(value.lineup as NonNullable<IdeaDiscussion["lineup"]>) ? { lineup: value.lineup as NonNullable<IdeaDiscussion["lineup"]> } : {}),
    ...(IDEA_DISCUSSION_MECHANISMS.includes(value.mechanism as NonNullable<IdeaDiscussion["mechanism"]>) ? { mechanism: value.mechanism as NonNullable<IdeaDiscussion["mechanism"]> } : {}),
    rounds,
    ...(synthesis ? { synthesis } : {}),
    collectedSparkIds: Array.from(new Set(value.collectedSparkIds.filter((id): id is string => isString(id) && sparkIds.has(id)))),
    interventions,
  };
}

// 按原顺序逐场恢复讨论，坏讨论不会影响同一脑洞的其他历史记录。
function parseIdeaDiscussions(value: unknown, expectedIdeaId: string): IdeaDiscussion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((discussion) => {
    const parsed = parseIdeaDiscussion(discussion, expectedIdeaId);
    return parsed ? [parsed] : [];
  });
}

// 校验执行计划任务，只接受合法的阶段、稳定 id 和完成状态。
function parseIdeaExecutionTask(value: unknown): IdeaExecutionTask | undefined {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    !REFINEMENT_MVP_HORIZONS.includes(value.horizon as (typeof REFINEMENT_MVP_HORIZONS)[number]) ||
    typeof value.goal !== "string" ||
    typeof value.build !== "string" ||
    typeof value.proof !== "string" ||
    typeof value.completed !== "boolean" ||
    (value.completedAt !== undefined && !isString(value.completedAt))
  ) {
    return undefined;
  }
  return {
    id: value.id,
    horizon: value.horizon as IdeaExecutionTask["horizon"],
    goal: value.goal,
    build: value.build,
    proof: value.proof,
    completed: value.completed,
    ...(isString(value.completedAt) ? { completedAt: value.completedAt } : {}),
  };
}

// 校验执行计划并确认它确实属于当前工作区中的脑洞。
function parseIdeaExecutionPlan(value: unknown, expectedIdeaId: string): IdeaExecutionPlan | undefined {
  if (!isRecord(value) || !isString(value.ideaId) || value.ideaId !== expectedIdeaId || !isString(value.createdAt) || !isString(value.updatedAt) || !Array.isArray(value.tasks)) {
    return undefined;
  }
  if (value.tasks.length !== REFINEMENT_MVP_HORIZONS.length) {
    return undefined;
  }

  const taskIds = new Set<string>();
  const horizons = new Set<string>();
  const tasks: IdeaExecutionTask[] = [];
  for (const rawTask of value.tasks) {
    const task = parseIdeaExecutionTask(rawTask);
    if (!task || taskIds.has(task.id) || horizons.has(task.horizon) || task.id !== `execution-task:${expectedIdeaId}:${task.horizon}`) {
      return undefined;
    }
    taskIds.add(task.id);
    horizons.add(task.horizon);
    tasks.push(task);
  }
  if (!REFINEMENT_MVP_HORIZONS.every((horizon) => horizons.has(horizon))) {
    return undefined;
  }
  return {
    ideaId: value.ideaId,
    tasks,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

// 校验孵化箱条目；局部损坏的炼化和动作不会拖累有效脑洞。
function parseIncubatorEntry(value: unknown): IncubatorEntry | undefined {
  if (!isRecord(value) || typeof value.savedAt !== "string") return undefined;
  const idea = parseIdeaCard(value.idea);
  if (!idea) return undefined;
  const refinement = parseRefinement(value.refinement, idea.id);
  const executionPlan = parseIdeaExecutionPlan(value.executionPlan, idea.id);
  const challenges = parseIdeaChallenges(value.challenges, idea.id);
  const discussions = parseIdeaDiscussions(value.discussions, idea.id);
  const validAction = REFINEMENT_ACTION_TYPES.includes(value.action as (typeof REFINEMENT_ACTION_TYPES)[number]);
  return {
    idea,
    savedAt: value.savedAt,
    ...(refinement ? { refinement } : {}),
    ...(validAction ? { action: value.action as IncubatorEntry["action"] } : {}),
    ...(executionPlan ? { executionPlan } : {}),
    ...(challenges.length > 0 ? { challenges } : {}),
    ...(discussions.length > 0 ? { discussions } : {}),
  };
}

// 校验工作区并在每个集合边界逐项隔离损坏内容。
function parseWorkspace(value: unknown): WorkspaceSnapshot | undefined {
  if (!isRecord(value) || typeof value.topic !== "string" || !["轻微", "正常", "狂野"].includes(String(value.intensity))) return undefined;
  const groups = (Array.isArray(value.groups) ? value.groups : []).flatMap((group) => {
    if (!isRecord(group) || !DIMENSION_GROUPS.includes(group.type as (typeof DIMENSION_GROUPS)[number]) || typeof group.label !== "string" || typeof group.description !== "string" || !Array.isArray(group.words)) return [];
    return [{ ...group, words: group.words.map(parseDimensionWord).filter((item): item is NonNullable<typeof item> => Boolean(item)) }];
  }) as WorkspaceSnapshot["groups"];
  const ideas = (Array.isArray(value.ideas) ? value.ideas : []).map(parseIdeaCard).filter((item): item is IdeaCard => Boolean(item));
  const ideaIds = new Set(ideas.map((idea) => idea.id));

  let mindMap: WorkspaceSnapshot["mindMap"];
  if (isRecord(value.mindMap)) {
    const center = parseMindNode(value.mindMap.center);
    if (
      isString(value.mindMap.id) &&
      typeof value.mindMap.topic === "string" &&
      ["没方向", "有技术没需求", "有兴趣没形态", "有产品没差异化"].includes(String(value.mindMap.stuckType)) &&
      center &&
      Array.isArray(value.mindMap.nodes) &&
      Array.isArray(value.mindMap.edges) &&
      typeof value.mindMap.createdAt === "string"
    ) {
      const parsedNodes = value.mindMap.nodes.map(parseMindNode).filter((item): item is MindNode => Boolean(item));
      const parsedGroups = parseMindNodeGroups(value.mindMap.groups, parsedNodes, center.id);
      const validNodeIds = new Set(parsedGroups.nodes.filter((node) => node.selectable).map((node) => node.id));
      const recommendedNodeIds = Array.from(new Set(
        (Array.isArray(value.mindMap.recommendedNodeIds) ? value.mindMap.recommendedNodeIds : [])
          .filter((id): id is string => typeof id === "string" && validNodeIds.has(id)),
      ));
      const { groupId: _centerGroupId, ...normalizedCenter } = center;
      mindMap = {
        id: value.mindMap.id,
        topic: value.mindMap.topic,
        stuckType: value.mindMap.stuckType as BrainstormMap["stuckType"],
        center: normalizedCenter,
        nodes: parsedGroups.nodes,
        edges: value.mindMap.edges.map(parseMindEdge).filter((item): item is MindEdge => Boolean(item)),
        recommendedNodeIds,
        groups: parsedGroups.groups,
        createdAt: value.mindMap.createdAt,
      };
    }
  }

  const refinementsByIdeaId = Object.fromEntries(
    Object.entries(isRecord(value.refinementsByIdeaId) ? value.refinementsByIdeaId : {}).flatMap(([ideaId, refinement]) => {
      const parsed = parseRefinement(refinement, ideaId);
      return parsed ? [[ideaId, parsed] as const] : [];
    }),
  );
  const refinementActionsByIdeaId = Object.fromEntries(
    Object.entries(isRecord(value.refinementActionsByIdeaId) ? value.refinementActionsByIdeaId : {}).filter((entry): entry is [string, WorkspaceSnapshot["refinementActionsByIdeaId"][string]] =>
      REFINEMENT_ACTION_TYPES.includes(entry[1] as (typeof REFINEMENT_ACTION_TYPES)[number]),
    ),
  );
  const executionPlansByIdeaId = Object.fromEntries(
    Object.entries(isRecord(value.executionPlansByIdeaId) ? value.executionPlansByIdeaId : {}).flatMap(([ideaId, plan]) => {
      if (!ideaIds.has(ideaId)) return [];
      const parsed = parseIdeaExecutionPlan(plan, ideaId);
      return parsed ? [[ideaId, parsed] as const] : [];
    }),
  );
  const challengesByIdeaId = Object.fromEntries(
    Object.entries(isRecord(value.challengesByIdeaId) ? value.challengesByIdeaId : {}).flatMap(([ideaId, challenges]) => {
      if (!ideaIds.has(ideaId)) return [];
      const parsed = parseIdeaChallenges(challenges, ideaId);
      return parsed.length > 0 ? [[ideaId, parsed] as const] : [];
    }),
  );
  const discussionsByIdeaId = Object.fromEntries(
    Object.entries(isRecord(value.discussionsByIdeaId) ? value.discussionsByIdeaId : {}).flatMap(([ideaId, discussions]) => {
      if (!ideaIds.has(ideaId)) return [];
      const parsed = parseIdeaDiscussions(discussions, ideaId);
      return parsed.length > 0 ? [[ideaId, parsed] as const] : [];
    }),
  );
  const lastMixedSeed = parseMixedIdeaSeed(value.lastMixedSeed);
  const mindMapViewport = isRecord(value.mindMapViewport) &&
    isFiniteNumber(value.mindMapViewport.panX) &&
    isFiniteNumber(value.mindMapViewport.panY) &&
    isFiniteNumber(value.mindMapViewport.scale) &&
    value.mindMapViewport.scale > 0
    ? {
        panX: value.mindMapViewport.panX,
        panY: value.mindMapViewport.panY,
        scale: value.mindMapViewport.scale,
      }
    : undefined;
  return {
    topic: value.topic,
    intensity: value.intensity as WorkspaceSnapshot["intensity"],
    groups,
    ...(mindMap ? { mindMap } : {}),
    ideas,
    refinementsByIdeaId,
    refinementActionsByIdeaId,
    executionPlansByIdeaId,
    challengesByIdeaId,
    discussionsByIdeaId,
    ...(isString(value.activeIdeaId) ? { activeIdeaId: value.activeIdeaId } : {}),
    ...(isString(value.activeMindNodeId) ? { activeMindNodeId: value.activeMindNodeId } : {}),
    ...(mindMapViewport ? { mindMapViewport } : {}),
    ...(lastMixedSeed ? { lastMixedSeed } : {}),
  };
}

// 从 v2 内容中保留有效工作区和逐条有效的孵化内容。
function parseV2(value: unknown): StoredIdeaState | undefined {
  if (!isRecord(value) || value.version !== 2 || !Array.isArray(value.incubatorEntries)) {
    return undefined;
  }
  const workspace = parseWorkspace(value.workspace);
  return {
    version: 2,
    ...(workspace ? { workspace } : {}),
    incubatorEntries: value.incubatorEntries.map(parseIncubatorEntry).filter((entry): entry is IncubatorEntry => Boolean(entry)),
  };
}

// 从 v1 内容中逐条迁移有效收藏。
function migrateV1(value: unknown): StoredIdeaState | undefined {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.favorites)) {
    return undefined;
  }
  return {
    version: 2,
    incubatorEntries: value.favorites.map(parseIncubatorEntry).filter((entry): entry is IncubatorEntry => Boolean(entry)),
  };
}

// 安全解析一个存储键，格式错误时忽略该键。
function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : undefined;
  } catch {
    return undefined;
  }
}

// 读取本地状态；优先使用 v2，没有时迁移 v1。
export function loadStoredState(): StoredIdeaState {
  try {
    const v2 = parseV2(readJson(STORAGE_V2_KEY));
    if (v2) {
      return v2;
    }
    return migrateV1(readJson(STORAGE_V1_KEY)) ?? EMPTY_STATE;
  } catch {
    return EMPTY_STATE;
  }
}

// 保存完整 v2 快照，并把浏览器写入异常转换成明确结果。
export function saveStoredState(state: StoredIdeaState): StorageWriteResult {
  try {
    localStorage.setItem(STORAGE_V2_KEY, JSON.stringify(state));
    return { ok: true };
  } catch {
    return { ok: false, message: "本地保存失败，当前内容尚未写入浏览器。" };
  }
}

// 保留原收藏 API，内部写入 v2 孵化箱，减少现有调用方变更。
export function saveFavorites(favorites: FavoriteIdea[]): StorageWriteResult {
  const current = loadStoredState();
  return saveStoredState({
    ...current,
    incubatorEntries: favorites.map((favorite) => {
      const existing = current.incubatorEntries.find((entry) => entry.idea.id === favorite.idea.id);
      return existing ? { ...existing, ...favorite } : favorite;
    }),
  });
}
