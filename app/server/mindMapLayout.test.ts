// 这个文件验证思维导图节点的确定性散布布局，避免密集节点互相遮挡。
// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { MindNode, MindNodeCategory } from "../src/types/idea";
import { layoutMindMapExpansionNodes, layoutMindMapNodes } from "./mindMapLayout";

const CATEGORIES: Exclude<MindNodeCategory, "中心">[] = ["人群", "场景", "情绪", "物件", "结构", "限制", "远联想"];

// 构造包含不同分类、层级和标签长度的密集节点。
function createDenseNodes(): Array<Pick<MindNode, "id" | "label" | "category" | "level">> {
  return Array.from({ length: 28 }, (_, index) => ({
    id: `node-${index}`,
    label: index % 3 === 0 ? `很长的发散节点标签${index}` : `节点${index}`,
    category: CATEGORIES[index % CATEGORIES.length] ?? "远联想",
    level: ((index % 3) + 1) as MindNode["level"],
  }));
}

// 估算节点在百分比画布上的宽度，用于验证矩形间距。
function estimateWidth(label: string): number {
  return Math.min(15, Math.max(9, 7.5 + Array.from(label).length * 0.55));
}

// 用固定种子构造长标签和不均匀层级组合，复现容量边界。
function createSeededStressNodes(seed: number): Array<Pick<MindNode, "id" | "label" | "category" | "level">> {
  let state = seed;
  const random = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };

  return Array.from({ length: 28 }, (_, index) => ({
    id: `s${seed}n${index}`,
    label: `${random() < 0.45 ? "很长的随机发散标签" : "节点"}${index}`,
    category: CATEGORIES[Math.floor(random() * CATEGORIES.length)] ?? "远联想",
    level: (Math.floor(random() * 3) + 1) as MindNode["level"],
  }));
}

