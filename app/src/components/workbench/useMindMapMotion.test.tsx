// 这个文件验证 GSAP Hook 的响应式降级、快照生命周期和真实编排目标。
import React, { useRef } from "react";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MindEdge, MindNode } from "../../types/idea";
import { useMindMapMotion } from "./useMindMapMotion";

const motionMocks = vi.hoisted(() => ({
  cleanup: vi.fn(),
  fromTo: vi.fn(),
  registerPlugin: vi.fn(),
  set: vi.fn(),
  timeline: vi.fn(),
  timelineCall: vi.fn(),
  timelineFromTo: vi.fn(),
  timelineTo: vi.fn(),
  to: vi.fn(),
}));

vi.mock("@gsap/react", async () => {
  const ReactModule = await import("react");
  return {
    useGSAP: (callback: () => void, config: { dependencies: unknown[] }): void => {
      ReactModule.useLayoutEffect(() => {
        callback();
        return () => motionMocks.cleanup();
      }, config.dependencies);
    },
  };
});

vi.mock("gsap", () => ({
  default: {
    fromTo: motionMocks.fromTo,
    registerPlugin: motionMocks.registerPlugin,
    set: motionMocks.set,
    timeline: (...args: unknown[]) => {
      motionMocks.timeline(...args);
      const timeline = {
        call: (...callArgs: unknown[]) => {
          motionMocks.timelineCall(...callArgs);
          return timeline;
        },
        fromTo: (...callArgs: unknown[]) => {
          motionMocks.timelineFromTo(...callArgs);
          return timeline;
        },
        to: (...callArgs: unknown[]) => {
          motionMocks.timelineTo(...callArgs);
          return timeline;
        },
      };
      return timeline;
    },
    to: motionMocks.to,
    utils: {
      toArray: (selector: string, scope: ParentNode) => Array.from(scope.querySelectorAll(selector)),
    },
  },
}));

class MatchMediaController {
  matches = false;
  private readonly listeners = new Set<(event: MediaQueryListEvent) => void>();
  private readonly eventListenerMap = new Map<EventListenerOrEventListenerObject, (event: MediaQueryListEvent) => void>();

  // 模拟浏览器动态切换减少动画偏好。
  asMediaQueryList(): MediaQueryList {
    const addListener = (listener: ((event: MediaQueryListEvent) => void) | null): void => {
      if (listener) this.listeners.add(listener);
    };
    const removeListener = (listener: ((event: MediaQueryListEvent) => void) | null): void => {
      if (listener) this.listeners.delete(listener);
    };
    const mediaQueryList = {
      matches: this.matches,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject): void => {
        const wrappedListener = typeof listener === "function" ? (event: MediaQueryListEvent) => listener(event) : (event: MediaQueryListEvent) => listener.handleEvent(event);
        this.eventListenerMap.set(listener, wrappedListener);
        addListener(wrappedListener);
      },
      removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject): void => {
        removeListener(this.eventListenerMap.get(listener) ?? null);
        this.eventListenerMap.delete(listener);
      },
      addListener,
      removeListener,
      dispatchEvent: () => true,
    };
    return mediaQueryList as unknown as MediaQueryList;
  }

  // 通知订阅者偏好已改变。
  setMatches(matches: boolean): void {
    this.matches = matches;
    const event = { matches, media: "(prefers-reduced-motion: reduce)" } as MediaQueryListEvent;
    this.listeners.forEach((listener) => listener(event));
  }
}

const center: MindNode = {
  id: "center",
  label: "中心",
  category: "中心",
  level: 0,
  x: 50,
  y: 50,
  selectable: false,
  locked: true,
  selected: false,
  reason: "中心",
};
const firstNode: MindNode = {
  id: "node-1",
  label: "第一节点",
  category: "情绪",
  level: 1,
  x: 30,
  y: 36,
  selectable: true,
  locked: false,
  selected: true,
  parentId: "center",
  reason: "测试",
};
const secondNode: MindNode = {
  ...firstNode,
  id: "node-2",
  label: "新增节点",
  x: 72,
  y: 64,
  parentId: "node-1",
  selected: false,
};

const firstEdge: MindEdge = { id: "edge-1", from: "center", to: "node-1", label: "情绪" };
const secondEdge: MindEdge = { id: "edge-2", from: "node-1", to: "node-2", label: "情绪" };

