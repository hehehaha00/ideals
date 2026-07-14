// 这个文件管理脑洞实验室 MVP 的主题、词组、脑洞、变形和收藏状态。
import { create } from "zustand";
import { createId } from "../lib/id";
import { mindMapNodesToWords } from "../lib/ideaEngine";
import {
  expandMindNode as requestExpandMindNode,
  generateIdeas as requestIdeas,
  generateMindMap as requestMindMap,
  generateWords as requestWords,
  mixIdeas as requestMix,
  recommendCollision as requestCollisionRecommendation,
  branchFromDiscussion,
  requestChallenge as requestIdeaChallenge,
  requestDiscussion,
  respondToDiscussion,
  refineIdea as requestRefine,
  rerollMindMap as requestRerollMindMap,
  transformIdea as requestTransform,
} from "../services/ideaApi";
import {
  DIMENSION_GROUPS,
  DIMENSION_GROUP_DESCRIPTIONS,
  IDEA_CHALLENGE_ROLES,
  type BrainstormMap,
  type CollisionRecipeId,
  type DimensionGroup,
  type DimensionWord,
  type FavoriteIdea,
  type IncubatorFilter,
  type IdeaCard,
  type IdeaChallenge,
  type IdeaChallengeRole,
  type IdeaDiscussion,
  type IdeaDiscussionDirectionKey,
  type IdeaDiscussionInterventionType,
  type IdeaDiscussionRole,
  type IdeaDiscussionSetup,
  type IdeaExecutionPlan,
  type IdeaOriginSnapshot,
  type IdeaRefinement,
  type IncubatorEntry,
  type Intensity,
  type MixedIdeaSeed,
  type MindMapNavigationIntent,
  type MindMapViewportSnapshot,
  type MindNode,
  type MindNodeCategory,
  type MindNodeGroup,
  REFINEMENT_MVP_HORIZONS,
  type RefinementActionType,
  type StoredIdeaState,
  type TransformDirection,
  type WorkspaceSnapshot,
} from "../types/idea";
import { loadStoredState, saveStoredState } from "./storage";

interface IdeaStoreState {
  topic: string;
  intensity: Intensity;
  groups: DimensionGroup[];
  mindMap?: BrainstormMap;
  ideas: IdeaCard[];
  refinementsByIdeaId: Record<string, IdeaRefinement>;
  refinementActionsByIdeaId: Record<string, RefinementActionType>;
  executionPlansByIdeaId: Record<string, IdeaExecutionPlan>;
  challengesByIdeaId: Record<string, IdeaChallenge[]>;
  discussionsByIdeaId: Record<string, IdeaDiscussion[]>;
  favorites: FavoriteIdea[];
  incubatorOpen: boolean;
  incubatorFilter: IncubatorFilter;
  incubatorSelectedIdeaIds: string[];
  incubatorDetailIdeaId?: string;
  lastMixedSeed?: MixedIdeaSeed;
  activeIdeaId?: string;
  activeMindNodeId?: string;
  mindMapViewport?: MindMapViewportSnapshot;
  mindMapNavigationIntent?: MindMapNavigationIntent;
  mindMapCanUndo: boolean;
  mindMapCanRedo: boolean;
  loading: "idle" | "map" | "reroll" | "expand" | "words" | "collision" | "ideas" | "transform" | "refine" | "challenge" | "discussion" | "discussionResponse" | "discussionBranch" | "mix";
  streamText: string;
  error?: string;
  setTopic: (topic: string) => void;
  setIntensity: (intensity: Intensity) => void;
  hydrate: () => void;
  reset: () => void;
  generateMindMap: () => Promise<void>;
  generateWords: () => Promise<void>;
  toggleMindNode: (nodeId: string) => void;
  toggleMindNodeLock: (nodeId: string) => void;
  moveMindNode: (nodeId: string, x: number, y: number) => void;
  setMindMapViewport: (viewport?: MindMapViewportSnapshot) => void;
  beginMindMapEdit: () => void;
  endMindMapEdit: () => void;
  addMindNode: (label: string, category: Exclude<MindNodeCategory, "中心">, position?: { x: number; y: number; parentId?: string }) => void;
  renameMindNode: (nodeId: string, label: string) => void;
  updateMindNodeNote: (nodeId: string, note: string) => void;
  reparentMindNode: (nodeId: string, parentId: string) => void;
  deleteMindNodeSubtree: (nodeId: string) => void;
  createMindNodeGroup: (name: string, nodeIds: string[]) => void;
  ungroupMindNodes: (nodeIds: string[]) => void;
  toggleMindNodeCollapsed: (nodeId: string) => void;
  revealMindNode: (nodeId: string) => void;
  setMindNodesSelected: (nodeIds: string[], append?: boolean) => void;
  setMindNodesLocked: (nodeIds: string[], locked: boolean) => void;
  undoMindMap: () => void;
  redoMindMap: () => void;
  persistWorkspace: () => void;
  rerollMindMapUnlockedNodes: () => Promise<void>;
  expandActiveMindNode: () => Promise<void>;
  generateIdeasFromMindMap: (viewport?: IdeaOriginSnapshot["viewport"], collisionRecipe?: CollisionRecipeId) => Promise<void>;
  restoreIdeaOrigin: (ideaId: string, focusNodeId?: string) => boolean;
  consumeMindMapNavigationIntent: () => void;
  toggleWordLock: (wordId: string) => void;
  selectWord: (wordId: string) => void;
  rerollUnlockedWords: () => Promise<void>;
  recommendCollision: () => Promise<void>;
  generateIdeas: () => Promise<void>;
  setActiveIdea: (ideaId: string) => void;
  transformActiveIdea: (direction: TransformDirection) => Promise<void>;
  refineActiveIdea: () => Promise<void>;
  challengeIdea: (ideaId: string, role: IdeaChallengeRole) => Promise<void>;
  discussIdea: (ideaId: string, setup?: IdeaDiscussionSetup) => Promise<void>;
  respondToIdeaDiscussion: (ideaId: string, discussionId: string, input: {
    type: IdeaDiscussionInterventionType;
    prompt: string;
    targetRole: IdeaDiscussionRole;
    sourceRole?: IdeaDiscussionRole;
    sourceClaim?: string;
  }) => Promise<void>;
  continueDiscussionDirection: (ideaId: string, discussionId: string, directionKey: IdeaDiscussionDirectionKey, opposite?: boolean) => Promise<boolean>;
  stopDiscussion: () => void;
  collectDiscussionSpark: (ideaId: string, discussionId: string, sparkId: string) => void;
  chooseRefinementAction: (ideaId: string, action: RefinementActionType) => void;
  createIdeaExecutionPlan: (ideaId: string) => void;
  toggleIdeaExecutionTask: (ideaId: string, taskId: string) => void;
  openIncubator: () => void;
  closeIncubator: () => void;
  setIncubatorFilter: (filter: IncubatorFilter) => void;
  setIncubatorDetail: (ideaId?: string) => void;
  toggleIncubatorSelection: (ideaId: string) => void;
  mixSelectedIncubatorIdeas: () => Promise<void>;
  toggleFavorite: (ideaId: string) => void;
}

const INITIAL_STATE = {
  topic: "",
  intensity: "正常" as Intensity,
  groups: [],
  mindMap: undefined,
  ideas: [],
  refinementsByIdeaId: {},
  refinementActionsByIdeaId: {},
  executionPlansByIdeaId: {},
  challengesByIdeaId: {},
  discussionsByIdeaId: {},
  favorites: [],
  incubatorOpen: false,
  incubatorFilter: "全部" as IncubatorFilter,
  incubatorSelectedIdeaIds: [],
  incubatorDetailIdeaId: undefined,
  lastMixedSeed: undefined,
  activeIdeaId: undefined,
  activeMindNodeId: undefined,
  mindMapViewport: undefined,
  mindMapNavigationIntent: undefined,
  mindMapCanUndo: false,
  mindMapCanRedo: false,
  loading: "idle" as const,
  streamText: "",
  error: undefined,
};

// 取出每个维度当前选中的一个词。
function selectedWords(groups: DimensionGroup[]): DimensionWord[] {
  return groups.flatMap((group) => group.words.filter((word) => word.selected).slice(0, 1));
}

// 找到某个词所属的维度。
function findWordGroupType(groups: DimensionGroup[], wordId: string): DimensionWord["groupType"] | undefined {
  return groups.flatMap((group) => group.words).find((word) => word.id === wordId)?.groupType;
}

// 把导图节点词组织成现有六类词组。
function groupsFromMindWords(words: DimensionWord[]): DimensionGroup[] {
  return DIMENSION_GROUPS.map((type) => {
    const word = words.find((item) => item.groupType === type);
    return {
      type,
      label: type,
      description: DIMENSION_GROUP_DESCRIPTIONS[type],
      words: word ? [word] : [],
    };
  });
}

// 把旧组里锁定的词合并进新生成的组里。
function mergeLockedWords(currentGroups: DimensionGroup[], freshGroups: DimensionGroup[]): DimensionGroup[] {
  return freshGroups.map((freshGroup) => {
    const currentGroup = currentGroups.find((group) => group.type === freshGroup.type);
    const lockedWords = currentGroup?.words.filter((word) => word.locked) ?? [];
    const freshUnlockedWords = freshGroup.words.filter((word) => !lockedWords.some((lockedWord) => lockedWord.text === word.text));

    return {
      ...freshGroup,
      words: [...lockedWords, ...freshUnlockedWords].slice(0, 8),
    };
  });
}

function aiErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "未知错误";
  return `LLM 有问题：${message}`;
}

interface ActiveAiRequest {
  id: number;
  controller: AbortController;
  topicRevision: number;
  mapRevision: number;
  ideaRevision: number;
  scopes: RevisionScope[];
}

type RevisionScope = "topic" | "map" | "idea";

let activeAiRequest: ActiveAiRequest | undefined;
let aiRequestCounter = 0;
let topicRevision = 0;
let mapRevision = 0;
let ideaRevision = 0;
interface MindMapHistorySnapshot {
  map: BrainstormMap;
  activeMindNodeId?: string;
}

const mindMapUndoStack: MindMapHistorySnapshot[] = [];
const mindMapRedoStack: MindMapHistorySnapshot[] = [];
let mindMapEditStarted = false;

// 复制纯数据导图，避免历史快照被后续编辑共享引用。
function cloneMindMap(map: BrainstormMap): BrainstormMap {
  return structuredClone(map);
}

