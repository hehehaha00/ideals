// 这个文件验证 AI 响应缓存，减少重复主题反复消耗请求。
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createCacheKey, ResponseCache } from "./responseCache";

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

  it("evicts the least recently used value when max entries is reached", () => {
    const cache = new ResponseCache<string>(10_000, 2);
    cache.set("a", "A", 100);
    cache.set("b", "B", 200);
    expect(cache.get("a", 300)).toBe("A");

    cache.set("c", "C", 400);

    expect(cache.get("a", 500)).toBe("A");
    expect(cache.get("b", 500)).toBeUndefined();
    expect(cache.get("c", 500)).toBe("C");
  });

  it("creates stable hashed keys for equivalent payload objects", () => {
    const first = createCacheKey("map", "gpt-5.5", { topic: "开发者工具", options: { b: 2, a: 1 } });
    const second = createCacheKey("map", "gpt-5.5", { options: { a: 1, b: 2 }, topic: "开发者工具" });

    expect(first).toBe(second);
    expect(first.length).toBeLessThan(90);
  });

  it("creates stable keys for undefined payloads", () => {
    expect(() => createCacheKey("map", "gpt-5.5", undefined)).not.toThrow();
  });

  it("separates cache keys by operation and model", () => {
    const payload = { topic: "开发者工具" };
    const mapKey = createCacheKey("map", "gpt-5.5", payload);
    const wordsKey = createCacheKey("words", "gpt-5.5", payload);
    const otherModelKey = createCacheKey("map", "gpt-5.4", payload);

    expect(mapKey).not.toBe(wordsKey);
    expect(mapKey).not.toBe(otherModelKey);
  });
});
