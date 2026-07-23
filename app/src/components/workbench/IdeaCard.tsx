// 这个文件把单篇脑洞组织成“摘要 + 单工具工作台”，避免多个报告模块同时争抢注意力。
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Bookmark, ChevronDown, Route, Sparkles, WandSparkles } from "lucide-react";
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

type ReportMode = "overview" | "refine" | "challenge" | "discussion" | "plan";
type ToolMode = Exclude<ReportMode, "overview">;

const EMPTY_CHALLENGES: IdeaChallenge[] = [];
const EMPTY_DISCUSSIONS: IdeaDiscussion[] = [];

const TOOL_META: Record<ToolMode, { index: string; title: string; purpose: string }> = {
  refine: { index: "01 / TEST", title: "深入验证", purpose: "把直觉拆成用户、场景和可以马上验证的判断。" },
  challenge: { index: "02 / PRESSURE TEST", title: "反共识挑战", purpose: "找出最容易被忽略的假设，避免只证明自己想相信的事。" },
  discussion: { index: "03 / ROUND TABLE", title: "编辑部讨论", purpose: "让不同立场把想法推向新的分支，而不是轮流发表意见。" },
  plan: { index: "04 / NEXT MOVE", title: "行动计划", purpose: "把已经确认的方向收束成一个最小、可执行的下一步。" },
};

