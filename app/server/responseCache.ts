// 这个文件提供简单内存缓存，用来减少重复 AI 请求。
import { createHash } from "node:crypto";

interface CacheEntry<TValue> {
  value: TValue;
  createdAt: number;
}

interface CacheRead<TValue> {
  value: TValue;
}

function normalizePositiveInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

// 按 TTL 读取和写入缓存。
export class ResponseCache<TValue> {
  private readonly entries = new Map<string, CacheEntry<TValue>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  public constructor(ttlMs: number, maxEntries = 200) {
    this.ttlMs = normalizePositiveInteger(ttlMs, 1);
    this.maxEntries = normalizePositiveInteger(maxEntries, 200);
  }

  // 读取缓存，过期时自动删除。
  public get(key: string, now = Date.now()): TValue | undefined {
    return this.getEntry(key, now)?.value;
  }

  // 读取缓存命中对象，允许 false、0、空字符串等值被正确识别为命中。
  public getEntry(key: string, now = Date.now()): CacheRead<TValue> | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }

    if (now - entry.createdAt > this.ttlMs) {
      this.entries.delete(key);
      return undefined;
    }

    this.entries.delete(key);
    this.entries.set(key, entry);
    return { value: entry.value };
  }

  // 写入缓存。
  public set(key: string, value: TValue, now = Date.now()): void {
    if (this.entries.has(key)) {
      this.entries.delete(key);
    }
    this.entries.set(key, { value, createdAt: now });

    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (!oldestKey) {
        break;
      }
      this.entries.delete(oldestKey);
    }
  }
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? String(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(",")}}`;
}

// 生成稳定缓存 key，避免同样上下文重复请求模型。
export function createCacheKey(operation: string, model: string, payload: unknown): string {
  const hash = createHash("sha256").update(stableSerialize(payload)).digest("hex").slice(0, 32);
  return `${operation}:${model}:${hash}`;
}
