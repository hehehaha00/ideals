// 这个文件展示当前六类词的碰撞组合，并触发脑洞生成。
import { GitMerge, Shuffle } from "lucide-react";
import { useIdeaStore } from "../../store/ideaStore";
import { DIMENSION_GROUPS } from "../../types/idea";
import { Button } from "../ui/Button";

// 渲染碰撞台。
export function CollisionTray(): JSX.Element | null {
  const groups = useIdeaStore((state) => state.groups);
  const loading = useIdeaStore((state) => state.loading);
  const recommendCollision = useIdeaStore((state) => state.recommendCollision);
  const generateIdeas = useIdeaStore((state) => state.generateIdeas);
  const selected = groups.flatMap((group) => group.words.filter((word) => word.selected));

  if (groups.length === 0) {
    return null;
  }

  return (
    <section className="mt-6 rounded-lg border border-line-100 bg-paper-0 p-5" aria-labelledby="collision-tray-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="collision-tray-title" className="font-serif text-3xl leading-tight">
            碰撞台
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {DIMENSION_GROUPS.map((type) => {
            const word = selected.find((item) => item.groupType === type);
            return (
              <span key={type} className="rounded-full bg-paper-100 px-3 py-1.5 text-sm text-ink-700">
                {word?.text ?? type}
              </span>
            );
          })}
        </div>
      </div>
      <p className="mt-5 rounded-md bg-paper-100 p-4 text-sm leading-7 text-ink-700">
        {selected.length === 6
          ? `给“${selected[0]?.text}”，在“${selected[1]?.text}”时，带着“${selected[2]?.text}”，用“${selected[3]?.text}”和“${selected[4]?.text}”结构，做一个“${selected[5]?.text}”的产品。`
          : "每类选一个词后，就可以把它们撞一下。"}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" icon={<Shuffle className="h-4 w-4" />} disabled={groups.length === 0 || loading !== "idle"} onClick={() => void recommendCollision()}>
          AI 推荐碰撞
        </Button>
        <Button variant="primary" icon={<GitMerge className="h-4 w-4" />} disabled={selected.length !== 6 || loading !== "idle"} onClick={() => void generateIdeas()}>
          把这些词撞一下
        </Button>
      </div>
    </section>
  );
}
