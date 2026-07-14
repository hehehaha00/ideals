// 这个文件集中定义脑洞实验室的核心数据类型，供服务、状态和组件共用。
export const DIMENSION_GROUPS = ["人群", "场景", "情绪", "物件", "结构", "限制"] as const;

export type DimensionGroupType = (typeof DIMENSION_GROUPS)[number];

export const DIMENSION_GROUP_DESCRIPTIONS: Record<DimensionGroupType, string> = {
  人群: "谁会使用这个东西",
  场景: "它通常发生在什么时候",
  情绪: "用户当时带着什么心理",
  物件: "可以依附的对象或素材",
  结构: "借用什么熟悉结构",
  限制: "故意加入的反常识条件",
};

export type CollisionRecipeId =
  | "random"
  | "change-audience"
  | "amplify-emotion"
  | "add-constraint"
  | "borrow-structure"
  | "invert-assumption";

export interface CollisionRecipeDefinition {
  id: CollisionRecipeId;
  label: string;
  description: string;
}

export const COLLISION_RECIPES = [
  { id: "random", label: "随机碰撞", description: "打散固定路径，寻找意外组合" },
  { id: "change-audience", label: "换个人群", description: "保留核心机制，改为另一类使用者" },
  { id: "amplify-emotion", label: "放大情绪", description: "把核心情绪推到更强烈的时刻" },
  { id: "add-constraint", label: "加一个限制", description: "加入反常识但可执行的条件" },
  { id: "borrow-structure", label: "借用结构", description: "借一个熟悉结构重新组织想法" },
  { id: "invert-assumption", label: "反过来做", description: "反转默认假设，寻找新方向" },
] as const satisfies readonly CollisionRecipeDefinition[];

// 判断未知值是否是稳定的碰撞配方 id。
export function isCollisionRecipeId(value: unknown): value is CollisionRecipeId {
  return typeof value === "string" && COLLISION_RECIPES.some((recipe) => recipe.id === value);
}

export const MIND_NODE_CATEGORIES = ["中心", "人群", "场景", "情绪", "物件", "结构", "限制", "远联想"] as const;

export type MindNodeCategory = (typeof MIND_NODE_CATEGORIES)[number];

export type StuckType = "没方向" | "有技术没需求" | "有兴趣没形态" | "有产品没差异化";

export type Intensity = "轻微" | "正常" | "狂野";

export const TRANSFORM_DIRECTIONS = [
  "更实用一点",
  "更荒诞一点",
  "更游戏化一点",
  "更像浏览器插件",
  "更像 Agent skill",
  "只保留核心隐喻",
] as const;

export type TransformDirection = (typeof TRANSFORM_DIRECTIONS)[number];

export const IDEA_CHALLENGE_ROLES = ["懒人用户", "毒舌用户", "极端用户", "工程师", "反常识派"] as const;

export type IdeaChallengeRole = (typeof IDEA_CHALLENGE_ROLES)[number];

// 判断未知值是否为反共识挑战支持的角色。
export function isIdeaChallengeRole(value: unknown): value is IdeaChallengeRole {
  return typeof value === "string" && IDEA_CHALLENGE_ROLES.includes(value as IdeaChallengeRole);
}

export const REFINEMENT_ROLES = ["懒人用户", "毒舌用户", "产品经理", "工程师", "测试", "商人"] as const;

export type RefinementRole = (typeof REFINEMENT_ROLES)[number];

export const REFINEMENT_DIRECTION_TYPES = ["玩具版", "工具版", "产品版"] as const;

export type RefinementDirectionType = (typeof REFINEMENT_DIRECTION_TYPES)[number];

export const REFINEMENT_MVP_HORIZONS = ["1小时 MVP", "1天 MVP", "一周版本"] as const;

export type RefinementMvpHorizon = (typeof REFINEMENT_MVP_HORIZONS)[number];

export const REFINEMENT_ACTION_TYPES = ["继续发散", "收束推进", "放入孵化箱"] as const;

export type RefinementActionType = (typeof REFINEMENT_ACTION_TYPES)[number];

export const INCUBATOR_FILTERS = ["全部", "未炼化", "已炼化", "可开工", "想混合", "今天", "本周"] as const;

export type IncubatorFilter = (typeof INCUBATOR_FILTERS)[number];

export interface DimensionWord {
  id: string;
  text: string;
  groupType: DimensionGroupType;
  locked: boolean;
  selected: boolean;
  source: string;
  sourcePath?: string[];
}

export interface DimensionGroup {
  type: DimensionGroupType;
  label: string;
  description: string;
  words: DimensionWord[];
}

