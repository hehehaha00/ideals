// 这个文件展示单篇脑洞报告，并编排收藏、变形和炼化操作。
import { useEffect, useRef } from "react";
import { Bookmark, ChevronDown, Route, Sparkles, WandSparkles } from "lucide-react";
import { useIdeaStore } from "../../store/ideaStore";
import { TRANSFORM_DIRECTIONS, type IdeaCard as IdeaCardType, type IdeaChallenge, type IdeaChallengeRole, type IdeaDiscussion, type IdeaDiscussionSetup, type TransformDirection } from "../../types/idea";
import { Button } from "../ui/Button";
import { IdeaOriginConstellation } from "./IdeaOriginConstellation";
import { IdeaDecisionBrief } from "./IdeaDecisionBrief";
import { IdeaExecutionPlan } from "./IdeaExecutionPlan";
import { IdeaChallengePanel } from "./IdeaChallengePanel";
import { IdeaDiscussionPanel } from "./IdeaDiscussionPanel";
import { IdeaRefinery } from "./IdeaRefinery";

interface IdeaCardProps {
  idea: IdeaCardType;
  onReturnToOrigin?: (ideaId: string, focusNodeId?: string) => void;
  onContinueFromOrigin?: (ideaId: string) => void;
  onDiscussionBranchCreated?: () => void;
}

const EMPTY_CHALLENGES: IdeaChallenge[] = [];
const EMPTY_DISCUSSIONS: IdeaDiscussion[] = [];

