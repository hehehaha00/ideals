// 这个文件提供导图拖动坐标、安全区限制和 SVG 曲线计算，供节点与连线组件共用。
import type { MindNode } from "../../types/idea";

export interface CanvasPoint {
  clientX: number;
  clientY: number;
}

export interface CanvasSafeArea {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface MindMapNodeBounds {
  halfWidth: number;
  halfHeight: number;
  lockOutsetTop: number;
  lockOutsetRight: number;
}

export interface CanvasDragOptions {
  grabOffset: { x: number; y: number };
  nodeBounds: MindMapNodeBounds;
  viewport?: MindMapViewport;
}

export interface MindMapViewport {
  panX: number;
  panY: number;
  scale: number;
}

export interface MindMapViewportNodeCullingOptions {
  nodes: ReadonlyArray<Pick<MindNode, "id" | "x" | "y" | "parentId">>;
  viewport: MindMapViewport;
  canvasSize: { width: number; height: number };
  protectedNodeIds?: ReadonlyArray<string> | ReadonlySet<string>;
  threshold?: number;
  bufferPx?: number;
}

export const DEFAULT_MIND_MAP_CULLING_THRESHOLD = 180;
export const DEFAULT_MIND_MAP_CULLING_BUFFER_PX = 280;

export interface WorldPoint {
  x: number;
  y: number;
}

export interface WorldSelectionRect {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface MindMapWorldBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface MinimapViewportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type MindMapEdgeVariant = "primary" | "remote" | "standard";

// 计算大图中当前视口附近可渲染的节点，并补齐保留节点的祖先链。
export function getMindMapViewportNodeIds({
  nodes,
  viewport,
  canvasSize,
  protectedNodeIds,
  threshold = DEFAULT_MIND_MAP_CULLING_THRESHOLD,
  bufferPx = DEFAULT_MIND_MAP_CULLING_BUFFER_PX,
}: MindMapViewportNodeCullingOptions): Set<string> {
  const allNodeIds = new Set(nodes.map((node) => node.id));
  const normalizedThreshold = Number.isFinite(threshold) && threshold >= 0 ? threshold : DEFAULT_MIND_MAP_CULLING_THRESHOLD;

  if (nodes.length <= normalizedThreshold) return allNodeIds;

  const { width, height } = canvasSize;
  const { panX, panY, scale } = viewport;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || !Number.isFinite(panX) || !Number.isFinite(panY) || !Number.isFinite(scale) || scale <= 0) {
    return allNodeIds;
  }

  const normalizedBuffer = Number.isFinite(bufferPx) && bufferPx >= 0 ? bufferPx : DEFAULT_MIND_MAP_CULLING_BUFFER_PX;
  const minScreenX = -normalizedBuffer;
  const maxScreenX = width + normalizedBuffer;
  const minScreenY = -normalizedBuffer;
  const maxScreenY = height + normalizedBuffer;
  const retainedIds = new Set<string>();

  for (const node of nodes) {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
      retainedIds.add(node.id);
      continue;
    }
    const screenX = width / 2 + ((node.x / 100) * width - width / 2) * scale + panX;
    const screenY = height / 2 + ((node.y / 100) * height - height / 2) * scale + panY;
    if (screenX >= minScreenX && screenX <= maxScreenX && screenY >= minScreenY && screenY <= maxScreenY) {
      retainedIds.add(node.id);
    }
  }

  for (const protectedId of protectedNodeIds ?? []) {
    if (allNodeIds.has(protectedId)) retainedIds.add(protectedId);
  }

  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  for (const retainedId of [...retainedIds]) {
    const visited = new Set<string>();
    let current = nodesById.get(retainedId);
    while (current?.parentId && !visited.has(current.id)) {
      visited.add(current.id);
      const parent = nodesById.get(current.parentId);
      if (!parent) break;
      retainedIds.add(parent.id);
      current = parent;
    }
  }

  return retainedIds;
}

// 把数值限制在指定范围内。
function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

// 保留两位小数，避免拖动时写入过长的小数。
function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

