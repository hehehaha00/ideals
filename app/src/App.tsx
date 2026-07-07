// 这个文件暂时展示 MVP 首页占位，后续会组合完整工作台。
function App(): JSX.Element {
  return (
    <main className="min-h-screen bg-paper-50 text-ink-900">
      <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6">
        <section className="rounded-lg border border-line-100 bg-paper-0 p-8 shadow-soft">
          <p className="font-mono text-xs uppercase tracking-normal text-spark-500">Idea Lab</p>
          <h1 className="mt-3 font-serif text-4xl leading-tight">脑洞实验室</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-ink-700">
            输入一个模糊方向，让 AI 先陪你发散，再把有生命力的想法留下来。
          </p>
        </section>
      </div>
    </main>
  );
}

export default App;
