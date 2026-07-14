// 这个文件锁定多角色讨论面板的轻量入口、停止和灵感采集行为。
import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIdeaStore } from "../../store/ideaStore";
import App from "../../App";
import type { IdeaCard, IdeaDiscussion } from "../../types/idea";
import { IdeaCard as IdeaReport } from "./IdeaCard";

function sampleIdea(): IdeaCard {
  return {
    id: "idea-1",
    title: "项目遗迹馆",
    summary: "把烂尾项目变成可浏览展品。",
    whyInteresting: "失败经验也可以成为资产。",
    firstVersion: "输入一个仓库链接，生成一张项目展签。",
    sourceWords: [],
    sourcePath: ["开发者灵感枯竭", "烂尾焦虑", "项目遗迹馆"],
    createdAt: "2026-07-09T00:00:00.000Z",
  };
}

function sampleDiscussion(): IdeaDiscussion {
  return {
    id: "discussion-1",
    ideaId: "idea-1",
    createdAt: "2026-07-10T00:00:00.000Z",
    status: "completed",
    participants: ["用户代言人", "反常识派", "跨界连接者", "现实构建者"],
    rounds: [
      { type: "judgment", contributions: [{ role: "用户代言人", claim: "我想快速看懂失败原因。", tension: "不能要求用户先读长文。", spark: { id: "spark-1", text: "把失败做成三秒展签。" } }] },
      { type: "collision", contributions: [{ role: "反常识派", claim: "失败不必被包装得体面。", tension: "真实感和可分享性冲突。", buildsOn: "spark-1" }] },
      { type: "synthesis", contributions: [{ role: "现实构建者", claim: "先做一个仓库展签生成器。", tension: "第一版必须足够窄。" }] },
    ],
    synthesis: {
      conservativeDirection: { title: "展签生成器", description: "先把一个仓库讲清楚。", nextStep: "找三个烂尾项目测试。" },
      radicalDirection: { title: "失败博物馆", description: "公开浏览项目遗迹。", nextStep: "邀请十位开发者投稿。" },
      unexpectedDirection: { title: "失败考古课", description: "把失败变成学习路线。", nextStep: "做一张课程地图。" },
    },
    interventions: [],
    collectedSparkIds: [],
  };
}

const originalActions = (() => {
  const state = useIdeaStore.getState();
  return {
    discussIdea: state.discussIdea,
    stopDiscussion: state.stopDiscussion,
    collectDiscussionSpark: state.collectDiscussionSpark,
    continueDiscussionDirection: state.continueDiscussionDirection,
    respondToIdeaDiscussion: state.respondToIdeaDiscussion,
    chooseRefinementAction: state.chooseRefinementAction,
    createIdeaExecutionPlan: state.createIdeaExecutionPlan,
    refineActiveIdea: state.refineActiveIdea,
  };
})();

function resetState(): void {
  useIdeaStore.getState().reset();
  useIdeaStore.setState({ ideas: [sampleIdea()], activeIdeaId: "idea-1", loading: "idle", discussionsByIdeaId: {} });
}