// 把世界百分比坐标投影到浏览器视口，用于微缩图、搜索定位和框选反馈。
export function worldPercentToScreen(point: WorldPoint, rect: DOMRect, viewport: MindMapViewport): WorldPoint {
  return {
    x: rect.left + rect.width / 2 + ((point.x / 100) * rect.width - rect.width / 2) * viewport.scale + viewport.panX,
    y: rect.top + rect.height / 2 + ((point.y / 100) * rect.height - rect.height / 2) * viewport.scale + viewport.panY,
  };
}

// 把视口指针反算为无限画布百分比世界坐标，不做边界裁切。
export function screenToWorldPercent(point: CanvasPoint, rect: DOMRect, viewport: MindMapViewport): WorldPoint {
  return {
    x: roundPercent((((point.clientX - rect.left - rect.width / 2 - viewport.panX) / viewport.scale + rect.width / 2) / rect.width) * 100),
    y: roundPercent((((point.clientY - rect.top - rect.height / 2 - viewport.panY) / viewport.scale + rect.height / 2) / rect.height) * 100),
  };
}

// 计算真实可见世界范围与星图边界的交集，避免低缩放平移后视口框越界。
export function getMindMapMinimapViewportRect(
  bounds: MindMapWorldBounds,
  canvasSize: { width: number; height: number },
  viewport: MindMapViewport,
): MinimapViewportRect {
  const width = Math.max(1, canvasSize.width);
  const height = Math.max(1, canvasSize.height);
  const scale = Math.max(0.01, viewport.scale);
  const worldLeft = (((-width / 2 - viewport.panX) / scale + width / 2) / width) * 100;
  const worldRight = (((width / 2 - viewport.panX) / scale + width / 2) / width) * 100;
  const worldTop = (((-height / 2 - viewport.panY) / scale + height / 2) / height) * 100;
  const worldBottom = (((height / 2 - viewport.panY) / scale + height / 2) / height) * 100;
  const clippedLeft = clamp(worldLeft, bounds.minX, bounds.maxX);
  const clippedRight = clamp(worldRight, bounds.minX, bounds.maxX);
  const clippedTop = clamp(worldTop, bounds.minY, bounds.maxY);
  const clippedBottom = clamp(worldBottom, bounds.minY, bounds.maxY);
  const boundsWidth = Math.max(1, bounds.maxX - bounds.minX);
  const boundsHeight = Math.max(1, bounds.maxY - bounds.minY);

  return {
    x: ((Math.min(clippedLeft, clippedRight) - bounds.minX) / boundsWidth) * 100,
    y: ((Math.min(clippedTop, clippedBottom) - bounds.minY) / boundsHeight) * 100,
    width: (Math.abs(clippedRight - clippedLeft) / boundsWidth) * 100,
    height: (Math.abs(clippedBottom - clippedTop) / boundsHeight) * 100,
  };
}

// 返回框选区域内可选节点，矩形起点与终点顺序不影响结果。
export function nodesInSelectionRect(nodes: ReadonlyArray<Pick<MindNode, "id" | "x" | "y" | "selectable">>, selection: WorldSelectionRect): string[] {
  const minX = Math.min(selection.startX, selection.endX);
  const maxX = Math.max(selection.startX, selection.endX);
  const minY = Math.min(selection.startY, selection.endY);
  const maxY = Math.max(selection.startY, selection.endY);
  return nodes.filter((node) => node.selectable && node.x >= minX && node.x <= maxX && node.y >= minY && node.y <= maxY).map((node) => node.id);
}

// 折叠节点只隐藏后代，节点本身仍留在画布作为分支入口。
export function getVisibleMindMapNodeIds(nodes: ReadonlyArray<Pick<MindNode, "id" | "parentId" | "collapsed">>): Set<string> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const visibility = new Map<string, boolean>();

  for (const node of nodes) {
    if (visibility.has(node.id)) continue;
    const path: string[] = [];
    const visited = new Set<string>();
    let currentId = node.id;
    let isVisible = true;

    while (!visibility.has(currentId) && !visited.has(currentId)) {
      visited.add(currentId);
      path.push(currentId);
      const current = byId.get(currentId);
      const parent = current?.parentId ? byId.get(current.parentId) : undefined;
      if (!parent) break;
      if (parent.collapsed) {
        isVisible = false;
        break;
      }
      currentId = parent.id;
    }

    if (visibility.has(currentId)) isVisible = visibility.get(currentId) ?? true;
    for (const pathId of path) visibility.set(pathId, isVisible);
  }

  return new Set(nodes.filter((node) => visibility.get(node.id) !== false).map((node) => node.id));
}

