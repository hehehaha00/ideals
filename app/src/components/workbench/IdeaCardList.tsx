// 这个文件用左侧导航切换脑洞，并在右侧展示单篇完整报告。
import { useEffect } from "react";
import { useIdeaStore } from "../../store/ideaStore";
import { IdeaCard } from "./IdeaCard";

interface IdeaCardListProps {
  onReturnToOrigin?: (ideaId: string, focusNodeId?: string) => void;
  onContinueFromOrigin?: (ideaId: string) => void;
  onDiscussionBranchCreated?: () => void;
}

// 渲染脑洞导航、加载状态和当前报告。
export function IdeaCardList({ onReturnToOrigin, onContinueFromOrigin, onDiscussionBranchCreated }: IdeaCardListProps = {}): JSX.Element | null {
  const ideas = useIdeaStore((state) => state.ideas);
  const activeIdeaId = useIdeaStore((state) => state.activeIdeaId);
  const loading = useIdeaStore((state) => state.loading);
  const setActiveIdea = useIdeaStore((state) => state.setActiveIdea);
  const activeIdea = ideas.find((idea) => idea.id === activeIdeaId) ?? ideas[0];
  useEffect(() => { if (ideas.length > 0 && (!activeIdeaId || !ideas.some((idea) => idea.id === activeIdeaId))) setActiveIdea(ideas[0].id); }, [activeIdeaId, ideas, setActiveIdea]);

  if (ideas.length === 0 && loading !== "ideas") return null;

  return (
    <section className="idea-report-shell mt-12 text-[#fff7df]" aria-labelledby="idea-card-list-title">
      <header className="mb-8 border-b border-white/10 pb-5">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-spark-500">Idea Reports</p>
        <h2 id="idea-card-list-title" className="mt-2 font-serif text-4xl leading-tight">灵感展墙</h2>
      </header>
      {loading === "ideas" && <p className="border-y border-white/10 py-4 text-sm text-white/62">正在整理脑洞报告。</p>}
      {activeIdea && (
        <div className="grid items-start gap-10 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <nav aria-label="脑洞导航" className="idea-report-nav lg:sticky lg:top-6">
            <div className="idea-archive-heading"><span>IDEA FILES</span><strong>{String(ideas.length).padStart(2, "0")}</strong></div>
            <div className="idea-archive-stack">
              {ideas.map((idea, index) => (
                <button
                  key={idea.id}
                  type="button"
                  aria-label={idea.title}
                  aria-current={idea.id === activeIdea.id ? "page" : undefined}
                  disabled={loading !== "idle"}
                  className="idea-report-nav-item"
                  style={{ zIndex: idea.id === activeIdea.id ? ideas.length + 1 : ideas.length - index }}
                  onClick={() => setActiveIdea(idea.id)}
                >
                  <span className="idea-archive-index">#{String(index + 1).padStart(2, "0")}</span>
                  <span className="idea-archive-body">
                    <span className="idea-archive-kicker">{idea.sourcePath?.at(-2) ?? "NEW IDEA"}</span>
                    <strong>{idea.title}</strong>
                    <small>{idea.id === activeIdea.id ? idea.summary : idea.sourcePath?.at(-1) ?? "待展开的灵感"}</small>
                  </span>
                  <span className="idea-archive-state">{idea.id === activeIdea.id ? "READING" : "FILED"}</span>
                </button>
              ))}
            </div>
          </nav>
          <IdeaCard idea={activeIdea} onContinueFromOrigin={onContinueFromOrigin} onDiscussionBranchCreated={onDiscussionBranchCreated} onReturnToOrigin={onReturnToOrigin} />
        </div>
      )}
    </section>
  );
}
