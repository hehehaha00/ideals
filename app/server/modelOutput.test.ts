// 这个文件验证模型输出解析和结构校验，避免脏 JSON 进入前端。
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { normalizeIdeaCards, normalizeWordGroups, parseModelJson } from "./modelOutput";

describe("modelOutput", () => {
  it("parses JSON from fenced model output", () => {
    const parsed = parseModelJson("```json\n{\"ok\":true}\n```");

    expect(parsed).toEqual({ ok: true });
  });

  it("normalizes word groups into app-ready dimension groups", () => {
    const groups = normalizeWordGroups({
      groups: [
        { type: "人群", words: [{ text: "独立开发者", source: "联想扩散" }] },
        { type: "场景", words: [{ text: "深夜", source: "场景联想" }] },
        { type: "情绪", words: [{ text: "烂尾焦虑", source: "情绪抽取" }] },
        { type: "物件", words: [{ text: "GitHub 仓库", source: "物件映射" }] },
        { type: "结构", words: [{ text: "博物馆", source: "类比迁移" }] },
        { type: "限制", words: [{ text: "只能提问", source: "约束变形" }] },
      ],
    });

    expect(groups).toHaveLength(6);
    expect(groups[0]?.words[0]?.selected).toBe(true);
    expect(groups[0]?.words[0]?.source).toBe("联想扩散");
  });

  it("normalizes idea cards and rejects empty output", () => {
    const sourceWords = normalizeWordGroups({
      groups: [
        { type: "人群", words: [{ text: "独立开发者" }] },
        { type: "场景", words: [{ text: "深夜" }] },
        { type: "情绪", words: [{ text: "烂尾焦虑" }] },
        { type: "物件", words: [{ text: "GitHub 仓库" }] },
        { type: "结构", words: [{ text: "博物馆" }] },
        { type: "限制", words: [{ text: "只能提问" }] },
      ],
    }).map((group) => group.words[0]);

    const ideas = normalizeIdeaCards(
      {
        ideas: [
          {
            title: "项目遗迹馆",
            summary: "扫描废弃项目并生成展签。",
            whyInteresting: "它把失败经验变成可浏览资产。",
            firstVersion: "先做 GitHub 仓库扫描和卡片生成。",
          },
        ],
      },
      sourceWords,
    );

    expect(ideas[0]?.sourceWords).toHaveLength(6);
    expect(() => normalizeIdeaCards({ ideas: [] }, sourceWords)).toThrow("模型没有返回可用脑洞");
  });
});
