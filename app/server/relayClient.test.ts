// 这个文件验证 OpenAI 兼容中转站响应解析，避免流式格式变化时直接影响业务。
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { extractDeltaContent, extractMessageContent, normalizeBaseUrl } from "./relayClient";

describe("relayClient", () => {
  it("normalizes relay base url without trailing slash", () => {
    expect(normalizeBaseUrl("https://sub2.congmingai.com/")).toBe("https://sub2.congmingai.com");
  });

  it("extracts content from non-stream chat completion", () => {
    const content = extractMessageContent({
      choices: [
        {
          message: {
            content: "{\"ok\":true}",
          },
        },
      ],
    });

    expect(content).toBe("{\"ok\":true}");
  });

  it("extracts delta content from stream chunk", () => {
    const content = extractDeltaContent({
      choices: [
        {
          delta: {
            content: "片段",
          },
        },
      ],
    });

    expect(content).toBe("片段");
  });
});
