// 这个文件验证工作台状态：生成、锁词、碰撞和收藏持久化。
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MindMapContextPanel } from "../components/workbench/MindMapContextPanel";
import { computeMindMapGroupHulls } from "../components/workbench/MindMapGroups";
import { DIMENSION_GROUPS, IDEA_DISCUSSION_ROLES, type BrainstormMap, type DimensionGroup, type DimensionWord, type IdeaCard, type IdeaDiscussion, type IdeaRefinement } from "../types/idea";
import { useIdeaStore } from "./ideaStore";

type MindMapEditingStore = ReturnType<typeof useIdeaStore.getState> & {
  renameMindNode: (nodeId: string, label: string) => void;
  updateMindNodeNote: (nodeId: string, note: string) => void;
  reparentMindNode: (nodeId: string, parentId: string) => void;
  deleteMindNodeSubtree: (nodeId: string) => void;
  createMindNodeGroup: (name: string, nodeIds: string[]) => void;
  ungroupMindNodes: (nodeIds: string[]) => void;
};

// 在类型正式加入商店前表达期望 API，让测试先以行为失败。
function editingStore(): MindMapEditingStore {
  return useIdeaStore.getState() as MindMapEditingStore;
}

function streamResponse(data: unknown): Response {
  return new Response(`event: done\ndata: ${JSON.stringify(data)}\n\n`, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function deferred<TValue>(): { promise: Promise<TValue>; resolve: (value: TValue) => void; reject: (error: Error) => void } {
  let resolve!: (value: TValue) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<TValue>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function sampleGroups(): DimensionGroup[] {
  return DIMENSION_GROUPS.map((type, index) => ({
    type,
    label: type,
    description: type,
    words: [
      {
        id: `word-${type}`,
        text: `${type}词`,
        groupType: type,
        locked: false,
        selected: true,
        source: "AI",
      },
      {
        id: `word-${type}-alt`,
        text: `${type}备选`,
        groupType: type,
        locked: false,
        selected: index === 0,
        source: "AI",
      },
    ],
  }));
}

function sampleMindMap(topic: string): BrainstormMap {
  const center = {
    id: "center",
    label: topic,
    category: "中心" as const,
    level: 0 as const,
    x: 50,
    y: 50,
    selectable: false,
    locked: true,
    selected: false,
    reason: "中心主题",
  };
  const nodes = DIMENSION_GROUPS.map((category, index) => ({
    id: `node-${category}`,
    label: `${category}节点`,
    category,
    level: 1 as const,
    x: 20 + index * 10,
    y: 30 + index * 5,
    selectable: true,
    locked: false,
    selected: index < 5,
    reason: `${category}角度`,
    parentId: center.id,
  }));

  return {
    id: "map",
    topic,
    stuckType: "有技术没需求",
    center,
    nodes: [center, ...nodes],
    edges: nodes.map((node) => ({ id: `edge-${node.id}`, from: center.id, to: node.id, label: node.category })),
    recommendedNodeIds: nodes.map((node) => node.id),
    createdAt: "2026-07-08T00:00:00.000Z",
  };
}

function sampleIdeas(sourceWords: DimensionWord[] = []): IdeaCard[] {
  return ["项目遗迹馆", "烂尾复盘器", "仓库墓志铭"].map((title, index) => ({
    id: `idea-${index + 1}`,
    title,
    summary: "扫描废弃项目并生成展签。",
    whyInteresting: "它把失败经验变成可浏览资产。",
    firstVersion: "先做 GitHub 仓库扫描和卡片生成。",
    sourceWords,
    sourcePath: ["开发者工具", "烂尾焦虑", "项目遗迹"],
    createdAt: "2026-07-08T00:00:00.000Z",
  }));
}

function sampleRefinement(idea: IdeaCard): IdeaRefinement {
  return {
    id: "refine-1",
    ideaId: idea.id,
    vitality: {
      targetUser: "独立开发者",
      triggerScene: "周日晚上",
      coreEmotion: "烂尾焦虑",
      existingAlternative: "归档仓库",
      smallestPlayableVersion: "生成一张展签",
    },
    roundtable: [
      { role: "懒人用户", feedback: "粘贴链接就要能看。" },
      { role: "毒舌用户", feedback: "别只复述 README。" },
      { role: "产品经理", feedback: "把烂尾变成资产。" },
      { role: "工程师", feedback: "先只读公开仓库。" },
      { role: "测试", feedback: "覆盖空仓库。" },
      { role: "商人", feedback: "作品集场景有付费点。" },
    ],
    directions: [
      { type: "玩具版", title: "仓库墓志铭", description: "生成荒诞展签。", firstStep: "手动输入项目名。" },
      { type: "工具版", title: "烂尾复盘器", description: "整理失败经验。", firstStep: "读取 README。" },
      { type: "产品版", title: "项目作品集博物馆", description: "生成可分享作品页。", firstStep: "做公开分享页。" },
    ],
    mvpLadder: [
      { horizon: "1小时 MVP", goal: "验证有趣", build: "表单生成卡", proof: "用户截图" },
      { horizon: "1天 MVP", goal: "验证仓库输入", build: "读取 README", proof: "卡片不重复" },
      { horizon: "一周版本", goal: "验证分享", build: "分享页", proof: "有人发出去" },
    ],
    actions: [
      { type: "继续发散", label: "继续发散", description: "回到导图。" },
      { type: "收束推进", label: "收束推进", description: "拆 MVP。" },
      { type: "放入孵化箱", label: "放入孵化箱", description: "先收藏。" },
    ],
    createdAt: "2026-07-08T00:00:00.000Z",
  };
}

function sampleDiscussion(idea: IdeaCard, id = "discussion-1"): IdeaDiscussion {
  return {
    id,
    ideaId: idea.id,
    createdAt: "2026-07-13T00:00:00.000Z",
    status: "completed",
    participants: [...IDEA_DISCUSSION_ROLES],
    rounds: [
      {
        type: "judgment",
        contributions: IDEA_DISCUSSION_ROLES.map((role, index) => ({
          role,
          claim: `${role}的判断`,
          tension: `${role}发现的张力`,
          spark: { id: `spark-${index + 1}`, text: `${role}提出的新火花` },
        })),
      },
      { type: "collision", contributions: [{ role: "反常识派", claim: "把默认前提反过来。", tension: "公开与私密冲突", buildsOn: "用户代言人" }] },
      { type: "synthesis", contributions: [{ role: "现实构建者", claim: "先做私密版本。", tension: "趣味与安全冲突" }] },
    ],
    synthesis: {
      conservativeDirection: { title: "保守版", description: "先私密复盘", nextStep: "做单页表单" },
      radicalDirection: { title: "激进版", description: "公开失败博物馆", nextStep: "做分享页" },
      unexpectedDirection: { title: "意外版", description: "失败交换所", nextStep: "邀请两位用户" },
    },
    interventions: [],
    collectedSparkIds: [],
  };
}

// 构造一次讨论方向生成的四节点分支。
function sampleDiscussionBranch(parentNodeId: string): { nodes: BrainstormMap["nodes"]; edges: BrainstormMap["edges"]; recommendedNodeIds: string[] } {
  const nodes = ["私密入口", "失败标签", "复盘仪式", "交换线索"].map((label, index) => ({
    id: `discussion-branch-${index + 1}`,
    label,
    category: "远联想" as const,
    level: 2 as const,
    x: 55 + index * 4,
    y: 45 + index * 3,
    selectable: true,
    locked: false,
    selected: false,
    reason: "沿圆桌讨论方向继续发散。",
    source: "圆桌讨论方向",
    parentId: parentNodeId,
  }));
  return {
    nodes,
    edges: nodes.map((node) => ({ id: `edge-${node.id}`, from: parentNodeId, to: node.id, label: "讨论方向" })),
    recommendedNodeIds: nodes.map((node) => node.id),
  };
}

function installAiFetch(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      const url = String(_input);

      if (url.endsWith("/words")) {
        return streamResponse({ groups: sampleGroups() });
      }
      if (url.endsWith("/map")) {
        return streamResponse({ map: sampleMindMap(body.topic ?? "主题") });
      }
      if (url.endsWith("/map/expand")) {
        return streamResponse({
          expansion: {
            nodes: [
              {
                id: "expand-object",
                label: "撤销按钮",
                category: "物件",
                level: 2,
                x: 62,
                y: 44,
                selectable: true,
                locked: false,
                selected: false,
                reason: "从选中节点继续找一个可操作的载体。",
                parentId: body.nodeId,
                source: "找载体",
              },
              {
                id: "expand-crowd",
                label: "爱反悔的玩家",
                category: "人群",
                level: 2,
                x: 68,
                y: 48,
                selectable: true,
                locked: false,
                selected: false,
                reason: "从选中节点换到更极端的人群。",
                parentId: body.nodeId,
                source: "换人群",
              },
            ],
            edges: [
              { id: "edge-expand-object", from: body.nodeId, to: "expand-object", label: "找载体" },
              { id: "edge-expand-crowd", from: body.nodeId, to: "expand-crowd", label: "换人群" },
            ],
            recommendedNodeIds: ["expand-object", "expand-crowd"],
          },
        });
      }
      if (url.endsWith("/map/reroll")) {
        const map = body.map as BrainstormMap;
        return streamResponse({
          map: {
            ...map,
            nodes: map.nodes.map((node) =>
              node.selectable && !node.locked
                ? {
                    ...node,
                    label: `${node.category}AI重掷`,
                    reason: `${node.category}由 AI 重掷`,
                    source: "AI 重掷",
                  }
                : node,
            ),
          },
        });
      }
      if (url.endsWith("/ideas")) {
        return streamResponse({ ideas: sampleIdeas(body.sourceWords ?? []) });
      }
      if (url.endsWith("/collision")) {
        return streamResponse({
          recommendation: {
            selectedWordIds: DIMENSION_GROUPS.map((type) => `word-${type}-alt`),
            reason: "AI 选择每组第二个词制造反差。",
          },
        });
      }
      if (url.endsWith("/transform")) {
        return streamResponse({ idea: { ...body.idea, id: "idea-transform", parentId: body.idea.id, transformDirection: body.direction } });
      }
      if (url.endsWith("/refine")) {
        return streamResponse({ refinement: sampleRefinement(body.idea) });
      }
      if (url.endsWith("/challenge")) {
        return streamResponse({
          challenge: {
            ideaId: body.idea.id,
            role: body.role,
            challenge: `${body.role}认为这个脑洞默认了用户愿意公开失败。`,
            risk: "用户会因为暴露失败而直接离开。",
            newDirection: "先做完全私密的个人复盘。",
            createdAt: "2026-07-08T00:00:00.000Z",
          },
        });
      }
      if (url.endsWith("/discussion")) {
        return streamResponse({ discussion: sampleDiscussion(body.idea) });
      }
      if (url.endsWith("/mix")) {
        return streamResponse({
          seed: {
            mixedTopic: "失败作品集博物馆",
            theme: "把旧项目的失败经验变成可以展示的资产",
            tension: "羞耻感和炫耀欲之间的拉扯",
            startingPrompt: "给独立开发者做一个能把烂尾仓库生成作品集展签的工具。",
            sourceIdeaTitles: (body.ideas ?? []).map((idea: IdeaCard) => idea.title),
            createdAt: "2026-07-08T00:00:00.000Z",
          },
        });
      }

      throw new Error(`unexpected url ${url}`);
    }),
  );
}

