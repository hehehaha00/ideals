// 这个文件验证本地灵感引擎在没有 AI 接口时也能完整工作。
import { describe, expect, it } from "vitest";
import { DIMENSION_GROUPS } from "../types/idea";
import { generateFallbackIdeas, generateFallbackWords, transformFallbackIdea } from "./ideaEngine";

describe("ideaEngine", () => {
  it("generates six dimension groups with eight words each", () => {
    const groups = generateFallbackWords("我想做一个有趣的开发者工具", "正常");

    expect(groups).toHaveLength(6);
    expect(groups.map((group) => group.type)).toEqual(DIMENSION_GROUPS);
    for (const group of groups) {
      expect(group.words).toHaveLength(8);
      expect(group.words.every((word) => word.groupType === group.type)).toBe(true);
    }
  });

  it("generates idea cards from selected words", () => {
    const groups = generateFallbackWords("开发者工具", "狂野");
    const selectedWords = groups.map((group) => group.words[0]);
    const ideas = generateFallbackIdeas("开发者工具", selectedWords);

    expect(ideas.length).toBeGreaterThanOrEqual(3);
    expect(ideas.length).toBeLessThanOrEqual(5);
    expect(ideas[0]?.sourceWords).toHaveLength(6);
    expect(ideas[0]?.title.length).toBeGreaterThan(0);
  });

  it("transforms an idea while preserving source words", () => {
    const groups = generateFallbackWords("内容创作", "轻微");
    const idea = generateFallbackIdeas("内容创作", groups.map((group) => group.words[0]))[0];
    const transformed = transformFallbackIdea(idea, "更游戏化一点");

    expect(transformed.id).not.toBe(idea.id);
    expect(transformed.parentId).toBe(idea.id);
    expect(transformed.sourceWords).toEqual(idea.sourceWords);
    expect(transformed.transformDirection).toBe("更游戏化一点");
  });
});
