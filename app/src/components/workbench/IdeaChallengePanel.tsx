// 这个文件在脑洞报告中按需展示反共识角色选择和连续式编辑部批注。
import { MessageCircle, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { IDEA_CHALLENGE_ROLES, type IdeaChallenge, type IdeaChallengeRole } from "../../types/idea";

interface IdeaChallengePanelProps {
  challenges: IdeaChallenge[];
  disabled: boolean;
  loading: boolean;
  onChallenge: (role: IdeaChallengeRole) => void;
}

// 渲染次级挑战入口、五个角色和已经生成的编辑部批注。
export function IdeaChallengePanel({ challenges, disabled, loading, onChallenge }: IdeaChallengePanelProps): JSX.Element {
  const [chooserOpen, setChooserOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const roleRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (disabled && !loading) {
      setChooserOpen(false);
      return;
    }
    if (chooserOpen && !disabled) roleRefs.current[0]?.focus();
  }, [chooserOpen, disabled, loading]);

  // 关闭角色选择并把焦点还给次级入口。
  function closeChooser(): void {
    setChooserOpen(false);
    triggerRef.current?.focus();
  }

  // 支持 Escape、方向键和首尾键在五个角色之间移动。
  function handleRoleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape") {
      event.preventDefault();
      closeChooser();
      return;
    }
    if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"].includes(event.key)) return;

    event.preventDefault();
    const currentIndex = roleRefs.current.findIndex((button) => button === document.activeElement);
    const lastIndex = IDEA_CHALLENGE_ROLES.length - 1;
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? lastIndex
        : event.key === "ArrowDown" || event.key === "ArrowRight"
          ? (Math.max(0, currentIndex) + 1) % IDEA_CHALLENGE_ROLES.length
          : currentIndex <= 0 ? lastIndex : currentIndex - 1;
    roleRefs.current[nextIndex]?.focus();
  }

  return (
    <section className="mt-8 border-y border-white/10 py-5" aria-label="反共识挑战">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs text-spark-500">反共识挑战</p>
          {challenges.length > 0 && <p className="mt-1 text-sm text-white/58">编辑部批注 {challenges.length} 条</p>}
        </div>
        <button
          ref={triggerRef}
          aria-controls="idea-challenge-role-chooser"
          aria-expanded={chooserOpen}
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/20 px-3 text-sm text-white/70 transition hover:border-spark-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-500 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={disabled}
          type="button"
          onClick={() => setChooserOpen((current) => !current)}
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          换个立场
        </button>
      </div>

      {chooserOpen && (
        <div
          className="mt-4 border-t border-white/10 pt-4"
        >
          <div
            aria-busy={loading}
            aria-label="选择挑战角色"
            id="idea-challenge-role-chooser"
            role="group"
            onKeyDown={handleRoleKeyDown}
          >
            <div className="grid grid-cols-2 border border-white/10 sm:grid-cols-5">
              {IDEA_CHALLENGE_ROLES.map((role, index) => (
                <button
                  ref={(element) => { roleRefs.current[index] = element; }}
                  className="min-h-11 border-b border-r border-white/10 px-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-spark-500 disabled:cursor-not-allowed disabled:opacity-40 sm:border-b-0"
                  disabled={disabled}
                  key={role}
                  type="button"
                  onClick={() => onChallenge(role)}
                >
                  {role}
                </button>
              ))}
            </div>
            {loading && <p className="mt-3 text-xs text-white/58" role="status">正在从这个立场重新审视</p>}
          </div>
          <button
            aria-label="关闭挑战角色选择"
            className="mt-3 inline-flex h-8 items-center gap-2 text-xs text-white/52 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-spark-500 disabled:opacity-40"
            disabled={disabled}
            title="关闭"
            type="button"
            onClick={closeChooser}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            收起
          </button>
        </div>
      )}

      {challenges.length > 0 && (
        <section className="mt-6" aria-label="反共识批注" aria-live="polite">
          <h4 className="text-sm font-semibold text-spark-500">编辑部批注</h4>
          <ol className="mt-3">
            {challenges.map((challenge) => (
              <li className="grid gap-3 border-t border-white/10 py-5 md:grid-cols-[8rem_minmax(0,1fr)]" key={challenge.role}>
                <p className="text-xs font-medium text-white/48">{challenge.role}</p>
                <div>
                  <p className="text-xs text-white/42">质疑</p>
                  <blockquote className="mt-1 text-base leading-7 text-white/78">“{challenge.challenge}”</blockquote>
                  <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2">
                    <div className="border-l border-white/20 pl-3">
                      <dt className="text-xs text-white/42">风险</dt>
                      <dd className="mt-1 leading-6 text-white/66">{challenge.risk}</dd>
                    </div>
                    <div className="border-l border-spark-500/50 pl-3">
                      <dt className="text-xs text-spark-500/80">新方向</dt>
                      <dd className="mt-1 leading-6 text-white/72">{challenge.newDirection}</dd>
                    </div>
                  </dl>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
      {challenges.length === 0 && !chooserOpen && !loading && (
        <p className="idea-report-empty-state">还没有挑战结果。选择一个角色，看看它会从哪里拆解这个想法。</p>
      )}
    </section>
  );
}
