// 这个文件验证工作区导出的 JSON、Markdown、文件名和浏览器下载行为。
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BrainstormMap, IdeaCard, IdeaRefinement } from "../types/idea";
import {
  buildDownloadFileName,
  createTextDownload,
  exportIdeaReportMarkdown,
  exportMindMapJson,
} from "./workspaceExport";

// 创建包含可选字段的完整导图样本，用于验证导出不丢数据。
function createBrainstormMap(): BrainstormMap {
  const center: BrainstormMap["center"] = {
    id: "center",
    label: "周末项目",
    category: "中心",
    level: 0,
    x: 640,
    y: 360,
    selectable: false,
    locked: true,
    selected: false,
    reason: "中心主题",
    source: "用户输入",
  };

  return {
    id: "map-1",
    topic: "周末项目",
    stuckType: "有兴趣没形态",
    center,
    nodes: [
      center,
      {
        id: "node-1",
        label: "烂尾焦虑",
        category: "情绪",
        level: 1,
        x: 820,
        y: 280,
        selectable: true,
        locked: false,
        selected: true,
        reason: "给项目加入明确情绪",
        source: "AI 发散",
        parentId: center.id,
        collapsed: true,
      },
    ],
    edges: [{ id: "edge-1", from: center.id, to: "node-1", label: "情绪" }],
    recommendedNodeIds: ["node-1"],
    createdAt: "2026-07-11T08:00:00.000Z",
  };
}

// 创建带来源路径的脑洞样本，供基础报告和炼化报告共用。
function createIdea(): IdeaCard {
  return {
    id: "idea-1",
    title: "烂尾项目博物馆",
    summary: "把没有做完的项目变成可以参观的数字展品。",
    whyInteresting: "让失败经验从负担变成可以展示和复用的资产。",
    firstVersion: "粘贴项目说明，生成一张带展签的项目卡片。",
    sourceWords: [
      {
        id: "word-1",
        text: "烂尾焦虑",
        groupType: "情绪",
        locked: false,
        selected: true,
        source: "mind-map",
      },
    ],
    sourcePath: ["周末项目", "情绪", "烂尾焦虑"],
    createdAt: "2026-07-11T08:05:00.000Z",
  };
}

// 创建覆盖生命力、三种方向、执行时间线和编辑批注的炼化样本。
function createRefinement(): IdeaRefinement {
  return {
    id: "refinement-1",
    ideaId: "idea-1",
    vitality: {
      targetUser: "有多个烂尾项目的独立开发者",
      triggerScene: "整理旧仓库但舍不得删除时",
      coreEmotion: "把遗憾重新变成成就感",
      existingAlternative: "手写复盘或直接归档仓库",
      smallestPlayableVersion: "输入项目名后生成一张展签",
    },
    directions: [
      {
        type: "玩具版",
        title: "项目墓志铭",
        description: "生成一张荒诞展签。",
        firstStep: "手动填写一个旧项目。",
      },
      {
        type: "工具版",
        title: "烂尾复盘器",
        description: "整理项目留下的经验。",
        firstStep: "读取一份 README。",
      },
      {
        type: "产品版",
        title: "数字项目博物馆",
        description: "建立可以分享的项目展馆。",
        firstStep: "发布一个公开展品页。",
      },
    ],
    mvpLadder: [
      { horizon: "1小时 MVP", goal: "验证展签是否有趣", build: "手工生成卡片", proof: "用户愿意截图" },
      { horizon: "1天 MVP", goal: "验证项目输入", build: "增加 README 表单", proof: "用户完成生成" },
      { horizon: "一周版本", goal: "验证分享需求", build: "建立公开展馆", proof: "用户主动分享" },
    ],
    roundtable: [
      { role: "毒舌用户", feedback: "别只把 README 换个标题。" },
      { role: "工程师", feedback: "第一版只读取公开仓库。" },
    ],
    actions: [],
    createdAt: "2026-07-11T08:10:00.000Z",
  };
}

