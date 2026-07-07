// 这个文件管理脑洞实验室 MVP 的主题、词组、脑洞、变形和收藏状态。
import { create } from "zustand";
import { generateIdeas as requestIdeas, generateWords as requestWords, transformIdea as requestTransform } from "../services/ideaApi";
import type { DimensionGroup, DimensionWord, FavoriteIdea, IdeaCard, Intensity, TransformDirection } from "../types/idea";
import { loadStoredState, saveFavorites } from "./storage";

interface IdeaStoreState {
  topic: string;
  intensity: Intensity;
  groups: DimensionGroup[];
  ideas: IdeaCard[];
  favorites: FavoriteIdea[];
  activeIdeaId?: string;
  loading: "idle" | "words" | "ideas" | "transform";
  streamText: string;
  error?: string;
  setTopic: (topic: string) => void;
  setIntensity: (intensity: Intensity) => void;
  hydrate: () => void;
  reset: () => void;
  generateWords: () => Promise<void>;
  toggleWordLock: (wordId: string) => void;
  selectWord: (wordId: string) => void;
  rerollUnlockedWords: () => Promise<void>;
  randomizeCollision: () => void;
  generateIdeas: () => Promise<void>;
  setActiveIdea: (ideaId: string) => void;
  transformActiveIdea: (direction: TransformDirection) => Promise<void>;
  toggleFavorite: (ideaId: string) => void;
}

const INITIAL_STATE = {
  topic: "",
  intensity: "正常" as Intensity,
  groups: [],
  ideas: [],
  favorites: [],
  activeIdeaId: undefined,
  loading: "idle" as const,
  streamText: "",
  error: undefined,
};

// 取出每个维度当前选中的一个词。
function selectedWords(groups: DimensionGroup[]): DimensionWord[] {
  return groups.flatMap((group) => group.words.filter((word) => word.selected).slice(0, 1));
}

// 找到某个词所属的维度。
function findWordGroupType(groups: DimensionGroup[], wordId: string): DimensionWord["groupType"] | undefined {
  return groups.flatMap((group) => group.words).find((word) => word.id === wordId)?.groupType;
}

// 把旧组里锁定的词合并进新生成的组里。
function mergeLockedWords(currentGroups: DimensionGroup[], freshGroups: DimensionGroup[]): DimensionGroup[] {
  return freshGroups.map((freshGroup) => {
    const currentGroup = currentGroups.find((group) => group.type === freshGroup.type);
    const lockedWords = currentGroup?.words.filter((word) => word.locked) ?? [];
    const freshUnlockedWords = freshGroup.words.filter((word) => !lockedWords.some((lockedWord) => lockedWord.text === word.text));

    return {
      ...freshGroup,
      words: [...lockedWords, ...freshUnlockedWords].slice(0, 8),
    };
  });
}

export const useIdeaStore = create<IdeaStoreState>((set, get) => ({
  ...INITIAL_STATE,
  setTopic: (topic) => set({ topic, error: undefined }),
  setIntensity: (intensity) => set({ intensity }),
  hydrate: () => set({ favorites: loadStoredState().favorites }),
  reset: () => set({ ...INITIAL_STATE }),
  generateWords: async () => {
    const { topic, intensity } = get();
    if (topic.trim().length < 2) {
      set({ error: "先给我一个稍微具体一点的方向。" });
      return;
    }

    set({ loading: "words", streamText: "", error: undefined });
    const groups = await requestWords({
      topic,
      intensity,
      onProgress: (text) => set((state) => ({ streamText: `${state.streamText}${text}`.slice(-300) })),
    });
    set({ groups, ideas: [], activeIdeaId: undefined, loading: "idle", streamText: "" });
  },
  toggleWordLock: (wordId) =>
    set((state) => ({
      groups: state.groups.map((group) => ({
        ...group,
        words: group.words.map((word) => (word.id === wordId ? { ...word, locked: !word.locked } : word)),
      })),
    })),
  selectWord: (wordId) =>
    set((state) => {
      const targetGroupType = findWordGroupType(state.groups, wordId);
      if (!targetGroupType) {
        return state;
      }

      return {
        groups: state.groups.map((group) => ({
          ...group,
          words: group.words.map((word) => ({
            ...word,
            selected: word.groupType === targetGroupType ? word.id === wordId : word.selected,
          })),
        })),
      };
    }),
  rerollUnlockedWords: async () => {
    const { topic, intensity, groups } = get();
    if (groups.length === 0) {
      return;
    }

    set({ loading: "words", streamText: "", error: undefined });
    const freshGroups = await requestWords({
      topic: `${topic} ${Date.now()}`,
      intensity,
      onProgress: (text) => set((state) => ({ streamText: `${state.streamText}${text}`.slice(-300) })),
    });
    set({ groups: mergeLockedWords(groups, freshGroups), loading: "idle", streamText: "" });
  },
  randomizeCollision: () =>
    set((state) => ({
      groups: state.groups.map((group) => {
        const index = Math.floor(Math.random() * group.words.length);
        return {
          ...group,
          words: group.words.map((word, wordIndex) => ({ ...word, selected: wordIndex === index })),
        };
      }),
    })),
  generateIdeas: async () => {
    const { topic, groups } = get();
    const words = selectedWords(groups);
    if (words.length !== 6) {
      set({ error: "每类先选一个词，再把它们撞一下。" });
      return;
    }

    set({ loading: "ideas", streamText: "", error: undefined });
    const ideas = await requestIdeas({
      topic,
      sourceWords: words,
      onProgress: (text) => set((state) => ({ streamText: `${state.streamText}${text}`.slice(-300) })),
    });
    set({ ideas, activeIdeaId: ideas[0]?.id, loading: "idle", streamText: "" });
  },
  setActiveIdea: (ideaId) => set({ activeIdeaId: ideaId }),
  transformActiveIdea: async (direction) => {
    const { ideas, activeIdeaId } = get();
    const idea = ideas.find((item) => item.id === activeIdeaId);
    if (!idea) {
      set({ error: "先选中一张脑洞卡片。" });
      return;
    }

    set({ loading: "transform", streamText: "", error: undefined });
    const transformed = await requestTransform({
      idea,
      direction,
      onProgress: (text) => set((state) => ({ streamText: `${state.streamText}${text}`.slice(-300) })),
    });
    set((state) => ({
      ideas: [transformed, ...state.ideas],
      activeIdeaId: transformed.id,
      loading: "idle",
      streamText: "",
    }));
  },
  toggleFavorite: (ideaId) => {
    const { ideas, favorites } = get();
    const existing = favorites.find((favorite) => favorite.idea.id === ideaId);
    const idea = ideas.find((item) => item.id === ideaId);
    if (!existing && !idea) {
      set({ error: "没有找到要收藏的脑洞。" });
      return;
    }

    const nextFavorites = existing
      ? favorites.filter((favorite) => favorite.idea.id !== ideaId)
      : [
          ...favorites,
          {
            idea: idea as IdeaCard,
            savedAt: new Date().toISOString(),
          },
        ];

    saveFavorites(nextFavorites);
    set({ favorites: nextFavorites });
  },
}));
