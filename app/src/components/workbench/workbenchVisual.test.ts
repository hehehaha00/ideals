// 这个文件锁定新版工作台的视觉语义，避免又退回卡片堆叠心智。
import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../App";
import { useIdeaStore } from "../../store/ideaStore";
import type { BrainstormMap, CollisionRecipeId, IdeaCard, IdeaExecutionPlan, IdeaRefinement, MindMapViewportSnapshot } from "../../types/idea";
import { IdeaCardList } from "./IdeaCardList";
import { MindMapCanvas } from "./MindMapCanvas";
import { HOME_PHASE_DURATION_MS } from "./TopicComposer";
import { selectIdeasConvergenceEdgeIds, selectMindMapMotionTargets } from "./useMindMapMotion";

function sampleMap(): BrainstormMap {
  const center = {
    id: "center",
    label: "开发者灵感枯竭",
    category: "中心" as const,
    level: 0 as const,
    x: 50,
    y: 50,
    selectable: false,
    locked: true,
    selected: false,
    reason: "中心主题",
  };
  const node = {
    id: "node-1",
    label: "烂尾焦虑",
    category: "情绪" as const,
    level: 1 as const,
    x: 32,
    y: 38,
    selectable: true,
    locked: false,
    selected: true,
    parentId: center.id,
    reason: "真实痛点",
  };
  const farNode = {
    id: "node-2",
    label: "项目遗迹",
    category: "远联想" as const,
    level: 2 as const,
    x: 64,
    y: 42,
    selectable: true,
    locked: false,
    selected: false,
    parentId: node.id,
    reason: "远距离跳跃",
  };

  return {
    id: "map-1",
    topic: center.label,
    stuckType: "有技术没需求",
    center,
    nodes: [center, node, farNode],
    edges: [
      { id: "edge-1", from: center.id, to: node.id, label: "情绪" },
      { id: "edge-2", from: node.id, to: farNode.id, label: "远联想" },
    ],
    recommendedNodeIds: [node.id],
    createdAt: "2026-07-09T00:00:00.000Z",
  };
}

// 构造三个已选关键词，满足打开碰撞配方的最小条件。
function mapWithThreeSelectedNodes(): BrainstormMap {
  const map = sampleMap();
  map.nodes[2] = { ...map.nodes[2]!, selected: true };
  map.nodes.push({ ...map.nodes[1]!, id: "node-3", label: "复盘展签", category: "物件", selected: true, x: 72, y: 62 });
  return map;
}

// 构造远离当前视口的大导图，验证画布实际渲染裁剪而不是只测试几何 helper。
function largeMap(count: number): BrainstormMap {
  const base = sampleMap();
  const center = { ...base.center, id: "center", x: 50, y: 50 };
  const activeRoot = { ...base.nodes[1]!, id: "active-root", label: "活动祖先", x: 320, y: 320, parentId: center.id, selected: false };
  const active = { ...base.nodes[2]!, id: "active-node", label: "活动节点", x: 320, y: 320, parentId: activeRoot.id, selected: false };
  const selectedRoot = { ...base.nodes[1]!, id: "selected-root", label: "选中祖先", x: 360, y: 360, parentId: center.id, selected: false };
  const selected = { ...base.nodes[2]!, id: "selected-node", label: "选中节点", x: 360, y: 360, parentId: selectedRoot.id, selected: true };
  const generated = Array.from({ length: Math.max(0, count - 5) }, (_, index) => ({
    ...base.nodes[1]!,
    id: `generated-${index}`,
    label: `远处节点 ${index}`,
    x: 220 + (index % 8),
    y: 220 + (index % 8),
    parentId: center.id,
    selected: false,
  }));
  const nodes = [center, activeRoot, active, selectedRoot, selected, ...generated];
  return {
    ...base,
    nodes,
    edges: nodes.filter((node) => node.parentId).map((node) => ({ id: `edge-${node.id}`, from: node.parentId!, to: node.id, label: node.category })),
  };
}

function sampleIdea(): IdeaCard {
  return {
    id: "idea-1",
    title: "项目遗迹馆",
    summary: "把烂尾项目变成可浏览展品。",
    whyInteresting: "它把失败经验变成可以展示和复盘的资产。",
    firstVersion: "输入一个仓库链接，生成一张项目展签。",
    sourceWords: [],
    sourcePath: ["开发者灵感枯竭", "烂尾焦虑", "项目遗迹馆"],
    createdAt: "2026-07-09T00:00:00.000Z",
  };
}

// 构造带来源快照的脑洞，供报告到导图的闭环测试使用。
function sampleIdeaWithOrigin(): IdeaCard {
  return {
    ...sampleIdea(),
    origin: {
      mapId: "map-1",
      sourceNodeIds: ["node-1", "node-2"],
      activeNodeId: "node-2",
      viewport: { panX: 148, panY: -72, scale: 0.84 },
    },
  };
}

function sampleRefinement(): IdeaRefinement {
  return {
    id: "refinement-1",
    ideaId: "idea-1",
    vitality: { targetUser: "独立开发者", triggerScene: "项目停滞", coreEmotion: "释然", existingAlternative: "复盘文档", smallestPlayableVersion: "一张展签" },
    roundtable: [
      { role: "懒人用户", feedback: "一步生成最好。" },
      { role: "毒舌用户", feedback: "别把失败包装成成功。" },
      { role: "产品经理", feedback: "先验证分享意愿。" },
      { role: "工程师", feedback: "仓库解析要限范围。" },
      { role: "测试", feedback: "空仓库也要有结果。" },
      { role: "商人", feedback: "团队复盘可以付费。" },
    ],
    directions: [
      { type: "玩具版", title: "展签", description: "生成一张图。", firstStep: "输入仓库。" },
      { type: "工具版", title: "遗迹馆", description: "整理多个项目。", firstStep: "做项目列表。" },
      { type: "产品版", title: "团队复盘", description: "沉淀组织经验。", firstStep: "邀请一个团队。" },
    ],
    mvpLadder: [
      { horizon: "1小时 MVP", goal: "验证文案", build: "手工生成", proof: "愿意分享" },
      { horizon: "1天 MVP", goal: "验证输入", build: "仓库表单", proof: "完成生成" },
      { horizon: "一周版本", goal: "验证复用", build: "项目展馆", proof: "再次使用" },
    ],
    actions: [
      { type: "继续发散", label: "继续发散", description: "寻找更多方向。" },
      { type: "收束推进", label: "收束推进", description: "进入执行。" },
      { type: "放入孵化箱", label: "放入孵化箱", description: "以后再看。" },
    ],
    createdAt: "2026-07-09T00:00:00.000Z",
  };
}

function sampleExecutionPlan(): IdeaExecutionPlan {
  return {
    ideaId: "idea-1",
    createdAt: "2026-07-09T00:00:00.000Z",
    updatedAt: "2026-07-09T00:00:00.000Z",
    tasks: [
      { id: "execution-task:idea-1:1小时 MVP", horizon: "1小时 MVP", goal: "验证文案", build: "手工生成", proof: "愿意分享", completed: false },
      { id: "execution-task:idea-1:1天 MVP", horizon: "1天 MVP", goal: "验证输入", build: "仓库表单", proof: "完成生成", completed: false },
      { id: "execution-task:idea-1:一周版本", horizon: "一周版本", goal: "验证复用", build: "项目展馆", proof: "再次使用", completed: false },
    ],
  };
}

// 在 JSDOM 未实现 PointerEvent 时构造带 pointerId 的指针事件。
function firePointer(target: Element, type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel", init: { pointerId: number; button?: number; clientX: number; clientY: number; shiftKey?: boolean }): void {
  const event = new MouseEvent(type, { bubbles: true, button: init.button ?? 0, clientX: init.clientX, clientY: init.clientY, shiftKey: init.shiftKey });
  Object.defineProperty(event, "pointerId", { value: init.pointerId });
  fireEvent(target, event);
}

const originalStoreActions = (() => {
  const state = useIdeaStore.getState();
  return {
    openIncubator: state.openIncubator,
    toggleMindNode: state.toggleMindNode,
    toggleMindNodeLock: state.toggleMindNodeLock,
    moveMindNode: state.moveMindNode,
    persistWorkspace: state.persistWorkspace,
    setActiveIdea: state.setActiveIdea,
    setMindNodesSelected: state.setMindNodesSelected,
    restoreIdeaOrigin: state.restoreIdeaOrigin,
    expandActiveMindNode: state.expandActiveMindNode,
    generateIdeasFromMindMap: state.generateIdeasFromMindMap,
    consumeMindMapNavigationIntent: state.consumeMindMapNavigationIntent,
    renameMindNode: state.renameMindNode,
    updateMindNodeNote: state.updateMindNodeNote,
    reparentMindNode: state.reparentMindNode,
    deleteMindNodeSubtree: state.deleteMindNodeSubtree,
    createMindNodeGroup: state.createMindNodeGroup,
    ungroupMindNodes: state.ungroupMindNodes,
  };
})();

