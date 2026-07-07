// 这个文件验证 AI 响应缓存，减少重复主题反复消耗请求。
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ResponseCache } from "./responseCache";

describe("ResponseCache", () => {
  it("returns cached values before ttl expires", () => {
    const cache = new ResponseCache<string>(1000);
    cache.set("a", "cached", 100);

    expect(cache.get("a", 500)).toBe("cached");
  });

  it("expires cached values after ttl", () => {
    const cache = new ResponseCache<string>(1000);
    cache.set("a", "cached", 100);

    expect(cache.get("a", 1200)).toBeUndefined();
  });
});
