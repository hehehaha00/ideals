// 这个文件验证全屏导图的坐标换算与曲线路径，避免拖动节点越过安全操作区。
import { describe, expect, it } from "vitest";
import type { MindNode } from "../../types/idea";
import { buildMindMapCurve, getMindMapEdgeVariant, getMindMapMinimapViewportRect, getMindMapRelatedNodeIds, getMindMapViewportNodeIds, getVisibleMindMapNodeIds, nodesInSelectionRect, pointToCanvasPercent, screenToWorldPercent, worldPercentToScreen } from "./mindMapGeometry";

const rect = {
  left: 100,
  top: 50,
  right: 1100,
  bottom: 650,
  width: 1000,
  height: 600,
  x: 100,
  y: 50,
  toJSON: () => ({}),
} as DOMRect;

const safeArea = { top: 90, right: 80, bottom: 110, left: 80 };

// 创建只包含几何测试所需字段的节点。
function node(overrides: Partial<MindNode>): MindNode {
  return {
    id: "node",
    label: "节点",
    category: "场景",
    level: 1,
    x: 50,
    y: 50,
    selectable: true,
    locked: false,
    selected: false,
    reason: "测试",
    ...overrides,
  };
}

// 生成指定数量的测试节点，默认节点放在远离当前视口的位置。
function makeLargeNodeSet(count: number): MindNode[] {
  return Array.from({ length: count }, (_, index) => node({
    id: `generated-${index}`,
    x: 220 + (index % 8),
    y: 220 + (index % 8),
    level: 1,
  }));
}

