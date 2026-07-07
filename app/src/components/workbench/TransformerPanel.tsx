// 这个文件提供对当前脑洞的六种变形操作。
import { WandSparkles } from "lucide-react";
import { useIdeaStore } from "../../store/ideaStore";
import { TRANSFORM_DIRECTIONS } from "../../types/idea";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";

// 渲染变形器面板。
export function TransformerPanel(): JSX.Element {
  const ideas = useIdeaStore((state) => state.ideas);
  const activeIdeaId = useIdeaStore((state) => state.activeIdeaId);
  const loading = useIdeaStore((state) => state.loading);
  const transformActiveIdea = useIdeaStore((state) => state.transformActiveIdea);
  const activeIdea = ideas.find((idea) => idea.id === activeIdeaId);

  return (
    <Panel eyebrow="Transform" title="变形器">
      {!activeIdea && <p className="text-sm leading-6 text-ink-500">选中一张脑洞卡片，再换一个角度扭它。</p>}
      {activeIdea && <p className="mb-3 break-words text-sm leading-6 text-ink-700">正在变形：{activeIdea.title}</p>}
      <div className="grid gap-2">
        {TRANSFORM_DIRECTIONS.map((direction) => (
          <Button key={direction} variant="secondary" icon={<WandSparkles className="h-4 w-4" />} disabled={!activeIdea || loading !== "idle"} onClick={() => void transformActiveIdea(direction)}>
            {direction}
          </Button>
        ))}
      </div>
    </Panel>
  );
}
