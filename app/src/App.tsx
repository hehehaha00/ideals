// 这个文件在首页、全屏导图和独立脑洞结果之间切换，并保留孵化箱覆盖层。
import { Archive, ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { IdeaCardList } from "./components/workbench/IdeaCardList";
import { IncubatorModal } from "./components/workbench/IncubatorModal";
import { MindMapCanvas } from "./components/workbench/MindMapCanvas";
import { HOME_PHASE_DURATION_MS, HOME_PHASES, TopicComposer } from "./components/workbench/TopicComposer";
import { cn } from "./lib/cn";
import { useIdeaStore } from "./store/ideaStore";

type AppView = "home" | "map" | "ideas";
type LoadingStage = "idle" | "map" | "reroll" | "expand" | "words" | "collision" | "ideas" | "transform" | "refine" | "challenge" | "discussion" | "discussionResponse" | "discussionBranch" | "mix";

const AI_WORK_STEPS: Record<Exclude<LoadingStage, "idle">, string[]> = {
  map: ["正在读取你的模糊方向", "正在拆解目标人群、场景和情绪", "正在寻找反常识角度", "正在生成第一批联想节点", "正在筛掉太普通的答案"],
  reroll: ["正在读取锁定节点", "正在保留你的选择", "正在重掷未锁节点", "正在检查节点是否重复", "正在更新推荐碰撞路径"],
  expand: ["正在读取当前节点路径", "正在沿不同维度继续发散", "正在避开已有节点和套娃词", "正在接回新的思维分支"],
  words: ["正在读取你的模糊方向", "正在拆解目标人群、场景和情绪", "正在拉出可碰撞的维度词", "正在去掉重复和空泛词"],
  collision: ["正在读取候选词", "正在寻找词与词之间的张力", "正在保留锁定词", "正在挑一组更容易撞出脑洞的组合"],
  ideas: ["正在读取已选节点", "正在把远距离节点做碰撞", "正在筛掉太普通的想法", "正在压缩成项目候选"],
  transform: ["正在读取当前脑洞", "正在换一个变形角度", "正在保留核心隐喻", "正在生成新的项目形态"],
  refine: ["正在读取选中的脑洞", "正在拆生命力和触发场景", "正在召集脑内圆桌", "正在生成可执行梯度"],
  challenge: ["正在读取选中的脑洞", "正在切换挑战角色视角", "正在寻找默认假设", "正在生成风险和新方向"],
  discussion: ["正在召集创意编辑部", "正在形成各自判断", "正在制造观点碰撞", "正在收束三个新方向"],
  discussionResponse: ["正在读取你的介入", "正在让目标角色回应", "正在生成新的灵感火花"],
  discussionBranch: ["正在读取选定方向", "正在沿讨论结果继续发散", "正在生成新的联想分支"],
  mix: ["正在读取孵化箱想法", "正在寻找共同母题", "正在制造新的张力", "正在生成新的发散起点"],
};

// 用短句展示 AI 当前在做的工作，不暴露流式原文。
function AiWorkingStatus({ loading, streamText, floating = false }: { loading: LoadingStage; streamText: string; floating?: boolean }): JSX.Element | null {
  if (loading === "idle") {
    return null;
  }
  const steps = AI_WORK_STEPS[loading];
  const stageLabels = ["读取", "拆解", "碰撞", "生成", "完成"].slice(0, steps.length);
  const activeIndex = streamText.length === 0 ? 0 : Math.min(steps.length - 1, 1 + Math.floor(streamText.length / 140));
  const progress = steps.length <= 1 ? 100 : Math.round((activeIndex / (steps.length - 1)) * 100);

  return (
    <section className={cn("ai-work-status", floating && "ai-work-status-floating")} aria-live="polite" aria-label="AI 工作状态" data-progress={progress}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="ai-work-pulse" aria-hidden="true" />
        <div className="min-w-0">
          <p className="ai-work-title text-xs uppercase tracking-[0.22em]">AI is working</p>
          <p className="ai-work-current mt-1 truncate text-sm font-medium">{steps[activeIndex]}</p>
        </div>
      </div>
      <div className="ai-work-progress" aria-hidden="true">
        <div className="ai-work-progress-track"><span style={{ width: `${progress}%` }} /></div>
        <div className="ai-work-progress-steps">{stageLabels.map((label, index) => <span className={index <= activeIndex ? "is-active" : undefined} key={label}>{label}</span>)}</div>
      </div>
    </section>
  );
}

// 渲染带背景氛围的主题首页。
function HomeView({ phaseIndex, interactionActive, favoritesCount, hasMindMap, onInteractionChange, onOpenIncubator, onReturnToMap }: { phaseIndex: number; interactionActive: boolean; favoritesCount: number; hasMindMap: boolean; onInteractionChange: (active: boolean) => void; onOpenIncubator: () => void; onReturnToMap: () => void }): JSX.Element {
  const phase = HOME_PHASES[phaseIndex % HOME_PHASES.length];
  return (
    <div className={cn("home-atmosphere min-h-screen", `home-atmosphere-${phase.id}`)} data-home-phase={phase.id} data-interaction-active={interactionActive ? "true" : "false"}>
      <div className="home-scene" aria-hidden="true">
        {HOME_PHASES.map((scenePhase) => {
          const active = scenePhase.id === phase.id;
          return <div key={scenePhase.id} className={cn("home-scene-layer", active && "is-active")} data-active={active ? "true" : "false"} data-background={scenePhase.background} data-testid={`home-scene-${scenePhase.id}`} style={{ backgroundImage: `url(${scenePhase.background})` }} />;
        })}
        <div className="home-scene-vignette" />
        <div className="home-scene-grain" />
      </div>
      <div className="relative z-[1] mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-5 sm:px-8 lg:px-10">
        {(hasMindMap || favoritesCount > 0) && (
          <header className="home-return-header flex items-center justify-between gap-4">
            {hasMindMap ? (
              <button className="home-return-incubator inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-500" type="button" onClick={onReturnToMap}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                返回导图
              </button>
            ) : <span />}
            {favoritesCount > 0 && (
              <button className="home-return-incubator inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-500" type="button" onClick={onOpenIncubator}>
                <Archive className="h-4 w-4" aria-hidden="true" />
                孵化箱 {favoritesCount}
              </button>
            )}
          </header>
        )}
        <section className="home-hero flex flex-1 flex-col justify-center pb-10 pt-10">
          <TopicComposer homeMode homePhase={phase} onHomeInteractionChange={onInteractionChange} />
        </section>
      </div>
    </div>
  );
}

// 渲染独立脑洞结果页，避免结果卡片覆盖导图。
function IdeasView({ favoritesCount, hasMindMap, interactionLocked, loading, onBack, onOpenIncubator, onReturnToOrigin, onContinueFromOrigin, onDiscussionBranchCreated }: { favoritesCount: number; hasMindMap: boolean; interactionLocked: boolean; loading: LoadingStage; onBack: () => void; onOpenIncubator: () => void; onReturnToOrigin: (ideaId: string, focusNodeId?: string) => void; onContinueFromOrigin: (ideaId: string) => void; onDiscussionBranchCreated: () => void }): JSX.Element {
  return (
    <div className="min-h-screen px-5 py-5 sm:px-8 lg:px-10">
      <header className="relative z-50 mx-auto flex max-w-6xl items-center justify-end gap-4">
        <button aria-busy={interactionLocked && loading !== "idle"} className="fixed left-5 top-5 z-50 inline-flex min-h-10 items-center gap-2 rounded-md border border-white/20 bg-[#171310]/90 px-3 text-sm font-medium text-[#fff7df] shadow-lg backdrop-blur-md transition hover:border-spark-500/60 hover:bg-[#211a15] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-500 sm:left-8 lg:left-10" disabled={interactionLocked} type="button" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {hasMindMap ? "返回导图" : "返回首页"}
        </button>
        <button className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm text-[#fff7df]/70 transition hover:border-spark-500/60 hover:text-[#fff7df] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-500 disabled:cursor-not-allowed disabled:opacity-40" disabled={interactionLocked} type="button" onClick={onOpenIncubator}>
          <Archive className="h-4 w-4" aria-hidden="true" />
          孵化箱{favoritesCount > 0 ? ` ${favoritesCount}` : ""}
        </button>
      </header>
      <div className="mx-auto max-w-6xl pb-16 pt-4">
        <IdeaCardList onContinueFromOrigin={onContinueFromOrigin} onDiscussionBranchCreated={onDiscussionBranchCreated} onReturnToOrigin={onReturnToOrigin} />
      </div>
    </div>
  );
}

// 根据当前成果切换顶层视图。
function App(): JSX.Element {
  const error = useIdeaStore((state) => state.error);
  const streamText = useIdeaStore((state) => state.streamText);
  const mindMap = useIdeaStore((state) => state.mindMap);
  const ideas = useIdeaStore((state) => state.ideas);
  const favorites = useIdeaStore((state) => state.favorites);
  const loading = useIdeaStore((state) => state.loading);
  const hydrate = useIdeaStore((state) => state.hydrate);
  const openIncubator = useIdeaStore((state) => state.openIncubator);
  const restoreIdeaOrigin = useIdeaStore((state) => state.restoreIdeaOrigin);
  const expandActiveMindNode = useIdeaStore((state) => state.expandActiveMindNode);
  const [homePhaseIndex, setHomePhaseIndex] = useState(0);
  const [homeInteractionActive, setHomeInteractionActive] = useState(false);
  const [viewOverride, setViewOverride] = useState<AppView>();
  const previousMapId = useRef<string>();
  const previousLoading = useRef<LoadingStage>(loading);
  const ideasBeforeGeneration = useRef(ideas);

  const inferredView: AppView = ideas.length > 0 ? "ideas" : mindMap || loading === "map" ? "map" : "home";
  const view = loading === "map" ? "map" : viewOverride ?? inferredView;

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const nextMapId = mindMap?.id;
    if (nextMapId && previousMapId.current && previousMapId.current !== nextMapId) {
      setViewOverride(undefined);
    }
    previousMapId.current = nextMapId;
  }, [mindMap?.id]);

  useEffect(() => {
    if (loading === "map") {
      setViewOverride(undefined);
    }
  }, [loading]);

  useEffect(() => {
    const previousStage = previousLoading.current;
    if (loading === "ideas" && previousStage !== "ideas") {
      ideasBeforeGeneration.current = ideas;
    }
    if (previousStage === "ideas" && loading === "idle" && ideas.length > 0 && ideas !== ideasBeforeGeneration.current) {
      setViewOverride(undefined);
    }
    previousLoading.current = loading;
  }, [ideas, loading]);

  useEffect(() => {
    if (view !== "home" || homeInteractionActive) {
      return;
    }
    const timer = window.setInterval(() => setHomePhaseIndex((current) => (current + 1) % HOME_PHASES.length), HOME_PHASE_DURATION_MS);
    return () => window.clearInterval(timer);
  }, [homeInteractionActive, view]);

  // 只有来源恢复成功才离开报告，防止导图已更换时把用户带到错误画布。
  const handleReturnToOrigin = (ideaId: string, focusNodeId?: string): void => {
    if (restoreIdeaOrigin(ideaId, focusNodeId)) {
      setViewOverride("map");
    }
  };

  // Zustand 恢复是同步的，先设回来源活动节点，再沿该节点启动真实 AI 发散。
  const handleContinueFromOrigin = (ideaId: string): void => {
    if (!restoreIdeaOrigin(ideaId)) return;
    setViewOverride("map");
    void expandActiveMindNode();
  };

  return (
    <main className="cosmic-shell min-h-screen text-ink-900" data-app-view={view}>
      {view === "home" && <HomeView favoritesCount={favorites.length} hasMindMap={Boolean(mindMap)} interactionActive={homeInteractionActive} onInteractionChange={setHomeInteractionActive} onOpenIncubator={openIncubator} onReturnToMap={() => setViewOverride("map")} phaseIndex={homePhaseIndex} />}
      {view === "map" && (
        <>
          <MindMapCanvas onBackHome={() => setViewOverride("home")} />
          <AiWorkingStatus floating loading={loading} streamText={streamText} />
        </>
      )}
      {view === "ideas" && (
        <>
          <IdeasView favoritesCount={favorites.length} hasMindMap={Boolean(mindMap)} interactionLocked={loading !== "idle"} loading={loading} onBack={() => setViewOverride(mindMap ? "map" : "home")} onContinueFromOrigin={handleContinueFromOrigin} onDiscussionBranchCreated={() => setViewOverride("map")} onOpenIncubator={openIncubator} onReturnToOrigin={handleReturnToOrigin} />
          <AiWorkingStatus floating loading={loading} streamText={streamText} />
        </>
      )}
      {error && (
        <div className="fixed left-1/2 top-20 z-[70] max-w-xl -translate-x-1/2 rounded-lg border border-amber-300/40 bg-[#2b241b]/96 px-4 py-3 text-sm text-[#fff7df] shadow-2xl" role="alert">
          {error}
        </div>
      )}
      <IncubatorModal />
    </main>
  );
}

export default App;
