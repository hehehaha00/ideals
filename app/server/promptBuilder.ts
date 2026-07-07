// 这个文件负责把用户输入、当前词组和脑洞压缩后拼成模型提示词。
import type { DimensionWord, IdeaCard, Intensity, TransformDirection } from "../src/types/idea";

export interface ChatPrompt {
  system: string;
  user: string;
}

interface WordsPromptRequest {
  topic: string;
  intensity: Intensity;
}

interface IdeasPromptRequest {
  topic: string;
  sourceWords: DimensionWord[];
}

interface TransformPromptRequest {
  idea: IdeaCard;
  direction: TransformDirection;
}

const SYSTEM_PROMPT = [
  "你是脑洞实验室的 AI 创意引擎。",
  "你模拟人类发散思维：联想扩散、类比迁移、概念融合、约束变形、反转、角色切换。",
  "发散阶段不要做市场评分，不要输出竞品分析，不要把所有想法压成普通 SaaS。",
  "只输出 JSON，不要 Markdown，不要解释，不要代码块。",
].join("\n");

// 压缩长文本，保留前部语义，避免 prompt 被无效上下文撑爆。
export function compressText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1))}…`;
}

// 压缩词组上下文，只保留类型和文本。
function compactWords(words: DimensionWord[]): string {
  return words.map((word) => `${word.groupType}:${compressText(word.text, 40)}`).join("；");
}

// 压缩脑洞卡片上下文。
function compactIdea(idea: IdeaCard): string {
  return [
    `标题:${compressText(idea.title, 80)}`,
    `解释:${compressText(idea.summary, 160)}`,
    `有趣点:${compressText(idea.whyInteresting, 160)}`,
    `第一版:${compressText(idea.firstVersion, 160)}`,
    `来源词:${compactWords(idea.sourceWords)}`,
  ].join("\n");
}

// 生成维度词提示词。
export function buildWordsPrompt(request: WordsPromptRequest): ChatPrompt {
  return {
    system: SYSTEM_PROMPT,
    user: [
      `用户主题：${compressText(request.topic, 300)}`,
      `发散强度：${request.intensity}`,
      "",
      "任务：生成六类维度词，每类 8 个词。必须体现人类脑洞方式：联想扩散、类比迁移、概念融合、反转、约束变形。",
      "六类维度词：人群、场景、情绪、物件、结构、限制。",
      "词要具体、有画面感，避免商业套话。",
      "",
      "输出 JSON 格式：",
      '{"groups":[{"type":"人群","words":[{"text":"独立开发者","source":"联想扩散"}]}]}',
    ].join("\n"),
  };
}

// 生成脑洞卡片提示词。
export function buildIdeasPrompt(request: IdeasPromptRequest): ChatPrompt {
  return {
    system: SYSTEM_PROMPT,
    user: [
      `用户主题：${compressText(request.topic, 300)}`,
      `当前碰撞词：${compactWords(request.sourceWords)}`,
      "",
      "任务：基于这些词碰撞出 3 到 5 张脑洞卡片。",
      "每张卡片要像一个可继续思考的项目原胚，不要写成商业计划书。",
      "必须能看出词与词之间的碰撞关系。",
      "",
      "输出 JSON 格式：",
      '{"ideas":[{"title":"项目遗迹馆","summary":"一句话解释","whyInteresting":"为什么有趣","firstVersion":"第一版怎么做"}]}',
    ].join("\n"),
  };
}

// 生成脑洞变形提示词。
export function buildTransformPrompt(request: TransformPromptRequest): ChatPrompt {
  return {
    system: SYSTEM_PROMPT,
    user: [
      `变形方向：${request.direction}`,
      "原脑洞：",
      compactIdea(request.idea),
      "",
      "任务：沿着指定方向生成一张新的脑洞卡片，保留原始隐喻和来源词，但让形态明显变化。",
      "",
      "输出 JSON 格式：",
      '{"idea":{"title":"项目遗迹馆 · 更游戏化一点","summary":"一句话解释","whyInteresting":"为什么有趣","firstVersion":"第一版怎么做"}}',
    ].join("\n"),
  };
}
