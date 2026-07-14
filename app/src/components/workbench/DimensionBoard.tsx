// 这个文件展示六类维度词，并支持选择、锁定和重掷。
import { Shuffle } from "lucide-react";
import { useIdeaStore } from "../../store/ideaStore";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";

// 渲染维度词面板。
export function DimensionBoard(): JSX.Element | null {
  const groups = useIdeaStore((state) => state.groups);
  const loading = useIdeaStore((state) => state.loading);
  const selectWord = useIdeaStore((state) => state.selectWord);
  const toggleWordLock = useIdeaStore((state) => state.toggleWordLock);
  const rerollUnlockedWords = useIdeaStore((state) => state.rerollUnlockedWords);

  if (groups.length === 0) {
    return null;
  }

  return (
    <section className="mt-5" aria-labelledby="dimension-board-title">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="dimension-board-title" className="font-serif text-3xl leading-tight">
            维度词
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-500">每组挑一个词，保留一点不顺手的摩擦感。</p>
        </div>
        <Button variant="secondary" icon={<Shuffle className="h-4 w-4" />} disabled={loading !== "idle"} onClick={() => void rerollUnlockedWords()}>
          换一批刺激
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((group) => (
          <section key={group.type} className="rounded-md border border-line-100 bg-paper-0 p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold">{group.label}</h3>
              <p className="text-xs text-ink-500">{group.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {group.words.map((word) => (
                <Chip
                  key={word.id}
                  text={word.text}
                  groupType={word.groupType}
                  selected={word.selected}
                  locked={word.locked}
                  onSelect={() => selectWord(word.id)}
                  onToggleLock={() => toggleWordLock(word.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
