// 这个文件把炼化结果排成连续报告正文，减少嵌套卡片。
import type { IdeaRefinement, RefinementActionType, RefinementRole } from "../../types/idea";

interface IdeaRefineryProps { refinement?: IdeaRefinement; selectedAction?: RefinementActionType; loading: boolean; }
const ROLE_LABEL: Record<RefinementRole, string> = { 懒人用户: "懒人用户", 毒舌用户: "毒舌用户", 产品经理: "产品经理", 工程师: "工程师", 测试: "测试", 商人: "商人" };

// 渲染尚未生成炼化结果时的入口。
export function IdeaRefinery({ refinement, selectedAction, loading }: IdeaRefineryProps): JSX.Element {
  if (!refinement) return <div className="mt-8 border-y border-white/10 py-6"><p className="text-xs text-spark-500">深入验证</p><p className="mt-2 text-sm text-white/58">{loading ? "正在把想法拆成用户、方向和可执行时间线。" : "验证后会补齐用户、方向和可执行时间线。"}</p></div>;

  const vitality = [["目标用户", refinement.vitality.targetUser], ["触发场景", refinement.vitality.triggerScene], ["核心情绪", refinement.vitality.coreEmotion], ["已有替代", refinement.vitality.existingAlternative], ["最小可玩", refinement.vitality.smallestPlayableVersion]];
  return <section className="idea-refinement mt-8" aria-labelledby={`refinement-${refinement.id}`}>
    <header className="border-y border-white/10 py-5"><p className="text-xs text-spark-500">炼化报告</p><h4 id={`refinement-${refinement.id}`} className="mt-2 font-serif text-2xl">生命力与推进路径</h4></header>
    <dl className="grid gap-x-8 gap-y-5 border-b border-white/10 py-6 md:grid-cols-2">{vitality.map(([label, value]) => <div key={label}><dt className="text-xs text-white/42">{label}</dt><dd className="mt-1 leading-6 text-white/74">{value}</dd></div>)}</dl>
    <section className="border-b border-white/10 py-7" aria-labelledby={`directions-${refinement.id}`}><h5 id={`directions-${refinement.id}`} className="text-sm font-semibold text-spark-500">三种落地方向</h5><table className="mt-4 w-full text-left text-sm"><thead className="text-white/42"><tr><th scope="col" className="pb-3 pr-4 font-normal">方向</th><th scope="col" className="pb-3 pr-4 font-normal">做法</th><th scope="col" className="pb-3 font-normal">第一步</th></tr></thead><tbody>{refinement.directions.map((direction) => <tr key={direction.type} className="border-t border-white/10 align-top"><th scope="row" className="py-4 pr-4 font-medium text-white/80">{direction.type}<br /><span className="font-normal text-white/56">{direction.title}</span></th><td className="py-4 pr-4 leading-6 text-white/68">{direction.description}</td><td className="py-4 leading-6 text-white/68">{direction.firstStep}</td></tr>)}</tbody></table></section>
    <section className="border-b border-white/10 py-7" aria-labelledby={`timeline-${refinement.id}`}><h5 id={`timeline-${refinement.id}`} className="text-sm font-semibold text-spark-500">1 小时 / 1 天 / 1 周执行时间线</h5><ol className="mt-4 grid gap-5 md:grid-cols-3">{refinement.mvpLadder.map((step) => <li key={step.horizon} className="border-l border-spark-500/50 pl-4"><p className="font-medium text-white/82">{step.horizon}</p><p className="mt-2 text-sm leading-6 text-white/64">{step.goal}</p><p className="mt-2 text-sm leading-6 text-white/64">{step.build}</p><p className="mt-2 text-xs leading-5 text-spark-500/80">验证：{step.proof}</p></li>)}</ol></section>
    <section className="border-b border-white/10 py-7" aria-labelledby={`roundtable-${refinement.id}`}><h5 id={`roundtable-${refinement.id}`} className="text-sm font-semibold text-spark-500">编辑部批注</h5><div className="mt-4 grid gap-5 md:grid-cols-2">{refinement.roundtable.map((item) => <blockquote key={item.role} className="border-l border-white/20 pl-4"><cite className="text-xs not-italic text-white/45">{ROLE_LABEL[item.role]}</cite><p className="mt-2 leading-6 text-white/70">“{item.feedback}”</p></blockquote>)}</div></section>
    {selectedAction && <p className="border-t border-white/10 py-5 text-sm leading-6 text-white/62">{refinement.actions.find((action) => action.type === selectedAction)?.description}</p>}
  </section>;
}
