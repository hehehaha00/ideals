// 这个文件验证本地 AI 代理只向允许的网页来源开放。
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { applyOriginPolicy, parseAllowedOrigins } from "./originPolicy";

describe("originPolicy", () => {
  it("uses local Vite and preview origins by default", () => {
    expect(parseAllowedOrigins(undefined)).toEqual([
      "http://127.0.0.1:5173",
      "http://localhost:5173",
      "http://127.0.0.1:4173",
      "http://localhost:4173",
    ]);
  });

  it("parses and de-duplicates configured origins", () => {
    expect(parseAllowedOrigins(" https://ideas.example.com, http://127.0.0.1:5173,https://ideas.example.com ")).toEqual([
      "https://ideas.example.com",
      "http://127.0.0.1:5173",
    ]);
  });

  it("writes a concrete CORS origin and Vary header for an allowed request", () => {
    const headers = new Map<string, string>();
    const result = applyOriginPolicy("http://127.0.0.1:5173", ["http://127.0.0.1:5173"], (name, value) => headers.set(name, value));

    expect(result).toEqual({ allowed: true, browserOrigin: true });
    expect(headers.get("Access-Control-Allow-Origin")).toBe("http://127.0.0.1:5173");
    expect(headers.get("Vary")).toBe("Origin");
  });

  it("rejects an external browser origin without writing an allow-origin header", () => {
    const headers = new Map<string, string>();
    const result = applyOriginPolicy("https://evil.example", ["http://127.0.0.1:5173"], (name, value) => headers.set(name, value));

    expect(result).toEqual({ allowed: false, browserOrigin: true });
    expect(headers.has("Access-Control-Allow-Origin")).toBe(false);
    expect(headers.get("Vary")).toBe("Origin");
  });

  it("allows requests without Origin without adding browser CORS headers", () => {
    const headers = new Map<string, string>();
    const result = applyOriginPolicy(undefined, ["http://127.0.0.1:5173"], (name, value) => headers.set(name, value));

    expect(result).toEqual({ allowed: true, browserOrigin: false });
    expect(headers.size).toBe(0);
  });
});
