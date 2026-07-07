// 这个文件读取本地 AI 代理配置，密钥只来自环境变量或未提交的 .env.local。
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RelayConfig } from "./relayClient";

export interface ServerConfig extends RelayConfig {
  port: number;
  cacheTtlMs: number;
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
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

// 读取服务端配置。
export function loadServerConfig(): ServerConfig {
  loadEnvFile();

  return {
    baseUrl: process.env.IDEA_AI_BASE_URL ?? "https://sub2.congmingai.com",
    apiKey: process.env.IDEA_AI_API_KEY ?? "",
    model: process.env.IDEA_AI_MODEL ?? "gpt-5.5",
    timeoutMs: Number(process.env.IDEA_AI_TIMEOUT_MS ?? 60_000),
    port: Number(process.env.IDEA_API_PORT ?? 8787),
    cacheTtlMs: Number(process.env.IDEA_AI_CACHE_TTL_MS ?? 10 * 60_000),
  };
}
