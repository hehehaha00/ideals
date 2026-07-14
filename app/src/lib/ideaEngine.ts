// 这个文件只保留非生成型结构工具；项目内容必须来自 LLM。
import { DIMENSION_GROUPS, type BrainstormMap, type DimensionWord, type MindNode } from "../types/idea";
import { createId } from "./id";

// 沿着父节点回溯导图路径。
export function traceMindNodePath(map: BrainstormMap, nodeId: string): string[] {
  const nodeById = new Map(map.nodes.map((node) => [node.id, node]));
  const path: string[] = [];
  let current = nodeById.get(nodeId);
  const visited = new Set<string>();

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.unshift(current.label);
    current = current.parentId ? nodeById.get(current.parentId) : undefined;
  }

  if (path[0] !== map.center.label) {
    path.unshift(map.center.label);
  }

  return path;
}

// 把导图节点转换成旧碰撞流程可用的六类词。
export function mindMapNodesToWords(nodes: MindNode[], map?: BrainstormMap): DimensionWord[] {
  const selectableNodes = nodes.filter((node) => node.selectable);
  return DIMENSION_GROUPS.map((type, index) => {
    const sameTypeNode = selectableNodes.find((node) => node.category === type && !selectableNodes.slice(0, index).some((used) => used.id === node.id));
    const node = sameTypeNode ?? selectableNodes[index % Math.max(1, selectableNodes.length)];
    const sourcePath = node && map ? traceMindNodePath(map, node.id) : node ? [node.label] : undefined;
    return {
      id: createId(`mind_word_${type}_${index}`),
      text: node?.label ?? type,
      groupType: type,
      locked: Boolean(node?.locked),
      selected: true,
      source: node ? `思维导图/${node.category}` : "思维导图",
      sourcePath,
    };
  });
}
