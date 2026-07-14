// 这个文件负责把模型生成的导图节点稳定地散布到桌面画布安全区内。
import type { MindNode } from "../src/types/idea";

export interface MindMapLayoutPosition {
  id: string;
  x: number;
  y: number;
}

type LayoutNode = Pick<MindNode, "id" | "label" | "category" | "level">;

interface LayoutCandidate {
  x: number;
  y: number;
}

interface PlacedNode extends MindMapLayoutPosition {
  width: number;
}

const CATEGORY_ANGLES: Record<Exclude<MindNode["category"], "中心">, number> = {
  人群: -145,
  场景: -92,
  情绪: -38,
  物件: 60,
  结构: 15,
  限制: 128,
  远联想: 178,
};

const LEVEL_RADIUS: Record<MindNode["level"], number> = {
  0: 0,
  1: 0.5,
  2: 0.7,
  3: 1.12,
};

const LEVEL_MINIMUM_RADIUS: Record<MindNode["level"], number> = {
  0: 0,
  1: 0.3,
  2: 0.5,
  3: 0.75,
};

const LEVEL_MAXIMUM_RADIUS: Record<MindNode["level"], number> = {
  0: 0.3,
  1: 0.78,
  2: 1.05,
  3: 1.4,
};

// 根据中文字符数量估算桌面节点的百分比宽度。
function estimateNodeWidth(label: string): number {
  return Math.min(15, Math.max(9, 7.5 + Array.from(label).length * 0.55));
}