interface HarnessProps {
  loading: "idle" | "map" | "reroll" | "expand" | "ideas" | "challenge" | "discussion" | "discussionResponse" | "discussionBranch";
  nodes: MindNode[];
  edges?: MindEdge[];
  activeNodeId?: string;
  resultKey?: string;
}

// 提供非零画布和真实 data-motion 元素，让 Hook 执行完整编排分支。
function MotionHarness({ loading, nodes, edges = [], activeNodeId = "node-1", resultKey = "" }: HarnessProps): JSX.Element {
  const scope = useRef<HTMLDivElement>(null);
  const { motionPlaying, reducedMotion } = useMindMapMotion({ scope, loading, nodes, activeNodeId, resultKey });
  return (
    <div ref={scope} data-motion-playing={motionPlaying} data-reduced-motion={reducedMotion}>
      {nodes.map((node) => (
        <span data-motion-node-id={node.id} key={node.id} />
      ))}
      <svg>
        {edges.map((edge) => (
          <path data-motion-edge-id={edge.id} data-motion-source-id={edge.from} data-motion-target-id={edge.to} key={edge.id} />
        ))}
      </svg>
    </div>
  );
}

// 找出 Hook 通过 gsap.set 放到爆发源的节点。
function stagedNodeIds(): string[] {
  return motionMocks.set.mock.calls.flatMap(([target]) => {
    return target instanceof HTMLElement && target.dataset.motionNodeId ? [target.dataset.motionNodeId] : [];
  });
}