describe("mind-map geometry", () => {
  it("converts pointer coordinates to percentages inside the safe area", () => {
    expect(pointToCanvasPercent({ clientX: 600, clientY: 350 }, rect, safeArea)).toEqual({ x: 50, y: 50 });
    expect(pointToCanvasPercent({ clientX: -20, clientY: 900 }, rect, safeArea)).toEqual({ x: 8, y: 81.67 });
  });

  it("keeps the original grab offset while dragging from a node edge", () => {
    expect(
      pointToCanvasPercent({ clientX: 600, clientY: 350 }, rect, safeArea, {
        grabOffset: { x: 30, y: 10 },
        nodeBounds: { halfWidth: 70, halfHeight: 28, lockOutsetTop: 22, lockOutsetRight: 24 },
      }),
    ).toEqual({ x: 47, y: 48.33 });
  });

  it("clamps the whole node and protruding lock control inside the safe area", () => {
    const dragOptions = {
      grabOffset: { x: 0, y: 0 },
      nodeBounds: { halfWidth: 70, halfHeight: 28, lockOutsetTop: 22, lockOutsetRight: 24 },
    };

    expect(pointToCanvasPercent({ clientX: -20, clientY: -20 }, rect, safeArea, dragOptions)).toEqual({ x: 15, y: 23.33 });
    expect(pointToCanvasPercent({ clientX: 1300, clientY: 900 }, rect, safeArea, dragOptions)).toEqual({ x: 82.6, y: 77 });
  });

  it("converts a dragged node from a panned and zoomed world viewport", () => {
    expect(pointToCanvasPercent({ clientX: 600, clientY: 350 }, rect, safeArea, {
      grabOffset: { x: 0, y: 0 },
      nodeBounds: { halfWidth: 0, halfHeight: 0, lockOutsetTop: 0, lockOutsetRight: 0 },
      viewport: { panX: 100, panY: -50, scale: 2 },
    })).toEqual({ x: 45, y: 54.17 });
  });

  it("round-trips world and screen coordinates through the viewport", () => {
    const viewport = { panX: 120, panY: -40, scale: 1.5 };
    const screen = worldPercentToScreen({ x: 74, y: 30 }, rect, viewport);

    expect(screenToWorldPercent({ clientX: screen.x, clientY: screen.y }, rect, viewport)).toEqual({ x: 74, y: 30 });
  });

  it("clips a panned low-zoom viewport to the minimap bounds", () => {
    const viewportRect = getMindMapMinimapViewportRect(
      { minX: -28, maxX: 128, minY: -28, maxY: 128 },
      { width: 1280, height: 720 },
      { panX: 500, panY: 0, scale: 0.35 },
    );

    expect(viewportRect.x).toBe(0);
    expect(viewportRect.width).toBeCloseTo(70.03, 1);
    expect(viewportRect.x + viewportRect.width).toBeLessThanOrEqual(100);
    expect(viewportRect.y).toBe(0);
    expect(viewportRect.height).toBe(100);
  });

  it("finds selectable nodes inside an unordered selection rectangle", () => {
    const nodes = [node({ id: "inside", x: 40, y: 45 }), node({ id: "outside", x: 80, y: 80 }), node({ id: "center", x: 50, y: 50, selectable: false })];

    expect(nodesInSelectionRect(nodes, { startX: 60, startY: 60, endX: 30, endY: 30 })).toEqual(["inside"]);
  });

  it("hides all descendants of a collapsed branch", () => {
    const nodes = [
      node({ id: "center", category: "中心", level: 0, selectable: false }),
      node({ id: "parent", parentId: "center", collapsed: true }),
      node({ id: "child", parentId: "parent", level: 2 }),
      node({ id: "grandchild", parentId: "child", level: 3 }),
      node({ id: "sibling", parentId: "center" }),
    ];

    expect(getVisibleMindMapNodeIds(nodes)).toEqual(new Set(["center", "parent", "sibling"]));
    expect(getMindMapRelatedNodeIds(nodes, "child")).toEqual(new Set(["center", "parent", "child", "grandchild"]));
  });

  it("builds a cubic curve between two nodes", () => {
    const curve = buildMindMapCurve(node({ id: "center", x: 50, y: 50, category: "中心", level: 0 }), node({ id: "child", x: 25, y: 30 }));

    expect(curve).toMatch(/^M 50 50 C /);
    expect(curve).toContain(", 25 30");
  });

  it("marks first-level and remote-association edges with distinct variants", () => {
    expect(getMindMapEdgeVariant(node({ level: 0, category: "中心" }), node({ level: 1, category: "情绪" }))).toBe("primary");
    expect(getMindMapEdgeVariant(node({ level: 1 }), node({ level: 2, category: "远联想" }))).toBe("remote");
  });

  it("returns every node at or below the culling threshold", () => {
    const nodes = makeLargeNodeSet(180);

    expect(getMindMapViewportNodeIds({
      nodes,
      viewport: { panX: 0, panY: 0, scale: 1 },
      canvasSize: { width: 1000, height: 600 },
      protectedNodeIds: [],
    })).toEqual(new Set(nodes.map((item) => item.id)));
  });

  it.each([200, 500, 1000])("reduces a %i-node map while retaining the expanded viewport", (count) => {
    const nodes = [
      node({ id: "center", category: "中心", level: 0, selectable: false, x: 50, y: 50 }),
      node({ id: "viewport-top-left", x: 0, y: 0 }),
      node({ id: "viewport-bottom-right", x: 100, y: 100 }),
      ...makeLargeNodeSet(count - 3),
    ];
    const retainedIds = getMindMapViewportNodeIds({
      nodes,
      viewport: { panX: 0, panY: 0, scale: 1 },
      canvasSize: { width: 1000, height: 600 },
      protectedNodeIds: ["center"],
    });

    expect(retainedIds.size).toBeLessThan(count / 2);
    expect([...retainedIds]).toEqual(expect.arrayContaining(["center", "viewport-top-left", "viewport-bottom-right"]));
    expect(retainedIds.has("generated-0")).toBe(false);
  });

  it("keeps protected remote nodes and the ancestor chain for retained nodes", () => {
    const nodes = [
      node({ id: "center", category: "中心", level: 0, selectable: false, x: 50, y: 50 }),
      node({ id: "visible-parent", parentId: "center", x: 320, y: 320 }),
      node({ id: "visible-child", parentId: "visible-parent", x: 50, y: 50 }),
      node({ id: "source-parent", parentId: "center", x: 320, y: 320 }),
      node({ id: "source", parentId: "source-parent", x: 320, y: 320 }),
      node({ id: "active-parent", parentId: "center", x: -220, y: -220 }),
      node({ id: "active", parentId: "active-parent", x: -220, y: -220 }),
      ...makeLargeNodeSet(194),
    ];
    const retainedIds = getMindMapViewportNodeIds({
      nodes,
      viewport: { panX: 0, panY: 0, scale: 1 },
      canvasSize: { width: 1000, height: 600 },
      protectedNodeIds: ["center", "source", "active"],
    });

    expect([...retainedIds]).toEqual(expect.arrayContaining([
      "center",
      "visible-parent",
      "visible-child",
      "source-parent",
      "source",
      "active-parent",
      "active",
    ]));
    expect(retainedIds.has("generated-0")).toBe(false);
  });

  it("falls back to all nodes for invalid canvas geometry", () => {
    const nodes = makeLargeNodeSet(200);
    const allNodeIds = new Set(nodes.map((item) => item.id));

    expect(getMindMapViewportNodeIds({
      nodes,
      viewport: { panX: 0, panY: 0, scale: 1 },
      canvasSize: { width: 0, height: 600 },
      protectedNodeIds: [],
    })).toEqual(allNodeIds);
    expect(getMindMapViewportNodeIds({
      nodes,
      viewport: { panX: 0, panY: 0, scale: 0 },
      canvasSize: { width: 1000, height: 600 },
      protectedNodeIds: [],
    })).toEqual(allNodeIds);
  });
});