describe("mindMapLayout", () => {
  it("允许边缘节点继续向画布外侧发散", () => {
    const positions = layoutMindMapExpansionNodes(
      [{ id: "center", label: "中心", x: 50, y: 50 }, { id: "parent", label: "边缘节点", x: 86, y: 79 }],
      { x: 86, y: 79 },
      Array.from({ length: 4 }, (_, index) => ({ id: `expand-${index}`, label: `新节点${index}`, category: "场景" as const, level: 2 as const })),
    );

    expect(positions.some((position) => position.x > 87 || position.y > 80)).toBe(true);
  });

  it("把 28 个混合节点稳定地铺满安全区和四个象限", () => {
    const nodes = createDenseNodes();
    const first = layoutMindMapNodes(nodes);
    const second = layoutMindMapNodes(nodes);

    expect(first).toEqual(second);
    expect(first).toHaveLength(nodes.length);
    expect(first.every((position) => position.x >= 12 && position.x <= 87 && position.y >= 20 && position.y <= 80)).toBe(true);

    const quadrants = new Set(first.map((position) => `${position.x < 50 ? "左" : "右"}${position.y < 50 ? "上" : "下"}`));
    expect(quadrants).toEqual(new Set(["左上", "右上", "左下", "右下"]));
  });

  it("允许真实模型把 28 个节点全部归为第一层", () => {
    const labels = [
      "熬夜开发者", "围观朋友", "接盘新人", "前用户幽灵",
      "凌晨提交室", "废弃登录页", "失败发布会", "未完成走廊",
      "羞耻发热", "轻微心疼", "荒诞自嘲", "复活冲动",
      "墓志铭卡片", "代码化石", "需求便签墙", "观众复活票",
      "废墟地图", "时间倒放线", "事故档案柜", "多结局展柜",
      "只展三分钟", "不能说成功", "无修复模式", "匿名遗物箱",
      "沉船博物馆", "昆虫标本盒", "鬼屋导览器", "考古发掘坑",
    ];
    const nodes = labels.map((label, index) => ({
      id: `real-level-one-${index}`,
      label,
      category: CATEGORIES[Math.floor(index / 4)] ?? "远联想",
      level: 1 as const,
    }));

    const positions = layoutMindMapNodes(nodes);

    expect(positions).toHaveLength(28);
    expect(positions.every((position) => position.x >= 12 && position.x <= 87 && position.y >= 20 && position.y <= 80)).toBe(true);
  });

  it("根据标签宽度为密集节点保留矩形防重叠间距", () => {
    const nodes = createDenseNodes();
    const positions = layoutMindMapNodes(nodes);
    const nodeById = new Map(nodes.map((node) => [node.id, node]));

    for (let leftIndex = 0; leftIndex < positions.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < positions.length; rightIndex += 1) {
        const left = positions[leftIndex];
        const right = positions[rightIndex];
        const leftNode = left ? nodeById.get(left.id) : undefined;
        const rightNode = right ? nodeById.get(right.id) : undefined;
        expect(left && right && leftNode && rightNode).toBeTruthy();
        if (!left || !right || !leftNode || !rightNode) {
          continue;
        }

        const horizontalGap = Math.abs(left.x - right.x);
        const verticalGap = Math.abs(left.y - right.y);
        const requiredHorizontalGap = (estimateWidth(leftNode.label) + estimateWidth(rightNode.label)) / 2 + 0.8;
        expect(horizontalGap >= requiredHorizontalGap || verticalGap >= 6.2).toBe(true);
      }
    }
  });

  it("让更深层节点整体离中心更远", () => {
    const nodes = createDenseNodes();
    const positions = layoutMindMapNodes(nodes);
    const levelById = new Map(nodes.map((node) => [node.id, node.level]));
    const distancesByLevel = new Map<number, number[]>([[1, []], [2, []], [3, []]]);

    positions.forEach((position) => {
      const level = levelById.get(position.id) ?? 1;
      distancesByLevel.get(level)?.push(Math.hypot((position.x - 50) / 38, (position.y - 50) / 30));
    });
    const average = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;

    expect(average(distancesByLevel.get(2) ?? [])).toBeGreaterThan(average(distancesByLevel.get(1) ?? []));
    expect(average(distancesByLevel.get(3) ?? [])).toBeGreaterThan(average(distancesByLevel.get(2) ?? []));
  });

  it("输入排列变化时仍为每个节点生成相同位置", () => {
    const nodes = createDenseNodes();
    const forward = new Map(layoutMindMapNodes(nodes).map((position) => [position.id, position]));
    const reversed = new Map(layoutMindMapNodes([...nodes].reverse()).map((position) => [position.id, position]));

    expect(reversed).toEqual(forward);
  });

  it("在多组节点组合中始终保持三个层级的径向顺序", () => {
    for (let seed = 0; seed < 500; seed += 1) {
      const nodes = Array.from({ length: 28 }, (_, index) => ({
        id: `seed-${seed}-node-${index}`,
        label: (index + seed) % 4 === 0 ? `不同长度的发散标签${seed}-${index}` : `想法${seed}-${index}`,
        category: CATEGORIES[(index * 3 + seed) % CATEGORIES.length] ?? "远联想",
        level: (((index * 5 + seed) % 3) + 1) as MindNode["level"],
      }));
      const levelById = new Map(nodes.map((node) => [node.id, node.level]));
      const radii = new Map<number, number[]>([[1, []], [2, []], [3, []]]);

      layoutMindMapNodes(nodes).forEach((position) => {
        const level = levelById.get(position.id) ?? 1;
        radii.get(level)?.push(Math.hypot((position.x - 50) / 38, (position.y - 50) / 30));
      });
      const average = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;

      expect(average(radii.get(1) ?? [])).toBeLessThan(average(radii.get(2) ?? []));
      expect(average(radii.get(2) ?? [])).toBeLessThan(average(radii.get(3) ?? []));
    }
  });

  it.each([57, 62, 125, 354])("在容量回归种子 %s 下仍可完成安全布局", (seed) => {
    expect(layoutMindMapNodes(createSeededStressNodes(seed))).toHaveLength(28);
  });
});
