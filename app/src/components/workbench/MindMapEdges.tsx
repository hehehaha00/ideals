// 这个文件绘制导图的分类曲线，并突出当前选中节点通往中心的路径。
import { memo } from "react";
import type { MindEdge, MindNode, MindNodeCategory } from "../../types/idea";
import { buildMindMapCurve, getMindMapEdgeVariant } from "./mindMapGeometry";

const EDGE_COLORS: Record<MindNodeCategory, string> = {
  中心: "#fff7df",
  人群: "#a9d8ee",
  场景: "#f4d58d",
  情绪: "#e8a0ad",
  物件: "#9fd8b5",
  结构: "#c0afe8",
  限制: "#b9b2a8",
  远联想: "#ff9a5c",
};

interface MindMapEdgesProps {
  nodes: MindNode[];
  edges: MindEdge[];
  activeNodeId?: string;
  focusNodeIds?: Set<string>;
}

// 裁剪集合未变化时复用边线层，避免画布平移让整张 SVG 重算路径。
function haveSameItemReferences<T>(previous: ReadonlyArray<T>, next: ReadonlyArray<T>): boolean {
  return previous === next || (previous.length === next.length && previous.every((item, index) => item === next[index]));
}

function areMindMapEdgesPropsEqual(previous: MindMapEdgesProps, next: MindMapEdgesProps): boolean {
  return previous.activeNodeId === next.activeNodeId
    && previous.focusNodeIds === next.focusNodeIds
    && haveSameItemReferences(previous.nodes, next.nodes)
    && haveSameItemReferences(previous.edges, next.edges);
}

// 收集选中节点到中心之间的父子边。
function selectedPathKeys(nodes: MindNode[], activeNodeId?: string): Set<string> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const pathKeys = new Set<string>();
  const starts = nodes.filter((node) => node.selected || node.id === activeNodeId);

  for (const start of starts) {
    let current: MindNode | undefined = start;
    const visited = new Set<string>();
    while (current?.parentId && !visited.has(current.id)) {
      visited.add(current.id);
      pathKeys.add(`${current.parentId}:${current.id}`);
      current = byId.get(current.parentId);
    }
  }
  return pathKeys;
}

// 渲染会随节点坐标变化而重新计算的 SVG 连线。
export const MindMapEdges = memo(function MindMapEdges({ nodes, edges, activeNodeId, focusNodeIds }: MindMapEdgesProps): JSX.Element {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const highlightedPaths = selectedPathKeys(nodes, activeNodeId);
  const drawableEdges = edges.flatMap((edge) => {
    const source = nodeById.get(edge.from);
    const target = nodeById.get(edge.to);
    if (!source || !target) {
      return [];
    }
    const highlighted = highlightedPaths.has(`${source.id}:${target.id}`);
    return [{ edge, source, target, highlighted, dimmed: Boolean(focusNodeIds && (!focusNodeIds.has(source.id) || !focusNodeIds.has(target.id))) }];
  });
  const layeredEdges = [...drawableEdges.filter((item) => !item.highlighted), ...drawableEdges.filter((item) => item.highlighted)];

  return (
    <svg className="mindmap-edges absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <filter id="mind-path-glow" x="-35%" y="-35%" width="170%" height="170%">
          <feGaussianBlur stdDeviation="0.7" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {layeredEdges.map(({ edge, source, target, highlighted, dimmed }) => {
        const variant = getMindMapEdgeVariant(source, target);
        return (
          <path
            key={edge.id}
            className={highlighted ? "mindmap-edge is-selected" : dimmed ? "mindmap-edge is-dimmed" : "mindmap-edge"}
            d={buildMindMapCurve(source, target)}
            data-edge-variant={variant}
            data-motion-edge-id={edge.id}
            data-motion-source-id={source.id}
            data-motion-target-id={target.id}
            data-selected-path={highlighted ? "true" : "false"}
            fill="none"
            filter={highlighted ? "url(#mind-path-glow)" : undefined}
            stroke={highlighted ? "#ff8a3d" : EDGE_COLORS[target.category]}
            pathLength={1}
            strokeDasharray={variant === "remote" ? "3 4" : "1"}
            strokeLinecap="round"
            strokeWidth={highlighted ? 0.9 : variant === "primary" ? 0.5 : 0.3}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}, areMindMapEdgesPropsEqual);
