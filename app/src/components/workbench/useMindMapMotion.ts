// 这个文件用 GSAP 编排导图节点爆发、收束、连线绘制和工作层能量动画。
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useEffect, useRef, useState, type RefObject } from "react";
import type { MindEdge, MindNode } from "../../types/idea";
import type { MindMapMotionOperation } from "./MindMapActivity";

gsap.registerPlugin(useGSAP);

type LoadingStage = "idle" | "map" | "reroll" | "expand" | "words" | "collision" | "ideas" | "transform" | "refine" | "challenge" | "discussion" | "discussionResponse" | "discussionBranch" | "mix";

interface MindMapMotionOptions {
  scope: RefObject<HTMLDivElement>;
  loading: LoadingStage;
  nodes: MindNode[];
  activeNodeId?: string;
  resultKey?: string;
}

interface MotionSnapshot {
  operation: MindMapMotionOperation;
  sourceId: string;
  existingNodeIds: Set<string>;
  nodeSignatures: Map<string, string>;
  resultKey: string;
}

const MOTION_OPERATIONS = new Set<LoadingStage>(["map", "expand", "reroll", "ideas", "discussionBranch"]);

// 判断操作是否需要导图专属动画。
function isMotionOperation(loading: LoadingStage): loading is MindMapMotionOperation {
  return MOTION_OPERATIONS.has(loading);
}

// 按操作选择爆发或汇聚的视觉源点。
function resolveSourceId(operation: MindMapMotionOperation, activeNodeId?: string): string {
  return (operation === "expand" || operation === "discussionBranch") && activeNodeId ? activeNodeId : "center";
}

// 记录会被 AI 改写的节点字段，用于区分成功结果和请求失败后的原快照。
function mindNodeSignature(node: MindNode): string {
  return [
    node.id,
    node.label,
    node.category,
    node.level,
    node.x,
    node.y,
    node.selectable,
    node.locked,
    node.selected,
    node.reason,
    node.source ?? "",
    node.parentId ?? "",
    node.collapsed ?? false,
    node.note ?? "",
    node.groupId ?? "",
  ].join("\u0001");
}

// 判断导图请求结束后是否真的产生了新的节点结果。
function hasMindMapResultChanged(nodes: MindNode[], snapshot: MotionSnapshot, resultKey: string): boolean {
  if (snapshot.operation === "ideas") return resultKey !== snapshot.resultKey;
  if (nodes.length !== snapshot.existingNodeIds.size) return true;
  return nodes.some((node) => mindNodeSignature(node) !== snapshot.nodeSignatures.get(node.id));
}

// 订阅系统的减少动态效果偏好，运行时切换也会立即更新动画策略。
function usePrefersReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (event: MediaQueryListEvent): void => setReducedMotion(event.matches);
    setReducedMotion(mediaQuery.matches);
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  return reducedMotion;
}

// 从节点模型计算由源点到目标点的像素位移，避免读取被动画改变后的 DOM 位置。
function sourceOffset(scope: HTMLDivElement, source: MindNode | undefined, target: MindNode): { x: number; y: number } {
  const width = scope.clientWidth || scope.getBoundingClientRect().width;
  const height = scope.clientHeight || scope.getBoundingClientRect().height;
  const origin = source ?? { x: 50, y: 50 };
  return {
    x: ((origin.x - target.x) / 100) * width,
    y: ((origin.y - target.y) / 100) * height,
  };
}

export interface MindMapMotionTargets {
  nodeIds: string[];
  edgeIds: string[];
}