describe("ideaStore", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    installAiFetch();
    useIdeaStore.getState().reset();
  });

  it("generates words and keeps locked words during reroll", async () => {
    const store = useIdeaStore.getState();
    store.setTopic("开发者工具");
    await store.generateWords();

    const firstGroup = useIdeaStore.getState().groups[0];
    const lockedWord = firstGroup.words[0];
    useIdeaStore.getState().toggleWordLock(lockedWord.id);
    await useIdeaStore.getState().rerollUnlockedWords();

    const nextFirstGroup = useIdeaStore.getState().groups[0];
    expect(nextFirstGroup.words.some((word) => word.id === lockedWord.id && word.locked)).toBe(true);
  });

  it("generates ideas from selected words", async () => {
    const store = useIdeaStore.getState();
    store.setTopic("我想做一个有趣的开发者工具");
    await store.generateWords();
    await useIdeaStore.getState().generateIdeas();

    expect(useIdeaStore.getState().ideas.length).toBeGreaterThanOrEqual(3);
    expect(useIdeaStore.getState().activeIdeaId).toBeTruthy();
  });

  it("generates a mind map and toggles selectable nodes", async () => {
    const store = useIdeaStore.getState();
    store.setTopic("我只会前端，不知道做什么");
    await store.generateMindMap();

    const map = useIdeaStore.getState().mindMap;
    expect(map?.center.label).toBe("我只会前端，不知道做什么");

    const node = map?.nodes.find((item) => item.selectable && !item.selected);
    expect(node).toBeTruthy();
    useIdeaStore.getState().toggleMindNode(node!.id);

    expect(useIdeaStore.getState().mindMap?.nodes.find((item) => item.id === node!.id)?.selected).toBe(true);
    expect(useIdeaStore.getState().activeMindNodeId).toBe(node!.id);
  });

  it("ignores stale AI responses after a newer generation starts", async () => {
    const firstMap = deferred<Response>();
    let firstSignal: AbortSignal | undefined;
    let mapCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
        const url = String(_input);
        if (!url.endsWith("/map")) {
          throw new Error(`unexpected url ${url}`);
        }
        mapCalls += 1;
        if (mapCalls === 1) {
          firstSignal = init?.signal ?? undefined;
          return firstMap.promise;
        }
        return streamResponse({ map: sampleMindMap(body.topic) });
      }),
    );

    const store = useIdeaStore.getState();
    store.setTopic("旧主题");
    const first = store.generateMindMap();
    await Promise.resolve();
    store.setTopic("新主题");
    await useIdeaStore.getState().generateMindMap();
    firstMap.resolve(streamResponse({ map: sampleMindMap("旧主题") }));
    await first;

    expect(firstSignal?.aborted).toBe(true);
    expect(useIdeaStore.getState().topic).toBe("新主题");
    expect(useIdeaStore.getState().mindMap?.topic).toBe("新主题");
  });

  it("修改主题后丢弃仍在返回的旧导图", async () => {
    const pending = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(() => pending.promise));
    const store = useIdeaStore.getState();
    store.setTopic("旧主题");

    const request = useIdeaStore.getState().generateMindMap();
    await Promise.resolve();
    useIdeaStore.getState().setTopic("新主题");

    expect(useIdeaStore.getState().loading).toBe("idle");
    pending.resolve(streamResponse({ map: sampleMindMap("旧主题") }));
    await request;

    expect(useIdeaStore.getState().topic).toBe("新主题");
    expect(useIdeaStore.getState().mindMap).toBeUndefined();
  });

  it("修改强度取消旧请求并且旧请求不会改坏新请求的 loading", async () => {
    const first = deferred<Response>();
    const second = deferred<Response>();
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(() => (++calls === 1 ? first.promise : second.promise)));
    useIdeaStore.getState().setTopic("开发者工具");

    const oldRequest = useIdeaStore.getState().generateMindMap();
    await Promise.resolve();
    useIdeaStore.getState().setIntensity("狂野");
    expect(useIdeaStore.getState()).toMatchObject({ loading: "idle", streamText: "" });

    const newRequest = useIdeaStore.getState().generateMindMap();
    first.resolve(streamResponse({ map: sampleMindMap("旧强度结果") }));
    await oldRequest;
    expect(useIdeaStore.getState().loading).toBe("map");

    second.resolve(streamResponse({ map: sampleMindMap("开发者工具") }));
    await newRequest;
    expect(useIdeaStore.getState().mindMap?.topic).toBe("开发者工具");
  });

  it("重掷期间拖动节点后丢弃旧重掷结果", async () => {
    const pending = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(() => pending.promise));
    const originalMap = sampleMindMap("开发者工具");
    useIdeaStore.setState({ topic: "开发者工具", mindMap: originalMap, activeMindNodeId: "node-人群" });

    const request = useIdeaStore.getState().rerollMindMapUnlockedNodes();
    await Promise.resolve();
    const movableStore = useIdeaStore.getState() as typeof useIdeaStore extends { getState: () => infer TState }
      ? TState & { moveMindNode?: (nodeId: string, x: number, y: number) => void }
      : never;
    movableStore.moveMindNode?.("node-人群", 73, 64);
    pending.resolve(
      streamResponse({
        map: {
          ...originalMap,
          nodes: originalMap.nodes.map((node) => (node.id === "node-人群" ? { ...node, label: "旧重掷节点" } : node)),
        },
      }),
    );
    await request;

    const node = useIdeaStore.getState().mindMap?.nodes.find((item) => item.id === "node-人群");
    expect(node).toMatchObject({ x: 73, y: 64, label: "人群节点" });
  });

  it("支持本地节点新增、折叠、批量编辑和撤销重做", () => {
    const map = sampleMindMap("开发者工具");
    useIdeaStore.setState({ topic: map.topic, mindMap: map, activeMindNodeId: "node-人群" });
    const store = useIdeaStore.getState();

    store.addMindNode("我的观察", "物件");
    const created = useIdeaStore.getState().mindMap?.nodes.find((node) => node.label === "我的观察");
    expect(created).toMatchObject({ parentId: "node-人群", selectable: true, selected: true });
    expect(created?.x).toBeGreaterThan(0);

    store.toggleMindNodeCollapsed("node-人群");
    expect(useIdeaStore.getState().mindMap?.nodes.find((node) => node.id === "node-人群")?.collapsed).toBe(true);
    store.setMindNodesLocked(["node-人群", created?.id ?? ""] , true);
    expect(useIdeaStore.getState().mindMap?.nodes.find((node) => node.id === "node-人群")?.locked).toBe(true);

    store.undoMindMap();
    expect(useIdeaStore.getState().mindMap?.nodes.find((node) => node.id === "node-人群")?.locked).toBe(false);
    store.redoMindMap();
    expect(useIdeaStore.getState().mindMap?.nodes.find((node) => node.id === "node-人群")?.locked).toBe(true);
  });

  it("支持重命名、备注和重新挂载节点，并把每次修改写入撤销历史", () => {
    const map = sampleMindMap("开发者工具");
    const child = {
      ...map.nodes.find((node) => node.id === "node-物件")!,
      id: "node-child",
      label: "子节点",
      level: 2 as const,
      parentId: "node-人群",
      selected: false,
    };
    const mapWithChild = {
      ...map,
      nodes: [...map.nodes, child],
      edges: [...map.edges, { id: "edge-child", from: "node-人群", to: child.id, label: "旧关联" }],
    };
    useIdeaStore.setState({ mindMap: mapWithChild, activeMindNodeId: child.id, mindMapCanUndo: false, mindMapCanRedo: false });

    editingStore().renameMindNode(child.id, "  新标题  ");
    editingStore().updateMindNodeNote(child.id, "  一条关键观察  ");
    editingStore().reparentMindNode(child.id, "node-场景");

    const edited = useIdeaStore.getState().mindMap?.nodes.find((node) => node.id === child.id);
    expect(edited).toMatchObject({ label: "新标题", note: "一条关键观察", parentId: "node-场景", level: 2 });
    expect(useIdeaStore.getState().mindMap?.edges.some((edge) => edge.from === "node-场景" && edge.to === child.id)).toBe(true);
    expect(useIdeaStore.getState().mindMapCanUndo).toBe(true);

    useIdeaStore.getState().undoMindMap();
    expect(useIdeaStore.getState().mindMap?.nodes.find((node) => node.id === child.id)).toMatchObject({ label: "新标题", note: "一条关键观察", parentId: "node-人群" });
    useIdeaStore.getState().redoMindMap();
    expect(useIdeaStore.getState().mindMap?.nodes.find((node) => node.id === child.id)?.parentId).toBe("node-场景");
  });

  it("重命名中心节点时同步主题，并可随导图历史撤销重做", () => {
    const map = sampleMindMap("开发者工具");
    useIdeaStore.setState({ topic: map.topic, mindMap: map, activeMindNodeId: map.center.id });

    editingStore().renameMindNode(map.center.id, "新主题");
    expect(useIdeaStore.getState()).toMatchObject({ topic: "新主题", mindMap: { topic: "新主题", center: { label: "新主题" } } });

    useIdeaStore.getState().undoMindMap();
    expect(useIdeaStore.getState()).toMatchObject({ topic: "开发者工具", mindMap: { topic: "开发者工具", center: { label: "开发者工具" } } });
    useIdeaStore.getState().redoMindMap();
    expect(useIdeaStore.getState()).toMatchObject({ topic: "新主题", mindMap: { topic: "新主题", center: { label: "新主题" } } });
  });

  it("拒绝移动或删除中心节点，并阻止把父节点挂到自身后代", () => {
    const map = sampleMindMap("开发者工具");
    const child = {
      ...map.nodes.find((node) => node.id === "node-物件")!,
      id: "node-child",
      level: 2 as const,
      parentId: "node-人群",
      selected: false,
    };
    const grandchild = { ...child, id: "node-grandchild", level: 3 as const, parentId: child.id };
    const guardedMap = {
      ...map,
      nodes: [...map.nodes, child, grandchild],
      edges: [
        ...map.edges,
        { id: "edge-child", from: "node-人群", to: child.id, label: "子级" },
        { id: "edge-grandchild", from: child.id, to: grandchild.id, label: "孙级" },
      ],
    };
    useIdeaStore.setState({ mindMap: guardedMap, activeMindNodeId: "node-人群", mindMapCanUndo: false, mindMapCanRedo: false });

    editingStore().reparentMindNode(map.center.id, "node-场景");
    editingStore().reparentMindNode("node-人群", grandchild.id);
    editingStore().deleteMindNodeSubtree(map.center.id);

    const current = useIdeaStore.getState();
    expect(current.mindMap?.nodes.find((node) => node.id === "node-人群")?.parentId).toBe(map.center.id);
    expect(current.mindMap?.nodes.some((node) => node.id === map.center.id)).toBe(true);
    expect(current.mindMapCanUndo).toBe(false);
  });

  it("重新挂载会同步更新整支层级并保留无关连线", () => {
    const map = sampleMindMap("开发者工具");
    const child = {
      ...map.nodes.find((node) => node.id === "node-物件")!,
      id: "node-child",
      level: 2 as const,
      parentId: "node-人群",
      selected: false,
    };
    const grandchild = { ...child, id: "node-grandchild", level: 3 as const, parentId: child.id };
    const mapWithSubtree = {
      ...map,
      nodes: [...map.nodes, child, grandchild],
      edges: [
        ...map.edges,
        { id: "edge-child", from: "node-人群", to: child.id, label: "子级" },
        { id: "edge-grandchild", from: child.id, to: grandchild.id, label: "孙级" },
        { id: "edge-cross", from: "node-结构", to: child.id, label: "跨分支参考" },
      ],
    };
    useIdeaStore.setState({ mindMap: mapWithSubtree, activeMindNodeId: child.id });

    editingStore().reparentMindNode(child.id, map.center.id);

    const currentMap = useIdeaStore.getState().mindMap;
    expect(currentMap?.nodes.find((node) => node.id === child.id)).toMatchObject({ parentId: map.center.id, level: 1 });
    expect(currentMap?.nodes.find((node) => node.id === grandchild.id)?.level).toBe(2);
    expect(currentMap?.edges.some((edge) => edge.id === "edge-cross")).toBe(true);
    expect(currentMap?.edges.some((edge) => edge.from === map.center.id && edge.to === child.id)).toBe(true);
  });

  it("删除完整子树并同步清理连线、推荐和分组，活动节点回退到父节点", () => {
    const map = sampleMindMap("开发者工具");
    const child = {
      ...map.nodes.find((node) => node.id === "node-物件")!,
      id: "node-child",
      level: 2 as const,
      parentId: "node-人群",
      selected: false,
    };
    const grandchild = { ...child, id: "node-grandchild", level: 3 as const, parentId: child.id };
    const mapWithSubtree = {
      ...map,
      nodes: [...map.nodes, child, grandchild],
      edges: [
        ...map.edges,
        { id: "edge-child", from: "node-人群", to: child.id, label: "子级" },
        { id: "edge-grandchild", from: child.id, to: grandchild.id, label: "孙级" },
      ],
      recommendedNodeIds: [...map.recommendedNodeIds, child.id, grandchild.id],
    };
    useIdeaStore.setState({ mindMap: mapWithSubtree, activeMindNodeId: grandchild.id, mindMapCanUndo: false, mindMapCanRedo: false });
    editingStore().createMindNodeGroup("删除测试", [child.id, grandchild.id, "node-场景"]);

    editingStore().deleteMindNodeSubtree(child.id);

    const current = useIdeaStore.getState();
    expect(current.mindMap?.nodes.some((node) => [child.id, grandchild.id].includes(node.id))).toBe(false);
    expect(current.mindMap?.edges.some((edge) => [child.id, grandchild.id].includes(edge.from) || [child.id, grandchild.id].includes(edge.to))).toBe(false);
    expect(current.mindMap?.recommendedNodeIds.some((id) => [child.id, grandchild.id].includes(id))).toBe(false);
    expect(current.mindMap?.groups).toEqual([]);
    expect(current.mindMap?.nodes.find((node) => node.id === "node-场景")?.groupId).toBeUndefined();
    expect(current.activeMindNodeId).toBe("node-人群");

    useIdeaStore.getState().undoMindMap();
    expect(useIdeaStore.getState().mindMap?.nodes.some((node) => node.id === grandchild.id)).toBe(true);
  });

  it("按导图顺序创建分组，去重无效节点，并在成员不足时解散分组", () => {
    const map = sampleMindMap("开发者工具");
    useIdeaStore.setState({ mindMap: map, activeMindNodeId: "node-场景", mindMapCanUndo: false, mindMapCanRedo: false });

    editingStore().createMindNodeGroup("  核心分支  ", ["node-场景", "missing", "node-人群", "node-场景"]);

    const group = useIdeaStore.getState().mindMap?.groups?.[0];
    expect(group).toMatchObject({ name: "核心分支", nodeIds: ["node-人群", "node-场景"] });
    expect(group?.id).toEqual(expect.any(String));
    expect(group?.createdAt).toEqual(expect.any(String));
    expect(useIdeaStore.getState().mindMap?.nodes.filter((node) => group?.nodeIds.includes(node.id)).every((node) => node.groupId === group?.id)).toBe(true);

    editingStore().ungroupMindNodes(["node-人群"]);
    expect(useIdeaStore.getState().mindMap?.groups).toEqual([]);
    expect(useIdeaStore.getState().mindMap?.nodes.find((node) => node.id === "node-场景")?.groupId).toBeUndefined();

    useIdeaStore.getState().undoMindMap();
    expect(useIdeaStore.getState().mindMap?.groups?.[0]?.nodeIds).toEqual(["node-人群", "node-场景"]);
    useIdeaStore.getState().redoMindMap();
    expect(useIdeaStore.getState().mindMap?.groups).toEqual([]);

    useIdeaStore.getState().undoMindMap();
    useIdeaStore.getState().undoMindMap();
    editingStore().createMindNodeGroup("无效分组", ["node-人群", "missing", "node-人群"]);
    expect(useIdeaStore.getState().mindMap?.groups ?? []).toHaveLength(0);
  });

  it("节点编辑清除旧重做分支并立即持久化", () => {
    const map = sampleMindMap("开发者工具");
    useIdeaStore.setState({ mindMap: map, activeMindNodeId: "node-人群" });
    useIdeaStore.getState().toggleMindNodeLock("node-场景");
    useIdeaStore.getState().undoMindMap();
    expect(useIdeaStore.getState().mindMapCanRedo).toBe(true);

    editingStore().updateMindNodeNote("node-人群", "新证据");

    expect(useIdeaStore.getState().mindMapCanRedo).toBe(false);
    const stored = JSON.parse(localStorage.getItem("idea-lab:v2") ?? "{}") as { workspace?: { mindMap?: BrainstormMap } };
    expect(stored.workspace?.mindMap?.nodes.find((node) => node.id === "node-人群")?.note).toBe("新证据");
  });

  it("本地节点编辑会使进行中的旧 AI 导图请求失效", async () => {
    const pending = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(() => pending.promise));
    const map = sampleMindMap("开发者工具");
    useIdeaStore.setState({ topic: map.topic, mindMap: map, activeMindNodeId: "node-人群" });

    const request = useIdeaStore.getState().rerollMindMapUnlockedNodes();
    await Promise.resolve();
    editingStore().renameMindNode("node-人群", "保留我的命名");
    pending.resolve(streamResponse({ map: { ...map, nodes: map.nodes.map((node) => node.id === "node-人群" ? { ...node, label: "旧 AI 命名" } : node) } }));
    await request;

    expect(useIdeaStore.getState().mindMap?.nodes.find((node) => node.id === "node-人群")?.label).toBe("保留我的命名");
    expect(useIdeaStore.getState().loading).toBe("idle");
  });

  it("节点上下文面板保存标题、备注和父节点，并对删除执行二次确认", () => {
    const map = sampleMindMap("开发者工具");
    const node = map.nodes.find((item) => item.id === "node-人群")!;
    const onRename = vi.fn();
    const onUpdateNote = vi.fn();
    const onReparent = vi.fn();
    const onDelete = vi.fn();

    render(createElement(MindMapContextPanel, {
      node,
      nodes: map.nodes,
      center: map.center,
      onRename,
      onUpdateNote,
      onReparent,
      onDelete,
      onClose: vi.fn(),
    }));

    fireEvent.change(screen.getByLabelText("节点标题"), { target: { value: "新的人群" } });
    fireEvent.change(screen.getByLabelText("节点备注"), { target: { value: "来自访谈" } });
    fireEvent.change(screen.getByLabelText("父节点"), { target: { value: "node-场景" } });
    fireEvent.submit(screen.getByRole("form", { name: "编辑节点" }));

    expect(onRename).toHaveBeenCalledWith(node.id, "新的人群");
    expect(onUpdateNote).toHaveBeenCalledWith(node.id, "来自访谈");
    expect(onReparent).toHaveBeenCalledWith(node.id, "node-场景");

    fireEvent.click(screen.getByRole("button", { name: "删除分支" }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "确认删除分支" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("form", { name: "编辑节点" }), { key: "Escape" });
    expect(screen.queryByRole("button", { name: "确认删除分支" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "删除分支" }));
    fireEvent.click(screen.getByRole("button", { name: "确认删除分支" }));
    expect(onDelete).toHaveBeenCalledWith(node.id);
  });

  it("中心节点上下文面板禁用改父和删除操作", () => {
    const map = sampleMindMap("开发者工具");
    render(createElement(MindMapContextPanel, {
      node: map.center,
      nodes: map.nodes,
      center: map.center,
      onRename: vi.fn(),
      onUpdateNote: vi.fn(),
      onReparent: vi.fn(),
      onDelete: vi.fn(),
      onClose: vi.fn(),
    }));

    expect(screen.getByLabelText("父节点")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "删除分支" })).not.toBeInTheDocument();
  });

  it("按节点边界计算轻量分组轮廓并忽略成员不足的分组", () => {
    const map = sampleMindMap("开发者工具");
    const hulls = computeMindMapGroupHulls(
      [
        { id: "group-1", name: "核心分支", nodeIds: ["node-人群", "node-情绪"], createdAt: "2026-07-11T00:00:00.000Z" },
        { id: "group-invalid", name: "孤立", nodeIds: ["missing", "node-场景"], createdAt: "2026-07-11T00:00:00.000Z" },
      ],
      map.nodes,
      4,
    );

    expect(hulls).toEqual([{ id: "group-1", name: "核心分支", left: 16, top: 26, width: 28, height: 18 }]);
  });

  it("重复批量选择和锁定不会占用撤销历史", () => {
    const map = sampleMindMap("开发者工具");
    const selectedIds = map.nodes.filter((node) => node.selected).map((node) => node.id);
    useIdeaStore.setState({ mindMap: map, activeMindNodeId: selectedIds.at(-1), mindMapCanUndo: false, mindMapCanRedo: false });

    useIdeaStore.getState().setMindNodesSelected(selectedIds);
    useIdeaStore.getState().setMindNodesLocked(["node-人群"], false);

    expect(useIdeaStore.getState().mindMapCanUndo).toBe(false);
    expect(useIdeaStore.getState().mindMapCanRedo).toBe(false);
  });

  it("导图撤销历史最多保留 50 步", () => {
    const map = sampleMindMap("开发者工具");
    const nodeId = "node-人群";
    useIdeaStore.setState({ mindMap: map, activeMindNodeId: nodeId, mindMapCanUndo: false, mindMapCanRedo: false });

    for (let edit = 1; edit <= 55; edit += 1) {
      editingStore().renameMindNode(nodeId, `第 ${edit} 次编辑`);
    }

    expect(useIdeaStore.getState().mindMap?.nodes.find((node) => node.id === nodeId)?.label).toBe("第 55 次编辑");
    expect(useIdeaStore.getState().mindMapCanUndo).toBe(true);

    for (let undo = 0; undo < 50; undo += 1) {
      useIdeaStore.getState().undoMindMap();
    }

    expect(useIdeaStore.getState().mindMap?.nodes.find((node) => node.id === nodeId)?.label).toBe("第 5 次编辑");
    expect(useIdeaStore.getState().mindMapCanUndo).toBe(false);

    useIdeaStore.getState().undoMindMap();
    expect(useIdeaStore.getState().mindMap?.nodes.find((node) => node.id === nodeId)?.label).toBe("第 5 次编辑");
  });

  it("把一次拖动中的多次移动合并为一个可撤销历史", () => {
    const map = sampleMindMap("开发者工具");
    const original = map.nodes.find((node) => node.id === "node-人群");
    useIdeaStore.setState({ mindMap: map, activeMindNodeId: "node-人群" });

    useIdeaStore.getState().beginMindMapEdit();
    useIdeaStore.getState().moveMindNode("node-人群", 60, 60);
    useIdeaStore.getState().moveMindNode("node-人群", 72, 68);
    useIdeaStore.getState().endMindMapEdit();
    useIdeaStore.getState().undoMindMap();

    expect(useIdeaStore.getState().mindMap?.nodes.find((node) => node.id === "node-人群")).toMatchObject({ x: original?.x, y: original?.y });
  });

  it("新导图生成后不会撤销回上一张导图", async () => {
    const oldMap = sampleMindMap("旧主题");
    useIdeaStore.setState({ topic: "旧主题", mindMap: oldMap, activeMindNodeId: "node-人群" });
    useIdeaStore.getState().toggleMindNodeLock("node-人群");
    expect(useIdeaStore.getState().mindMapCanUndo).toBe(true);

    useIdeaStore.getState().setTopic("新主题");
    await useIdeaStore.getState().generateMindMap();
    useIdeaStore.getState().undoMindMap();

    expect(useIdeaStore.getState().mindMap?.topic).toBe("新主题");
    expect(useIdeaStore.getState().mindMapCanUndo).toBe(false);
  });

  it("撤销和重做保留当时的活动分支", () => {
    const map = sampleMindMap("开发者工具");
    useIdeaStore.setState({ mindMap: map, activeMindNodeId: "node-场景" });
    useIdeaStore.getState().toggleMindNodeLock("node-人群");
    useIdeaStore.getState().undoMindMap();
    expect(useIdeaStore.getState().activeMindNodeId).toBe("node-场景");
    useIdeaStore.getState().redoMindMap();
    expect(useIdeaStore.getState().activeMindNodeId).toBe("node-人群");
  });

  it("继续发散折叠节点时自动展开父分支", async () => {
    const map = sampleMindMap("开发者工具");
    useIdeaStore.setState({ topic: map.topic, mindMap: { ...map, nodes: map.nodes.map((node) => node.id === "node-人群" ? { ...node, collapsed: true } : node) }, activeMindNodeId: "node-人群" });
    await useIdeaStore.getState().expandActiveMindNode();

    expect(useIdeaStore.getState().mindMap?.nodes.find((node) => node.id === "node-人群")?.collapsed).toBe(false);
    expect(useIdeaStore.getState().mindMap?.nodes.some((node) => node.id === "expand-object")).toBe(true);
  });

  it("重掷期间锁定节点后丢弃旧重掷结果", async () => {
    const pending = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(() => pending.promise));
    const originalMap = sampleMindMap("开发者工具");
    useIdeaStore.setState({ topic: "开发者工具", mindMap: originalMap, activeMindNodeId: "node-人群" });

    const request = useIdeaStore.getState().rerollMindMapUnlockedNodes();
    await Promise.resolve();
    useIdeaStore.getState().toggleMindNodeLock("node-人群");
    pending.resolve(streamResponse({ map: originalMap }));
    await request;

    expect(useIdeaStore.getState().mindMap?.nodes.find((node) => node.id === "node-人群")?.locked).toBe(true);
  });

  it("重掷期间选择节点会立即安全结束旧 loading", async () => {
    const pending = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(() => pending.promise));
    const originalMap = sampleMindMap("开发者工具");
    useIdeaStore.setState({ topic: "开发者工具", mindMap: originalMap, activeMindNodeId: "node-人群", streamText: "生成中" });

    const request = useIdeaStore.getState().rerollMindMapUnlockedNodes();
    await Promise.resolve();
    useIdeaStore.getState().toggleMindNode("node-人群");

    expect(useIdeaStore.getState()).toMatchObject({ loading: "idle", streamText: "" });
    pending.resolve(streamResponse({ map: originalMap }));
    await request;
  });

  it("变形等待中切换脑洞后丢弃旧响应", async () => {
    const pending = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(() => pending.promise));
    const ideas = sampleIdeas();
    useIdeaStore.setState({ ideas, activeIdeaId: ideas[0]!.id });

    const request = useIdeaStore.getState().transformActiveIdea("更实用一点");
    await Promise.resolve();
    useIdeaStore.getState().setActiveIdea(ideas[1]!.id);
    pending.resolve(
      streamResponse({
        idea: { ...ideas[0], id: "stale-transform", parentId: ideas[0]!.id, transformDirection: "更实用一点" },
      }),
    );
    await request;

    expect(useIdeaStore.getState().activeIdeaId).toBe(ideas[1]!.id);
    expect(useIdeaStore.getState().ideas.some((idea) => idea.id === "stale-transform")).toBe(false);
    expect(useIdeaStore.getState()).toMatchObject({ loading: "idle", streamText: "" });
  });

  it("generates ideas from selected mind map nodes", async () => {
    const store = useIdeaStore.getState();
    store.setTopic("AI 产品灵感");
    await store.generateMindMap();
    await useIdeaStore.getState().generateIdeasFromMindMap();

    expect(useIdeaStore.getState().ideas.length).toBeGreaterThanOrEqual(3);
    expect(useIdeaStore.getState().groups).toHaveLength(6);
    expect(useIdeaStore.getState().activeIdeaId).toBeTruthy();
  });

  it("生成脑洞时保存稳定的来源节点、活动节点、镜头快照和碰撞配方", async () => {
    const map = sampleMindMap("开发者工具");
    const viewport = { panX: 128, panY: -64, scale: 1.45 };
    useIdeaStore.setState({ topic: map.topic, mindMap: map, activeMindNodeId: "node-场景" });

    await useIdeaStore.getState().generateIdeasFromMindMap(viewport, "borrow-structure");

    const sourceNodeIds = Array.from(new Set([
      ...map.nodes.filter((node) => node.selectable && node.selected).map((node) => node.id),
      ...map.recommendedNodeIds,
    ])).filter((nodeId) => map.nodes.some((node) => node.id === nodeId && node.selectable));
    const expectedOrigin = {
      mapId: map.id,
      sourceNodeIds,
      activeNodeId: "node-场景",
      viewport,
      collisionRecipe: "borrow-structure",
    };
    expect(useIdeaStore.getState().ideas.every((idea) => idea.origin && JSON.stringify(idea.origin) === JSON.stringify(expectedOrigin))).toBe(true);
    expect(useIdeaStore.getState().ideas[0]?.sourcePath?.[0]).toBe(map.center.label);

    useIdeaStore.getState().reset();
    useIdeaStore.getState().hydrate();
    expect(useIdeaStore.getState().ideas[0]?.origin).toEqual(expectedOrigin);
  });

  it("保留 API 为每个脑洞返回的不同来源路径，仅为缺失路径的脑洞补推导路径", async () => {
    const map = sampleMindMap("开发者工具");
    const [firstIdea, secondIdea, thirdIdea] = sampleIdeas();
    const { sourcePath: _ignoredSourcePath, ...thirdIdeaWithoutPath } = thirdIdea!;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => streamResponse({
        ideas: [
          { ...firstIdea!, sourcePath: ["API 路径一", "独立来源一"] },
          { ...secondIdea!, sourcePath: ["API 路径二", "独立来源二"] },
          thirdIdeaWithoutPath,
        ],
      })),
    );
    useIdeaStore.setState({ topic: map.topic, mindMap: map, activeMindNodeId: "node-场景" });

    await useIdeaStore.getState().generateIdeasFromMindMap();

    expect(useIdeaStore.getState().ideas.map((idea) => idea.sourcePath)).toEqual([
      ["API 路径一", "独立来源一"],
      ["API 路径二", "独立来源二"],
      ["开发者工具", "人群节点", "场景节点", "情绪节点", "物件节点", "结构节点", "限制节点"],
    ]);
  });

  it("来源不足时按推荐顺序过滤并保存仍存在的可选节点", async () => {
    const baseMap = sampleMindMap("开发者工具");
    const map: BrainstormMap = {
      ...baseMap,
      nodes: baseMap.nodes.map((node) => ({ ...node, selected: false })),
      recommendedNodeIds: ["node-结构", "missing", "center", "node-人群", "node-结构", "node-场景"],
    };
    useIdeaStore.setState({ topic: map.topic, mindMap: map, activeMindNodeId: undefined });

    await useIdeaStore.getState().generateIdeasFromMindMap();

    expect(useIdeaStore.getState().ideas[0]?.origin).toMatchObject({
      sourceNodeIds: ["node-结构", "node-人群", "node-场景"],
      activeNodeId: "node-场景",
    });
  });

  it("生成脑洞时活动节点不在来源集合内会回退到最后一个来源节点", async () => {
    const baseMap = sampleMindMap("开发者工具");
    const map: BrainstormMap = {
      ...baseMap,
      nodes: baseMap.nodes.map((node) => ({ ...node, selected: false })),
      recommendedNodeIds: ["node-人群"],
    };
    useIdeaStore.setState({ topic: map.topic, mindMap: map, activeMindNodeId: "node-场景" });

    await useIdeaStore.getState().generateIdeasFromMindMap();

    expect(useIdeaStore.getState().ideas[0]?.origin).toMatchObject({
      sourceNodeIds: ["node-人群"],
      activeNodeId: "node-人群",
    });
  });

  it("来源不足时按稳定顺序合并已有选择和有效推荐节点", async () => {
    const baseMap = sampleMindMap("开发者工具");
    const map: BrainstormMap = {
      ...baseMap,
      nodes: baseMap.nodes.map((node) => ({ ...node, selected: node.id === "node-人群" || node.id === "node-情绪" })),
      recommendedNodeIds: ["node-结构", "missing", "center", "node-人群", "node-场景", "node-结构"],
    };
    useIdeaStore.setState({ topic: map.topic, mindMap: map, activeMindNodeId: undefined });

    await useIdeaStore.getState().generateIdeasFromMindMap();

    expect(useIdeaStore.getState().ideas[0]?.origin).toMatchObject({
      sourceNodeIds: ["node-人群", "node-情绪", "node-结构", "node-场景"],
      activeNodeId: "node-场景",
    });
  });

  it("没有任何有效来源节点时在请求前明确失败", async () => {
    const baseMap = sampleMindMap("开发者工具");
    const map: BrainstormMap = {
      ...baseMap,
      nodes: baseMap.nodes.map((node) => ({ ...node, selected: false })),
      recommendedNodeIds: ["missing", "center"],
    };
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    useIdeaStore.setState({ topic: map.topic, mindMap: map, ideas: [], activeMindNodeId: undefined });

    await useIdeaStore.getState().generateIdeasFromMindMap();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(useIdeaStore.getState().ideas).toEqual([]);
    expect(useIdeaStore.getState().error).toContain("来源节点");
  });

  it("恢复脑洞来源时展开全部祖先、重选来源并发布一次性导航意图", () => {
    const baseMap = sampleMindMap("开发者工具");
    const nestedNode = {
      id: "node-nested",
      label: "项目遗迹",
      category: "远联想" as const,
      level: 2 as const,
      x: 18,
      y: 24,
      selectable: true,
      locked: false,
      selected: false,
      reason: "从人群继续联想",
      parentId: "node-人群",
    };
    const map: BrainstormMap = {
      ...baseMap,
      nodes: [
        ...baseMap.nodes.map((node) => ({
          ...node,
          selected: node.id === "node-场景",
          ...(node.id === "node-人群" ? { collapsed: true } : {}),
        })),
        nestedNode,
      ],
      edges: [...baseMap.edges, { id: "edge-nested", from: "node-人群", to: nestedNode.id, label: "继续联想" }],
    };
    const origin = {
      mapId: map.id,
      sourceNodeIds: ["node-人群", nestedNode.id],
      activeNodeId: nestedNode.id,
      viewport: { panX: 80, panY: -32, scale: 1.3 },
      collisionRecipe: "invert-assumption" as const,
    };
    const idea = { ...sampleIdeas()[0]!, origin };
    useIdeaStore.setState({ mindMap: map, ideas: [idea], activeIdeaId: idea.id, activeMindNodeId: "node-场景" });

    const restored = useIdeaStore.getState().restoreIdeaOrigin(idea.id, "node-人群");

    const state = useIdeaStore.getState();
    expect(restored).toBe(true);
    expect(state.mindMap?.nodes.filter((node) => node.selectable && node.selected).map((node) => node.id)).toEqual(origin.sourceNodeIds);
    expect(state.mindMap?.nodes.find((node) => node.id === "node-人群")?.collapsed).toBe(false);
    expect(state.activeMindNodeId).toBe("node-人群");
    expect(state.mindMapNavigationIntent).toEqual({ ...origin, activeNodeId: "node-人群", focusNodeId: "node-人群" });
    const restoredMap = state.mindMap;

    useIdeaStore.getState().consumeMindMapNavigationIntent();

    expect(useIdeaStore.getState().mindMapNavigationIntent).toBeUndefined();
    expect(useIdeaStore.getState().mindMap).toBe(restoredMap);
    const raw = JSON.parse(localStorage.getItem("idea-lab:v2") ?? "{}") as { workspace?: Record<string, unknown> };
    expect(raw.workspace?.mindMapNavigationIntent).toBeUndefined();
  });

  it("当前导图与来源不匹配时返回失败且不改动导图状态", () => {
    const map = sampleMindMap("当前主题");
    const idea = {
      ...sampleIdeas()[0]!,
      origin: {
        mapId: "another-map",
        sourceNodeIds: ["node-人群"],
        activeNodeId: "node-人群",
        viewport: { panX: 0, panY: 0, scale: 1 },
      },
    };
    const pendingIntent = {
      mapId: map.id,
      sourceNodeIds: ["node-场景"],
      activeNodeId: "node-场景",
      viewport: { panX: 12, panY: -8, scale: 1.1 },
    };
    useIdeaStore.setState({ mindMap: map, ideas: [idea], activeMindNodeId: "node-场景", mindMapNavigationIntent: pendingIntent });
    const beforeMap = structuredClone(map);

    const restored = useIdeaStore.getState().restoreIdeaOrigin(idea.id);

    expect(restored).toBe(false);
    expect(useIdeaStore.getState().mindMap).toEqual(beforeMap);
    expect(useIdeaStore.getState().activeMindNodeId).toBe("node-场景");
    expect(useIdeaStore.getState().mindMapNavigationIntent).toBe(pendingIntent);
    expect(useIdeaStore.getState().error).toContain("来源导图");
  });

  it("恢复脑洞来源时活动节点不在来源集合内会回退到最后一个来源节点", () => {
    const map = sampleMindMap("当前主题");
    const idea = {
      ...sampleIdeas()[0]!,
      origin: {
        mapId: map.id,
        sourceNodeIds: ["node-人群"],
        activeNodeId: "node-场景",
        viewport: { panX: 40, panY: -20, scale: 1.2 },
      },
    };
    useIdeaStore.setState({ mindMap: map, ideas: [idea], activeMindNodeId: "node-场景" });

    const restored = useIdeaStore.getState().restoreIdeaOrigin(idea.id);

    expect(restored).toBe(true);
    expect(useIdeaStore.getState().activeMindNodeId).toBe("node-人群");
    expect(useIdeaStore.getState().mindMapNavigationIntent?.activeNodeId).toBe("node-人群");
  });

  it("任一来源节点缺失时返回失败且保持原选择、活动节点和导航意图", () => {
    const map = sampleMindMap("当前主题");
    const idea = {
      ...sampleIdeas()[0]!,
      origin: {
        mapId: map.id,
        sourceNodeIds: ["node-人群", "missing-node"],
        activeNodeId: "node-人群",
        viewport: { panX: 40, panY: -20, scale: 1.2 },
      },
    };
    const pendingIntent = {
      mapId: map.id,
      sourceNodeIds: ["node-场景"],
      activeNodeId: "node-场景",
      viewport: { panX: 12, panY: -8, scale: 1.1 },
    };
    const beforeMap = structuredClone(map);
    useIdeaStore.setState({ mindMap: map, ideas: [idea], activeMindNodeId: "node-场景", mindMapNavigationIntent: pendingIntent });

    const restored = useIdeaStore.getState().restoreIdeaOrigin(idea.id);

    expect(restored).toBe(false);
    expect(useIdeaStore.getState().mindMap).toEqual(beforeMap);
    expect(useIdeaStore.getState().activeMindNodeId).toBe("node-场景");
    expect(useIdeaStore.getState().mindMapNavigationIntent).toBe(pendingIntent);
    expect(useIdeaStore.getState().error).toContain("节点已经不存在");
  });

  it("旧脑洞缺少来源快照时安全返回失败", () => {
    const map = sampleMindMap("当前主题");
    const legacyIdea = sampleIdeas()[0]!;
    useIdeaStore.setState({ mindMap: map, ideas: [legacyIdea], activeMindNodeId: "node-场景" });

    const restored = useIdeaStore.getState().restoreIdeaOrigin(legacyIdea.id);

    expect(restored).toBe(false);
    expect(useIdeaStore.getState().activeMindNodeId).toBe("node-场景");
    expect(useIdeaStore.getState().error).toContain("来源快照");
  });

  it("变形接口漏掉来源字段时保留原脑洞的来源快照和路径", async () => {
    const map = sampleMindMap("开发者工具");
    const originalIdea: IdeaCard = {
      ...sampleIdeas()[0]!,
      origin: {
        mapId: map.id,
        sourceNodeIds: ["node-人群", "node-场景"],
        activeNodeId: "node-场景",
        viewport: { panX: 24, panY: -16, scale: 0.92 },
      },
    };
    const { origin: _origin, sourcePath: _sourcePath, ...responseIdea } = originalIdea;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => streamResponse({
        idea: {
          ...responseIdea,
          id: "idea-transform-with-origin",
          parentId: originalIdea.id,
          transformDirection: "更实用一点",
        },
      })),
    );
    useIdeaStore.setState({ mindMap: map, ideas: [originalIdea], activeIdeaId: originalIdea.id });

    await useIdeaStore.getState().transformActiveIdea("更实用一点");

    const transformed = useIdeaStore.getState().ideas[0];
    expect(transformed?.origin).toEqual(originalIdea.origin);
    expect(transformed?.sourcePath).toEqual(originalIdea.sourcePath);
  });

  it("keeps the reroll nonce out of the visible topic sent to the model", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
        bodies.push(body);
        return streamResponse({ groups: sampleGroups() });
      }),
    );

    const store = useIdeaStore.getState();
    store.setTopic("开发者工具");
    await store.generateWords();
    await useIdeaStore.getState().rerollUnlockedWords();

    expect(bodies[1]?.topic).toBe("开发者工具");
    expect(bodies[1]?.cacheNonce).toEqual(expect.any(String));
  });

  it("rerolls unlocked mind map nodes through AI", async () => {
    const store = useIdeaStore.getState();
    store.setTopic("开发者工具");
    await store.generateMindMap();

    const lockedNode = useIdeaStore.getState().mindMap!.nodes.find((node) => node.selectable && node.category === "人群")!;
    useIdeaStore.getState().toggleMindNodeLock(lockedNode.id);
    const beforeLabels = new Map(useIdeaStore.getState().mindMap!.nodes.map((node) => [node.id, node.label]));

    await useIdeaStore.getState().rerollMindMapUnlockedNodes();
    const fetchCalls = (fetch as unknown as { mock: { calls: Array<[string, RequestInit]> } }).mock.calls;
    const rerollCall = fetchCalls.find(([url]) => String(url).endsWith("/map/reroll"));

    expect(rerollCall).toBeTruthy();
    expect(useIdeaStore.getState().mindMap!.nodes.find((node) => node.id === lockedNode.id)?.label).toBe(lockedNode.label);
    expect(useIdeaStore.getState().mindMap!.nodes.some((node) => node.selectable && !node.locked && node.label !== beforeLabels.get(node.id))).toBe(true);
  });

  it("surfaces LLM errors when mind map reroll fails without local fallback", async () => {
    useIdeaStore.setState({
      topic: "开发者工具",
      intensity: "正常",
      mindMap: sampleMindMap("开发者工具"),
      loading: "idle",
      streamText: "",
      error: undefined,
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("reroll failed")));

    await useIdeaStore.getState().rerollMindMapUnlockedNodes();

    expect(useIdeaStore.getState().mindMap?.nodes.find((node) => node.id === "node-人群")?.label).toBe("人群节点");
    expect(useIdeaStore.getState().loading).toBe("idle");
    expect(useIdeaStore.getState().error).toBe("LLM 有问题：reroll failed");
  });

  it("expands the active mind map node through AI and appends returned dimension nodes", async () => {
    const store = useIdeaStore.getState();
    store.setTopic("游戏机制产品");
    await store.generateMindMap();
    const activeNodeId = useIdeaStore.getState().activeMindNodeId!;
    const beforeCount = useIdeaStore.getState().mindMap!.nodes.length;

    await useIdeaStore.getState().expandActiveMindNode();

    const map = useIdeaStore.getState().mindMap!;
    const fetchCalls = (fetch as unknown as { mock: { calls: Array<[string, RequestInit]> } }).mock.calls;
    const expandCall = fetchCalls.find(([url]) => String(url).endsWith("/map/expand"));
    expect(expandCall?.[1].body).toContain(`"nodeId":"${activeNodeId}"`);
    expect(map.nodes).toHaveLength(beforeCount + 2);
    expect(map.nodes.some((node) => node.label === "撤销按钮" && node.parentId === activeNodeId)).toBe(true);
    expect(map.edges.some((edge) => edge.from === activeNodeId && edge.to === "expand-object")).toBe(true);
    expect(useIdeaStore.getState().activeMindNodeId).toBe("expand-object");
    expect(useIdeaStore.getState().loading).toBe("idle");
  });

  it("surfaces LLM errors when active node expansion fails without local fallback", async () => {
    useIdeaStore.setState({
      topic: "游戏机制产品",
      intensity: "正常",
      mindMap: sampleMindMap("游戏机制产品"),
      activeMindNodeId: "node-情绪",
      loading: "idle",
      streamText: "",
      error: undefined,
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("expand failed")));

    await useIdeaStore.getState().expandActiveMindNode();

    expect(useIdeaStore.getState().mindMap?.nodes.some((node) => node.label === "撤销按钮")).toBe(false);
    expect(useIdeaStore.getState().loading).toBe("idle");
    expect(useIdeaStore.getState().error).toBe("LLM 有问题：expand failed");
  });

  it("uses AI to recommend collision words instead of local random selection", async () => {
    const store = useIdeaStore.getState();
    store.setTopic("开发者工具");
    await store.generateWords();

    await useIdeaStore.getState().recommendCollision();

    const fetchCalls = (fetch as unknown as { mock: { calls: Array<[string, RequestInit]> } }).mock.calls;
    const collisionCall = fetchCalls.find(([url]) => String(url).endsWith("/collision"));
    expect(collisionCall).toBeTruthy();
    for (const group of useIdeaStore.getState().groups) {
      expect(group.words.find((word) => word.id === `word-${group.type}-alt`)?.selected).toBe(true);
    }
  });

  it("keeps locked words when applying an AI collision recommendation", async () => {
    const store = useIdeaStore.getState();
    store.setTopic("开发者工具");
    await store.generateWords();
    const lockedWord = useIdeaStore.getState().groups[0]!.words[0]!;
    useIdeaStore.getState().toggleWordLock(lockedWord.id);

    await useIdeaStore.getState().recommendCollision();

    expect(useIdeaStore.getState().groups[0]?.words.find((word) => word.id === lockedWord.id)?.selected).toBe(true);
    expect(useIdeaStore.getState().groups[0]?.words.find((word) => word.id === `word-${DIMENSION_GROUPS[0]}-alt`)?.selected).toBe(false);
  });

  it("surfaces LLM errors when collision recommendation fails without random fallback", async () => {
    useIdeaStore.setState({
      topic: "开发者工具",
      groups: sampleGroups(),
      loading: "idle",
      streamText: "",
      error: undefined,
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("collision failed")));

    await useIdeaStore.getState().recommendCollision();

    expect(useIdeaStore.getState().groups[0]?.words[0]?.selected).toBe(true);
    expect(useIdeaStore.getState().loading).toBe("idle");
    expect(useIdeaStore.getState().error).toBe("LLM 有问题：collision failed");
  });

  it("persists favorites in localStorage", async () => {
    const store = useIdeaStore.getState();
    store.setTopic("内容选题");
    await store.generateWords();
    await useIdeaStore.getState().generateIdeas();

    const idea = useIdeaStore.getState().ideas[0];
    useIdeaStore.getState().toggleFavorite(idea.id);
    useIdeaStore.getState().reset();
    useIdeaStore.getState().hydrate();

    expect(useIdeaStore.getState().favorites).toHaveLength(1);
  });

  it("分别恢复新工作区和孵化箱里的炼化成果", async () => {
    const store = useIdeaStore.getState();
    store.setTopic("内容选题");
    await store.generateWords();
    await useIdeaStore.getState().generateIdeas();
    await useIdeaStore.getState().refineActiveIdea();

    const incubatedIdeaId = useIdeaStore.getState().activeIdeaId!;
    useIdeaStore.getState().chooseRefinementAction(incubatedIdeaId, "放入孵化箱");
    useIdeaStore.getState().setTopic("新的工作区");
    await useIdeaStore.getState().generateMindMap();

    useIdeaStore.getState().reset();
    useIdeaStore.getState().hydrate();

    const restored = useIdeaStore.getState();
    expect(restored.topic).toBe("新的工作区");
    expect(restored.mindMap?.topic).toBe("新的工作区");
    expect(restored.favorites.map((favorite) => favorite.idea.id)).toContain(incubatedIdeaId);
    expect(restored.refinementsByIdeaId[incubatedIdeaId]?.ideaId).toBe(incubatedIdeaId);
    expect(restored.refinementActionsByIdeaId[incubatedIdeaId]).toBe("放入孵化箱");
  });

  it("本地写入失败时保留内存内容并显示反馈", async () => {
    const store = useIdeaStore.getState();
    store.setTopic("内容选题");
    await store.generateWords();
    await useIdeaStore.getState().generateIdeas();
    const ideaId = useIdeaStore.getState().ideas[0]!.id;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });

    useIdeaStore.getState().toggleFavorite(ideaId);

    expect(useIdeaStore.getState().favorites.map((favorite) => favorite.idea.id)).toContain(ideaId);
    expect(useIdeaStore.getState().error).toContain("保存失败");
  });

  it("refines the active idea and stores the result under the idea id", async () => {
    const store = useIdeaStore.getState();
    store.setTopic("内容选题");
    await store.generateWords();
    await useIdeaStore.getState().generateIdeas();

    await useIdeaStore.getState().refineActiveIdea();

    const ideaId = useIdeaStore.getState().activeIdeaId!;
    const refinement = useIdeaStore.getState().refinementsByIdeaId[ideaId];
    expect(refinement.vitality.targetUser).toBe("独立开发者");
    expect(refinement.roundtable).toHaveLength(6);
    expect(useIdeaStore.getState().loading).toBe("idle");
  });

  it("按角色生成挑战，同角色替换旧结果并持久化", async () => {
    const idea = sampleIdeas()[0]!;
    const engineerChallenge = {
      ideaId: idea.id,
      role: "工程师" as const,
      challenge: "实现成本被低估了。",
      risk: "首版无法按时完成。",
      newDirection: "先手工生成展签。",
      createdAt: "2026-07-07T00:00:00.000Z",
    };
    const oldChallenge = {
      ideaId: idea.id,
      role: "毒舌用户" as const,
      challenge: "旧质疑",
      risk: "旧风险",
      newDirection: "旧方向",
      createdAt: "2026-07-07T00:00:00.000Z",
    };
    useIdeaStore.setState({
      ideas: [idea],
      activeIdeaId: idea.id,
      challengesByIdeaId: { [idea.id]: [oldChallenge, engineerChallenge] },
    });

    await useIdeaStore.getState().challengeIdea(idea.id, "毒舌用户");

    const challenges = useIdeaStore.getState().challengesByIdeaId[idea.id] ?? [];
    expect(challenges).toHaveLength(2);
    expect(challenges.find((item) => item.role === "毒舌用户")?.challenge).toContain("默认了用户愿意公开失败");
    expect(challenges.find((item) => item.role === "工程师")).toEqual(engineerChallenge);
    expect(useIdeaStore.getState().loading).toBe("idle");

    useIdeaStore.getState().reset();
    useIdeaStore.getState().hydrate();
    expect(useIdeaStore.getState().challengesByIdeaId[idea.id]).toHaveLength(2);
  });

  it("挑战请求失败时保留该脑洞已有挑战", async () => {
    const idea = sampleIdeas()[0]!;
    const previous = {
      ideaId: idea.id,
      role: "懒人用户" as const,
      challenge: "步骤太多。",
      risk: "用户不会开始。",
      newDirection: "压缩成一步。",
      createdAt: "2026-07-07T00:00:00.000Z",
    };
    useIdeaStore.setState({ ideas: [idea], activeIdeaId: idea.id, challengesByIdeaId: { [idea.id]: [previous] } });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("challenge failed")));

    await useIdeaStore.getState().challengeIdea(idea.id, "懒人用户");

    expect(useIdeaStore.getState().challengesByIdeaId[idea.id]).toEqual([previous]);
    expect(useIdeaStore.getState().loading).toBe("idle");
    expect(useIdeaStore.getState().error).toBe("LLM 有问题：challenge failed");
  });

  it("切换活动脑洞后丢弃仍在返回的旧挑战", async () => {
    const [firstIdea, secondIdea] = sampleIdeas();
    const pending = deferred<Response>();
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return pending.promise;
    }));
    useIdeaStore.setState({ ideas: [firstIdea!, secondIdea!], activeIdeaId: firstIdea!.id, challengesByIdeaId: {} });

    const request = useIdeaStore.getState().challengeIdea(firstIdea!.id, "极端用户");
    await Promise.resolve();
    useIdeaStore.getState().setActiveIdea(secondIdea!.id);
    pending.resolve(streamResponse({
      challenge: {
        ideaId: firstIdea!.id,
        role: "极端用户",
        challenge: "旧挑战",
        risk: "旧风险",
        newDirection: "旧方向",
        createdAt: "2026-07-08T00:00:00.000Z",
      },
    }));
    await request;

    expect(signal?.aborted).toBe(true);
    expect(useIdeaStore.getState().challengesByIdeaId[firstIdea!.id]).toBeUndefined();
    expect(useIdeaStore.getState().activeIdeaId).toBe(secondIdea!.id);
  });

  it("完成圆桌讨论后保留历史并按讨论 id 去重", async () => {
    const idea = sampleIdeas()[0]!;
    const previous = sampleDiscussion(idea, "discussion-old");
    useIdeaStore.setState({ ideas: [idea], activeIdeaId: idea.id, discussionsByIdeaId: { [idea.id]: [previous] } });

    const request = useIdeaStore.getState().discussIdea(idea.id);
    expect(useIdeaStore.getState()).toMatchObject({ loading: "discussion", streamText: "" });
    await request;

    expect(useIdeaStore.getState().discussionsByIdeaId[idea.id]?.map((discussion) => discussion.id)).toEqual([
      "discussion-old",
      "discussion-1",
    ]);
    expect(useIdeaStore.getState().discussionsByIdeaId[idea.id]?.[1]).toMatchObject({
      ideaId: idea.id,
      status: "completed",
      collectedSparkIds: [],
    });
    expect(useIdeaStore.getState()).toMatchObject({ loading: "idle", streamText: "" });
  });

  it("讨论失败时保留已有历史", async () => {
    const idea = sampleIdeas()[0]!;
    const previous = sampleDiscussion(idea, "discussion-old");
    useIdeaStore.setState({ ideas: [idea], discussionsByIdeaId: { [idea.id]: [previous] } });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("discussion failed")));

    await useIdeaStore.getState().discussIdea(idea.id);

    expect(useIdeaStore.getState().discussionsByIdeaId[idea.id]).toEqual([previous]);
    expect(useIdeaStore.getState()).toMatchObject({ loading: "idle", error: "LLM 有问题：discussion failed" });
  });

  it("切换脑洞会取消讨论且旧结果不得回写", async () => {
    const [firstIdea, secondIdea] = sampleIdeas();
    const pending = deferred<Response>();
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return pending.promise;
    }));
    useIdeaStore.setState({ ideas: [firstIdea!, secondIdea!], activeIdeaId: firstIdea!.id, discussionsByIdeaId: {} });

    const request = useIdeaStore.getState().discussIdea(firstIdea!.id);
    await Promise.resolve();
    useIdeaStore.getState().setActiveIdea(secondIdea!.id);
    pending.resolve(streamResponse({ discussion: sampleDiscussion(firstIdea!) }));
    await request;

    expect(signal?.aborted).toBe(true);
    expect(useIdeaStore.getState().discussionsByIdeaId[firstIdea!.id]).toBeUndefined();
  });

  it("可显式停止讨论并保留已有历史", async () => {
    const idea = sampleIdeas()[0]!;
    const previous = sampleDiscussion(idea, "discussion-old");
    const pending = deferred<Response>();
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return pending.promise;
    }));
    useIdeaStore.setState({ ideas: [idea], activeIdeaId: idea.id, discussionsByIdeaId: { [idea.id]: [previous] } });

    const request = useIdeaStore.getState().discussIdea(idea.id);
    await Promise.resolve();
    useIdeaStore.getState().stopDiscussion();
    pending.resolve(streamResponse({ discussion: sampleDiscussion(idea) }));
    await request;

    expect(signal?.aborted).toBe(true);
    expect(useIdeaStore.getState()).toMatchObject({ loading: "idle", streamText: "" });
    expect(useIdeaStore.getState().discussionsByIdeaId[idea.id]).toEqual([previous]);
  });

  it("用户介入会追加一轮回应并随工作区持久化", async () => {
    const idea = sampleIdeas()[0]!;
    const discussion = sampleDiscussion(idea);
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      return streamResponse({
        intervention: {
          id: "intervention-1",
          type: body.type,
          prompt: body.prompt,
          targetRole: body.targetRole,
          sourceRole: body.sourceRole,
          sourceClaim: body.sourceClaim,
          responses: [{ role: body.targetRole, claim: "先从私密复盘开始。", tension: "传播性会降低。" }],
          createdAt: "2026-07-14T00:00:00.000Z",
        },
      });
    }));
    useIdeaStore.setState({ ideas: [idea], discussionsByIdeaId: { [idea.id]: [discussion] } });

    await useIdeaStore.getState().respondToIdeaDiscussion(idea.id, discussion.id, {
      type: "question",
      prompt: "  如果用户不愿公开失败呢？  ",
      targetRole: "用户代言人",
      sourceRole: "反常识派",
      sourceClaim: "失败比成功更有戏剧性",
    });

    expect(useIdeaStore.getState().discussionsByIdeaId[idea.id]?.[0]?.interventions).toEqual([
      expect.objectContaining({ id: "intervention-1", prompt: "如果用户不愿公开失败呢？", targetRole: "用户代言人" }),
    ]);
    expect(useIdeaStore.getState()).toMatchObject({ loading: "idle", streamText: "", error: undefined });
    const raw = JSON.parse(localStorage.getItem("idea-lab:v2") ?? "{}") as { workspace?: { discussionsByIdeaId?: Record<string, IdeaDiscussion[]> } };
    expect(raw.workspace?.discussionsByIdeaId?.[idea.id]?.[0]?.interventions).toHaveLength(1);
  });

  it("每场讨论最多接受三次介入且非法输入不发请求", async () => {
    const idea = sampleIdeas()[0]!;
    const discussion = {
      ...sampleDiscussion(idea),
      interventions: [1, 2, 3].map((index) => ({
        id: `intervention-${index}`,
        type: "add" as const,
        prompt: `补充 ${index}`,
        targetRole: "现实构建者" as const,
        responses: [{ role: "现实构建者" as const, claim: "回应", tension: "张力" }],
        createdAt: `2026-07-14T00:00:0${index}.000Z`,
      })),
    };
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    useIdeaStore.setState({ ideas: [idea], discussionsByIdeaId: { [idea.id]: [discussion] } });

    await useIdeaStore.getState().respondToIdeaDiscussion(idea.id, discussion.id, { type: "add", prompt: "第四次", targetRole: "现实构建者" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useIdeaStore.getState().error).toContain("三次");

    useIdeaStore.setState({ discussionsByIdeaId: { [idea.id]: [sampleDiscussion(idea)] }, error: undefined });
    await useIdeaStore.getState().respondToIdeaDiscussion(idea.id, discussion.id, { type: "add", prompt: " ".repeat(181), targetRole: "现实构建者" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useIdeaStore.getState().error).toContain("输入");
  });

  it("介入失败、停止或切换脑洞都不会覆盖已有讨论", async () => {
    const [idea, anotherIdea] = sampleIdeas();
    const discussion = sampleDiscussion(idea!);
    useIdeaStore.setState({ ideas: [idea!, anotherIdea!], activeIdeaId: idea!.id, discussionsByIdeaId: { [idea!.id]: [discussion] } });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("respond failed")));

    await useIdeaStore.getState().respondToIdeaDiscussion(idea!.id, discussion.id, { type: "disagree", prompt: "我不同意这个前提", targetRole: "反常识派" });
    expect(useIdeaStore.getState().discussionsByIdeaId[idea!.id]?.[0]?.interventions).toEqual([]);
    expect(useIdeaStore.getState().error).toBe("LLM 有问题：respond failed");

    for (const cancel of ["stop", "switch"] as const) {
      const pending = deferred<Response>();
      let signal: AbortSignal | undefined;
      vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        signal = init?.signal ?? undefined;
        return pending.promise;
      }));
      useIdeaStore.setState({ activeIdeaId: idea!.id, discussionsByIdeaId: { [idea!.id]: [discussion] }, error: undefined });
      const request = useIdeaStore.getState().respondToIdeaDiscussion(idea!.id, discussion.id, { type: "question", prompt: "说具体一点", targetRole: "用户代言人" });
      await Promise.resolve();
      if (cancel === "stop") useIdeaStore.getState().stopDiscussion();
      else useIdeaStore.getState().setActiveIdea(anotherIdea!.id);
      pending.resolve(streamResponse({ intervention: { id: `late-${cancel}`, type: "question", prompt: "说具体一点", targetRole: "用户代言人", responses: [{ role: "用户代言人", claim: "旧结果", tension: "旧张力" }], createdAt: "2026-07-14T00:00:00.000Z" } }));
      await request;
      expect(signal?.aborted).toBe(true);
      expect(useIdeaStore.getState().discussionsByIdeaId[idea!.id]?.[0]?.interventions).toEqual([]);
    }
  });

  it("沿讨论方向生成带谱系的新分支并可撤销", async () => {
    const map = sampleMindMap("失败项目");
    const parent = map.nodes.find((node) => node.id === "node-人群")!;
    const idea = { ...sampleIdeas()[0]!, origin: { mapId: map.id, sourceNodeIds: [parent.id], activeNodeId: parent.id, viewport: { panX: 12, panY: -8, scale: 1.2 } } };
    const discussion = sampleDiscussion(idea);
    const expansion = sampleDiscussionBranch(parent.id);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamResponse({ expansion })));
    useIdeaStore.setState({ mindMap: map, ideas: [idea], activeIdeaId: idea.id, activeMindNodeId: parent.id, discussionsByIdeaId: { [idea.id]: [discussion] } });

    const succeeded = await useIdeaStore.getState().continueDiscussionDirection(idea.id, discussion.id, "unexpectedDirection");

    expect(succeeded).toBe(true);
    const state = useIdeaStore.getState();
    const branchNodes = state.mindMap?.nodes.filter((node) => node.id.startsWith("discussion-branch-")) ?? [];
    expect(branchNodes).toHaveLength(4);
    expect(branchNodes.every((node) => node.selected && node.discussionOrigin?.ideaId === idea.id && node.discussionOrigin?.discussionId === discussion.id && node.discussionOrigin?.directionKey === "unexpectedDirection")).toBe(true);
    expect(state.activeMindNodeId).toBe("discussion-branch-1");
    expect(state.mindMapNavigationIntent).toEqual(expect.objectContaining({ mapId: map.id, sourceNodeIds: expansion.recommendedNodeIds, activeNodeId: "discussion-branch-1", focusNodeId: "discussion-branch-1", viewport: idea.origin.viewport }));
    expect(state.mindMap?.nodes.filter((node) => !node.id.startsWith("discussion-branch-") && node.selectable).every((node) => !node.selected)).toBe(true);
    expect(state.mindMapCanUndo).toBe(true);

    useIdeaStore.getState().undoMindMap();
    expect(useIdeaStore.getState().mindMap?.nodes).toEqual(map.nodes);
  });

  it("来源节点不可用时从中心生成讨论分支", async () => {
    const map = sampleMindMap("失败项目");
    const idea = { ...sampleIdeas()[0]!, origin: { mapId: "old-map", sourceNodeIds: ["missing"], activeNodeId: "missing", viewport: { panX: 99, panY: 99, scale: 9 } } };
    const discussion = sampleDiscussion(idea);
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      return streamResponse({ expansion: sampleDiscussionBranch(body.parentNodeId) });
    });
    vi.stubGlobal("fetch", fetchMock);
    useIdeaStore.setState({ mindMap: map, ideas: [idea], discussionsByIdeaId: { [idea.id]: [discussion] } });

    expect(await useIdeaStore.getState().continueDiscussionDirection(idea.id, discussion.id, "conservativeDirection")).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/idea/discussion/branch", expect.objectContaining({ body: expect.stringContaining(`\"parentNodeId\":\"${map.center.id}\"`) }));
    expect(useIdeaStore.getState().mindMapNavigationIntent?.viewport).toEqual({ panX: 0, panY: 0, scale: 1 });
  });

  it("讨论分支失败或请求过时不会改变当前导图", async () => {
    const map = sampleMindMap("失败项目");
    const idea = sampleIdeas()[0]!;
    const discussion = sampleDiscussion(idea);
    useIdeaStore.setState({ mindMap: map, ideas: [idea], discussionsByIdeaId: { [idea.id]: [discussion] } });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("branch failed")));

    expect(await useIdeaStore.getState().continueDiscussionDirection(idea.id, discussion.id, "radicalDirection")).toBe(false);
    expect(useIdeaStore.getState().mindMap).toEqual(map);
    expect(useIdeaStore.getState().error).toBe("LLM 有问题：branch failed");

    const pending = deferred<Response>();
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return pending.promise;
    }));
    const request = useIdeaStore.getState().continueDiscussionDirection(idea.id, discussion.id, "radicalDirection");
    await Promise.resolve();
    useIdeaStore.getState().moveMindNode("node-人群", 88, 77);
    const editedMap = useIdeaStore.getState().mindMap;
    pending.resolve(streamResponse({ expansion: sampleDiscussionBranch(map.center.id) }));

    expect(await request).toBe(false);
    expect(signal?.aborted).toBe(true);
    expect(useIdeaStore.getState().mindMap).toEqual(editedMap);
    expect(useIdeaStore.getState().mindMap?.nodes.some((node) => node.id.startsWith("discussion-branch-"))).toBe(false);
  });

  it("讨论历史会随工作区和孵化箱持久化恢复", async () => {
    const idea = sampleIdeas()[0]!;
    useIdeaStore.setState({ ideas: [idea], activeIdeaId: idea.id, discussionsByIdeaId: {} });
    useIdeaStore.getState().toggleFavorite(idea.id);

    await useIdeaStore.getState().discussIdea(idea.id);
    useIdeaStore.getState().reset();
    useIdeaStore.getState().hydrate();

    expect(useIdeaStore.getState().discussionsByIdeaId[idea.id]?.map((discussion) => discussion.id)).toEqual(["discussion-1"]);
    expect(useIdeaStore.getState().favorites.map((favorite) => favorite.idea.id)).toContain(idea.id);
  });

  it("采集讨论火花会从来源节点新增远联想节点且可撤销", () => {
    const map = sampleMindMap("失败项目");
    const parent = map.nodes.find((node) => node.id === "node-人群")!;
    const idea = {
      ...sampleIdeas()[0]!,
      origin: { mapId: map.id, sourceNodeIds: [parent.id], activeNodeId: parent.id, viewport: { panX: 0, panY: 0, scale: 1 } },
    };
    const discussion = sampleDiscussion(idea);
    useIdeaStore.setState({
      mindMap: map,
      ideas: [idea],
      activeIdeaId: idea.id,
      activeMindNodeId: parent.id,
      discussionsByIdeaId: { [idea.id]: [discussion] },
      loading: "idle",
    });

    useIdeaStore.getState().collectDiscussionSpark(idea.id, discussion.id, "spark-1");

    const state = useIdeaStore.getState();
    const collected = state.mindMap?.nodes.find((node) => node.label === "用户代言人提出的新火花");
    expect(collected).toMatchObject({
      category: "远联想",
      parentId: parent.id,
      source: "圆桌讨论火花",
      reason: "从多角色圆桌讨论中采集的灵感火花。",
      selected: true,
    });
    expect(state.mindMap?.edges).toContainEqual(expect.objectContaining({ from: parent.id, to: collected?.id, label: "讨论火花" }));
    expect(state.discussionsByIdeaId[idea.id]?.[0]?.collectedSparkIds).toEqual(["spark-1"]);
    expect(state.mindMapCanUndo).toBe(true);

    useIdeaStore.getState().undoMindMap();
    expect(useIdeaStore.getState().mindMap?.nodes.some((node) => node.id === collected?.id)).toBe(false);
  });

  it("重复采集同一火花保持幂等", () => {
    const map = sampleMindMap("失败项目");
    const idea = sampleIdeas()[0]!;
    const discussion = sampleDiscussion(idea);
    useIdeaStore.setState({ mindMap: map, ideas: [idea], discussionsByIdeaId: { [idea.id]: [discussion] }, loading: "idle" });

    useIdeaStore.getState().collectDiscussionSpark(idea.id, discussion.id, "spark-1");
    useIdeaStore.getState().collectDiscussionSpark(idea.id, discussion.id, "spark-1");

    expect(useIdeaStore.getState().mindMap?.nodes.filter((node) => node.source === "圆桌讨论火花")).toHaveLength(1);
    expect(useIdeaStore.getState().discussionsByIdeaId[idea.id]?.[0]?.collectedSparkIds).toEqual(["spark-1"]);
  });

  it("没有导图时采集失败且不会标记火花", () => {
    const idea = sampleIdeas()[0]!;
    const discussion = sampleDiscussion(idea);
    useIdeaStore.setState({ mindMap: undefined, ideas: [idea], discussionsByIdeaId: { [idea.id]: [discussion] }, loading: "idle" });

    useIdeaStore.getState().collectDiscussionSpark(idea.id, discussion.id, "spark-1");

    expect(useIdeaStore.getState().error).toBe("当前没有可用的思维导图，无法采集火花。");
    expect(useIdeaStore.getState().discussionsByIdeaId[idea.id]?.[0]?.collectedSparkIds).toEqual([]);
  });

  it("根据炼化结果创建三步执行计划，并在重复创建时保留已完成状态", () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-07-10T00:00:00.000Z");
    const idea = sampleIdeas()[0]!;
    const refinement = sampleRefinement(idea);
    useIdeaStore.setState({
      ideas: [idea],
      refinementsByIdeaId: { [idea.id]: refinement },
      executionPlansByIdeaId: {},
    });

    useIdeaStore.getState().createIdeaExecutionPlan(idea.id);
    const firstPlan = useIdeaStore.getState().executionPlansByIdeaId[idea.id];

    expect(firstPlan).toBeDefined();
    expect(firstPlan?.ideaId).toBe(idea.id);
    expect(firstPlan?.tasks.map((task) => task.horizon)).toEqual(["1小时 MVP", "1天 MVP", "一周版本"]);
    expect(firstPlan?.tasks.every((task) => task.id.length > 0 && task.completed === false)).toBe(true);

    const firstTaskId = firstPlan!.tasks[0]!.id;
    useIdeaStore.getState().toggleIdeaExecutionTask(idea.id, firstTaskId);
    const completedPlan = useIdeaStore.getState().executionPlansByIdeaId[idea.id]!;
    expect(completedPlan.updatedAt).not.toBe(firstPlan?.updatedAt);
    useIdeaStore.getState().createIdeaExecutionPlan(idea.id);

    expect(useIdeaStore.getState().executionPlansByIdeaId[idea.id]?.tasks[0]).toEqual(completedPlan.tasks[0]);
    vi.useRealTimers();
  });

  it("收束推进会创建执行计划，没有炼化结果时给出明确错误", () => {
    const idea = sampleIdeas()[0]!;
    useIdeaStore.setState({ ideas: [idea], refinementsByIdeaId: {}, executionPlansByIdeaId: {} });

    useIdeaStore.getState().chooseRefinementAction(idea.id, "收束推进");

    expect(useIdeaStore.getState().executionPlansByIdeaId[idea.id]).toBeUndefined();
    expect(useIdeaStore.getState().error).toContain("炼化");

    useIdeaStore.setState({ refinementsByIdeaId: { [idea.id]: sampleRefinement(idea) }, error: undefined });
    useIdeaStore.getState().chooseRefinementAction(idea.id, "收束推进");

    expect(useIdeaStore.getState().executionPlansByIdeaId[idea.id]?.tasks).toHaveLength(3);
    expect(useIdeaStore.getState().refinementActionsByIdeaId[idea.id]).toBe("收束推进");
  });

  it("残缺执行计划不会阻挡收束推进重新创建完整计划", () => {
    const idea = sampleIdeas()[0]!;
    const refinement = sampleRefinement(idea);
    useIdeaStore.setState({
      ideas: [idea],
      refinementsByIdeaId: { [idea.id]: refinement },
      executionPlansByIdeaId: {
        [idea.id]: {
          ideaId: idea.id,
          createdAt: "2026-07-10T00:00:00.000Z",
          updatedAt: "2026-07-10T00:00:00.000Z",
          tasks: [
            { id: "broken", horizon: "1小时 MVP", goal: "坏", build: "坏", proof: "坏", completed: true },
          ],
        },
      },
    });

    useIdeaStore.getState().chooseRefinementAction(idea.id, "收束推进");

    const plan = useIdeaStore.getState().executionPlansByIdeaId[idea.id];
    expect(plan?.tasks).toHaveLength(3);
    expect(plan?.tasks.map((task) => task.id)).toEqual([
      `execution-task:${idea.id}:1小时 MVP`,
      `execution-task:${idea.id}:1天 MVP`,
      `execution-task:${idea.id}:一周版本`,
    ]);
  });

  it("执行计划任务完成状态会持久化，并能跨工作区随收藏恢复", async () => {
    const idea = sampleIdeas()[0]!;
    useIdeaStore.setState({
      ideas: [idea],
      refinementsByIdeaId: { [idea.id]: sampleRefinement(idea) },
      executionPlansByIdeaId: {},
    });
    useIdeaStore.getState().chooseRefinementAction(idea.id, "收束推进");
    const taskId = useIdeaStore.getState().executionPlansByIdeaId[idea.id]!.tasks[1]!.id;
    useIdeaStore.getState().toggleIdeaExecutionTask(idea.id, taskId);
    useIdeaStore.getState().toggleFavorite(idea.id);
    useIdeaStore.getState().setTopic("新的工作区");
    await useIdeaStore.getState().generateMindMap();

    expect(useIdeaStore.getState().executionPlansByIdeaId[idea.id]).toBeUndefined();
    const persisted = JSON.parse(localStorage.getItem("idea-lab:v2") ?? "{}") as {
      incubatorEntries?: Array<{ executionPlan?: { tasks: Array<{ id: string; completed: boolean }> } }>;
    };
    expect(persisted.incubatorEntries?.[0]?.executionPlan?.tasks.find((task) => task.id === taskId)?.completed).toBe(true);

    useIdeaStore.getState().reset();
    useIdeaStore.getState().hydrate();

    const restored = useIdeaStore.getState().executionPlansByIdeaId[idea.id];
    expect(restored?.tasks.find((task) => task.id === taskId)?.completed).toBe(true);
    expect(restored?.tasks.find((task) => task.id === taskId)?.completedAt).toEqual(expect.any(String));
    expect(useIdeaStore.getState().favorites.map((favorite) => favorite.idea.id)).toContain(idea.id);
  });

  it("surfaces LLM errors and restores idle loading state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network failed")));
    const store = useIdeaStore.getState();
    store.setTopic("开发者工具");

    await expect(store.generateWords()).resolves.toBeUndefined();

    expect(useIdeaStore.getState().loading).toBe("idle");
    expect(useIdeaStore.getState().error).toBe("LLM 有问题：network failed");
  });

  it("limits incubator selection to three ideas", async () => {
    const store = useIdeaStore.getState();
    store.setTopic("内容选题");
    await store.generateWords();
    await useIdeaStore.getState().generateIdeas();

    for (const idea of useIdeaStore.getState().ideas) {
      useIdeaStore.getState().toggleFavorite(idea.id);
    }

    useIdeaStore.getState().openIncubator();
    useIdeaStore.getState().toggleIncubatorSelection("idea-1");
    useIdeaStore.getState().toggleIncubatorSelection("idea-2");
    useIdeaStore.getState().toggleIncubatorSelection("idea-3");
    useIdeaStore.getState().toggleIncubatorSelection("missing-idea");

    expect(useIdeaStore.getState().incubatorSelectedIdeaIds).toEqual(["idea-1", "idea-2", "idea-3"]);
  });

  it("mixes selected incubator ideas back into a new mind map topic", async () => {
    const store = useIdeaStore.getState();
    store.setTopic("内容选题");
    await store.generateWords();
    await useIdeaStore.getState().generateIdeas();

    useIdeaStore.getState().toggleFavorite("idea-1");
    useIdeaStore.getState().toggleFavorite("idea-2");
    useIdeaStore.getState().openIncubator();
    useIdeaStore.getState().toggleIncubatorSelection("idea-1");
    useIdeaStore.getState().toggleIncubatorSelection("idea-2");
    const previousMap = sampleMindMap("旧混合导图");
    useIdeaStore.setState({ mindMap: previousMap, activeMindNodeId: "node-人群" });
    useIdeaStore.getState().toggleMindNodeLock("node-人群");
    expect(useIdeaStore.getState().mindMapCanUndo).toBe(true);

    await useIdeaStore.getState().mixSelectedIncubatorIdeas();

    expect(useIdeaStore.getState().topic).toBe("失败作品集博物馆");
    expect(useIdeaStore.getState().incubatorOpen).toBe(false);
    expect(useIdeaStore.getState().incubatorSelectedIdeaIds).toEqual([]);
    expect(useIdeaStore.getState().mindMap?.topic).toBe("失败作品集博物馆");
    expect(useIdeaStore.getState().mindMapCanUndo).toBe(false);
    useIdeaStore.getState().undoMindMap();
    expect(useIdeaStore.getState().mindMap?.topic).toBe("失败作品集博物馆");
    expect(useIdeaStore.getState().lastMixedSeed?.sourceIdeaTitles).toEqual(["项目遗迹馆", "烂尾复盘器"]);
  });

  it("does not half-commit a mixed topic when follow-up map generation fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
        const url = String(_input);
        if (url.endsWith("/words")) {
          return streamResponse({ groups: sampleGroups() });
        }
        if (url.endsWith("/ideas")) {
          return streamResponse({ ideas: sampleIdeas(body.sourceWords ?? []) });
        }
        if (url.endsWith("/mix")) {
          return streamResponse({
            seed: {
              mixedTopic: "失败作品集博物馆",
              theme: "把旧项目的失败经验变成可以展示的资产",
              tension: "羞耻感和炫耀欲之间的拉扯",
              startingPrompt: "给独立开发者做一个能把烂尾仓库生成作品集展签的工具。",
              sourceIdeaTitles: (body.ideas ?? []).map((idea: IdeaCard) => idea.title),
              createdAt: "2026-07-08T00:00:00.000Z",
            },
          });
        }
        if (url.endsWith("/map")) {
          throw new Error("map failed");
        }
        throw new Error(`unexpected url ${url}`);
      }),
    );
    const store = useIdeaStore.getState();
    store.setTopic("内容选题");
    await store.generateWords();
    await useIdeaStore.getState().generateIdeas();
    useIdeaStore.getState().toggleFavorite("idea-1");
    useIdeaStore.getState().toggleFavorite("idea-2");
    useIdeaStore.getState().openIncubator();
    useIdeaStore.getState().toggleIncubatorSelection("idea-1");
    useIdeaStore.getState().toggleIncubatorSelection("idea-2");

    await useIdeaStore.getState().mixSelectedIncubatorIdeas();

    expect(useIdeaStore.getState().topic).toBe("内容选题");
    expect(useIdeaStore.getState().incubatorOpen).toBe(true);
    expect(useIdeaStore.getState().incubatorSelectedIdeaIds).toEqual(["idea-1", "idea-2"]);
    expect(useIdeaStore.getState().lastMixedSeed).toBeUndefined();
    expect(useIdeaStore.getState().error).toBe("LLM 有问题：map failed");
  });
});
