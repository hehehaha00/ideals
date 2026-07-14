// 这个文件验证本地存储的版本迁移、损坏隔离和写入失败反馈。
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IdeaCard, StoredIdeaState, WorkspaceSnapshot } from "../types/idea";
import { loadStoredState, saveStoredState } from "./storage";

const idea: IdeaCard = {
  id: "idea-1",
  title: "项目遗迹馆",
  summary: "把烂尾项目变成展品。",
  whyInteresting: "失败经验也能成为资产。",
  firstVersion: "先生成一张项目展签。",
  sourceWords: [],
  createdAt: "2026-07-10T00:00:00.000Z",
};

const workspace: WorkspaceSnapshot = {
  topic: "开发者工具",
  intensity: "正常",
  groups: [],
  ideas: [idea],
  refinementsByIdeaId: {},
  refinementActionsByIdeaId: {},
  executionPlansByIdeaId: {},
  challengesByIdeaId: {},
  discussionsByIdeaId: {},
  activeIdeaId: idea.id,
};

const word = {
  id: "word-1",
  text: "独立开发者",
  groupType: "人群" as const,
  locked: false,
  selected: true,
  source: "AI",
};

const node = {
  id: "node-1",
  label: "独立开发者",
  category: "人群" as const,
  level: 1 as const,
  x: 20,
  y: 30,
  selectable: true,
  locked: false,
  selected: true,
  reason: "目标人群",
};

const discussion = {
  id: "discussion-1",
  ideaId: idea.id,
  createdAt: "2026-07-10T02:00:00.000Z",
  status: "completed",
  participants: ["用户代言人", "反常识派", "跨界连接者", "现实构建者"],
  rounds: [
    {
      type: "judgment",
      contributions: [
        {
          role: "用户代言人",
          claim: "用户需要先在私密环境里复盘失败。",
          tension: "公开展示与心理安全互相冲突。",
          spark: { id: "spark-1", text: "先做一座只对自己开放的遗迹馆" },
        },
      ],
    },
    {
      type: "collision",
      contributions: [
        {
          role: "反常识派",
          claim: "不展示失败结果，只展示当时放弃的理由。",
          tension: "作品归档与决策复盘并不相同。",
          buildsOn: "spark-1",
        },
      ],
    },
    {
      type: "synthesis",
      contributions: [
        {
          role: "现实构建者",
          claim: "第一版只需要读取仓库和生成一张展签。",
          tension: "自动化程度不能超过用户的信任边界。",
        },
      ],
    },
  ],
  synthesis: {
    conservativeDirection: { title: "私密复盘", description: "先服务项目拥有者。", nextStep: "生成单张项目展签。" },
    radicalDirection: { title: "失败博物馆", description: "把失败经验公开流通。", nextStep: "邀请三位开发者共建展览。" },
    unexpectedDirection: { title: "决策遗迹", description: "只保存当时放弃的理由。", nextStep: "从关闭的 issue 中提取决策。" },
  },
  collectedSparkIds: ["spark-1"],
  interventions: [],
} as const;

