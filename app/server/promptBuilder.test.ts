// 这个文件验证提示词拼接和上下文压缩，避免把过长输入直接塞给模型。
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildIdeasPrompt, buildTransformPrompt, buildWordsPrompt, compressText } from "./promptBuilder";

describe("promptBuilder", () => {
  it("compresses long text with a clear length limit", () => {
    const longText = "灵感".repeat(500);
    const compressed = compressText(longText, 80);

    expect(compressed.length).toBeLessThanOrEqual(81);
    expect(compressed.endsWith("…")).toBe(true);
  });

  it("builds a JSON-only words prompt with human divergence modes", () => {
    const prompt = buildWordsPrompt({ topic: "我想做一个开发者工具", intensity: "狂野" });

    expect(prompt.system).toContain("只输出 JSON");
    expect(prompt.user).toContain("联想扩散");
    expect(prompt.user).toContain("概念融合");
    expect(prompt.user).toContain("六类维度词");
  });

  it("builds idea and transform prompts with compact source context", () => {
    const sourceWords = [
      { id: "1", text: "独立开发者", groupType: "人群", locked: false, selected: true, source: "test" },
      { id: "2", text: "深夜", groupType: "场景", locked: false, selected: true, source: "test" },
      { id: "3", text: "烂尾焦虑", groupType: "情绪", locked: false, selected: true, source: "test" },
      { id: "4", text: "GitHub 仓库", groupType: "物件", locked: false, selected: true, source: "test" },
      { id: "5", text: "博物馆", groupType: "结构", locked: false, selected: true, source: "test" },
      { id: "6", text: "不能催用户继续做", groupType: "限制", locked: false, selected: true, source: "test" },
    ] as const;
    const ideasPrompt = buildIdeasPrompt({ topic: "项目灵感", sourceWords: [...sourceWords] });
    const transformPrompt = buildTransformPrompt({
      direction: "更游戏化一点",
      idea: {
        id: "idea",
        title: "项目遗迹馆",
        summary: "把废弃仓库做成遗迹。",
        whyInteresting: "它把失败变成可浏览的资产。",
        firstVersion: "扫描仓库并生成展签。",
        sourceWords: [...sourceWords],
        createdAt: "2026-07-07T00:00:00.000Z",
      },
    });

    expect(ideasPrompt.user).toContain("项目灵感");
    expect(ideasPrompt.user).toContain("GitHub 仓库");
    expect(transformPrompt.user).toContain("更游戏化一点");
    expect(transformPrompt.user).toContain("项目遗迹馆");
  });
});
