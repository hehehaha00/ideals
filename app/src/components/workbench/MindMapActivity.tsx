// 这个文件展示导图 AI 工作时的能量核心、轨道粒子和实时状态。
import type { ReactNode } from "react";

export type MindMapMotionOperation = "map" | "expand" | "reroll" | "ideas" | "discussionBranch";
export type MindMapActivityOperation = MindMapMotionOperation | "challenge";

interface MindMapActivityProps {
  operation: MindMapActivityOperation;
  title: string;
  detail: string;
}

const PARTICLES = Array.from({ length: 8 }, (_, index) => index);

// 渲染覆盖整个画布的工作层；交互阻断由外层实体本身保证。
export function MindMapActivity({ operation, title, detail }: MindMapActivityProps): ReactNode {
  return (
    <div
      className="mindmap-activity absolute inset-0 z-50 flex cursor-wait items-center justify-center overflow-hidden bg-[#0d0b09]/72 text-center"
      data-motion-activity={operation}
      data-testid="mindmap-blocking-layer"
    >
      <div className="mindmap-activity-field" aria-hidden="true">
        {[0, 1, 2].map((orbit) => (
          <span className={`mindmap-activity-orbit orbit-${orbit + 1}`} data-motion-orbit={orbit + 1} key={orbit}>
            <i />
          </span>
        ))}
        {PARTICLES.map((particle) => (
          <span className={`mindmap-activity-particle particle-${particle + 1}`} data-motion-particle={particle + 1} key={particle} />
        ))}
        <span className="mindmap-activity-core" data-motion-energy-core="true" />
      </div>

      <div aria-live="polite" className="relative z-10 max-w-lg px-8" role="status">
        <p className="font-mono text-[10px] uppercase tracking-[0.34em] text-spark-500">Idea Reactor / {operation}</p>
        <h2 className="mt-4 font-serif text-3xl text-[#fff7df]">{title}</h2>
        <p className="mt-2 text-sm text-white/58">{detail}</p>
      </div>

      <aside className="mindmap-activity-telemetry" aria-hidden="true">
        <span className="mindmap-activity-signal" />
        <div>
          <strong>联想链路同步中</strong>
          <small>NEURAL COLLISION · LIVE</small>
        </div>
      </aside>
    </div>
  );
}
