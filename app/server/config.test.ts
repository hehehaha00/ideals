// 这个文件验证服务端配置会把错误的环境变量收敛成安全值。
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadServerConfig } from "./config";

describe("loadServerConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to finite defaults for invalid numeric env values", () => {
    vi.stubEnv("IDEA_AI_TIMEOUT_MS", "abc");
    vi.stubEnv("IDEA_AI_RETRY_COUNT", "abc");
    vi.stubEnv("IDEA_AI_RETRY_BASE_DELAY_MS", "abc");
    vi.stubEnv("IDEA_API_PORT", "abc");
    vi.stubEnv("IDEA_AI_CACHE_TTL_MS", "abc");
    vi.stubEnv("IDEA_AI_CACHE_MAX_ENTRIES", "abc");
    vi.stubEnv("IDEA_AI_MAX_CONCURRENCY", "abc");
    vi.stubEnv("IDEA_AI_MAX_QUEUED_REQUESTS", "abc");
    vi.stubEnv("IDEA_AI_REQUEST_DEADLINE_MS", "abc");
    vi.stubEnv("IDEA_APP_ORIGINS", "");

    const config = loadServerConfig();

    expect(config.timeoutMs).toBe(60_000);
    expect(config.retryCount).toBe(2);
    expect(config.retryBaseDelayMs).toBe(350);
    expect(config.port).toBe(8787);
    expect(config.cacheTtlMs).toBe(10 * 60_000);
    expect(config.cacheMaxEntries).toBe(200);
    expect(config.maxConcurrentRequests).toBe(3);
    expect(config.maxQueuedRequests).toBe(12);
    expect(config.requestDeadlineMs).toBe(90_000);
    expect(config.allowedOrigins).toEqual([
      "http://127.0.0.1:5173",
      "http://localhost:5173",
      "http://127.0.0.1:4173",
      "http://localhost:4173",
      "http://127.0.0.1:5191",
      "http://localhost:5191",
      "http://127.0.0.1:5193",
      "http://localhost:5193",
    ]);
  });

  it("clamps numeric env values that would disable queues or cache bounds", () => {
    vi.stubEnv("IDEA_AI_TIMEOUT_MS", "0");
    vi.stubEnv("IDEA_AI_RETRY_COUNT", "-1");
    vi.stubEnv("IDEA_AI_RETRY_BASE_DELAY_MS", "-1");
    vi.stubEnv("IDEA_API_PORT", "99999");
    vi.stubEnv("IDEA_AI_CACHE_TTL_MS", "0");
    vi.stubEnv("IDEA_AI_CACHE_MAX_ENTRIES", "0");
    vi.stubEnv("IDEA_AI_MAX_CONCURRENCY", "0");
    vi.stubEnv("IDEA_AI_MAX_QUEUED_REQUESTS", "-1");
    vi.stubEnv("IDEA_AI_REQUEST_DEADLINE_MS", "0");

    const config = loadServerConfig();

    expect(config.timeoutMs).toBe(1);
    expect(config.retryCount).toBe(0);
    expect(config.retryBaseDelayMs).toBe(0);
    expect(config.port).toBe(65_535);
    expect(config.cacheTtlMs).toBe(1);
    expect(config.cacheMaxEntries).toBe(1);
    expect(config.maxConcurrentRequests).toBe(1);
    expect(config.maxQueuedRequests).toBe(0);
    expect(config.requestDeadlineMs).toBe(1);
  });

  it("normalizes empty string relay settings to safe defaults", () => {
    vi.stubEnv("IDEA_AI_BASE_URL", "");
    vi.stubEnv("IDEA_AI_MODEL", "");

    const config = loadServerConfig();

    expect(config.baseUrl).toBe("https://api.openai.com");
    expect(config.model).toBe("gpt-5.2");
  });

  it("resolves a provider preset and its provider-specific key", () => {
    vi.stubEnv("IDEA_AI_PROVIDER", "deepseek");
    vi.stubEnv("IDEA_AI_BASE_URL", "");
    vi.stubEnv("IDEA_AI_MODEL", "");
    vi.stubEnv("IDEA_AI_API_KEY", "");
    vi.stubEnv("DEEPSEEK_API_KEY", "deepseek-test-key");

    const config = loadServerConfig();

    expect(config.provider).toBe("deepseek");
    expect(config.baseUrl).toBe("https://api.deepseek.com");
    expect(config.model).toBe("deepseek-v4-flash");
    expect(config.apiKey).toBe("deepseek-test-key");
  });

  it("allows generic settings to override a provider preset", () => {
    vi.stubEnv("IDEA_AI_PROVIDER", "openai");
    vi.stubEnv("IDEA_AI_BASE_URL", "https://gateway.example.com");
    vi.stubEnv("IDEA_AI_MODEL", "example-model");
    vi.stubEnv("IDEA_AI_API_KEY", "generic-key");

    const config = loadServerConfig();

    expect(config.baseUrl).toBe("https://gateway.example.com");
    expect(config.model).toBe("example-model");
    expect(config.apiKey).toBe("generic-key");
  });

  it("reads a configured browser origin allowlist", () => {
    vi.stubEnv("IDEA_APP_ORIGINS", "https://ideas.example.com, http://127.0.0.1:5173");

    const config = loadServerConfig();

    expect(config.allowedOrigins).toEqual(["https://ideas.example.com", "http://127.0.0.1:5173"]);
  });
});
