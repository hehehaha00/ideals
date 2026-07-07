// 这个文件提供工作台里的轻量区域容器。
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface PanelProps {
  title?: string;
  eyebrow?: string;
  className?: string;
  children: ReactNode;
}

// 渲染一个带标题的工作区块。
export function Panel({ title, eyebrow, className, children }: PanelProps): JSX.Element {
  return (
    <section className={cn("rounded-lg border border-line-100 bg-paper-0 p-5 shadow-soft", className)}>
      {(eyebrow || title) && (
        <header className="mb-4">
          {eyebrow && <p className="font-mono text-xs text-spark-500">{eyebrow}</p>}
          {title && <h2 className="mt-1 text-lg font-semibold text-ink-900">{title}</h2>}
        </header>
      )}
      {children}
    </section>
  );
}
