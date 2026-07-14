// 这个文件锁定报告页反共识挑战的按需展开、加载锁定和旧结果保留。
import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIdeaStore } from "../../store/ideaStore";
import type { IdeaCard as IdeaCardType, IdeaChallenge } from "../../types/idea";
import { IdeaCard } from "./IdeaCard";

// 构造一张未炼化报告，供挑战入口测试复用。
function sampleIdea(): IdeaCardType {
  return {
    id: "idea-1",
    title: "项目遗迹馆",
    summary: "把烂尾项目变成可浏览展品。",
    whyInteresting: "它把失败经验变成可以展示和复盘的资产。",
    firstVersion: "输入一个仓库链接，生成一张项目展签。",
    sourceWords: [],
    sourcePath: ["开发者灵感枯竭", "烂尾焦虑", "项目遗迹馆"],
    createdAt: "2026-07-09T00:00:00.000Z",
  };
}

// 构造一条已有批注，验证失败时旧结果仍可见。
function sampleChallenge(): IdeaChallenge {
  return {
    ideaId: "idea-1",
    role: "毒舌用户",
    challenge: "如果只是总结 README，我会立刻关掉。",
    risk: "用户看不到新价值。",
    newDirection: "改成只暴露项目失败模式。",
    createdAt: "2026-07-10T01:00:00.000Z",
  };
}

const originalActions = (() => {
  const state = useIdeaStore.getState();
  return { challengeIdea: state.challengeIdea, refineActiveIdea: state.refineActiveIdea };
})();

// 每个报告测试从一个没有挑战结果的工作区开始，避免相互污染。
function resetReportState(): void {
  useIdeaStore.getState().reset();
  useIdeaStore.setState({
    ideas: [sampleIdea()],
    activeIdeaId: "idea-1",
    loading: "idle",
    challengesByIdeaId: {},
    error: undefined,
  });
}

describe("idea challenge report", () => {
  beforeEach(() => {
    localStorage.clear();
    resetReportState();
  });

  afterEach(() => {
    act(() => useIdeaStore.setState(originalActions));
    vi.restoreAllMocks();
  });

  it("keeps role choices hidden until the user opens the secondary challenge entry", () => {
    const challengeIdea = vi.fn(async (): Promise<void> => undefined);
    useIdeaStore.setState({ challengeIdea });

    render(React.createElement(IdeaCard, { idea: sampleIdea() }));

    expect(screen.queryByRole("group", { name: "选择挑战角色" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "换个立场" }));

    const roleGroup = screen.getByRole("group", { name: "选择挑战角色" });
    expect(within(roleGroup).getAllByRole("button")).toHaveLength(5);
    expect(challengeIdea).not.toHaveBeenCalled();
  });

  it("passes the selected role and locks report actions while challenge is running", () => {
    const challengeIdea = vi.fn(async (): Promise<void> => undefined);
    useIdeaStore.setState({ challengeIdea });

    render(React.createElement(IdeaCard, { idea: sampleIdea() }));
    fireEvent.click(screen.getByRole("button", { name: "换个立场" }));
    fireEvent.click(screen.getByRole("button", { name: "工程师" }));

    expect(challengeIdea).toHaveBeenCalledWith("idea-1", "工程师");

    act(() => useIdeaStore.setState({ loading: "challenge" }));

    expect(screen.getByRole("button", { name: "深入验证" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "收藏" })).toBeDisabled();
    expect(within(screen.getByRole("group", { name: "选择挑战角色" })).getByRole("button", { name: "毒舌用户" })).toBeDisabled();
  });

  it("renders existing challenges as continuous editorial notes and keeps them after a failed attempt", () => {
    const previous = sampleChallenge();
    useIdeaStore.setState({ challengesByIdeaId: { "idea-1": [previous] }, error: "LLM 有问题：challenge failed" });

    const { container } = render(React.createElement(IdeaCard, { idea: sampleIdea() }));

    const notes = screen.getByRole("region", { name: "反共识批注" });
    expect(notes).toHaveTextContent("毒舌用户");
    expect(notes).toHaveTextContent("质疑");
    expect(notes).toHaveTextContent(previous.challenge);
    expect(notes).toHaveTextContent(previous.risk);
    expect(notes).toHaveTextContent(previous.newDirection);
    expect(container.querySelectorAll(".idea-challenge-card")).toHaveLength(0);
  });

  it("resets the role chooser when the report changes", () => {
    const first = sampleIdea();
    const second = { ...sampleIdea(), id: "idea-2", title: "夜间展签" };
    const view = render(React.createElement(IdeaCard, { idea: first }));

    fireEvent.click(screen.getByRole("button", { name: "换个立场" }));
    expect(screen.getByRole("group", { name: "选择挑战角色" })).toBeInTheDocument();

    view.rerender(React.createElement(IdeaCard, { idea: second }));

    expect(screen.queryByRole("group", { name: "选择挑战角色" })).not.toBeInTheDocument();
  });

  it("closes an open chooser when another report operation starts", () => {
    render(React.createElement(IdeaCard, { idea: sampleIdea() }));

    fireEvent.click(screen.getByRole("button", { name: "换个立场" }));
    expect(screen.getByRole("group", { name: "选择挑战角色" })).toBeInTheDocument();

    act(() => useIdeaStore.setState({ loading: "refine" }));

    expect(screen.queryByRole("group", { name: "选择挑战角色" })).not.toBeInTheDocument();
  });
});
