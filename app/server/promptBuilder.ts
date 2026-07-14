// 这个文件负责把用户输入、当前词组和脑洞压缩后拼成模型提示词。
import { IDEA_DISCUSSION_ROLES, isIdeaChallengeRole, isIdeaDiscussionDirectionKey, isIdeaDiscussionInterventionType } from "../src/types/idea";
import type { BrainstormMap, CollisionRecipeId, DimensionGroup, DimensionWord, IdeaCard, IdeaChallengeRole, IdeaDiscussion, IdeaDiscussionDirectionKey, IdeaDiscussionInterventionType, IdeaDiscussionRole, IdeaDiscussionSetup, Intensity, MindNode, TransformDirection } from "../src/types/idea";

export interface ChatPrompt {
  system: string;
  user: string;
}

interface WordsPromptRequest {
  topic: string;
  intensity: Intensity;
}

interface MindMapPromptRequest {
  topic: string;
  intensity: Intensity;
}

interface ExpandMindNodePromptRequest {
  topic: string;
  intensity: Intensity;
  map: BrainstormMap;
  nodeId: string;
}

interface RerollMindMapPromptRequest {
  topic: string;
  intensity: Intensity;
  map: BrainstormMap;
}

interface CollisionPromptRequest {
  topic: string;
  groups: DimensionGroup[];
}

interface IdeasPromptRequest {
  topic: string;
  sourceWords: DimensionWord[];
  collisionRecipe?: CollisionRecipeId;
}

interface TransformPromptRequest {
  idea: IdeaCard;
  direction: TransformDirection;
}

interface RefinePromptRequest {
  idea: IdeaCard;
}

interface ChallengePromptRequest {
  idea: IdeaCard;
  role: IdeaChallengeRole;
}

export interface DiscussionPromptRequest {
  idea: IdeaCard;
  setup?: IdeaDiscussionSetup;
}

export interface DiscussionResponsePromptRequest {
  idea: IdeaCard;
  discussion: IdeaDiscussion;
  type: IdeaDiscussionInterventionType;
  prompt: string;
  targetRole: IdeaDiscussionRole;
  sourceRole?: IdeaDiscussionRole;
  sourceClaim?: string;
}

export interface DiscussionBranchPromptRequest {
  idea: IdeaCard;
  discussion: IdeaDiscussion;
  directionKey: IdeaDiscussionDirectionKey;
  opposite?: boolean;
  map: BrainstormMap;
  parentNodeId: string;
}

interface MixIdeasPromptRequest {
  ideas: IdeaCard[];
}

const SYSTEM_PROMPT = [
  "你是脑洞实验室的 AI 创意引擎。",
  "你模拟人类发散思维：联想扩散、类比迁移、概念融合、约束变形、反转、角色切换。",
  "发散阶段不要做市场评分，不要输出竞品分析，不要把所有想法压成普通 SaaS。",
  "只输出 JSON，不要 Markdown，不要解释，不要代码块。",
].join("\n");

const COLLISION_RECIPE_ACTIONS: Record<CollisionRecipeId, string> = {
  random: "随机碰撞：打散固定路径，优先连接距离最远的来源词。",
  "change-audience": "换个人群：保留核心机制，把目标用户替换成差异明显的另一类人。",
  "amplify-emotion": "放大情绪：把来源词里的核心情绪推到更强烈、更具体的时刻。",
  "add-constraint": "加一个限制：加入反常识但可执行的限制，让方案产生新形态。",
  "borrow-structure": "借用结构：从熟悉的产品、游戏或仪式中借一个结构重新组织来源词。",
  "invert-assumption": "反过来做：找出默认假设并将它反转，生成仍然自洽的新方向。",
};