// 收集聚焦节点的祖先和全部后代，形成局部星系高亮集合。
export function getMindMapRelatedNodeIds(nodes: ReadonlyArray<Pick<MindNode, "id" | "parentId">>, focusId?: string): Set<string> {
  if (!focusId) return new Set(nodes.map((node) => node.id));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const childrenByParent = new Map<string, string[]>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    const children = childrenByParent.get(node.parentId) ?? [];
    children.push(node.id);
    childrenByParent.set(node.parentId, children);
  }
  const related = new Set<string>([focusId]);
  let current = byId.get(focusId);
  while (current?.parentId && !related.has(current.parentId)) {
    related.add(current.parentId);
    current = byId.get(current.parentId);
  }
  const pending = [...(childrenByParent.get(focusId) ?? [])];
  while (pending.length > 0) {
    const nodeId = pending.pop();
    if (!nodeId || related.has(nodeId)) continue;
    related.add(nodeId);
    pending.push(...(childrenByParent.get(nodeId) ?? []));
  }
  return related;
}

// 把指针视口坐标换算成画布百分比，并避开顶部和底部操作区。
export function pointToCanvasPercent(point: CanvasPoint, rect: DOMRect, safeArea: CanvasSafeArea, options?: CanvasDragOptions): { x: number; y: number } {
  const bounds = options?.nodeBounds ?? { halfWidth: 0, halfHeight: 0, lockOutsetTop: 0, lockOutsetRight: 0 };
  const grabOffset = options?.grabOffset ?? { x: 0, y: 0 };
  const minimumX = rect.left + safeArea.left + bounds.halfWidth;
  const maximumX = rect.right - safeArea.right - bounds.halfWidth - bounds.lockOutsetRight;
  const minimumY = rect.top + safeArea.top + bounds.halfHeight + bounds.lockOutsetTop;
  const maximumY = rect.bottom - safeArea.bottom - bounds.halfHeight;
  const viewport = options?.viewport ?? { panX: 0, panY: 0, scale: 1 };
  const worldClientX = rect.left + rect.width / 2 + (point.clientX - grabOffset.x - rect.left - rect.width / 2 - viewport.panX) / viewport.scale;
  const worldClientY = rect.top + rect.height / 2 + (point.clientY - grabOffset.y - rect.top - rect.height / 2 - viewport.panY) / viewport.scale;
  const x = viewport.scale === 1 && viewport.panX === 0 && viewport.panY === 0
    ? clamp(point.clientX - grabOffset.x, minimumX, maximumX)
    : worldClientX;
  const y = viewport.scale === 1 && viewport.panX === 0 && viewport.panY === 0
    ? clamp(point.clientY - grabOffset.y, minimumY, maximumY)
    : worldClientY;

  return {
    x: roundPercent(((x - rect.left) / rect.width) * 100),
    y: roundPercent(((y - rect.top) / rect.height) * 100),
  };
}

// 根据分支方向生成柔和的三次贝塞尔曲线。
export function buildMindMapCurve(source: MindNode, target: MindNode): string {
  const horizontalDistance = target.x - source.x;
  const direction = horizontalDistance === 0 ? 1 : Math.sign(horizontalDistance);
  const bend = Math.max(7, Math.abs(horizontalDistance) * 0.46);
  const firstControlX = source.x + bend * direction;
  const secondControlX = target.x - bend * direction;

  return `M ${source.x} ${source.y} C ${roundPercent(firstControlX)} ${source.y}, ${roundPercent(secondControlX)} ${target.y}, ${target.x} ${target.y}`;
}

// 区分主干、远联想和普通分支，交给连线组件决定视觉权重。
export function getMindMapEdgeVariant(source: MindNode, target: MindNode): MindMapEdgeVariant {
  if (target.category === "远联想") {
    return "remote";
  }
  if (source.level === 0 && target.level === 1) {
    return "primary";
  }
  return "standard";
}