describe("idea discussion panel", () => {
  beforeEach(() => {
    localStorage.clear();
    resetState();
  });

  afterEach(() => {
    act(() => useIdeaStore.setState(originalActions));
    vi.restoreAllMocks();
  });

  it("keeps discussion content hidden behind a secondary report entry", () => {
    render(<IdeaReport idea={sampleIdea()} />);

    expect(screen.getByRole("button", { name: "召集讨论" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "创意编辑部讨论" })).not.toBeInTheDocument();
  });

  it("starts a discussion and exposes a focusable stop action while the three rounds are prepared", () => {
    const discussIdea = vi.fn(async (): Promise<void> => undefined);
    const stopDiscussion = vi.fn(() => useIdeaStore.setState({ loading: "idle" }));
    useIdeaStore.setState({ discussIdea, stopDiscussion, loading: "idle" });
    render(<IdeaReport idea={sampleIdea()} />);

    fireEvent.click(screen.getByRole("button", { name: "召集讨论" }));
    expect(discussIdea).toHaveBeenCalledWith("idea-1");
    act(() => useIdeaStore.setState({ loading: "discussion" }));

    expect(screen.getByRole("region", { name: "创意编辑部讨论" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("正在准备三轮讨论")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "深入验证" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "换个立场" })).toBeDisabled();
    const stop = screen.getByRole("button", { name: "停止讨论" });
    expect(stop).not.toBeDisabled();
    fireEvent.click(stop);
    expect(stopDiscussion).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("region", { name: "创意编辑部讨论" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "召集讨论" })).toHaveFocus();
  });

  it("starts a selected lineup with the chosen thought mechanism", () => {
    const discussIdea = vi.fn(async (): Promise<void> => undefined);
    useIdeaStore.setState({ discussIdea });
    render(<IdeaReport idea={sampleIdea()} />);

    fireEvent.change(screen.getByRole("combobox", { name: "讨论阵容" }), { target: { value: "radical" } });
    fireEvent.change(screen.getByRole("combobox", { name: "思维机制" }), { target: { value: "extreme" } });
    fireEvent.click(screen.getByRole("button", { name: "召集讨论" }));

    expect(discussIdea).toHaveBeenCalledWith("idea-1", {
      lineup: "radical",
      mechanism: "extreme",
      participants: ["反常识派", "跨界连接者", "未来推演者"],
    });
  });

  it("announces a newly completed discussion with one short live status", () => {
    useIdeaStore.setState({ loading: "discussion", discussionsByIdeaId: {} });
    render(<IdeaReport idea={sampleIdea()} />);

    act(() => useIdeaStore.setState({ loading: "idle", discussionsByIdeaId: { "idea-1": [sampleDiscussion()] } }));

    const status = screen.getByRole("status", { name: "讨论完成" });
    expect(status).toHaveTextContent("讨论完成，已生成三轮观点和三个新方向");
    expect(screen.getByRole("region", { name: "创意编辑部讨论" })).not.toHaveAttribute("aria-live");
  });

  it("renders the latest discussion as editorial notes and only collects a spark after explicit action", () => {
    const discussion = sampleDiscussion();
    const collectDiscussionSpark = vi.fn();
    useIdeaStore.setState({ discussionsByIdeaId: { "idea-1": [discussion] }, collectDiscussionSpark });
    render(<IdeaReport idea={sampleIdea()} />);

    const region = screen.getByRole("region", { name: "创意编辑部讨论" });
    expect(region).not.toHaveAttribute("aria-live");
    expect(screen.getByRole("button", { name: "再开一场" })).toBeInTheDocument();
    expect(region).toHaveTextContent("用户代言人");
    expect(region).toHaveTextContent("判断");
    expect(region).toHaveTextContent("碰撞");
    expect(region).toHaveTextContent("收束");
    expect(region).toHaveTextContent("失败考古课");
    expect(region).toHaveTextContent("把失败做成三秒展签");
    expect(region).not.toHaveTextContent("已采集");

    fireEvent.click(within(region).getByRole("button", { name: "采集到画布 把失败做成三秒展签。" }));
    expect(collectDiscussionSpark).toHaveBeenCalledWith("idea-1", "discussion-1", "spark-1");
  });

  it("keeps report navigation and the incubator locked during any AI discussion", () => {
    useIdeaStore.setState({ loading: "discussion" });
    render(<App />);

    expect(screen.getByRole("button", { name: "返回首页" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /孵化箱/ })).toBeDisabled();
  });

  it("wraps long discussion content instead of widening the report", () => {
    const longText = `https://example.com/${"unbroken".repeat(30)}`;
    const discussion = sampleDiscussion();
    discussion.rounds[0]!.contributions[0] = {
      ...discussion.rounds[0]!.contributions[0]!,
      claim: longText,
      tension: longText,
      spark: { id: "spark-long", text: longText },
    };
    discussion.synthesis!.unexpectedDirection = { title: longText, description: longText, nextStep: longText };
    useIdeaStore.setState({ discussionsByIdeaId: { "idea-1": [discussion] } });
    render(<IdeaReport idea={sampleIdea()} />);

    expect(screen.getByText(`“${longText}”`)).toHaveClass("min-w-0", "break-words");
    expect(screen.getAllByText(longText).some((element) => element.classList.contains("break-words"))).toBe(true);
    expect(screen.getByRole("heading", { name: longText })).toHaveClass("min-w-0", "break-words");
  });

  it("selects a synthesis direction locally without starting another business action", () => {
    const discussion = sampleDiscussion();
    const chooseRefinementAction = vi.fn();
    const createIdeaExecutionPlan = vi.fn();
    const refineActiveIdea = vi.fn(async (): Promise<void> => undefined);
    useIdeaStore.setState({
      discussionsByIdeaId: { "idea-1": [discussion] },
      chooseRefinementAction,
      createIdeaExecutionPlan,
      refineActiveIdea,
    });
    render(<IdeaReport idea={sampleIdea()} />);

    const radical = screen.getByRole("button", { name: /激进方向 失败博物馆/ });
    expect(radical).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(radical);

    expect(radical).toHaveAttribute("aria-pressed", "true");
    expect(chooseRefinementAction).not.toHaveBeenCalled();
    expect(createIdeaExecutionPlan).not.toHaveBeenCalled();
    expect(refineActiveIdea).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "沿这个方向继续" })).toBeInTheDocument();
  });

  it("continues from the selected direction and only returns to the map after success", async () => {
    const discussion = sampleDiscussion();
    const continueDiscussionDirection = vi.fn(async (): Promise<boolean> => true);
    const onDiscussionBranchCreated = vi.fn();
    useIdeaStore.setState({ discussionsByIdeaId: { "idea-1": [discussion] }, continueDiscussionDirection });
    render(<IdeaReport idea={sampleIdea()} onDiscussionBranchCreated={onDiscussionBranchCreated} />);

    fireEvent.click(screen.getByRole("button", { name: /意外方向 失败考古课/ }));
    fireEvent.click(screen.getByRole("button", { name: "沿这个方向继续" }));

    await waitFor(() => expect(continueDiscussionDirection).toHaveBeenCalledWith("idea-1", "discussion-1", "unexpectedDirection"));
    expect(onDiscussionBranchCreated).toHaveBeenCalledTimes(1);
  });

  it("creates an opposite branch from the selected discussion direction", async () => {
    const continueDiscussionDirection = vi.fn(async (): Promise<boolean> => true);
    useIdeaStore.setState({ discussionsByIdeaId: { "idea-1": [sampleDiscussion()] }, continueDiscussionDirection });
    render(<IdeaReport idea={sampleIdea()} />);

    fireEvent.click(screen.getByRole("button", { name: /激进方向 失败博物馆/ }));
    fireEvent.click(screen.getByRole("button", { name: "生成对立方向" }));

    await waitFor(() => expect(continueDiscussionDirection).toHaveBeenCalledWith("idea-1", "discussion-1", "radicalDirection", true));
  });

  it("stays in the report when continuing a discussion direction fails", async () => {
    const continueDiscussionDirection = vi.fn(async (): Promise<boolean> => false);
    const onDiscussionBranchCreated = vi.fn();
    useIdeaStore.setState({ discussionsByIdeaId: { "idea-1": [sampleDiscussion()] }, continueDiscussionDirection });
    render(<IdeaReport idea={sampleIdea()} onDiscussionBranchCreated={onDiscussionBranchCreated} />);

    fireEvent.click(screen.getByRole("button", { name: /保守方向 展签生成器/ }));
    fireEvent.click(screen.getByRole("button", { name: "沿这个方向继续" }));

    await waitFor(() => expect(continueDiscussionDirection).toHaveBeenCalledTimes(1));
    expect(onDiscussionBranchCreated).not.toHaveBeenCalled();
  });

  it("opens a focused intervention from a contribution and preserves its source", async () => {
    const respondToIdeaDiscussion = vi.fn(async (): Promise<void> => undefined);
    useIdeaStore.setState({ discussionsByIdeaId: { "idea-1": [sampleDiscussion()] }, respondToIdeaDiscussion });
    render(<IdeaReport idea={sampleIdea()} />);

    fireEvent.click(screen.getByRole("button", { name: "追问 用户代言人" }));
    const form = screen.getByRole("form", { name: "加入讨论" });
    expect(within(form).getByRole("combobox", { name: "介入动作" })).toHaveValue("question");
    expect(within(form).getByRole("combobox", { name: "回应角色" })).toHaveValue("用户代言人");
    expect(form).toHaveTextContent("我想快速看懂失败原因");
    fireEvent.change(within(form).getByRole("textbox", { name: "你的想法" }), { target: { value: "请给一个更具体的第一次使用场景" } });
    fireEvent.click(within(form).getByRole("button", { name: "请编辑部回应" }));

    await waitFor(() => expect(respondToIdeaDiscussion).toHaveBeenCalledWith("idea-1", "discussion-1", {
      type: "question",
      prompt: "请给一个更具体的第一次使用场景",
      targetRole: "用户代言人",
      sourceRole: "用户代言人",
      sourceClaim: "我想快速看懂失败原因。",
    }));
  });

  it("locks one viewpoint and opens a focused response from the lock", () => {
    useIdeaStore.setState({ discussionsByIdeaId: { "idea-1": [sampleDiscussion()] } });
    render(<IdeaReport idea={sampleIdea()} />);

    fireEvent.click(screen.getAllByRole("button", { name: "锁定观点" })[0]);
    expect(screen.getByRole("region", { name: "已锁定观点" })).toHaveTextContent("我想快速看懂失败原因");
    expect(screen.getByRole("button", { name: "解除锁定" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "让编辑部回应" }));
    expect(screen.getByRole("form", { name: "加入讨论" })).toHaveTextContent("回应观点：“我想快速看懂失败原因。”");
  });

  it("supports a free addition and renders completed interventions as editorial notes", () => {
    const discussion = sampleDiscussion();
    discussion.interventions = [{
      id: "intervention-1",
      type: "add",
      prompt: "失败也应该允许保持私密。",
      targetRole: "现实构建者",
      responses: [{ role: "现实构建者", claim: "默认私密，主动公开。", tension: "传播性会降低。" }],
      createdAt: "2026-07-10T01:00:00.000Z",
    }];
    useIdeaStore.setState({ discussionsByIdeaId: { "idea-1": [discussion] } });
    render(<IdeaReport idea={sampleIdea()} />);

    const notes = screen.getByRole("region", { name: "用户介入" });
    expect(notes).toHaveTextContent("失败也应该允许保持私密");
    expect(notes).toHaveTextContent("默认私密，主动公开");
    fireEvent.click(screen.getByRole("button", { name: "加入讨论" }));
    expect(screen.getByRole("combobox", { name: "介入动作" })).toHaveValue("add");
    expect(screen.getByRole("textbox", { name: "你的想法" })).toHaveAttribute("maxlength", "180");
  });

  it("closes intervention entry after three user interventions", () => {
    const discussion = sampleDiscussion();
    discussion.interventions = [0, 1, 2].map((index) => ({
      id: `intervention-${index}`,
      type: "add" as const,
      prompt: `补充 ${index}`,
      targetRole: "现实构建者" as const,
      responses: [{ role: "现实构建者" as const, claim: `回应 ${index}`, tension: "约束" }],
      createdAt: `2026-07-10T0${index}:00:00.000Z`,
    }));
    useIdeaStore.setState({ discussionsByIdeaId: { "idea-1": [discussion] } });
    render(<IdeaReport idea={sampleIdea()} />);

    expect(screen.queryByRole("button", { name: "加入讨论" })).not.toBeInTheDocument();
    expect(screen.getByText("本场讨论已完成 3 次用户介入")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /追问 用户代言人/ })).not.toBeInTheDocument();
  });

  it.each(["discussionResponse", "discussionBranch"] as const)("locks report actions and keeps stop available during %s", (loading) => {
    useIdeaStore.setState({ discussionsByIdeaId: { "idea-1": [sampleDiscussion()] }, loading });
    render(<IdeaReport idea={sampleIdea()} />);

    expect(screen.getByRole("button", { name: "深入验证" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /保守方向 展签生成器/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "停止讨论" })).not.toBeDisabled();
  });

  it("disables synthesis direction choices while a discussion is loading and restores them afterward", () => {
    const discussion = sampleDiscussion();
    useIdeaStore.setState({ discussionsByIdeaId: { "idea-1": [discussion] }, loading: "discussion" });
    render(<IdeaReport idea={sampleIdea()} />);

    const radical = screen.getByRole("button", { name: /激进方向 失败博物馆/ });
    expect(radical).toBeDisabled();
    act(() => useIdeaStore.setState({ loading: "idle" }));
    expect(radical).not.toBeDisabled();
  });

  it("switches between discussion history and preserves each session's collected sparks", () => {
    const older = sampleDiscussion();
    older.id = "discussion-old";
    older.createdAt = "2026-07-09T10:00:00.000Z";
    older.rounds[0]!.contributions[0]!.spark = { id: "spark-old", text: "旧场火花：给失败写墓志铭。" };
    older.synthesis!.unexpectedDirection.title = "旧场意外方向";
    older.collectedSparkIds = ["spark-old"];
    const latest = sampleDiscussion();
    latest.id = "discussion-latest";
    useIdeaStore.setState({ discussionsByIdeaId: { "idea-1": [older, latest] } });
    render(<IdeaReport idea={sampleIdea()} />);

    expect(screen.getByRole("combobox", { name: "讨论历史" })).toHaveValue("discussion-latest");
    expect(screen.queryByText("旧场意外方向")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /激进方向 失败博物馆/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "讨论历史" }), { target: { value: "discussion-old" } });

    expect(screen.getByRole("heading", { name: "旧场意外方向" })).toBeInTheDocument();
    expect(screen.getByText("旧场火花：给失败写墓志铭。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "已采集 旧场火花：给失败写墓志铭。" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /意外方向 旧场意外方向/ })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: /意外方向 旧场意外方向/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "讨论历史" }), { target: { value: "discussion-latest" } });
    expect(screen.getByRole("button", { name: /激进方向 失败博物馆/ })).toHaveAttribute("aria-pressed", "true");
  });
});
