// 这个文件展示单张脑洞卡片，并提供选中和收藏操作。
import { Bookmark, WandSparkles } from "lucide-react";
import { cn } from "../../lib/cn";
import { useIdeaStore } from "../../store/ideaStore";
import type { IdeaCard as IdeaCardType } from "../../types/idea";
import { Button } from "../ui/Button";

interface IdeaCardProps {
  idea: IdeaCardType;
}

// 渲染一张脑洞卡片。
export function IdeaCard({ idea }: IdeaCardProps): JSX.Element {
  const activeIdeaId = useIdeaStore((state) => state.activeIdeaId);
  const favorites = useIdeaStore((state) => state.favorites);
  const setActiveIdea = useIdeaStore((state) => state.setActiveIdea);
  const toggleFavorite = useIdeaStore((state) => state.toggleFavorite);
  const isFavorite = favorites.some((favorite) => favorite.idea.id === idea.id);

  return (
    <article className={cn("rounded-lg border bg-paper-0 p-5 transition", activeIdeaId === idea.id ? "border-spark-500 shadow-soft" : "border-line-100")}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="break-words font-serif text-2xl leading-8">{idea.title}</h3>
          <p className="mt-2 break-words text-sm leading-6 text-ink-700">{idea.summary}</p>
        </div>
        <Button variant="ghost" onClick={() => setActiveIdea(idea.id)} icon={<WandSparkles className="h-4 w-4" />}>
          选中
        </Button>
      </div>
      <p className="mt-4 break-words text-sm leading-6 text-ink-700">{idea.whyInteresting}</p>
      <p className="mt-3 break-words rounded-md bg-paper-50 p-3 text-sm leading-6 text-ink-700">{idea.firstVersion}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {idea.sourceWords.map((word) => (
          <span key={word.id} className="rounded-full bg-paper-100 px-2.5 py-1 text-xs text-ink-700">
            {word.text}
          </span>
        ))}
      </div>
      <div className="mt-4">
        <Button variant={isFavorite ? "primary" : "secondary"} icon={<Bookmark className="h-4 w-4" />} onClick={() => toggleFavorite(idea.id)}>
          {isFavorite ? "已收藏" : "收藏"}
        </Button>
      </div>
    </article>
  );
}
