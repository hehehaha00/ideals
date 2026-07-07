// 这个文件展示六类维度词，并支持选择、锁定和重掷。
import { Shuffle } from "lucide-react";
import { useIdeaStore } from "../../store/ideaStore";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";
import { Panel } from "../ui/Panel";

// 渲染维度词面板。
export function DimensionBoard(): JSX.Element {
  const groups = useIdeaStore((state) => state.groups);
  const loading = useIdeaStore((state) => state.loading);
  const selectWord = useIdeaStore((state) => state.selectWord);
  const toggleWordLock = useIdeaStore((state) => state.toggleWordLock);
  const rerollUnlockedWords = useIdeaStore((state) => state.rerollUnlockedWords);

  if (groups.length === 0) {
    return (
      <Panel eyebrow="Words" title="维度词">
        <p className="text-sm leading-6 text-ink-500">输入主题后，这里会出现六组可以碰撞的词。</p>
      </Panel>
    );
  }

  return (
    <Panel eyebrow="Words" title="维度词">
      <div className="mb-4 flex justify-end">
        <Button variant="secondary" icon={<Shuffle className="h-4 w-4" />} disabled={loading !== "idle"} onClick={() => void rerollUnlockedWords()}>
          换一批刺激
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((group) => (
          <section key={group.type} className="rounded-lg bg-paper-50 p-4">
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
    </Panel>
  );
}
