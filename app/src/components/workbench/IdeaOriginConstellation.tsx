// 这个文件把脑洞的来源节点压缩成可交互星座，并在来源导图失效时保留可读摘要。
import { LocateFixed } from "lucide-react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { COLLISION_RECIPES, type BrainstormMap, type IdeaCard } from "../../types/idea";

interface IdeaOriginConstellationProps {
  idea: IdeaCard;
  map?: BrainstormMap;
  disabled?: boolean;
  onReturnToOrigin: (focusNodeId?: string) => void;
}

interface ConstellationNode {
  id: string;
  label: string;
  x: number;
  y: number;
  source: boolean;
}

interface ConstellationEdge {
  id: string;
  from: string;
  to: string;
}

interface OriginLineageItem {
  label: string;
  value: string;
}

const VIEWBOX_WIDTH = 320;
const VIEWBOX_HEIGHT = 150;

// 收集来源节点和它们回到中心的祖先，保留这次脑洞真正走过的联想路径。
function collectOriginGraph(idea: IdeaCard, map?: BrainstormMap): { nodes: ConstellationNode[]; edges: ConstellationEdge[] } {
  const origin = idea.origin;
  if (!origin || !map || map.id !== origin.mapId) return { nodes: [], edges: [] };

  const nodeById = new Map(map.nodes.map((node) => [node.id, node]));
  // 只有所有来源节点都仍存在且可选时，才能保证返回操作指向真实来源。
  if (origin.sourceNodeIds.length === 0 || !origin.sourceNodeIds.every((sourceNodeId) => nodeById.get(sourceNodeId)?.selectable)) {
    return { nodes: [], edges: [] };
  }
  const visibleIds = new Set<string>();
  for (const sourceNodeId of origin.sourceNodeIds) {
    let current = nodeById.get(sourceNodeId);
    const visited = new Set<string>();
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      visibleIds.add(current.id);
      current = current.parentId ? nodeById.get(current.parentId) : undefined;
    }
  }
  const graphNodes = map.nodes.filter((node) => visibleIds.has(node.id));
  if (graphNodes.length === 0) return { nodes: [], edges: [] };

  const xs = graphNodes.map((node) => node.x);
  const ys = graphNodes.map((node) => node.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const sourceIds = new Set(origin.sourceNodeIds);
  const nodes = graphNodes.map((node) => ({
    id: node.id,
    label: node.label,
    x: 28 + ((node.x - minX) / spanX) * (VIEWBOX_WIDTH - 56),
    y: 26 + ((node.y - minY) / spanY) * (VIEWBOX_HEIGHT - 58),
    source: sourceIds.has(node.id),
  }));
  const edges = map.edges.filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to));
  return { nodes, edges };
}

// 限制星图标签长度，避免长词遮挡相邻节点。
function compactLabel(label: string): string {
  return label.length > 9 ? `${label.slice(0, 8)}…` : label;
}

// 优先展示生成时保留的来源路径；没有路径时再使用来源词，避免凭空创建节点名称。
function getOriginSourceText(idea: IdeaCard): string {
  const sourcePath = idea.sourcePath?.filter((part) => part.trim().length > 0) ?? [];
  if (sourcePath.length > 0) return sourcePath.join(" → ");
  const sourceWords = idea.sourceWords.map((word) => word.text.trim()).filter((word) => word.length > 0);
  return sourceWords.length > 0 ? sourceWords.join(" · ") : "来源文字暂不可用";
}

// 把来源快照里的碰撞方式和当前脑洞的变形动作整理成紧凑谱系。
function getOriginLineage(idea: IdeaCard): OriginLineageItem[] {
  const items: OriginLineageItem[] = [];
  const recipe = COLLISION_RECIPES.find((candidate) => candidate.id === idea.origin?.collisionRecipe);
  if (recipe) items.push({ label: "碰撞配方", value: recipe.label });
  if (idea.parentId && idea.transformDirection) items.push({ label: "后续变形", value: idea.transformDirection });
  return items;
}

