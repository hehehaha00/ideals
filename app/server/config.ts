// 这个文件读取本地 AI 代理配置，密钥只来自环境变量或未提交的 .env.local。
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RelayConfig } from "./relayClient";
import { parseAllowedOrigins } from "./originPolicy";
import { resolveProvider } from "./providers";

export interface ServerConfig extends RelayConfig {
  provider: string;
  port: number;
  cacheTtlMs: number;
  cacheMaxEntries: number;
  maxConcurrentRequests: number;
  maxQueuedRequests: number;
  requestDeadlineMs: number;
  allowedOrigins: string[];
}

function readIntegerEnv(name: string, fallback: number, min: number, max = Number.MAX_SAFE_INTEGER): number {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue.trim().length === 0) {
    return fallback;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function readStringEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

// 读取非空环境变量；空值视为未配置，便于提供商 key 走预设变量。
function readOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

// 读取 .env.local，但不覆盖已存在环境变量。
export function loadEnvFile(filePath = resolve(process.cwd(), ".env.local")): void {
  if (!existsSync(filePath)) {
    return;
  }

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    // 空字符串也是调用方的明确配置，不能被本地文件覆盖。
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

// 读取服务端配置。
export function loadServerConfig(): ServerConfig {
  loadEnvFile();

  const provider = resolveProvider(process.env.IDEA_AI_PROVIDER);
  const providerId = provider.id;
  const keyEnv = readStringEnv("IDEA_AI_KEY_ENV", provider.keyEnv);

  return {
    provider: providerId,
    baseUrl: readStringEnv("IDEA_AI_BASE_URL", provider.baseUrl),
    apiKey: readOptionalEnv("IDEA_AI_API_KEY") ?? readOptionalEnv(keyEnv) ?? "",
    model: readStringEnv("IDEA_AI_MODEL", provider.model),
    timeoutMs: readIntegerEnv("IDEA_AI_TIMEOUT_MS", 60_000, 1),
    retryCount: readIntegerEnv("IDEA_AI_RETRY_COUNT", 2, 0),
    retryBaseDelayMs: readIntegerEnv("IDEA_AI_RETRY_BASE_DELAY_MS", 350, 0),
    proxyUrl: process.env.IDEA_AI_PROXY_URL || undefined,
    port: readIntegerEnv("IDEA_API_PORT", 8787, 1, 65_535),
    cacheTtlMs: readIntegerEnv("IDEA_AI_CACHE_TTL_MS", 10 * 60_000, 1),
    cacheMaxEntries: readIntegerEnv("IDEA_AI_CACHE_MAX_ENTRIES", 200, 1),
    maxConcurrentRequests: readIntegerEnv("IDEA_AI_MAX_CONCURRENCY", 3, 1),
    maxQueuedRequests: readIntegerEnv("IDEA_AI_MAX_QUEUED_REQUESTS", 12, 0),
    requestDeadlineMs: readIntegerEnv("IDEA_AI_REQUEST_DEADLINE_MS", 90_000, 1),
    allowedOrigins: parseAllowedOrigins(process.env.IDEA_APP_ORIGINS),
  };
}
