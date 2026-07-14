// 这个文件验证提示词拼接和上下文压缩，避免把过长输入直接塞给模型。
// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  buildChallengePrompt,
  buildDiscussionPrompt,
  buildDiscussionBranchPrompt,
  buildDiscussionResponsePrompt,
  buildCollisionPrompt,
  buildExpandMindNodePrompt,
  buildIdeasPrompt,
  buildMindMapPrompt,
  buildMixIdeasPrompt,
  buildRefinePrompt,
  buildRerollMindMapPrompt,
  buildTransformPrompt,
  buildWordsPrompt,
  compressText,
} from "./promptBuilder";
import type { BrainstormMap, IdeaDiscussion } from "../src/types/idea";

describe("promptBuilder", () => {
  it("compresses long text with a clear length limit", () => {
    const longText = "灵感".repeat(500);
    const compressed = compressText(longText, 80);

    expect(compressed.length).toBeLessThanOrEqual(81);
    expect(compressed.endsWith("…")).toBe(true);
  });

  it("builds a JSON-only words prompt with human divergence modes", () => {
    const prompt = buildWordsPrompt({ topic: "我想做一个开发者工具", intensity: "狂野" });

    expect(prompt.system).toContain("只输出 JSON");
    expect(prompt.user).toContain("联想扩散");
    expect(prompt.user).toContain("概念融合");
    expect(prompt.user).toContain("六类维度词");
  });

  it("builds a mind map prompt with categories, edges, and stuck type", () => {
    const prompt = buildMindMapPrompt({ topic: "我只会前端，不知道做什么", intensity: "正常" });

    expect(prompt.system).toContain("只输出 JSON");
    expect(prompt.user).toContain("卡住类型");
    expect(prompt.user).toContain("发散思维导图");
    expect(prompt.user).toContain("nodes");
    expect(prompt.user).toContain("edges");
    expect(prompt.user).toContain("远联想");
    expect(prompt.user).toContain("思考动作");
    expect(prompt.user).toContain("不要连续使用同一种思考动作");
    expect(prompt.user).toContain("不要输出黑匣子");
  });

  it("builds a node expansion prompt from the active node path and existing labels", () => {
    const center = {
      id: "center",
      label: "游戏机制产品",
      category: "中心",
      level: 0,
      x: 50,
      y: 50,
      selectable: false,
      locked: true,
      selected: false,
      reason: "中心主题",
    } as const;
    const node = {
      id: "node-emotion",
      label: "不服再来",
      category: "情绪",
      level: 1,
      x: 60,
      y: 40,
      selectable: true,
      locked: false,
      selected: true,
      reason: "核心情绪",
      parentId: center.id,
    } as const;
    const prompt = buildExpandMindNodePrompt({
      topic: "游戏机制产品",
      intensity: "正常",
      map: {
        id: "map",
        topic: "游戏机制产品",
        stuckType: "有兴趣没形态",
        center,
        nodes: [center, node],
        edges: [{ id: "edge", from: center.id, to: node.id, label: "情绪" }],
        recommendedNodeIds: [node.id],
        createdAt: "2026-07-09T00:00:00.000Z",
      },
      nodeId: node.id,
    });

    expect(prompt.user).toContain("当前节点：不服再来");
    expect(prompt.user).toContain("当前路径：游戏机制产品 -> 不服再来");
    expect(prompt.user).toContain("已有节点：游戏机制产品、不服再来");
    expect(prompt.user).toContain("每个维度继续给出 1 个新节点");
    expect(prompt.user).toContain("人群、场景、情绪、物件、结构、限制、远联想");
  });

  it("builds a mind map reroll prompt that preserves locked nodes and asks for replacement ids", () => {
    const center = {
      id: "center",
      label: "开发者工具",
      category: "中心",
      level: 0,
      x: 50,
      y: 50,
      selectable: false,
      locked: true,
      selected: false,
      reason: "中心主题",
    } as const;
    const lockedNode = {
      id: "node-locked",
      label: "独立开发者",
      category: "人群",
      level: 1,
      x: 30,
      y: 40,
      selectable: true,
      locked: true,
      selected: true,
      reason: "保留的人群",
      parentId: center.id,
    } as const;
    const unlockedNode = {
      id: "node-scene",
      label: "深夜",
      category: "场景",
      level: 1,
      x: 45,
      y: 32,
      selectable: true,
      locked: false,
      selected: true,
      reason: "可重掷场景",
      parentId: center.id,
    } as const;

    const prompt = buildRerollMindMapPrompt({
      topic: "开发者工具",
      intensity: "狂野",
      map: {
        id: "map",
        topic: "开发者工具",
        stuckType: "有技术没需求",
        center,
        nodes: [center, lockedNode, unlockedNode],
        edges: [{ id: "edge", from: center.id, to: unlockedNode.id, label: "场景" }],
        recommendedNodeIds: [lockedNode.id, unlockedNode.id],
        createdAt: "2026-07-09T00:00:00.000Z",
      },
    });

    expect(prompt.user).toContain("重掷未锁定节点");
    expect(prompt.user).toContain("锁定节点：人群:独立开发者");
    expect(prompt.user).toContain("需要替换的节点：node-scene");
    expect(prompt.user).toContain("replaceNodeId");
    expect(prompt.user).toContain("不要输出黑匣子");
  });

  it("builds a collision recommendation prompt that must choose from existing words", () => {
    const prompt = buildCollisionPrompt({
      topic: "开发者工具",
      groups: [
        {
          type: "人群",
          label: "人群",
          description: "谁会用",
          words: [
            { id: "crowd-a", text: "独立开发者", groupType: "人群", locked: false, selected: true, source: "AI" },
            { id: "crowd-b", text: "产品经理", groupType: "人群", locked: false, selected: false, source: "AI" },
          ],
        },
        {
          type: "场景",
          label: "场景",
          description: "什么时候",
          words: [{ id: "scene-a", text: "深夜", groupType: "场景", locked: false, selected: true, source: "AI" }],
        },
        {
          type: "情绪",
          label: "情绪",
          description: "什么心理",
          words: [{ id: "emotion-a", text: "烂尾焦虑", groupType: "情绪", locked: false, selected: true, source: "AI" }],
        },
        {
          type: "物件",
          label: "物件",
          description: "什么载体",
          words: [{ id: "object-a", text: "GitHub 仓库", groupType: "物件", locked: false, selected: true, source: "AI" }],
        },
        {
          type: "结构",
          label: "结构",
          description: "什么结构",
          words: [{ id: "structure-a", text: "博物馆", groupType: "结构", locked: false, selected: true, source: "AI" }],
        },
        {
          type: "限制",
          label: "限制",
          description: "什么限制",
          words: [{ id: "limit-a", text: "每天只能 1 分钟", groupType: "限制", locked: false, selected: true, source: "AI" }],
        },
      ],
    });

    expect(prompt.user).toContain("只能从候选词中选择");
    expect(prompt.user).toContain("selections");
    expect(prompt.user).toContain("独立开发者");
    expect(prompt.user).toContain("每天只能 1 分钟");
  });

  it("builds idea and transform prompts with compact source context", () => {
    const sourceWords = [
      { id: "1", text: "独立开发者", groupType: "人群", locked: false, selected: true, source: "test" },
      { id: "2", text: "深夜", groupType: "场景", locked: false, selected: true, source: "test" },
      { id: "3", text: "烂尾焦虑", groupType: "情绪", locked: false, selected: true, source: "test" },
      { id: "4", text: "GitHub 仓库", groupType: "物件", locked: false, selected: true, source: "test" },
      { id: "5", text: "博物馆", groupType: "结构", locked: false, selected: true, source: "test" },
      { id: "6", text: "不能催用户继续做", groupType: "限制", locked: false, selected: true, source: "test" },
    ] as const;
    const ideasPrompt = buildIdeasPrompt({ topic: "项目灵感", sourceWords: [...sourceWords] });
    const transformPrompt = buildTransformPrompt({
      direction: "更游戏化一点",
      idea: {
        id: "idea",
        title: "项目遗迹馆",
        summary: "把废弃仓库做成遗迹。",
        whyInteresting: "它把失败变成可浏览的资产。",
        firstVersion: "扫描仓库并生成展签。",
        sourceWords: [...sourceWords],
        createdAt: "2026-07-07T00:00:00.000Z",
      },
    });

    expect(ideasPrompt.user).toContain("项目灵感");
    expect(ideasPrompt.user).toContain("GitHub 仓库");
    expect(ideasPrompt.user).not.toContain("本次思维动作：");
    expect(ideasPrompt.user).toContain("限制:不能催用户继续做\n\n任务：基于这些词碰撞出 3 到 5 张脑洞卡片。");
    expect(transformPrompt.user).toContain("更游戏化一点");
    expect(transformPrompt.user).toContain("项目遗迹馆");
  });

  it.each([
    ["random", "随机碰撞：打散固定路径，优先连接距离最远的来源词。"],
    ["change-audience", "换个人群：保留核心机制，把目标用户替换成差异明显的另一类人。"],
    ["amplify-emotion", "放大情绪：把来源词里的核心情绪推到更强烈、更具体的时刻。"],
    ["add-constraint", "加一个限制：加入反常识但可执行的限制，让方案产生新形态。"],
    ["borrow-structure", "借用结构：从熟悉的产品、游戏或仪式中借一个结构重新组织来源词。"],
    ["invert-assumption", "反过来做：找出默认假设并将它反转，生成仍然自洽的新方向。"],
  ] as const)("为 %s 碰撞配方追加对应思维动作", (collisionRecipe, expectedAction) => {
    const prompt = buildIdeasPrompt({
      topic: "项目灵感",
      sourceWords: [{ id: "word-1", text: "独立开发者", groupType: "人群", locked: false, selected: true, source: "test" }],
      collisionRecipe,
    });

    expect(prompt.user).toContain(`本次思维动作：${expectedAction}`);
    expect(prompt.user).toContain('"ideas"');
  });

  it("未知碰撞配方会明确校验失败", () => {
    expect(() => buildIdeasPrompt({
      topic: "项目灵感",
      sourceWords: [{ id: "word-1", text: "独立开发者", groupType: "人群", locked: false, selected: true, source: "test" }],
      collisionRecipe: "unknown-recipe" as never,
    })).toThrow("未知碰撞配方");
  });

  it("builds a refinement prompt with vitality, roundtable voices, directions, MVP ladder, and actions", () => {
    const prompt = buildRefinePrompt({
      idea: {
        id: "idea",
        title: "项目遗迹馆",
        summary: "扫描废弃项目并生成展签。",
        whyInteresting: "它把失败经验变成可浏览资产。",
        firstVersion: "先做 GitHub 仓库扫描和卡片生成。",
        sourceWords: [],
        sourcePath: ["开发者工具", "烂尾焦虑", "项目遗迹"],
        createdAt: "2026-07-07T00:00:00.000Z",
      },
    });

    expect(prompt.system).toContain("只输出 JSON");
    expect(prompt.user).toContain("生命力");
    expect(prompt.user).toContain("懒人用户");
    expect(prompt.user).toContain("毒舌用户");
    expect(prompt.user).toContain("产品经理");
    expect(prompt.user).toContain("工程师");
    expect(prompt.user).toContain("测试");
    expect(prompt.user).toContain("商人");
    expect(prompt.user).toContain("玩具版");
    expect(prompt.user).toContain("工具版");
    expect(prompt.user).toContain("产品版");
    expect(prompt.user).toContain("1小时 MVP");
    expect(prompt.user).toContain("1天 MVP");
    expect(prompt.user).toContain("一周版本");
    expect(prompt.user).toContain("继续发散");
    expect(prompt.user).toContain("收束推进");
    expect(prompt.user).toContain("放入孵化箱");
  });

  it("按指定角色构建反共识挑战提示词并要求严格输出", () => {
    const prompt = buildChallengePrompt({
      idea: {
        id: "idea-1",
        title: "项目遗迹馆",
        summary: "扫描废弃项目并生成展签。",
        whyInteresting: "它把失败经验变成可浏览资产。",
        firstVersion: "先做 GitHub 仓库扫描和卡片生成。",
        sourceWords: [],
        createdAt: "2026-07-07T00:00:00.000Z",
      },
      role: "反常识派",
    });

    expect(prompt.system).toContain("只输出 JSON");
    expect(prompt.user).toContain("反常识派");
    expect(prompt.user).toContain("项目遗迹馆");
    expect(prompt.user).toContain("challenge");
    expect(prompt.user).toContain("risk");
    expect(prompt.user).toContain("newDirection");
    expect(prompt.user).toContain("不要赞美");
  });

  it("构建固定四角色三轮讨论提示词", () => {
    const prompt = buildDiscussionPrompt({
      idea: {
        id: "idea-1",
        title: "项目遗迹馆",
        summary: "扫描废弃项目并生成展签。",
        whyInteresting: "把失败经验变成可浏览资产。",
        firstVersion: "先做仓库扫描。",
        sourceWords: [],
        createdAt: "2026-07-07T00:00:00.000Z",
      },
    });

    expect(prompt.system).toContain("只输出 JSON");
    expect(prompt.user).toContain("用户代言人");
    expect(prompt.user).toContain("反常识派");
    expect(prompt.user).toContain("跨界连接者");
    expect(prompt.user).toContain("现实构建者");
    expect(prompt.user).toContain("judgment");
    expect(prompt.user).toContain("collision");
    expect(prompt.user).toContain("synthesis");
    expect(prompt.user).toContain("conservativeDirection");
    expect(prompt.user).toContain("radicalDirection");
    expect(prompt.user).toContain("unexpectedDirection");
  });

  it("构建带用户动作、来源观点和目标角色的介入提示词", () => {
    const idea = { id: "idea-1", title: "项目遗迹馆", summary: "扫描废弃项目", whyInteresting: "把失败变成资产", firstVersion: "先做扫描", sourceWords: [], createdAt: "2026-07-07T00:00:00.000Z" };
    const discussion = { id: "discussion-1", ideaId: idea.id, createdAt: "2026-07-13T00:00:00.000Z", status: "completed", participants: ["用户代言人", "反常识派", "跨界连接者", "现实构建者"], rounds: [], collectedSparkIds: [], interventions: [] } as IdeaDiscussion;
    const prompt = buildDiscussionResponsePrompt({ idea, discussion, type: "disagree", prompt: "我不同意公开失败更有吸引力。", targetRole: "反常识派", sourceRole: "用户代言人", sourceClaim: "用户担心公开羞耻" });

    expect(prompt.user).toContain("不同意");
    expect(prompt.user).toContain("我不同意公开失败更有吸引力");
    expect(prompt.user).toContain("目标角色：反常识派");
    expect(prompt.user).toContain("来源角色：用户代言人");
    expect(prompt.user).toContain("用户担心公开羞耻");
    expect(prompt.user).toContain("1 到 2 条");
    expect(prompt.user).toContain("第一条回应必须来自反常识派");
  });

  it("拒绝为已经介入三次的讨论继续生成回应", () => {
    const idea = { id: "idea-1", title: "项目遗迹馆", summary: "扫描废弃项目", whyInteresting: "把失败变成资产", firstVersion: "先做扫描", sourceWords: [], createdAt: "2026-07-07T00:00:00.000Z" };
    const intervention = { id: "intervention", type: "question", prompt: "追问", targetRole: "用户代言人", responses: [{ role: "用户代言人", claim: "回应", tension: "张力" }], createdAt: "2026-07-14T00:00:00.000Z" } as const;
    const discussion = {
      id: "discussion-1",
      ideaId: idea.id,
      createdAt: "2026-07-13T00:00:00.000Z",
      status: "completed",
      participants: ["用户代言人", "反常识派", "跨界连接者", "现实构建者"],
      rounds: [],
      collectedSparkIds: [],
      interventions: [intervention, { ...intervention, id: "intervention-2" }, { ...intervention, id: "intervention-3" }],
    } as unknown as IdeaDiscussion;

    expect(() => buildDiscussionResponsePrompt({ idea, discussion, type: "question", prompt: "还能继续吗？", targetRole: "用户代言人" })).toThrow("最多介入三次");
  });

  it("把完整收束方向和当前导图写入分支提示词", () => {
    const idea = { id: "idea-1", title: "项目遗迹馆", summary: "扫描废弃项目", whyInteresting: "把失败变成资产", firstVersion: "先做扫描", sourceWords: [], createdAt: "2026-07-07T00:00:00.000Z" };
    const center = { id: "center", label: "项目灵感", category: "中心", level: 0, x: 50, y: 50, selectable: false, locked: true, selected: false, reason: "中心主题" } as const;
    const map = { id: "map", topic: "项目灵感", stuckType: "有兴趣没形态", center, nodes: [center], edges: [], recommendedNodeIds: [], createdAt: "2026-07-13T00:00:00.000Z" } as unknown as BrainstormMap;
    const discussion = { id: "discussion-1", ideaId: idea.id, createdAt: "2026-07-13T00:00:00.000Z", status: "completed", participants: ["用户代言人", "反常识派", "跨界连接者", "现实构建者"], rounds: [], synthesis: { conservativeDirection: { title: "轻量版", description: "私密复盘", nextStep: "先做表单" }, radicalDirection: { title: "激进版", description: "公开展览", nextStep: "做展厅" }, unexpectedDirection: { title: "意外版", description: "借用考古仪式", nextStep: "画展签流程" } }, collectedSparkIds: [], interventions: [] } as const;
    const prompt = buildDiscussionBranchPrompt({ idea, discussion: discussion as unknown as IdeaDiscussion, directionKey: "unexpectedDirection", map, parentNodeId: center.id });

    expect(prompt.user).toContain("意外版");
    expect(prompt.user).toContain("借用考古仪式");
    expect(prompt.user).toContain("画展签流程");
    expect(prompt.user).toContain("当前导图：项目灵感");
    expect(prompt.user).toContain("已有节点：项目灵感");
    expect(prompt.user).toContain("4 到 6 个");
  });

  it("builds a mix ideas prompt from 2-3 incubated ideas", () => {
    const prompt = buildMixIdeasPrompt({
      ideas: [
        {
          id: "idea-1",
          title: "项目遗迹馆",
          summary: "扫描废弃项目并生成展签。",
          whyInteresting: "它把失败经验变成可浏览资产。",
          firstVersion: "先做 GitHub 仓库扫描。",
          sourceWords: [],
          sourcePath: ["开发者工具", "烂尾焦虑", "项目遗迹"],
          createdAt: "2026-07-07T00:00:00.000Z",
        },
        {
          id: "idea-2",
          title: "灵感潮汐钟",
          summary: "把一天中的注意力波动变成创意窗口。",
          whyInteresting: "它让创意节奏有了可感知形状。",
          firstVersion: "先做手动记录和提醒。",
          sourceWords: [],
          sourcePath: ["创作工具", "注意力", "潮汐"],
          createdAt: "2026-07-07T00:00:00.000Z",
        },
      ],
    });

    expect(prompt.system).toContain("只输出 JSON");
    expect(prompt.user).toContain("混合");
    expect(prompt.user).toContain("共同母题");
    expect(prompt.user).toContain("mixedTopic");
    expect(prompt.user).toContain("项目遗迹馆");
    expect(prompt.user).toContain("灵感潮汐钟");
  });
});