// reset() 只恢复业务数据；测试替换过的 action 需要单独还原。
function restoreStoreActions(): void {
  useIdeaStore.setState(originalStoreActions);
}

describe("workbench visual semantics", () => {
  beforeEach(() => {
    localStorage.clear();
    restoreStoreActions();
    useIdeaStore.getState().reset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    act(() => restoreStoreActions());
  });

  it("keeps the empty homepage focused on the prompt before work starts", () => {
    render(React.createElement(App));

    expect(screen.queryByText("先丢一个")).not.toBeInTheDocument();
    expect(screen.queryByText("模糊念头。")).not.toBeInTheDocument();
    expect(screen.getByLabelText("主题")).toHaveAttribute("placeholder", "把脑子里一闪而过的想法写下来...");
    expect(screen.getByRole("button", { name: /开发者工具/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "开始发散" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /孵化箱/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("创意阶段")).not.toBeInTheDocument();
    expect(screen.queryByText("不用想清楚，先让它散开。")).not.toBeInTheDocument();
  });

  it("cycles homepage wording and tags when the user is idle", () => {
    vi.useFakeTimers();
    render(React.createElement(App));

    expect(screen.getByRole("button", { name: /开发者工具/ })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(HOME_PHASE_DURATION_MS + 20);
    });

    expect(screen.getByLabelText("主题")).toHaveAttribute("placeholder", "描述一个模糊的想法、问题或灵感...");
    expect(screen.getByRole("button", { name: /未来的教育形态/ })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(HOME_PHASE_DURATION_MS + 20);
    });

    expect(screen.getByLabelText("主题")).toHaveAttribute("placeholder", "把困在脑子里的东西丢进来...");
    expect(screen.getByRole("button", { name: /深夜灵感/ })).toBeInTheDocument();
  });

  it("crossfades real scene background assets with each homepage phase", () => {
    vi.useFakeTimers();
    render(React.createElement(App));

    expect(screen.getByTestId("home-scene-day")).toHaveAttribute("data-background", "/home-backgrounds/idea-lab-daylight-bg.png");
    expect(screen.getByTestId("home-scene-warm")).toHaveAttribute("data-background", "/home-backgrounds/idea-lab-sunrise-bg.png");
    expect(screen.getByTestId("home-scene-night")).toHaveAttribute("data-background", "/home-backgrounds/idea-lab-moonmist-bg.png");
    expect(screen.getByTestId("home-scene-day")).toHaveAttribute("data-active", "true");

    act(() => {
      vi.advanceTimersByTime(HOME_PHASE_DURATION_MS + 20);
    });

    expect(screen.getByTestId("home-scene-warm")).toHaveAttribute("data-active", "true");

    act(() => {
      vi.advanceTimersByTime(HOME_PHASE_DURATION_MS + 20);
    });

    expect(screen.getByTestId("home-scene-night")).toHaveAttribute("data-active", "true");
  });

  it("pauses the homepage atmosphere cycle while the user is focused or typing", () => {
    vi.useFakeTimers();
    render(React.createElement(App));

    const input = screen.getByLabelText("主题");
    fireEvent.focus(input);
    act(() => {
      vi.advanceTimersByTime(HOME_PHASE_DURATION_MS * 3);
    });

    expect(input).toHaveAttribute("placeholder", "把脑子里一闪而过的想法写下来...");

    fireEvent.change(input, { target: { value: "我想做一个云层里的想法工具" } });
    fireEvent.blur(input);
    act(() => {
      vi.advanceTimersByTime(HOME_PHASE_DURATION_MS * 3);
    });

    expect(input).toHaveAttribute("placeholder", "把脑子里一闪而过的想法写下来...");
  });

  it("presents the mind map as a star-map stage", () => {
    useIdeaStore.setState({ mindMap: sampleMap(), activeMindNodeId: "node-1" });

    render(React.createElement(MindMapCanvas));

    expect(screen.getByRole("region", { name: "思维星图舞台" })).toBeInTheDocument();
  });

  it("switches the app to a focused fullscreen map after a map is available", () => {
    useIdeaStore.setState({ mindMap: sampleMap(), activeMindNodeId: "node-1" });

    render(React.createElement(App));

    expect(screen.getByRole("region", { name: "思维星图舞台" })).toHaveAttribute("data-view", "fullscreen-map");
    expect(screen.queryByLabelText("主题")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("创意阶段")).not.toBeInTheDocument();
    expect(screen.queryByText("高级词组碰撞")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "灵感展墙" })).not.toBeInTheDocument();
  });

  it("shows explicit lock text and accessible selection state on map nodes", () => {
    const map = sampleMap();
    map.nodes[1] = { ...map.nodes[1], locked: true };
    useIdeaStore.setState({ mindMap: map, activeMindNodeId: "node-1" });

    render(React.createElement(MindMapCanvas));

    expect(screen.getByRole("button", { name: "放大情绪 烂尾焦虑" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("已锁")).toBeVisible();
    expect(screen.getByRole("button", { name: "解锁 烂尾焦虑" })).toHaveAttribute("aria-pressed", "true");
  });

  it.each([200, 500])("culls a %i-node map in the actual canvas while retaining protected nodes", (count) => {
    const map = largeMap(count);
    useIdeaStore.setState({ mindMap: map, activeMindNodeId: "active-node" });

    const { container } = render(React.createElement(MindMapCanvas));

    expect(container.querySelectorAll("[data-motion-node-id]").length).toBeLessThan(count);
    expect(screen.getByRole("button", { name: "远距类比 活动节点" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "放大情绪 活动祖先" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "远距类比 选中节点" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "放大情绪 选中祖先" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "放大情绪 远处节点 0" })).not.toBeInTheDocument();
    expect(container.querySelector("[data-motion-edge-id='edge-active-node']")).toBeInTheDocument();
    expect(container.querySelector("[data-motion-edge-id='edge-selected-node']")).toBeInTheDocument();
  });

  it("retains the whole focused branch when a large map enters local focus", () => {
    useIdeaStore.setState({ mindMap: largeMap(200), activeMindNodeId: undefined });

    const { container } = render(React.createElement(MindMapCanvas));
    expect(container.querySelector("[data-motion-node-id='active-node']")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "搜索导图节点" }), { target: { value: "活动祖先" } });
    fireEvent.click(screen.getByRole("option", { name: "活动祖先 情绪" }));

    expect(container.querySelector("[data-motion-node-id='active-node']")).toBeInTheDocument();
    expect(container.querySelector("[data-motion-edge-id='edge-active-node']")).toBeInTheDocument();
  });

  it("keeps protected nodes and drag behavior after canvas panning", () => {
    const moveMindNode = vi.fn(useIdeaStore.getState().moveMindNode);
    useIdeaStore.setState({ mindMap: largeMap(200), activeMindNodeId: "active-node", moveMindNode });

    const { container } = render(React.createElement(MindMapCanvas));
    const stage = screen.getByRole("region", { name: "思维星图舞台" });
    vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, right: 1000, bottom: 600, width: 1000, height: 600, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);

    firePointer(stage, "pointerdown", { pointerId: 71, clientX: 500, clientY: 300 });
    firePointer(stage, "pointermove", { pointerId: 71, clientX: 620, clientY: 360 });
    firePointer(stage, "pointerup", { pointerId: 71, clientX: 620, clientY: 360 });

    expect(container.querySelector("[data-motion-node-id='active-node']")).toBeInTheDocument();
    const activeButton = screen.getByRole("button", { name: "远距类比 活动节点" });
    firePointer(activeButton, "pointerdown", { pointerId: 72, clientX: 320, clientY: 220 });
    firePointer(activeButton, "pointermove", { pointerId: 72, clientX: 420, clientY: 280 });
    firePointer(activeButton, "pointerup", { pointerId: 72, clientX: 420, clientY: 280 });

    expect(moveMindNode).toHaveBeenCalledWith("active-node", expect.any(Number), expect.any(Number));
  });

  it("keeps an unselected large-map node mounted until its drag finishes", () => {
    const map = largeMap(200);
    map.nodes = map.nodes.map((node) => node.id === "generated-0" ? { ...node, x: 50, y: 30 } : node);
    const persistWorkspace = vi.fn();
    useIdeaStore.setState({ mindMap: map, activeMindNodeId: "active-node", persistWorkspace });

    const { container } = render(React.createElement(MindMapCanvas));
    const stage = screen.getByRole("region", { name: "思维星图舞台" });
    vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, right: 1000, bottom: 600, width: 1000, height: 600, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
    fireEvent.wheel(stage, { deltaY: -120, clientX: 500, clientY: 300 });

    const nodeButton = screen.getByRole("button", { name: "放大情绪 远处节点 0" });
    firePointer(nodeButton, "pointerdown", { pointerId: 73, clientX: 500, clientY: 166 });
    firePointer(nodeButton, "pointermove", { pointerId: 73, clientX: 5000, clientY: 300 });

    expect(container.querySelector("[data-motion-node-id='generated-0']")).toBeInTheDocument();
    firePointer(nodeButton, "pointerup", { pointerId: 73, clientX: 5000, clientY: 300 });
    expect(persistWorkspace).toHaveBeenCalledTimes(1);
  });

  it("keeps protected large-map nodes locked during AI work", () => {
    useIdeaStore.setState({ mindMap: largeMap(200), activeMindNodeId: "active-node", loading: "expand" });

    render(React.createElement(MindMapCanvas));

    expect(screen.getByRole("button", { name: "远距类比 活动节点" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "锁定 活动节点" })).toBeDisabled();
  });

  it("keeps unlocked nodes visually quiet until the user interacts", () => {
    useIdeaStore.setState({ mindMap: sampleMap(), activeMindNodeId: undefined });

    render(React.createElement(MindMapCanvas));

    expect(screen.getByRole("button", { name: "远距类比 项目遗迹" })).toHaveClass("border-transparent");
    expect(screen.getByRole("button", { name: "锁定 项目遗迹" })).toHaveClass("opacity-0");
  });

  it("moves a node with pointer events, updates its edge, and persists on release", () => {
    const moveMindNode = vi.fn(useIdeaStore.getState().moveMindNode);
    const persistWorkspace = vi.fn();
    useIdeaStore.setState({
      mindMap: sampleMap(),
      activeMindNodeId: "node-1",
      moveMindNode,
      persistWorkspace,
    });

    const { container } = render(React.createElement(MindMapCanvas));
    const canvas = screen.getByRole("region", { name: "思维星图舞台" });
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 1000,
      bottom: 600,
      width: 1000,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    const nodeButton = screen.getByRole("button", { name: "放大情绪 烂尾焦虑" });
    const edgeBefore = container.querySelector("path[data-edge-variant='primary']")?.getAttribute("d");

    firePointer(nodeButton, "pointerdown", { pointerId: 7, button: 0, clientX: 350, clientY: 238 });
    firePointer(nodeButton, "pointermove", { pointerId: 7, clientX: 600, clientY: 350 });
    firePointer(nodeButton, "pointerup", { pointerId: 7, clientX: 600, clientY: 350 });

    expect(moveMindNode).toHaveBeenCalledWith("node-1", 57, 56.67);
    expect(container.querySelector("path[data-edge-variant='primary']")?.getAttribute("d")).not.toBe(edgeBefore);
    expect(persistWorkspace).toHaveBeenCalledTimes(1);
  });

  it("supports infinite-canvas zoom controls and resetting the viewport", () => {
    useIdeaStore.setState({ mindMap: sampleMap(), activeMindNodeId: "node-1" });

    const { container } = render(React.createElement(MindMapCanvas));
    const stage = screen.getByRole("region", { name: "思维星图舞台" });
    const world = container.querySelector("[data-mindmap-world]");

    fireEvent.wheel(stage, { deltaY: -120, clientX: 0, clientY: 0 });
    expect(world).toHaveAttribute("data-scale", "1.12");

    fireEvent.click(screen.getByRole("button", { name: "回到中心" }));
    expect(world).toHaveAttribute("data-scale", "1");
    expect(screen.getByRole("button", { name: "适应全部节点" })).toBeEnabled();
  });

  it("restores and temporarily saves the canvas viewport", () => {
    useIdeaStore.setState({
      mindMap: sampleMap(),
      activeMindNodeId: "node-1",
      mindMapViewport: { panX: 84, panY: -36, scale: 1.4 },
    });

    const { container, unmount } = render(React.createElement(MindMapCanvas));
    const stage = screen.getByRole("region", { name: "思维星图舞台" });
    const world = container.querySelector("[data-mindmap-world]");
    expect(world).toHaveAttribute("data-scale", "1.4");

    fireEvent.wheel(stage, { deltaY: -120, clientX: 640, clientY: 360 });
    expect(useIdeaStore.getState().mindMapViewport?.scale).toBe(1.57);

    unmount();
    const restored = render(React.createElement(MindMapCanvas)).container.querySelector("[data-mindmap-world]");
    expect(restored).toHaveAttribute("data-scale", "1.57");
  });

  it("shows an ordered-universe HUD with minimap and history controls", () => {
    useIdeaStore.setState({ mindMap: sampleMap(), activeMindNodeId: "node-1", mindMapCanUndo: true, mindMapCanRedo: false });

    render(React.createElement(MindMapCanvas));

    expect(screen.getByTestId("mindmap-minimap")).toBeVisible();
    expect(screen.getByTestId("mindmap-viewport-rect")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeVisible();
    expect(screen.getByRole("button", { name: "撤销" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "重做" })).toBeDisabled();
  });

  it("offers search, multi-select commands and a manual node entry point", () => {
    useIdeaStore.setState({ mindMap: sampleMap(), activeMindNodeId: "node-1" });

    render(React.createElement(MindMapCanvas));

    expect(screen.getByRole("searchbox", { name: "搜索导图节点" })).toBeVisible();
    expect(screen.getByRole("button", { name: "新增节点" })).toBeVisible();
    expect(screen.getByRole("button", { name: "框选节点" })).toHaveAttribute("aria-pressed", "false");
  });

  it("draws named node groups below edges and nodes without taking pointer events", () => {
    const map = sampleMap();
    map.groups = [{ id: "group-1", name: "推进路线", nodeIds: ["node-1", "node-2"], createdAt: "2026-07-11T00:00:00.000Z" }];
    useIdeaStore.setState({ mindMap: map, activeMindNodeId: "node-1" });

    const { container } = render(React.createElement(MindMapCanvas));
    const world = container.querySelector("[data-mindmap-world]");
    const groupLayer = screen.getByRole("img", { name: "节点分组范围" });

    expect(groupLayer).toHaveTextContent("推进路线");
    expect(groupLayer).toHaveClass("pointer-events-none");
    expect(world?.firstElementChild).toBe(groupLayer);
    expect(groupLayer.nextElementSibling).toHaveClass("mindmap-edges");
  });

  it("connects a single selected node editor to the store editing actions", () => {
    const map = sampleMap();
    map.nodes[1] = { ...map.nodes[1]!, selected: false };
    map.nodes[2] = { ...map.nodes[2]!, selected: true };
    const renameMindNode = vi.fn();
    const updateMindNodeNote = vi.fn();
    const reparentMindNode = vi.fn();
    useIdeaStore.setState({
      mindMap: map,
      activeMindNodeId: "node-2",
      renameMindNode,
      updateMindNodeNote,
      reparentMindNode,
    });

    render(React.createElement(MindMapCanvas));

    expect(screen.getByRole("complementary", { name: "编辑节点 项目遗迹" })).toBeVisible();
    fireEvent.change(screen.getByLabelText("节点标题"), { target: { value: "项目档案馆" } });
    fireEvent.change(screen.getByLabelText("节点备注"), { target: { value: "来自用户访谈" } });
    fireEvent.change(screen.getByLabelText("父节点"), { target: { value: "center" } });
    fireEvent.submit(screen.getByRole("form", { name: "编辑节点" }));

    expect(renameMindNode).toHaveBeenCalledWith("node-2", "项目档案馆");
    expect(updateMindNodeNote).toHaveBeenCalledWith("node-2", "来自用户访谈");
    expect(reparentMindNode).toHaveBeenCalledWith("node-2", "center");
  });

  it("closes the single-node editor after a confirmed subtree deletion", () => {
    const deleteMindNodeSubtree = vi.fn();
    useIdeaStore.setState({ mindMap: sampleMap(), activeMindNodeId: "node-1", deleteMindNodeSubtree });

    render(React.createElement(MindMapCanvas));
    fireEvent.click(screen.getByRole("button", { name: "删除分支" }));
    fireEvent.click(screen.getByRole("button", { name: "确认删除分支" }));

    expect(deleteMindNodeSubtree).toHaveBeenCalledWith("node-1");
    expect(screen.queryByRole("complementary", { name: "编辑节点 烂尾焦虑" })).not.toBeInTheDocument();
  });

  it("creates a named group from multiple selected nodes and can ungroup grouped members", () => {
    const map = sampleMap();
    map.nodes[1] = { ...map.nodes[1]!, groupId: "group-old" };
    map.nodes[2] = { ...map.nodes[2]!, selected: true };
    const createMindNodeGroup = vi.fn();
    const ungroupMindNodes = vi.fn();
    useIdeaStore.setState({
      mindMap: map,
      activeMindNodeId: "node-1",
      createMindNodeGroup,
      ungroupMindNodes,
    });

    render(React.createElement(MindMapCanvas));
    fireEvent.click(screen.getByRole("button", { name: "建立分组" }));

    const confirmButton = screen.getByRole("button", { name: "确认建立分组" });
    expect(confirmButton).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("请输入分组名称");

    fireEvent.change(screen.getByLabelText("分组名称"), { target: { value: "  推进路线  " } });
    expect(confirmButton).toBeEnabled();
    fireEvent.click(confirmButton);
    expect(createMindNodeGroup).toHaveBeenCalledWith("推进路线", ["node-1", "node-2"]);

    fireEvent.click(screen.getByRole("button", { name: "解组已选节点" }));
    expect(ungroupMindNodes).toHaveBeenCalledWith(["node-1", "node-2"]);
  });

  it("locks group editing together with the rest of the canvas during AI work", () => {
    const map = sampleMap();
    map.nodes[1] = { ...map.nodes[1]!, groupId: "group-old" };
    map.nodes[2] = { ...map.nodes[2]!, selected: true };
    useIdeaStore.setState({ mindMap: map, activeMindNodeId: "node-1", loading: "expand" });

    render(React.createElement(MindMapCanvas));

    expect(screen.getByRole("button", { name: "建立分组" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "解组已选节点" })).toBeDisabled();
  });

  it("changes node detail by zoom level and exposes branch folding nearby", () => {
    useIdeaStore.setState({ mindMap: sampleMap(), activeMindNodeId: "node-1" });
    const { container } = render(React.createElement(MindMapCanvas));
    const stage = screen.getByRole("region", { name: "思维星图舞台" });
    vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, right: 1280, bottom: 720, width: 1280, height: 720, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);

    for (let index = 0; index < 7; index += 1) fireEvent.wheel(stage, { deltaY: 120, clientX: 640, clientY: 360 });
    expect(container.querySelector("[data-motion-node-id='node-1']")).toHaveAttribute("data-lod", "far");
    expect(Number(screen.getByTestId("mindmap-viewport-rect").getAttribute("width"))).toBeGreaterThanOrEqual(99);

    fireEvent.click(screen.getByRole("button", { name: "回到中心" }));
    for (let index = 0; index < 5; index += 1) fireEvent.wheel(stage, { deltaY: -120, clientX: 640, clientY: 360 });
    expect(container.querySelector("[data-motion-node-id='node-1']")?.closest("[data-lod]" ) ?? container.querySelector("[data-lod='near']")).toBeTruthy();
    expect(screen.getByRole("button", { name: "折叠 烂尾焦虑 的分支" })).toBeVisible();
  });

  it("keeps far-view stars draggable", () => {
    const moveMindNode = vi.fn(useIdeaStore.getState().moveMindNode);
    useIdeaStore.setState({ mindMap: sampleMap(), activeMindNodeId: "node-1", moveMindNode });
    render(React.createElement(MindMapCanvas));
    const stage = screen.getByRole("region", { name: "思维星图舞台" });
    vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, right: 1000, bottom: 600, width: 1000, height: 600, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
    for (let index = 0; index < 7; index += 1) fireEvent.wheel(stage, { deltaY: 120, clientX: 640, clientY: 360 });
    const star = screen.getByRole("button", { name: "放大情绪 烂尾焦虑" });
    firePointer(star, "pointerdown", { pointerId: 41, clientX: 300, clientY: 220 });
    firePointer(star, "pointermove", { pointerId: 41, clientX: 420, clientY: 280 });
    firePointer(star, "pointerup", { pointerId: 41, clientX: 420, clientY: 280 });
    expect(moveMindNode).toHaveBeenCalledWith("node-1", expect.any(Number), expect.any(Number));
  });

  it("creates and finds a manual node from the canvas HUD", () => {
    useIdeaStore.setState({ mindMap: sampleMap(), activeMindNodeId: "node-1" });
    render(React.createElement(MindMapCanvas));

    fireEvent.click(screen.getByRole("button", { name: "新增节点" }));
    fireEvent.change(screen.getByLabelText("节点内容"), { target: { value: "隐藏的用户需求" } });
    fireEvent.click(screen.getByRole("button", { name: "加入画布" }));
    expect(screen.getByRole("button", { name: "找载体 隐藏的用户需求" })).toBeVisible();

    fireEvent.change(screen.getByRole("searchbox", { name: "搜索导图节点" }), { target: { value: "隐藏" } });
    fireEvent.click(screen.getByRole("option", { name: "隐藏的用户需求 物件" }));
    expect(screen.getByRole("button", { name: "找载体 隐藏的用户需求" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps plain dragging for panning and uses Shift dragging for additive box selection", () => {
    useIdeaStore.setState({ mindMap: sampleMap(), activeMindNodeId: "node-1" });
    render(React.createElement(MindMapCanvas));
    const stage = screen.getByRole("region", { name: "思维星图舞台" });
    vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, right: 1000, bottom: 600, width: 1000, height: 600, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);

    firePointer(stage, "pointerdown", { pointerId: 31, clientX: 550, clientY: 190, shiftKey: true });
    firePointer(stage, "pointermove", { pointerId: 31, clientX: 700, clientY: 310, shiftKey: true });
    firePointer(stage, "pointerup", { pointerId: 31, clientX: 700, clientY: 310, shiftKey: true });

    expect(screen.getByRole("button", { name: "远距类比 项目遗迹" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("批量节点操作")).toBeVisible();
  });

  it("cancels an unfinished box selection when AI locks the canvas", () => {
    const setMindNodesSelected = vi.fn();
    useIdeaStore.setState({ mindMap: sampleMap(), activeMindNodeId: "node-1", setMindNodesSelected });
    render(React.createElement(MindMapCanvas));
    const stage = screen.getByRole("region", { name: "思维星图舞台" });
    vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, right: 1000, bottom: 600, width: 1000, height: 600, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);

    firePointer(stage, "pointerdown", { pointerId: 51, clientX: 200, clientY: 180, shiftKey: true });
    firePointer(stage, "pointermove", { pointerId: 51, clientX: 500, clientY: 360, shiftKey: true });
    act(() => useIdeaStore.setState({ loading: "expand" }));
    firePointer(stage, "pointerup", { pointerId: 51, clientX: 500, clientY: 360, shiftKey: true });

    expect(setMindNodesSelected).not.toHaveBeenCalled();
    expect(screen.queryByText("批量节点操作")).not.toBeInTheDocument();
  });

  it("folds a branch without deleting it and restores it through undo", () => {
    useIdeaStore.setState({ mindMap: sampleMap(), activeMindNodeId: "node-1" });
    render(React.createElement(MindMapCanvas));
    const stage = screen.getByRole("region", { name: "思维星图舞台" });
    for (let index = 0; index < 5; index += 1) fireEvent.wheel(stage, { deltaY: -120, clientX: 640, clientY: 360 });

    fireEvent.click(screen.getByRole("button", { name: "折叠 烂尾焦虑 的分支" }));
    expect(screen.queryByRole("button", { name: "远距类比 项目遗迹" })).not.toBeInTheDocument();
    expect(useIdeaStore.getState().mindMap?.nodes.some((node) => node.id === "node-2")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "撤销" }));
    expect(screen.getByRole("button", { name: "远距类比 项目遗迹" })).toBeVisible();
  });

  it("keeps connections visible for nodes outside the initial 0-100 world", () => {
    const map = sampleMap();
    const outsideNode = { ...map.nodes[2]!, id: "outside-node", label: "画布外节点", x: 132, y: -18, parentId: "node-1" };
    useIdeaStore.setState({ mindMap: { ...map, nodes: [...map.nodes, outsideNode], edges: [...map.edges, { id: "outside-edge", from: "node-1", to: outsideNode.id, label: "继续发散" }] } });
    const { container } = render(React.createElement(MindMapCanvas));

    expect(container.querySelector(".mindmap-edges")).toHaveClass("overflow-visible");
    expect(container.querySelector("[data-motion-edge-id='outside-edge']")).toBeInTheDocument();
  });

  it("resets local viewport tools when a different map replaces the current map", () => {
    const map = sampleMap();
    useIdeaStore.setState({ mindMap: map, activeMindNodeId: "node-1" });
    const { container } = render(React.createElement(MindMapCanvas));
    const stage = screen.getByRole("region", { name: "思维星图舞台" });
    fireEvent.wheel(stage, { deltaY: -120, clientX: 640, clientY: 360 });
    fireEvent.click(screen.getByRole("button", { name: "新增节点" }));
    expect(screen.getByLabelText("新增灵感节点")).toBeVisible();

    act(() => useIdeaStore.setState({ mindMap: { ...map, id: "map-2", topic: "新主题" } }));

    expect(container.querySelector("[data-mindmap-world]")).toHaveAttribute("data-scale", "1");
    expect(screen.queryByLabelText("新增灵感节点")).not.toBeInTheDocument();
  });

  it("does not suppress the next selection after a pointer cancellation", () => {
    const toggleMindNode = vi.fn();
    const persistWorkspace = vi.fn();
    useIdeaStore.setState({ mindMap: sampleMap(), activeMindNodeId: "node-1", toggleMindNode, persistWorkspace });

    const nodeButton = render(React.createElement(MindMapCanvas)).getByRole("button", { name: "放大情绪 烂尾焦虑" });
    const canvas = screen.getByRole("region", { name: "思维星图舞台" });
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, right: 1000, bottom: 600, width: 1000, height: 600, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);

    firePointer(nodeButton, "pointerdown", { pointerId: 8, clientX: 320, clientY: 228 });
    firePointer(nodeButton, "pointermove", { pointerId: 8, clientX: 500, clientY: 300 });
    firePointer(nodeButton, "pointercancel", { pointerId: 8, clientX: 500, clientY: 300 });
    fireEvent.click(nodeButton);

    expect(toggleMindNode).toHaveBeenCalledWith("node-1");
    expect(persistWorkspace).toHaveBeenCalledTimes(1);
  });

  it("shows ideas in a separate results view and returns to the map", () => {
    const restoreIdeaOrigin = vi.fn(() => true);
    useIdeaStore.setState({ mindMap: sampleMap(), ideas: [sampleIdea()], activeIdeaId: "idea-1", activeMindNodeId: "node-1" });
    useIdeaStore.setState({ restoreIdeaOrigin });

    render(React.createElement(App));

    expect(screen.getByRole("main")).toHaveAttribute("data-app-view", "ideas");
    expect(screen.getByRole("heading", { name: "灵感展墙" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "思维星图舞台" })).not.toBeInTheDocument();

    const backButton = screen.getByRole("button", { name: "返回导图" });
    expect(backButton).toHaveClass("fixed", "left-5", "top-5", "z-50", "text-[#fff7df]", "bg-[#171310]/90");
    expect(backButton).not.toHaveClass("text-white/68");

    fireEvent.click(backButton);

    expect(restoreIdeaOrigin).not.toHaveBeenCalled();
    expect(screen.getByRole("main")).toHaveAttribute("data-app-view", "map");
    expect(screen.getByRole("region", { name: "思维星图舞台" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "灵感展墙" })).not.toBeInTheDocument();
  });

  it("returns home instead of opening an empty map when the report has no map", () => {
    useIdeaStore.setState({ mindMap: undefined, ideas: [sampleIdea()], activeIdeaId: "idea-1" });

    render(React.createElement(App));

    expect(screen.getByRole("main")).toHaveAttribute("data-app-view", "ideas");
    expect(screen.queryByRole("button", { name: "返回导图" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "返回首页" }));

    expect(screen.getByRole("main")).toHaveAttribute("data-app-view", "home");
    expect(screen.getByLabelText("主题")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "思维星图舞台" })).not.toBeInTheDocument();
  });

  it("opens the newly generated report after returning to the same map", async () => {
    const nextIdea = { ...sampleIdea(), id: "idea-next", title: "下一轮脑洞" };
    useIdeaStore.setState({ mindMap: sampleMap(), ideas: [sampleIdea()], activeIdeaId: "idea-1", activeMindNodeId: "node-1" });

    render(React.createElement(App));
    fireEvent.click(screen.getByRole("button", { name: "返回导图" }));
    expect(screen.getByRole("main")).toHaveAttribute("data-app-view", "map");

    act(() => useIdeaStore.setState({ loading: "ideas" }));
    act(() => useIdeaStore.setState({ ideas: [nextIdea], activeIdeaId: nextIdea.id, loading: "idle" }));

    await waitFor(() => expect(screen.getByRole("main")).toHaveAttribute("data-app-view", "ideas"));
    expect(screen.getByRole("heading", { name: "下一轮脑洞" })).toBeInTheDocument();
  });

  it("shows an interactive origin constellation and restores the selected source node", () => {
    useIdeaStore.setState({ mindMap: sampleMap(), ideas: [sampleIdeaWithOrigin()], activeIdeaId: "idea-1", activeMindNodeId: "node-1" });

    render(React.createElement(App));

    expect(screen.getByRole("region", { name: "来源星座" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "返回来源节点 项目遗迹" }));

    expect(screen.getByRole("main")).toHaveAttribute("data-app-view", "map");
    expect(useIdeaStore.getState().activeMindNodeId).toBe("node-2");
    expect(useIdeaStore.getState().mindMapNavigationIntent).toBeUndefined();
    const world = document.querySelector("[data-mindmap-world]");
    expect(world).toHaveAttribute("data-scale", "0.84");
    expect(world).toHaveStyle({ transform: "translate3d(148px, -72px, 0) scale(0.84)" });
  });

  it("shows the collision recipe and later transform in the interactive origin constellation", () => {
    const transformedIdea: IdeaCard = {
      ...sampleIdeaWithOrigin(),
      id: "idea-transform",
      parentId: "idea-1",
      transformDirection: "更实用一点",
      origin: {
        ...sampleIdeaWithOrigin().origin!,
        collisionRecipe: "borrow-structure",
      },
    };
    useIdeaStore.setState({ mindMap: sampleMap(), ideas: [transformedIdea], activeIdeaId: transformedIdea.id, activeMindNodeId: "node-1" });

    render(React.createElement(App));

    const originRegion = screen.getByRole("region", { name: "来源星座" });
    const lineage = within(originRegion).getByTestId("origin-lineage");
    expect(lineage.tagName).toBe("DL");
    expect(within(lineage).getByText("碰撞配方")).toBeInTheDocument();
    expect(within(lineage).getByText("借用结构")).toBeInTheDocument();
    expect(within(lineage).getByText("后续变形")).toBeInTheDocument();
    expect(within(lineage).getByText("更实用一点")).toBeInTheDocument();
  });

  it("returns to the saved origin position from the report action", () => {
    useIdeaStore.setState({ mindMap: sampleMap(), ideas: [sampleIdeaWithOrigin()], activeIdeaId: "idea-1", activeMindNodeId: "node-1" });

    render(React.createElement(App));
    fireEvent.click(screen.getByRole("button", { name: "返回来源位置" }));

    expect(screen.getByRole("main")).toHaveAttribute("data-app-view", "map");
    expect(useIdeaStore.getState().activeMindNodeId).toBe("node-2");
    expect(useIdeaStore.getState().mindMapNavigationIntent).toBeUndefined();
    expect(document.querySelector("[data-mindmap-world]")).toHaveStyle({ transform: "translate3d(148px, -72px, 0) scale(0.84)" });
  });

  it("keeps the report visible when its origin can no longer be restored", () => {
    const restoreIdeaOrigin = vi.fn(() => {
      useIdeaStore.setState({ error: "当前工作区不是这个脑洞的来源导图。" });
      return false;
    });
    useIdeaStore.setState({ mindMap: sampleMap(), ideas: [sampleIdeaWithOrigin()], activeIdeaId: "idea-1", restoreIdeaOrigin });

    render(React.createElement(App));
    fireEvent.click(screen.getByRole("button", { name: "返回来源位置" }));

    expect(screen.getByRole("main")).toHaveAttribute("data-app-view", "ideas");
    expect(screen.getByRole("alert")).toHaveTextContent("当前工作区不是这个脑洞的来源导图。");
  });

  it("renders an unavailable origin as a non-interactive summary when the source map changed", () => {
    const mismatchedMap = { ...sampleMap(), id: "map-2", topic: "另一张导图" };
    const transformedIdea: IdeaCard = {
      ...sampleIdeaWithOrigin(),
      id: "idea-transform",
      parentId: "idea-1",
      transformDirection: "更像 Agent skill",
      origin: {
        ...sampleIdeaWithOrigin().origin!,
        collisionRecipe: "invert-assumption",
      },
    };
    useIdeaStore.setState({ mindMap: mismatchedMap, ideas: [transformedIdea], activeIdeaId: transformedIdea.id, activeMindNodeId: "node-1" });

    render(React.createElement(App));

    expect(screen.getByRole("region", { name: "来源星座" })).toBeInTheDocument();
    expect(screen.getByText("原导图已不可用")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "返回来源位置" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /返回来源节点/ })).not.toBeInTheDocument();
    expect(screen.getByTestId("origin-source-summary")).toHaveTextContent("开发者灵感枯竭 → 烂尾焦虑 → 项目遗迹馆");
    const lineage = within(screen.getByRole("region", { name: "来源星座" })).getByTestId("origin-lineage");
    expect(within(lineage).getByText("碰撞配方")).toBeInTheDocument();
    expect(within(lineage).getByText("反过来做")).toBeInTheDocument();
    expect(within(lineage).getByText("后续变形")).toBeInTheDocument();
    expect(within(lineage).getByText("更像 Agent skill")).toBeInTheDocument();
  });

  it.each([
    ["缺失", (map: BrainstormMap) => ({ ...map, nodes: map.nodes.filter((node) => node.id !== "node-2") })],
    ["不可选", (map: BrainstormMap) => ({ ...map, nodes: map.nodes.map((node) => node.id === "node-2" ? { ...node, selectable: false } : node) })],
  ])("renders a non-interactive origin summary when a saved source node is %s", (_state, makeMap) => {
    const incompleteMap = makeMap(sampleMap());
    useIdeaStore.setState({ mindMap: incompleteMap, ideas: [sampleIdeaWithOrigin()], activeIdeaId: "idea-1", activeMindNodeId: "node-1" });

    render(React.createElement(App));

    expect(screen.getByRole("region", { name: "来源星座" })).toHaveAttribute("data-origin-state", "unavailable");
    expect(screen.getByText("原导图已不可用")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "返回来源位置" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /返回来源节点/ })).not.toBeInTheDocument();
    expect(screen.getByTestId("origin-source-summary")).toHaveTextContent("开发者灵感枯竭 → 烂尾焦虑 → 项目遗迹馆");
  });

  it("disables continuing when any saved source node is missing", () => {
    const map = sampleMap();
    const incompleteMap = {
      ...map,
      nodes: map.nodes.filter((node) => node.id !== "node-2"),
      edges: map.edges.filter((edge) => edge.from !== "node-2" && edge.to !== "node-2"),
    };
    useIdeaStore.setState({ mindMap: incompleteMap, ideas: [sampleIdeaWithOrigin()], activeIdeaId: "idea-1", activeMindNodeId: "node-1" });

    render(React.createElement(App));

    expect(screen.getByRole("button", { name: "继续发散" })).toBeDisabled();
  });

  it("restores an idea origin before continuing its active branch", () => {
    const callOrder: string[] = [];
    const restoreIdeaOrigin = vi.fn((ideaId: string, focusNodeId?: string) => {
      callOrder.push("restore");
      return originalStoreActions.restoreIdeaOrigin(ideaId, focusNodeId);
    });
    const expandActiveMindNode = vi.fn(async () => {
      callOrder.push(`expand:${useIdeaStore.getState().activeMindNodeId ?? "none"}`);
    });
    useIdeaStore.setState({
      mindMap: sampleMap(),
      ideas: [sampleIdeaWithOrigin()],
      activeIdeaId: "idea-1",
      restoreIdeaOrigin,
      expandActiveMindNode,
    });

    render(React.createElement(App));
    fireEvent.click(screen.getByRole("button", { name: "继续发散" }));

    expect(callOrder).toEqual(["restore", "expand:node-2"]);
    expect(restoreIdeaOrigin).toHaveBeenCalledWith("idea-1");
    expect(screen.getByRole("main")).toHaveAttribute("data-app-view", "map");
  });

  it("keeps errors away from the bottom map controls", () => {
    useIdeaStore.setState({ mindMap: sampleMap(), activeMindNodeId: "node-1", error: "LLM 有问题：空间不足" });

    render(React.createElement(App));

    expect(screen.getByRole("alert")).toHaveClass("top-20");
    expect(screen.getByRole("alert")).not.toHaveClass("bottom-5");
  });

  it("uses human thinking-action labels instead of internal method names", () => {
    useIdeaStore.setState({ mindMap: sampleMap(), activeMindNodeId: "node-2" });

    render(React.createElement(MindMapCanvas));

    expect(screen.getAllByText("远距类比").length).toBeGreaterThan(0);
    expect(screen.queryByText("远联想")).not.toBeInTheDocument();
  });

  it("renders primary and remote curves with a highlighted selected path", () => {
    useIdeaStore.setState({ mindMap: sampleMap(), activeMindNodeId: "node-1" });

    const { container } = render(React.createElement(MindMapCanvas));
    const primaryEdge = container.querySelector("path[data-edge-variant='primary']");
    const remoteEdge = container.querySelector("path[data-edge-variant='remote']");

    expect(primaryEdge?.getAttribute("d")).toContain("C");
    expect(primaryEdge).toHaveAttribute("data-selected-path", "true");
    expect(remoteEdge).toHaveAttribute("stroke-dasharray", "3 4");
    const renderedPaths = Array.from(container.querySelectorAll("path[data-selected-path]"));
    expect(renderedPaths[0]).toHaveAttribute("data-selected-path", "false");
    expect(renderedPaths.at(-1)).toHaveAttribute("data-selected-path", "true");
  });

  it("exposes stable motion metadata for nodes and edges", () => {
    useIdeaStore.setState({ mindMap: sampleMap(), activeMindNodeId: "node-1", loading: "idle" });

    const { container } = render(React.createElement(MindMapCanvas));
    const selectedNode = container.querySelector('[data-motion-node-id="node-1"]');
    const remoteNode = container.querySelector('[data-motion-node-id="node-2"]');
    const remoteEdge = container.querySelector('[data-motion-edge-id="edge-2"]');

    expect(selectedNode).toHaveAttribute("data-motion-parent-id", "center");
    expect(selectedNode).toHaveAttribute("data-motion-selected", "true");
    expect(selectedNode).toHaveAttribute("data-motion-locked", "false");
    expect(remoteNode).toHaveAttribute("data-motion-parent-id", "node-1");
    expect(remoteEdge).toHaveAttribute("data-motion-source-id", "node-1");
    expect(remoteEdge).toHaveAttribute("data-motion-target-id", "node-2");
  });

  it("keeps toolbar actions disabled while the entrance burst settles", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 1280,
      bottom: 720,
      width: 1280,
      height: 720,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    useIdeaStore.setState({ mindMap: sampleMap(), activeMindNodeId: "node-1", loading: "idle" });

    render(React.createElement(MindMapCanvas));

    expect(screen.getByRole("region", { name: "思维星图舞台" })).toHaveAttribute("data-motion-playing", "true");
    expect(screen.getByRole("button", { name: "重掷未锁节点" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "继续发散" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "用这些词碰撞" })).toBeDisabled();
    expect(screen.getByLabelText("节点标题")).toBeDisabled();
    expect(screen.getByLabelText("节点备注")).toBeDisabled();
    expect(screen.getByLabelText("父节点")).toBeDisabled();
    expect(screen.getByRole("button", { name: "删除分支" })).toBeDisabled();
  });

  it("restores only selected nodes and their path after an ideas collision", () => {
    const map = sampleMap();

    const targets = selectMindMapMotionTargets(map.nodes, map.edges, "ideas", new Set(map.nodes.map((node) => node.id)));

    expect(targets.nodeIds).toEqual(["node-1"]);
    expect(targets.edgeIds).toEqual(["edge-1"]);
  });

  it("keeps collision recipes hidden until three selected keywords open them", () => {
    const generateIdeasFromMindMap = vi.fn(async (_viewport?: MindMapViewportSnapshot, _recipe?: CollisionRecipeId): Promise<void> => undefined);
    useIdeaStore.setState({
      mindMap: mapWithThreeSelectedNodes(),
      activeMindNodeId: "node-1",
      loading: "idle",
      generateIdeasFromMindMap,
    });

    render(React.createElement(MindMapCanvas));

    expect(screen.queryByRole("dialog", { name: "选择碰撞方式" })).not.toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: "用这些词碰撞" });
    fireEvent.click(trigger);

    expect(generateIdeasFromMindMap).not.toHaveBeenCalled();
    const picker = screen.getByRole("dialog", { name: "选择碰撞方式" });
    expect(picker).toBeVisible();
    expect(within(picker).getByRole("button", { name: /随机碰撞.*打散固定路径/ })).toHaveAttribute("aria-current", "true");
    expect(within(picker).getByRole("list", { name: "碰撞配方" }).querySelectorAll("button")).toHaveLength(6);
  });

  it("passes the current canvas viewport and selected recipe into idea generation", () => {
    const generateIdeasFromMindMap = vi.fn(async (_viewport?: MindMapViewportSnapshot, _recipe?: CollisionRecipeId): Promise<void> => undefined);
    const map = mapWithThreeSelectedNodes();
    useIdeaStore.setState({
      mindMap: map,
      activeMindNodeId: "node-1",
      loading: "idle",
      generateIdeasFromMindMap,
    });
    const { container } = render(React.createElement(MindMapCanvas));
    const stage = screen.getByRole("region", { name: "思维星图舞台" });

    fireEvent.wheel(stage, { deltaY: -120, clientX: 640, clientY: 360 });
    const world = container.querySelector("[data-mindmap-world]");
    const expectedScale = Number(world?.getAttribute("data-scale"));
    fireEvent.click(screen.getByRole("button", { name: "用这些词碰撞" }));
    fireEvent.click(screen.getByRole("button", { name: /借用结构.*借一个熟悉结构/ }));

    const passedViewport = generateIdeasFromMindMap.mock.calls[0]![0]!;
    expect(passedViewport.scale).toBe(expectedScale);
    expect(world).toHaveStyle({ transform: `translate3d(${passedViewport.panX}px, ${passedViewport.panY}px, 0) scale(${passedViewport.scale})` });
    expect(generateIdeasFromMindMap).toHaveBeenCalledWith(passedViewport, "borrow-structure");
    expect(screen.queryByRole("dialog", { name: "选择碰撞方式" })).not.toBeInTheDocument();
  });

  it("closes collision recipes with Escape or cancel and restores trigger focus", () => {
    useIdeaStore.setState({ mindMap: mapWithThreeSelectedNodes(), activeMindNodeId: "node-1", loading: "idle" });
    render(React.createElement(MindMapCanvas));
    const trigger = screen.getByRole("button", { name: "用这些词碰撞" });

    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("dialog", { name: "选择碰撞方式" }), { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "选择碰撞方式" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "取消选择碰撞方式" }));
    expect(screen.queryByRole("dialog", { name: "选择碰撞方式" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes collision recipes as soon as AI work locks the canvas", () => {
    useIdeaStore.setState({ mindMap: mapWithThreeSelectedNodes(), activeMindNodeId: "node-1", loading: "idle" });
    render(React.createElement(MindMapCanvas));

    fireEvent.click(screen.getByRole("button", { name: "用这些词碰撞" }));
    expect(screen.getByRole("dialog", { name: "选择碰撞方式" })).toBeVisible();

    act(() => useIdeaStore.setState({ loading: "expand" }));

    expect(screen.queryByRole("dialog", { name: "选择碰撞方式" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "用这些词碰撞" })).toBeDisabled();
  });

  it("does not converge an active path when that node is not selected", () => {
    const map = sampleMap();
    map.nodes[1] = { ...map.nodes[1], selected: false };
    map.nodes.push({
      ...map.nodes[1],
      id: "node-3",
      label: "失败展签",
      category: "物件",
      selected: true,
      parentId: "center",
    });
    map.edges.push({ id: "edge-3", from: "center", to: "node-3", label: "物件" });

    expect(selectIdeasConvergenceEdgeIds(map.nodes, map.edges)).toEqual(["edge-3"]);
  });

  it("keeps locked nodes and their edges still when reroll finishes", () => {
    const map = sampleMap();
    map.nodes[2] = { ...map.nodes[2], locked: true };

    const targets = selectMindMapMotionTargets(map.nodes, map.edges, "reroll", new Set(map.nodes.map((node) => node.id)));

    expect(targets.nodeIds).toEqual(["node-1"]);
    expect(targets.edgeIds).toEqual(["edge-1"]);
  });

  it("leaves a manual home override as soon as a second map request starts", () => {
    useIdeaStore.setState({ mindMap: sampleMap(), activeMindNodeId: "node-1" });
    render(React.createElement(App));

    fireEvent.click(screen.getByRole("button", { name: "返回首页" }));
    expect(screen.getByRole("main")).toHaveAttribute("data-app-view", "home");

    act(() => useIdeaStore.setState({ mindMap: undefined, ideas: [], loading: "map", topic: "第二个主题" }));

    expect(screen.getByRole("main")).toHaveAttribute("data-app-view", "map");
    expect(screen.getByText("正在点亮思维星图")).toBeInTheDocument();
  });

  it("returns from the home page to the temporarily saved map", () => {
    useIdeaStore.setState({ mindMap: sampleMap(), activeMindNodeId: "node-1" });
    render(React.createElement(App));

    fireEvent.click(screen.getByRole("button", { name: "返回首页" }));
    expect(screen.getByRole("main")).toHaveAttribute("data-app-view", "home");

    fireEvent.click(screen.getByRole("button", { name: "返回导图" }));
    expect(screen.getByRole("main")).toHaveAttribute("data-app-view", "map");
    expect(screen.getByRole("region", { name: "思维星图舞台" })).toBeVisible();
  });

  it("shows stageful AI work status while generation is running", () => {
    useIdeaStore.setState({ topic: "游戏机制产品", loading: "map", streamText: "raw-json-fragment" });

    render(React.createElement(App));

    expect(screen.getAllByText("正在拆解目标人群、场景和情绪").length).toBeGreaterThan(0);
    expect(screen.queryByText("raw-json-fragment")).not.toBeInTheDocument();
  });

  it.each([
    ["map", "正在点亮思维星图", "正在生成第一批联想节点"],
    ["expand", "联想正在向外爆发", "新节点正在碰撞并准备炸开"],
    ["reroll", "正在重组未锁节点", "旧组合正在散开，新的联想即将落位"],
    ["ideas", "正在碰撞生成想法", "选中的节点正在高速碰撞"],
  ] as const)("shows a blocking work layer for %s", (loading, title, detail) => {
    useIdeaStore.setState({ mindMap: sampleMap(), activeMindNodeId: "node-1", loading });

    render(React.createElement(MindMapCanvas));

    expect(screen.getByRole("region", { name: "思维星图舞台" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("mindmap-blocking-layer")).toBeInTheDocument();
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText(detail)).toBeInTheDocument();
  });

  it("renders an energy activity layer with operation telemetry", () => {
    useIdeaStore.setState({ mindMap: sampleMap(), activeMindNodeId: "node-1", loading: "expand" });

    const { container } = render(React.createElement(MindMapCanvas));
    const layer = screen.getByTestId("mindmap-blocking-layer");

    expect(layer).toHaveAttribute("data-motion-activity", "expand");
    expect(screen.getByRole("region", { name: "思维星图舞台" })).toHaveAttribute("data-motion-source-id", "node-1");
    expect(container.querySelector('[data-motion-energy-core="true"]')).toBeInTheDocument();
    expect(container.querySelectorAll("[data-motion-orbit]")).toHaveLength(3);
    expect(container.querySelectorAll("[data-motion-particle]").length).toBeGreaterThanOrEqual(6);
    expect(screen.getByText("联想链路同步中")).toBeInTheDocument();
  });

  it.each([
    ["map", "center"],
    ["expand", "node-1"],
    ["reroll", "center"],
    ["ideas", "center"],
  ] as const)("publishes %s motion intent with source %s", (loading, sourceId) => {
    useIdeaStore.setState({ topic: "开发者灵感枯竭", mindMap: sampleMap(), activeMindNodeId: "node-1", loading });

    render(React.createElement(MindMapCanvas));

    expect(screen.getByRole("region", { name: "思维星图舞台" })).toHaveAttribute("data-motion-operation", loading);
    expect(screen.getByRole("region", { name: "思维星图舞台" })).toHaveAttribute("data-motion-source-id", sourceId);
  });

  it("locks every map interaction while AI work is running", () => {
    const onBackHome = vi.fn();
    const openIncubator = vi.fn();
    const toggleMindNode = vi.fn();
    const toggleMindNodeLock = vi.fn();
    const moveMindNode = vi.fn();
    const persistWorkspace = vi.fn();
    useIdeaStore.setState({
      mindMap: sampleMap(),
      activeMindNodeId: "node-1",
      loading: "expand",
      openIncubator,
      toggleMindNode,
      toggleMindNodeLock,
      moveMindNode,
      persistWorkspace,
    });

    render(React.createElement(MindMapCanvas, { onBackHome }));

    const nodeButton = screen.getByRole("button", { name: "放大情绪 烂尾焦虑" });
    const lockButton = screen.getByRole("button", { name: "锁定 烂尾焦虑" });
    expect(nodeButton).toBeDisabled();
    expect(lockButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "返回首页" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /孵化箱/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "重掷未锁节点" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "继续发散" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "用这些词碰撞" })).toBeDisabled();

    fireEvent.click(nodeButton);
    fireEvent.click(lockButton);
    fireEvent.click(screen.getByRole("button", { name: "返回首页" }));
    fireEvent.click(screen.getByRole("button", { name: /孵化箱/ }));
    firePointer(nodeButton, "pointerdown", { pointerId: 20, clientX: 320, clientY: 228 });
    firePointer(nodeButton, "pointermove", { pointerId: 20, clientX: 560, clientY: 360 });
    firePointer(nodeButton, "pointerup", { pointerId: 20, clientX: 560, clientY: 360 });

    expect(onBackHome).not.toHaveBeenCalled();
    expect(openIncubator).not.toHaveBeenCalled();
    expect(toggleMindNode).not.toHaveBeenCalled();
    expect(toggleMindNodeLock).not.toHaveBeenCalled();
    expect(moveMindNode).not.toHaveBeenCalled();
    expect(persistWorkspace).not.toHaveBeenCalled();
  });

  it("discards an unfinished drag when AI work interrupts it", () => {
    const moveMindNode = vi.fn();
    const persistWorkspace = vi.fn();
    useIdeaStore.setState({
      mindMap: sampleMap(),
      activeMindNodeId: "node-1",
      loading: "idle",
      moveMindNode,
      persistWorkspace,
    });

    render(React.createElement(MindMapCanvas));
    const canvas = screen.getByRole("region", { name: "思维星图舞台" });
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, right: 1000, bottom: 600, width: 1000, height: 600, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
    const nodeButton = screen.getByRole("button", { name: "放大情绪 烂尾焦虑" });

    firePointer(nodeButton, "pointerdown", { pointerId: 21, clientX: 320, clientY: 228 });
    act(() => useIdeaStore.setState({ loading: "expand" }));
    act(() => useIdeaStore.setState({ loading: "idle" }));
    firePointer(nodeButton, "pointermove", { pointerId: 21, clientX: 560, clientY: 360 });
    firePointer(nodeButton, "pointerup", { pointerId: 21, clientX: 560, clientY: 360 });

    expect(moveMindNode).not.toHaveBeenCalled();
    expect(persistWorkspace).not.toHaveBeenCalled();
  });

  it("marks an idle map as available for interaction", () => {
    useIdeaStore.setState({ mindMap: sampleMap(), activeMindNodeId: "node-1", loading: "idle" });

    render(React.createElement(MindMapCanvas));

    expect(screen.getByRole("region", { name: "思维星图舞台" })).toHaveAttribute("aria-busy", "false");
    expect(screen.queryByTestId("mindmap-blocking-layer")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "放大情绪 烂尾焦虑" })).not.toBeDisabled();
  });

  it("presents generated ideas as an inspiration wall", () => {
    useIdeaStore.setState({ ideas: [sampleIdea()], activeIdeaId: "idea-1" });

    render(React.createElement(IdeaCardList));

    expect(screen.getByRole("heading", { name: "灵感展墙" })).toBeInTheDocument();
  });

  it("keeps the challenge entry out of the keyword canvas", () => {
    useIdeaStore.setState({ mindMap: sampleMap(), activeMindNodeId: "node-1" });

    render(React.createElement(MindMapCanvas));

    expect(screen.queryByRole("button", { name: "换个立场" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "召集讨论" })).not.toBeInTheDocument();
  });

  it("uses a narrow idea navigation and renders only the active report", () => {
    const second = { ...sampleIdea(), id: "idea-2", title: "夜间展签" };
    const setActiveIdea = vi.fn();
    useIdeaStore.setState({ ideas: [sampleIdea(), second], activeIdeaId: "idea-1", setActiveIdea });

    render(React.createElement(IdeaCardList));

    expect(screen.getByRole("navigation", { name: "脑洞导航" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "项目遗迹馆" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: "项目遗迹馆" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "夜间展签" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "夜间展签" }));
    expect(setActiveIdea).toHaveBeenCalledWith("idea-2");
  });

  it("shows the single report action and hides transform directions in a menu", () => {
    useIdeaStore.setState({ ideas: [sampleIdea()], activeIdeaId: "idea-1" });
    render(React.createElement(IdeaCardList));

    expect(screen.getByRole("button", { name: "深入验证" })).toBeInTheDocument();
    expect(screen.getByText("来源路径")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "更像产品" })).not.toBeInTheDocument();
  });

  it("renders persisted challenge notes in the active report", () => {
    useIdeaStore.setState({
      ideas: [sampleIdea()],
      activeIdeaId: "idea-1",
      challengesByIdeaId: {
        "idea-1": [{
          ideaId: "idea-1",
          role: "反常识派",
          challenge: "用户未必想把失败公开展示。",
          risk: "公开失败会让用户退出。",
          newDirection: "先做私密复盘，再决定是否分享。",
          createdAt: "2026-07-10T01:00:00.000Z",
        }],
      },
    });

    const { container } = render(React.createElement(IdeaCardList));

    const notes = screen.getByRole("region", { name: "反共识批注" });
    expect(notes).toHaveTextContent("反常识派");
    expect(notes).toHaveTextContent("质疑");
    expect(notes).toHaveTextContent("公开失败会让用户退出");
    expect(notes).toHaveTextContent("先做私密复盘");
    expect(container.querySelectorAll(".idea-challenge-card")).toHaveLength(0);
  });

  it("keeps one primary action after a report is refined", () => {
    useIdeaStore.setState({
      ideas: [sampleIdea()],
      activeIdeaId: "idea-1",
      refinementsByIdeaId: { "idea-1": sampleRefinement() },
    });
    const { container } = render(React.createElement(IdeaCardList));

    expect(screen.getAllByRole("button", { name: "收束推进" })).toHaveLength(1);
    expect(container.querySelectorAll("button.bg-spark-500")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "继续发散" })).not.toHaveClass("bg-spark-500");
  });

  it("reveals the decision brief and a persistent three-stage checklist after 收束推进", () => {
    useIdeaStore.setState({
      ideas: [sampleIdea()],
      activeIdeaId: "idea-1",
      refinementsByIdeaId: { "idea-1": sampleRefinement() },
      executionPlansByIdeaId: {},
    });

    render(React.createElement(IdeaCardList));

    expect(screen.getByText("开工决策简报")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "从一小时到一周" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "收束推进" }));

    expect(screen.getByRole("heading", { name: "从一小时到一周" })).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    const firstTask = screen.getByRole("checkbox", { name: /1小时 MVP/ });
    fireEvent.click(firstTask);

    expect(firstTask).toBeChecked();
    expect(useIdeaStore.getState().executionPlansByIdeaId["idea-1"]?.tasks[0]?.completed).toBe(true);
    const persisted = JSON.parse(localStorage.getItem("idea-lab:v2") ?? "{}") as {
      workspace?: { executionPlansByIdeaId?: Record<string, IdeaExecutionPlan> };
    };
    expect(persisted.workspace?.executionPlansByIdeaId?.["idea-1"]?.tasks[0]?.completed).toBe(true);
  });
});