describe("storage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("把 v1 收藏迁移成 v2 孵化条目", () => {
    localStorage.setItem(
      "idea-lab:v1",
      JSON.stringify({ version: 1, favorites: [{ idea, savedAt: "2026-07-10T01:00:00.000Z" }] }),
    );

    const stored = loadStoredState();

    expect(stored.version).toBe(2);
    expect(stored.incubatorEntries).toEqual([
      {
        idea,
        savedAt: "2026-07-10T01:00:00.000Z",
      },
    ]);
  });

  it("v2 JSON 损坏时仍独立读取有效的 v1 收藏", () => {
    localStorage.setItem("idea-lab:v2", "{not-json");
    localStorage.setItem(
      "idea-lab:v1",
      JSON.stringify({ version: 1, favorites: [{ idea, savedAt: "2026-07-10T01:00:00.000Z" }] }),
    );

    expect(loadStoredState().incubatorEntries).toEqual([{ idea, savedAt: "2026-07-10T01:00:00.000Z" }]);
  });

  it("保存并读取 v2 工作区和带炼化信息的孵化条目", () => {
    const state: StoredIdeaState = {
      version: 2,
      workspace,
      incubatorEntries: [
        {
          idea,
          savedAt: "2026-07-10T01:00:00.000Z",
          refinement: {
            id: "refinement-1",
            ideaId: idea.id,
            vitality: {
              targetUser: "独立开发者",
              triggerScene: "周末复盘",
              coreEmotion: "烂尾焦虑",
              existingAlternative: "归档仓库",
              smallestPlayableVersion: "生成一张展签",
            },
            roundtable: [],
            directions: [],
            mvpLadder: [],
            actions: [],
            createdAt: "2026-07-10T01:00:00.000Z",
          },
          action: "放入孵化箱",
        },
      ],
    };

    expect(saveStoredState(state)).toEqual({ ok: true });
    expect(loadStoredState()).toEqual(state);
  });

  it("持久化合法来源快照并兼容没有快照的旧脑洞", () => {
    const originIdea: IdeaCard = {
      ...idea,
      id: "idea-origin",
      origin: {
        mapId: "map-1",
        sourceNodeIds: ["node-1", "node-2"],
        activeNodeId: "node-1",
        viewport: { panX: 120, panY: -48, scale: 1.5 },
        collisionRecipe: "amplify-emotion",
      },
    };
    const state: StoredIdeaState = {
      version: 2,
      workspace: { ...workspace, ideas: [idea, originIdea] },
      incubatorEntries: [{ idea: originIdea, savedAt: "2026-07-10T01:00:00.000Z" }],
    };

    expect(saveStoredState(state)).toEqual({ ok: true });
    const restored = loadStoredState();

    expect(restored.workspace?.ideas[0]?.origin).toBeUndefined();
    expect(restored.workspace?.ideas[1]?.origin).toEqual(originIdea.origin);
    expect(restored.incubatorEntries[0]?.idea.origin).toEqual(originIdea.origin);
  });

  it("未知碰撞配方只丢弃配方字段并保留来源快照", () => {
    localStorage.setItem("idea-lab:v2", JSON.stringify({
      version: 2,
      workspace: {
        ...workspace,
        ideas: [{
          ...idea,
          origin: {
            mapId: "map-1",
            sourceNodeIds: ["node-1", "node-2"],
            activeNodeId: "node-1",
            viewport: { panX: 120, panY: -48, scale: 1.5 },
            collisionRecipe: "unknown-recipe",
          },
        }],
      },
      incubatorEntries: [],
    }));

    expect(loadStoredState().workspace?.ideas[0]?.origin).toEqual({
      mapId: "map-1",
      sourceNodeIds: ["node-1", "node-2"],
      activeNodeId: "node-1",
      viewport: { panX: 120, panY: -48, scale: 1.5 },
    });
  });

  it("来源快照缺少活动节点时回退到最后一个来源节点", () => {
    localStorage.setItem("idea-lab:v2", JSON.stringify({
      version: 2,
      workspace: {
        ...workspace,
        ideas: [{
          ...idea,
          origin: {
            mapId: "map-1",
            sourceNodeIds: ["node-1", "node-2"],
            viewport: { panX: 0, panY: 0, scale: 1 },
          },
        }],
      },
      incubatorEntries: [],
    }));

    expect(loadStoredState().workspace?.ideas[0]?.origin?.activeNodeId).toBe("node-2");
  });

  it("来源快照活动节点不在来源集合时回退到最后一个来源节点", () => {
    localStorage.setItem("idea-lab:v2", JSON.stringify({
      version: 2,
      workspace: {
        ...workspace,
        ideas: [{
          ...idea,
          origin: {
            mapId: "map-1",
            sourceNodeIds: ["node-1", "node-2"],
            activeNodeId: "unrelated-node",
            viewport: { panX: 0, panY: 0, scale: 1 },
          },
        }],
      },
      incubatorEntries: [],
    }));

    expect(loadStoredState().workspace?.ideas[0]?.origin?.activeNodeId).toBe("node-2");
  });

  it("保留脑洞但丢弃字段或镜头数值非法的来源快照", () => {
    const invalidOrigins: unknown[] = [
      { mapId: 7, sourceNodeIds: ["node-1"], activeNodeId: "node-1", viewport: { panX: 0, panY: 0, scale: 1 } },
      { mapId: "map-1", sourceNodeIds: ["node-1", 2], activeNodeId: "node-1", viewport: { panX: 0, panY: 0, scale: 1 } },
      { mapId: "map-1", sourceNodeIds: ["node-1"], activeNodeId: 3, viewport: { panX: 0, panY: 0, scale: 1 } },
      { mapId: "map-1", sourceNodeIds: ["node-1"], activeNodeId: "node-1", viewport: { panX: Number.POSITIVE_INFINITY, panY: 0, scale: 1 } },
      { mapId: "map-1", sourceNodeIds: ["node-1"], activeNodeId: "node-1", viewport: { panX: 0, panY: "0", scale: 1 } },
      { mapId: "map-1", sourceNodeIds: ["node-1"], activeNodeId: "node-1", viewport: { panX: 0, panY: 0, scale: Number.NaN } },
    ];
    localStorage.setItem("idea-lab:v2", JSON.stringify({
      version: 2,
      workspace: {
        ...workspace,
        ideas: invalidOrigins.map((origin, index) => ({ ...idea, id: `idea-invalid-${index}`, origin })),
      },
      incubatorEntries: [],
    }));

    const restoredIdeas = loadStoredState().workspace?.ideas ?? [];

    expect(restoredIdeas).toHaveLength(invalidOrigins.length);
    expect(restoredIdeas.every((item) => item.origin === undefined)).toBe(true);
  });

  it("逐条丢弃损坏的孵化内容并保留有效条目", () => {
    localStorage.setItem(
      "idea-lab:v2",
      JSON.stringify({
        version: 2,
        workspace,
        incubatorEntries: [
          { idea, savedAt: "2026-07-10T01:00:00.000Z" },
          { idea: { title: "缺少 id" }, savedAt: "2026-07-10T02:00:00.000Z" },
        ],
      }),
    );

    const stored = loadStoredState();

    expect(stored.workspace?.topic).toBe("开发者工具");
    expect(stored.incubatorEntries.map((entry) => entry.idea.id)).toEqual([idea.id]);
  });

  it("逐项过滤工作区内损坏的词组、节点、连线和炼化映射", () => {
    localStorage.setItem(
      "idea-lab:v2",
      JSON.stringify({
        version: 2,
        workspace: {
          ...workspace,
          groups: [
            { type: "人群", label: "人群", description: "谁会使用", words: [word, { ...word, id: 42 }] },
            { type: "未知", label: "损坏分组", description: "损坏", words: [] },
          ],
          ideas: [{ ...idea, sourceWords: [word, { ...word, groupType: "未知" }] }],
          mindMap: {
            id: "map-1",
            topic: "开发者工具",
            stuckType: "有技术没需求",
            center: { ...node, id: "center", label: "开发者工具", category: "中心", level: 0, selectable: false, locked: true },
            nodes: [node, { ...node, id: null }],
            edges: [
              { id: "edge-1", from: "center", to: node.id, label: "人群" },
              { id: "edge-bad", from: 3, to: node.id, label: "损坏" },
            ],
            recommendedNodeIds: [node.id, 7],
            createdAt: "2026-07-10T00:00:00.000Z",
          },
          refinementsByIdeaId: {
            [idea.id]: {
              id: "refine-1",
              ideaId: idea.id,
              vitality: {
                targetUser: "独立开发者",
                triggerScene: "周末复盘",
                coreEmotion: "焦虑",
                existingAlternative: "归档",
                smallestPlayableVersion: "生成展签",
              },
              roundtable: [{ role: "工程师", feedback: "先做只读。" }, { role: "未知", feedback: 1 }],
              directions: [{ type: "工具版", title: "复盘器", description: "整理经验", firstStep: "读 README" }, { type: "坏类型" }],
              mvpLadder: [{ horizon: "1小时 MVP", goal: "验证", build: "表单", proof: "截图" }, { horizon: 1 }],
              actions: [{ type: "放入孵化箱", label: "收藏", description: "稍后继续" }, { type: "未知" }],
              createdAt: "2026-07-10T00:00:00.000Z",
            },
            broken: { id: "bad", ideaId: "broken", vitality: null },
          },
          refinementActionsByIdeaId: { [idea.id]: "放入孵化箱", broken: "未知动作" },
        },
        incubatorEntries: [],
      }),
    );

    const stored = loadStoredState();
    const restoredWorkspace = stored.workspace!;
    const restoredRefinement = restoredWorkspace.refinementsByIdeaId[idea.id]!;

    expect(restoredWorkspace.groups).toHaveLength(1);
    expect(restoredWorkspace.groups[0]?.words.map((item) => item.id)).toEqual([word.id]);
    expect(restoredWorkspace.ideas[0]?.sourceWords.map((item) => item.id)).toEqual([word.id]);
    expect(restoredWorkspace.mindMap?.nodes.map((item) => item.id)).toEqual([node.id]);
    expect(restoredWorkspace.mindMap?.edges.map((edge) => edge.id)).toEqual(["edge-1"]);
    expect(restoredWorkspace.mindMap?.recommendedNodeIds).toEqual([node.id]);
    expect(Object.keys(restoredWorkspace.refinementsByIdeaId)).toEqual([idea.id]);
    expect(restoredRefinement.roundtable).toHaveLength(1);
    expect(restoredRefinement.directions).toHaveLength(1);
    expect(restoredRefinement.mvpLadder).toHaveLength(1);
    expect(restoredRefinement.actions).toHaveLength(1);
    expect(restoredWorkspace.refinementActionsByIdeaId).toEqual({ [idea.id]: "放入孵化箱" });
  });

  it("孵化条目保留有效脑洞并只移除损坏的炼化详情", () => {
    localStorage.setItem(
      "idea-lab:v2",
      JSON.stringify({
        version: 2,
        incubatorEntries: [
          {
            idea,
            savedAt: "2026-07-10T01:00:00.000Z",
            refinement: { id: "bad", ideaId: idea.id, vitality: null },
            action: "未知动作",
          },
        ],
      }),
    );

    expect(loadStoredState().incubatorEntries).toEqual([{ idea, savedAt: "2026-07-10T01:00:00.000Z" }]);
  });

  it("导图节点只接受数字 level 并移除非法可选字符串字段", () => {
    localStorage.setItem(
      "idea-lab:v2",
      JSON.stringify({
        version: 2,
        workspace: {
          ...workspace,
          mindMap: {
            id: "map-1",
            topic: "开发者工具",
            stuckType: "有技术没需求",
            center: { ...node, id: "center", category: "中心", level: 0, selectable: false, locked: true },
            nodes: [
              { ...node, source: 42, parentId: 7 },
              { ...node, id: "string-level", level: "1" },
            ],
            edges: [],
            recommendedNodeIds: [],
            createdAt: "2026-07-10T00:00:00.000Z",
          },
        },
        incubatorEntries: [],
      }),
    );

    const restoredNodes = loadStoredState().workspace?.mindMap?.nodes;

    expect(restoredNodes).toEqual([node]);
    expect(typeof restoredNodes?.[0]?.level).toBe("number");
  });

  it("过滤坐标被 JSON 解析为无穷大的损坏导图节点", () => {
    const raw = JSON.stringify({
      version: 2,
      workspace: {
        ...workspace,
        mindMap: {
          id: "map-1",
          topic: "开发者工具",
          stuckType: "有技术没需求",
          center: { ...node, id: "center", category: "中心", level: 0, selectable: false, locked: true },
          nodes: [
            node,
            { ...node, id: "infinite-x", x: 123456789 },
            { ...node, id: "infinite-y", y: 987654321 },
          ],
          edges: [],
          recommendedNodeIds: [],
          createdAt: "2026-07-10T00:00:00.000Z",
        },
      },
      incubatorEntries: [],
    })
      .replace("123456789", "1e999")
      .replace("987654321", "1e999");
    localStorage.setItem("idea-lab:v2", raw);

    expect(loadStoredState().workspace?.mindMap?.nodes.map((item) => item.id)).toEqual([node.id]);
  });

  it("恢复合法折叠状态并忽略旧数据或非法值", () => {
    localStorage.setItem("idea-lab:v2", JSON.stringify({
      version: 2,
      workspace: {
        ...workspace,
        mindMap: {
          id: "map-1", topic: "开发者工具", stuckType: "有技术没需求",
          center: { ...node, id: "center", category: "中心", level: 0, selectable: false, locked: true },
          nodes: [{ ...node, id: "collapsed", collapsed: true }, { ...node, id: "legacy" }, { ...node, id: "invalid", collapsed: "yes" }],
          edges: [], recommendedNodeIds: [], createdAt: "2026-07-10T00:00:00.000Z",
        },
      },
      incubatorEntries: [],
    }));

    const restored = loadStoredState().workspace?.mindMap?.nodes;
    expect(restored?.find((item) => item.id === "collapsed")?.collapsed).toBe(true);
    expect(restored?.find((item) => item.id === "legacy")?.collapsed).toBeUndefined();
    expect(restored?.find((item) => item.id === "invalid")?.collapsed).toBeUndefined();
  });

  it("恢复节点备注和分组，并按节点顺序过滤无效与重复引用", () => {
    localStorage.setItem("idea-lab:v2", JSON.stringify({
      version: 2,
      workspace: {
        ...workspace,
        mindMap: {
          id: "map-1", topic: "开发者工具", stuckType: "有技术没需求",
          center: { ...node, id: "center", category: "中心", level: 0, selectable: false, locked: true, groupId: "group-1" },
          nodes: [
            { ...node, id: "center", category: "中心", level: 0, selectable: false, locked: true, groupId: "group-1" },
            { ...node, id: "node-a", note: "用户访谈结论", groupId: "group-1" },
            { ...node, id: "node-b", label: "另一个节点", groupId: "wrong-group" },
            { ...node, id: "node-c", note: 7, groupId: 9 },
          ],
          edges: [], recommendedNodeIds: [],
          groups: [
            { id: "group-1", name: "  核心分支  ", nodeIds: ["node-b", "missing", "node-a", "node-b", "center"], createdAt: "2026-07-11T00:00:00.000Z" },
            { id: "group-orphan", name: "孤立", nodeIds: ["missing", "node-c"], createdAt: "2026-07-11T00:00:00.000Z" },
            { id: 3, name: "损坏", nodeIds: ["node-a", "node-b"], createdAt: "2026-07-11T00:00:00.000Z" },
          ],
          createdAt: "2026-07-10T00:00:00.000Z",
        },
      },
      incubatorEntries: [],
    }));

    const restored = loadStoredState().workspace?.mindMap;

    expect(restored?.groups).toEqual([{ id: "group-1", name: "核心分支", nodeIds: ["node-a", "node-b"], createdAt: "2026-07-11T00:00:00.000Z" }]);
    expect(restored?.nodes.find((item) => item.id === "node-a")).toMatchObject({ note: "用户访谈结论", groupId: "group-1" });
    expect(restored?.nodes.find((item) => item.id === "node-b")?.groupId).toBe("group-1");
    expect(restored?.nodes.find((item) => item.id === "node-c")?.note).toBeUndefined();
    expect(restored?.nodes.find((item) => item.id === "node-c")?.groupId).toBeUndefined();
    expect(restored?.center.groupId).toBeUndefined();
  });

  it("旧导图缺少 groups 时恢复为空数组", () => {
    localStorage.setItem("idea-lab:v2", JSON.stringify({
      version: 2,
      workspace: {
        ...workspace,
        mindMap: {
          id: "map-1", topic: "开发者工具", stuckType: "有技术没需求",
          center: { ...node, id: "center", category: "中心", level: 0, selectable: false, locked: true },
          nodes: [node], edges: [], recommendedNodeIds: [], createdAt: "2026-07-10T00:00:00.000Z",
        },
      },
      incubatorEntries: [],
    }));

    expect(loadStoredState().workspace?.mindMap?.groups).toEqual([]);
  });

  it("混合结果字段损坏时丢弃整个 seed", () => {
    localStorage.setItem(
      "idea-lab:v2",
      JSON.stringify({
        version: 2,
        workspace: {
          ...workspace,
          lastMixedSeed: {
            mixedTopic: "混合主题",
            theme: "主题",
            tension: "张力",
            startingPrompt: "起点",
            sourceIdeaTitles: ["脑洞一", 2],
            createdAt: "2026-07-10T00:00:00.000Z",
          },
        },
        incubatorEntries: [],
      }),
    );

    expect(loadStoredState().workspace?.lastMixedSeed).toBeUndefined();
  });

  it("恢复合法的导图镜头并忽略损坏镜头", () => {
    localStorage.setItem(
      "idea-lab:v2",
      JSON.stringify({
        version: 2,
        workspace: { ...workspace, mindMapViewport: { panX: 128, panY: -64, scale: 1.35 } },
        incubatorEntries: [],
      }),
    );
    expect(loadStoredState().workspace?.mindMapViewport).toEqual({ panX: 128, panY: -64, scale: 1.35 });

    localStorage.setItem(
      "idea-lab:v2",
      JSON.stringify({
        version: 2,
        workspace: { ...workspace, mindMapViewport: { panX: 128, panY: -64, scale: 0 } },
        incubatorEntries: [],
      }),
    );
    expect(loadStoredState().workspace?.mindMapViewport).toBeUndefined();
  });

  it("localStorage 写入失败时返回明确反馈", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });

    expect(saveStoredState({ version: 2, workspace, incubatorEntries: [] })).toEqual({
      ok: false,
      message: expect.stringContaining("保存失败"),
    });
  });

  it("执行计划缺少阶段或使用非稳定任务 id 时整个丢弃", () => {
    localStorage.setItem(
      "idea-lab:v2",
      JSON.stringify({
        version: 2,
        workspace: {
          ...workspace,
          executionPlansByIdeaId: {
            [idea.id]: {
              ideaId: idea.id,
              createdAt: "2026-07-10T00:00:00.000Z",
              updatedAt: "2026-07-10T01:00:00.000Z",
              tasks: [
                { id: "task-1", horizon: "1小时 MVP", goal: "验证", build: "表单", proof: "截图", completed: true, completedAt: "2026-07-10T01:00:00.000Z" },
                { id: "execution-task:idea-1:1天 MVP", horizon: "1天 MVP", goal: "验证", build: "表单", proof: "截图", completed: false },
                { id: "execution-task:idea-1:一周版本", horizon: "一周版本", goal: "验证", build: "表单", proof: "截图", completed: false },
              ],
            },
            wrong: {
              ideaId: "wrong",
              createdAt: "2026-07-10T00:00:00.000Z",
              updatedAt: "2026-07-10T01:00:00.000Z",
              tasks: [],
            },
          },
        },
        incubatorEntries: [],
      }),
    );

    const restored = loadStoredState().workspace?.executionPlansByIdeaId;
    expect(restored).toEqual({});
  });

  it("执行计划出现重复阶段或缺少阶段时整体丢弃", () => {
    const validTasks = [
      { id: `execution-task:${idea.id}:1小时 MVP`, horizon: "1小时 MVP", goal: "验证", build: "表单", proof: "截图", completed: false },
      { id: `execution-task:${idea.id}:1天 MVP`, horizon: "1天 MVP", goal: "验证", build: "表单", proof: "截图", completed: false },
      { id: `execution-task:${idea.id}:一周版本`, horizon: "一周版本", goal: "验证", build: "表单", proof: "截图", completed: false },
    ];
    const malformedTasks = [
      [validTasks[0], validTasks[0], validTasks[2]],
      [validTasks[0], validTasks[1], validTasks[1]],
    ];

    for (const tasks of malformedTasks) {
      localStorage.clear();
      localStorage.setItem(
        "idea-lab:v2",
        JSON.stringify({
          version: 2,
          workspace: {
            ...workspace,
            executionPlansByIdeaId: {
              [idea.id]: {
                ideaId: idea.id,
                createdAt: "2026-07-10T00:00:00.000Z",
                updatedAt: "2026-07-10T01:00:00.000Z",
                tasks,
              },
            },
          },
          incubatorEntries: [],
        }),
      );

      expect(loadStoredState().workspace?.executionPlansByIdeaId).toEqual({});
    }
  });

  it("旧工作区没有执行计划时恢复为空映射", () => {
    const legacyWorkspace = { ...workspace };
    delete (legacyWorkspace as Partial<WorkspaceSnapshot>).executionPlansByIdeaId;
    localStorage.setItem("idea-lab:v2", JSON.stringify({ version: 2, workspace: legacyWorkspace, incubatorEntries: [] }));

    expect(loadStoredState().workspace?.executionPlansByIdeaId).toEqual({});
  });

  it("收藏条目会保留自己的执行计划", () => {
    const executionPlan = {
      ideaId: idea.id,
      createdAt: "2026-07-10T00:00:00.000Z",
      updatedAt: "2026-07-10T01:00:00.000Z",
      tasks: [
        { id: `execution-task:${idea.id}:1小时 MVP`, horizon: "1小时 MVP" as const, goal: "验证", build: "表单", proof: "截图", completed: false },
        { id: `execution-task:${idea.id}:1天 MVP`, horizon: "1天 MVP" as const, goal: "验证", build: "表单", proof: "截图", completed: false },
        { id: `execution-task:${idea.id}:一周版本`, horizon: "一周版本" as const, goal: "验证", build: "表单", proof: "截图", completed: false },
      ],
    };
    const state: StoredIdeaState = {
      version: 2,
      workspace: { ...workspace, executionPlansByIdeaId: {} },
      incubatorEntries: [{ idea, savedAt: "2026-07-10T01:00:00.000Z", executionPlan }],
    };

    expect(saveStoredState(state)).toEqual({ ok: true });
    expect(loadStoredState().incubatorEntries[0]?.executionPlan).toEqual(executionPlan);
  });

  it("逐项恢复合法挑战并过滤未知角色、损坏字段和错误 ideaId", () => {
    const validChallenge = {
      ideaId: idea.id,
      role: "反常识派",
      challenge: "用户可能根本不想把失败变成展品。",
      risk: "公开失败会让用户退出。",
      newDirection: "先做私密复盘。",
      createdAt: "2026-07-10T01:00:00.000Z",
    };
    localStorage.setItem("idea-lab:v2", JSON.stringify({
      version: 2,
      workspace: {
        ...workspace,
        challengesByIdeaId: {
          [idea.id]: [
            validChallenge,
            { ...validChallenge, role: "普通用户" },
            { ...validChallenge, role: "工程师", risk: 3 },
            { ...validChallenge, role: "毒舌用户", ideaId: "other-idea" },
          ],
          "missing-idea": [{ ...validChallenge, ideaId: "missing-idea" }],
        },
      },
      incubatorEntries: [],
    }));

    expect(loadStoredState().workspace?.challengesByIdeaId).toEqual({ [idea.id]: [validChallenge] });
  });

  it("旧工作区缺少挑战时恢复为空映射", () => {
    const legacyWorkspace = { ...workspace };
    delete (legacyWorkspace as Partial<WorkspaceSnapshot>).challengesByIdeaId;
    localStorage.setItem("idea-lab:v2", JSON.stringify({ version: 2, workspace: legacyWorkspace, incubatorEntries: [] }));

    expect(loadStoredState().workspace?.challengesByIdeaId).toEqual({});
  });

  it("收藏条目会逐项保留合法挑战", () => {
    const challenge = {
      ideaId: idea.id,
      role: "懒人用户" as const,
      challenge: "步骤太多。",
      risk: "用户不会开始。",
      newDirection: "压缩成一步。",
      createdAt: "2026-07-10T01:00:00.000Z",
    };
    const state: StoredIdeaState = {
      version: 2,
      workspace,
      incubatorEntries: [{ idea, savedAt: "2026-07-10T01:00:00.000Z", challenges: [challenge] }],
    };

    expect(saveStoredState(state)).toEqual({ ok: true });
    expect(loadStoredState().incubatorEntries[0]?.challenges).toEqual([challenge]);
  });

  it("按顺序恢复合法讨论，并局部过滤未知轮次、坏观点和坏火花", () => {
    const discussionWithBadMembers = {
      ...discussion,
      id: "discussion-2",
      rounds: [
        discussion.rounds[0],
        {
          ...discussion.rounds[1],
          contributions: [
            ...discussion.rounds[1].contributions,
            { role: "观察员", claim: "无效角色", tension: "不应恢复" },
            { role: "跨界连接者", claim: "", tension: "空观点不应恢复" },
            { role: "跨界连接者", claim: "借用游戏存档结构。", tension: "作品与存档的边界。", spark: { id: 7, text: "坏火花" } },
          ],
        },
        discussion.rounds[2],
        { type: "unknown", contributions: discussion.rounds[0].contributions },
      ],
      collectedSparkIds: ["spark-1", "missing-spark", 7],
    };
    localStorage.setItem("idea-lab:v2", JSON.stringify({
      version: 2,
      workspace: {
        ...workspace,
        discussionsByIdeaId: {
          [idea.id]: [
            discussion,
            discussionWithBadMembers,
            { ...discussion, id: "wrong-idea", ideaId: "other-idea" },
            { ...discussion, id: "bad-status", status: "paused" },
          ],
        },
      },
      incubatorEntries: [],
    }));

    const restored = (loadStoredState().workspace as unknown as { discussionsByIdeaId: Record<string, unknown[]> }).discussionsByIdeaId[idea.id];

    expect(restored).toHaveLength(2);
    expect(restored?.[0]).toEqual(discussion);
    expect(restored?.[1]).toMatchObject({
      id: "discussion-2",
      collectedSparkIds: ["spark-1"],
      rounds: [
        discussion.rounds[0],
        {
          type: "collision",
          contributions: [
            discussion.rounds[1].contributions[0],
            { role: "跨界连接者", claim: "借用游戏存档结构。", tension: "作品与存档的边界。" },
          ],
        },
        discussion.rounds[2],
      ],
    });
  });

  it("完成态讨论缺轮、重复轮或轮次无有效观点时整场丢弃", () => {
    const missingRound = { ...discussion, id: "missing-round", rounds: discussion.rounds.slice(0, 2) };
    const duplicateRound = {
      ...discussion,
      id: "duplicate-round",
      rounds: [discussion.rounds[0], discussion.rounds[1], discussion.rounds[1], discussion.rounds[2]],
    };
    const emptyRound = {
      ...discussion,
      id: "empty-round",
      rounds: [discussion.rounds[0], { type: "collision", contributions: [] }, discussion.rounds[2]],
    };
    localStorage.setItem("idea-lab:v2", JSON.stringify({
      version: 2,
      workspace: {
        ...workspace,
        discussionsByIdeaId: { [idea.id]: [discussion, missingRound, duplicateRound, emptyRound] },
      },
      incubatorEntries: [],
    }));

    const restored = (loadStoredState().workspace as unknown as { discussionsByIdeaId: Record<string, unknown[]> }).discussionsByIdeaId[idea.id];
    expect(restored).toEqual([discussion]);
  });

  it("完成态讨论必须按判断、碰撞、收束的固定顺序恢复", () => {
    const outOfOrder = {
      ...discussion,
      id: "out-of-order",
      rounds: [discussion.rounds[1], discussion.rounds[0], discussion.rounds[2]],
    };
    localStorage.setItem("idea-lab:v2", JSON.stringify({
      version: 2,
      workspace: { ...workspace, discussionsByIdeaId: { [idea.id]: [discussion, outOfOrder] } },
      incubatorEntries: [],
    }));

    const restored = (loadStoredState().workspace as unknown as { discussionsByIdeaId: Record<string, unknown[]> }).discussionsByIdeaId[idea.id];
    expect(restored).toEqual([discussion]);
  });

  it("运行中和中止的讨论保留已有的部分轮次", () => {
    const runningEmpty = { ...discussion, id: "running-empty", status: "running", rounds: [], synthesis: undefined };
    const runningPartial = { ...discussion, id: "running-partial", status: "running", rounds: [discussion.rounds[0]], synthesis: undefined };
    const stoppedPartial = { ...discussion, id: "stopped-partial", status: "stopped", rounds: [discussion.rounds[0], discussion.rounds[1]], synthesis: undefined };
    localStorage.setItem("idea-lab:v2", JSON.stringify({
      version: 2,
      workspace: { ...workspace, discussionsByIdeaId: { [idea.id]: [runningEmpty, runningPartial, stoppedPartial] } },
      incubatorEntries: [],
    }));

    const restored = (loadStoredState().workspace as unknown as { discussionsByIdeaId: Record<string, unknown[]> }).discussionsByIdeaId[idea.id];
    expect(restored).toMatchObject([
      { id: "running-empty", status: "running", rounds: [] },
      { id: "running-partial", status: "running", rounds: [discussion.rounds[0]] },
      { id: "stopped-partial", status: "stopped", rounds: [discussion.rounds[0], discussion.rounds[1]] },
    ]);
  });

  it("恢复讨论时拒绝轮内重复角色、超过四条观点和重复火花", () => {
    const duplicateRole = {
      ...discussion,
      id: "duplicate-role",
      rounds: [{
        ...discussion.rounds[0],
        contributions: [
          ...discussion.rounds[0].contributions,
          { role: "用户代言人", claim: "重复角色", tension: "同一轮不能重复发言" },
        ],
      }, discussion.rounds[1], discussion.rounds[2]],
    };
    const tooManyContributions = {
      ...discussion,
      id: "too-many-contributions",
      rounds: [{
        ...discussion.rounds[0],
        contributions: [
          ...discussion.rounds[0].contributions,
          { role: "反常识派", claim: "第二条", tension: "超出限制" },
          { role: "跨界连接者", claim: "第三条", tension: "超出限制" },
          { role: "现实构建者", claim: "第四条", tension: "超出限制" },
          { role: "反常识派", claim: "第五条", tension: "超出限制" },
        ],
      }, discussion.rounds[1], discussion.rounds[2]],
    };
    const duplicateSpark = {
      ...discussion,
      id: "duplicate-spark",
      rounds: [discussion.rounds[0], {
        ...discussion.rounds[1],
        contributions: [{ ...discussion.rounds[1].contributions[0], spark: { id: "spark-1", text: "重复引用已有火花" } }],
      }, discussion.rounds[2]],
    };
    const partialDuplicateRole = { ...duplicateRole, id: "partial-duplicate-role", status: "running", rounds: [duplicateRole.rounds[0]], synthesis: undefined };
    localStorage.setItem("idea-lab:v2", JSON.stringify({
      version: 2,
      workspace: {
        ...workspace,
        discussionsByIdeaId: { [idea.id]: [discussion, duplicateRole, tooManyContributions, duplicateSpark, partialDuplicateRole] },
      },
      incubatorEntries: [],
    }));

    const restored = (loadStoredState().workspace as unknown as { discussionsByIdeaId: Record<string, unknown[]> }).discussionsByIdeaId[idea.id];
    expect(restored).toEqual([discussion]);
  });

  it("旧讨论缺少介入字段时补为空数组", () => {
    const legacyDiscussion = { ...discussion } as Record<string, unknown>;
    delete legacyDiscussion.interventions;
    localStorage.setItem("idea-lab:v2", JSON.stringify({
      version: 2,
      workspace: { ...workspace, discussionsByIdeaId: { [idea.id]: [legacyDiscussion] } },
      incubatorEntries: [],
    }));

    expect((loadStoredState().workspace as WorkspaceSnapshot).discussionsByIdeaId?.[idea.id]?.[0]?.interventions).toEqual([]);
  });

  it("恢复合法介入并隔离非法动作、角色、空文本、重复回应和第四条", () => {
    const intervention = {
      id: "intervention-1",
      type: "question",
      prompt: "请把这个用户场景说具体。",
      targetRole: "用户代言人",
      sourceRole: "用户代言人",
      sourceClaim: "用户需要先在私密环境里复盘失败。",
      responses: [
        { role: "用户代言人", claim: "先只允许本人查看。", tension: "公开展示会降低安全感。" },
        { role: "现实构建者", claim: "第一版只需生成私密展签。", tension: "权限边界必须足够简单。" },
      ],
      createdAt: "2026-07-10T03:00:00.000Z",
    };
    const second = { ...intervention, id: "intervention-2", type: "disagree", prompt: "我不同意这个假设。", targetRole: "反常识派", responses: [{ ...intervention.responses[0], role: "反常识派" }] };
    const third = { ...intervention, id: "intervention-3", type: "add", prompt: "我补充一个方向。", targetRole: "跨界连接者", responses: [{ ...intervention.responses[0], role: "跨界连接者" }] };
    const invalids = [
      { ...intervention, id: "bad-type", type: "chat" },
      { ...intervention, id: "bad-role", targetRole: "观察员" },
      { ...intervention, id: "empty-prompt", prompt: "   " },
      { ...intervention, id: "bad-source", sourceRole: "观察员" },
      { ...intervention, id: "duplicate-response-role", responses: [{ ...intervention.responses[0], role: "用户代言人" }, { ...intervention.responses[0], role: "用户代言人" }] },
      { ...intervention, id: "too-many-responses", responses: [...intervention.responses, { ...intervention.responses[0], role: "反常识派" }] },
      { ...intervention, id: "long-prompt", prompt: "字".repeat(181) },
      { ...intervention, id: "wrong-first-response-role", responses: [{ ...intervention.responses[0], role: "反常识派" }, intervention.responses[1]] },
    ];
    const legacyDiscussion = { ...discussion, interventions: [intervention, ...invalids, second, third, { ...intervention, id: "fourth", prompt: "第四次不应恢复。" }] };
    localStorage.setItem("idea-lab:v2", JSON.stringify({
      version: 2,
      workspace: { ...workspace, discussionsByIdeaId: { [idea.id]: [legacyDiscussion] } },
      incubatorEntries: [],
    }));

    const restored = (loadStoredState().workspace as WorkspaceSnapshot).discussionsByIdeaId?.[idea.id]?.[0]?.interventions;
    expect(restored).toEqual([intervention, second, third]);
  });

  it("节点来源损坏时只移除 discussionOrigin，不丢弃节点", () => {
    localStorage.setItem("idea-lab:v2", JSON.stringify({
      version: 2,
      workspace: {
        ...workspace,
        mindMap: {
          id: "map-1", topic: "开发者工具", stuckType: "有技术没需求",
          center: { ...node, id: "center", category: "中心", level: 0, selectable: false, locked: true },
          nodes: [
            { ...node, id: "valid-origin", discussionOrigin: { ideaId: idea.id, discussionId: "discussion-1", directionKey: "radicalDirection" } },
            { ...node, id: "bad-origin", discussionOrigin: { ideaId: idea.id, discussionId: "discussion-1", directionKey: "other" } },
          ],
          edges: [], recommendedNodeIds: [], createdAt: "2026-07-10T00:00:00.000Z",
        },
      },
      incubatorEntries: [],
    }));

    const nodes = (loadStoredState().workspace as WorkspaceSnapshot).mindMap?.nodes ?? [];
    expect(nodes.find((item) => item.id === "valid-origin")?.discussionOrigin).toEqual({ ideaId: idea.id, discussionId: "discussion-1", directionKey: "radicalDirection" });
    expect(nodes.find((item) => item.id === "bad-origin")).toMatchObject({ id: "bad-origin", label: node.label });
    expect(nodes.find((item) => item.id === "bad-origin")?.discussionOrigin).toBeUndefined();
  });

  it("旧 V2 工作区缺少讨论时恢复为空映射", () => {
    localStorage.setItem("idea-lab:v2", JSON.stringify({ version: 2, workspace, incubatorEntries: [] }));

    const restored = loadStoredState().workspace as unknown as { discussionsByIdeaId: Record<string, unknown[]> };
    expect(restored.discussionsByIdeaId).toEqual({});
  });

  it("孵化条目按顺序保留多场合法讨论并隔离坏讨论", () => {
    const stoppedDiscussion = { ...discussion, id: "discussion-2", status: "stopped", synthesis: undefined };
    localStorage.setItem("idea-lab:v2", JSON.stringify({
      version: 2,
      workspace,
      incubatorEntries: [{
        idea,
        savedAt: "2026-07-10T01:00:00.000Z",
        discussions: [discussion, { ...discussion, id: "bad", participants: ["主持人"] }, stoppedDiscussion],
      }],
    }));

    expect((loadStoredState().incubatorEntries[0] as unknown as { discussions: unknown[] }).discussions).toEqual([
      discussion,
      { ...stoppedDiscussion, synthesis: undefined },
    ]);
  });
});
