// 这个文件验证模型输出解析和结构校验，避免脏 JSON 进入前端。
// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  normalizeBrainstormMap,
  normalizeCollisionRecommendation,
  normalizeIdeaChallenge,
  normalizeIdeaDiscussion,
  normalizeIdeaDiscussionIntervention,
  normalizeDiscussionBranchExpansion,
  normalizeIdeaCards,
  normalizeIdeaRefinement,
  normalizeMindMapExpansion,
  normalizeMindMapReroll,
  normalizeMixedIdeaSeed,
  normalizeWordGroups,
  parseModelJson,
} from "./modelOutput";
import type { BrainstormMap } from "../src/types/idea";

describe("modelOutput", () => {
  it("parses JSON from fenced model output", () => {
    const parsed = parseModelJson("```json\n{\"ok\":true}\n```");

    expect(parsed).toEqual({ ok: true });
  });

  it("normalizes word groups into app-ready dimension groups", () => {
    const groups = normalizeWordGroups({
      groups: [
        { type: "人群", words: [{ text: "独立开发者", source: "联想扩散" }] },
        { type: "场景", words: [{ text: "深夜", source: "场景联想" }] },
        { type: "情绪", words: [{ text: "烂尾焦虑", source: "情绪抽取" }] },
        { type: "物件", words: [{ text: "GitHub 仓库", source: "物件映射" }] },
        { type: "结构", words: [{ text: "博物馆", source: "类比迁移" }] },
        { type: "限制", words: [{ text: "只能提问", source: "约束变形" }] },
      ],
    });

    expect(groups).toHaveLength(6);
    expect(groups[0]?.words[0]?.selected).toBe(true);
    expect(groups[0]?.words[0]?.source).toBe("联想扩散");
  });

  it("normalizes a brainstorm map into app-ready nodes and edges", () => {
    const map = normalizeBrainstormMap(
      {
        stuckType: "有技术没需求",
        nodes: [
          { label: "独立开发者", category: "人群", level: 1, reason: "最容易自用" },
          { label: "深夜", category: "场景", level: 1, reason: "灵感枯竭常发生" },
          { label: "项目遗迹", category: "远联想", level: 2, reason: "从烂尾跳到考古" },
        ],
        edges: [
          { from: "中心", to: "独立开发者", label: "谁会用" },
          { from: "独立开发者", to: "项目遗迹", label: "远联想" },
        ],
        recommendedNodeLabels: ["独立开发者", "深夜", "项目遗迹"],
      },
      "开发者工具",
    );

    expect(map.center.label).toBe("开发者工具");
    expect(map.nodes[0]?.category).toBe("中心");
    expect(map.nodes.some((node) => node.label === "项目遗迹" && node.category === "远联想")).toBe(true);
    expect(map.edges.length).toBeGreaterThanOrEqual(2);
    expect(map.recommendedNodeIds.length).toBe(3);
  });

  it("spreads a dense initial map across the whole canvas", () => {
    const map = normalizeBrainstormMap(
      {
        nodes: Array.from({ length: 24 }, (_, index) => ({
          label: `节点${index + 1}`,
          category: index % 2 === 0 ? "场景" : "物件",
          level: index % 3 === 0 ? 2 : 1,
        })),
      },
      "密集主题",
    );
    const branchNodes = map.nodes.filter((node) => node.selectable);

    expect(Math.min(...branchNodes.map((node) => node.x))).toBeGreaterThanOrEqual(12);
    expect(Math.max(...branchNodes.map((node) => node.x))).toBeGreaterThan(75);
    expect(Math.max(...branchNodes.map((node) => node.x))).toBeLessThanOrEqual(87);
    expect(Math.min(...branchNodes.map((node) => node.y))).toBeGreaterThanOrEqual(20);
    expect(Math.max(...branchNodes.map((node) => node.y))).toBeLessThanOrEqual(80);
    expect(Math.min(...branchNodes.map((node) => node.y))).toBeLessThanOrEqual(21);
    expect(Math.max(...branchNodes.map((node) => node.y))).toBeGreaterThanOrEqual(79);
  });

  it("keeps mixed long-label nodes from overlapping after normalization", () => {
    const categories = ["人群", "场景", "情绪", "物件", "结构", "限制", "远联想"] as const;
    const map = normalizeBrainstormMap(
      {
        nodes: Array.from({ length: 28 }, (_, index) => ({
          label: index % 3 === 0 ? `很长的发散节点标签${index}` : `节点${index}`,
          category: categories[index % categories.length],
          level: (index % 3) + 1,
        })),
      },
      "密集主题",
    );
    const branchNodes = map.nodes.filter((node) => node.selectable);

    for (let leftIndex = 0; leftIndex < branchNodes.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < branchNodes.length; rightIndex += 1) {
        const left = branchNodes[leftIndex];
        const right = branchNodes[rightIndex];
        if (!left || !right) {
          continue;
        }
        const width = (label: string): number => Math.min(15, Math.max(9, 7.5 + Array.from(label).length * 0.55));
        const horizontalGap = Math.abs(left.x - right.x);
        const verticalGap = Math.abs(left.y - right.y);
        expect(horizontalGap >= (width(left.label) + width(right.label)) / 2 + 0.8 || verticalGap >= 6.2).toBe(true);
      }
    }
  });

  it("limits oversized model output to 28 branch nodes", () => {
    const map = normalizeBrainstormMap(
      {
        nodes: Array.from({ length: 40 }, (_, index) => ({
          label: `超量节点${index}`,
          category: index % 2 === 0 ? "场景" : "物件",
          level: (index % 3) + 1,
        })),
      },
      "超量主题",
    );

    expect(map.nodes.filter((node) => node.selectable)).toHaveLength(28);
  });

  it("assigns initial node parentIds from valid explicit parents, edges, or the center fallback", () => {
    const map = normalizeBrainstormMap(
      {
        stuckType: "没方向",
        nodes: [
          { label: "创作者", category: "人群", level: 1 },
          { label: "深夜", category: "场景", level: 1 },
          { label: "灵感枯竭", category: "情绪", level: 2 },
          { label: "月相钟", category: "物件", level: 2, parentId: "深夜" },
          { label: "无效父节点", category: "限制", level: 2, parentId: "不存在" },
        ],
        edges: [
          { from: "中心", to: "创作者" },
          { from: "创作者", to: "灵感枯竭" },
          { from: "创作者", to: "月相钟" },
        ],
        recommendedNodeLabels: ["灵感枯竭"],
      },
      "创意工具",
    );

    const nodeByLabel = new Map(map.nodes.map((node) => [node.label, node]));
    expect(nodeByLabel.get("创作者")?.parentId).toBe(map.center.id);
    expect(nodeByLabel.get("灵感枯竭")?.parentId).toBe(nodeByLabel.get("创作者")?.id);
    expect(nodeByLabel.get("月相钟")?.parentId).toBe(nodeByLabel.get("深夜")?.id);
    expect(nodeByLabel.get("无效父节点")?.parentId).toBe(map.center.id);
  });

  it("normalizes non-center level zero nodes to at least level one", () => {
    const map = normalizeBrainstormMap(
      {
        nodes: [{ label: "错误层级节点", category: "场景", level: 0 }],
      },
      "层级主题",
    );

    expect(map.nodes.find((node) => node.selectable)?.level).toBe(1);
  });

  it("cleans recursive brainstorm labels and internal method jargon", () => {
    const map = normalizeBrainstormMap(
      {
        stuckType: "有兴趣没形态",
        nodes: [
          {
            label: "团队任务的反面需求的反面需求的反面需求",
            category: "远联想",
            level: 3,
            reason: "黑匣子视角",
            source: "黑匣子",
          },
        ],
        edges: [{ from: "中心", to: "团队任务的反面需求的反面需求的反面需求", label: "远联想" }],
        recommendedNodeLabels: ["团队任务的反面需求的反面需求的反面需求"],
      },
      "游戏机制",
    );

    const node = map.nodes.find((item) => item.selectable)!;
    expect(node.label).not.toContain("反面需求的反面需求");
    expect(node.label.length).toBeLessThanOrEqual(12);
    expect(node.reason).not.toContain("黑匣子");
    expect(node.source).toBe("隐藏机制");
  });

  it("normalizes a node expansion and skips labels already in the map", () => {
    const map = normalizeBrainstormMap(
      {
        stuckType: "有兴趣没形态",
        nodes: [
          { label: "不服再来", category: "情绪", level: 1, reason: "核心情绪" },
          { label: "撤销按钮", category: "物件", level: 1, reason: "已经存在" },
        ],
        edges: [{ from: "中心", to: "不服再来", label: "情绪" }],
        recommendedNodeLabels: ["不服再来"],
      },
      "游戏机制产品",
    );
    const parent = map.nodes.find((node) => node.label === "不服再来")!;

    const expansion = normalizeMindMapExpansion(
      {
        nodes: [
          { label: "撤销按钮", category: "物件", level: 2, reason: "重复节点" },
          { label: "爱反悔的玩家", category: "人群", level: 2, reason: "从情绪换到人群", source: "换人群" },
          { label: "后悔药", category: "远联想", level: 2, reason: "黑匣子类比", source: "黑匣子" },
        ],
        recommendedNodeLabels: ["爱反悔的玩家", "后悔药"],
      },
      map,
      parent.id,
    );

    expect(expansion.nodes.map((node) => node.label)).toEqual(["爱反悔的玩家", "后悔药"]);
    expect(expansion.nodes.every((node) => node.parentId === parent.id)).toBe(true);
    expect(expansion.edges).toHaveLength(2);
    expect(expansion.nodes.find((node) => node.label === "后悔药")?.source).toBe("隐藏机制");
    expect(expansion.recommendedNodeIds).toHaveLength(2);
  });

  it("safely scatters multiple expansion nodes around an edge parent without overlap", () => {
    const baseMap = normalizeBrainstormMap(
      {
        nodes: [
          { label: "边缘父节点", category: "场景", level: 1 },
          { label: "附近障碍节点", category: "物件", level: 2 },
        ],
      },
      "边缘扩展",
    );
    const parent = baseMap.nodes.find((node) => node.label === "边缘父节点")!;
    const obstacle = baseMap.nodes.find((node) => node.label === "附近障碍节点")!;
    const map = {
      ...baseMap,
      nodes: baseMap.nodes.map((node) => {
        if (node.id === parent.id) return { ...node, x: 86, y: 79 };
        if (node.id === obstacle.id) return { ...node, x: 73, y: 70 };
        return node;
      }),
    };
    const expansion = normalizeMindMapExpansion(
      {
        nodes: Array.from({ length: 8 }, (_, index) => ({
          label: `扩展长标签节点${index}`,
          category: index % 2 === 0 ? "远联想" : "限制",
          level: 2,
        })),
      },
      map,
      parent.id,
    );
    const allNodes = [...map.nodes, ...expansion.nodes];
    const width = (label: string): number => Math.min(15, Math.max(9, 7.5 + Array.from(label).length * 0.55));

    expect(expansion.nodes.some((node) => node.x > 87 || node.y > 80)).toBe(true);
    expect(expansion.nodes.every((node) => Math.hypot(node.x - 86, node.y - 79) <= 62)).toBe(true);
    for (const node of expansion.nodes) {
      for (const other of allNodes) {
        if (node.id === other.id) continue;
        const horizontalGap = Math.abs(node.x - other.x);
        const verticalGap = Math.abs(node.y - other.y);
        expect(horizontalGap >= (width(node.label) + width(other.label)) / 2 + 0.8 || verticalGap >= 7.2).toBe(true);
      }
    }
  });

  it("normalizes a mind map reroll while preserving locked nodes and coordinates", () => {
    const map = normalizeBrainstormMap(
      {
        stuckType: "有技术没需求",
        nodes: [
          { label: "独立开发者", category: "人群", level: 1, reason: "锁定节点" },
          { label: "深夜", category: "场景", level: 1, reason: "可替换节点" },
          { label: "烂尾焦虑", category: "情绪", level: 1, reason: "可替换节点" },
        ],
        edges: [
          { from: "中心", to: "独立开发者", label: "人群" },
          { from: "中心", to: "深夜", label: "场景" },
          { from: "中心", to: "烂尾焦虑", label: "情绪" },
        ],
        recommendedNodeLabels: ["独立开发者", "深夜", "烂尾焦虑"],
      },
      "开发者工具",
    );
    const lockedNode = map.nodes.find((node) => node.label === "独立开发者")!;
    const sceneNode = map.nodes.find((node) => node.label === "深夜")!;
    const emotionNode = map.nodes.find((node) => node.label === "烂尾焦虑")!;
    const lockedMap = {
      ...map,
      nodes: map.nodes.map((node) => (node.id === lockedNode.id ? { ...node, locked: true } : node)),
    };

    const rerolled = normalizeMindMapReroll(
      {
        nodes: [
          { replaceNodeId: sceneNode.id, label: "发布前一小时", category: "场景", reason: "把场景推到更紧张的时刻", source: "换场景" },
          { replaceNodeId: emotionNode.id, label: "想炫耀", category: "情绪", reason: "把羞耻感反转为炫耀欲", source: "放大情绪" },
        ],
        recommendedNodeIds: [lockedNode.id, emotionNode.id],
      },
      lockedMap,
    );

    expect(rerolled.nodes.find((node) => node.id === lockedNode.id)?.label).toBe("独立开发者");
    expect(rerolled.nodes.find((node) => node.id === sceneNode.id)?.label).toBe("发布前一小时");
    expect(rerolled.nodes.find((node) => node.id === sceneNode.id)?.x).toBe(sceneNode.x);
    expect(rerolled.nodes.find((node) => node.id === emotionNode.id)?.source).toBe("放大情绪");
    expect(rerolled.recommendedNodeIds).toEqual([lockedNode.id, emotionNode.id]);
  });

  it("normalizes collision recommendations by mapping selected texts to existing word ids", () => {
    const groups = normalizeWordGroups({
      groups: [
        { type: "人群", words: [{ text: "独立开发者" }, { text: "产品经理" }] },
        { type: "场景", words: [{ text: "深夜" }] },
        { type: "情绪", words: [{ text: "烂尾焦虑" }] },
        { type: "物件", words: [{ text: "GitHub 仓库" }] },
        { type: "结构", words: [{ text: "博物馆" }] },
        { type: "限制", words: [{ text: "每天只能 1 分钟" }] },
      ],
    });

    const recommendation = normalizeCollisionRecommendation(
      {
        selections: [
          { groupType: "人群", text: "产品经理" },
          { groupType: "场景", text: "深夜" },
          { groupType: "情绪", text: "烂尾焦虑" },
          { groupType: "物件", text: "GitHub 仓库" },
          { groupType: "结构", text: "博物馆" },
          { groupType: "限制", text: "每天只能 1 分钟" },
        ],
        reason: "这组词有角色、时刻和约束之间的张力。",
      },
      groups,
    );

    expect(recommendation.selectedWordIds).toHaveLength(6);
    expect(recommendation.selectedWordIds[0]).toBe(groups[0]?.words[1]?.id);
    expect(recommendation.reason).toContain("张力");
    expect(() =>
      normalizeCollisionRecommendation(
        {
          selections: [
            { groupType: "人群", text: "不存在的人群" },
            { groupType: "场景", text: "深夜" },
            { groupType: "情绪", text: "烂尾焦虑" },
            { groupType: "物件", text: "GitHub 仓库" },
            { groupType: "结构", text: "博物馆" },
            { groupType: "限制", text: "每天只能 1 分钟" },
          ],
        },
        groups,
      ),
    ).toThrow("模型选择了不存在的候选词");
  });

  it("normalizes idea cards and rejects empty output", () => {
    const sourceWords = normalizeWordGroups({
      groups: [
        { type: "人群", words: [{ text: "独立开发者" }] },
        { type: "场景", words: [{ text: "深夜" }] },
        { type: "情绪", words: [{ text: "烂尾焦虑" }] },
        { type: "物件", words: [{ text: "GitHub 仓库" }] },
        { type: "结构", words: [{ text: "博物馆" }] },
        { type: "限制", words: [{ text: "只能提问" }] },
      ],
    }).map((group) => group.words[0]);

    const ideas = normalizeIdeaCards(
      {
        ideas: [
          {
            title: "项目遗迹馆",
            summary: "扫描废弃项目并生成展签。",
            whyInteresting: "它把失败经验变成可浏览资产。",
            firstVersion: "先做 GitHub 仓库扫描和卡片生成。",
          },
        ],
      },
      sourceWords,
    );

    expect(ideas[0]?.sourceWords).toHaveLength(6);
    expect(() => normalizeIdeaCards({ ideas: [] }, sourceWords)).toThrow("模型没有返回可用脑洞");
    expect(() => normalizeIdeaCards({ ideas: [{ title: "", summary: "缺标题", whyInteresting: "有趣", firstVersion: "第一版" }] }, sourceWords)).toThrow("模型脑洞缺少标题");
  });

  it("normalizes idea refinement into vitality, roundtable, directions, MVP ladder, and actions", () => {
    const idea = {
      id: "idea-1",
      title: "项目遗迹馆",
      summary: "扫描废弃项目并生成展签。",
      whyInteresting: "它把失败经验变成可浏览资产。",
      firstVersion: "先做 GitHub 仓库扫描和卡片生成。",
      sourceWords: [],
      createdAt: "2026-07-07T00:00:00.000Z",
    };

    const refinement = normalizeIdeaRefinement(
      {
        refinement: {
          vitality: {
            targetUser: "烂尾项目很多的独立开发者",
            triggerScene: "周日晚上翻旧仓库",
            coreEmotion: "又羞耻又舍不得",
            existingAlternative: "把仓库归档或写复盘文",
            smallestPlayableVersion: "输入仓库地址，生成一张遗迹展签",
          },
          roundtable: [
            { role: "懒人用户", feedback: "别让我配置太多，最好粘贴链接就能看。" },
            { role: "毒舌用户", feedback: "如果只是总结 README，那我会立刻关掉。" },
            { role: "产品经理", feedback: "价值在于把烂尾变成可展示资产。" },
            { role: "工程师", feedback: "第一版只解析公开仓库和 README。" },
            { role: "测试", feedback: "要测空仓库、私有仓库、超大仓库。" },
            { role: "商人", feedback: "可以从个人作品集和招聘场景找付费点。" },
          ],
          directions: [
            { type: "玩具版", title: "仓库墓志铭", description: "生成一张荒诞展签。", firstStep: "先支持手动输入项目名。" },
            { type: "工具版", title: "烂尾复盘器", description: "帮用户整理失败经验。", firstStep: "提取 README 和 commit 节奏。" },
            { type: "产品版", title: "项目作品集博物馆", description: "把旧项目转成可分享作品页。", firstStep: "先做公开分享页。" },
          ],
          mvpLadder: [
            { horizon: "1小时 MVP", goal: "验证展签是否有趣", build: "纯表单生成一张卡", proof: "用户愿意收藏或截图" },
            { horizon: "1天 MVP", goal: "验证仓库输入", build: "读取 GitHub README", proof: "能生成 10 张不重复卡片" },
            { horizon: "一周版本", goal: "验证分享传播", build: "作品集页面和链接分享", proof: "有人把旧项目发出去" },
          ],
          actions: [
            { type: "继续发散", label: "继续发散", description: "回到导图继续找更怪的隐喻。" },
            { type: "收束推进", label: "收束推进", description: "按 1 天 MVP 开始拆任务。" },
            { type: "放入孵化箱", label: "放入孵化箱", description: "先收藏，之后再混合。" },
          ],
        },
      },
      idea,
    );

    expect(refinement.ideaId).toBe("idea-1");
    expect(refinement.vitality.targetUser).toContain("独立开发者");
    expect(refinement.roundtable).toHaveLength(6);
    expect(refinement.directions.map((direction) => direction.type)).toEqual(["玩具版", "工具版", "产品版"]);
    expect(refinement.mvpLadder.map((step) => step.horizon)).toEqual(["1小时 MVP", "1天 MVP", "一周版本"]);
    expect(refinement.actions.map((action) => action.type)).toEqual(["继续发散", "收束推进", "放入孵化箱"]);
  });

  it("把模型挑战结果严格绑定到脑洞和指定角色", () => {
    const idea = {
      id: "idea-1",
      title: "项目遗迹馆",
      summary: "扫描废弃项目并生成展签。",
      whyInteresting: "它把失败经验变成可浏览资产。",
      firstVersion: "先做 GitHub 仓库扫描和卡片生成。",
      sourceWords: [],
      createdAt: "2026-07-07T00:00:00.000Z",
    };

    const challenge = normalizeIdeaChallenge(
      {
        challenge: {
          challenge: "你默认用户愿意公开失败，但这可能正是他们最抗拒的事。",
          risk: "公开机制会让目标用户直接流失。",
          newDirection: "先做完全私密的个人复盘，再让用户主动选择公开。",
        },
      },
      idea,
      "反常识派",
    );

    expect(challenge).toMatchObject({ ideaId: idea.id, role: "反常识派" });
    expect(challenge.challenge).toContain("公开失败");
    expect(challenge.risk).toContain("流失");
    expect(challenge.newDirection).toContain("私密");
    expect(challenge.createdAt).toEqual(expect.any(String));
    expect(() => normalizeIdeaChallenge({ challenge: { challenge: "只有质疑", risk: "", newDirection: "" } }, idea, "反常识派")).toThrow();
  });

  it("严格校验四角色三轮讨论与三个收束方向", () => {
    const discussion = normalizeIdeaDiscussion({
      discussion: {
        rounds: [
          { type: "judgment", contributions: [
            { role: "用户代言人", claim: "用户会想看失败故事", tension: "公开羞耻感会阻碍分享", spark: { id: "spark-1", text: "先从私密档案开始" } },
            { role: "反常识派", claim: "失败比成功更有戏剧性", tension: "失败叙事可能被误解" },
            { role: "跨界连接者", claim: "可以借用博物馆展签", tension: "展签会削弱互动感" },
            { role: "现实构建者", claim: "先做单人仓库扫描", tension: "自动化摘要可能失真" },
          ] },
          { type: "collision", contributions: [{ role: "反常识派", claim: "不要展示成功案例", tension: "失败本身才有戏剧性", buildsOn: "spark-1" }] },
          { type: "synthesis", contributions: [{ role: "现实构建者", claim: "先做单人仓库扫描", tension: "自动化摘要可能失真" }] },
        ],
        synthesis: {
          conservativeDirection: { title: "轻量版", description: "手动上传一个仓库", nextStep: "做上传表单" },
          radicalDirection: { title: "激进版", description: "把失败变成展览", nextStep: "做展厅原型" },
          unexpectedDirection: { title: "意外版", description: "借用考古结构", nextStep: "画展签流程" },
        },
      },
    }, { id: "idea-1", title: "项目遗迹馆", summary: "扫描废弃项目", whyInteresting: "把失败变成资产", firstVersion: "先做扫描", sourceWords: [], createdAt: "2026-07-07T00:00:00.000Z" });

    expect(discussion.ideaId).toBe("idea-1");
    expect(discussion.status).toBe("completed");
    expect(discussion.participants).toEqual(["用户代言人", "反常识派", "跨界连接者", "现实构建者"]);
    expect(discussion.rounds.map((round) => round.type)).toEqual(["judgment", "collision", "synthesis"]);
    expect(discussion.synthesis?.unexpectedDirection.nextStep).toContain("展签");
    const ideaRef = { id: "idea-1" } as never;
    const validTail = [
      { type: "collision", contributions: [{ role: "反常识派", claim: "冲突", tension: "张力" }] },
      { type: "synthesis", contributions: [{ role: "现实构建者", claim: "收束", tension: "执行" }] },
    ];
    const validJudgment = { type: "judgment", contributions: [
      { role: "用户代言人", claim: "有内容", tension: "有张力" }, { role: "反常识派", claim: "有内容", tension: "有张力" },
      { role: "跨界连接者", claim: "有内容", tension: "有张力" }, { role: "现实构建者", claim: "有内容", tension: "有张力" },
    ] };
    expect(() => normalizeIdeaDiscussion({ discussion: { rounds: [{ type: "unknown", contributions: [] }, ...validTail], synthesis: {} } }, ideaRef)).toThrow("轮次必须");
    expect(() => normalizeIdeaDiscussion({ discussion: { rounds: [{ type: "judgment", contributions: [
      { role: "用户代言人", claim: "有内容", tension: "有张力" }, { role: "反常识派", claim: "有内容", tension: "有张力" },
      { role: "跨界连接者", claim: "有内容", tension: "有张力" }, { role: "未知角色", claim: "有内容", tension: "有张力" },
    ] }, ...validTail], synthesis: {} } }, ideaRef)).toThrow("未知角色");
    expect(() => normalizeIdeaDiscussion({ discussion: { rounds: [{ type: "judgment", contributions: [
      { role: "用户代言人", claim: "", tension: "有张力" }, { role: "反常识派", claim: "有内容", tension: "有张力" },
      { role: "跨界连接者", claim: "有内容", tension: "有张力" }, { role: "现实构建者", claim: "有内容", tension: "有张力" },
    ] }, ...validTail], synthesis: {} } }, ideaRef)).toThrow("claim");
    expect(() => normalizeIdeaDiscussion({ discussion: { rounds: [{ type: "judgment", contributions: [
      { role: "用户代言人", claim: "有内容", tension: "有张力", spark: [] }, { role: "反常识派", claim: "有内容", tension: "有张力" },
      { role: "跨界连接者", claim: "有内容", tension: "有张力" }, { role: "现实构建者", claim: "有内容", tension: "有张力" },
    ] }, ...validTail], synthesis: {} } }, ideaRef)).toThrow();
    expect(() => normalizeIdeaDiscussion({ discussion: { rounds: [{ type: "judgment", contributions: [
      { role: "用户代言人", claim: "有内容", tension: "有张力" }, { role: "反常识派", claim: "有内容", tension: "有张力" },
      { role: "跨界连接者", claim: "有内容", tension: "有张力" }, { role: "现实构建者", claim: "有内容", tension: "有张力" },
    ] }, ...validTail], synthesis: undefined } } as never, ideaRef)).toThrow("synthesis");
    expect(() => normalizeIdeaDiscussion({ discussion: { rounds: [{ type: "judgment", contributions: [
      { role: "用户代言人", claim: "有内容", tension: "有张力" }, { role: "用户代言人", claim: "重复", tension: "有张力" },
      { role: "跨界连接者", claim: "有内容", tension: "有张力" }, { role: "现实构建者", claim: "有内容", tension: "有张力" },
    ] }, ...validTail], synthesis: {} } }, ideaRef)).toThrow("四个固定角色");
    expect(() => normalizeIdeaDiscussion({ discussion: { rounds: [{ type: "judgment", contributions: [
      { role: "用户代言人", claim: "有内容", tension: "有张力" }, { role: "反常识派", claim: "有内容", tension: "有张力" },
      { role: "跨界连接者", claim: "有内容", tension: "有张力" },
    ] }, ...validTail], synthesis: {} } }, ideaRef)).toThrow("四个固定角色");
    expect(() => normalizeIdeaDiscussion({ discussion: { rounds: [validJudgment, {
      type: "collision",
      contributions: [
        { role: "反常识派", claim: "第一条", tension: "张力" },
        { role: "反常识派", claim: "重复发言", tension: "张力" },
      ],
    }, validTail[1]], synthesis: {} } }, ideaRef)).toThrow("同一角色");
    expect(() => normalizeIdeaDiscussion({ discussion: { rounds: [validJudgment, {
      type: "collision",
      contributions: [
        { role: "用户代言人", claim: "一", tension: "张力" }, { role: "反常识派", claim: "二", tension: "张力" },
        { role: "跨界连接者", claim: "三", tension: "张力" }, { role: "现实构建者", claim: "四", tension: "张力" },
        { role: "用户代言人", claim: "五", tension: "张力" },
      ],
    }, validTail[1]], synthesis: {} } }, ideaRef)).toThrow("最多四条");
    expect(() => normalizeIdeaDiscussion({ discussion: { rounds: [{
      ...validJudgment,
      contributions: validJudgment.contributions.map((contribution, index) => index === 0
        ? { ...contribution, spark: { id: "duplicate-spark", text: "第一条火花" } }
        : contribution),
    }, {
      type: "collision",
      contributions: [{ role: "反常识派", claim: "沿着火花碰撞", tension: "张力", spark: { id: "duplicate-spark", text: "重复火花" } }],
    }, validTail[1]], synthesis: {} } }, ideaRef)).toThrow("火花 id 必须唯一");
    expect(() => normalizeIdeaDiscussion({ discussion: { rounds: [], synthesis: undefined } }, { id: "idea-1" } as never)).toThrow();
  });

  it("把介入结果严格绑定到本次用户动作并校验回应角色", () => {
    const request = { type: "question", prompt: "如果用户不愿公开呢？", targetRole: "用户代言人", sourceRole: "反常识派", sourceClaim: "失败更有戏剧性" } as const;
    const intervention = normalizeIdeaDiscussionIntervention({ intervention: { id: "模型伪造", type: "add", prompt: "模型改写", targetRole: "现实构建者", responses: [
      { role: "用户代言人", claim: "先从私密复盘开始", tension: "传播性会降低" },
      { role: "现实构建者", claim: "先验证三位用户", tension: "样本很小" },
    ], createdAt: "模型伪造" } }, request);

    expect(intervention).toMatchObject({ type: "question", prompt: request.prompt, targetRole: "用户代言人", sourceRole: "反常识派", sourceClaim: "失败更有戏剧性" });
    expect(intervention.id).not.toBe("模型伪造");
    expect(intervention.createdAt).not.toBe("模型伪造");
    expect(() => normalizeIdeaDiscussionIntervention({ responses: [{ role: "反常识派", claim: "错位", tension: "张力" }] }, request)).toThrow("第一条");
    expect(() => normalizeIdeaDiscussionIntervention({ responses: [
      { role: "用户代言人", claim: "一", tension: "张力" }, { role: "用户代言人", claim: "二", tension: "张力" },
    ] }, request)).toThrow("角色不能重复");
    expect(() => normalizeIdeaDiscussionIntervention({ responses: [
      { role: "用户代言人", claim: "一", tension: "张力" }, { role: "现实构建者", claim: "二", tension: "张力" }, { role: "反常识派", claim: "三", tension: "张力" },
    ] }, request)).toThrow("1 到 2 条");
    expect(() => normalizeIdeaDiscussionIntervention({ responses: [{ role: "用户代言人", claim: "", tension: "张力" }] }, request)).toThrow("claim");
  });

  it("复用导图扩展后严格保留 4 到 6 个分支节点并写入讨论来源", () => {
    const center = { id: "center", label: "项目灵感", category: "中心", level: 0, x: 50, y: 50, selectable: false, locked: true, selected: false, reason: "中心主题" } as const;
    const map = { id: "map", topic: "项目灵感", stuckType: "有兴趣没形态", center, nodes: [center], edges: [], recommendedNodeIds: [], createdAt: "2026-07-13T00:00:00.000Z" } as unknown as BrainstormMap;
    const origin = { ideaId: "idea-1", discussionId: "discussion-1", directionKey: "radicalDirection" } as const;
    const output = { nodes: Array.from({ length: 5 }, (_, index) => ({ label: `新节点${index + 1}`, category: "远联想", level: 1, reason: "沿方向发散" })) };
    const expansion = normalizeDiscussionBranchExpansion(output, map, center.id, origin);

    expect(expansion.nodes).toHaveLength(5);
    expect(expansion.nodes.every((node) => node.discussionOrigin?.discussionId === origin.discussionId)).toBe(true);
    expect(() => normalizeDiscussionBranchExpansion({ nodes: output.nodes.slice(0, 3) }, map, center.id, origin)).toThrow("4 到 6 个");
    expect(() => normalizeDiscussionBranchExpansion({ nodes: [...output.nodes, { label: "新节点6", category: "远联想", level: 1 }, { label: "新节点7", category: "远联想", level: 1 }] }, map, center.id, origin)).toThrow("4 到 6 个");
  });

  it("normalizes a mixed idea seed for sending old ideas back to the workbench", () => {
    const seed = normalizeMixedIdeaSeed({
      mixedTopic: "失败作品集博物馆",
      theme: "把旧项目的失败经验变成可以展示的资产",
      tension: "羞耻感和炫耀欲之间的拉扯",
      startingPrompt: "给独立开发者做一个能把烂尾仓库生成作品集展签的工具。",
      sourceIdeaTitles: ["项目遗迹馆", "灵感潮汐钟"],
    });

    expect(seed.mixedTopic).toBe("失败作品集博物馆");
    expect(seed.theme).toContain("旧项目");
    expect(seed.sourceIdeaTitles).toEqual(["项目遗迹馆", "灵感潮汐钟"]);
    expect(seed.createdAt).toBeTruthy();
  });
});