// 生成稳定哈希，为同分类节点提供轻微但可复现的角度差异。
function stableHash(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// 构造覆盖安全区的细粒度候选点。
function createCandidates(): LayoutCandidate[] {
  const candidates: LayoutCandidate[] = [];
  for (let y = 20; y <= 80; y += 1) {
    for (let x = 12; x <= 87; x += 1) {
      candidates.push({ x, y });
    }
  }
  return candidates;
}

// 计算节点相对中心主题的椭圆归一化半径。
function normalizedRadius(candidate: LayoutCandidate): number {
  return Math.hypot((candidate.x - 50) / 38, (candidate.y - 50) / 30);
}

// 判断候选节点是否与中心主题或已放置节点发生矩形重叠。
function canPlace(candidate: LayoutCandidate, width: number, placedNodes: PlacedNode[], verticalGap: number): boolean {
  const overlapsCenter = Math.abs(candidate.x - 50) < width / 2 + 11 && Math.abs(candidate.y - 50) < 9;
  if (overlapsCenter) {
    return false;
  }

  return placedNodes.every((placed) => {
    const requiredHorizontalGap = (width + placed.width) / 2 + 0.8;
    return Math.abs(candidate.x - placed.x) >= requiredHorizontalGap || Math.abs(candidate.y - placed.y) >= verticalGap;
  });
}

// 判断候选节点是否避开指定的已有节点。
function avoidsPlacedNodes(candidate: LayoutCandidate, width: number, placedNodes: PlacedNode[], verticalGap: number): boolean {
  return placedNodes.every((placed) => {
    const requiredHorizontalGap = (width + placed.width) / 2 + 0.8;
    return Math.abs(candidate.x - placed.x) >= requiredHorizontalGap || Math.abs(candidate.y - placed.y) >= verticalGap;
  });
}

// 生成与输入顺序无关的稳定布局键。
function layoutKey(node: LayoutNode): string {
  return `${node.level}:${node.category}:${node.label}:${node.id}`;
}

// 计算节点按分类扇区和层级深度得到的目标位置。
function targetForNode(node: Pick<MindNode, "label" | "category" | "level">): LayoutCandidate {
  const category = node.category === "中心" ? "远联想" : node.category;
  const jitter = (stableHash(`${node.category}:${node.label}:${node.level}`) % 25) - 12;
  const angle = (CATEGORY_ANGLES[category] + jitter) * (Math.PI / 180);
  const radius = node.level === 2 && (category === "场景" || category === "物件") ? 1 : LEVEL_RADIUS[node.level];
  return {
    x: 50 + Math.cos(angle) * 38 * radius,
    y: 50 + Math.sin(angle) * 30 * radius,
  };
}

// 为一组导图节点计算确定性坐标。
export function layoutMindMapNodes(nodes: ReadonlyArray<LayoutNode>): MindMapLayoutPosition[] {
  const candidates = createCandidates();
  const placedNodes: PlacedNode[] = [];
  const positionById = new Map<string, MindMapLayoutPosition>();
  const verticalGap = nodes.length >= 28 ? 6.2 : 7.2;
  const sortedNodes = [...nodes].sort((left, right) => left.level - right.level || layoutKey(left).localeCompare(layoutKey(right), "zh-CN"));
  const highestPresentLevel = sortedNodes.reduce<MindNode["level"]>((highest, node) => Math.max(highest, node.level) as MindNode["level"], 0);
  const averageRadiusByLevel = new Map<MindNode["level"], number>();
  let activeLevel: MindNode["level"] | undefined;
  let activeLevelRadii: number[] = [];

  for (const node of sortedNodes) {
    if (activeLevel !== undefined && node.level !== activeLevel) {
      averageRadiusByLevel.set(activeLevel, activeLevelRadii.reduce((sum, radius) => sum + radius, 0) / activeLevelRadii.length);
      activeLevelRadii = [];
    }
    activeLevel = node.level;
    const width = estimateNodeWidth(node.label);
    const target = targetForNode(node);
    const lowerLevel = Math.max(0, node.level - 1) as MindNode["level"];
    const lowerLevelAverage = averageRadiusByLevel.get(lowerLevel);
    const minimumRadius = Math.max(LEVEL_MINIMUM_RADIUS[node.level], lowerLevelAverage === undefined ? 0 : lowerLevelAverage + 0.04);
    const candidate = candidates
      .filter((item) => {
        const radius = normalizedRadius(item);
        const maximumRadius = node.level === highestPresentLevel ? LEVEL_MAXIMUM_RADIUS[3] : LEVEL_MAXIMUM_RADIUS[node.level];
        return radius >= minimumRadius && radius <= maximumRadius;
      })
      .filter((item) => canPlace(item, width, placedNodes, verticalGap))
      .reduce<LayoutCandidate | undefined>((best, item) => {
        if (!best) {
          return item;
        }
        const itemScore = Math.hypot((item.x - target.x) / 38, (item.y - target.y) / 30);
        const bestScore = Math.hypot((best.x - target.x) / 38, (best.y - target.y) / 30);
        return itemScore < bestScore ? item : best;
      }, undefined);

    if (!candidate) {
      throw new Error(`导图节点过多，无法在安全区内放置 ${node.id}`);
    }

    const position = { id: node.id, x: candidate.x, y: candidate.y };
    placedNodes.push({ ...position, width });
    positionById.set(node.id, position);
    activeLevelRadii.push(normalizedRadius(candidate));
  }

  return nodes.map((node) => {
    const position = positionById.get(node.id);
    if (!position) {
      throw new Error(`导图节点 ${node.id} 缺少布局坐标`);
    }
    return position;
  });
}

// 围绕父节点向无限画布外侧散布扩展节点，同时避让整张现有导图。
export function layoutMindMapExpansionNodes(existingNodes: ReadonlyArray<Pick<MindNode, "id" | "label" | "x" | "y">>, parentNode: Pick<MindNode, "x" | "y">, nodes: ReadonlyArray<LayoutNode>): MindMapLayoutPosition[] {
  const placedNodes: PlacedNode[] = existingNodes.map((node) => ({
    id: node.id,
    x: node.x,
    y: node.y,
    width: estimateNodeWidth(node.label),
  }));
  const positionById = new Map<string, MindMapLayoutPosition>();
  const sortedNodes = [...nodes].sort((left, right) => layoutKey(left).localeCompare(layoutKey(right), "zh-CN"));
  const outwardAngle = Math.atan2(parentNode.y - 50, parentNode.x - 50);
  const baseAngle = parentNode.x === 50 && parentNode.y === 50 ? -Math.PI / 2 : outwardAngle;
  const angleOffsets = [0, -34, 34, -68, 68, -102, 102, 180];

  sortedNodes.forEach((node, index) => {
    const width = estimateNodeWidth(node.label);
    const angleOffset = angleOffsets[index % angleOffsets.length] ?? 0;
    const angle = baseAngle + angleOffset * (Math.PI / 180);
    let candidate: LayoutCandidate | undefined;
    for (let attempt = 0; attempt < 12 && !candidate; attempt += 1) {
      const radius = 15 + Math.floor(index / angleOffsets.length) * 12 + attempt * 4;
      const spreadAngle = angle + (attempt % 2 === 0 ? 1 : -1) * Math.floor((attempt + 1) / 2) * 0.12;
      const item = { x: Math.round((parentNode.x + Math.cos(spreadAngle) * radius) * 100) / 100, y: Math.round((parentNode.y + Math.sin(spreadAngle) * radius) * 100) / 100 };
      if (avoidsPlacedNodes(item, width, placedNodes, 7.2)) candidate = item;
    }

    if (!candidate) {
      throw new Error("父节点附近空间不足，无法放置扩展节点");
    }

    const position = { id: node.id, x: candidate.x, y: candidate.y };
    placedNodes.push({ ...position, width });
    positionById.set(node.id, position);
  });

  return nodes.map((node) => {
    const position = positionById.get(node.id);
    if (!position) throw new Error(`扩展节点 ${node.id} 缺少布局坐标`);
    return position;
  });
}