// 渲染当前脑洞的完整报告。
export function IdeaCard({ idea, onReturnToOrigin, onContinueFromOrigin, onDiscussionBranchCreated }: IdeaCardProps): JSX.Element {
  const favorites = useIdeaStore((state) => state.favorites);
  const loading = useIdeaStore((state) => state.loading);
  const refinement = useIdeaStore((state) => state.refinementsByIdeaId[idea.id]);
  const challenges = useIdeaStore((state) => state.challengesByIdeaId[idea.id] ?? EMPTY_CHALLENGES);
  const discussions = useIdeaStore((state) => state.discussionsByIdeaId[idea.id] ?? EMPTY_DISCUSSIONS);
  const executionPlan = useIdeaStore((state) => state.executionPlansByIdeaId[idea.id]);
  const selectedAction = useIdeaStore((state) => state.refinementActionsByIdeaId[idea.id]);
  const setActiveIdea = useIdeaStore((state) => state.setActiveIdea);
  const transformActiveIdea = useIdeaStore((state) => state.transformActiveIdea);
  const refineActiveIdea = useIdeaStore((state) => state.refineActiveIdea);
  const challengeIdea = useIdeaStore((state) => state.challengeIdea);
  const discussIdea = useIdeaStore((state) => state.discussIdea);
  const stopDiscussion = useIdeaStore((state) => state.stopDiscussion);
  const collectDiscussionSpark = useIdeaStore((state) => state.collectDiscussionSpark);
  const respondToIdeaDiscussion = useIdeaStore((state) => state.respondToIdeaDiscussion);
  const continueDiscussionDirection = useIdeaStore((state) => state.continueDiscussionDirection);
  const chooseRefinementAction = useIdeaStore((state) => state.chooseRefinementAction);
  const toggleIdeaExecutionTask = useIdeaStore((state) => state.toggleIdeaExecutionTask);
  const toggleFavorite = useIdeaStore((state) => state.toggleFavorite);
  const isFavorite = favorites.some((favorite) => favorite.idea.id === idea.id);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const sourcePath = idea.sourcePath ?? idea.sourceWords.map((word) => word.text);
  const mindMap = useIdeaStore((state) => state.mindMap);
  const canContinueFromOrigin = Boolean(
    idea.origin
      && mindMap
      && mindMap.id === idea.origin.mapId
      && idea.origin.sourceNodeIds.length > 0
      && idea.origin.sourceNodeIds.every((nodeId) => mindMap.nodes.some((node) => node.id === nodeId && node.selectable)),
  );

  // AI 开始工作时收起仍打开的变形菜单，避免报告继续发起新操作。
  useEffect(() => {
    if (loading !== "idle") menuRef.current?.removeAttribute("open");
  }, [loading]);

  // 切到当前脑洞后沿用原有变形行为。
  const handleTransform = (direction: TransformDirection): void => {
    setActiveIdea(idea.id);
    void transformActiveIdea(direction);
  };

  // 切到当前脑洞后沿用原有炼化行为。
  const handleRefine = (): void => {
    setActiveIdea(idea.id);
    void refineActiveIdea();
  };

  // 从当前报告发起指定角色的反共识挑战。
  const handleChallenge = (role: IdeaChallengeRole): void => {
    setActiveIdea(idea.id);
    void challengeIdea(idea.id, role);
  };

  // 召集多角色编辑部围绕当前脑洞讨论。
  const handleDiscuss = (setup: IdeaDiscussionSetup): void => {
    setActiveIdea(idea.id);
    if (setup.lineup === "standard" && setup.mechanism === "relay") {
      void discussIdea(idea.id);
    } else {
      void discussIdea(idea.id, setup);
    }
  };

  return (
    <article className="idea-report" aria-labelledby={`idea-title-${idea.id}`}>
      <header className="idea-report-cover">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 flex-1">
            <div className="idea-report-kicker"><span>IDEA REPORT</span><span>#{idea.id.slice(-2).toUpperCase()}</span></div>
            <h3 id={`idea-title-${idea.id}`} className="mt-3 break-words font-serif text-4xl leading-tight md:text-5xl">{idea.title}</h3>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-white/72">{idea.summary}</p>
          </div>
          <span className={`idea-report-status ${isFavorite ? "is-saved" : ""}`}><Bookmark className="h-4 w-4" aria-hidden="true" />{isFavorite ? "已收藏" : "未收藏"}</span>
        </div>
        <div className="idea-report-source mt-6">
          <Route className="mt-1 h-4 w-4 shrink-0 text-spark-500" aria-hidden="true" />
          <div><p className="text-xs text-white/42">来源路径</p><p className="mt-1 break-words text-sm leading-6 text-white/64">{sourcePath.join(" → ")}</p></div>
        </div>
      </header>

      {idea.origin && onReturnToOrigin && (
        <section className="idea-report-module idea-report-evidence" aria-labelledby="origin-heading">
          <div className="idea-report-module-heading"><div><p className="idea-report-module-index">01 / SOURCE</p><h4 id="origin-heading">来源证据</h4></div><span>这条脑洞从哪里长出来</span></div>
          <IdeaOriginConstellation disabled={loading !== "idle"} idea={idea} map={mindMap} onReturnToOrigin={(focusNodeId) => onReturnToOrigin(idea.id, focusNodeId)} />
        </section>
      )}

      <section id="report-summary" className="idea-report-module idea-report-summary" aria-labelledby="summary-heading">
        <div className="idea-report-module-heading"><div><p className="idea-report-module-index">02 / READ FIRST</p><h4 id="summary-heading">核心判断</h4></div><span>先判断值不值得继续</span></div>
        <div className="grid gap-8 md:grid-cols-2">
          <div><h5>为什么值得做</h5><p>{idea.whyInteresting}</p></div>
          <div><h5>第一版怎么做</h5><p>{idea.firstVersion}</p></div>
        </div>
      </section>

      <section id="report-refinery" className="idea-report-module" aria-label="深入验证">
        <div className="idea-report-module-heading"><div><p className="idea-report-module-index">03 / TEST</p><h4>深入验证</h4></div><span>把直觉变成可验证的判断</span></div>
        <IdeaRefinery refinement={refinement} selectedAction={selectedAction} loading={loading === "refine"} />
      </section>

      <section id="report-challenge" className="idea-report-module" aria-label="反共识挑战">
        <div className="idea-report-module-heading"><div><p className="idea-report-module-index">04 / PRESSURE TEST</p><h4>反共识挑战</h4></div><span>找出最容易被忽略的假设</span></div>
        <IdeaChallengePanel key={idea.id} challenges={challenges} disabled={loading !== "idle"} loading={loading === "challenge"} onChallenge={handleChallenge} />
      </section>

      <section id="report-discussion" className="idea-report-module" aria-label="编辑部讨论">
        <div className="idea-report-module-heading"><div><p className="idea-report-module-index">05 / ROUND TABLE</p><h4>编辑部讨论</h4></div><span>让不同立场把想法推向不同方向</span></div>
        <IdeaDiscussionPanel
          key={`discussion-${idea.id}`}
          discussions={discussions}
          disabled={loading !== "idle"}
          loading={loading === "discussion" || loading === "discussionResponse" || loading === "discussionBranch" ? loading : "idle"}
          onCollectSpark={(discussionId, sparkId) => collectDiscussionSpark(idea.id, discussionId, sparkId)}
          onContinueDirection={(discussionId, directionKey, opposite) => opposite === undefined ? continueDiscussionDirection(idea.id, discussionId, directionKey) : continueDiscussionDirection(idea.id, discussionId, directionKey, opposite)}
          onDiscuss={handleDiscuss}
          onDiscussionBranchCreated={onDiscussionBranchCreated}
          onRespond={(discussionId, input) => { void respondToIdeaDiscussion(idea.id, discussionId, input); }}
          onStop={stopDiscussion}
        />
      </section>

      <section id="report-plan" className="idea-report-module" aria-label="行动计划">
        <div className="idea-report-module-heading"><div><p className="idea-report-module-index">06 / NEXT MOVE</p><h4>行动计划</h4></div><span>选择一个最小的下一步</span></div>
        {refinement && <IdeaDecisionBrief idea={idea} refinement={refinement} />}
        {executionPlan && <IdeaExecutionPlan plan={executionPlan} disabled={loading !== "idle"} onToggle={(taskId) => toggleIdeaExecutionTask(idea.id, taskId)} />}
      </section>

      <footer id="report-actions" className="idea-report-actionbar">
        <span className="idea-report-actionbar-label">下一步</span>
        {refinement ? (
          <Button variant="primary" disabled={loading !== "idle"} icon={<Route className="h-4 w-4" aria-hidden="true" />} onClick={() => chooseRefinementAction(idea.id, "收束推进")}>收束推进</Button>
        ) : (
          <Button variant="primary" icon={<Sparkles className="h-4 w-4" aria-hidden="true" />} disabled={loading !== "idle"} onClick={handleRefine}>{loading === "refine" ? "正在验证" : "深入验证"}</Button>
        )}
        <Button variant="secondary" disabled={loading !== "idle"} icon={<Bookmark className="h-4 w-4" aria-hidden="true" />} onClick={() => toggleFavorite(idea.id)}>{isFavorite ? "取消收藏" : "收藏"}</Button>
        <Button variant="secondary" disabled={!canContinueFromOrigin || !onContinueFromOrigin || loading !== "idle"} icon={<Sparkles className="h-4 w-4" aria-hidden="true" />} onClick={() => onContinueFromOrigin?.(idea.id)}>继续发散</Button>
        <details ref={menuRef} className="idea-transform-menu" onKeyDown={(event) => { if (event.key === "Escape") { menuRef.current?.removeAttribute("open"); summaryRef.current?.focus(); } }}>
          <summary aria-disabled={loading !== "idle"} ref={summaryRef} onClick={(event) => { if (loading !== "idle") event.preventDefault(); }}><WandSparkles className="h-4 w-4" aria-hidden="true" />换个角度<ChevronDown className="h-4 w-4" aria-hidden="true" /></summary>
          <div>
            {TRANSFORM_DIRECTIONS.map((direction) => <button key={direction} type="button" disabled={loading !== "idle"} onClick={() => { handleTransform(direction); menuRef.current?.removeAttribute("open"); summaryRef.current?.focus(); }}>{direction}</button>)}
          </div>
        </details>
      </footer>
    </article>
  );
}