describe("useMindMapMotion", () => {
  const media = new MatchMediaController();

  beforeEach(() => {
    vi.clearAllMocks();
    media.matches = false;
    vi.stubGlobal("matchMedia", vi.fn(() => media.asMediaQueryList()));
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 1000,
      bottom: 700,
      width: 1000,
      height: 700,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reacts to reduced-motion changes and cleans up the running GSAP context", () => {
    const view = render(<MotionHarness loading="idle" nodes={[center, firstNode]} edges={[firstEdge]} />);
    expect(view.container.firstElementChild).toHaveAttribute("data-reduced-motion", "false");

    vi.clearAllMocks();
    act(() => media.setMatches(true));

    expect(view.container.firstElementChild).toHaveAttribute("data-reduced-motion", "true");
    expect(motionMocks.cleanup).toHaveBeenCalledTimes(1);
    expect(motionMocks.to).not.toHaveBeenCalled();
    expect(motionMocks.set).toHaveBeenCalledWith(expect.any(Array), { clearProps: "transform,opacity" });
  });

  it("does not replay a completed result after reduced motion is turned off", () => {
    const view = render(<MotionHarness loading="ideas" nodes={[center, firstNode]} edges={[firstEdge]} resultKey="old-idea" />);

    act(() => media.setMatches(true));
    view.rerender(<MotionHarness loading="idle" nodes={[center, firstNode]} edges={[firstEdge]} resultKey="new-idea" />);
    vi.clearAllMocks();

    act(() => media.setMatches(false));

    expect(stagedNodeIds()).toEqual([]);
    expect(motionMocks.timeline).not.toHaveBeenCalled();
    expect(view.container.firstElementChild).toHaveAttribute("data-motion-playing", "false");
  });

  it("uses the busy snapshot to explode only nodes returned by a successful expand", () => {
    const view = render(<MotionHarness loading="expand" nodes={[center, firstNode]} edges={[firstEdge]} />);
    vi.clearAllMocks();

    view.rerender(<MotionHarness loading="idle" nodes={[center, firstNode, secondNode]} edges={[firstEdge, secondEdge]} />);

    expect(stagedNodeIds()).toEqual(["node-2"]);
    expect(motionMocks.cleanup).toHaveBeenCalledTimes(1);
  });

  it.each(["failure", "cancel"])("does not explode existing nodes after an expand %s", () => {
    const view = render(<MotionHarness loading="expand" nodes={[center, firstNode]} edges={[firstEdge]} />);
    vi.clearAllMocks();

    view.rerender(<MotionHarness loading="idle" nodes={[center, firstNode]} edges={[firstEdge]} />);

    expect(stagedNodeIds()).toEqual([]);
    expect(motionMocks.cleanup).toHaveBeenCalledTimes(1);
  });

  it("cleans up an unfinished busy animation when the canvas unmounts", () => {
    const view = render(<MotionHarness loading="ideas" nodes={[center, firstNode]} edges={[firstEdge]} />);
    vi.clearAllMocks();

    view.unmount();

    expect(motionMocks.cleanup).toHaveBeenCalledTimes(1);
  });

  it("keeps interaction locked until the node burst timeline completes", () => {
    const view = render(<MotionHarness loading="map" nodes={[]} />);
    vi.clearAllMocks();

    view.rerender(<MotionHarness loading="idle" nodes={[center, firstNode]} edges={[firstEdge]} />);

    expect(view.container.firstElementChild).toHaveAttribute("data-motion-playing", "true");
    const timelineOptions = motionMocks.timeline.mock.calls.at(-1)?.[0] as { onComplete?: () => void } | undefined;
    act(() => timelineOptions?.onComplete?.());
    expect(view.container.firstElementChild).toHaveAttribute("data-motion-playing", "false");
  });

  it("does not replay the whole entrance burst when only the active node changes", () => {
    const view = render(<MotionHarness activeNodeId="node-1" loading="idle" nodes={[center, firstNode, secondNode]} edges={[firstEdge, secondEdge]} />);
    vi.clearAllMocks();

    view.rerender(<MotionHarness activeNodeId="node-2" loading="idle" nodes={[center, firstNode, secondNode]} edges={[firstEdge, secondEdge]} />);

    expect(stagedNodeIds()).toEqual([]);
    expect(motionMocks.timeline).not.toHaveBeenCalled();
  });

  it.each(["challenge", "discussion", "discussionResponse"] as const)("treats %s work as a non-map animation stage", (loading) => {
    const view = render(<MotionHarness loading={loading} nodes={[center, firstNode]} edges={[firstEdge]} />);

    expect(view.container.firstElementChild).toHaveAttribute("data-motion-playing", "false");
    expect(motionMocks.timeline).not.toHaveBeenCalled();
    expect(motionMocks.to).not.toHaveBeenCalled();
  });

  it("explodes only newly returned nodes after a discussion branch succeeds", () => {
    const view = render(<MotionHarness loading="discussionBranch" nodes={[center, firstNode]} edges={[firstEdge]} />);
    vi.clearAllMocks();

    view.rerender(<MotionHarness loading="idle" nodes={[center, firstNode, secondNode]} edges={[firstEdge, secondEdge]} />);

    expect(stagedNodeIds()).toEqual(["node-2"]);
    expect(view.container.firstElementChild).toHaveAttribute("data-motion-playing", "true");
  });

  it.each(["map", "reroll", "ideas"] as const)("does not replay a failed or cancelled %s request", (operation) => {
    const startingNodes = operation === "map" ? [] : [center, firstNode];
    const startingEdges = operation === "map" ? [] : [firstEdge];
    const view = render(<MotionHarness loading={operation} nodes={startingNodes} edges={startingEdges} />);
    vi.clearAllMocks();

    view.rerender(<MotionHarness loading="idle" nodes={startingNodes} edges={startingEdges} />);

    expect(stagedNodeIds()).toEqual([]);
    expect(motionMocks.timeline).not.toHaveBeenCalled();
    expect(view.container.firstElementChild).toHaveAttribute("data-motion-playing", "false");
  });

  it("plays the reroll completion animation when node content changed", () => {
    const view = render(<MotionHarness loading="reroll" nodes={[center, firstNode]} edges={[firstEdge]} />);
    vi.clearAllMocks();

    view.rerender(<MotionHarness loading="idle" nodes={[center, { ...firstNode, label: "重掷后的节点" }]} edges={[firstEdge]} />);

    expect(stagedNodeIds()).toEqual(["node-1"]);
    expect(view.container.firstElementChild).toHaveAttribute("data-motion-playing", "true");
  });

  it("plays the ideas completion animation when a new idea result arrives", () => {
    const view = render(<MotionHarness loading="ideas" nodes={[center, firstNode]} edges={[firstEdge]} resultKey="old-idea" />);
    vi.clearAllMocks();

    view.rerender(<MotionHarness loading="idle" nodes={[center, firstNode]} edges={[firstEdge]} resultKey="new-idea" />);

    expect(stagedNodeIds()).toEqual(["node-1"]);
    expect(view.container.firstElementChild).toHaveAttribute("data-motion-playing", "true");
  });
});