export interface MindMapViewportSnapshot {
  panX: number;
  panY: number;
  scale: number;
}

export interface IdeaOriginSnapshot {
  mapId: string;
  sourceNodeIds: string[];
  activeNodeId: string;
  viewport: MindMapViewportSnapshot;
  collisionRecipe?: CollisionRecipeId;
}

export interface MindMapNavigationIntent extends IdeaOriginSnapshot {
  focusNodeId?: string;
}

export interface IdeaCard {
  id: string;
  title: string;
  summary: string;
  whyInteresting: string;
  firstVersion: string;
  sourceWords: DimensionWord[];
  createdAt: string;
  sourcePath?: string[];
  origin?: IdeaOriginSnapshot;
  parentId?: string;
  transformDirection?: TransformDirection;
}

export interface IdeaChallenge {
  ideaId: string;
  role: IdeaChallengeRole;
  challenge: string;
  risk: string;
  newDirection: string;
  createdAt: string;
}

export const IDEA_DISCUSSION_ROLES = ["用户代言人", "反常识派", "跨界连接者", "现实构建者", "未来推演者", "工程实现者"] as const;

export type IdeaDiscussionRole = (typeof IDEA_DISCUSSION_ROLES)[number];

export const IDEA_DISCUSSION_LINEUPS = ["standard", "radical", "practical", "custom"] as const;
export type IdeaDiscussionLineup = (typeof IDEA_DISCUSSION_LINEUPS)[number];

export const IDEA_DISCUSSION_MECHANISMS = ["relay", "refute", "vote", "trade", "extreme"] as const;
export type IdeaDiscussionMechanism = (typeof IDEA_DISCUSSION_MECHANISMS)[number];

export interface IdeaDiscussionSetup {
  lineup: IdeaDiscussionLineup;
  mechanism: IdeaDiscussionMechanism;
  participants: IdeaDiscussionRole[];
}

export const IDEA_DISCUSSION_ROUND_TYPES = ["judgment", "collision", "synthesis"] as const;

export type IdeaDiscussionRoundType = (typeof IDEA_DISCUSSION_ROUND_TYPES)[number];

export const IDEA_DISCUSSION_STATUSES = ["running", "completed", "stopped"] as const;

export type IdeaDiscussionStatus = (typeof IDEA_DISCUSSION_STATUSES)[number];

export interface IdeaDiscussionSpark {
  id: string;
  text: string;
}

export interface IdeaDiscussionContribution {
  role: IdeaDiscussionRole;
  claim: string;
  tension: string;
  spark?: IdeaDiscussionSpark;
  buildsOn?: string;
}

export const IDEA_DISCUSSION_DIRECTION_KEYS = ["conservativeDirection", "radicalDirection", "unexpectedDirection"] as const;

export type IdeaDiscussionDirectionKey = (typeof IDEA_DISCUSSION_DIRECTION_KEYS)[number];

// 判断未知值是否是讨论收束方向。
export function isIdeaDiscussionDirectionKey(value: unknown): value is IdeaDiscussionDirectionKey {
  return typeof value === "string" && IDEA_DISCUSSION_DIRECTION_KEYS.includes(value as IdeaDiscussionDirectionKey);
}

export const IDEA_DISCUSSION_INTERVENTION_TYPES = ["question", "disagree", "add"] as const;

export type IdeaDiscussionInterventionType = (typeof IDEA_DISCUSSION_INTERVENTION_TYPES)[number];

// 判断未知值是否是用户介入动作。
export function isIdeaDiscussionInterventionType(value: unknown): value is IdeaDiscussionInterventionType {
  return typeof value === "string" && IDEA_DISCUSSION_INTERVENTION_TYPES.includes(value as IdeaDiscussionInterventionType);
}

export interface IdeaDiscussionIntervention {
  id: string;
  type: IdeaDiscussionInterventionType;
  prompt: string;
  targetRole: IdeaDiscussionRole;
  sourceRole?: IdeaDiscussionRole;
  sourceClaim?: string;
  responses: IdeaDiscussionContribution[];
  createdAt: string;
}

export interface IdeaDiscussionRound {
  type: IdeaDiscussionRoundType;
  contributions: IdeaDiscussionContribution[];
}

export interface IdeaDiscussionDirection {
  title: string;
  description: string;
  nextStep: string;
}

export interface IdeaDiscussionSynthesis {
  conservativeDirection: IdeaDiscussionDirection;
  radicalDirection: IdeaDiscussionDirection;
  unexpectedDirection: IdeaDiscussionDirection;
}

