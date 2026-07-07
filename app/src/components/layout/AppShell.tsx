// 这个文件组织脑洞实验室的三栏工作台布局。
import type { ReactNode } from "react";
import { FlaskConical } from "lucide-react";

interface AppShellProps {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}

// 渲染应用外壳，桌面三栏，移动端单栏。
export function AppShell({ left, center, right }: AppShellProps): JSX.Element {
  return (
    <main className="min-h-screen bg-paper-50 text-ink-900">
      <div className="grid min-h-screen gap-4 p-4 lg:grid-cols-[280px_minmax(0,1fr)_360px]">
        <aside className="order-2 space-y-4 lg:order-1">{left}</aside>
        <section className="order-1 min-w-0 space-y-4 lg:order-2">
          <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line-100 bg-paper-0 px-5 py-4 shadow-soft">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-spark-500 text-white">
                <FlaskConical className="h-5 w-5" />
              </span>
              <div>
                <p className="font-mono text-xs text-spark-500">Idea Lab</p>
                <h1 className="font-serif text-2xl leading-tight">脑洞实验室</h1>
              </div>
            </div>
            <p className="text-sm text-ink-500">先陪人发散，再帮人落地。</p>
          </header>
          {center}
        </section>
        <aside className="order-3 space-y-4">{right}</aside>
      </div>
    </main>
  );
}
