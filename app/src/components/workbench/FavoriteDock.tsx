// 这个文件展示本地收藏的脑洞孵化箱。
import { Bookmark } from "lucide-react";
import { useEffect } from "react";
import { useIdeaStore } from "../../store/ideaStore";
import { Panel } from "../ui/Panel";

// 渲染收藏列表，并在首次加载时恢复 localStorage 数据。
export function FavoriteDock(): JSX.Element {
  const favorites = useIdeaStore((state) => state.favorites);
  const hydrate = useIdeaStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <Panel eyebrow="Incubator" title="孵化箱">
      {favorites.length === 0 && <p className="text-sm leading-6 text-ink-500">先收藏一个有生命力的脑洞，它会在这里继续发酵。</p>}
      <div className="space-y-2">
        {favorites.map((favorite) => (
          <article key={favorite.idea.id} className="rounded-lg bg-mint-100 p-3">
            <div className="flex items-center gap-2">
              <Bookmark className="h-4 w-4 shrink-0 text-ink-700" />
              <h3 className="break-words font-medium">{favorite.idea.title}</h3>
            </div>
            <p className="mt-2 break-words text-sm leading-6 text-ink-700">{favorite.idea.summary}</p>
          </article>
        ))}
      </div>
    </Panel>
  );
}
