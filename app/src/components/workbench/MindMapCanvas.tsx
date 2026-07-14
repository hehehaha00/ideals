// 这个文件组合全屏思维导图、轻量控制栏和底部碰撞操作。
import { Archive, ArrowLeft, BoxSelect, Focus, GitMerge, Maximize2, Network, Plus, Redo2, Shuffle, Undo2 } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { useIdeaStore } from "../../store/ideaStore";
import type { CollisionRecipeId } from "../../types/idea";
import { Button } from "../ui/Button";
import { CollisionRecipePicker } from "./CollisionRecipePicker";
import { MindMapActivity, type MindMapMotionOperation } from "./MindMapActivity";
import { MindMapContextPanel } from "./MindMapContextPanel";
import { MindMapEdges } from "./MindMapEdges";
import { MindMapGroups } from "./MindMapGroups";
import { MindMapMinimap } from "./MindMapMinimap";
import { MindMapNode } from "./MindMapNode";
import { MindMapNodeComposer } from "./MindMapNodeComposer";
import { MindMapSearch } from "./MindMapSearch";
import { MindMapSelectionToolbar } from "./MindMapSelectionToolbar";
import { DEFAULT_MIND_MAP_CULLING_THRESHOLD, getMindMapRelatedNodeIds, getMindMapViewportNodeIds, getVisibleMindMapNodeIds, nodesInSelectionRect, screenToWorldPercent, type CanvasSafeArea, type MindMapViewport } from "./mindMapGeometry";
import { useMindMapMotion } from "./useMindMapMotion";

const CANVAS_SAFE_AREA: CanvasSafeArea = { top: 92, right: 72, bottom: 112, left: 72 };
const MIN_SCALE = 0.35;
const MAX_SCALE = 2.4;

interface MindMapCanvasProps {
  onBackHome?: () => void;
}

type LoadingStage = ReturnType<typeof useIdeaStore.getState>["loading"];

interface BusyCopy {
  title: string;
  detail: string;
}

// 为导图内的主要 AI 操作提供明确、可感知的工作状态。
function getBusyCopy(loading: Exclude<LoadingStage, "idle">): BusyCopy {
  switch (loading) {
    case "map":
      return { title: "正在点亮思维星图", detail: "正在生成第一批联想节点" };
    case "expand":
      return { title: "联想正在向外爆发", detail: "新节点正在碰撞并准备炸开" };
    case "reroll":
      return { title: "正在重组未锁节点", detail: "旧组合正在散开，新的联想即将落位" };
    case "ideas":
      return { title: "正在碰撞生成想法", detail: "选中的节点正在高速碰撞" };
    case "challenge":
      return { title: "正在寻找反共识", detail: "挑战角色正在拆解默认假设" };
    case "discussionBranch":
      return { title: "讨论正在长出新分支", detail: "选定方向正在炸开新的联想节点" };
    case "discussionResponse":
      return { title: "编辑部正在回应", detail: "你的介入正在改变这场讨论" };
    default:
      return { title: "AI 正在处理灵感", detail: "请稍候，完成后会自动恢复操作" };
  }
}

// 把商店工作阶段映射为导图的四种动画意图。
function getMotionOperation(loading: LoadingStage): MindMapMotionOperation | undefined {
  return loading === "map" || loading === "expand" || loading === "reroll" || loading === "ideas" || loading === "discussionBranch" ? loading : undefined;
}

