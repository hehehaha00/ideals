// 这个文件在没有 AI 接口时生成维度词、脑洞卡片和变形结果。
import { FALLBACK_WORDS, GROUP_DESCRIPTIONS } from "../data/fallbackWords";
import { IDEA_TITLE_NOUNS, TRANSFORM_COPY } from "../data/fallbackIdeas";
import {
  DIMENSION_GROUPS,
  type DimensionGroup,
  type DimensionWord,
  type IdeaCard,
  type Intensity,
  type TransformDirection,
} from "../types/idea";
import { createId } from "./id";

const INTENSITY_OFFSET: Record<Intensity, number> = {
  轻微: 0,
  正常: 2,
  狂野: 4,
};

// 根据主题和发散强度旋转词库，让不同输入得到不同起点。
function rotateWords(words: string[], topic: string, intensity: Intensity): string[] {
  const topicScore = Array.from(topic).reduce((score, char) => score + char.charCodeAt(0), 0);
  const offset = (topicScore + INTENSITY_OFFSET[intensity]) % words.length;
  return [...words.slice(offset), ...words.slice(0, offset)];
}

// 生成六类本地维度词，每类默认选中第一个词。
export function generateFallbackWords(topic: string, intensity: Intensity): DimensionGroup[] {
  return DIMENSION_GROUPS.map((type) => {
    const words = rotateWords(FALLBACK_WORDS[type], topic, intensity)
      .slice(0, 8)
      .map<DimensionWord>((text, index) => ({
        id: createId(`${type}_${index}`),
        text,
        groupType: type,
        locked: false,
        selected: index === 0,
        source: "本地灵感词库",
      }));

    return {
      type,
      label: type,
      description: GROUP_DESCRIPTIONS[type],
      words,
    };
  });
}

// 从当前碰撞词里取出指定类型的词。
function wordOfType(words: DimensionWord[], type: DimensionWord["groupType"]): string {
  return words.find((word) => word.groupType === type)?.text ?? type;
}

// 根据六类来源词生成 4 张本地脑洞卡片。
export function generateFallbackIdeas(topic: string, sourceWords: DimensionWord[]): IdeaCard[] {
  const now = new Date().toISOString();
  const crowd = wordOfType(sourceWords, "人群");
  const scene = wordOfType(sourceWords, "场景");
  const emotion = wordOfType(sourceWords, "情绪");
  const object = wordOfType(sourceWords, "物件");
  const structure = wordOfType(sourceWords, "结构");
  const limit = wordOfType(sourceWords, "限制");

  return IDEA_TITLE_NOUNS.slice(0, 4).map<IdeaCard>((noun, index) => ({
    id: createId(`idea_${index}`),
    title: `${object}${noun}`,
    summary: `给${crowd}在${scene}使用：把${emotion}装进${structure}结构里，但${limit}。`,
    whyInteresting: `它有趣的地方在于没有直接解决“${topic}”，而是把真实心理变成一个可以摆弄的对象。`,
    firstVersion: `第一版只做一个本地小工具：输入素材，生成一组可收藏的${structure}式脑洞卡片。`,
    sourceWords,
    createdAt: now,
  }));
}

// 按指定方向生成一张新的变形卡片，并保留来源词和父级关系。
export function transformFallbackIdea(idea: IdeaCard, direction: TransformDirection): IdeaCard {
  return {
    ...idea,
    id: createId("idea_transform"),
    parentId: idea.id,
    transformDirection: direction,
    title: `${idea.title} · ${direction}`,
    summary: `${idea.summary} ${TRANSFORM_COPY[direction]}`,
    whyInteresting: `${idea.whyInteresting} 这次变形会让它更容易被继续讨论，而不是马上被商业判断压扁。`,
    createdAt: new Date().toISOString(),
  };
}
