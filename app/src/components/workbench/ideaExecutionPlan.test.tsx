// 这个文件验证决策简报和执行计划的关键信息与可访问交互。
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { IdeaCard, IdeaExecutionPlan, IdeaRefinement } from "../../types/idea";
import { IdeaDecisionBrief } from "./IdeaDecisionBrief";
import { IdeaExecutionPlan as IdeaExecutionPlanView } from "./IdeaExecutionPlan";

const idea: IdeaCard = {
  id: "idea-1",
  title: "项目遗迹馆",
  summary: "把烂尾项目变成展品。",
  whyInteresting: "让失败经验变成可浏览的资产。",
  firstVersion: "先生成一张项目展签。",
  sourceWords: [],
  createdAt: "2026-07-10T00:00:00.000Z",
};

const refinement: IdeaRefinement = {
  id: "refinement-1",
  ideaId: idea.id,
  vitality: {
    targetUser: "独立开发者",
    triggerScene: "周日晚上",
    coreEmotion: "烂尾焦虑",
    existingAlternative: "归档仓库",
    smallestPlayableVersion: "生成一张展签",
  },
  roundtable: [],
  directions: [],
  mvpLadder: [
    { horizon: "1小时 MVP", goal: "验证有人愿意看", build: "输入仓库地址生成展签", proof: "邀请 3 人截图反馈" },
    { horizon: "1天 MVP", goal: "验证输入稳定", build: "读取 README", proof: "连续生成不重复" },
    { horizon: "一周版本", goal: "验证分享", build: "公开分享页", proof: "有人主动转发" },
  ],
  actions: [],
  createdAt: "2026-07-10T00:00:00.000Z",
};

const plan: IdeaExecutionPlan = {
  ideaId: idea.id,
  createdAt: "2026-07-10T00:00:00.000Z",
  updatedAt: "2026-07-10T00:00:00.000Z",
  tasks: refinement.mvpLadder.map((step, index) => ({ ...step, id: `task-${index + 1}`, completed: index === 1 })),
};

describe("idea execution plan views", () => {
  it("首屏连续展示目标用户、核心价值、最大未知和第一项实验", () => {
    render(<IdeaDecisionBrief idea={idea} refinement={refinement} />);

    expect(screen.getByText("目标用户")).toBeInTheDocument();
    expect(screen.getByText("独立开发者")).toBeInTheDocument();
    expect(screen.getByText("核心价值")).toBeInTheDocument();
    expect(screen.getByText("让失败经验变成可浏览的资产。")).toBeInTheDocument();
    expect(screen.getByText("最大未知")).toBeInTheDocument();
    expect(screen.getByText("验证有人愿意看")).toBeInTheDocument();
    expect(screen.getByText("第一项实验")).toBeInTheDocument();
    expect(screen.getByText("输入仓库地址生成展签")).toBeInTheDocument();
  });

  it("用可访问复选框展示三段计划并把切换交给调用方", () => {
    const onToggle = vi.fn();
    render(<IdeaExecutionPlanView plan={plan} onToggle={onToggle} />);

    expect(screen.getByText("1小时 MVP")).toBeInTheDocument();
    expect(screen.getByText("1天 MVP")).toBeInTheDocument();
    expect(screen.getByText("一周版本")).toBeInTheDocument();
    expect(screen.getByText("验证标准")).toBeInTheDocument();
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(3);
    expect(checkboxes[1]).toBeChecked();

    fireEvent.click(checkboxes[0]!);
    expect(onToggle).toHaveBeenCalledWith("task-1");
  });
});
