// 这个文件展示单个导图节点，并处理选择、锁定和 Pointer Events 拖动。
import { ChevronDown, ChevronRight, Lock, Unlock } from "lucide-react";
import { memo, useEffect, useRef, type MutableRefObject, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { cn } from "../../lib/cn";
import { useIdeaStore } from "../../store/ideaStore";
import type { MindNode as MindNodeData, MindNodeCategory } from "../../types/idea";
import { pointToCanvasPercent, type CanvasSafeArea, type MindMapNodeBounds, type MindMapViewport } from "./mindMapGeometry";

const DRAG_THRESHOLD_PX = 5;
const NODE_VISUAL_BOUNDS: MindMapNodeBounds = { halfWidth: 70, halfHeight: 28, lockOutsetTop: 22, lockOutsetRight: 24 };

const CATEGORY_STYLE: Record<MindNodeCategory, string> = {
  中心: "text-[#fff7df]",
  人群: "text-sky-100",
  场景: "text-yellow-100",
  情绪: "text-rose-100",
  物件: "text-mint-100",
  结构: "text-violet-100",
  限制: "text-white/72",
  远联想: "text-[#ffd7bf]",
};

const CATEGORY_LABEL: Record<MindNodeCategory, string> = {
  中心: "中心主题",
  人群: "换人群",
  场景: "换场景",
  情绪: "放大情绪",
  物件: "找载体",
  结构: "借结构",
  限制: "加限制",
  远联想: "远距类比",
};

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
  grabOffset: { x: number; y: number };
}

interface MindMapNodeProps {
  node: MindNodeData;
  active: boolean;
  interactionLocked: boolean;
  canvasRef: RefObject<HTMLDivElement>;
  onDragStateChange: (nodeId: string, dragging: boolean) => void;
  safeArea: CanvasSafeArea;
  viewportRef: MutableRefObject<MindMapViewport>;
  zoom: number;
  dimmed?: boolean;
  childCount?: number;
}

