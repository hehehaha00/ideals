// 这个文件合并 Tailwind class，避免条件样式互相覆盖。
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// 合并普通 class、条件 class 和 Tailwind 冲突 class。
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
