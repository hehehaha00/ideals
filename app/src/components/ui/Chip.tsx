// 这个文件展示可选、可锁定的维度词。
import { Lock, Unlock } from "lucide-react";
import { cn } from "../../lib/cn";
import type { DimensionGroupType } from "../../types/idea";

const GROUP_COLOR: Record<DimensionGroupType, string> = {
  人群: "bg-sky-100",
  场景: "bg-yellow-100",
  情绪: "bg-rose-100",
  物件: "bg-mint-100",
  结构: "bg-violet-100",
  限制: "bg-paper-100 border-dashed",
};

interface ChipProps {
  text: string;
  groupType: DimensionGroupType;
  selected: boolean;
  locked: boolean;
  onSelect: () => void;
  onToggleLock: () => void;
}

// 渲染单个维度词，点击文字选择，点击锁图标切换锁定。
export function Chip({ text, groupType, selected, locked, onSelect, onToggleLock }: ChipProps): JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex h-8 max-w-full items-center gap-1 rounded-full border border-transparent px-3 text-sm text-ink-900 transition",
        GROUP_COLOR[groupType],
        selected && "border-spark-500 ring-2 ring-spark-500/20",
        locked && "border-ink-700",
      )}
    >
      <button className="max-w-36 truncate hover:text-spark-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-500" type="button" onClick={onSelect} title={text}>
        {text}
      </button>
      <button className="rounded-full p-0.5 hover:bg-paper-0/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-500" type="button" onClick={onToggleLock} aria-label={locked ? "解锁词" : "锁定词"}>
        {locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}