afterEach((): void => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("exportMindMapJson", () => {
  it("用两个空格格式化并完整保留导图", () => {
    const map: BrainstormMap = createBrainstormMap();

    const exported: string = exportMindMapJson(map);

    expect(exported).toBe(JSON.stringify(map, null, 2));
    expect(JSON.parse(exported)).toEqual(map);
  });
});

describe("exportIdeaReportMarkdown", () => {
  it("没有炼化结果时仍输出完整的基础报告", () => {
    const markdown: string = exportIdeaReportMarkdown(createIdea());

    expect(markdown).toContain("# 烂尾项目博物馆");
    expect(markdown).toContain("## 一句话");
    expect(markdown).toContain("把没有做完的项目变成可以参观的数字展品。");
    expect(markdown).toContain("## 来源路径");
    expect(markdown).toContain("周末项目 -> 情绪 -> 烂尾焦虑");
    expect(markdown).toContain("## 为什么值得做");
    expect(markdown).toContain("让失败经验从负担变成可以展示和复用的资产。");
    expect(markdown).toContain("## 第一版");
    expect(markdown).toContain("粘贴项目说明，生成一张带展签的项目卡片。");
    expect(markdown).not.toContain("## 生命力");
  });

  it("有炼化结果时输出生命力、三种方向、时间线和编辑部批注", () => {
    const markdown: string = exportIdeaReportMarkdown(createIdea(), createRefinement());

    expect(markdown).toContain("## 生命力");
    expect(markdown).toContain("**目标用户：** 有多个烂尾项目的独立开发者");
    expect(markdown).toContain("**触发场景：** 整理旧仓库但舍不得删除时");
    expect(markdown).toContain("**核心情绪：** 把遗憾重新变成成就感");
    expect(markdown).toContain("**已有替代：** 手写复盘或直接归档仓库");
    expect(markdown).toContain("**最小可玩：** 输入项目名后生成一张展签");
    expect(markdown).toContain("## 三种方向");
    expect(markdown).toContain("### 玩具版：项目墓志铭");
    expect(markdown).toContain("### 工具版：烂尾复盘器");
    expect(markdown).toContain("### 产品版：数字项目博物馆");
    expect(markdown).toContain("## 1小时 / 1天 / 一周");
    expect(markdown).toContain("### 1小时 MVP");
    expect(markdown).toContain("### 1天 MVP");
    expect(markdown).toContain("### 一周版本");
    expect(markdown).toContain("## 编辑部批注");
    expect(markdown).toContain("> **毒舌用户：** 别只把 README 换个标题。");
    expect(markdown).toContain("> **工程师：** 第一版只读取公开仓库。");
  });

  it("来源路径缺失时使用来源词补足基本报告", () => {
    const idea: IdeaCard = { ...createIdea(), sourcePath: undefined };

    const markdown: string = exportIdeaReportMarkdown(idea);

    expect(markdown).toContain("烂尾焦虑");
  });
});

describe("buildDownloadFileName", () => {
  it("移除 Windows 非法字符并压缩空格", () => {
    const fileName: string = buildDownloadFileName("  灵感   /   星球: ", "<实验>*  ?\u0000", ".md");

    expect(fileName).toBe("灵感 星球-实验.md");
  });

  it("空内容回退到 idea-lab", () => {
    expect(buildDownloadFileName(" <> ", " ?* ", "json")).toBe("idea-lab.json");
    expect(buildDownloadFileName("", "", "")).toBe("idea-lab");
  });

  it("包含扩展名的总长度不超过八十个字符", () => {
    const fileName: string = buildDownloadFileName("灵感实验室", "很长的脑洞标题".repeat(20), "markdown");

    expect(fileName.length).toBeLessThanOrEqual(80);
    expect(fileName).toMatch(/\.markdown$/);
  });

  it("截断后成为 Windows 保留名时重新添加安全前缀", () => {
    const longTitle: string = `CON-${"超长标题".repeat(20)}`;
    const longExtension: string = "x".repeat(76);

    const fileName: string = buildDownloadFileName("", longTitle, longExtension);

    expect(fileName).toMatch(/^idea-lab-CON\./);
    expect(fileName.length).toBeLessThanOrEqual(80);
  });
});

describe("createTextDownload", () => {
  it("创建文本 Blob、点击下载链接并释放临时地址", () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:idea-report");
    const revokeObjectURL = vi.fn<(url: string) => void>();
    const clickedAnchors: HTMLAnchorElement[] = [];
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement): void {
      clickedAnchors.push(this);
    });

    createTextDownload("# 脑洞报告", "脑洞报告.md", "text/markdown;charset=utf-8");

    expect(createObjectURL).toHaveBeenCalledOnce();
    const blob: Blob | undefined = createObjectURL.mock.calls[0]?.[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob?.type).toBe("text/markdown;charset=utf-8");
    expect(blob?.size).toBe(new Blob(["# 脑洞报告"]).size);
    expect(clickedAnchors).toHaveLength(1);
    expect(clickedAnchors[0]?.href).toBe("blob:idea-report");
    expect(clickedAnchors[0]?.download).toBe("脑洞报告.md");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:idea-report");
  });
});
