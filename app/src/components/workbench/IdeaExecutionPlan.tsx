// 这个文件展示三段执行计划，并通过可访问复选框更新完成状态。
import type { IdeaExecutionPlan as IdeaExecutionPlanType } from "../../types/idea";

interface IdeaExecutionPlanProps {
  plan: IdeaExecutionPlanType;
  onToggle: (taskId: string) => void;
  disabled?: boolean;
}

// 按时间跨度展示任务目标、构建内容和验证标准。
export function IdeaExecutionPlan({ plan, onToggle, disabled = false }: IdeaExecutionPlanProps): JSX.Element {
  return (
    <section className="border-t border-white/10 pt-7" aria-labelledby={`execution-plan-${plan.ideaId}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-spark-500">执行计划</p>
          <h2 id={`execution-plan-${plan.ideaId}`} className="mt-2 font-serif text-3xl leading-tight text-[#fff7df]">从一小时到一周</h2>
        </div>
        <p className="text-xs text-white/42">验证标准</p>
      </div>
      <ol className="mt-6 divide-y divide-white/10 border-y border-white/10">
        {plan.tasks.map((task) => (
          <li className="grid gap-4 py-5 md:grid-cols-[9rem_minmax(0,1fr)]" data-completed={task.completed} key={task.id}>
            <label className="flex cursor-pointer items-start gap-3 text-sm font-semibold text-[#fff7df]">
              <input
                aria-label={`${task.horizon}：${task.goal}`}
                checked={task.completed}
                className="mt-0.5 h-4 w-4 accent-[#ff8a3d]"
                disabled={disabled}
                type="checkbox"
                onChange={() => onToggle(task.id)}
              />
              <span className={task.completed ? "text-white/42 line-through" : undefined}>{task.horizon}</span>
            </label>
            <div className={task.completed ? "text-white/42" : "text-white/76"}>
              <p className="font-medium leading-6">{task.goal}</p>
              <p className="mt-2 text-sm leading-6"><span className="text-white/42">构建：</span>{task.build}</p>
              <p className="mt-1 text-sm leading-6"><span className="text-white/42">验证：</span>{task.proof}</p>
              <p className="mt-2 text-xs text-white/38">{task.completed ? "已完成" : "未完成"}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
