// 这个文件解析和校验模型输出，保证前端拿到结构稳定的数据。
import { GROUP_DESCRIPTIONS } from "../src/data/fallbackWords";
import { createId } from "../src/lib/id";
import { DIMENSION_GROUPS, type DimensionGroup, type DimensionGroupType, type DimensionWord, type IdeaCard, type TransformDirection } from "../src/types/idea";

interface RawWord {
  text?: unknown;
  source?: unknown;
}

interface RawWordGroup {
  type?: unknown;
  words?: unknown;
}

interface RawIdea {
  title?: unknown;
  summary?: unknown;
  whyInteresting?: unknown;
  firstVersion?: unknown;
}

// 从模型可能包裹代码块的文本中提取 JSON。
export function parseModelJson(output: string): unknown {
  const trimmed = output.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");

  try {
    return JSON.parse(trimmed);
  } catch {
    const startCandidates = [trimmed.indexOf("{"), trimmed.indexOf("[")].filter((index) => index >= 0);
    const start = Math.min(...startCandidates);
    const end = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
    if (!Number.isFinite(start) || end <= start) {
      throw new Error("模型输出不是 JSON");
    }

    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

// 判断是否为六类合法维度之一。
function isDimensionGroupType(value: unknown): value is DimensionGroupType {
  return typeof value === "string" && DIMENSION_GROUPS.includes(value as DimensionGroupType);
}

// 读取对象属性。
function readRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("模型输出结构不是对象");
  }

  return value as Record<string, unknown>;
}

// 读取非空字符串。
function readText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

// 把模型维度词输出整理成前端可用结构。
export function normalizeWordGroups(output: unknown): DimensionGroup[] {
  const record = readRecord(output);
  if (!Array.isArray(record.groups)) {
    throw new Error("模型没有返回维度词 groups");
  }

  return DIMENSION_GROUPS.map((type) => {
    const rawGroup = (record.groups as RawWordGroup[]).find((group) => group.type === type);
    if (!rawGroup || !Array.isArray(rawGroup.words) || rawGroup.words.length === 0) {
      throw new Error(`模型缺少${type}维度词`);
    }

    const words = (rawGroup.words as RawWord[]).slice(0, 8).map<DimensionWord>((word, index) => ({
      id: createId(`${type}_${index}`),
      text: readText(word.text, `${type}词`),
      groupType: type,
      locked: false,
      selected: index === 0,
      source: readText(word.source, "AI 发散"),
    }));

    return {
      type,
      label: type,
      description: GROUP_DESCRIPTIONS[type],
      words,
    };
  });
}

// 把模型脑洞输出整理成前端可用卡片。
export function normalizeIdeaCards(output: unknown, sourceWords: DimensionWord[]): IdeaCard[] {
  const record = readRecord(output);
  if (!Array.isArray(record.ideas) || record.ideas.length === 0) {
    throw new Error("模型没有返回可用脑洞");
  }

  return (record.ideas as RawIdea[]).slice(0, 5).map<IdeaCard>((idea, index) => ({
    id: createId(`ai_idea_${index}`),
    title: readText(idea.title, "未命名脑洞"),
    summary: readText(idea.summary, "这个脑洞还需要再展开。"),
    whyInteresting: readText(idea.whyInteresting, "它提供了一个可以继续变形的方向。"),
    firstVersion: readText(idea.firstVersion, "第一版先做最小可玩的交互。"),
    sourceWords,
    createdAt: new Date().toISOString(),
  }));
}

// 把模型变形输出整理成单张卡片。
export function normalizeTransformedIdea(output: unknown, original: IdeaCard, direction: TransformDirection): IdeaCard {
  const record = readRecord(output);
  const rawIdea = readRecord(record.idea);

  return {
    id: createId("ai_transform"),
    parentId: original.id,
    transformDirection: direction,
    title: readText(rawIdea.title, `${original.title} · ${direction}`),
    summary: readText(rawIdea.summary, original.summary),
    whyInteresting: readText(rawIdea.whyInteresting, original.whyInteresting),
    firstVersion: readText(rawIdea.firstVersion, original.firstVersion),
    sourceWords: original.sourceWords,
    createdAt: new Date().toISOString(),
  };
}
