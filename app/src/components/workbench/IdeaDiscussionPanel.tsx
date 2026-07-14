// 这个文件在脑洞报告中展示按需召集的多角色讨论、灵感火花和三条收束方向。
import { Lightbulb, MessagesSquare, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import { IDEA_DISCUSSION_INTERVENTION_TYPES, IDEA_DISCUSSION_ROLES, type IdeaDiscussion, type IdeaDiscussionDirection, type IdeaDiscussionDirectionKey, type IdeaDiscussionInterventionType, type IdeaDiscussionLineup, type IdeaDiscussionMechanism, type IdeaDiscussionRole, type IdeaDiscussionRoundType, type IdeaDiscussionSetup } from "../../types/idea";

interface IdeaDiscussionPanelProps {
  discussions: IdeaDiscussion[];
  disabled: boolean;
  loading: "idle" | "discussion" | "discussionResponse" | "discussionBranch";
  onDiscuss: (setup: IdeaDiscussionSetup) => void;
  onStop: () => void;
  onCollectSpark: (discussionId: string, sparkId: string) => void;
  onContinueDirection: (discussionId: string, directionKey: IdeaDiscussionDirectionKey, opposite?: boolean) => Promise<boolean>;
  onRespond: (discussionId: string, input: { type: IdeaDiscussionInterventionType; prompt: string; targetRole: IdeaDiscussionRole; sourceRole?: IdeaDiscussionRole; sourceClaim?: string }) => void;
  onDiscussionBranchCreated?: () => void;
}

interface LockedViewpoint {
  role: IdeaDiscussionRole;
  claim: string;
}

const ROUND_LABELS: Record<IdeaDiscussionRoundType, string> = {
  judgment: "判断",
  collision: "碰撞",
  synthesis: "收束",
};

const LOADING_COPY = {
  discussion: ["正在准备三轮讨论", "各自判断 → 观点碰撞 → 方向收束"],
  discussionResponse: ["正在回应你的介入", "目标角色正在给出一轮有限回应"],
  discussionBranch: ["正在生成新的思维分支", "选定方向将爆发成 4-6 个新节点"],
} as const;

const DIRECTION_LABELS = [
  ["保守方向", "conservativeDirection"],
  ["激进方向", "radicalDirection"],
  ["意外方向", "unexpectedDirection"],
] as const;

const LINEUP_LABELS: Record<IdeaDiscussionLineup, string> = { standard: "标准圆桌", radical: "激进圆桌", practical: "落地圆桌", custom: "自定义圆桌" };
const MECHANISM_LABELS: Record<IdeaDiscussionMechanism, string> = { relay: "接力", refute: "反驳", vote: "站队", trade: "交易", extreme: "极端假设" };
const LINEUP_PARTICIPANTS: Record<Exclude<IdeaDiscussionLineup, "custom">, IdeaDiscussionRole[]> = {
  standard: ["用户代言人", "反常识派", "跨界连接者", "现实构建者"],
  radical: ["反常识派", "跨界连接者", "未来推演者"],
  practical: ["用户代言人", "现实构建者", "工程实现者"],
};

type DiscussionDirectionKey = (typeof DIRECTION_LABELS)[number][1];

// 渲染一条可选择但不会自动执行的讨论方向。
function DiscussionDirection({ label, direction, selected, disabled, onSelect }: { label: string; direction: IdeaDiscussionDirection; selected: boolean; disabled: boolean; onSelect: () => void }): JSX.Element {
  return (
    <button
      aria-label={`${label} ${direction.title}`}
      aria-pressed={selected}
      disabled={disabled}
      className={cn(
        "min-w-0 border-t border-white/10 px-3 py-5 text-left transition first:border-t-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-spark-500 md:border-l md:border-t-0 md:first:border-l-0",
        selected ? "bg-spark-500/10 text-white" : "hover:bg-white/[0.04]",
        "disabled:cursor-not-allowed disabled:opacity-45",
      )}
      type="button"
      onClick={onSelect}
    >
      <p className="text-xs text-spark-500/80">{label}</p>
      <h5 className="mt-2 min-w-0 break-words text-lg font-medium text-white/86">{direction.title}</h5>
      <p className="mt-2 min-w-0 break-words text-sm leading-6 text-white/64">{direction.description}</p>
      <p className="mt-3 text-xs text-white/42">下一步</p>
      <p className="mt-1 min-w-0 break-words text-sm leading-6 text-white/72">{direction.nextStep}</p>
    </button>
  );
}

// 展示最新一场编辑部讨论；用户明确采集后才把火花送回画布。
export function IdeaDiscussionPanel({ discussions, disabled, loading, onDiscuss, onStop, onCollectSpark, onContinueDirection, onRespond, onDiscussionBranchCreated }: IdeaDiscussionPanelProps): JSX.Element {
  const newestDiscussion = discussions.at(-1);
  const [selectedDiscussionId, setSelectedDiscussionId] = useState(newestDiscussion?.id);
  const [selectedDirections, setSelectedDirections] = useState<Record<string, DiscussionDirectionKey | undefined>>({});
  const selectedDiscussion = discussions.find((discussion) => discussion.id === selectedDiscussionId) ?? newestDiscussion;
  const busy = loading !== "idle";
  const visible = busy || Boolean(selectedDiscussion);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const previousLoadingRef = useRef(busy);
  const [completionAnnouncement, setCompletionAnnouncement] = useState("");
  const [intervention, setIntervention] = useState<{ type: IdeaDiscussionInterventionType; targetRole: IdeaDiscussionRole; prompt: string; sourceRole?: IdeaDiscussionRole; sourceClaim?: string }>();
  const [lockedViewpoint, setLockedViewpoint] = useState<LockedViewpoint>();
  const [lineup, setLineup] = useState<IdeaDiscussionLineup>("standard");
  const [mechanism, setMechanism] = useState<IdeaDiscussionMechanism>("relay");
  const [customParticipants, setCustomParticipants] = useState<IdeaDiscussionRole[]>(LINEUP_PARTICIPANTS.standard);
  const interventionCount = selectedDiscussion?.interventions.length ?? 0;
  const participants = lineup === "custom" ? customParticipants : LINEUP_PARTICIPANTS[lineup];

  // 新讨论完成并加入列表后自动展示最新一场。
  useEffect(() => {
    setSelectedDiscussionId(newestDiscussion?.id);
    setLockedViewpoint(undefined);
  }, [newestDiscussion?.id]);

  // 切换历史讨论时清掉上一场的锁定观点，避免把回应发到错误场次。
  useEffect(() => {
    setLockedViewpoint(undefined);
    setIntervention(undefined);
  }, [selectedDiscussionId]);

  // 请求结束后恢复到讨论入口；只有真实完成的新场次才播报一条短状态。
  useEffect(() => {
    const wasLoading = previousLoadingRef.current;
    if (wasLoading && !busy) {
      triggerRef.current?.focus();
      setCompletionAnnouncement(newestDiscussion?.status === "completed" ? "讨论完成，已生成三轮观点和三个新方向" : "");
    } else if (busy) {
      setCompletionAnnouncement("");
    }
    previousLoadingRef.current = busy;
  }, [newestDiscussion?.id, newestDiscussion?.status, busy]);

  const openIntervention = (type: IdeaDiscussionInterventionType, sourceRole?: IdeaDiscussionRole, sourceClaim?: string): void => {
    if (disabled || busy || !selectedDiscussion || interventionCount >= 3) return;
    setIntervention({ type, targetRole: sourceRole ?? "现实构建者", prompt: "", ...(sourceRole ? { sourceRole } : {}), ...(sourceClaim ? { sourceClaim } : {}) });
  };

  // 锁定观点只保留一条，保证讨论焦点明确且可随时替换。
  const toggleLockedViewpoint = (role: IdeaDiscussionRole, claim: string): void => {
    if (disabled || busy) return;
    setLockedViewpoint((current) => current?.role === role && current.claim === claim ? undefined : { role, claim });
  };
  const submitIntervention = (): void => {
    if (!intervention || !selectedDiscussion || !intervention.prompt.trim() || intervention.prompt.length > 180 || busy) return;
    onRespond(selectedDiscussion.id, { ...intervention, prompt: intervention.prompt.trim() });
  };

  const toggleCustomParticipant = (role: IdeaDiscussionRole): void => {
    setCustomParticipants((current) => current.includes(role) ? current.filter((item) => item !== role) : current.length < 4 ? [...current, role] : current);
  };

  return (
    <section className="mt-8 border-b border-white/10 pb-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs text-spark-500">创意编辑部</p>
          <p className="mt-1 text-sm text-white/58">让四种思维动作围绕这个脑洞发生碰撞。</p>
        </div>
        <button
          ref={triggerRef}
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/20 px-3 text-sm text-white/70 transition hover:border-spark-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-500 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={disabled || participants.length < 3}
          type="button"
          onClick={() => onDiscuss({ lineup, mechanism, participants })}
        >
          <MessagesSquare className="h-4 w-4" aria-hidden="true" />
          {newestDiscussion ? "再开一场" : "召集讨论"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 border-y border-white/10 py-4 md:grid-cols-2">
        <label className="text-xs text-white/52">讨论阵容<select aria-label="讨论阵容" value={lineup} disabled={busy} onChange={(event) => setLineup(event.target.value as IdeaDiscussionLineup)} className="mt-2 min-h-9 w-full rounded-md border border-white/15 bg-[#171310] px-3 text-sm text-white/80">{Object.entries(LINEUP_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-xs text-white/52">思维机制<select aria-label="思维机制" value={mechanism} disabled={busy} onChange={(event) => setMechanism(event.target.value as IdeaDiscussionMechanism)} className="mt-2 min-h-9 w-full rounded-md border border-white/15 bg-[#171310] px-3 text-sm text-white/80">{Object.entries(MECHANISM_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {lineup === "custom" && <fieldset className="md:col-span-2"><legend className="text-xs text-white/52">选择 3-4 个角色</legend><div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">{IDEA_DISCUSSION_ROLES.map((role) => <label className="inline-flex items-center gap-2 text-xs text-white/68" key={role}><input type="checkbox" checked={customParticipants.includes(role)} disabled={busy || (!customParticipants.includes(role) && customParticipants.length >= 4)} onChange={() => toggleCustomParticipant(role)} />{role}</label>)}</div></fieldset>}
      </div>

      {visible && (
        <section className="mt-6 border-t border-white/10 pt-5" aria-busy={busy} aria-label="创意编辑部讨论">
          {completionAnnouncement && <p aria-label="讨论完成" aria-live="polite" className="sr-only" role="status">{completionAnnouncement}</p>}
          {discussions.length > 1 && (
            <label className="mb-5 flex items-center justify-end gap-2 text-xs text-white/48">
              讨论历史
              <select
                aria-label="讨论历史"
                className="min-h-9 rounded-md border border-white/15 bg-[#171310] px-3 text-sm text-white/72 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-500"
                disabled={busy}
                value={selectedDiscussion?.id}
                onChange={(event) => setSelectedDiscussionId(event.target.value)}
              >
                {discussions.map((discussion, index) => (
                  <option key={discussion.id} value={discussion.id}>第 {index + 1} 场{index === discussions.length - 1 ? " · 最新" : ""}</option>
                ))}
              </select>
            </label>
          )}
          {busy && (
            <div className="flex flex-wrap items-center justify-between gap-4" role="status">
              <div>
                <p className="text-sm font-medium text-white/84">{LOADING_COPY[loading][0]}</p>
                <p className="mt-1 text-xs text-white/48">{LOADING_COPY[loading][1]}</p>
              </div>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-spark-500/50 px-3 text-sm text-spark-500 transition hover:border-spark-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-500"
                type="button"
                onClick={onStop}
              >
                <Square className="h-3.5 w-3.5" aria-hidden="true" />
                停止讨论
              </button>
            </div>
          )}

          {selectedDiscussion && (
            <div className={busy ? "mt-6 opacity-55" : undefined}>
              <p className="mb-4 text-xs text-white/42">{LINEUP_LABELS[selectedDiscussion.lineup ?? "standard"]} · {MECHANISM_LABELS[selectedDiscussion.mechanism ?? "relay"]} · {selectedDiscussion.participants.join("、")}</p>
              {lockedViewpoint && (
                <section className="mb-6 border-l-2 border-spark-500 bg-spark-500/[0.06] px-4 py-4" aria-label="已锁定观点">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-spark-500">已锁定观点 · {lockedViewpoint.role}</p>
                      <blockquote className="mt-2 break-words text-sm leading-6 text-white/82">“{lockedViewpoint.claim}”</blockquote>
                    </div>
                    <button type="button" disabled={disabled || busy} className="shrink-0 text-xs text-white/48 transition hover:text-white disabled:opacity-40" onClick={() => setLockedViewpoint(undefined)}>解除锁定</button>
                  </div>
                  {intervention ? (
                    <p className="mt-3 text-xs text-spark-500/80">已进入回应编辑，提交后将由指定角色回应这条观点。</p>
                  ) : (
                    <button type="button" disabled={disabled || busy || interventionCount >= 3} className="mt-3 min-h-9 border-b border-spark-500/50 pb-1 text-xs text-spark-500 transition hover:text-white disabled:opacity-40" onClick={() => openIntervention("question", lockedViewpoint.role, lockedViewpoint.claim)}>让编辑部回应</button>
                  )}
                </section>
              )}
              <ol>
                {selectedDiscussion.rounds.map((round) => (
                  <li className="grid min-w-0 gap-4 border-t border-white/10 py-6 first:border-t-0 md:grid-cols-[7rem_minmax(0,1fr)]" key={round.type}>
                    <p className="text-xs font-medium text-spark-500">{ROUND_LABELS[round.type]}</p>
                    <ol className="min-w-0">
                      {round.contributions.map((contribution, index) => {
                        const collected = contribution.spark ? selectedDiscussion.collectedSparkIds.includes(contribution.spark.id) : false;
                        return (
                          <li className="min-w-0 border-t border-white/[0.07] py-4 first:border-t-0 first:pt-0" key={`${contribution.role}-${index}`}>
                            <p className="text-xs text-white/46">{contribution.role}</p>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <blockquote className="mt-2 min-w-0 break-words text-base leading-7 text-white/80">“{contribution.claim}”</blockquote>
                              {interventionCount < 3 && <div className="flex shrink-0 flex-wrap gap-3 pt-2 text-xs text-white/46">
                                <button type="button" aria-pressed={lockedViewpoint?.role === contribution.role && lockedViewpoint.claim === contribution.claim} disabled={disabled || busy} onClick={() => toggleLockedViewpoint(contribution.role, contribution.claim)} className="transition hover:text-spark-500 disabled:cursor-not-allowed disabled:opacity-40">{lockedViewpoint?.role === contribution.role && lockedViewpoint.claim === contribution.claim ? "已锁定" : "锁定观点"}</button>
                                <button type="button" disabled={disabled || busy} onClick={() => openIntervention("question", contribution.role, contribution.claim)} className="transition hover:text-spark-500 disabled:cursor-not-allowed disabled:opacity-40">追问 {contribution.role}</button>
                                <button type="button" disabled={disabled || busy} onClick={() => openIntervention("disagree", contribution.role, contribution.claim)} className="transition hover:text-spark-500 disabled:cursor-not-allowed disabled:opacity-40">不同意</button>
                              </div>}
                            </div>
                            <p className="mt-2 min-w-0 break-words border-l border-white/20 pl-3 text-sm leading-6 text-white/58">{contribution.tension}</p>
                            {contribution.spark && (
                              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-l border-spark-500/50 pl-3">
                                <p className="flex min-w-0 break-words items-start gap-2 text-sm leading-6 text-white/74">
                                  <Lightbulb className="mt-1 h-3.5 w-3.5 shrink-0 text-spark-500" aria-hidden="true" />
                                  {contribution.spark.text}
                                </p>
                                <button
                                  aria-label={`${collected ? "已采集" : "采集到画布"} ${contribution.spark.text}`}
                                  className="min-h-9 shrink-0 text-xs text-spark-500 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-500 disabled:cursor-not-allowed disabled:text-white/36"
                                  disabled={disabled || collected}
                                  type="button"
                                  onClick={() => onCollectSpark(selectedDiscussion.id, contribution.spark!.id)}
                                >
                                  {collected ? "已采集" : "采集到画布"}
                                </button>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  </li>
                ))}
              </ol>

              {selectedDiscussion.synthesis && (
                <section className="mt-2 border-t border-white/15 pt-6" aria-label="讨论方向">
                  <h4 className="text-sm font-semibold text-white/84">三个可继续发展的方向</h4>
                  <div className="mt-3 grid md:grid-cols-3" role="group" aria-label="选择讨论方向">
                    {DIRECTION_LABELS.map(([label, key]) => (
                      <DiscussionDirection
                        direction={selectedDiscussion.synthesis![key]}
                        key={key}
                        label={label}
                        selected={selectedDirections[selectedDiscussion.id] === key}
                        disabled={disabled || busy}
                        onSelect={() => setSelectedDirections((current) => ({ ...current, [selectedDiscussion.id]: key }))}
                      />
                    ))}
                  </div>
                  {selectedDirections[selectedDiscussion.id] && (
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button type="button" disabled={disabled || busy} className="min-h-10 rounded-md bg-spark-500 px-4 text-sm font-semibold text-[#21140c] transition hover:bg-spark-400 disabled:cursor-not-allowed disabled:opacity-40" onClick={() => {
                        const directionKey = selectedDirections[selectedDiscussion.id];
                        if (!directionKey) return;
                        void onContinueDirection(selectedDiscussion.id, directionKey).then((succeeded) => { if (succeeded) onDiscussionBranchCreated?.(); });
                      }}>沿这个方向继续</button>
                      <button type="button" disabled={disabled || busy} className="min-h-10 rounded-md border border-spark-500/60 px-4 text-sm text-spark-500 transition hover:bg-spark-500/10 disabled:cursor-not-allowed disabled:opacity-40" onClick={() => {
                        const directionKey = selectedDirections[selectedDiscussion.id];
                        if (!directionKey) return;
                        void onContinueDirection(selectedDiscussion.id, directionKey, true).then((succeeded) => { if (succeeded) onDiscussionBranchCreated?.(); });
                      }}>生成对立方向</button>
                    </div>
                  )}
                </section>
              )}

              {interventionCount > 0 && (
                <section className="mt-8 min-w-0 border-t border-white/15 pt-6" aria-label="用户介入">
                  <div className="flex items-center justify-between gap-3"><h4 className="text-sm font-semibold text-spark-500">用户介入</h4><span className="text-xs text-white/42">{interventionCount} / 3</span></div>
                  <ol className="mt-3 border-l border-spark-500/40 pl-4">
                    {selectedDiscussion.interventions.map((item) => (
                      <li className="min-w-0 border-t border-white/[0.07] py-4 first:border-t-0 first:pt-0" key={item.id}>
                        <p className="text-xs text-white/46">{item.type === "question" ? "追问" : item.type === "disagree" ? "不同意" : "补充"} · {item.targetRole}</p>
                        <p className="mt-2 min-w-0 break-words text-sm leading-6 text-white/72">{item.prompt}</p>
                        {item.responses.map((response, index) => (
                          <div className="mt-3 min-w-0" key={`${item.id}-${response.role}-${index}`}><p className="text-xs text-white/46">{response.role}</p><p className="mt-1 min-w-0 break-words text-sm leading-6 text-white/80">{response.claim}</p><p className="mt-1 min-w-0 break-words text-xs leading-5 text-white/52">{response.tension}</p></div>
                        ))}
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {interventionCount >= 3 ? (
                <p className="mt-5 text-xs text-white/42">本场讨论已完成 3 次用户介入</p>
              ) : (
                <button type="button" disabled={disabled || busy} className="mt-6 min-h-10 border-b border-white/25 pb-1 text-sm text-white/65 transition hover:border-spark-500 hover:text-spark-500 disabled:cursor-not-allowed disabled:opacity-40" onClick={() => openIntervention("add")}>加入讨论</button>
              )}

              {intervention && (
                <form aria-label="加入讨论" className="mt-5 border-t border-white/10 pt-5" onSubmit={(event) => { event.preventDefault(); submitIntervention(); }}>
                  {intervention.sourceClaim && <p className="mb-3 border-l border-white/20 pl-3 text-xs leading-5 text-white/48">回应观点：“{intervention.sourceClaim}”</p>}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs text-white/52">介入动作<select aria-label="介入动作" value={intervention.type} disabled={busy} onChange={(event) => setIntervention({ ...intervention, type: event.target.value as IdeaDiscussionInterventionType })} className="mt-2 min-h-9 w-full rounded-md border border-white/15 bg-[#171310] px-2 text-sm text-white/80"><option value={IDEA_DISCUSSION_INTERVENTION_TYPES[0]}>追问</option><option value={IDEA_DISCUSSION_INTERVENTION_TYPES[1]}>不同意</option><option value={IDEA_DISCUSSION_INTERVENTION_TYPES[2]}>补充</option></select></label>
                    <label className="text-xs text-white/52">回应角色<select aria-label="回应角色" value={intervention.targetRole} disabled={busy} onChange={(event) => setIntervention({ ...intervention, targetRole: event.target.value as IdeaDiscussionRole })} className="mt-2 min-h-9 w-full rounded-md border border-white/15 bg-[#171310] px-2 text-sm text-white/80">{IDEA_DISCUSSION_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}</select></label>
                  </div>
                  <label className="mt-3 block text-xs text-white/52">你的想法<textarea aria-label="你的想法" value={intervention.prompt} maxLength={180} disabled={busy} onChange={(event) => setIntervention({ ...intervention, prompt: event.target.value })} className="mt-2 min-h-20 w-full resize-y rounded-md border border-white/15 bg-[#171310] p-3 text-sm leading-6 text-white/80 placeholder:text-white/35" placeholder="一句话告诉编辑部你想追问、反驳或补充什么" /></label>
                  <div className="mt-3 flex gap-3"><button type="submit" disabled={busy || !intervention.prompt.trim()} className="min-h-10 rounded-md bg-spark-500 px-4 text-sm font-semibold text-[#21140c] transition hover:bg-spark-400 disabled:cursor-not-allowed disabled:opacity-40">请编辑部回应</button><button type="button" disabled={busy} className="min-h-10 text-sm text-white/52 hover:text-white" onClick={() => setIntervention(undefined)}>取消</button></div>
                </form>
              )}
            </div>
          )}

        </section>
      )}
    </section>
  );
}