// 精确计算一次操作允许移动的节点和连线，确保锁定分支与未选分支保持静止。
export function selectMindMapMotionTargets(
  nodes: MindNode[],
  edges: MindEdge[],
  operation: MindMapMotionOperation,
  existingNodeIds: Set<string>,
): MindMapMotionTargets {
  const targetNodes = nodes.filter((node) => {
    if (node.category === "中心") return false;
    if (operation === "expand" || operation === "discussionBranch") return !existingNodeIds.has(node.id);
    if (operation === "reroll") return !node.locked;
    if (operation === "ideas") return node.selected;
    return true;
  });
  const nodeIds = targetNodes.map((node) => node.id);
  const targetNodeIds = new Set(nodeIds);

  if (operation === "map") {
    return { nodeIds, edgeIds: edges.map((edge) => edge.id) };
  }
  if (operation !== "ideas") {
    return { nodeIds, edgeIds: edges.filter((edge) => targetNodeIds.has(edge.to)).map((edge) => edge.id) };
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const selectedPathKeys = new Set<string>();
  for (const targetNode of targetNodes) {
    let current: MindNode | undefined = targetNode;
    const visited = new Set<string>();
    while (current?.parentId && !visited.has(current.id)) {
      visited.add(current.id);
      selectedPathKeys.add(`${current.parentId}:${current.id}`);
      current = nodeById.get(current.parentId);
    }
  }
  return {
    nodeIds,
    edgeIds: edges.filter((edge) => selectedPathKeys.has(`${edge.from}:${edge.to}`)).map((edge) => edge.id),
  };
}

// 为碰撞收束阶段返回真正选中节点的父链，不包含仅因 active 而高亮的路径。
export function selectIdeasConvergenceEdgeIds(nodes: MindNode[], edges: MindEdge[]): string[] {
  return selectMindMapMotionTargets(nodes, edges, "ideas", new Set(nodes.map((node) => node.id))).edgeIds;
}

// 为全屏导图建立可自动清理的 GSAP 时间线，并返回是否启用减少动态效果。
export function useMindMapMotion({ scope, loading, nodes, activeNodeId, resultKey = "" }: MindMapMotionOptions): { motionPlaying: boolean; reducedMotion: boolean } {
  const snapshotRef = useRef<MotionSnapshot>();
  const previousNodeIdsRef = useRef<Set<string>>(new Set());
  const [motionPlaying, setMotionPlaying] = useState(false);
  const nodeKey = nodes.map((node) => node.id).join("|");
  const reducedMotion = usePrefersReducedMotion();

  useGSAP(
    () => {
      const stage = scope.current;
      if (!stage) {
        return;
      }

      const allMotionNodes = Array.from(stage.querySelectorAll<HTMLElement>("[data-motion-node-id]"));
      const allMotionEdges = Array.from(stage.querySelectorAll<SVGPathElement>("[data-motion-edge-id]"));
      const findMotionNode = (nodeId: string): HTMLElement | undefined => allMotionNodes.find((element) => element.dataset.motionNodeId === nodeId);
      if (reducedMotion) {
        setMotionPlaying(false);
        snapshotRef.current = undefined;
        gsap.set(allMotionNodes, { clearProps: "transform,opacity" });
        gsap.set(allMotionEdges, { clearProps: "opacity,strokeDashoffset" });
        return;
      }
      const stageBounds = stage.getBoundingClientRect();
      if ((stage.clientWidth || stageBounds.width) === 0 || (stage.clientHeight || stageBounds.height) === 0) {
        setMotionPlaying(false);
        return;
      }

      const core = stage.querySelector<HTMLElement>("[data-motion-energy-core]");
      const orbits = gsap.utils.toArray<HTMLElement>("[data-motion-orbit]", stage);
      const particles = gsap.utils.toArray<HTMLElement>("[data-motion-particle]", stage);
      if (core) {
        gsap.to(core, { scale: 1.18, opacity: 0.72, duration: 0.9, repeat: -1, yoyo: true, ease: "sine.inOut" });
      }
      orbits.forEach((orbit, index) => {
        gsap.to(orbit, { rotation: index % 2 === 0 ? 360 : -360, duration: 7 + index * 2.4, repeat: -1, ease: "none" });
      });
      if (particles.length > 0) {
        gsap.fromTo(particles, { opacity: 0.2, scale: 0.55 }, { opacity: 0.9, scale: 1.15, duration: 1.1, stagger: { amount: 0.9, from: "random" }, repeat: -1, yoyo: true, ease: "sine.inOut" });
      }

      if (isMotionOperation(loading)) {
        setMotionPlaying(false);
        const snapshot: MotionSnapshot = {
          operation: loading,
          sourceId: resolveSourceId(loading, activeNodeId),
          existingNodeIds: new Set(nodes.map((node) => node.id)),
          nodeSignatures: new Map(nodes.map((node) => [node.id, mindNodeSignature(node)])),
          resultKey,
        };
        snapshotRef.current = snapshot;

        if (loading === "reroll" || loading === "ideas") {
          const center = nodes.find((node) => node.id === "center") ?? nodes.find((node) => node.category === "中心");
          const candidates = nodes.filter((node) => {
            if (node.category === "中心") return false;
            return loading === "ideas" ? node.selected : !node.locked;
          });
          const candidateElements = candidates.flatMap((node) => {
            const element = findMotionNode(node.id);
            return element ? [{ element, offset: sourceOffset(stage, center, node) }] : [];
          });
          const timeline = gsap.timeline({ defaults: { ease: "power4.inOut" } });
          candidateElements.forEach(({ element, offset }, index) => {
            timeline.to(element, { x: offset.x, y: offset.y, scale: loading === "ideas" ? 0.35 : 0.5, opacity: 0.28, duration: 0.56 }, index * 0.018);
          });
          if (loading === "ideas") {
            const edgeModels = allMotionEdges.map((edge) => ({
              id: edge.dataset.motionEdgeId ?? "",
              from: edge.dataset.motionSourceId ?? "",
              to: edge.dataset.motionTargetId ?? "",
              label: "",
            }));
            const convergenceEdgeIds = new Set(selectIdeasConvergenceEdgeIds(nodes, edgeModels));
            const convergenceEdges = allMotionEdges.filter((edge) => convergenceEdgeIds.has(edge.dataset.motionEdgeId ?? ""));
            timeline.to(convergenceEdges, { strokeDashoffset: 1, opacity: 0.12, duration: 0.38 }, 0.08);
          }
        }
        previousNodeIdsRef.current = new Set(nodes.map((node) => node.id));
        return;
      }

      // 非导图请求（例如反共识挑战）不应触发旧导图节点的爆发动画。
      if (loading !== "idle") {
        setMotionPlaying(false);
        snapshotRef.current = undefined;
        previousNodeIdsRef.current = new Set(nodes.map((node) => node.id));
        return;
      }

      const snapshot = snapshotRef.current ?? (previousNodeIdsRef.current.size === 0 && nodes.length > 0
        ? { operation: "map" as const, sourceId: "center", existingNodeIds: previousNodeIdsRef.current, nodeSignatures: new Map<string, string>(), resultKey: "" }
        : undefined);
      if (!snapshot) {
        setMotionPlaying(false);
        previousNodeIdsRef.current = new Set(nodes.map((node) => node.id));
        return;
      }

      // 只有节点内容确实变化时才播放请求完成动画；失败或取消不能伪装成成功。
      if (snapshot.operation !== "expand" && !hasMindMapResultChanged(nodes, snapshot, resultKey)) {
        setMotionPlaying(false);
        previousNodeIdsRef.current = new Set(nodes.map((node) => node.id));
        snapshotRef.current = undefined;
        return;
      }
      const source = nodes.find((node) => node.id === snapshot.sourceId) ?? nodes.find((node) => node.category === "中心");
      const motionTargets = selectMindMapMotionTargets(nodes, [], snapshot.operation, snapshot.existingNodeIds);
      const targetNodeIds = new Set(motionTargets.nodeIds);
      const explodingNodes = nodes.filter((node) => targetNodeIds.has(node.id));
      const explodingElements = explodingNodes.flatMap((node) => {
        const element = findMotionNode(node.id);
        return element ? [{ element, node }] : [];
      });
      const edgeModels = allMotionEdges.map((edge) => ({
        id: edge.dataset.motionEdgeId ?? "",
        from: edge.dataset.motionSourceId ?? "",
        to: edge.dataset.motionTargetId ?? "",
        label: "",
      }));
      const targetEdgeIds = new Set(selectMindMapMotionTargets(nodes, edgeModels, snapshot.operation, snapshot.existingNodeIds).edgeIds);
      const targetEdges = allMotionEdges.filter((edge) => targetEdgeIds.has(edge.dataset.motionEdgeId ?? ""));

      if (explodingElements.length > 0) {
        setMotionPlaying(true);
        const finishMotion = (): void => {
          gsap.set(
            explodingElements.map(({ element }) => element),
            { clearProps: "transform,opacity" },
          );
          gsap.set(targetEdges, { clearProps: "opacity,strokeDashoffset" });
          setMotionPlaying(false);
        };
        const timeline = gsap.timeline({ defaults: { ease: "power4.out" }, onComplete: finishMotion });
        explodingElements.forEach(({ element, node }) => {
          const offset = sourceOffset(stage, source, node);
          if (snapshot.operation === "expand" || snapshot.operation === "discussionBranch") element.classList.add("is-newborn");
          gsap.set(element, { x: offset.x, y: offset.y, scale: 0.2, opacity: 0 });
        });
        timeline.to(
          explodingElements.map(({ element }) => element),
          { x: 0, y: 0, scale: 1, opacity: 1, duration: 0.82, stagger: { amount: 0.62, from: "center" } },
        );
        if (targetEdges.length > 0) {
          timeline.fromTo(targetEdges, { strokeDashoffset: 1, opacity: 0 }, { strokeDashoffset: 0, opacity: 1, duration: 0.64, stagger: { amount: 0.34, from: "center" } }, "-=0.22");
        }
        if (snapshot.operation === "expand" || snapshot.operation === "discussionBranch") {
          timeline.call(() => explodingElements.forEach(({ element }) => element.classList.remove("is-newborn")), [], "+=1.6");
        }
      } else {
        setMotionPlaying(false);
      }

      previousNodeIdsRef.current = new Set(nodes.map((node) => node.id));
      snapshotRef.current = undefined;
    },
    { scope, dependencies: [loading, nodeKey, activeNodeId, resultKey, reducedMotion], revertOnUpdate: true },
  );

  return { motionPlaying, reducedMotion };
}
