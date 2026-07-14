// 这个文件提供应用内统一按钮，供工作台操作复用。
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  icon?: ReactNode;
}

// 渲染带图标、状态和统一视觉的按钮。
export function Button({ className, variant = "secondary", icon, children, type = "button", ...props }: ButtonProps): JSX.Element {
  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-500 disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-spark-500 text-white hover:bg-spark-600 active:scale-[0.99]",
        variant === "secondary" && "border border-line-100 bg-paper-0 text-ink-900 hover:border-spark-500 hover:text-spark-600",
        variant === "ghost" && "text-ink-700 hover:bg-paper-100 hover:text-ink-900",
        className,
      )}
      type={type}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
