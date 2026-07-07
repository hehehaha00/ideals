// 这个文件提供简单内存缓存，用来减少重复 AI 请求。

interface CacheEntry<TValue> {
  value: TValue;
  createdAt: number;
}

// 按 TTL 读取和写入缓存。
export class ResponseCache<TValue> {
  private readonly entries = new Map<string, CacheEntry<TValue>>();

  public constructor(private readonly ttlMs: number) {}

  // 读取缓存，过期时自动删除。
  public get(key: string, now = Date.now()): TValue | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }

    if (now - entry.createdAt > this.ttlMs) {
      this.entries.delete(key);
      return undefined;
    }

    return entry.value;
  }

  // 写入缓存。
  public set(key: string, value: TValue, now = Date.now()): void {
    this.entries.set(key, { value, createdAt: now });
  }
}

// 生成稳定缓存 key，避免同样上下文重复请求模型。
export function createCacheKey(operation: string, model: string, payload: unknown): string {
  return `${operation}:${model}:${JSON.stringify(payload)}`;
}