// 渲染节点并在拖动释放后持久化工作区。
export const MindMapNode = memo(function MindMapNode({ node, active, interactionLocked, canvasRef, onDragStateChange, safeArea, viewportRef, zoom, dimmed = false, childCount = 0 }: MindMapNodeProps): JSX.Element {
  const toggleMindNode = useIdeaStore((state) => state.toggleMindNode);
  const toggleMindNodeLock = useIdeaStore((state) => state.toggleMindNodeLock);
  const moveMindNode = useIdeaStore((state) => state.moveMindNode);
  const beginMindMapEdit = useIdeaStore((state) => state.beginMindMapEdit);
  const endMindMapEdit = useIdeaStore((state) => state.endMindMapEdit);
  const persistWorkspace = useIdeaStore((state) => state.persistWorkspace);
  const toggleMindNodeCollapsed = useIdeaStore((state) => state.toggleMindNodeCollapsed);
  const dragRef = useRef<DragState>();
  const suppressClickRef = useRef(false);

  // AI 工作开始时废弃未结束的旧手势，恢复后必须重新按下才能拖动。
  useEffect(() => {
    if (interactionLocked) {
      if (dragRef.current) onDragStateChange(node.id, false);
      dragRef.current = undefined;
      suppressClickRef.current = false;
      endMindMapEdit();
    }
  }, [endMindMapEdit, interactionLocked, node.id, onDragStateChange]);

  // 开始记录指针，真正移动超过阈值后才进入拖动态。
  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>): void {
    if (interactionLocked || node.category === "中心" || event.button !== 0) {
      return;
    }
    if (typeof event.currentTarget.setPointerCapture === "function") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    const viewport = viewportRef.current;
    const centerX = rect ? rect.left + rect.width / 2 + ((node.x / 100) * rect.width - rect.width / 2) * viewport.scale + viewport.panX : event.clientX;
    const centerY = rect ? rect.top + rect.height / 2 + ((node.y / 100) * rect.height - rect.height / 2) * viewport.scale + viewport.panY : event.clientY;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      grabOffset: { x: event.clientX - centerX, y: event.clientY - centerY },
    };
    onDragStateChange(node.id, true);
  }

  // 把拖动位置实时写回商店，让相连曲线同步重绘。
  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>): void {
    if (interactionLocked) {
      if (dragRef.current) onDragStateChange(node.id, false);
      dragRef.current = undefined;
      suppressClickRef.current = false;
      return;
    }
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !canvas) {
      return;
    }
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.moved && distance < DRAG_THRESHOLD_PX) {
      return;
    }
    if (!drag.moved) beginMindMapEdit();
    drag.moved = true;
    const position = pointToCanvasPercent(event, canvas.getBoundingClientRect(), safeArea, {
      grabOffset: drag.grabOffset,
      nodeBounds: NODE_VISUAL_BOUNDS,
      viewport: viewportRef.current,
    });
    moveMindNode(node.id, position.x, position.y);
  }

  // 拖动释放时保存一次，并阻止释放动作误触节点选择。
  function finishDrag(event: ReactPointerEvent<HTMLButtonElement>): void {
    if (interactionLocked) {
      if (dragRef.current) onDragStateChange(node.id, false);
      dragRef.current = undefined;
      suppressClickRef.current = false;
      return;
    }
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    if (typeof event.currentTarget.hasPointerCapture === "function" && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = undefined;
    onDragStateChange(node.id, false);
    endMindMapEdit();
    if (drag.moved) {
      suppressClickRef.current = true;
      persistWorkspace();
    }
  }

  // 指针被系统取消时只清理临时状态，不影响下一次正常点击。
  function cancelDrag(event: ReactPointerEvent<HTMLButtonElement>): void {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    if (typeof event.currentTarget.hasPointerCapture === "function" && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = undefined;
    onDragStateChange(node.id, false);
    suppressClickRef.current = false;
    if (drag.moved) persistWorkspace();
    endMindMapEdit();
  }

  if (node.category === "中心") {
    return (
      <div
        className={cn("mindmap-center absolute z-20 max-w-[20rem] -translate-x-1/2 -translate-y-1/2 text-center transition-opacity", dimmed && "opacity-20")}
        data-motion-locked={node.locked}
        data-motion-node-id={node.id}
        data-motion-parent-id={node.parentId ?? ""}
        data-motion-selected={node.selected}
        style={{ left: `${node.x}%`, top: `${node.y}%` }}
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-spark-600">{CATEGORY_LABEL[node.category]}</span>
        <h2 className="mt-2 break-words font-serif text-3xl leading-tight text-[#fff7df] drop-shadow-[0_0_24px_rgba(255,138,61,0.32)]">{node.label}</h2>
      </div>
    );
  }

  const lod = zoom < 0.55 ? "far" : zoom > 1.55 ? "near" : "mid";

  if (lod === "far") {
    return (
      <button
        aria-label={`${CATEGORY_LABEL[node.category]} ${node.label}`}
        aria-pressed={node.selected}
        className={cn("mindmap-node-star absolute z-20 -translate-x-1/2 -translate-y-1/2", node.selected && "is-selected", active && "is-active", dimmed && "is-dimmed")}
        data-lod="far"
        data-motion-node-id={node.id}
        disabled={interactionLocked}
        style={{ left: `${node.x}%`, top: `${node.y}%` }}
        title={node.label}
        type="button"
        onClick={() => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          toggleMindNode(node.id);
        }}
        onPointerCancel={cancelDrag}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
      />
    );
  }

  return (
    <div
      className={cn("group absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-opacity", dimmed && "opacity-20")}
      data-lod={lod}
      data-motion-locked={node.locked}
      data-motion-node-id={node.id}
      data-motion-parent-id={node.parentId ?? ""}
      data-motion-selected={node.selected}
      style={{ left: `${node.x}%`, top: `${node.y}%` }}
    >
      <button
        aria-label={`${CATEGORY_LABEL[node.category]} ${node.label}`}
        aria-pressed={node.selected}
        disabled={interactionLocked}
        className={cn(
          "mindmap-node relative max-w-40 touch-none select-none rounded-lg border border-transparent px-2.5 py-1.5 text-left text-xs transition hover:-translate-y-0.5 hover:border-white/12 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-500",
          CATEGORY_STYLE[node.category],
          node.category === "远联想" && "scale-90 opacity-80",
          node.selected && "is-selected border-spark-500 text-[#fff7df] ring-2 ring-spark-500/35",
          active && "outline outline-1 outline-offset-4 outline-[#fff7df]/70",
        )}
        type="button"
        onClick={() => {
          if (interactionLocked) {
            return;
          }
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          toggleMindNode(node.id);
        }}
        onPointerCancel={cancelDrag}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
      >
        <span className="block text-[9px] font-semibold uppercase tracking-[0.16em] opacity-60">{CATEGORY_LABEL[node.category]}</span>
        <span className="mt-0.5 block break-words font-medium">{node.label}</span>
        {lod === "near" && <span className="mt-1.5 block max-w-44 text-[10px] leading-4 text-white/42">{node.source ?? node.reason}</span>}
      </button>
      {childCount > 0 && lod === "near" && (
        <button aria-label={node.collapsed ? `展开 ${node.label} 的分支` : `折叠 ${node.label} 的分支`} className="mindmap-collapse-control" disabled={interactionLocked} type="button" onClick={(event) => { event.stopPropagation(); toggleMindNodeCollapsed(node.id); }} onPointerDown={(event) => event.stopPropagation()}>
          {node.collapsed ? <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
          <span>{childCount}</span>
        </button>
      )}
      <button
        aria-label={node.locked ? `解锁 ${node.label}` : `锁定 ${node.label}`}
        aria-pressed={node.locked}
        disabled={interactionLocked}
        className={cn(
          "absolute -right-4 -top-4 inline-flex min-h-8 min-w-8 items-center justify-center gap-1 rounded-full border bg-[#211a15]/95 px-2 text-[10px] font-semibold shadow-lg transition hover:border-spark-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-500",
          node.locked
            ? "border-spark-500 text-[#ffd7bf] opacity-100"
            : active
              ? "border-white/18 text-white/58 opacity-100"
              : "border-white/18 text-white/58 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
        )}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          if (interactionLocked) {
            return;
          }
          toggleMindNodeLock(node.id);
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {node.locked ? <Lock className="h-3.5 w-3.5" aria-hidden="true" /> : <Unlock className="h-3.5 w-3.5" aria-hidden="true" />}
        {node.locked && <span>已锁</span>}
      </button>
    </div>
  );
});
