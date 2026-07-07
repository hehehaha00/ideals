// 这个文件验证前端 AI 服务层能读取本地代理流式结果，并在失败时 fallback。
import { describe, expect, it, vi } from "vitest";
import { generateIdeas, generateWords, transformIdea } from "./ideaApi";

describe("ideaApi", () => {
  it("reads dimension groups from the streaming local API", async () => {
    const progress: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response('event: delta\ndata: 正在生成维度词\n\nevent: done\ndata: {"groups":[{"type":"人群","label":"人群","description":"谁会使用","words":[{"id":"w1","text":"独立开发者","groupType":"人群","locked":false,"selected":true,"source":"AI"}]}]}\n\n', {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      ),
    );

    const groups = await generateWords({ topic: "开发者工具", intensity: "正常", onProgress: (text) => progress.push(text) });

    expect(groups[0]?.words[0]?.source).toBe("AI");
    expect(progress.join("")).toContain("正在生成维度词");
    vi.unstubAllGlobals();
  });

  it("falls back to local words when the local API fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network failed")));
    const groups = await generateWords({ topic: "我没有项目灵感", intensity: "正常" });

    expect(groups).toHaveLength(6);
    expect(groups[0]?.words).toHaveLength(8);
    vi.unstubAllGlobals();
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
