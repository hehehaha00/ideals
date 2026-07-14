// 这个文件把脑洞和炼化结果压缩成首屏可扫描的决策简报。
import type { IdeaCard, IdeaRefinement } from "../../types/idea";

interface IdeaDecisionBriefProps {
  idea: IdeaCard;
  refinement: IdeaRefinement;
}

// 连续展示开工前必须确认的四项信息，不额外套卡片。
export function IdeaDecisionBrief({ idea, refinement }: IdeaDecisionBriefProps): JSX.Element {
  const firstExperiment = refinement.mvpLadder.find((step) => step.horizon === "1小时 MVP") ?? refinement.mvpLadder[0];

  return (
    <section className="border-y border-white/10 py-7" aria-labelledby={`decision-brief-${idea.id}`}>
      <header className="max-w-3xl">
        <p className="text-xs font-medium text-spark-500">开工决策简报</p>
        <h2 id={`decision-brief-${idea.id}`} className="mt-2 break-words font-serif text-3xl leading-tight text-[#fff7df]">
          {idea.title}
        </h2>
      </header>
      <dl className="mt-6 grid gap-x-8 gap-y-6 md:grid-cols-2">
        <div className="border-t border-white/10 pt-3">
          <dt className="text-xs font-medium text-white/46">目标用户</dt>
          <dd className="mt-2 text-base leading-7 text-white/82">{refinement.vitality.targetUser}</dd>
        </div>
        <div className="border-t border-white/10 pt-3">
          <dt className="text-xs font-medium text-white/46">核心价值</dt>
          <dd className="mt-2 text-base leading-7 text-white/82">{idea.whyInteresting}</dd>
        </div>
        <div className="border-t border-white/10 pt-3">
          <dt className="text-xs font-medium text-white/46">最大未知</dt>
          <dd className="mt-2 text-base leading-7 text-white/82">{firstExperiment?.goal ?? refinement.vitality.existingAlternative}</dd>
        </div>
        <div className="border-t border-white/10 pt-3">
          <dt className="text-xs font-medium text-white/46">第一项实验</dt>
          <dd className="mt-2 text-base leading-7 text-white/82">{firstExperiment?.build ?? refinement.vitality.smallestPlayableVersion}</dd>
          {firstExperiment && <p className="mt-2 text-sm leading-6 text-white/54">验证标准：{firstExperiment.proof}</p>}
        </div>
      </dl>
    </section>
  );
}