// 在本地编辑前保存历史，并使旧的重做分支失效。
function recordMindMapHistory(map: BrainstormMap, activeMindNodeId?: string): void {
  mindMapUndoStack.push({ map: cloneMindMap(map), activeMindNodeId });
  if (mindMapUndoStack.length > 50) mindMapUndoStack.shift();
  mindMapRedoStack.length = 0;
}

// AI 或持久化边界切换后清空旧导图历史，避免撤销穿越到另一张图。
function clearMindMapHistory(): void {
  mindMapUndoStack.length = 0;
  mindMapRedoStack.length = 0;
  mindMapEditStarted = false;
}

// 收集一个节点及其全部后代，供防成环和整支删除复用。
function collectMindNodeSubtree(nodes: MindNode[], rootNodeId: string): Set<string> {
  const subtree = new Set<string>([rootNodeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (node.parentId && subtree.has(node.parentId) && !subtree.has(node.id)) {
        subtree.add(node.id);
        changed = true;
      }
    }
  }
  return subtree;
}

// 更新可选备注；空内容会移除字段，避免持久化无意义空串。
function withMindNodeNote(node: MindNode, note: string): MindNode {
  const { note: _previousNote, ...rest } = node;
  return note ? { ...rest, note } : rest;
}

// 更新节点分组引用；分组被解散时同步移除孤立字段。
function withMindNodeGroup(node: MindNode, groupId?: string): MindNode {
  const { groupId: _previousGroupId, ...rest } = node;
  return groupId ? { ...rest, groupId } : rest;
}

// 从兼容旧数据的导图中取得稳定分组数组。
function mindNodeGroups(map: BrainstormMap): MindNodeGroup[] {
  return map.groups ?? [];
}

function beginAiRequest(scopes: RevisionScope[]): ActiveAiRequest {
  activeAiRequest?.controller.abort();
  aiRequestCounter += 1;
  const request = {
    id: aiRequestCounter,
    controller: new AbortController(),
    topicRevision,
    mapRevision,
    ideaRevision,
    scopes,
  };
  activeAiRequest = request;
  return request;
}

function isCurrentAiRequest(request: ActiveAiRequest): boolean {
  return (
    activeAiRequest?.id === request.id &&
    !request.controller.signal.aborted &&
    (!request.scopes.includes("topic") || request.topicRevision === topicRevision) &&
    (!request.scopes.includes("map") || request.mapRevision === mapRevision) &&
    (!request.scopes.includes("idea") || request.ideaRevision === ideaRevision)
  );
}

function finishAiRequest(request: ActiveAiRequest): void {
  if (activeAiRequest?.id === request.id) {
    activeAiRequest = undefined;
  }
}

function abortActiveAiRequest(): void {
  activeAiRequest?.controller.abort();
  activeAiRequest = undefined;
}

// 用户编辑会使对应 AI 快照失效，并立即结束旧请求的加载状态。
function invalidateRevision(scope: RevisionScope): boolean {
  if (scope === "topic") topicRevision += 1;
  if (scope === "map") mapRevision += 1;
  if (scope === "idea") ideaRevision += 1;
  const cancelledRequest = Boolean(activeAiRequest);
  abortActiveAiRequest();
  return cancelledRequest;
}

// 从当前状态提取刷新后需要恢复的稳定工作区字段。
function workspaceFromState(state: IdeaStoreState): WorkspaceSnapshot {
  return {
    topic: state.topic,
    intensity: state.intensity,
    groups: state.groups,
    mindMap: state.mindMap,
    ideas: state.ideas,
    refinementsByIdeaId: state.refinementsByIdeaId,
    refinementActionsByIdeaId: state.refinementActionsByIdeaId,
    executionPlansByIdeaId: state.executionPlansByIdeaId,
    challengesByIdeaId: state.challengesByIdeaId,
    discussionsByIdeaId: state.discussionsByIdeaId,
    activeIdeaId: state.activeIdeaId,
    activeMindNodeId: state.activeMindNodeId,
    mindMapViewport: state.mindMapViewport,
    lastMixedSeed: state.lastMixedSeed,
  };
}

// 合并当前收藏与已保存孵化详情，避免切换工作区时丢掉炼化成果。
function incubatorEntriesFromState(state: IdeaStoreState, storedEntries: IncubatorEntry[]): IncubatorEntry[] {
  return state.favorites.map((favorite) => {
    const stored = storedEntries.find((entry) => entry.idea.id === favorite.idea.id);
    const refinement = state.refinementsByIdeaId[favorite.idea.id] ?? stored?.refinement;
    const action = state.refinementActionsByIdeaId[favorite.idea.id] ?? stored?.action;
    const executionPlan = state.executionPlansByIdeaId[favorite.idea.id] ?? stored?.executionPlan;
    const challenges = state.challengesByIdeaId[favorite.idea.id] ?? stored?.challenges;
    const discussions = state.discussionsByIdeaId[favorite.idea.id] ?? stored?.discussions;
    return {
      ...favorite,
      ...(refinement ? { refinement } : {}),
      ...(action ? { action } : {}),
      ...(executionPlan ? { executionPlan } : {}),
      ...(challenges && challenges.length > 0 ? { challenges } : {}),
      ...(discussions && discussions.length > 0 ? { discussions } : {}),
    };
  });
}

// 合并挑战并让后传入的同角色结果覆盖旧结果，最后保持固定角色顺序。
function mergeIdeaChallenges(...groups: IdeaChallenge[][]): IdeaChallenge[] {
  const challengeByRole = new Map<IdeaChallengeRole, IdeaChallenge>();
  groups.flat().forEach((challenge) => challengeByRole.set(challenge.role, challenge));
  return IDEA_CHALLENGE_ROLES.flatMap((role) => {
    const challenge = challengeByRole.get(role);
    return challenge ? [challenge] : [];
  });
}

// 合并多处讨论历史；同 id 的后传记录覆盖旧记录，但保留原来的历史位置。
function mergeIdeaDiscussions(...groups: IdeaDiscussion[][]): IdeaDiscussion[] {
  const discussions: IdeaDiscussion[] = [];
  const indexById = new Map<string, number>();
  for (const discussion of groups.flat()) {
    const existingIndex = indexById.get(discussion.id);
    if (existingIndex === undefined) {
      indexById.set(discussion.id, discussions.length);
      discussions.push(discussion);
    } else {
      discussions[existingIndex] = discussion;
    }
  }
  return discussions;
}

// 把炼化阶梯转换为可执行的三步计划，任务 id 由脑洞和阶段决定以保证稳定。
function createExecutionPlan(ideaId: string, refinement: IdeaRefinement): IdeaExecutionPlan {
  const now = new Date().toISOString();
  const tasks = REFINEMENT_MVP_HORIZONS.map((horizon) => {
    const step = refinement.mvpLadder.find((item) => item.horizon === horizon);
    return {
      id: `execution-task:${ideaId}:${horizon}`,
      horizon,
      goal: step?.goal ?? "补充这一阶段的验证目标",
      build: step?.build ?? "补充这一阶段的最小构建",
      proof: step?.proof ?? "补充这一阶段的验证标准",
      completed: false,
    };
  });
  return { ideaId, tasks, createdAt: now, updatedAt: now };
}

// 判断执行计划是否包含三个阶段的完整稳定任务，避免残缺数据阻挡重新创建。
function isCompleteExecutionPlan(ideaId: string, plan: IdeaExecutionPlan | undefined): plan is IdeaExecutionPlan {
  if (
    !plan ||
    plan.ideaId !== ideaId ||
    typeof plan.createdAt !== "string" ||
    typeof plan.updatedAt !== "string" ||
    plan.tasks.length !== REFINEMENT_MVP_HORIZONS.length
  ) {
    return false;
  }
  const horizons = new Set(plan.tasks.map((task) => task.horizon));
  const taskIds = new Set(plan.tasks.map((task) => task.id));
  return (
    horizons.size === REFINEMENT_MVP_HORIZONS.length &&
    taskIds.size === REFINEMENT_MVP_HORIZONS.length &&
    REFINEMENT_MVP_HORIZONS.every((horizon) => horizons.has(horizon)) &&
    plan.tasks.every(
      (task) =>
        task.id === `execution-task:${ideaId}:${task.horizon}` &&
        typeof task.goal === "string" &&
        typeof task.build === "string" &&
        typeof task.proof === "string" &&
        typeof task.completed === "boolean" &&
        (task.completedAt === undefined || typeof task.completedAt === "string"),
    )
  );
}