// 渲染当前脑洞的摘要、工具工作区和上下文操作。
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
  const [mode, setMode] = useState<ReportMode>(() => discussions.length > 0 ? "discussion" : challenges.length > 0 ? "challenge" : "overview");
  const menuRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const previousIdeaIdRef = useRef(idea.id);
  const sourcePath = idea.sourcePath ?? idea.sourceWords.map((word) => word.text);
  const mindMap = useIdeaStore((state) => state.mindMap);
  const canContinueFromOrigin = Boolean(
    idea.origin
      && mindMap
      && mindMap.id === idea.origin.mapId
      && idea.origin.sourceNodeIds.length > 0
      && idea.origin.sourceNodeIds.every((nodeId) => mindMap.nodes.some((node) => node.id === nodeId && node.selectable)),
  );
  const isBusy = loading !== "idle";

  useEffect(() => {
    if (isBusy) menuRef.current?.removeAttribute("open");
  }, [isBusy]);

  useEffect(() => {
    if (loading === "challenge") setMode("challenge");
    if (loading === "discussion" || loading === "discussionResponse" || loading === "discussionBranch") setMode("discussion");
    if (loading === "refine") setMode("refine");
  }, [loading]);

  useEffect(() => {
    if (previousIdeaIdRef.current !== idea.id) {
      previousIdeaIdRef.current = idea.id;
      setMode("overview");
    }
  }, [idea.id]);

  const openTool = (nextMode: ToolMode): void => {
    setActiveIdea(idea.id);
    setMode(nextMode);
  };

  const handleTransform = (direction: TransformDirection): void => {
    setActiveIdea(idea.id);
    void transformActiveIdea(direction);
  };

  const handleRefine = (): void => {
    openTool("refine");
    if (!refinement) void refineActiveIdea();
  };

  const handleChallenge = (role: IdeaChallengeRole): void => {
    setActiveIdea(idea.id);
    void challengeIdea(idea.id, role);
  };

  const handleDiscuss = (setup: IdeaDiscussionSetup): void => {
    setActiveIdea(idea.id);
    if (setup.lineup === "standard" && setup.mechanism === "relay") void discussIdea(idea.id);
    else void discussIdea(idea.id, setup);
  };

  const tool = mode === "overview" ? undefined : TOOL_META[mode];

  return (
    <article className="idea-report" aria-labelledby={`idea-title-${idea.id}`}>
      {mode === "overview" ? (
        <>
          <header className="idea-report-cover">
            <div className="idea-report-cover-topline"><div className="idea-report-kicker"><span>IDEA REPORT</span><span>#{idea.id.slice(-2).toUpperCase()}</span></div><span className={`idea-report-status ${isFavorite ? "is-saved" : ""}`}><Bookmark className="h-4 w-4" aria-hidden="true" />{isFavorite ? "已收藏" : "未收藏"}</span></div>
            <h3 id={`idea-title-${idea.id}`} className="mt-4 max-w-4xl break-words font-serif text-4xl leading-tight md:text-6xl">{idea.title}</h3>
            <p className="idea-report-lead">{idea.summary}</p>
            <div className="idea-report-source mt-6"><Route className="mt-1 h-4 w-4 shrink-0 text-spark-500" aria-hidden="true" /><div><p className="text-xs text-white/42">来源路径</p><p className="mt-1 break-words text-sm leading-6 text-white/64">{sourcePath.join(" → ")}</p></div></div>
          </header>

          {idea.origin && onReturnToOrigin && <section className="idea-report-evidence" aria-labelledby="origin-heading"><div className="idea-report-section-label"><span>来源证据</span><span>这条脑洞从哪里长出来</span></div><IdeaOriginConstellation disabled={isBusy} idea={idea} map={mindMap} onReturnToOrigin={(focusNodeId) => onReturnToOrigin(idea.id, focusNodeId)} /></section>}

          <section className="idea-report-summary" aria-labelledby="summary-heading"><div className="idea-report-section-label"><span id="summary-heading">核心判断</span><span>先决定它是否值得继续</span></div><div className="idea-report-judgement"><div><h4>为什么值得做</h4><p>{idea.whyInteresting}</p></div><div><h4>第一版怎么做</h4><p>{idea.firstVersion}</p></div></div></section>

          <section className="idea-report-next" aria-labelledby="next-heading"><div className="idea-report-section-label"><span id="next-heading">下一步选择</span><span>选一条路，报告会切换到对应工作台</span></div><div className="idea-report-route-list">
            <button type="button" aria-label="深入验证" className="idea-report-route" disabled={isBusy} onClick={handleRefine}><span className="idea-report-route-index">01</span><span><strong>深入验证</strong><small>把直觉变成可验证的判断</small></span><Sparkles className="h-5 w-5" aria-hidden="true" /></button>
            <button type="button" aria-label="反共识挑战" className="idea-report-route" disabled={isBusy} onClick={() => openTool("challenge")}><span className="idea-report-route-index">02</span><span><strong>反共识挑战</strong><small>找出最容易被忽略的假设</small></span><Route className="h-5 w-5" aria-hidden="true" /></button>
            <button type="button" aria-label="召集讨论" className="idea-report-route" disabled={isBusy} onClick={() => openTool("discussion")}><span className="idea-report-route-index">03</span><span><strong>编辑部讨论</strong><small>让不同立场把想法推向新的分支</small></span><WandSparkles className="h-5 w-5" aria-hidden="true" /></button>
          </div></section>

          <footer className="idea-report-actionbar"><span className="idea-report-actionbar-label">报告动作</span><Button variant="secondary" disabled={isBusy} icon={<Bookmark className="h-4 w-4" aria-hidden="true" />} onClick={() => toggleFavorite(idea.id)}>{isFavorite ? "取消收藏" : "收藏"}</Button><Button variant="secondary" disabled={!canContinueFromOrigin || !onContinueFromOrigin || isBusy} icon={<Sparkles className="h-4 w-4" aria-hidden="true" />} onClick={() => onContinueFromOrigin?.(idea.id)}>继续发散</Button><details ref={menuRef} className="idea-transform-menu" onKeyDown={(event) => { if (event.key === "Escape") { menuRef.current?.removeAttribute("open"); summaryRef.current?.focus(); } }}><summary aria-disabled={isBusy} ref={summaryRef} onClick={(event) => { if (isBusy) event.preventDefault(); }}><WandSparkles className="h-4 w-4" aria-hidden="true" />换个角度<ChevronDown className="h-4 w-4" aria-hidden="true" /></summary><div>{TRANSFORM_DIRECTIONS.map((direction) => <button key={direction} type="button" disabled={isBusy} onClick={() => { handleTransform(direction); menuRef.current?.removeAttribute("open"); summaryRef.current?.focus(); }}>{direction}</button>)}</div></details></footer>
        </>
      ) : (
        <section className="idea-report-tool-view" aria-labelledby={`tool-title-${idea.id}`}>
          <header className="idea-report-tool-header"><button type="button" className="idea-report-back" disabled={isBusy} onClick={() => setMode("overview")}><ArrowLeft className="h-4 w-4" aria-hidden="true" />返回报告摘要</button><div className="idea-report-tool-title"><p>{tool?.index}</p><h3 id={`tool-title-${idea.id}`}>{tool?.title}</h3><span>{tool?.purpose}</span></div></header>
          {mode === "refine" && <div className="idea-report-tool-content"><IdeaRefinery refinement={refinement} selectedAction={selectedAction} loading={loading === "refine"} />{refinement && <div className="idea-report-tool-followup"><IdeaDecisionBrief idea={idea} refinement={refinement} />{executionPlan && <IdeaExecutionPlan plan={executionPlan} disabled={isBusy} onToggle={(taskId) => toggleIdeaExecutionTask(idea.id, taskId)} />}</div>}</div>}
          {mode === "challenge" && <div className="idea-report-tool-content"><IdeaChallengePanel key={idea.id} challenges={challenges} disabled={isBusy} loading={loading === "challenge"} onChallenge={handleChallenge} /></div>}
          {mode === "discussion" && <div className="idea-report-tool-content"><IdeaDiscussionPanel key={`discussion-${idea.id}`} discussions={discussions} disabled={isBusy} loading={loading === "discussion" || loading === "discussionResponse" || loading === "discussionBranch" ? loading : "idle"} onCollectSpark={(discussionId, sparkId) => collectDiscussionSpark(idea.id, discussionId, sparkId)} onContinueDirection={(discussionId, directionKey, opposite) => opposite === undefined ? continueDiscussionDirection(idea.id, discussionId, directionKey) : continueDiscussionDirection(idea.id, discussionId, directionKey, opposite)} onDiscuss={handleDiscuss} onDiscussionBranchCreated={onDiscussionBranchCreated} onRespond={(discussionId, input) => { void respondToIdeaDiscussion(idea.id, discussionId, input); }} onStop={stopDiscussion} /></div>}
          {mode === "plan" && <div className="idea-report-tool-content"><div className="idea-report-plan-empty">{refinement ? <><IdeaDecisionBrief idea={idea} refinement={refinement} />{executionPlan && <IdeaExecutionPlan plan={executionPlan} disabled={isBusy} onToggle={(taskId) => toggleIdeaExecutionTask(idea.id, taskId)} />}</> : <p>先完成深入验证，行动计划才会有可靠依据。</p>}</div></div>}
          <footer className="idea-report-tool-actions"><Button variant="secondary" disabled={isBusy} onClick={() => setMode("overview")}>返回摘要</Button>{mode === "refine" && refinement && <Button variant="primary" disabled={isBusy} icon={<Route className="h-4 w-4" aria-hidden="true" />} onClick={() => { chooseRefinementAction(idea.id, "收束推进"); setMode("plan"); }}>收束推进</Button>}{mode === "plan" && onContinueFromOrigin && <Button variant="primary" disabled={!canContinueFromOrigin || isBusy} icon={<Sparkles className="h-4 w-4" aria-hidden="true" />} onClick={() => onContinueFromOrigin(idea.id)}>回到导图继续发散</Button>}</footer>
        </section>
      )}
    </article>
  );
}
