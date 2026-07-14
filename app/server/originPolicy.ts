// 这个文件解析允许来源，并为本地 AI 代理写入最小 CORS 响应头。
export const DEFAULT_ALLOWED_ORIGINS = [
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
] as const;

export interface OriginPolicyResult {
  allowed: boolean;
  browserOrigin: boolean;
}

type HeaderWriter = (name: string, value: string) => void;

// 把逗号分隔的来源配置转换成去重后的允许列表。
export function parseAllowedOrigins(rawValue: string | undefined): string[] {
  const configured = rawValue
    ?.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return Array.from(new Set(configured && configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS));
}

// 校验请求来源，并只为允许的浏览器来源写回具体 CORS 头。
export function applyOriginPolicy(origin: string | undefined, allowedOrigins: readonly string[], setHeader: HeaderWriter): OriginPolicyResult {
  if (!origin) {
    return { allowed: true, browserOrigin: false };
  }

  setHeader("Vary", "Origin");
  if (!allowedOrigins.includes(origin)) {
    return { allowed: false, browserOrigin: true };
  }

  setHeader("Access-Control-Allow-Origin", origin);
  return { allowed: true, browserOrigin: true };
}
