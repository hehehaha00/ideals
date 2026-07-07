// 这个文件展示当前生成的脑洞卡片列表。
import { useIdeaStore } from "../../store/ideaStore";
import { Panel } from "../ui/Panel";
import { IdeaCard } from "./IdeaCard";

// 渲染脑洞卡片列表和空状态。
export function IdeaCardList(): JSX.Element {
  const ideas = useIdeaStore((state) => state.ideas);
  const loading = useIdeaStore((state) => state.loading);

  return (
    <Panel eyebrow="Ideas" title="脑洞卡片">
      {loading === "ideas" && <p className="text-sm text-ink-500">正在碰撞这些词。</p>}
      {ideas.length === 0 && loading !== "ideas" && <p className="text-sm leading-6 text-ink-500">脑洞会从碰撞台下面长出来。</p>}
      <div className="space-y-3">
        {ideas.map((idea) => (
          <IdeaCard key={idea.id} idea={idea} />
        ))}
      </div>
    </Panel>
  );
}
