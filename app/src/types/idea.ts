// 这个文件集中定义脑洞实验室的核心数据类型，供服务、状态和组件共用。
export const DIMENSION_GROUPS = ["人群", "场景", "情绪", "物件", "结构", "限制"] as const;

export type DimensionGroupType = (typeof DIMENSION_GROUPS)[number];

export type Intensity = "轻微" | "正常" | "狂野";

export const TRANSFORM_DIRECTIONS = [
  "更实用一点",
  "更荒诞一点",
  "更游戏化一点",
  "更像浏览器插件",
  "更像 Agent skill",
  "只保留核心隐喻",
] as const;

export type TransformDirection = (typeof TRANSFORM_DIRECTIONS)[number];

export interface DimensionWord {
  id: string;
  text: string;
  groupType: DimensionGroupType;
  locked: boolean;
  selected: boolean;
  source: string;
}

export interface DimensionGroup {
  type: DimensionGroupType;
  label: string;
  description: string;
  words: DimensionWord[];
}

export interface IdeaCard {
  id: string;
  title: string;
  summary: string;
  whyInteresting: string;
  firstVersion: string;
  sourceWords: DimensionWord[];
  createdAt: string;
  parentId?: string;
  transformDirection?: TransformDirection;
}

export interface IdeaSession {
  id: string;
  topic: string;
  intensity: Intensity;
  groups: DimensionGroup[];
  ideas: IdeaCard[];
  activeIdeaId?: string;
  updatedAt: string;
}

export interface FavoriteIdea {
  idea: IdeaCard;
  savedAt: string;
}
