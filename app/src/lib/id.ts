// 这个文件生成本地使用的稳定前缀 ID，避免组件列表 key 冲突。
export function createId(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${randomPart}`;
}
