// 这个文件只验证纯结构转换工具，不再维护本地假生成引擎。
import { describe, expect, it } from "vitest";
import { DIMENSION_GROUPS, type BrainstormMap } from "../types/idea";
import { mindMapNodesToWords } from "./ideaEngine";

function sampleMindMap(): BrainstormMap {
  const center = {
    id: "center",
    label: "项目灵感",
    category: "中心" as const,
    level: 0 as const,
    x: 50,
    y: 50,
    selectable: false,
    locked: true,
    selected: false,
    reason: "中心主题",
  };
  const nodes = DIMENSION_GROUPS.map((category, index) => ({
    id: `node-${category}`,
    label: `${category}节点`,
    category,
    level: 1 as const,
    x: 20 + index * 8,
    y: 30 + index * 4,
    selectable: true,
    locked: index === 0,
    selected: true,
    reason: `${category}角度`,
    parentId: center.id,
  }));

  return {
    id: "map",
    topic: "项目灵感",
    stuckType: "有兴趣没形态",
    center,
    nodes: [center, ...nodes],
    edges: nodes.map((node) => ({ id: `edge-${node.id}`, from: center.id, to: node.id, label: node.category })),
    recommendedNodeIds: nodes.map((node) => node.id),
    createdAt: "2026-07-09T00:00:00.000Z",
  };
}

describe("ideaEngine", () => {
  it("converts selected mind map nodes into collision words with source paths", () => {
    const map = sampleMindMap();
    const selectedNodes = map.nodes.filter((node) => node.selectable).slice(0, 6);
    const words = mindMapNodesToWords(selectedNodes, map);

    expect(words).toHaveLength(6);
    expect(words.map((word) => word.groupType)).toEqual(DIMENSION_GROUPS);
    expect(words.every((word) => word.selected)).toBe(true);
    expect(words[0]?.locked).toBe(true);
    expect(words[0]?.sourcePath).toEqual(["项目灵感", "人群节点"]);
  });
});
