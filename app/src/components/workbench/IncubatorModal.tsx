// 这个文件渲染孵化箱抽屉：保存、筛选、查看和混合旧想法。
import { Archive, Check, FlaskConical, GitMerge, Sparkles, X } from "lucide-react";
import { cn } from "../../lib/cn";
import { useIdeaStore } from "../../store/ideaStore";
import { INCUBATOR_FILTERS, type FavoriteIdea, type IncubatorFilter, type IdeaCard } from "../../types/idea";
import { Button } from "../ui/Button";

function isToday(dateText: string): boolean {
  const date = new Date(dateText);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

function isThisWeek(dateText: string): boolean {
  const date = new Date(dateText).getTime();
  const now = Date.now();
  return now - date <= 7 * 24 * 60 * 60 * 1000;
}

function sourcePathOf(idea: IdeaCard): string {
  return (idea.sourcePath ?? idea.sourceWords.map((word) => word.text)).join(" -> ");
}

function statusLabels(favorite: FavoriteIdea, refined: boolean, selected: boolean): string[] {
  const labels = [refined ? "已炼化" : "未炼化"];
  if (refined) {
    labels.push("可开工");
  }
  if (selected) {
    labels.push("想混合");
  }
  if (isToday(favorite.savedAt)) {
    labels.push("今天");
  } else if (isThisWeek(favorite.savedAt)) {
    labels.push("本周");
  }
  return labels;
}

function matchesFilter(favorite: FavoriteIdea, filter: IncubatorFilter, refined: boolean, selected: boolean): boolean {
  if (filter === "全部") {
    return true;
  }
  if (filter === "未炼化") {
    return !refined;
  }
  if (filter === "已炼化" || filter === "可开工") {
    return refined;
  }
  if (filter === "想混合") {
    return selected;
  }
  if (filter === "今天") {
    return isToday(favorite.savedAt);
  }
  return isThisWeek(favorite.savedAt);
}

// 渲染孵化箱抽屉。
export function IncubatorModal(): JSX.Element | null {
  const favorites = useIdeaStore((state) => state.favorites);
  const refinementsByIdeaId = useIdeaStore((state) => state.refinementsByIdeaId);
  const incubatorOpen = useIdeaStore((state) => state.incubatorOpen);
  const incubatorFilter = useIdeaStore((state) => state.incubatorFilter);
  const incubatorSelectedIdeaIds = useIdeaStore((state) => state.incubatorSelectedIdeaIds);
  const incubatorDetailIdeaId = useIdeaStore((state) => state.incubatorDetailIdeaId);
  const loading = useIdeaStore((state) => state.loading);
  const closeIncubator = useIdeaStore((state) => state.closeIncubator);
  const setIncubatorFilter = useIdeaStore((state) => state.setIncubatorFilter);
  const setIncubatorDetail = useIdeaStore((state) => state.setIncubatorDetail);
  const toggleIncubatorSelection = useIdeaStore((state) => state.toggleIncubatorSelection);
  const mixSelectedIncubatorIdeas = useIdeaStore((state) => state.mixSelectedIncubatorIdeas);

  if (!incubatorOpen) {
    return null;
  }

  const visibleFavorites = favorites.filter((favorite) => {
    const selected = incubatorSelectedIdeaIds.includes(favorite.idea.id);
    return matchesFilter(favorite, incubatorFilter, Boolean(refinementsByIdeaId[favorite.idea.id]), selected);
  });
  const detailFavorite = favorites.find((favorite) => favorite.idea.id === incubatorDetailIdeaId) ?? visibleFavorites[0] ?? favorites[0];
  const detailRefinement = detailFavorite ? refinementsByIdeaId[detailFavorite.idea.id] : undefined;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/58 p-0 backdrop-blur-md sm:p-4" role="presentation">
      <section
        aria-label="孵化箱"
        aria-modal="true"
        className="cosmic-panel relative ml-auto flex h-full w-full max-w-5xl animate-[drawerSlide_220ms_cubic-bezier(0.22,1,0.36,1)_both] flex-col overflow-hidden sm:h-[calc(100vh-2rem)] sm:rounded-3xl"
        role="dialog"
      >
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 px-5 py-4 text-[#fff7df]">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-spark-600">Incubator / 灵感抽屉</p>
            <h2 className="mt-1 font-serif text-3xl leading-tight">孵化箱</h2>
            <p className="mt-2 text-sm leading-6 text-white/56">挑 2 到 3 个旧想法，混成下一张导图。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={incubatorFilter === "全部"} onClick={() => setIncubatorFilter("全部")}>
              清空筛选
            </Button>
            <Button variant="ghost" icon={<X className="h-4 w-4" />} onClick={closeIncubator}>
              关闭
            </Button>
          </div>
        </header>

        <div className="border-b border-white/10 bg-black/18 px-5 py-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {INCUBATOR_FILTERS.map((filter) => (
              <button
                key={filter}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-500",
                  incubatorFilter === filter ? "border-spark-500 bg-spark-500 text-white" : "border-white/10 bg-white/[0.06] text-white/66 hover:border-spark-500/60 hover:text-white",
                )}
                type="button"
                onClick={() => setIncubatorFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.54fr)]">
          <div className="min-h-0 overflow-y-auto p-5">
            {favorites.length === 0 && (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-white/14 bg-white/[0.05] p-6 text-center text-[#fff7df]">
                <Archive className="h-8 w-8 text-spark-600" aria-hidden="true" />
                <p className="mt-3 font-medium">还没有想法进来。</p>
                <p className="mt-2 text-sm leading-6 text-white/56">在脑洞卡片里点“放入孵化箱”，它们就会留在这里。</p>
              </div>
            )}

            {favorites.length > 0 && visibleFavorites.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/14 bg-white/[0.05] p-6 text-sm leading-6 text-white/56">当前筛选下没有想法。</div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              {visibleFavorites.map((favorite) => {
                const selected = incubatorSelectedIdeaIds.includes(favorite.idea.id);
                const refined = Boolean(refinementsByIdeaId[favorite.idea.id]);
                const labels = statusLabels(favorite, refined, selected);
                return (
                  <article
                    key={favorite.idea.id}
                    className={cn("rounded-2xl border bg-white/[0.05] p-4 text-[#fff7df] transition", selected ? "border-spark-500 shadow-[0_18px_55px_rgba(255,87,1,0.16)]" : "border-white/10 hover:border-spark-500/60")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button className="min-w-0 flex-1 rounded text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-500" type="button" onClick={() => setIncubatorDetail(favorite.idea.id)}>
                        <h3 className="break-words font-serif text-xl leading-7">{favorite.idea.title}</h3>
                        <p className="mt-2 line-clamp-3 break-words text-sm leading-6 text-white/68">{favorite.idea.summary}</p>
                      </button>
                      <button
                        aria-label={`${selected ? "取消选择" : "选择"} ${favorite.idea.title}`}
                        className={cn(
                          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-500",
                          selected ? "border-spark-500 bg-spark-500 text-white" : "border-white/10 bg-white/[0.06] text-white/66 hover:border-spark-500 hover:text-white",
                        )}
                        type="button"
                        onClick={() => toggleIncubatorSelection(favorite.idea.id)}
                      >
                        {selected ? <Check className="h-4 w-4" /> : <GitMerge className="h-4 w-4" />}
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {labels.map((label) => (
                        <span key={label} className={cn("rounded-full px-2 py-1 text-xs", label === "想混合" ? "bg-spark-500 text-white" : label === "已炼化" || label === "可开工" ? "bg-mint-100 text-ink-900" : "bg-white/[0.08] text-white/66")}>
                          {label}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 break-words text-xs leading-5 text-white/46">{sourcePathOf(favorite.idea)}</p>
                  </article>
                );
              })}
            </div>
          </div>

          <aside className="min-h-0 overflow-y-auto border-t border-white/10 bg-black/18 p-5 text-[#fff7df] lg:border-l lg:border-t-0">
            {!detailFavorite && <p className="text-sm leading-6 text-white/56">选一个想法看看细节。</p>}
            {detailFavorite && (
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-spark-600">
                  <FlaskConical className="h-4 w-4" aria-hidden="true" />
                  当前想法
                </div>
                <h3 className="mt-3 break-words font-serif text-2xl leading-8">{detailFavorite.idea.title}</h3>
                <p className="mt-3 break-words text-sm leading-6 text-white/68">{detailFavorite.idea.summary}</p>
                <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.05] p-3">
                  <p className="text-xs font-medium text-spark-600">来源路径</p>
                  <p className="mt-2 break-words text-sm leading-6 text-white/68">{sourcePathOf(detailFavorite.idea)}</p>
                </div>
                {detailRefinement && (
                  <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.05] p-3">
                    <p className="text-xs font-medium text-spark-600">炼化结果</p>
                    <p className="mt-2 break-words text-sm leading-6 text-white/68">{detailRefinement.vitality.smallestPlayableVersion}</p>
                    <div className="mt-3 grid gap-2">
                      {detailRefinement.mvpLadder.map((step) => (
                        <p key={step.horizon} className="rounded-xl border border-white/10 bg-black/16 p-2 text-xs leading-5 text-white/68">
                          <span className="font-medium text-[#fff7df]">{step.horizon}</span>：{step.build}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                {!detailRefinement && (
                  <div className="mt-4 rounded-xl border border-dashed border-white/14 bg-white/[0.05] p-3 text-sm leading-6 text-white/56">这张想法还没炼化，适合先和别的想法混合看看。</div>
                )}
              </div>
            )}
          </aside>
        </div>

        {incubatorSelectedIdeaIds.length > 0 && (
          <div className="border-t border-white/10 bg-black/22 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-white/72">
                <Sparkles className="h-4 w-4 text-spark-600" aria-hidden="true" />
                已选 {incubatorSelectedIdeaIds.length} 个想法
              </div>
              <Button variant="primary" icon={<GitMerge className="h-4 w-4" />} disabled={incubatorSelectedIdeaIds.length < 2 || loading !== "idle"} onClick={() => void mixSelectedIncubatorIdeas()}>
                {loading === "mix" ? "正在混合" : "混合一下"}
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
