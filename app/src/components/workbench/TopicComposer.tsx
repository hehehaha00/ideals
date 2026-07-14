// 这个文件提供主题输入和发散强度选择。
import { ArrowRight, Sparkles } from "lucide-react";
import type { FocusEvent } from "react";
import { cn } from "../../lib/cn";
import { useIdeaStore } from "../../store/ideaStore";
import type { Intensity } from "../../types/idea";
import { Button } from "../ui/Button";

const INTENSITIES: Intensity[] = ["轻微", "正常", "狂野"];
const EXAMPLES = ["开发者工具", "游戏机制", "内容选题", "我不知道做什么"];

export const HOME_PHASE_DURATION_MS = 36000;

export const HOME_PHASES = [
  {
    id: "day",
    background: "/home-backgrounds/idea-lab-daylight-bg.png",
    placeholder: "把脑子里一闪而过的想法写下来...",
    tags: ["开发者工具", "游戏机制", "内容选题", "我不知道做什么"],
  },
  {
    id: "warm",
    background: "/home-backgrounds/idea-lab-sunrise-bg.png",
    placeholder: "描述一个模糊的想法、问题或灵感...",
    tags: ["未来的教育形态", "人与 AI 的协作方式", "城市里的微小治愈", "让时间更有意义"],
  },
  {
    id: "night",
    background: "/home-backgrounds/idea-lab-moonmist-bg.png",
    placeholder: "把困在脑子里的东西丢进来...",
    tags: ["深夜灵感", "失败也有奖励", "反过来想", "不想再拖延"],
  },
] as const;

export type HomePhase = (typeof HOME_PHASES)[number];

type TopicComposerProps = {
  homeMode?: boolean;
  homePhase?: HomePhase;
  onHomeInteractionChange?: (active: boolean) => void;
};

// 渲染主题输入区，并触发维度词生成。
export function TopicComposer({ homeMode = false, homePhase = HOME_PHASES[0], onHomeInteractionChange }: TopicComposerProps): JSX.Element {
  const topic = useIdeaStore((state) => state.topic);
  const intensity = useIdeaStore((state) => state.intensity);
  const loading = useIdeaStore((state) => state.loading);
  const setTopic = useIdeaStore((state) => state.setTopic);
  const setIntensity = useIdeaStore((state) => state.setIntensity);
  const generateMindMap = useIdeaStore((state) => state.generateMindMap);
  const examples = homeMode ? homePhase.tags : EXAMPLES;
  const placeholder = homeMode ? homePhase.placeholder : "例如：我想做一个有趣的开发者工具，但不知道它该解决谁的什么问题";

  const setHomeInteraction = (active: boolean): void => {
    if (homeMode) {
      onHomeInteractionChange?.(active);
    }
  };

  const handleBlur = (event: FocusEvent<HTMLTextAreaElement>): void => {
    if (event.target.value.trim().length === 0) {
      setHomeInteraction(false);
    }
  };

  return (
    <form
      className={cn("launch-pad mt-8", homeMode && "home-launch-pad")}
      onSubmit={(event) => {
        event.preventDefault();
        setHomeInteraction(true);
        void generateMindMap();
      }}
    >
      <label className="sr-only" htmlFor="topic-input">
        主题
      </label>
      <textarea
        className={cn(
          "w-full resize-none text-lg leading-8 outline-none focus-visible:ring-2 focus-visible:ring-spark-500/45",
          homeMode
            ? "home-prompt-input"
            : "min-h-36 rounded-[1.35rem] border border-[#fff7df]/65 bg-[#fff7df] p-5 text-[#211a15] placeholder:text-[#7c6f5d] shadow-[0_22px_80px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.35)]",
        )}
        id="topic-input"
        name="topic"
        autoComplete="off"
        value={topic}
        onFocus={() => setHomeInteraction(true)}
        onBlur={handleBlur}
        onChange={(event) => {
          setTopic(event.target.value);
          setHomeInteraction(event.target.value.trim().length > 0);
        }}
        placeholder={placeholder}
      />
      <div className={cn("mt-3 flex flex-wrap gap-2 px-1", homeMode && "home-suggestion-row")}>
        {examples.map((example) => (
          <button
            key={example}
            className={cn(
              "inline-flex items-center gap-1 rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-500",
              homeMode
                ? "home-suggestion-chip"
                : "border border-white/10 bg-white/[0.055] px-3 py-1.5 text-sm text-[#fff7df]/70 hover:border-spark-500/60 hover:bg-spark-500/12 hover:text-white",
            )}
            type="button"
            onClick={() => {
              setTopic(`我想做一个和${example}有关的产品`);
              setHomeInteraction(true);
            }}
          >
            {example}
            <ArrowRight className={cn("h-3.5 w-3.5", homeMode && "home-suggestion-icon")} />
          </button>
        ))}
      </div>
      <div className={cn("mt-5 flex flex-wrap items-center justify-between gap-3 px-1", homeMode && "home-launch-actions")}>
        {!homeMode && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-full border border-white/10 bg-black/20 p-1" aria-label="发散强度">
              {INTENSITIES.map((item) => (
                <button
                  key={item}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-500",
                    intensity === item ? "bg-[#fff7df] text-spark-600 shadow-sm" : "text-white/54 hover:text-white",
                  )}
                  type="button"
                  onClick={() => setIntensity(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <p className="text-sm text-[#fff7df]/58">不用想清楚，先让它散开。</p>
          </div>
        )}
        <Button
          className={cn(homeMode && "home-start-button")}
          variant="primary"
          icon={<Sparkles className="h-4 w-4" />}
          disabled={topic.trim().length < 2 || loading !== "idle"}
          type="submit"
        >
          {loading === "map" || loading === "words" ? "正在扩散联想" : "开始发散"}
        </Button>
      </div>
    </form>
  );
}
