// 这个文件绘制无限画布的全局缩略图，帮助用户在大规模发散中保持空间方向感。
import type { BrainstormMap } from "../../types/idea";
import { useMemo, type KeyboardEvent, type MouseEvent } from "react";
import { getMindMapMinimapViewportRect, getVisibleMindMapNodeIds, type MindMapViewport, type MindMapWorldBounds } from "./mindMapGeometry";

interface MindMapMinimapProps {
  map: BrainstormMap;
  viewport: MindMapViewport;
  canvasSize: { width: number; height: number };
  activeNodeId?: string;
  onNavigate: (worldCenter: { x: number; y: number }) => void;
  disabled?: boolean;
}

type Bounds = MindMapWorldBounds;

function getBounds(map: BrainstormMap): Bounds {
  const xs = map.nodes.map((node) => node.x);
  const ys = map.nodes.map((node) => node.y);
  return {
    minX: Math.min(-20, ...xs) - 8,
    maxX: Math.max(120, ...xs) + 8,
    minY: Math.min(-20, ...ys) - 8,
    maxY: Math.max(120, ...ys) + 8,
  };
}

function mapPoint(value: number, minimum: number, maximum: number): number {
  return ((value - minimum) / Math.max(1, maximum - minimum)) * 100;
}

// 将缩略图点击位置转换为世界中心，交给画布调整平移量。
function navigateFromClick(event: MouseEvent<SVGSVGElement>, bounds: Bounds, onNavigate: MindMapMinimapProps["onNavigate"]): void {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = bounds.minX + ((event.clientX - rect.left) / rect.width) * (bounds.maxX - bounds.minX);
  const y = bounds.minY + ((event.clientY - rect.top) / rect.height) * (bounds.maxY - bounds.minY);
  onNavigate({ x, y });
}

export function MindMapMinimap({ map, viewport, canvasSize, activeNodeId, onNavigate, disabled = false }: MindMapMinimapProps): JSX.Element {
  const bounds = useMemo(() => getBounds(map), [map]);
  const nodeById = useMemo(() => new Map(map.nodes.map((node) => [node.id, node])), [map.nodes]);
  const visibleNodeIds = useMemo(() => getVisibleMindMapNodeIds(map.nodes), [map.nodes]);
  const hiddenCount = map.nodes.length - visibleNodeIds.size;
  const worldCenterX = 50 - (viewport.panX / Math.max(1, canvasSize.width)) * 100 / viewport.scale;
  const worldCenterY = 50 - (viewport.panY / Math.max(1, canvasSize.height)) * 100 / viewport.scale;
  const viewportRect = getMindMapMinimapViewportRect(bounds, canvasSize, viewport);
  const handleKeyDown = (event: KeyboardEvent<SVGSVGElement>): void => {
    if (disabled || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    onNavigate({ x: worldCenterX + (event.key === "ArrowLeft" ? -10 : event.key === "ArrowRight" ? 10 : 0), y: worldCenterY + (event.key === "ArrowUp" ? -10 : event.key === "ArrowDown" ? 10 : 0) });
  };

  return (
    <div className="mindmap-minimap" data-testid="mindmap-minimap" aria-label="思维星图缩略图">
      <div className="mindmap-minimap-label"><span>全局星图</span><span>{map.nodes.length} 节点{hiddenCount > 0 ? ` · 隐藏 ${hiddenCount}` : ""}</span></div>
      <svg
        aria-label="移动星图视口"
        className={disabled ? "pointer-events-none opacity-40" : "cursor-crosshair"}
        onClick={(event) => { if (!disabled) navigateFromClick(event, bounds, onNavigate); }}
        onKeyDown={handleKeyDown}
        preserveAspectRatio="none"
        role="button"
        tabIndex={disabled ? -1 : 0}
        viewBox="0 0 100 100"
      >
        <rect x="0" y="0" width="100" height="100" rx="6" fill="rgba(8, 8, 8, .56)" stroke="rgba(255, 247, 223, .18)" />
        {map.edges.map((edge) => {
          const source = nodeById.get(edge.from);
          const target = nodeById.get(edge.to);
          if (!source || !target) return null;
          return <line key={edge.id} x1={mapPoint(source.x, bounds.minX, bounds.maxX)} x2={mapPoint(target.x, bounds.minX, bounds.maxX)} y1={mapPoint(source.y, bounds.minY, bounds.maxY)} y2={mapPoint(target.y, bounds.minY, bounds.maxY)} stroke="rgba(255, 247, 223, .23)" strokeWidth=".55" />;
        })}
        {map.nodes.map((node) => (
          <circle key={node.id} cx={mapPoint(node.x, bounds.minX, bounds.maxX)} cy={mapPoint(node.y, bounds.minY, bounds.maxY)} r={node.id === activeNodeId ? 1.8 : node.category === "中心" ? 2.3 : 1.15} fill={node.id === activeNodeId ? "#ff8a3d" : node.category === "中心" ? "#fff7df" : visibleNodeIds.has(node.id) ? "rgba(255, 247, 223, .68)" : "rgba(255, 247, 223, .18)"} stroke={node.collapsed ? "#ff8a3d" : "none"} strokeWidth={node.collapsed ? 1 : 0} />
        ))}
        <rect
          data-testid="mindmap-viewport-rect"
          x={viewportRect.x}
          y={viewportRect.y}
          width={viewportRect.width}
          height={viewportRect.height}
          fill="rgba(255, 138, 61, .12)"
          stroke="#ff8a3d"
          strokeWidth=".8"
        />
      </svg>
    </div>
  );
}
