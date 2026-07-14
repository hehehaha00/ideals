// 这个文件计算并绘制节点分组的轻量范围，让分组保留画布感而不变成卡片。
import type { MindNode, MindNodeGroup } from "../../types/idea";

export interface MindMapGroupHull {
  id: string;
  name: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface MindMapGroupsProps {
  groups?: MindNodeGroup[];
  nodes: MindNode[];
  padding?: number;
}

// 根据每组成员的坐标包围盒生成稳定轮廓；成员不足时不绘制。
export function computeMindMapGroupHulls(groups: MindNodeGroup[], nodes: MindNode[], padding = 5): MindMapGroupHull[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  return groups.flatMap((group) => {
    const members = group.nodeIds.map((nodeId) => nodeById.get(nodeId)).filter((node): node is MindNode => Boolean(node));
    if (members.length < 2) return [];
    const xs = members.map((node) => node.x);
    const ys = members.map((node) => node.y);
    const left = Math.min(...xs) - padding;
    const top = Math.min(...ys) - padding;
    return [{
      id: group.id,
      name: group.name,
      left,
      top,
      width: Math.max(...xs) - Math.min(...xs) + padding * 2,
      height: Math.max(...ys) - Math.min(...ys) + padding * 2,
    }];
  });
}

// 在节点和连线下方绘制虚线星域，不接管任何指针事件。
export function MindMapGroups({ groups = [], nodes, padding = 5 }: MindMapGroupsProps): JSX.Element | null {
  const hulls = computeMindMapGroupHulls(groups, nodes, padding);
  if (hulls.length === 0) return null;

  return (
    <svg aria-label="节点分组范围" className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible" preserveAspectRatio="none" role="img" viewBox="0 0 100 100">
      {hulls.map((hull, index) => {
        const stroke = index % 2 === 0 ? "rgba(255, 138, 61, .42)" : "rgba(119, 203, 188, .38)";
        return (
          <g key={hull.id} data-group-id={hull.id}>
            <title>{hull.name}</title>
            <rect
              fill="rgba(255, 247, 223, .025)"
              height={hull.height}
              rx="2"
              stroke={stroke}
              strokeDasharray="1.4 1.6"
              strokeWidth=".22"
              vectorEffect="non-scaling-stroke"
              width={hull.width}
              x={hull.left}
              y={hull.top}
            />
            <text fill={stroke} fontFamily="ui-monospace, monospace" fontSize="1.4" x={hull.left + 1.2} y={hull.top + 2.3}>{hull.name}</text>
          </g>
        );
      })}
    </svg>
  );
}
