// 这个文件负责把收藏内容保存到 localStorage，并兼容损坏或旧版本数据。
import type { FavoriteIdea } from "../types/idea";

const STORAGE_KEY = "idea-lab:v1";

interface StoredState {
  version: 1;
  favorites: FavoriteIdea[];
}

const EMPTY_STATE: StoredState = {
  version: 1,
  favorites: [],
};

// 读取本地状态；读取失败时返回空状态，避免页面崩溃。
export function loadStoredState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return EMPTY_STATE;
    }

    const parsed = JSON.parse(raw) as StoredState;
    if (parsed.version !== 1 || !Array.isArray(parsed.favorites)) {
      return EMPTY_STATE;
    }

    return parsed;
  } catch {
    return EMPTY_STATE;
  }
}

// 保存收藏列表到本地。
export function saveFavorites(favorites: FavoriteIdea[]): void {
  const state: StoredState = {
    version: 1,
    favorites,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