const CHALLENGE_ROLE_GUIDANCE: Record<IdeaChallengeRole, string> = {
  懒人用户: "只关心是否能立刻开始，专门攻击步骤过多、理解成本和首次使用摩擦。",
  毒舌用户: "拒绝礼貌包装，专门指出方案无聊、自嗨、同质化或没有新增价值的地方。",
  极端用户: "把使用频率、数据规模、环境限制或情绪强度推到极端，寻找最先崩坏的位置。",
  工程师: "检查技术边界、依赖、失败路径和被低估的实现成本，但不能只说做不了。",
  反常识派: "找出方案默认成立的核心假设并反转它，提出仍能自洽的新方向。",
};

// 读取碰撞配方对应的思维动作，并拒绝绕过类型系统的未知值。
function readCollisionRecipeAction(collisionRecipe?: CollisionRecipeId): string | undefined {
  if (collisionRecipe === undefined) {
    return undefined;
  }
  const action = COLLISION_RECIPE_ACTIONS[collisionRecipe];
  if (!action) {
    throw new Error("未知碰撞配方");
  }
  return action;
}

// 压缩长文本，保留前部语义，避免 prompt 被无效上下文撑爆。
export function compressText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1))}…`;
}

// 压缩词组上下文，只保留类型和文本。
function compactWords(words: DimensionWord[]): string {
  return words.map((word) => `${word.groupType}:${compressText(word.text, 40)}`).join("；");
}

// 压缩脑洞卡片上下文。
function compactIdea(idea: IdeaCard): string {
  return [
    `标题:${compressText(idea.title, 80)}`,
    `解释:${compressText(idea.summary, 160)}`,
    `有趣点:${compressText(idea.whyInteresting, 160)}`,
    `第一版:${compressText(idea.firstVersion, 160)}`,
    `来源词:${compactWords(idea.sourceWords)}`,
  ].join("\n");
}

function traceMindNodePath(map: BrainstormMap, nodeId: string): MindNode[] {
  const nodeById = new Map(map.nodes.map((node) => [node.id, node]));
  const path: MindNode[] = [];
  let current = nodeById.get(nodeId);
  const visited = new Set<string>();

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.unshift(current);
    current = current.parentId ? nodeById.get(current.parentId) : undefined;
  }

  if (path[0]?.id !== map.center.id) {
    path.unshift(map.center);
  }

  return path;
}

function compactMindNode(node: MindNode): string {
  return `${node.category}:${compressText(node.label, 24)}(${compressText(node.reason, 48)})`;
}

function compactMindNodeWithId(node: MindNode): string {
  return `${node.id} | ${node.category}:${compressText(node.label, 24)} | ${compressText(node.reason, 60)}`;
}

function compactCollisionGroup(group: DimensionGroup): string {
  const words = group.words.map((word) => `${word.text}${word.locked ? "(锁定)" : ""}${word.selected ? "(当前选中)" : ""}`).join("、");
  return `${group.type}：${words}`;
}

// 生成维度词提示词。
export function buildWordsPrompt(request: WordsPromptRequest): ChatPrompt {
  return {
    system: SYSTEM_PROMPT,
    user: [
      `用户主题：${compressText(request.topic, 300)}`,
      `发散强度：${request.intensity}`,
      "",
      "任务：生成六类维度词，每类 8 个词。必须体现人类脑洞方式：联想扩散、类比迁移、概念融合、反转、约束变形。",
      "六类维度词：人群、场景、情绪、物件、结构、限制。",
      "词要具体、有画面感，避免商业套话。",
      "",
      "输出 JSON 格式：",
      '{"groups":[{"type":"人群","words":[{"text":"独立开发者","source":"联想扩散"}]}]}',
    ].join("\n"),
  };
}

// 生成发散思维导图提示词。
export function buildMindMapPrompt(request: MindMapPromptRequest): ChatPrompt {
  return {
    system: SYSTEM_PROMPT,
    user: [
      `用户主题：${compressText(request.topic, 300)}`,
      `发散强度：${request.intensity}`,
      "",
      "任务：生成一张发散思维导图，帮助用户从模糊想法进入脑暴状态。",
      "先判断用户卡住类型，只能使用：没方向、有技术没需求、有兴趣没形态、有产品没差异化。",
      "导图必须包含 nodes、edges、recommendedNodeLabels。",
      "节点分类只能使用：人群、场景、情绪、物件、结构、限制、远联想。",
      "每个分类 3 到 4 个节点，节点要短、具体、有画面感。",
      "用“思考动作”生成节点：换人群、换场景、放大情绪、找载体、借结构、加限制、远距类比、反过来想、隐藏机制。",
      "节点 label 只写结果词，不写方法名；reason 可以解释思考动作。",
      "不要连续使用同一种思考动作，不要把父节点完整标题拼进子节点。",
      "不要输出黑匣子、黑盒、反面需求的反面需求这类内部术语或递归套娃词。",
      "edges 表示联想路径，from/to 可以用节点 label。recommendedNodeLabels 选择 6 个最适合碰撞的节点。",
      "",
      "输出 JSON 格式：",
      '{"stuckType":"有技术没需求","nodes":[{"label":"独立开发者","category":"人群","level":1,"reason":"谁可能需要"}],"edges":[{"from":"中心","to":"独立开发者","label":"谁会用"}],"recommendedNodeLabels":["独立开发者"]}',
    ].join("\n"),
  };
}

// 根据当前选中节点继续让 LLM 扩展不同维度的新节点。
export function buildExpandMindNodePrompt(request: ExpandMindNodePromptRequest): ChatPrompt {
  const activeNode = request.map.nodes.find((node) => node.id === request.nodeId);
  if (!activeNode) {
    throw new Error("当前节点不存在");
  }

  const path = traceMindNodePath(request.map, request.nodeId);
  const existingLabels = Array.from(new Set(request.map.nodes.map((node) => compressText(node.label, 24)))).slice(0, 80);
  const nearbyNodes = request.map.nodes
    .filter((node) => node.id === activeNode.parentId || node.parentId === activeNode.id || node.selected)
    .slice(0, 18)
    .map(compactMindNode);

  return {
    system: SYSTEM_PROMPT,
    user: [
      `用户主题：${compressText(request.topic, 300)}`,
      `发散强度：${request.intensity}`,
      `当前节点：${compressText(activeNode.label, 80)}`,
      `当前节点维度：${activeNode.category}`,
      `当前路径：${path.map((node) => compressText(node.label, 40)).join(" -> ")}`,
      `当前节点解释：${compressText(activeNode.reason, 180)}`,
      `已有节点：${existingLabels.join("、")}`,
      nearbyNodes.length ? `邻近节点：${nearbyNodes.join("；")}` : "",
      "",
      "任务：围绕当前节点继续发散，但不要只做同一种远距类比。",
      "每个维度继续给出 1 个新节点，优先覆盖：人群、场景、情绪、物件、结构、限制、远联想。",
      "新节点必须基于当前节点和路径，不要脱离用户主题。",
      "不要重复已有节点，不要输出黑匣子、黑盒、反面需求的反面需求这类内部术语或递归套娃词。",
      "label 必须是 2 到 12 个字的结果词；category 只能是：人群、场景、情绪、物件、结构、限制、远联想。",
      "reason 用一句话说明从当前节点如何跳到这个新节点。",
      "source 写用户能理解的思考动作，例如：换人群、换场景、放大情绪、找载体、借结构、加限制、远距类比、反过来想、隐藏机制。",
      "recommendedNodeLabels 选择 2 到 4 个最适合继续碰撞的新增节点。",
      "",
      "输出 JSON 格式：",
      '{"nodes":[{"label":"撤销按钮","category":"物件","level":2,"reason":"从反向使用找到可操作载体","source":"找载体"}],"recommendedNodeLabels":["撤销按钮"]}',
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

// 重掷未锁定导图节点，锁定节点和中心主题必须原样保留。
export function buildRerollMindMapPrompt(request: RerollMindMapPromptRequest): ChatPrompt {
  const lockedNodes = request.map.nodes.filter((node) => node.selectable && node.locked && node.category !== "中心");
  const unlockedNodes = request.map.nodes.filter((node) => node.selectable && !node.locked && node.category !== "中心");
  const existingLabels = Array.from(new Set(request.map.nodes.map((node) => compressText(node.label, 24)))).slice(0, 80);

  return {
    system: SYSTEM_PROMPT,
    user: [
      `用户主题：${compressText(request.topic, 300)}`,
      `发散强度：${request.intensity}`,
      `卡住类型：${request.map.stuckType}`,
      `中心主题：${compressText(request.map.center.label, 80)}`,
      `锁定节点：${lockedNodes.map((node) => `${node.category}:${compressText(node.label, 24)}`).join("；") || "无"}`,
      `已有节点：${existingLabels.join("、")}`,
      `需要替换的节点：${unlockedNodes.map(compactMindNodeWithId).join("；") || "无"}`,
      "",
      "任务：重掷未锁定节点。只替换“需要替换的节点”，中心主题和锁定节点必须原样保留。",
      "每个需要替换的节点都必须返回一个 replacement，replaceNodeId 必须等于原节点 id。",
      "保持原节点大致维度，不要把所有节点都推成远距类比；要覆盖人群、场景、情绪、物件、结构、限制、远联想之间的差异。",
      "新 label 必须短、具体、有画面感，不要重复已有节点，不要输出黑匣子、黑盒、反面需求的反面需求这类内部术语或递归套娃词。",
      "reason 用一句话解释为什么这个替换能让脑洞更发散；source 写用户能理解的思考动作。",
      "recommendedNodeIds 选择 4 到 8 个最适合继续碰撞的节点 id，可以包含锁定节点。",
      "",
      "输出 JSON 格式：",
      '{"nodes":[{"replaceNodeId":"node-1","label":"发布前一小时","category":"场景","reason":"把场景推到更紧张的时刻","source":"换场景"}],"recommendedNodeIds":["node-1"]}',
    ].join("\n"),
  };
}

// 让 LLM 从已有维度词里选一组更有张力的碰撞组合。
export function buildCollisionPrompt(request: CollisionPromptRequest): ChatPrompt {
  return {
    system: SYSTEM_PROMPT,
    user: [
      `用户主题：${compressText(request.topic, 300)}`,
      "候选词：",
      request.groups.map(compactCollisionGroup).join("\n"),
      "",
      "任务：从每个维度选择 1 个词，组成一组最适合碰撞出项目脑洞的组合。",
      "只能从候选词中选择，不能改写候选词，不能新增词。",
      "优先选择有张力的组合：具体人群 + 具体时刻 + 强情绪 + 可操作载体 + 借来的结构 + 反常识限制。",
      "如果某个词标记为锁定，必须选择这个锁定词。",
      "",
      "输出 JSON 格式：",
      '{"selections":[{"groupType":"人群","text":"独立开发者"}],"reason":"这组词的角色、场景和限制之间有明显张力。"}',
    ].join("\n"),
  };
}

// 生成脑洞卡片提示词。
export function buildIdeasPrompt(request: IdeasPromptRequest): ChatPrompt {
  const collisionRecipeAction = readCollisionRecipeAction(request.collisionRecipe);
  const collisionRecipeLines = collisionRecipeAction ? [`本次思维动作：${collisionRecipeAction}`] : [];
  return {
    system: SYSTEM_PROMPT,
    user: [
      `用户主题：${compressText(request.topic, 300)}`,
      `当前碰撞词：${compactWords(request.sourceWords)}`,
      ...collisionRecipeLines,
      "",
      "任务：基于这些词碰撞出 3 到 5 张脑洞卡片。",
      "每张卡片要像一个可继续思考的项目原胚，不要写成商业计划书。",
      "必须能看出词与词之间的碰撞关系。",
      "",
      "输出 JSON 格式：",
      '{"ideas":[{"title":"项目遗迹馆","summary":"一句话解释","whyInteresting":"为什么有趣","firstVersion":"第一版怎么做"}]}',
    ].join("\n"),
  };
}

// 生成脑洞变形提示词。
export function buildTransformPrompt(request: TransformPromptRequest): ChatPrompt {
  return {
    system: SYSTEM_PROMPT,
    user: [
      `变形方向：${request.direction}`,
      "原脑洞：",
      compactIdea(request.idea),
      "",
      "任务：沿着指定方向生成一张新的脑洞卡片，保留原始隐喻和来源词，但让形态明显变化。",
      "",
      "输出 JSON 格式：",
      '{"idea":{"title":"项目遗迹馆 · 更游戏化一点","summary":"一句话解释","whyInteresting":"为什么有趣","firstVersion":"第一版怎么做"}}',
    ].join("\n"),
  };
}

// 生成脑洞炼化提示词。
export function buildRefinePrompt(request: RefinePromptRequest): ChatPrompt {
  return {
    system: SYSTEM_PROMPT,
    user: [
      "原脑洞：",
      compactIdea(request.idea),
      request.idea.sourcePath?.length ? `来源路径：${request.idea.sourcePath.map((item) => compressText(item, 50)).join(" -> ")}` : "",
      "",
      "任务：把这张脑洞卡片炼化成一个可开始执行的项目原胚。",
      "先分析脑洞的生命力，不要做冷冰冰的市场评分，不要写竞品分析。",
      "然后用人类视角圆桌轻评审，每个角色只说一句关键反馈，像脑内小剧场。",
      "圆桌角色必须包含：懒人用户、毒舌用户、产品经理、工程师、测试、商人。",
      "再输出三种落地方向：玩具版、工具版、产品版。",
      "最后输出执行梯度：1小时 MVP、1天 MVP、一周版本，并给出三个动作：继续发散、收束推进、放入孵化箱。",
      "",
      "输出 JSON 格式：",
      '{"refinement":{"vitality":{"targetUser":"谁最先会被击中","triggerScene":"什么时刻会想用","coreEmotion":"核心情绪","existingAlternative":"现在会怎么凑合","smallestPlayableVersion":"最小可玩版本"},"roundtable":[{"role":"懒人用户","feedback":"一句关键反馈"}],"directions":[{"type":"玩具版","title":"方向名","description":"怎么落地","firstStep":"第一步"}],"mvpLadder":[{"horizon":"1小时 MVP","goal":"验证什么","build":"做什么","proof":"看到什么算有戏"}],"actions":[{"type":"继续发散","label":"继续发散","description":"下一步含义"}]}}',
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

// 生成单角色反共识挑战提示词。
export function buildChallengePrompt(request: ChallengePromptRequest): ChatPrompt {
  if (!isIdeaChallengeRole(request.role)) {
    throw new Error("未知挑战角色");
  }
  return {
    system: SYSTEM_PROMPT,
    user: [
      `挑战角色：${request.role}`,
      `角色视角：${CHALLENGE_ROLE_GUIDANCE[request.role]}`,
      "原脑洞：",
      compactIdea(request.idea),
      "",
      "任务：站在指定角色立场做一次反共识挑战。不要赞美，不要重复脑洞原文，也不要给笼统建议。",
      "challenge 必须指出一个具体且可争辩的错误假设；risk 必须说明继续照做会发生什么；newDirection 必须给出由该质疑推导出的新方向。",
      "",
      "输出 JSON 格式：",
      '{"challenge":{"challenge":"最尖锐的具体质疑","risk":"继续照做的实际风险","newDirection":"由质疑推导出的新方向"}}',
    ].join("\n"),
  };
}

const DISCUSSION_MECHANISM_GUIDANCE: Record<IdeaDiscussionSetup["mechanism"], string> = {
  relay: "接力：后一个角色必须基于前一个角色继续发展，不允许重新起题。",
  refute: "反驳：每个角色必须指出上一条观点的漏洞，并给出替代判断。",
  vote: "站队：角色必须明确支持一个方向，并说明不选择其他方向的原因。",
  trade: "交易：每个角色必须放弃一个条件，换取一个新的可能性。",
  extreme: "极端假设：把预算为零、用户翻十倍或关键技术不可用作为压力条件。",
};

// 为用户选择的思考阵容和讨论机制生成三轮结构化提示词。
export function buildDiscussionPrompt(request: DiscussionPromptRequest): ChatPrompt {
  const setup = request.setup ?? { lineup: "standard", mechanism: "relay", participants: ["用户代言人", "反常识派", "跨界连接者", "现实构建者"] } satisfies IdeaDiscussionSetup;
  const roles = setup.participants.join("、");
  return {
    system: SYSTEM_PROMPT,
    user: [
      `本场讨论角色为：${roles}。只能使用这些角色。`,
      `本场思维机制：${DISCUSSION_MECHANISM_GUIDANCE[setup.mechanism]}`,
      "讨论必须分成三轮，顺序严格为 judgment、collision、synthesis。",
      "第一轮 judgment：每个角色给出一个判断；第二轮 collision：按照本场思维机制互相推动并产生可继续发展的火花；第三轮 synthesis：把讨论收束成三个方向。",
      "每条 contribution 必须包含 role、claim、tension；spark 是可选对象（id、text），buildsOn 是可选的已有火花 id。不要输出空字符串。",
      "synthesis 必须同时包含 conservativeDirection、radicalDirection、unexpectedDirection，每个方向包含 title、description、nextStep。",
      "原脑洞：",
      compactIdea(request.idea),
      "",
      "只输出 JSON，不要 Markdown。",
      '{"discussion":{"rounds":[{"type":"judgment","contributions":[{"role":"用户代言人","claim":"具体判断","tension":"真实张力","spark":{"id":"spark-1","text":"可采集火花"}}]},{"type":"collision","contributions":[{"role":"反常识派","claim":"冲突后的判断","tension":"冲突张力","buildsOn":"spark-1"}]},{"type":"synthesis","contributions":[{"role":"现实构建者","claim":"收束判断","tension":"执行张力"}]}],"synthesis":{"conservativeDirection":{"title":"轻量方向","description":"描述","nextStep":"下一步"},"radicalDirection":{"title":"激进方向","description":"描述","nextStep":"下一步"},"unexpectedDirection":{"title":"意外方向","description":"描述","nextStep":"下一步"}}}}',
    ].join("\n"),
  };
}

const DISCUSSION_ACTION_LABELS: Record<IdeaDiscussionInterventionType, string> = {
  question: "追问",
  disagree: "不同意",
  add: "补充",
};

// 为一次有限用户介入生成角色回应提示词。
export function buildDiscussionResponsePrompt(request: DiscussionResponsePromptRequest): ChatPrompt {
  if ((request.discussion.interventions?.length ?? 0) >= 3) {
    throw new Error("每场讨论最多介入三次");
  }
  if (!isIdeaDiscussionInterventionType(request.type)) {
    throw new Error("未知讨论介入动作");
  }
  if (!IDEA_DISCUSSION_ROLES.includes(request.targetRole)) {
    throw new Error("未知讨论目标角色");
  }
  const sourceContext = [
    request.sourceRole ? `来源角色：${request.sourceRole}` : "",
    request.sourceClaim ? `来源观点：${compressText(request.sourceClaim, 180)}` : "",
  ].filter(Boolean);
  return {
    system: SYSTEM_PROMPT,
    user: [
      `用户动作：${DISCUSSION_ACTION_LABELS[request.type]}`,
      `用户输入：${compressText(request.prompt, 180)}`,
      `目标角色：${request.targetRole}`,
      ...sourceContext,
      "原脑洞：",
      compactIdea(request.idea),
      `讨论编号：${request.discussion.id}`,
      `任务：生成 1 到 2 条短回应，第一条回应必须来自${request.targetRole}；第二条可由另一固定角色补充，但角色不能重复。`,
      "每条回应只包含 role、claim、tension；不要开启新一轮无限对话。",
      "只输出 JSON，不要 Markdown。",
      `{"responses":[{"role":"${request.targetRole}","claim":"直接回应用户","tension":"由回应带来的新张力"}]}`,
    ].join("\n"),
  };
}

// 把一个完整收束方向转成 4 到 6 个可落入当前画布的新节点。
export function buildDiscussionBranchPrompt(request: DiscussionBranchPromptRequest): ChatPrompt {
  if (!isIdeaDiscussionDirectionKey(request.directionKey)) {
    throw new Error("未知讨论方向");
  }
  const direction = request.discussion.synthesis?.[request.directionKey];
  if (!direction) {
    throw new Error("讨论缺少所选收束方向");
  }
  const parent = request.map.nodes.find((node) => node.id === request.parentNodeId);
  if (!parent) {
    throw new Error("分支父节点不存在");
  }
  return {
    system: SYSTEM_PROMPT,
    user: [
      "原脑洞：",
      compactIdea(request.idea),
      `所选方向：${direction.title}`,
      `方向描述：${direction.description}`,
      `下一步：${direction.nextStep}`,
      request.opposite ? "本次任务不是延伸原方向，而是保留其核心问题，生成一个逻辑自洽、明显相反的对立方向。" : "本次任务沿原方向继续发展。",
      `当前导图：${request.map.topic}`,
      `分支父节点：${compactMindNode(parent)}`,
      `已有节点：${request.map.nodes.map((node) => compressText(node.label, 24)).join("、")}`,
      "任务：沿所选方向生成 4 到 6 个短节点。每个节点必须是具体关键词或短语，并包含 label、category、level、reason、source。",
      "不要重复已有节点，不要生成总结或报告。",
      "只输出 JSON，不要 Markdown。",
      '{"nodes":[{"label":"新节点","category":"远联想","level":2,"reason":"与所选方向的关系","source":"讨论方向"}],"recommendedNodeLabels":["新节点"]}',
    ].join("\n"),
  };
}

// 生成孵化箱脑洞混合提示词。
export function buildMixIdeasPrompt(request: MixIdeasPromptRequest): ChatPrompt {
  const compactedIdeas = request.ideas
    .slice(0, 3)
    .map((idea, index) => [`想法 ${index + 1}:`, compactIdea(idea), idea.sourcePath?.length ? `来源路径:${idea.sourcePath.map((item) => compressText(item, 50)).join(" -> ")}` : ""].filter(Boolean).join("\n"))
    .join("\n\n");

  return {
    system: SYSTEM_PROMPT,
    user: [
      "孵化箱里被选中的旧想法：",
      compactedIdeas,
      "",
      "任务：把这些旧想法混合成一个新的发散起点。",
      "不要平均拼接标题，要找共同母题、核心张力和一个能重新丢回实验台的 mixedTopic。",
      "mixedTopic 要短、有画面感，适合作为新的主输入生成发散思维导图。",
      "startingPrompt 是给用户看的新起点句子，可以稍微具体一点。",
      "",
      "输出 JSON 格式：",
      '{"mixedTopic":"失败作品集博物馆","theme":"共同母题","tension":"两个旧想法之间的张力","startingPrompt":"可以直接放回输入框的新主题句","sourceIdeaTitles":["项目遗迹馆","灵感潮汐钟"]}',
    ].join("\n"),
  };
}
