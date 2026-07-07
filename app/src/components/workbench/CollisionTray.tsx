// 这个文件展示当前六类词的碰撞组合，并触发脑洞生成。
import { GitMerge, Shuffle } from "lucide-react";
import { useIdeaStore } from "../../store/ideaStore";
import { DIMENSION_GROUPS } from "../../types/idea";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";

// 渲染碰撞台。
export function CollisionTray(): JSX.Element {
  const groups = useIdeaStore((state) => state.groups);
  const loading = useIdeaStore((state) => state.loading);
  const randomizeCollision = useIdeaStore((state) => state.randomizeCollision);
  const generateIdeas = useIdeaStore((state) => state.generateIdeas);
  const selected = groups.flatMap((group) => group.words.filter((word) => word.selected));

  return (
    <Panel eyebrow="Collision" title="碰撞台">
      <div className="grid gap-2 md:grid-cols-3">
        {DIMENSION_GROUPS.map((type) => {
          const word = selected.find((item) => item.groupType === type);
          return (
            <div key={type} className="rounded-lg border border-dashed border-line-100 bg-paper-50 p-3">
              <p className="text-xs text-ink-500">{type}</p>
              <p className="mt-1 min-h-6 break-words font-medium">{word?.text ?? "还没选"}</p>
            </div>
          );
        })}
      </div>
      <p className="mt-4 rounded-lg bg-paper-100 p-3 text-sm leading-6 text-ink-700">
        {selected.length === 6
          ? `给“${selected[0]?.text}”，在“${selected[1]?.text}”时，带着“${selected[2]?.text}”，用“${selected[3]?.text}”和“${selected[4]?.text}”结构，做一个“${selected[5]?.text}”的产品。`
          : "每类选一个词后，就可以把它们撞一下。"}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" icon={<Shuffle className="h-4 w-4" />} disabled={groups.length === 0} onClick={randomizeCollision}>
          随机组合
        </Button>
        <Button variant="primary" icon={<GitMerge className="h-4 w-4" />} disabled={selected.length !== 6 || loading !== "idle"} onClick={() => void generateIdeas()}>
          把这些词撞一下
        </Button>
      </div>
    </Panel>
  );
}
