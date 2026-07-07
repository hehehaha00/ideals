// 这个文件验证工作台状态：生成、锁词、碰撞和收藏持久化。
import { beforeEach, describe, expect, it } from "vitest";
import { useIdeaStore } from "./ideaStore";

describe("ideaStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useIdeaStore.getState().reset();
  });

  it("generates words and keeps locked words during reroll", async () => {
    const store = useIdeaStore.getState();
    store.setTopic("开发者工具");
    await store.generateWords();

    const firstGroup = useIdeaStore.getState().groups[0];
    const lockedWord = firstGroup.words[0];
    useIdeaStore.getState().toggleWordLock(lockedWord.id);
    await useIdeaStore.getState().rerollUnlockedWords();

    const nextFirstGroup = useIdeaStore.getState().groups[0];
    expect(nextFirstGroup.words.some((word) => word.id === lockedWord.id && word.locked)).toBe(true);
  });

  it("generates ideas from selected words", async () => {
    const store = useIdeaStore.getState();
    store.setTopic("我想做一个有趣的开发者工具");
    await store.generateWords();
    await useIdeaStore.getState().generateIdeas();

    expect(useIdeaStore.getState().ideas.length).toBeGreaterThanOrEqual(3);
    expect(useIdeaStore.getState().activeIdeaId).toBeTruthy();
  });

  it("persists favorites in localStorage", async () => {
    const store = useIdeaStore.getState();
    store.setTopic("内容选题");
    await store.generateWords();
    await useIdeaStore.getState().generateIdeas();

    const idea = useIdeaStore.getState().ideas[0];
    useIdeaStore.getState().toggleFavorite(idea.id);
    useIdeaStore.getState().reset();
    useIdeaStore.getState().hydrate();

    expect(useIdeaStore.getState().favorites).toHaveLength(1);
  });
});