export const useIdeaStore = create<IdeaStoreState>((set, get) => ({
  ...INITIAL_STATE,
  setTopic: (topic) => {
    if (get().topic !== topic) {
      invalidateRevision("topic");
    }
    set({ topic, loading: "idle", streamText: "", error: undefined });
    get().persistWorkspace();
  },
  setIntensity: (intensity) => {
    let cancelledRequest = false;
    if (get().intensity !== intensity) {
      cancelledRequest = invalidateRevision("topic");
    }
    set({ intensity, ...(cancelledRequest ? { loading: "idle", streamText: "" } : {}) });
    get().persistWorkspace();
  },
  hydrate: () => {
    const stored = loadStoredState();
    const incubatorRefinements = Object.fromEntries(
      stored.incubatorEntries.flatMap((entry) => (entry.refinement ? [[entry.idea.id, entry.refinement] as const] : [])),
    );
    const incubatorActions = Object.fromEntries(
      stored.incubatorEntries.flatMap((entry) => (entry.action ? [[entry.idea.id, entry.action] as const] : [])),
    );
    const incubatorExecutionPlans = Object.fromEntries(
      stored.incubatorEntries.flatMap((entry) => (entry.executionPlan ? [[entry.idea.id, entry.executionPlan] as const] : [])),
    );
    const incubatorChallenges = Object.fromEntries(
      stored.incubatorEntries.flatMap((entry) => (entry.challenges?.length ? [[entry.idea.id, entry.challenges] as const] : [])),
    );
    const incubatorDiscussions = Object.fromEntries(
      stored.incubatorEntries.flatMap((entry) => (entry.discussions?.length ? [[entry.idea.id, entry.discussions] as const] : [])),
    );
    const workspaceChallenges = stored.workspace?.challengesByIdeaId ?? {};
    const challengesByIdeaId = Object.fromEntries(
      Array.from(new Set([...Object.keys(incubatorChallenges), ...Object.keys(workspaceChallenges)])).flatMap((ideaId) => {
        const challenges = mergeIdeaChallenges(incubatorChallenges[ideaId] ?? [], workspaceChallenges[ideaId] ?? []);
        return challenges.length > 0 ? [[ideaId, challenges] as const] : [];
      }),
    );
    const workspaceDiscussions = stored.workspace?.discussionsByIdeaId ?? {};
    const discussionsByIdeaId = Object.fromEntries(
      Array.from(new Set([...Object.keys(incubatorDiscussions), ...Object.keys(workspaceDiscussions)])).flatMap((ideaId) => {
        const discussions = mergeIdeaDiscussions(incubatorDiscussions[ideaId] ?? [], workspaceDiscussions[ideaId] ?? []);
        return discussions.length > 0 ? [[ideaId, discussions] as const] : [];
      }),
    );
    clearMindMapHistory();
    set({
      ...(stored.workspace ?? {}),
      favorites: stored.incubatorEntries.map(({ idea, savedAt }) => ({ idea, savedAt })),
      refinementsByIdeaId: { ...incubatorRefinements, ...(stored.workspace?.refinementsByIdeaId ?? {}) },
      refinementActionsByIdeaId: { ...incubatorActions, ...(stored.workspace?.refinementActionsByIdeaId ?? {}) },
      executionPlansByIdeaId: { ...incubatorExecutionPlans, ...(stored.workspace?.executionPlansByIdeaId ?? {}) },
      challengesByIdeaId,
      discussionsByIdeaId,
      mindMapNavigationIntent: undefined,
      mindMapCanUndo: false,
      mindMapCanRedo: false,
    });
  },
  reset: () => {
    abortActiveAiRequest();
    topicRevision += 1;
    mapRevision += 1;
    ideaRevision += 1;
    clearMindMapHistory();
    set({ ...INITIAL_STATE });
  },
  persistWorkspace: () => {
    const state = get();
    const stored = loadStoredState();
    const snapshot: StoredIdeaState = {
      version: 2,
      workspace: workspaceFromState(state),
      incubatorEntries: incubatorEntriesFromState(state, stored.incubatorEntries),
    };
    const result = saveStoredState(snapshot);
    if (!result.ok) {
      set({ error: result.message });
    }
  },
  generateMindMap: async () => {
    const { topic, intensity } = get();
    if (topic.trim().length < 2) {
      set({ error: "先给我一个稍微具体一点的方向。" });
      return;
    }

    const request = beginAiRequest(["topic"]);
    set({ loading: "map", streamText: "", error: undefined });
    try {
      const mindMap = await requestMindMap({
        topic,
        intensity,
        signal: request.controller.signal,
        onProgress: (text) => {
          if (isCurrentAiRequest(request)) {
            set((state) => ({ streamText: `${state.streamText}${text}`.slice(-300) }));
          }
        },
      });
      if (!isCurrentAiRequest(request)) {
        return;
      }
      clearMindMapHistory();
      set({
        mindMap,
        groups: [],
        ideas: [],
        refinementsByIdeaId: {},
        refinementActionsByIdeaId: {},
        executionPlansByIdeaId: {},
        challengesByIdeaId: {},
        discussionsByIdeaId: {},
        activeMindNodeId: mindMap.recommendedNodeIds[0],
        mindMapNavigationIntent: undefined,
        activeIdeaId: undefined,
        loading: "idle",
        streamText: "",
        mindMapCanUndo: false,
        mindMapCanRedo: false,
      });
      mapRevision += 1;
      get().persistWorkspace();
    } catch (error) {
      if (!isCurrentAiRequest(request)) {
        return;
      }
      set({ loading: "idle", streamText: "", error: aiErrorMessage(error) });
    } finally {
      finishAiRequest(request);
    }
  },
  generateWords: async () => {
    const { topic, intensity } = get();
    if (topic.trim().length < 2) {
      set({ error: "先给我一个稍微具体一点的方向。" });
      return;
    }

    const request = beginAiRequest(["topic"]);
    set({ loading: "words", streamText: "", error: undefined });
    try {
      const groups = await requestWords({
        topic,
        intensity,
        signal: request.controller.signal,
        onProgress: (text) => {
          if (isCurrentAiRequest(request)) {
            set((state) => ({ streamText: `${state.streamText}${text}`.slice(-300) }));
          }
        },
      });
      if (!isCurrentAiRequest(request)) {
        return;
      }
      clearMindMapHistory();
      set({
        groups,
        mindMap: undefined,
        ideas: [],
        refinementsByIdeaId: {},
        refinementActionsByIdeaId: {},
        executionPlansByIdeaId: {},
        challengesByIdeaId: {},
        discussionsByIdeaId: {},
        activeMindNodeId: undefined,
        mindMapNavigationIntent: undefined,
        activeIdeaId: undefined,
        loading: "idle",
        streamText: "",
        mindMapCanUndo: false,
        mindMapCanRedo: false,
      });
      ideaRevision += 1;
      get().persistWorkspace();
    } catch (error) {
      if (!isCurrentAiRequest(request)) {
        return;
      }
      set({ loading: "idle", streamText: "", error: aiErrorMessage(error) });
    } finally {
      finishAiRequest(request);
    }
  },
  toggleMindNode: (nodeId) => {
    const cancelledRequest = invalidateRevision("map");
    set((state) => {
      if (!state.mindMap) {
        return cancelledRequest ? { loading: "idle", streamText: "" } : state;
      }

      recordMindMapHistory(state.mindMap, state.activeMindNodeId);

      return {
        ...(cancelledRequest ? { loading: "idle" as const, streamText: "" } : {}),
        activeMindNodeId: nodeId,
        mindMap: {
          ...state.mindMap,
          nodes: state.mindMap.nodes.map((node) => (node.id === nodeId && node.selectable ? { ...node, selected: !node.selected } : node)),
        },
        mindMapCanUndo: true,
        mindMapCanRedo: false,
      };
    });
    get().persistWorkspace();
  },
  toggleMindNodeLock: (nodeId) => {
    const cancelledRequest = invalidateRevision("map");
    set((state) => {
      if (!state.mindMap) {
        return cancelledRequest ? { loading: "idle", streamText: "" } : state;
      }

      recordMindMapHistory(state.mindMap, state.activeMindNodeId);

      return {
        ...(cancelledRequest ? { loading: "idle" as const, streamText: "" } : {}),
        activeMindNodeId: nodeId,
        mindMap: {
          ...state.mindMap,
          nodes: state.mindMap.nodes.map((node) => (node.id === nodeId && node.selectable ? { ...node, locked: !node.locked, selected: true } : node)),
        },
        mindMapCanUndo: true,
        mindMapCanRedo: false,
      };
    });
    get().persistWorkspace();
  },
  moveMindNode: (nodeId, x, y) => {
    invalidateRevision("map");
    set((state) => {
      if (!state.mindMap) {
        return { loading: "idle", streamText: "" };
      }
      return {
        loading: "idle",
        streamText: "",
        mindMap: {
          ...state.mindMap,
          center: state.mindMap.center.id === nodeId ? { ...state.mindMap.center, x, y } : state.mindMap.center,
          nodes: state.mindMap.nodes.map((node) => (node.id === nodeId ? { ...node, x, y } : node)),
        },
      };
    });
  },
  setMindMapViewport: (mindMapViewport) => {
    if (!mindMapViewport) {
      set({ mindMapViewport: undefined });
      return;
    }
    if (!Number.isFinite(mindMapViewport.panX) || !Number.isFinite(mindMapViewport.panY) || !Number.isFinite(mindMapViewport.scale) || mindMapViewport.scale <= 0) {
      return;
    }
    set({ mindMapViewport });
  },
  beginMindMapEdit: () => {
    const map = get().mindMap;
    if (!map || mindMapEditStarted) return;
    recordMindMapHistory(map, get().activeMindNodeId);
    mindMapEditStarted = true;
    set({ mindMapCanUndo: true, mindMapCanRedo: false });
  },
  endMindMapEdit: () => {
    mindMapEditStarted = false;
  },
  addMindNode: (rawLabel, category, position) => {
    const label = rawLabel.trim();
    const state = get();
    if (!state.mindMap || !label) return;
    recordMindMapHistory(state.mindMap, state.activeMindNodeId);
    const parent = state.mindMap.nodes.find((node) => node.id === position?.parentId) ?? state.mindMap.nodes.find((node) => node.id === state.activeMindNodeId) ?? state.mindMap.center;
    const angle = (state.mindMap.nodes.length * 137.5 * Math.PI) / 180;
    const id = createId("manual_node");
    const node = {
      id,
      label,
      category,
      level: Math.min(3, parent.level + 1) as 1 | 2 | 3,
      x: position?.x ?? parent.x + Math.cos(angle) * 14,
      y: position?.y ?? parent.y + Math.sin(angle) * 14,
      selectable: true,
      locked: false,
      selected: true,
      reason: "用户手动加入的观察。",
      source: "手动节点",
      parentId: parent.id,
    };
    invalidateRevision("map");
    set({
      mindMap: { ...state.mindMap, nodes: [...state.mindMap.nodes.map((item) => ({ ...item, selected: false, ...(item.id === parent.id ? { collapsed: false } : {}) })), node], edges: [...state.mindMap.edges, { id: createId("manual_edge"), from: parent.id, to: id, label: "手动联想" }] },
      activeMindNodeId: id,
      mindMapCanUndo: true,
      mindMapCanRedo: false,
      loading: "idle",
      streamText: "",
    });
    get().persistWorkspace();
  },
  // 修改节点标题；中心标题同时更新当前主题。
  renameMindNode: (nodeId, rawLabel) => {
    const label = rawLabel.trim();
    const state = get();
    const map = state.mindMap;
    if (!map || !label) return;
    const target = map.nodes.find((node) => node.id === nodeId) ?? (map.center.id === nodeId ? map.center : undefined);
    if (!target || target.label === label) return;
    recordMindMapHistory(map, state.activeMindNodeId);
    invalidateRevision("map");
    const renamingCenter = map.center.id === nodeId;
    set({
      ...(renamingCenter ? { topic: label } : {}),
      mindMap: {
        ...map,
        ...(renamingCenter ? { topic: label, center: { ...map.center, label } } : {}),
        nodes: map.nodes.map((node) => node.id === nodeId ? { ...node, label } : node),
      },
      activeMindNodeId: nodeId,
      mindMapCanUndo: true,
      mindMapCanRedo: false,
      loading: "idle",
      streamText: "",
      error: undefined,
    });
    get().persistWorkspace();
  },
  // 保存节点备注，空备注会恢复为未填写状态。
  updateMindNodeNote: (nodeId, rawNote) => {
    const note = rawNote.trim();
    const state = get();
    const map = state.mindMap;
    if (!map) return;
    const target = map.nodes.find((node) => node.id === nodeId) ?? (map.center.id === nodeId ? map.center : undefined);
    if (!target || (target.note ?? "") === note) return;
    recordMindMapHistory(map, state.activeMindNodeId);
    invalidateRevision("map");
    set({
      mindMap: {
        ...map,
        center: map.center.id === nodeId ? withMindNodeNote(map.center, note) : map.center,
        nodes: map.nodes.map((node) => node.id === nodeId ? withMindNodeNote(node, note) : node),
      },
      activeMindNodeId: nodeId,
      mindMapCanUndo: true,
      mindMapCanRedo: false,
      loading: "idle",
      streamText: "",
      error: undefined,
    });
    get().persistWorkspace();
  },
  // 调整节点父级并同步整支层级，非法成环请求直接忽略。
  reparentMindNode: (nodeId, parentId) => {
    const state = get();
    const map = state.mindMap;
    if (!map || nodeId === map.center.id || nodeId === parentId) return;
    const target = map.nodes.find((node) => node.id === nodeId);
    const parent = map.nodes.find((node) => node.id === parentId) ?? (map.center.id === parentId ? map.center : undefined);
    if (!target || !parent || target.parentId === parentId) return;
    const subtree = collectMindNodeSubtree(map.nodes, nodeId);
    if (subtree.has(parentId)) return;
    const parentEdge = map.edges.find((edge) => edge.to === nodeId && edge.from === target.parentId);

    const childrenByParent = new Map<string, MindNode[]>();
    for (const node of map.nodes) {
      if (!node.parentId) continue;
      const children = childrenByParent.get(node.parentId) ?? [];
      children.push(node);
      childrenByParent.set(node.parentId, children);
    }
    const levels = new Map<string, MindNode["level"]>([[nodeId, Math.min(3, parent.level + 1) as MindNode["level"]]]);
    const queue = [nodeId];
    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId) continue;
      const currentLevel = levels.get(currentId) ?? 1;
      for (const child of childrenByParent.get(currentId) ?? []) {
        levels.set(child.id, Math.min(3, currentLevel + 1) as MindNode["level"]);
        queue.push(child.id);
      }
    }

    recordMindMapHistory(map, state.activeMindNodeId);
    invalidateRevision("map");
    set({
      mindMap: {
        ...map,
        nodes: map.nodes.map((node) => {
          if (node.id === nodeId) return { ...node, parentId, level: levels.get(node.id) ?? node.level };
          if (levels.has(node.id)) return { ...node, level: levels.get(node.id) ?? node.level };
          if (node.id === parentId && node.collapsed) return { ...node, collapsed: false };
          return node;
        }),
        edges: [
          ...map.edges.filter((edge) => edge.id !== parentEdge?.id),
          { id: createId("reparent_edge"), from: parentId, to: nodeId, label: "调整关联" },
        ],
      },
      activeMindNodeId: nodeId,
      mindMapCanUndo: true,
      mindMapCanRedo: false,
      loading: "idle",
      streamText: "",
      error: undefined,
    });
    get().persistWorkspace();
  },
  // 删除目标节点的完整子树，并清理所有关联索引。
  deleteMindNodeSubtree: (nodeId) => {
    const state = get();
    const map = state.mindMap;
    if (!map || nodeId === map.center.id) return;
    const target = map.nodes.find((node) => node.id === nodeId);
    if (!target) return;
    const subtree = collectMindNodeSubtree(map.nodes, nodeId);
    const nextGroups = mindNodeGroups(map)
      .map((group) => ({ ...group, nodeIds: group.nodeIds.filter((id) => !subtree.has(id)) }))
      .filter((group) => group.nodeIds.length >= 2);
    const survivingGroupIds = new Set(nextGroups.map((group) => group.id));
    const fallbackNodeId = target.parentId && !subtree.has(target.parentId) && map.nodes.some((node) => node.id === target.parentId)
      ? target.parentId
      : map.center.id;

    recordMindMapHistory(map, state.activeMindNodeId);
    invalidateRevision("map");
    set({
      mindMap: {
        ...map,
        nodes: map.nodes
          .filter((node) => !subtree.has(node.id))
          .map((node) => node.groupId && !survivingGroupIds.has(node.groupId) ? withMindNodeGroup(node) : node),
        edges: map.edges.filter((edge) => !subtree.has(edge.from) && !subtree.has(edge.to)),
        recommendedNodeIds: map.recommendedNodeIds.filter((id) => !subtree.has(id)),
        groups: nextGroups,
      },
      activeMindNodeId: state.activeMindNodeId && subtree.has(state.activeMindNodeId) ? fallbackNodeId : state.activeMindNodeId,
      mindMapCanUndo: true,
      mindMapCanRedo: false,
      loading: "idle",
      streamText: "",
      error: undefined,
    });
    get().persistWorkspace();
  },
  // 按导图顺序把至少两个有效节点收进一个命名分组。
  createMindNodeGroup: (rawName, nodeIds) => {
    const name = rawName.trim();
    const state = get();
    const map = state.mindMap;
    if (!map || !name) return;
    const requestedIds = new Set(nodeIds);
    const validNodeIds = map.nodes.filter((node) => node.selectable && requestedIds.has(node.id)).map((node) => node.id);
    if (validNodeIds.length < 2) return;

    const targetIds = new Set(validNodeIds);
    const retainedGroups = mindNodeGroups(map)
      .map((group) => ({ ...group, nodeIds: group.nodeIds.filter((id) => !targetIds.has(id)) }))
      .filter((group) => group.nodeIds.length >= 2);
    const retainedGroupIds = new Set(retainedGroups.map((group) => group.id));
    const group: MindNodeGroup = {
      id: createId("node_group"),
      name,
      nodeIds: validNodeIds,
      createdAt: new Date().toISOString(),
    };

    recordMindMapHistory(map, state.activeMindNodeId);
    invalidateRevision("map");
    set({
      mindMap: {
        ...map,
        nodes: map.nodes.map((node) => {
          if (targetIds.has(node.id)) return withMindNodeGroup(node, group.id);
          if (node.groupId && !retainedGroupIds.has(node.groupId)) return withMindNodeGroup(node);
          return node;
        }),
        groups: [...retainedGroups, group],
      },
      mindMapCanUndo: true,
      mindMapCanRedo: false,
      loading: "idle",
      streamText: "",
      error: undefined,
    });
    get().persistWorkspace();
  },
  // 从分组中移出指定节点，成员不足两个时自动解散分组。
  ungroupMindNodes: (nodeIds) => {
    const state = get();
    const map = state.mindMap;
    if (!map) return;
    const targetIds = new Set(nodeIds);
    const groups = mindNodeGroups(map);
    const changed = map.nodes.some((node) => targetIds.has(node.id) && Boolean(node.groupId))
      || groups.some((group) => group.nodeIds.some((id) => targetIds.has(id)));
    if (!changed) return;
    const nextGroups = groups
      .map((group) => ({ ...group, nodeIds: group.nodeIds.filter((id) => !targetIds.has(id)) }))
      .filter((group) => group.nodeIds.length >= 2);
    const survivingGroupIds = new Set(nextGroups.map((group) => group.id));

    recordMindMapHistory(map, state.activeMindNodeId);
    invalidateRevision("map");
    set({
      mindMap: {
        ...map,
        nodes: map.nodes.map((node) => {
          if (targetIds.has(node.id) || (node.groupId && !survivingGroupIds.has(node.groupId))) return withMindNodeGroup(node);
          return node;
        }),
        groups: nextGroups,
      },
      mindMapCanUndo: true,
      mindMapCanRedo: false,
      loading: "idle",
      streamText: "",
      error: undefined,
    });
    get().persistWorkspace();
  },
  toggleMindNodeCollapsed: (nodeId) => {
    const state = get();
    if (!state.mindMap) return;
    recordMindMapHistory(state.mindMap, state.activeMindNodeId);
    invalidateRevision("map");
    const target = state.mindMap.nodes.find((node) => node.id === nodeId);
    const collapsing = !target?.collapsed;
    const descendants = new Set<string>();
    if (collapsing) {
      let changed = true;
      while (changed) {
        changed = false;
        for (const node of state.mindMap.nodes) {
          if (node.parentId && (node.parentId === nodeId || descendants.has(node.parentId)) && !descendants.has(node.id)) {
            descendants.add(node.id);
            changed = true;
          }
        }
      }
    }
    set({ mindMap: { ...state.mindMap, nodes: state.mindMap.nodes.map((node) => node.id === nodeId ? { ...node, collapsed: collapsing } : descendants.has(node.id) ? { ...node, selected: false } : node) }, activeMindNodeId: nodeId, mindMapCanUndo: true, mindMapCanRedo: false, loading: "idle", streamText: "" });
    get().persistWorkspace();
  },
  revealMindNode: (nodeId) => {
    const state = get();
    if (!state.mindMap) return;
    const byId = new Map(state.mindMap.nodes.map((node) => [node.id, node]));
    const ancestors = new Set<string>();
    let current = byId.get(nodeId);
    while (current?.parentId && !ancestors.has(current.parentId)) {
      ancestors.add(current.parentId);
      current = byId.get(current.parentId);
    }
    if (!state.mindMap.nodes.some((node) => ancestors.has(node.id) && node.collapsed)) return;
    recordMindMapHistory(state.mindMap, state.activeMindNodeId);
    set({ mindMap: { ...state.mindMap, nodes: state.mindMap.nodes.map((node) => ancestors.has(node.id) ? { ...node, collapsed: false } : node) }, mindMapCanUndo: true, mindMapCanRedo: false });
    get().persistWorkspace();
  },
  setMindNodesSelected: (nodeIds, append = false) => {
    const state = get();
    if (!state.mindMap) return;
    const selected = new Set(nodeIds);
    const activeMindNodeId = nodeIds.at(-1) ?? state.activeMindNodeId;
    let changed = activeMindNodeId !== state.activeMindNodeId;
    const nodes = state.mindMap.nodes.map((node) => {
      if (!node.selectable) return node;
      const nextSelected = append ? node.selected || selected.has(node.id) : selected.has(node.id);
      if (nextSelected === node.selected) return node;
      changed = true;
      return { ...node, selected: nextSelected };
    });
    if (!changed) return;
    recordMindMapHistory(state.mindMap, state.activeMindNodeId);
    invalidateRevision("map");
    set({ mindMap: { ...state.mindMap, nodes }, activeMindNodeId, mindMapCanUndo: true, mindMapCanRedo: false, loading: "idle", streamText: "" });
    get().persistWorkspace();
  },
  setMindNodesLocked: (nodeIds, locked) => {
    const state = get();
    if (!state.mindMap) return;
    const targets = new Set(nodeIds);
    let changed = false;
    const nodes = state.mindMap.nodes.map((node) => {
      if (!node.selectable || !targets.has(node.id) || (node.locked === locked && node.selected)) return node;
      changed = true;
      return { ...node, locked, selected: true };
    });
    if (!changed) return;
    recordMindMapHistory(state.mindMap, state.activeMindNodeId);
    invalidateRevision("map");
    set({ mindMap: { ...state.mindMap, nodes }, mindMapCanUndo: true, mindMapCanRedo: false, loading: "idle", streamText: "" });
    get().persistWorkspace();
  },
  undoMindMap: () => {
    const state = get();
    const previous = mindMapUndoStack.pop();
    if (!state.mindMap || !previous) return;
    const shouldSyncTopic = state.topic === state.mindMap.topic;
    mindMapRedoStack.push({ map: cloneMindMap(state.mindMap), activeMindNodeId: state.activeMindNodeId });
    mindMapEditStarted = false;
    invalidateRevision("map");
    set({ ...(shouldSyncTopic ? { topic: previous.map.topic } : {}), mindMap: previous.map, activeMindNodeId: previous.activeMindNodeId, mindMapCanUndo: mindMapUndoStack.length > 0, mindMapCanRedo: true, loading: "idle", streamText: "" });
    get().persistWorkspace();
  },
  redoMindMap: () => {
    const state = get();
    const next = mindMapRedoStack.pop();
    if (!state.mindMap || !next) return;
    const shouldSyncTopic = state.topic === state.mindMap.topic;
    mindMapUndoStack.push({ map: cloneMindMap(state.mindMap), activeMindNodeId: state.activeMindNodeId });
    mindMapEditStarted = false;
    invalidateRevision("map");
    set({ ...(shouldSyncTopic ? { topic: next.map.topic } : {}), mindMap: next.map, activeMindNodeId: next.activeMindNodeId, mindMapCanUndo: true, mindMapCanRedo: mindMapRedoStack.length > 0, loading: "idle", streamText: "" });
    get().persistWorkspace();
  },
  rerollMindMapUnlockedNodes: async () => {
    const { topic, intensity, mindMap, activeMindNodeId } = get();
    if (!mindMap) {
      return;
    }
    if (!mindMap.nodes.some((node) => node.selectable && !node.locked && node.category !== "中心")) {
      set({ error: "没有可重掷的未锁节点。" });
      return;
    }

    const request = beginAiRequest(["topic", "map"]);
    set({ loading: "reroll", streamText: "", error: undefined });
    try {
      const rerolledMap = await requestRerollMindMap({
        topic,
        intensity,
        map: mindMap,
        signal: request.controller.signal,
        onProgress: (text) => {
          if (isCurrentAiRequest(request)) {
            set((state) => ({ streamText: `${state.streamText}${text}`.slice(-300) }));
          }
        },
      });
      if (!isCurrentAiRequest(request)) {
        return;
      }
      clearMindMapHistory();
      set({
        mindMap: rerolledMap,
        activeMindNodeId: activeMindNodeId && rerolledMap.nodes.some((node) => node.id === activeMindNodeId) ? activeMindNodeId : rerolledMap.recommendedNodeIds[0],
        loading: "idle",
        streamText: "",
        mindMapCanUndo: false,
        mindMapCanRedo: false,
      });
      get().persistWorkspace();
    } catch (error) {
      if (!isCurrentAiRequest(request)) {
        return;
      }
      set({ loading: "idle", streamText: "", error: aiErrorMessage(error) });
    } finally {
      finishAiRequest(request);
    }
  },
  expandActiveMindNode: async () => {
    const { topic, intensity, mindMap, activeMindNodeId } = get();
    if (!mindMap || !activeMindNodeId) {
      set({ error: "先选中一个导图节点。" });
      return;
    }

    const activeNode = mindMap.nodes.find((node) => node.id === activeMindNodeId);
    if (!activeNode?.selectable) {
      set({ error: "中心主题不能直接继续发散，先选一个周围节点。" });
      return;
    }

    const request = beginAiRequest(["topic", "map"]);
    set({ loading: "expand", streamText: "", error: undefined });
    try {
      const expansion = await requestExpandMindNode({
        topic,
        intensity,
        map: mindMap,
        nodeId: activeMindNodeId,
        signal: request.controller.signal,
        onProgress: (text) => {
          if (isCurrentAiRequest(request)) {
            set((state) => ({ streamText: `${state.streamText}${text}`.slice(-300) }));
          }
        },
      });
      if (!isCurrentAiRequest(request)) {
        return;
      }
      clearMindMapHistory();
      set((state) => {
        if (!state.mindMap || state.activeMindNodeId !== activeMindNodeId) {
          return { loading: "idle", streamText: "" };
        }

        const existingIds = new Set(state.mindMap.nodes.map((node) => node.id));
        const existingLabels = new Set(state.mindMap.nodes.map((node) => node.label));
        const newNodes = expansion.nodes.filter((node) => !existingIds.has(node.id) && !existingLabels.has(node.label));
        const newNodeIds = new Set(newNodes.map((node) => node.id));
        const newEdges = expansion.edges.filter((edge) => newNodeIds.has(edge.to));
        const recommendedNodeIds = Array.from(new Set([...state.mindMap.recommendedNodeIds, ...expansion.recommendedNodeIds.filter((id) => newNodeIds.has(id))])).slice(-8);

        return {
          mindMap: {
            ...state.mindMap,
            nodes: [...state.mindMap.nodes.map((node) => node.id === activeMindNodeId ? { ...node, collapsed: false } : node), ...newNodes],
            edges: [...state.mindMap.edges, ...newEdges],
            recommendedNodeIds,
          },
          activeMindNodeId: newNodes[0]?.id ?? activeMindNodeId,
          loading: "idle",
          streamText: "",
          mindMapCanUndo: false,
          mindMapCanRedo: false,
        };
      });
      get().persistWorkspace();
    } catch (error) {
      if (!isCurrentAiRequest(request)) {
        return;
      }
      set({ loading: "idle", streamText: "", error: aiErrorMessage(error) });
    } finally {
      finishAiRequest(request);
    }
  },
  generateIdeasFromMindMap: async (viewport = { panX: 0, panY: 0, scale: 1 }, collisionRecipe) => {
    const { topic, mindMap, activeMindNodeId } = get();
    if (!mindMap) {
      set({ error: "先生成一张发散思维导图。" });
      return;
    }

    const selectedNodes = mindMap.nodes.filter((node) => node.selectable && node.selected);
    const nodeById = new Map(mindMap.nodes.map((node) => [node.id, node]));
    const seenSourceNodeIds = new Set(selectedNodes.map((node) => node.id));
    const recommendedNodes = mindMap.recommendedNodeIds.flatMap((nodeId) => {
      const node = nodeById.get(nodeId);
      if (!node?.selectable || seenSourceNodeIds.has(nodeId)) return [];
      seenSourceNodeIds.add(nodeId);
      return [node];
    });
    const sourceNodes = [...selectedNodes, ...recommendedNodes];
    if (sourceNodes.length === 0) {
      set({ loading: "idle", streamText: "", error: "没有可用于生成脑洞的有效来源节点。" });
      return;
    }
    const sourceNodeIds = sourceNodes.map((node) => node.id);
    const sourceNodeIdSet = new Set(sourceNodeIds);
    const currentActiveNode = mindMap.nodes.find(
      (node) => node.selectable && node.id === activeMindNodeId && sourceNodeIdSet.has(node.id),
    );
    const origin: IdeaOriginSnapshot = {
      mapId: mindMap.id,
      sourceNodeIds,
      activeNodeId: currentActiveNode?.id ?? sourceNodeIds.at(-1)!,
      viewport: {
        panX: Number.isFinite(viewport.panX) ? viewport.panX : 0,
        panY: Number.isFinite(viewport.panY) ? viewport.panY : 0,
        scale: Number.isFinite(viewport.scale) && viewport.scale > 0 ? viewport.scale : 1,
      },
      ...(collisionRecipe ? { collisionRecipe } : {}),
    };
    const words = mindMapNodesToWords(sourceNodes, mindMap);
    const groups = groupsFromMindWords(words);
    const sourcePath = Array.from(new Set([mindMap.center.label, ...words.flatMap((word) => word.sourcePath ?? [word.text])]));

    const request = beginAiRequest(["topic", "map"]);
    set({ groups, loading: "ideas", streamText: "", error: undefined });
    try {
      const ideas = (await requestIdeas({
        topic,
        sourceWords: words,
        ...(collisionRecipe ? { collisionRecipe } : {}),
        signal: request.controller.signal,
        onProgress: (text) => {
          if (isCurrentAiRequest(request)) {
            set((state) => ({ streamText: `${state.streamText}${text}`.slice(-300) }));
          }
        },
      })).map((idea) => ({ ...idea, sourcePath: idea.sourcePath ?? sourcePath, origin }));
      if (!isCurrentAiRequest(request)) {
        return;
      }
      set({ ideas, refinementsByIdeaId: {}, refinementActionsByIdeaId: {}, executionPlansByIdeaId: {}, challengesByIdeaId: {}, discussionsByIdeaId: {}, activeIdeaId: ideas[0]?.id, loading: "idle", streamText: "" });
      ideaRevision += 1;
      get().persistWorkspace();
    } catch (error) {
      if (!isCurrentAiRequest(request)) {
        return;
      }
      set({ loading: "idle", streamText: "", error: aiErrorMessage(error) });
    } finally {
      finishAiRequest(request);
    }
  },
  restoreIdeaOrigin: (ideaId, focusNodeId) => {
    const state = get();
    const idea = state.ideas.find((item) => item.id === ideaId) ?? state.favorites.find((favorite) => favorite.idea.id === ideaId)?.idea;
    if (!idea?.origin) {
      set({ error: "这个脑洞没有可返回的来源快照。" });
      return false;
    }
    if (!state.mindMap || state.mindMap.id !== idea.origin.mapId) {
      set({ error: "当前工作区不是这个脑洞的来源导图。" });
      return false;
    }

    const nodeById = new Map(state.mindMap.nodes.map((node) => [node.id, node]));
    if (idea.origin.sourceNodeIds.length === 0 || idea.origin.sourceNodeIds.some((nodeId) => !nodeById.get(nodeId)?.selectable)) {
      set({ error: "来源导图中的节点已经不存在。" });
      return false;
    }
    const sourceNodeIds = idea.origin.sourceNodeIds.filter((nodeId, index, nodeIds) => nodeIds.indexOf(nodeId) === index);

    const sourceIds = new Set(sourceNodeIds);
    const requestedFocusNodeId = focusNodeId && sourceIds.has(focusNodeId) ? focusNodeId : undefined;
    const storedActiveNode = sourceIds.has(idea.origin.activeNodeId) ? nodeById.get(idea.origin.activeNodeId) : undefined;
    const activeNodeId = requestedFocusNodeId ?? (storedActiveNode?.selectable ? storedActiveNode.id : sourceNodeIds.at(-1)!);
    const ancestorIds = new Set<string>();
    for (const sourceNodeId of sourceNodeIds) {
      let current = nodeById.get(sourceNodeId);
      while (current?.parentId && !ancestorIds.has(current.parentId)) {
        ancestorIds.add(current.parentId);
        current = nodeById.get(current.parentId);
      }
    }
    const nodes = state.mindMap.nodes.map((node) => {
      const selected = node.selectable ? sourceIds.has(node.id) : node.selected;
      const collapsed = ancestorIds.has(node.id) ? false : node.collapsed;
      return selected === node.selected && collapsed === node.collapsed ? node : { ...node, selected, collapsed };
    });
    const mindMapNavigationIntent: MindMapNavigationIntent = {
      mapId: idea.origin.mapId,
      sourceNodeIds,
      activeNodeId,
      viewport: { ...idea.origin.viewport },
      ...(idea.origin.collisionRecipe ? { collisionRecipe: idea.origin.collisionRecipe } : {}),
      ...(requestedFocusNodeId ? { focusNodeId: requestedFocusNodeId } : {}),
    };

    invalidateRevision("map");
    set({
      mindMap: { ...state.mindMap, nodes },
      activeMindNodeId: activeNodeId,
      mindMapNavigationIntent,
      loading: "idle",
      streamText: "",
      error: undefined,
    });
    get().persistWorkspace();
    return true;
  },
  consumeMindMapNavigationIntent: () => {
    set({ mindMapNavigationIntent: undefined });
  },
  toggleWordLock: (wordId) => {
    invalidateRevision("idea");
    set((state) => ({
      groups: state.groups.map((group) => ({
        ...group,
        words: group.words.map((word) => (word.id === wordId ? { ...word, locked: !word.locked } : word)),
      })),
      loading: "idle",
      streamText: "",
    }));
    get().persistWorkspace();
  },
  selectWord: (wordId) => {
    invalidateRevision("idea");
    set((state) => {
      const targetGroupType = findWordGroupType(state.groups, wordId);
      if (!targetGroupType) {
        return state;
      }

      return {
        loading: "idle",
        streamText: "",
        groups: state.groups.map((group) => ({
          ...group,
          words: group.words.map((word) => ({
            ...word,
            selected: word.groupType === targetGroupType ? word.id === wordId : word.selected,
          })),
        })),
      };
    });
    get().persistWorkspace();
  },
  rerollUnlockedWords: async () => {
    const { topic, intensity, groups } = get();
    if (groups.length === 0) {
      return;
    }

    const request = beginAiRequest(["topic", "idea"]);
    set({ loading: "words", streamText: "", error: undefined });
    try {
      const freshGroups = await requestWords({
        topic,
        intensity,
        cacheNonce: `reroll_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        signal: request.controller.signal,
        onProgress: (text) => {
          if (isCurrentAiRequest(request)) {
            set((state) => ({ streamText: `${state.streamText}${text}`.slice(-300) }));
          }
        },
      });
      if (!isCurrentAiRequest(request)) {
        return;
      }
      set({ groups: mergeLockedWords(groups, freshGroups), loading: "idle", streamText: "" });
      ideaRevision += 1;
      get().persistWorkspace();
    } catch (error) {
      if (!isCurrentAiRequest(request)) {
        return;
      }
      set({ loading: "idle", streamText: "", error: aiErrorMessage(error) });
    } finally {
      finishAiRequest(request);
    }
  },
  recommendCollision: async () => {
    const { topic, groups } = get();
    if (groups.length === 0) {
      return;
    }

    const request = beginAiRequest(["topic", "idea"]);
    set({ loading: "collision", streamText: "", error: undefined });
    try {
      const recommendation = await requestCollisionRecommendation({
        topic,
        groups,
        signal: request.controller.signal,
        onProgress: (text) => {
          if (isCurrentAiRequest(request)) {
            set((state) => ({ streamText: `${state.streamText}${text}`.slice(-300) }));
          }
        },
      });
      if (!isCurrentAiRequest(request)) {
        return;
      }
      const selectedIds = new Set(recommendation.selectedWordIds);
      set((state) => ({
        groups: state.groups.map((group) => ({
          ...group,
          words: group.words.map((word) => {
            const lockedWords = group.words.filter((item) => item.locked);
            return { ...word, selected: lockedWords.length > 0 ? word.locked : selectedIds.has(word.id) };
          }),
        })),
        loading: "idle",
        streamText: "",
      }));
      get().persistWorkspace();
    } catch (error) {
      if (!isCurrentAiRequest(request)) {
        return;
      }
      set({ loading: "idle", streamText: "", error: aiErrorMessage(error) });
    } finally {
      finishAiRequest(request);
    }
  },
  generateIdeas: async () => {
    const { topic, groups } = get();
    const words = selectedWords(groups);
    if (words.length !== 6) {
      set({ error: "每类先选一个词，再把它们撞一下。" });
      return;
    }

    const request = beginAiRequest(["topic", "idea"]);
    set({ loading: "ideas", streamText: "", error: undefined });
    try {
      const ideas = await requestIdeas({
        topic,
        sourceWords: words,
        signal: request.controller.signal,
        onProgress: (text) => {
          if (isCurrentAiRequest(request)) {
            set((state) => ({ streamText: `${state.streamText}${text}`.slice(-300) }));
          }
        },
      });
      if (!isCurrentAiRequest(request)) {
        return;
      }
      set({ ideas, refinementsByIdeaId: {}, refinementActionsByIdeaId: {}, executionPlansByIdeaId: {}, challengesByIdeaId: {}, discussionsByIdeaId: {}, activeIdeaId: ideas[0]?.id, loading: "idle", streamText: "" });
      get().persistWorkspace();
    } catch (error) {
      if (!isCurrentAiRequest(request)) {
        return;
      }
      set({ loading: "idle", streamText: "", error: aiErrorMessage(error) });
    } finally {
      finishAiRequest(request);
    }
  },
  setActiveIdea: (ideaId) => {
    const cancelledRequest = get().activeIdeaId !== ideaId ? invalidateRevision("idea") : false;
    set({ activeIdeaId: ideaId, ...(cancelledRequest ? { loading: "idle", streamText: "" } : {}) });
    get().persistWorkspace();
  },
  transformActiveIdea: async (direction) => {
    const { ideas, activeIdeaId } = get();
    const idea = ideas.find((item) => item.id === activeIdeaId);
    if (!idea) {
      set({ error: "先选中一张脑洞卡片。" });
      return;
    }

    const request = beginAiRequest(["idea"]);
    set({ loading: "transform", streamText: "", error: undefined });
    try {
      const transformed = await requestTransform({
        idea,
        direction,
        signal: request.controller.signal,
        onProgress: (text) => {
          if (isCurrentAiRequest(request)) {
            set((state) => ({ streamText: `${state.streamText}${text}`.slice(-300) }));
          }
        },
      });
      if (!isCurrentAiRequest(request)) {
        return;
      }
      const transformedWithOrigin: IdeaCard = {
        ...transformed,
        ...(transformed.sourcePath === undefined && idea.sourcePath !== undefined ? { sourcePath: idea.sourcePath } : {}),
        ...(transformed.origin === undefined && idea.origin !== undefined ? { origin: idea.origin } : {}),
      };
      set((state) => ({
        ideas: [transformedWithOrigin, ...state.ideas],
        activeIdeaId: transformedWithOrigin.id,
        loading: "idle",
        streamText: "",
      }));
      get().persistWorkspace();
    } catch (error) {
      if (!isCurrentAiRequest(request)) {
        return;
      }
      set({ loading: "idle", streamText: "", error: aiErrorMessage(error) });
    } finally {
      finishAiRequest(request);
    }
  },
  refineActiveIdea: async () => {
    const { ideas, activeIdeaId, refinementsByIdeaId } = get();
    const idea = ideas.find((item) => item.id === activeIdeaId);
    if (!idea) {
      set({ error: "先选中一张脑洞卡片。" });
      return;
    }
    if (refinementsByIdeaId[idea.id]) {
      set({ error: undefined });
      return;
    }

    const request = beginAiRequest(["idea"]);
    set({ loading: "refine", streamText: "", error: undefined });
    try {
      const refinement = await requestRefine({
        idea,
        signal: request.controller.signal,
        onProgress: (text) => {
          if (isCurrentAiRequest(request)) {
            set((state) => ({ streamText: `${state.streamText}${text}`.slice(-300) }));
          }
        },
      });
      if (!isCurrentAiRequest(request)) {
        return;
      }
      set((state) => ({
        refinementsByIdeaId: {
          ...state.refinementsByIdeaId,
          [idea.id]: refinement,
        },
        loading: "idle",
        streamText: "",
      }));
      get().persistWorkspace();
    } catch (error) {
      if (!isCurrentAiRequest(request)) {
        return;
      }
      set({ loading: "idle", streamText: "", error: aiErrorMessage(error) });
    } finally {
      finishAiRequest(request);
    }
  },
  challengeIdea: async (ideaId, role) => {
    const state = get();
    const idea = state.ideas.find((item) => item.id === ideaId) ?? state.favorites.find((favorite) => favorite.idea.id === ideaId)?.idea;
    if (!idea) {
      set({ error: "没有找到要挑战的脑洞。" });
      return;
    }

    const request = beginAiRequest(["idea"]);
    set({ loading: "challenge", streamText: "", error: undefined });
    try {
      const challenge = await requestIdeaChallenge({
        idea,
        role,
        signal: request.controller.signal,
        onProgress: (text) => {
          if (isCurrentAiRequest(request)) {
            set((current) => ({ streamText: `${current.streamText}${text}`.slice(-300) }));
          }
        },
      });
      if (!isCurrentAiRequest(request)) return;
      const normalizedChallenge: IdeaChallenge = { ...challenge, ideaId: idea.id, role };
      set((current) => ({
        challengesByIdeaId: {
          ...current.challengesByIdeaId,
          [idea.id]: mergeIdeaChallenges(current.challengesByIdeaId[idea.id] ?? [], [normalizedChallenge]),
        },
        loading: "idle",
        streamText: "",
      }));
      get().persistWorkspace();
    } catch (error) {
      if (!isCurrentAiRequest(request)) return;
      set({ loading: "idle", streamText: "", error: aiErrorMessage(error) });
    } finally {
      finishAiRequest(request);
    }
  },
  discussIdea: async (ideaId, setup = { lineup: "standard", mechanism: "relay", participants: ["用户代言人", "反常识派", "跨界连接者", "现实构建者"] }) => {
    const state = get();
    const idea = state.ideas.find((item) => item.id === ideaId) ?? state.favorites.find((favorite) => favorite.idea.id === ideaId)?.idea;
    if (!idea) {
      set({ error: "没有找到要讨论的脑洞。" });
      return;
    }

    const request = beginAiRequest(["idea"]);
    set({ loading: "discussion", streamText: "", error: undefined });
    try {
      const discussion = await requestDiscussion({
        idea,
        setup,
        signal: request.controller.signal,
        onProgress: (text) => {
          if (isCurrentAiRequest(request)) {
            set((current) => ({ streamText: `${current.streamText}${text}`.slice(-300) }));
          }
        },
      });
      if (!isCurrentAiRequest(request)) return;
      const normalizedDiscussion: IdeaDiscussion = {
        ...discussion,
        ideaId: idea.id,
        status: "completed",
        lineup: setup.lineup,
        mechanism: setup.mechanism,
        participants: setup.participants,
        collectedSparkIds: Array.from(new Set(Array.isArray(discussion.collectedSparkIds) ? discussion.collectedSparkIds : [])),
      };
      set((current) => ({
        discussionsByIdeaId: {
          ...current.discussionsByIdeaId,
          [idea.id]: mergeIdeaDiscussions(current.discussionsByIdeaId[idea.id] ?? [], [normalizedDiscussion]),
        },
        loading: "idle",
        streamText: "",
      }));
      get().persistWorkspace();
    } catch (error) {
      if (!isCurrentAiRequest(request)) return;
      set({ loading: "idle", streamText: "", error: aiErrorMessage(error) });
    } finally {
      finishAiRequest(request);
    }
  },
  respondToIdeaDiscussion: async (ideaId, discussionId, input) => {
    const state = get();
    if (state.loading !== "idle") return;
    const idea = state.ideas.find((item) => item.id === ideaId) ?? state.favorites.find((favorite) => favorite.idea.id === ideaId)?.idea;
    if (!idea) {
      set({ error: "没有找到要继续讨论的脑洞。" });
      return;
    }
    const discussion = state.discussionsByIdeaId[ideaId]?.find((item) => item.id === discussionId);
    if (!discussion || discussion.status !== "completed") {
      set({ error: "没有找到已完成的讨论。" });
      return;
    }
    if (discussion.interventions.length >= 3) {
      set({ error: "本场讨论最多介入三次。" });
      return;
    }
    const prompt = input.prompt.trim();
    if (!prompt || prompt.length > 180) {
      set({ error: "介入输入需要控制在 1 到 180 字。" });
      return;
    }

    const request = beginAiRequest(["idea"]);
    set({ loading: "discussionResponse", streamText: "", error: undefined });
    try {
      const intervention = await respondToDiscussion({
        idea,
        discussion,
        type: input.type,
        prompt,
        targetRole: input.targetRole,
        ...(input.sourceRole ? { sourceRole: input.sourceRole } : {}),
        ...(input.sourceClaim?.trim() ? { sourceClaim: input.sourceClaim.trim() } : {}),
        signal: request.controller.signal,
        onProgress: (text) => {
          if (isCurrentAiRequest(request)) {
            set((current) => ({ streamText: `${current.streamText}${text}`.slice(-300) }));
          }
        },
      });
      if (!isCurrentAiRequest(request)) return;
      const current = get();
      const currentDiscussions = current.discussionsByIdeaId[ideaId] ?? [];
      const currentDiscussion = currentDiscussions.find((item) => item.id === discussionId);
      if (!currentDiscussion || currentDiscussion.status !== "completed" || currentDiscussion.interventions.length >= 3) {
        set({ loading: "idle", streamText: "" });
        return;
      }
      const normalizedIntervention = {
        ...intervention,
        type: input.type,
        prompt,
        targetRole: input.targetRole,
        ...(input.sourceRole ? { sourceRole: input.sourceRole } : {}),
        ...(input.sourceClaim?.trim() ? { sourceClaim: input.sourceClaim.trim() } : {}),
      };
      const updatedDiscussions = currentDiscussions.map((item) =>
        item.id === discussionId
          ? { ...item, interventions: [...item.interventions, normalizedIntervention] }
          : item,
      );
      set({
        discussionsByIdeaId: { ...current.discussionsByIdeaId, [ideaId]: updatedDiscussions },
        loading: "idle",
        streamText: "",
        error: undefined,
      });
      ideaRevision += 1;
      get().persistWorkspace();
    } catch (error) {
      if (!isCurrentAiRequest(request)) return;
      set({ loading: "idle", streamText: "", error: aiErrorMessage(error) });
    } finally {
      finishAiRequest(request);
    }
  },
  continueDiscussionDirection: async (ideaId, discussionId, directionKey, opposite = false) => {
    const state = get();
    if (state.loading !== "idle") return false;
    const idea = state.ideas.find((item) => item.id === ideaId) ?? state.favorites.find((favorite) => favorite.idea.id === ideaId)?.idea;
    if (!idea) {
      set({ error: "没有找到要继续发散的脑洞。" });
      return false;
    }
    const discussion = state.discussionsByIdeaId[ideaId]?.find((item) => item.id === discussionId);
    if (!discussion || discussion.status !== "completed" || !discussion.synthesis?.[directionKey]) {
      set({ error: "没有找到可继续的讨论方向。" });
      return false;
    }
    const map = state.mindMap;
    if (!map) {
      set({ error: "当前没有可继续生长的思维导图。" });
      return false;
    }
    const originParent = idea.origin?.mapId === map.id
      ? map.nodes.find((node) => node.id === idea.origin?.activeNodeId)
      : undefined;
    const parent = originParent ?? map.center;
    const viewport = idea.origin?.mapId === map.id
      ? { ...idea.origin.viewport }
      : state.mindMapNavigationIntent?.mapId === map.id
        ? { ...state.mindMapNavigationIntent.viewport }
        : { panX: 0, panY: 0, scale: 1 };

    const request = beginAiRequest(["idea", "map"]);
    set({ loading: "discussionBranch", streamText: "", error: undefined });
    try {
      const expansion = await branchFromDiscussion({
        idea,
        discussion,
        directionKey,
        opposite,
        map,
        parentNodeId: parent.id,
        signal: request.controller.signal,
        onProgress: (text) => {
          if (isCurrentAiRequest(request)) {
            set((current) => ({ streamText: `${current.streamText}${text}`.slice(-300) }));
          }
        },
      });
      if (!isCurrentAiRequest(request)) return false;
      const current = get();
      const currentDiscussion = current.discussionsByIdeaId[ideaId]?.find((item) => item.id === discussionId);
      if (!current.mindMap || current.mindMap.id !== map.id || !currentDiscussion?.synthesis?.[directionKey]) {
        set({ loading: "idle", streamText: "" });
        return false;
      }

      const existingIds = new Set(current.mindMap.nodes.map((node) => node.id));
      const existingLabels = new Set(current.mindMap.nodes.map((node) => node.label));
      const origin = { ideaId, discussionId, directionKey, ...(opposite ? { opposite: true } : {}) };
      const newNodes = expansion.nodes
        .filter((node) => !existingIds.has(node.id) && !existingLabels.has(node.label))
        .map((node) => ({ ...node, selected: true, discussionOrigin: origin }));
      if (newNodes.length < 4 || newNodes.length > 6) {
        throw new Error("讨论方向分支必须包含 4 到 6 个新节点");
      }
      const newNodeIds = new Set(newNodes.map((node) => node.id));
      const newEdges = expansion.edges.filter((edge) => newNodeIds.has(edge.to));
      const recommendedNodeIds = expansion.recommendedNodeIds.filter((nodeId) => newNodeIds.has(nodeId));
      const activeMindNodeId = recommendedNodeIds[0] ?? newNodes[0]!.id;
      const sourceNodeIds = newNodes.map((node) => node.id);

      recordMindMapHistory(current.mindMap, current.activeMindNodeId);
      set({
        mindMap: {
          ...current.mindMap,
          nodes: [
            ...current.mindMap.nodes.map((node) => ({
              ...node,
              ...(node.selectable ? { selected: false } : {}),
              ...(node.id === parent.id ? { collapsed: false } : {}),
            })),
            ...newNodes,
          ],
          edges: [...current.mindMap.edges, ...newEdges],
          recommendedNodeIds: Array.from(new Set([...current.mindMap.recommendedNodeIds, ...recommendedNodeIds])).slice(-8),
        },
        activeMindNodeId,
        mindMapNavigationIntent: {
          mapId: current.mindMap.id,
          sourceNodeIds,
          activeNodeId: activeMindNodeId,
          focusNodeId: activeMindNodeId,
          viewport,
        },
        mindMapCanUndo: true,
        mindMapCanRedo: false,
        loading: "idle",
        streamText: "",
        error: undefined,
      });
      mapRevision += 1;
      get().persistWorkspace();
      return true;
    } catch (error) {
      if (!isCurrentAiRequest(request)) return false;
      set({ loading: "idle", streamText: "", error: aiErrorMessage(error) });
      return false;
    } finally {
      finishAiRequest(request);
    }
  },
  stopDiscussion: () => {
    if (!["discussion", "discussionResponse", "discussionBranch"].includes(get().loading)) return;
    abortActiveAiRequest();
    set({ loading: "idle", streamText: "" });
  },
  collectDiscussionSpark: (ideaId, discussionId, sparkId) => {
    const state = get();
    if (state.loading !== "idle") return;
    const discussions = state.discussionsByIdeaId[ideaId] ?? [];
    const discussion = discussions.find((item) => item.id === discussionId);
    if (!discussion) {
      set({ error: "没有找到这场讨论。" });
      return;
    }
    const spark = discussion.rounds
      .flatMap((round) => round.contributions)
      .flatMap((contribution) => (contribution.spark ? [contribution.spark] : []))
      .find((item) => item.id === sparkId);
    if (!spark) {
      set({ error: "没有找到要采集的讨论火花。" });
      return;
    }
    if (discussion.collectedSparkIds.includes(sparkId)) {
      set({ error: undefined });
      return;
    }
    const map = state.mindMap;
    if (!map) {
      set({ error: "当前没有可用的思维导图，无法采集火花。" });
      return;
    }

    const idea = state.ideas.find((item) => item.id === ideaId) ?? state.favorites.find((favorite) => favorite.idea.id === ideaId)?.idea;
    const originParentId = idea?.origin?.activeNodeId;
    const parent = (originParentId ? map.nodes.find((node) => node.id === originParentId) : undefined)
      ?? (originParentId === map.center.id ? map.center : undefined)
      ?? map.center;
    const angle = ((map.nodes.length + discussion.collectedSparkIds.length) * 137.5 * Math.PI) / 180;
    const nodeId = createId("discussion_spark");
    const node: MindNode = {
      id: nodeId,
      label: spark.text,
      category: "远联想",
      level: Math.min(3, parent.level + 1) as MindNode["level"],
      x: parent.x + Math.cos(angle) * 18,
      y: parent.y + Math.sin(angle) * 18,
      selectable: true,
      locked: false,
      selected: true,
      reason: "从多角色圆桌讨论中采集的灵感火花。",
      source: "圆桌讨论火花",
      parentId: parent.id,
    };
    const updatedDiscussions = discussions.map((item) =>
      item.id === discussionId
        ? { ...item, collectedSparkIds: [...item.collectedSparkIds, sparkId] }
        : item,
    );

    recordMindMapHistory(map, state.activeMindNodeId);
    invalidateRevision("map");
    set({
      mindMap: {
        ...map,
        nodes: [...map.nodes.map((item) => ({
          ...item,
          selected: false,
          ...(item.id === parent.id ? { collapsed: false } : {}),
        })), node],
        edges: [...map.edges, { id: createId("discussion_spark_edge"), from: parent.id, to: nodeId, label: "讨论火花" }],
      },
      discussionsByIdeaId: { ...state.discussionsByIdeaId, [ideaId]: updatedDiscussions },
      activeMindNodeId: nodeId,
      mindMapCanUndo: true,
      mindMapCanRedo: false,
      loading: "idle",
      streamText: "",
      error: undefined,
    });
    get().persistWorkspace();
  },
  createIdeaExecutionPlan: (ideaId) => {
    const state = get();
    const ideaExists = state.ideas.some((idea) => idea.id === ideaId) || state.favorites.some((favorite) => favorite.idea.id === ideaId);
    if (!ideaExists) {
      set({ error: "没有找到要推进的脑洞。" });
      return;
    }
    const refinement = state.refinementsByIdeaId[ideaId];
    if (!refinement) {
      set({ error: "缺少炼化结果，无法创建执行计划。" });
      return;
    }
    if (isCompleteExecutionPlan(ideaId, state.executionPlansByIdeaId[ideaId])) {
      set({ error: undefined });
      return;
    }

    set({
      executionPlansByIdeaId: {
        ...state.executionPlansByIdeaId,
        [ideaId]: createExecutionPlan(ideaId, refinement),
      },
      error: undefined,
    });
    get().persistWorkspace();
  },
  toggleIdeaExecutionTask: (ideaId, taskId) => {
    const state = get();
    const plan = state.executionPlansByIdeaId[ideaId];
    if (!plan) {
      set({ error: "没有找到这个脑洞的执行计划。" });
      return;
    }
    if (!plan.tasks.some((task) => task.id === taskId)) {
      set({ error: "没有找到要更新的执行任务。" });
      return;
    }

    const currentTime = Date.now();
    const previousTime = Date.parse(plan.updatedAt);
    const now = new Date(Number.isFinite(previousTime) ? Math.max(currentTime, previousTime + 1) : currentTime).toISOString();
    const tasks = plan.tasks.map((task) => {
      if (task.id !== taskId) return task;
      const { completedAt: _completedAt, ...taskWithoutCompletedAt } = task;
      return task.completed
        ? { ...taskWithoutCompletedAt, completed: false }
        : { ...taskWithoutCompletedAt, completed: true, completedAt: now };
    });
    set({
      executionPlansByIdeaId: {
        ...state.executionPlansByIdeaId,
        [ideaId]: { ...plan, tasks, updatedAt: now },
      },
      error: undefined,
    });
    get().persistWorkspace();
  },
  chooseRefinementAction: (ideaId, action) => {
    const current = get();
    if (action === "收束推进" && !current.refinementsByIdeaId[ideaId]) {
      set({ error: "缺少炼化结果，无法创建执行计划。" });
      return;
    }
    set((state) => {
      const idea = state.ideas.find((item) => item.id === ideaId) ?? state.favorites.find((favorite) => favorite.idea.id === ideaId)?.idea;
      const nextFavorites =
        action === "放入孵化箱" && idea && !state.favorites.some((favorite) => favorite.idea.id === ideaId)
          ? [...state.favorites, { idea, savedAt: new Date().toISOString() }]
          : state.favorites;
      const executionPlansByIdeaId =
        action === "收束推进" && !isCompleteExecutionPlan(ideaId, state.executionPlansByIdeaId[ideaId])
          ? {
              ...state.executionPlansByIdeaId,
              [ideaId]: createExecutionPlan(ideaId, state.refinementsByIdeaId[ideaId]!),
            }
          : state.executionPlansByIdeaId;

      return {
        favorites: nextFavorites,
        executionPlansByIdeaId,
        refinementActionsByIdeaId: {
          ...state.refinementActionsByIdeaId,
          [ideaId]: action,
        },
        error: undefined,
      };
    });
    get().persistWorkspace();
  },
  openIncubator: () =>
    set((state) => ({
      incubatorOpen: true,
      incubatorDetailIdeaId: state.incubatorDetailIdeaId ?? state.favorites[0]?.idea.id,
    })),
  closeIncubator: () => set({ incubatorOpen: false }),
  setIncubatorFilter: (filter) => set({ incubatorFilter: filter }),
  setIncubatorDetail: (ideaId) => set({ incubatorDetailIdeaId: ideaId }),
  toggleIncubatorSelection: (ideaId) =>
    set((state) => {
      const exists = state.favorites.some((favorite) => favorite.idea.id === ideaId);
      if (!exists) {
        return state;
      }

      const alreadySelected = state.incubatorSelectedIdeaIds.includes(ideaId);
      if (alreadySelected) {
        return {
          incubatorSelectedIdeaIds: state.incubatorSelectedIdeaIds.filter((id) => id !== ideaId),
        };
      }
      if (state.incubatorSelectedIdeaIds.length >= 3) {
        return state;
      }

      return {
        incubatorDetailIdeaId: ideaId,
        incubatorSelectedIdeaIds: [...state.incubatorSelectedIdeaIds, ideaId],
      };
    }),
  mixSelectedIncubatorIdeas: async () => {
    const { favorites, incubatorSelectedIdeaIds, intensity } = get();
    const selectedIdeas = incubatorSelectedIdeaIds
      .map((id) => favorites.find((favorite) => favorite.idea.id === id)?.idea)
      .filter((idea): idea is IdeaCard => Boolean(idea));

    if (selectedIdeas.length < 2 || selectedIdeas.length > 3) {
      set({ error: "请选择 2 到 3 个想法再混合。" });
      return;
    }

    const request = beginAiRequest(["idea"]);
    set({ loading: "mix", streamText: "", error: undefined });
    try {
      const seed = await requestMix({
        ideas: selectedIdeas,
        signal: request.controller.signal,
        onProgress: (text) => {
          if (isCurrentAiRequest(request)) {
            set((state) => ({ streamText: `${state.streamText}${text}`.slice(-300) }));
          }
        },
      });

      if (!isCurrentAiRequest(request)) {
        return;
      }
      set({ loading: "map", streamText: "" });

      const mindMap = await requestMindMap({
        topic: seed.mixedTopic,
        intensity,
        signal: request.controller.signal,
        onProgress: (text) => {
          if (isCurrentAiRequest(request)) {
            set((state) => ({ streamText: `${state.streamText}${text}`.slice(-300) }));
          }
        },
      });
      if (!isCurrentAiRequest(request)) {
        return;
      }
      clearMindMapHistory();
      set({
        topic: seed.mixedTopic,
        lastMixedSeed: seed,
        incubatorOpen: false,
        incubatorSelectedIdeaIds: [],
        mindMap,
        groups: [],
        ideas: [],
        refinementsByIdeaId: {},
        refinementActionsByIdeaId: {},
        executionPlansByIdeaId: {},
        challengesByIdeaId: {},
        discussionsByIdeaId: {},
        activeMindNodeId: mindMap.recommendedNodeIds[0],
        activeIdeaId: undefined,
        loading: "idle",
        streamText: "",
        mindMapCanUndo: false,
        mindMapCanRedo: false,
      });
      get().persistWorkspace();
    } catch (error) {
      if (!isCurrentAiRequest(request)) {
        return;
      }
      set({ loading: "idle", streamText: "", error: aiErrorMessage(error) });
    } finally {
      finishAiRequest(request);
    }
  },
  toggleFavorite: (ideaId) => {
    const { ideas, favorites } = get();
    const existing = favorites.find((favorite) => favorite.idea.id === ideaId);
    const idea = ideas.find((item) => item.id === ideaId);
    if (!existing && !idea) {
      set({ error: "没有找到要收藏的脑洞。" });
      return;
    }

    const nextFavorites = existing
      ? favorites.filter((favorite) => favorite.idea.id !== ideaId)
      : [
          ...favorites,
          {
            idea: idea as IdeaCard,
            savedAt: new Date().toISOString(),
          },
        ];

    set({ favorites: nextFavorites });
    get().persistWorkspace();
  },
}));