// 使用定义列表展示谱系元信息，不为短文本增加额外卡片层级。
function OriginLineage({ idea }: { idea: IdeaCard }): JSX.Element | null {
  const items = getOriginLineage(idea);
  if (items.length === 0) return null;
  return (
    <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/[0.08] pt-3" data-testid="origin-lineage">
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 items-baseline gap-2">
          <dt className="font-mono text-[10px] text-[#fff7df]/42">{item.label}</dt>
          <dd className="text-xs text-[#fff7df]/80">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// 当前工作区找不到原导图时，只提供事实摘要，不渲染误导性的返回按钮或虚构连线。
function renderUnavailableOrigin(idea: IdeaCard): JSX.Element {
  return (
    <section className="my-7 border-y border-white/10 py-5" aria-label="来源星座" data-origin-state="unavailable">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-spark-500" aria-hidden="true">◌</span>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-spark-500">Origin constellation</p>
          <p className="mt-1 text-sm text-[#fff7df]">原导图已不可用</p>
          <p className="mt-1 text-xs leading-5 text-[#fff7df]/60">当前工作区不是这条脑洞生成时的导图，来源节点无法精确返回。</p>
        </div>
      </div>
      <p className="mt-4 border-l border-white/15 pl-3 text-sm leading-6 text-[#fff7df]/80" data-testid="origin-source-summary">
        {getOriginSourceText(idea)}
      </p>
      <OriginLineage idea={idea} />
    </section>
  );
}

// 渲染来源路径；来源节点支持点击和键盘精确返回。
export function IdeaOriginConstellation({ idea, map, disabled = false, onReturnToOrigin }: IdeaOriginConstellationProps): JSX.Element | null {
  if (!idea.origin) return null;
  const graph = collectOriginGraph(idea, map);
  const originUnavailable = !map || map.id !== idea.origin.mapId || graph.nodes.length === 0;
  if (originUnavailable) return renderUnavailableOrigin(idea);

  const pointById = new Map(graph.nodes.map((node) => [node.id, node]));

  const handleNodeKeyDown = (event: ReactKeyboardEvent<SVGGElement>, nodeId: string): void => {
    if (disabled || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onReturnToOrigin(nodeId);
  };

  return (
    <section className="my-7 border-y border-white/10 py-5" aria-label="来源星座">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-spark-500">Origin constellation</p>
          <p className="mt-1 text-sm text-[#fff7df]/70">这组节点碰撞出了当前脑洞</p>
        </div>
        <button
          type="button"
          className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md border border-white/[0.15] px-3 text-sm text-[#fff7df] transition hover:border-spark-500/70 hover:text-spark-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-500 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={disabled}
          onClick={() => onReturnToOrigin()}
        >
          <LocateFixed className="h-4 w-4" aria-hidden="true" />
          返回来源位置
        </button>
      </div>

      <OriginLineage idea={idea} />

      <svg className="h-40 w-full overflow-visible" viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} aria-hidden="false">
        <title>脑洞来源节点星座</title>
        <g aria-hidden="true">
          {graph.edges.map((edge) => {
            const from = pointById.get(edge.from);
            const to = pointById.get(edge.to);
            if (!from || !to) return null;
            const controlX = (from.x + to.x) / 2;
            const controlY = (from.y + to.y) / 2 - Math.min(12, Math.abs(to.x - from.x) * 0.08);
            return <path key={edge.id} d={`M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`} fill="none" stroke="rgba(255,247,223,0.23)" strokeWidth="1" />;
          })}
        </g>
        {graph.nodes.map((node) => {
          if (!node.source) {
            return (
              <g key={node.id} aria-hidden="true" transform={`translate(${node.x} ${node.y})`}>
                <circle r="3" fill="rgba(255,247,223,0.42)" />
                <text y="15" textAnchor="middle" fill="rgba(255,247,223,0.48)" fontSize="8">{compactLabel(node.label)}</text>
              </g>
            );
          }
          return (
            <g
              key={node.id}
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-disabled={disabled}
              aria-label={`返回来源节点 ${node.label}`}
              className="group cursor-pointer outline-none"
              transform={`translate(${node.x} ${node.y})`}
              onClick={() => { if (!disabled) onReturnToOrigin(node.id); }}
              onKeyDown={(event) => handleNodeKeyDown(event, node.id)}
            >
              <circle className="fill-spark-500/[0.15] stroke-spark-500 transition group-hover:fill-spark-500/30 group-focus:stroke-[#fff7df]" r="9" strokeWidth="1" />
              <circle className="fill-spark-500" r="3.5" />
              <text y="19" textAnchor="middle" fill="#fff7df" fontSize="8.5">{compactLabel(node.label)}</text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}
