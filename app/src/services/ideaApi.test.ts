// 这个文件验证 AI 服务层在接口不可用时会自动使用本地 fallback。
import { describe, expect, it, vi } from "vitest";
import { generateIdeas, generateWords, transformIdea } from "./ideaApi";

describe("ideaApi", () => {
  it("falls back to local words when no API endpoint is configured", async () => {
    const groups = await generateWords({ topic: "我没有项目灵感", intensity: "正常" });

    expect(groups).toHaveLength(6);
    expect(groups[0]?.words).toHaveLength(8);
  });

  it("falls back to local ideas when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network failed")));
    const groups = await generateWords({ topic: "开发者工具", intensity: "正常" });
    const ideas = await generateIdeas({ topic: "开发者工具", sourceWords: groups.map((group) => group.words[0]) });

    expect(ideas.length).toBeGreaterThanOrEqual(3);
    expect(ideas[0]?.sourceWords).toHaveLength(6);
    vi.unstubAllGlobals();
  });

  it("transforms an idea through fallback when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network failed")));
    const groups = await generateWords({ topic: "内容选题", intensity: "轻微" });
    const ideas = await generateIdeas({ topic: "内容选题", sourceWords: groups.map((group) => group.words[0]) });
    const transformed = await transformIdea({ idea: ideas[0], direction: "只保留核心隐喻" });

    expect(transformed.parentId).toBe(ideas[0]?.id);
    expect(transformed.transformDirection).toBe("只保留核心隐喻");
    vi.unstubAllGlobals();
  });
});