export interface IdeaDiscussion {
  id: string;
  ideaId: string;
  createdAt: string;
  status: IdeaDiscussionStatus;
  participants: IdeaDiscussionRole[];
  lineup?: IdeaDiscussionLineup;
  mechanism?: IdeaDiscussionMechanism;
  rounds: IdeaDiscussionRound[];
  synthesis?: IdeaDiscussionSynthesis;
  collectedSparkIds: string[];
  interventions: IdeaDiscussionIntervention[];
}

export interface RefinementVitality {
  targetUser: string;
  triggerScene: string;
  coreEmotion: string;
  existingAlternative: string;
  smallestPlayableVersion: string;
}

export interface RefinementRoleFeedback {
  role: RefinementRole;
  feedback: string;
}

export interface RefinementDirection {
  type: RefinementDirectionType;
  title: string;
  description: string;
  firstStep: string;
}

export interface RefinementMvpStep {
  horizon: RefinementMvpHorizon;
  goal: string;
  build: string;
  proof: string;
}

export interface RefinementAction {
  type: RefinementActionType;
  label: string;
  description: string;
}

export interface IdeaRefinement {
  id: string;
  ideaId: string;
  vitality: RefinementVitality;
  roundtable: RefinementRoleFeedback[];
  directions: RefinementDirection[];
  mvpLadder: RefinementMvpStep[];
  actions: RefinementAction[];
  createdAt: string;
}

export interface IdeaExecutionTask {
  id: string;
  horizon: RefinementMvpHorizon;
  goal: string;
  build: string;
  proof: string;
  completed: boolean;
  completedAt?: string;
}

export interface IdeaExecutionPlan {
  ideaId: string;
  tasks: IdeaExecutionTask[];
  createdAt: string;
  updatedAt: string;
}

export interface IdeaSession {
  id: string;
  topic: string;
  intensity: Intensity;
  groups: DimensionGroup[];
  ideas: IdeaCard[];
  activeIdeaId?: string;
  updatedAt: string;
}

export interface FavoriteIdea {
  idea: IdeaCard;
  savedAt: string;
}

export interface IncubatorEntry extends FavoriteIdea {
  refinement?: IdeaRefinement;
  action?: RefinementActionType;
  executionPlan?: IdeaExecutionPlan;
  challenges?: IdeaChallenge[];
  discussions?: IdeaDiscussion[];
}

export interface WorkspaceSnapshot {
  topic: string;
  intensity: Intensity;
  groups: DimensionGroup[];
  mindMap?: BrainstormMap;
  ideas: IdeaCard[];
  refinementsByIdeaId: Record<string, IdeaRefinement>;
  refinementActionsByIdeaId: Record<string, RefinementActionType>;
  executionPlansByIdeaId: Record<string, IdeaExecutionPlan>;
  challengesByIdeaId: Record<string, IdeaChallenge[]>;
  discussionsByIdeaId?: Record<string, IdeaDiscussion[]>;
  activeIdeaId?: string;
  activeMindNodeId?: string;
  mindMapViewport?: MindMapViewportSnapshot;
  lastMixedSeed?: MixedIdeaSeed;
}

export interface StoredIdeaState {
  version: 2;
  workspace?: WorkspaceSnapshot;
  incubatorEntries: IncubatorEntry[];
}

export interface MixedIdeaSeed {
  mixedTopic: string;
  theme: string;
  tension: string;
  startingPrompt: string;
  sourceIdeaTitles: string[];
  createdAt: string;
}

export interface MindNode {
  id: string;
  label: string;
  category: MindNodeCategory;
  level: 0 | 1 | 2 | 3;
  x: number;
  y: number;
  selectable: boolean;
  locked: boolean;
  selected: boolean;
  reason: string;
  source?: string;
  parentId?: string;
  collapsed?: boolean;
  note?: string;
  groupId?: string;
  discussionOrigin?: {
    ideaId: string;
    discussionId: string;
    directionKey: IdeaDiscussionDirectionKey;
    opposite?: boolean;
  };
}

export interface MindNodeGroup {
  id: string;
  name: string;
  nodeIds: string[];
  createdAt: string;
}

export interface MindEdge {
  id: string;
  from: string;
  to: string;
  label: string;
}

export interface MindMapExpansion {
  nodes: MindNode[];
  edges: MindEdge[];
  recommendedNodeIds: string[];
}

export interface CollisionRecommendation {
  selectedWordIds: string[];
  reason: string;
}

export interface BrainstormMap {
  id: string;
  topic: string;
  stuckType: StuckType;
  center: MindNode;
  nodes: MindNode[];
  edges: MindEdge[];
  recommendedNodeIds: string[];
  groups?: MindNodeGroup[];
  createdAt: string;
}
