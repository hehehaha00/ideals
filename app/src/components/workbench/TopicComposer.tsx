// 这个文件提供主题输入和发散强度选择。
import { Sparkles } from "lucide-react";
import { cn } from "../../lib/cn";
import { useIdeaStore } from "../../store/ideaStore";
import type { Intensity } from "../../types/idea";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";

const INTENSITIES: Intensity[] = ["轻微", "正常", "狂野"];

// 渲染主题输入区，并触发维度词生成。
export function TopicComposer(): JSX.Element {
  const topic = useIdeaStore((state) => state.topic);
  const intensity = useIdeaStore((state) => state.intensity);
  const loading = useIdeaStore((state) => state.loading);
  const setTopic = useIdeaStore((state) => state.setTopic);
  const setIntensity = useIdeaStore((state) => state.setIntensity);
  const generateWords = useIdeaStore((state) => state.generateWords);

  return (
    <Panel eyebrow="Start" title="先给我一个模糊方向">
      <label className="mb-2 block text-sm font-medium text-ink-700" htmlFor="topic-input">
        主题
      </label>
      <textarea
        className="min-h-28 w-full resize-none rounded-lg border border-line-100 bg-paper-50 p-4 text-base leading-7 outline-none transition focus:border-spark-500 focus:ring-2 focus:ring-spark-500/20"
        id="topic-input"
        value={topic}
        onChange={(event) => setTopic(event.target.value)}
        placeholder="例如：我想做一个有趣的开发者工具"
      />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-line-100 bg-paper-100 p-1" aria-label="发散强度">
          {INTENSITIES.map((item) => (
            <button
              key={item}
              className={cn("rounded px-3 py-1.5 text-sm transition", intensity === item ? "bg-paper-0 text-spark-600 shadow-sm" : "text-ink-500 hover:text-ink-900")}
              type="button"
              onClick={() => setIntensity(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <Button variant="primary" icon={<Sparkles className="h-4 w-4" />} disabled={topic.trim().length < 2 || loading !== "idle"} onClick={() => void generateWords()}>
          {loading === "words" ? "正在扩散联想" : "开始发散"}
        </Button>
      </div>
    </Panel>
  );
}