// 渲染一个视口内完成选择、发散和碰撞的桌面导图。
export function MindMapCanvas({ onBackHome }: MindMapCanvasProps): JSX.Element | null {
  const canvasRef = useRef<HTMLDivElement>(null);
  const collisionTriggerRef = useRef<HTMLSpanElement>(null);
  const panGestureRef = useRef<{ pointerId: number; startX: number; startY: number; panX: number; panY: number }>();
  const selectionGestureRef = useRef<{ pointerId: number; startX: number; startY: number; append: boolean }>();
  const [viewport, setViewport] = useState<MindMapViewport>(() => useIdeaStore.getState().mindMapViewport ?? { panX: 0, panY: 0, scale: 1 });
  const viewportRef = useRef<MindMapViewport>(viewport);
  viewportRef.current = viewport;
  const [draggingNodeId, setDraggingNodeId] = useState<string>();
  const [canvasSize, setCanvasSize] = useState({ width: 1280, height: 720 });
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; endX: number; endY: number }>();
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerPosition, setComposerPosition] = useState<{ x: number; y: number }>();
  const [focusedNodeId, setFocusedNodeId] = useState<string>();
  const [selectionMode, setSelectionMode] = useState(false);
  const [collisionRecipeOpen, setCollisionRecipeOpen] = useState(false);
  const topic = useIdeaStore((state) => state.topic);
  const mindMap = useIdeaStore((state) => state.mindMap);
  const ideas = useIdeaStore((state) => state.ideas);
  const activeMindNodeId = useIdeaStore((state) => state.activeMindNodeId);
  const favorites = useIdeaStore((state) => state.favorites);
  const loading = useIdeaStore((state) => state.loading);
  const openIncubator = useIdeaStore((state) => state.openIncubator);
  const rerollMindMapUnlockedNodes = useIdeaStore((state) => state.rerollMindMapUnlockedNodes);
  const expandActiveMindNode = useIdeaStore((state) => state.expandActiveMindNode);
  const generateIdeasFromMindMap = useIdeaStore((state) => state.generateIdeasFromMindMap);
  const mindMapCanUndo = useIdeaStore((state) => state.mindMapCanUndo);
  const mindMapCanRedo = useIdeaStore((state) => state.mindMapCanRedo);
  const undoMindMap = useIdeaStore((state) => state.undoMindMap);
  const redoMindMap = useIdeaStore((state) => state.redoMindMap);
  const addMindNode = useIdeaStore((state) => state.addMindNode);
  const renameMindNode = useIdeaStore((state) => state.renameMindNode);
  const updateMindNodeNote = useIdeaStore((state) => state.updateMindNodeNote);
  const reparentMindNode = useIdeaStore((state) => state.reparentMindNode);
  const deleteMindNodeSubtree = useIdeaStore((state) => state.deleteMindNodeSubtree);
  const createMindNodeGroup = useIdeaStore((state) => state.createMindNodeGroup);
  const ungroupMindNodes = useIdeaStore((state) => state.ungroupMindNodes);
  const setMindNodesSelected = useIdeaStore((state) => state.setMindNodesSelected);
  const setMindNodesLocked = useIdeaStore((state) => state.setMindNodesLocked);
  const revealMindNode = useIdeaStore((state) => state.revealMindNode);
  const mindMapNavigationIntent = useIdeaStore((state) => state.mindMapNavigationIntent);
  const consumeMindMapNavigationIntent = useIdeaStore((state) => state.consumeMindMapNavigationIntent);
  const setMindMapViewport = useIdeaStore((state) => state.setMindMapViewport);
  const previousMapIdRef = useRef<string>();
  const viewportSaveReadyRef = useRef(false);
  const viewportPersistTimerRef = useRef<number>();
  const viewportDirtyRef = useRef(false);
  const persistWorkspace = useIdeaStore((state) => state.persistWorkspace);

  // 镜头属于工作区临时状态；离开导图前后都保留当前缩放和位置。
  useEffect(() => {
    if (!mindMap) return;
    if (!viewportSaveReadyRef.current) {
      viewportSaveReadyRef.current = true;
      return;
    }
    setMindMapViewport(viewport);
    viewportDirtyRef.current = true;
    if (viewportPersistTimerRef.current) window.clearTimeout(viewportPersistTimerRef.current);
    viewportPersistTimerRef.current = window.setTimeout(() => {
      viewportPersistTimerRef.current = undefined;
      viewportDirtyRef.current = false;
      persistWorkspace();
    }, 250);
  }, [mindMap?.id, persistWorkspace, setMindMapViewport, viewport]);

  // 离开导图时补写尚未到达防抖时间的镜头，保证立即返回也不会丢位置。
  useEffect(() => () => {
    if (viewportPersistTimerRef.current) window.clearTimeout(viewportPersistTimerRef.current);
    if (viewportDirtyRef.current) persistWorkspace();
  }, [persistWorkspace]);
  const handleNodeDragStateChange = useCallback((nodeId: string, dragging: boolean): void => {
    setDraggingNodeId((current) => dragging ? nodeId : current === nodeId ? undefined : current);
  }, []);

  // 画布尺寸只服务视口和微缩图换算，不写入业务数据。
  useLayoutEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const update = (): void => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) setCanvasSize({ width: rect.width, height: rect.height });
    };
    update();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(update);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, []);

  const displayMap = loading === "map" ? undefined : mindMap;
  const nodes = displayMap?.nodes ?? [];
  const visibleNodeIds = useMemo(() => getVisibleMindMapNodeIds(nodes), [nodes]);
  const visibleNodes = useMemo(() => nodes.filter((node) => visibleNodeIds.has(node.id)), [nodes, visibleNodeIds]);
  const selectedNodes = visibleNodes.filter((node) => node.selectable && node.selected);
  const selectedNodeIds = selectedNodes.map((node) => node.id);
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : undefined;
  const groupedSelectedCount = selectedNodes.filter((node) => Boolean(node.groupId)).length;
  const activeNode = nodes.find((node) => node.id === activeMindNodeId);
  const relatedNodeIds = useMemo(() => getMindMapRelatedNodeIds(nodes, focusedNodeId), [focusedNodeId, nodes]);
  const protectedNodeIds = useMemo(() => {
    const protectedIds = new Set<string>();
    if (displayMap?.center.id) protectedIds.add(displayMap.center.id);
    if (activeMindNodeId) protectedIds.add(activeMindNodeId);
    if (draggingNodeId) protectedIds.add(draggingNodeId);
    for (const node of nodes) if (node.selected) protectedIds.add(node.id);
    if (focusedNodeId) for (const nodeId of relatedNodeIds) protectedIds.add(nodeId);
    return protectedIds;
  }, [activeMindNodeId, displayMap?.center.id, draggingNodeId, focusedNodeId, nodes, relatedNodeIds]);
  const renderNodeIds = useMemo(() => {
    if (visibleNodes.length <= DEFAULT_MIND_MAP_CULLING_THRESHOLD) return visibleNodeIds;
    return getMindMapViewportNodeIds({
      nodes: visibleNodes,
      viewport,
      canvasSize,
      protectedNodeIds,
    });
  }, [canvasSize, protectedNodeIds, viewport, visibleNodeIds, visibleNodes]);
  const renderNodes = useMemo(
    () => renderNodeIds === visibleNodeIds ? visibleNodes : visibleNodes.filter((node) => renderNodeIds.has(node.id)),
    [renderNodeIds, visibleNodeIds, visibleNodes],
  );
  const renderEdges = useMemo(
    () => displayMap?.edges.filter((edge) => renderNodeIds.has(edge.from) && renderNodeIds.has(edge.to)) ?? [],
    [displayMap?.edges, renderNodeIds],
  );
  const childCountById = useMemo(() => {
    const counts = new Map<string, number>();
    for (const node of nodes) if (node.parentId) counts.set(node.parentId, (counts.get(node.parentId) ?? 0) + 1);
    return counts;
  }, [nodes]);
  const motionOperation = getMotionOperation(loading);
  const motionSourceId = loading === "expand" && activeMindNodeId ? activeMindNodeId : "center";
  const ideaResultKey = ideas.map((idea) => idea.id).join("|");
  const { motionPlaying, reducedMotion } = useMindMapMotion({ scope: canvasRef, loading, nodes, activeNodeId: activeMindNodeId, resultKey: ideaResultKey });
  const interactionLocked = loading !== "idle" || motionPlaying;
  const busyCopy = loading === "idle" ? undefined : getBusyCopy(loading);

  // AI 开始工作时废弃未完成的平移和框选，防止旧 pointerup 改写当前请求状态。
  useEffect(() => {
    if (interactionLocked) {
      panGestureRef.current = undefined;
      selectionGestureRef.current = undefined;
      setSelectionBox(undefined);
      setCollisionRecipeOpen(false);
    }
  }, [interactionLocked]);

  // 选择不足三个关键词时关闭深入入口，避免配方作用于过期选择。
  useEffect(() => {
    if (selectedNodes.length < 3) setCollisionRecipeOpen(false);
  }, [selectedNodes.length]);

  // 新导图替换旧导图时重置纯视口状态，避免旧搜索聚焦和镜头位置污染新主题。
  useEffect(() => {
    const mapId = mindMap?.id;
    if (!mapId) return;
    const mapChanged = Boolean(previousMapIdRef.current && previousMapIdRef.current !== mapId);
    const target = mapChanged ? { panX: 0, panY: 0, scale: 1 } : useIdeaStore.getState().mindMapViewport ?? { panX: 0, panY: 0, scale: 1 };
    setViewport((current) => current.panX === target.panX && current.panY === target.panY && current.scale === target.scale ? current : target);
    previousMapIdRef.current = mapId;
    setFocusedNodeId(undefined);
    setComposerOpen(false);
    setComposerPosition(undefined);
    setSelectionMode(false);
    setCollisionRecipeOpen(false);
    setDraggingNodeId(undefined);
    panGestureRef.current = undefined;
    selectionGestureRef.current = undefined;
    setSelectionBox(undefined);
  }, [mindMap?.id]);

  // 报告页只发布一次导航意图；画布负责消费并恢复自己的镜头状态。
  useEffect(() => {
    if (!mindMapNavigationIntent || mindMapNavigationIntent.mapId !== mindMap?.id) return;
    setViewport({ ...mindMapNavigationIntent.viewport });
    setFocusedNodeId(mindMapNavigationIntent.focusNodeId);
    consumeMindMapNavigationIntent();
  }, [consumeMindMapNavigationIntent, mindMap?.id, mindMapNavigationIntent]);

  if (!mindMap && loading !== "map") {
    return null;
  }

  // 围绕指针位置缩放，让用户不会在放大时丢失正在观察的节点。
  function handleWheel(event: ReactWheelEvent<HTMLElement>): void {
    if (interactionLocked) return;
    event.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setViewport((current) => {
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round((current.scale * (event.deltaY < 0 ? 1.12 : 0.89)) * 100) / 100));
      const pointerX = event.clientX - rect.left - rect.width / 2;
      const pointerY = event.clientY - rect.top - rect.height / 2;
      const ratio = nextScale / current.scale;
      return { scale: nextScale, panX: pointerX - (pointerX - current.panX) * ratio, panY: pointerY - (pointerY - current.panY) * ratio };
    });
  }

  // 只在空白画布上启动平移，避免和节点拖动、按钮操作冲突。
  function handleCanvasPointerDown(event: ReactPointerEvent<HTMLElement>): void {
    const target = event.target as Element;
    if (interactionLocked || event.button !== 0 || target.closest("button, input, select, .mindmap-minimap, .mindmap-search, .mindmap-composer, footer, header, aside")) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    if (event.shiftKey || selectionMode) {
      selectionGestureRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, append: event.shiftKey };
      setSelectionBox({ startX: event.clientX, startY: event.clientY, endX: event.clientX, endY: event.clientY });
      return;
    }
    panGestureRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, panX: viewport.panX, panY: viewport.panY };
  }

  function handleCanvasPointerMove(event: ReactPointerEvent<HTMLElement>): void {
    if (interactionLocked) return;
    const selection = selectionGestureRef.current;
    if (selection?.pointerId === event.pointerId && !interactionLocked) {
      setSelectionBox({ startX: selection.startX, startY: selection.startY, endX: event.clientX, endY: event.clientY });
      return;
    }
    const gesture = panGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || interactionLocked) return;
    setViewport((current) => ({ ...current, panX: gesture.panX + event.clientX - gesture.startX, panY: gesture.panY + event.clientY - gesture.startY }));
  }

  function finishCanvasPan(event: ReactPointerEvent<HTMLElement>): void {
    if (interactionLocked) {
      panGestureRef.current = undefined;
      selectionGestureRef.current = undefined;
      setSelectionBox(undefined);
      return;
    }
    const selection = selectionGestureRef.current;
    if (selection?.pointerId === event.pointerId && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const start = screenToWorldPercent({ clientX: selection.startX, clientY: selection.startY }, rect, viewport);
      const end = screenToWorldPercent({ clientX: event.clientX, clientY: event.clientY }, rect, viewport);
      setMindNodesSelected(nodesInSelectionRect(visibleNodes, { startX: start.x, startY: start.y, endX: end.x, endY: end.y }), selection.append);
      selectionGestureRef.current = undefined;
      setSelectionBox(undefined);
    }
    if (panGestureRef.current?.pointerId === event.pointerId) panGestureRef.current = undefined;
  }

  // 系统取消指针时只清理手势，不把半成品框选提交到工作区。
  function cancelCanvasGesture(): void {
    panGestureRef.current = undefined;
    selectionGestureRef.current = undefined;
    setSelectionBox(undefined);
  }

  function handleCanvasDoubleClick(event: ReactMouseEvent<HTMLElement>): void {
    const target = event.target as Element;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (interactionLocked || target.closest("button, input, select, .mindmap-minimap, .mindmap-search, .mindmap-composer, footer, header, aside") || !rect) return;
    setComposerPosition(screenToWorldPercent(event, rect, viewport));
    setComposerOpen(true);
  }

  // 缩放并平移到能完整容纳当前全部节点的视口。
  function fitAllNodes(): void {
    if (nodes.length === 0) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const xs = visibleNodes.map((node) => node.x);
    const ys = visibleNodes.map((node) => node.y);
    const minX = Math.min(...xs) - 8;
    const maxX = Math.max(...xs) + 8;
    const minY = Math.min(...ys) - 10;
    const maxY = Math.max(...ys) + 10;
    const scale = Math.min(1.25, Math.max(MIN_SCALE, Math.min(88 / Math.max(1, maxX - minX), 76 / Math.max(1, maxY - minY))));
    setViewport({ scale, panX: (50 - (minX + maxX) / 2) * rect.width / 100 * scale, panY: (50 - (minY + maxY) / 2) * rect.height / 100 * scale });
  }

  // 将指定世界点移到视口中心，供微缩图和搜索定位复用。
  function navigateToWorld(worldCenter: { x: number; y: number }): void {
    setViewport((current) => ({ ...current, panX: (50 - worldCenter.x) * canvasSize.width / 100 * current.scale, panY: (50 - worldCenter.y) * canvasSize.height / 100 * current.scale }));
  }

  // 关闭配方并把键盘焦点交还给打开它的碰撞按钮。
  function closeCollisionRecipePicker(): void {
    setCollisionRecipeOpen(false);
    collisionTriggerRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }

  // 选择思维动作后携带当前镜头发起碰撞，并立即收起浮层。
  function selectCollisionRecipe(recipeId: CollisionRecipeId): void {
    if (interactionLocked) return;
    setCollisionRecipeOpen(false);
    void generateIdeasFromMindMap(viewport, recipeId);
  }

  return (
    <section
      ref={canvasRef}
      className="mindmap-fullscreen relative h-screen min-h-[640px] w-full overflow-hidden text-[#fff7df]"
      aria-busy={interactionLocked}
      aria-label="思维星图舞台"
      data-motion-operation={loading}
      data-motion-playing={motionPlaying}
      data-motion-reduced={reducedMotion}
      data-motion-source-id={motionSourceId}
      data-view="fullscreen-map"
      onPointerCancel={cancelCanvasGesture}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={finishCanvasPan}
      onDoubleClick={handleCanvasDoubleClick}
      onWheel={handleWheel}
    >
      <header className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-between gap-6 px-7 py-6">
        <div className="pointer-events-auto min-w-0">
          <button className="inline-flex items-center gap-2 text-sm text-white/62 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-spark-500 disabled:cursor-not-allowed disabled:opacity-40" type="button" disabled={interactionLocked} onClick={() => {
            if (!interactionLocked) {
              onBackHome?.();
            }
          }}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            返回首页
          </button>
          <p className="mt-2 max-w-lg truncate font-mono text-xs uppercase tracking-[0.22em] text-spark-600">Idea Lab · {displayMap?.stuckType ?? "正在发散"}</p>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <button aria-label="撤销" title="撤销" className="mindmap-icon-button" disabled={!mindMapCanUndo || interactionLocked} type="button" onClick={undoMindMap}><Undo2 className="h-4 w-4" aria-hidden="true" /></button>
          <button aria-label="重做" title="重做" className="mindmap-icon-button" disabled={!mindMapCanRedo || interactionLocked} type="button" onClick={redoMindMap}><Redo2 className="h-4 w-4" aria-hidden="true" /></button>
          <button aria-label="回到中心" title="回到中心" className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/12 bg-white text-[#211a15] transition hover:bg-[#fff7df] disabled:opacity-40" disabled={interactionLocked} type="button" onClick={() => setViewport({ panX: 0, panY: 0, scale: 1 })}><Focus className="h-4 w-4" aria-hidden="true" /></button>
          <button aria-label="适应全部节点" title="适应全部节点" className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/12 bg-white text-[#211a15] transition hover:bg-[#fff7df] disabled:opacity-40" disabled={!displayMap || interactionLocked} type="button" onClick={fitAllNodes}><Maximize2 className="h-4 w-4" aria-hidden="true" /></button>
          <Button variant="secondary" icon={<Shuffle className="h-4 w-4" />} disabled={!displayMap || interactionLocked} onClick={() => void rerollMindMapUnlockedNodes()}>
            重掷未锁节点
          </Button>
          <Button variant="secondary" icon={<Archive className="h-4 w-4" />} disabled={interactionLocked} onClick={() => {
            if (!interactionLocked) {
              openIncubator();
            }
          }}>
            孵化箱{favorites.length > 0 ? ` ${favorites.length}` : ""}
          </Button>
        </div>
      </header>

      {displayMap && (
        <div className="pointer-events-auto absolute left-7 top-24 z-40 flex items-start gap-2">
          <div><MindMapSearch disabled={interactionLocked} nodes={nodes} onFocusNode={(node) => { revealMindNode(node.id); setFocusedNodeId(node.id); setMindNodesSelected([node.id]); navigateToWorld(node); }} />{focusedNodeId && <button className="mt-2 font-mono text-[10px] tracking-[0.12em] text-spark-500 hover:text-white disabled:opacity-40" disabled={interactionLocked} type="button" onClick={() => setFocusedNodeId(undefined)}>退出局部星系</button>}</div>
          <button aria-label="框选节点" aria-pressed={selectionMode} className="mindmap-icon-button" disabled={interactionLocked} title="框选节点（Shift + 拖动）" type="button" onClick={() => setSelectionMode((current) => !current)}><BoxSelect className="h-4 w-4" aria-hidden="true" /></button>
          <button aria-label="新增节点" className="mindmap-icon-button" disabled={interactionLocked} title="新增节点" type="button" onClick={() => { setComposerPosition(undefined); setComposerOpen(true); }}><Plus className="h-4 w-4" aria-hidden="true" /></button>
        </div>
      )}

      <MindMapNodeComposer disabled={interactionLocked} open={composerOpen} onClose={() => setComposerOpen(false)} onSubmit={(label, category) => { addMindNode(label, category, composerPosition ? { ...composerPosition, parentId: activeMindNodeId } : undefined); setComposerOpen(false); }} />

      <div
        className="absolute inset-0 origin-center will-change-transform"
        data-mindmap-world="true"
        data-scale={viewport.scale}
        style={{ transform: `translate3d(${viewport.panX}px, ${viewport.panY}px, 0) scale(${viewport.scale})` }}
      >
        {displayMap ? (
          <>
            <MindMapGroups groups={displayMap.groups ?? []} nodes={nodes} />
            <MindMapEdges activeNodeId={activeMindNodeId} edges={renderEdges} focusNodeIds={focusedNodeId ? relatedNodeIds : undefined} nodes={renderNodes} />
            {renderNodes.map((node) => (
              <MindMapNode key={node.id} active={node.id === activeMindNodeId} canvasRef={canvasRef} childCount={childCountById.get(node.id) ?? 0} dimmed={Boolean(focusedNodeId) && !relatedNodeIds.has(node.id)} interactionLocked={interactionLocked} node={node} onDragStateChange={handleNodeDragStateChange} safeArea={CANVAS_SAFE_AREA} viewportRef={viewportRef} zoom={viewport.scale} />
            ))}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-center" aria-hidden="true">
            <div>
              <h2 className="max-w-xl break-words font-serif text-4xl leading-tight opacity-55">{topic}</h2>
            </div>
          </div>
        )}
      </div>

      {selectionBox && <div className="mindmap-selection-box" aria-hidden="true" style={{ left: Math.min(selectionBox.startX, selectionBox.endX), top: Math.min(selectionBox.startY, selectionBox.endY), width: Math.abs(selectionBox.endX - selectionBox.startX), height: Math.abs(selectionBox.endY - selectionBox.startY) }} />}

      {displayMap && selectedNode && (
        <div className="pointer-events-none absolute right-6 top-24 z-40" data-testid="mindmap-context-panel-layer">
          <div className="pointer-events-auto">
            <MindMapContextPanel
              center={displayMap.center}
              disabled={interactionLocked}
              node={selectedNode}
              nodes={nodes}
              onClose={() => setMindNodesSelected([])}
              onDelete={(nodeId) => { deleteMindNodeSubtree(nodeId); setMindNodesSelected([]); }}
              onRename={renameMindNode}
              onReparent={reparentMindNode}
              onUpdateNote={updateMindNodeNote}
            />
          </div>
        </div>
      )}

      {displayMap && (
        <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center px-6 pb-6">
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-3 rounded-full border border-white/12 bg-[#171411]/86 px-4 py-3 shadow-2xl backdrop-blur-xl">
            <span className="px-2 text-sm text-white/62">已选 {selectedNodes.length} 个节点</span>
            <MindMapSelectionToolbar
              count={selectedNodes.length}
              disabled={interactionLocked}
              groupedCount={groupedSelectedCount}
              selectedNodeIds={selectedNodeIds}
              onClear={() => setMindNodesSelected([])}
              onCreateGroup={createMindNodeGroup}
              onLock={(locked) => setMindNodesLocked(selectedNodeIds, locked)}
              onUngroup={ungroupMindNodes}
            />
            <Button variant="secondary" icon={<Network className="h-4 w-4" />} disabled={!activeNode?.selectable || interactionLocked} onClick={() => void expandActiveMindNode()}>
              继续发散
            </Button>
            <span className="contents" ref={collisionTriggerRef}>
              <Button variant="primary" icon={<GitMerge className="h-4 w-4" />} aria-expanded={collisionRecipeOpen} aria-haspopup="dialog" disabled={selectedNodes.length < 3 || interactionLocked} onClick={() => setCollisionRecipeOpen(true)}>
                用这些词碰撞
              </Button>
            </span>
          </div>
        </footer>
      )}

      {displayMap && collisionRecipeOpen && (
        <aside className="pointer-events-auto absolute bottom-24 left-1/2 z-50 -translate-x-1/2">
          <CollisionRecipePicker disabled={interactionLocked} onCancel={closeCollisionRecipePicker} onSelect={selectCollisionRecipe} />
        </aside>
      )}

      {displayMap && (
        <aside className="pointer-events-auto absolute bottom-6 right-6 z-40">
          <div className="mb-2 text-right font-mono text-[10px] tracking-[0.18em] text-white/42">{Math.round(viewport.scale * 100)}%</div>
          <MindMapMinimap activeNodeId={activeMindNodeId} canvasSize={canvasSize} disabled={interactionLocked} map={displayMap} onNavigate={navigateToWorld} viewport={viewport} />
        </aside>
      )}

      {busyCopy && <MindMapActivity operation={motionOperation ?? (loading === "challenge" ? "challenge" : "map")} title={busyCopy.title} detail={busyCopy.detail} />}
      {motionPlaying && !busyCopy && <div className="absolute inset-0 z-30 cursor-wait" data-testid="mindmap-motion-shield" aria-hidden="true" />}
    </section>
  );
}
