# Idea Lab MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first playable MVP of 脑洞实验室: a single-user AI creativity workbench where a user enters a vague topic, generates dimension words, locks/rerolls words, collides them into idea cards, transforms ideas, and saves favorites locally.

**Architecture:** The app lives in `./app` so the existing product documents and image assets stay clean at the workspace root. React components render the workflow, Zustand owns client state, a typed `ideaApi` service owns AI calls and local fallback, and localStorage preserves favorites/session state. The first version has no login, no backend database, and no cloud sync.

**Tech Stack:** Vite, React, TypeScript strict mode, Tailwind CSS, Zustand, Lucide React, Vitest, Testing Library, Playwright, localStorage.

---

## Project Root

All paths below are relative to:

`.`

The frontend app root is:

`./app`

## MVP Scope Lock

Build only these first-version capabilities:

- Topic input with intensity: `轻微`, `正常`, `狂野`.
- Six dimension groups: `人群`, `场景`, `情绪`, `物件`, `结构`, `限制`.
- Select, lock, unlock, and reroll dimension words.
- Collision tray that always shows the current combination.
- Generate 3 to 5 idea cards from the selected words.
- Transform one idea in six directions.
- Favorite/unfavorite ideas and persist them locally.
- Full local fallback when AI is unavailable.

Do not build these in MVP:

- User accounts.
- Cloud sync.
- Team workshop.
- Public sharing.
- Real market scoring.
- Complex素材池.

## File Structure

### Root Files

- `./README.md`
  Explains the product, how to run the MVP, and common commands.
- `./ARCHITECTURE.md`
  Documents the final MVP file responsibilities and data flow.
- `./CONTEXT.md`
  Keeps the concise project state after each phase.

### App Setup

- `./app/package.json`
  Scripts and dependencies.
- `./app/vite.config.ts`
  Vite config with React plugin.
- `./app/tailwind.config.js`
  Tailwind content paths and design tokens.
- `./app/postcss.config.js`
  Tailwind/PostCSS config.
- `./app/tsconfig.json`
  Strict TypeScript settings.
- `./app/index.html`
  Vite HTML entry.

### App Source

- `./app/src/main.tsx`
  React entry point.
- `./app/src/App.tsx`
  Top-level app composition.
- `./app/src/index.css`
  Tailwind layers, CSS variables, base styles.
- `./app/src/types/idea.ts`
  Shared domain types.
- `./app/src/lib/cn.ts`
  Class name helper using `clsx` and `tailwind-merge`.
- `./app/src/lib/id.ts`
  Stable local ID generator.
- `./app/src/lib/ideaEngine.ts`
  Local fallback generation logic.
- `./app/src/data/fallbackWords.ts`
  Seed words for six dimension groups.
- `./app/src/data/fallbackIdeas.ts`
  Local idea templates and transform templates.
- `./app/src/services/ideaApi.ts`
  Typed AI service with fallback behavior.
- `./app/src/store/storage.ts`
  Versioned localStorage read/write helpers.
- `./app/src/store/ideaStore.ts`
  Zustand store and user actions.

### Components

- `./app/src/components/layout/AppShell.tsx`
  Three-column shell.
- `./app/src/components/ui/Button.tsx`
  Reusable button.
- `./app/src/components/ui/Panel.tsx`
  Simple panel container.
- `./app/src/components/ui/Chip.tsx`
  Dimension word chip.
- `./app/src/components/workbench/TopicComposer.tsx`
  Topic input and intensity control.
- `./app/src/components/workbench/DimensionBoard.tsx`
  Six dimension groups.
- `./app/src/components/workbench/CollisionTray.tsx`
  Current selected word combination.
- `./app/src/components/workbench/IdeaCard.tsx`
  Single idea card.
- `./app/src/components/workbench/IdeaCardList.tsx`
  Idea card list and empty state.
- `./app/src/components/workbench/TransformerPanel.tsx`
  Transform controls for the active idea.
- `./app/src/components/workbench/FavoriteDock.tsx`
  Local favorite list.

### Tests

- `./app/src/lib/ideaEngine.test.ts`
  Local generation tests.
- `./app/src/services/ideaApi.test.ts`
  API fallback and response validation tests.
- `./app/src/store/ideaStore.test.ts`
  Store behavior tests.
- `./app/playwright.config.ts`
  Browser test config.
- `./app/e2e/mvp-flow.spec.ts`
  End-to-end MVP flow.

---

## Task 1: Scaffold App, Tooling, and Base Commands

**Files:**
- Create: `./app/package.json`
- Create: `./app/index.html`
- Create: `./app/vite.config.ts`
- Create: `./app/tsconfig.json`
- Create: `./app/tailwind.config.js`
- Create: `./app/postcss.config.js`
- Create: `./app/src/main.tsx`
- Create: `./app/src/App.tsx`
- Create: `./app/src/index.css`
- Create: `./app/src/vite-env.d.ts`

- [ ] **Step 1: Initialize git when the workspace has no repository**

Run:

```powershell
git init
git status --short
```

Expected:

```text
Initialized empty Git repository
```

- [ ] **Step 2: Create the app folder**

Run:

```powershell
New-Item -ItemType Directory -Force .\app\src | Out-Null
```

Expected:

```text
The app/src folder exists.
```

- [ ] **Step 3: Create `app/package.json`**

Write this file:

```json
{
  "name": "idea-lab-mvp",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview --host 127.0.0.1",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "e2e:headed": "playwright test --headed"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "clsx": "^2.1.1",
    "lucide-react": "^0.468.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tailwind-merge": "^2.5.5",
    "zustand": "^5.0.2"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.1",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/node": "^22.10.2",
    "@types/react": "^18.3.17",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "jsdom": "^25.0.1",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.2",
    "vite": "^6.0.5",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 4: Create Vite and TypeScript config**

Write `app/vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
});
```

Write `app/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "playwright.config.ts", "e2e"]
}
```

- [ ] **Step 5: Create Tailwind config**

Write `app/tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          500: "#6B7280",
          700: "#374151",
          900: "#111827",
        },
        paper: {
          0: "#FFFFFF",
          50: "#F9F8F4",
          100: "#F6F6F1",
        },
        line: {
          100: "#E9E5DA",
        },
        spark: {
          500: "#FF5701",
          600: "#E64D00",
        },
        rose: {
          100: "#F2D9DC",
        },
        mint: {
          100: "#D9F2D8",
        },
        sky: {
          100: "#DCEBFF",
        },
        violet: {
          100: "#E9DDFB",
        },
        yellow: {
          100: "#FFF1C2",
        },
      },
      fontFamily: {
        sans: ["Inter", "Noto Sans SC", "Microsoft YaHei", "system-ui", "sans-serif"],
        serif: ["Noto Serif SC", "Source Han Serif SC", "serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        soft: "0 18px 45px rgba(17, 24, 39, 0.08)",
      },
    },
  },
  plugins: [],
};
```

Write `app/postcss.config.js`:

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: Create React entry files**

Write `app/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>脑洞实验室</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Write `app/src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

Write `app/src/App.tsx`:

```tsx
function App(): JSX.Element {
  return (
    <main className="min-h-screen bg-paper-50 text-ink-900">
      <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6">
        <section className="rounded-lg border border-line-100 bg-paper-0 p-8 shadow-soft">
          <p className="font-mono text-xs uppercase tracking-normal text-spark-500">Idea Lab</p>
          <h1 className="mt-3 font-serif text-4xl leading-tight">脑洞实验室</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-ink-700">
            输入一个模糊方向，让 AI 先陪你发散，再把有生命力的想法留下来。
          </p>
        </section>
      </div>
    </main>
  );
}

export default App;
```

Write `app/src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color: #111827;
  background: #f9f8f4;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

button,
input,
textarea {
  font: inherit;
}
```

Write `app/src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 7: Create Vitest setup**

Create `app/src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 8: Install dependencies**

Run:

```powershell
Set-Location .\app
npm install
```

Expected:

```text
added packages
```

- [ ] **Step 9: Verify the empty app builds**

Run:

```powershell
npm run build
```

Expected:

```text
✓ built
```

- [ ] **Step 10: Commit scaffold**

Run:

```powershell
Set-Location ..
git add app package-lock.json
git commit -m "chore: scaffold idea lab frontend"
```

Expected:

```text
[main ...] chore: scaffold idea lab frontend
```

---

## Task 2: Domain Types and Local Idea Engine

**Files:**
- Create: `./app/src/types/idea.ts`
- Create: `./app/src/lib/id.ts`
- Create: `./app/src/data/fallbackWords.ts`
- Create: `./app/src/data/fallbackIdeas.ts`
- Create: `./app/src/lib/ideaEngine.ts`
- Test: `./app/src/lib/ideaEngine.test.ts`

- [ ] **Step 1: Write the engine tests**

Create `app/src/lib/ideaEngine.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DIMENSION_GROUPS } from "../types/idea";
import { generateFallbackIdeas, generateFallbackWords, transformFallbackIdea } from "./ideaEngine";

describe("ideaEngine", () => {
  it("generates six dimension groups with eight words each", () => {
    const groups = generateFallbackWords("我想做一个有趣的开发者工具", "正常");

    expect(groups).toHaveLength(6);
    expect(groups.map((group) => group.type)).toEqual(DIMENSION_GROUPS);
    for (const group of groups) {
      expect(group.words).toHaveLength(8);
      expect(group.words.every((word) => word.groupType === group.type)).toBe(true);
    }
  });

  it("generates idea cards from selected words", () => {
    const groups = generateFallbackWords("开发者工具", "狂野");
    const selectedWords = groups.map((group) => group.words[0]);
    const ideas = generateFallbackIdeas("开发者工具", selectedWords);

    expect(ideas.length).toBeGreaterThanOrEqual(3);
    expect(ideas.length).toBeLessThanOrEqual(5);
    expect(ideas[0]?.sourceWords).toHaveLength(6);
    expect(ideas[0]?.title.length).toBeGreaterThan(0);
  });

  it("transforms an idea while preserving source words", () => {
    const groups = generateFallbackWords("内容创作", "轻微");
    const idea = generateFallbackIdeas("内容创作", groups.map((group) => group.words[0]))[0];
    const transformed = transformFallbackIdea(idea, "更游戏化一点");

    expect(transformed.id).not.toBe(idea.id);
    expect(transformed.parentId).toBe(idea.id);
    expect(transformed.sourceWords).toEqual(idea.sourceWords);
    expect(transformed.transformDirection).toBe("更游戏化一点");
  });
});
```

- [ ] **Step 2: Run tests and confirm they fail**

Run:

```powershell
Set-Location .\app
npm test -- src/lib/ideaEngine.test.ts
```

Expected:

```text
FAIL src/lib/ideaEngine.test.ts
Cannot find module '../types/idea'
```

- [ ] **Step 3: Create shared domain types**

Write `app/src/types/idea.ts`:

```ts
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
```

- [ ] **Step 4: Create ID helper**

Write `app/src/lib/id.ts`:

```ts
export function createId(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${randomPart}`;
}
```

- [ ] **Step 5: Create fallback word seeds**

Write `app/src/data/fallbackWords.ts`:

```ts
import type { DimensionGroupType } from "../types/idea";

export const GROUP_DESCRIPTIONS: Record<DimensionGroupType, string> = {
  人群: "谁会使用这个东西",
  场景: "它通常发生在什么时候",
  情绪: "用户当时带着什么心理",
  物件: "它可能依附在哪个载体上",
  结构: "从哪个系统借来结构",
  限制: "故意加入的反常识条件",
};

export const FALLBACK_WORDS: Record<DimensionGroupType, string[]> = {
  人群: [
    "独立开发者",
    "产品经理",
    "内容创作者",
    "设计师",
    "学生",
    "小团队老板",
    "游戏开发者",
    "拖延症患者",
    "远程工作者",
    "开源维护者",
    "新手程序员",
    "焦虑的创始人",
  ],
  场景: [
    "深夜",
    "会议后",
    "发布前",
    "通勤时",
    "摸鱼时",
    "项目烂尾后",
    "周日晚上",
    "考试前",
    "写周报时",
    "代码评审前",
    "灵感枯竭时",
    "刚被催进度时",
  ],
  情绪: [
    "烂尾焦虑",
    "想炫耀",
    "怕出错",
    "无聊",
    "羞耻",
    "好奇",
    "想逃避",
    "有点不服",
    "怕浪费时间",
    "想被理解",
    "想偷懒",
    "想重新开始",
  ],
  物件: [
    "浏览器历史",
    "GitHub 仓库",
    "截图",
    "日历",
    "聊天记录",
    "文件夹",
    "地图",
    "待办清单",
    "命令行",
    "表格",
    "书签",
    "录音片段",
  ],
  结构: [
    "博物馆",
    "法庭",
    "塔防",
    "机场塔台",
    "拍卖",
    "体检",
    "黑匣子",
    "技能树",
    "许愿池",
    "赌场",
    "档案馆",
    "厨房",
  ],
  限制: [
    "每天只能用 1 分钟",
    "不能联网",
    "不能给建议",
    "界面像计算器",
    "只能提问",
    "不能显示数字",
    "必须像游戏",
    "结果只能保留一天",
    "用户越努力功能越少",
    "只能离线使用",
    "必须让用户慢下来",
    "不能出现排行榜",
  ],
};
```

- [ ] **Step 6: Create fallback idea templates**

Write `app/src/data/fallbackIdeas.ts`:

```ts
import type { TransformDirection } from "../types/idea";

export const IDEA_TITLE_NOUNS = [
  "遗迹馆",
  "塔台",
  "黑匣子",
  "许愿池",
  "体检站",
  "技能树",
  "档案馆",
  "慢速仪表盘",
];

export const TRANSFORM_COPY: Record<TransformDirection, string> = {
  更实用一点: "把隐喻收束成一个每天能用的小工具，先解决一个具体动作。",
  更荒诞一点: "保留原始问题，但把外壳推到更奇怪、更容易被记住的方向。",
  更游戏化一点: "把用户行动变成关卡、资源、进度和反馈，让重复使用更有趣。",
  更像浏览器插件: "让它贴近用户已经发生的浏览、收藏、截图和搜索行为。",
  "更像 Agent skill": "把它变成一个能被反复调用的自动化技能，输入清晰，输出稳定。",
  只保留核心隐喻: "删掉多余功能，只留下最有生命力的比喻和使用瞬间。",
};
```

- [ ] **Step 7: Implement local idea engine**

Write `app/src/lib/ideaEngine.ts`:

```ts
import { FALLBACK_WORDS, GROUP_DESCRIPTIONS } from "../data/fallbackWords";
import { IDEA_TITLE_NOUNS, TRANSFORM_COPY } from "../data/fallbackIdeas";
import { createId } from "./id";
import { DIMENSION_GROUPS, type DimensionGroup, type DimensionWord, type IdeaCard, type Intensity, type TransformDirection } from "../types/idea";

const INTENSITY_OFFSET: Record<Intensity, number> = {
  轻微: 0,
  正常: 2,
  狂野: 4,
};

function rotateWords(words: string[], topic: string, intensity: Intensity): string[] {
  const topicScore = Array.from(topic).reduce((score, char) => score + char.charCodeAt(0), 0);
  const offset = (topicScore + INTENSITY_OFFSET[intensity]) % words.length;
  return [...words.slice(offset), ...words.slice(0, offset)];
}

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

function wordOfType(words: DimensionWord[], type: DimensionWord["groupType"]): string {
  return words.find((word) => word.groupType === type)?.text ?? type;
}

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
```

- [ ] **Step 8: Run engine tests**

Run:

```powershell
Set-Location .\app
npm test -- src/lib/ideaEngine.test.ts
```

Expected:

```text
PASS src/lib/ideaEngine.test.ts
```

- [ ] **Step 9: Commit domain engine**

Run:

```powershell
Set-Location ..
git add app/src/types app/src/lib app/src/data
git commit -m "feat: add local idea generation engine"
```

Expected:

```text
[main ...] feat: add local idea generation engine
```

---

## Task 3: AI Service Contract with Local Fallback

**Files:**
- Create: `./app/src/services/ideaApi.ts`
- Test: `./app/src/services/ideaApi.test.ts`

- [ ] **Step 1: Write service tests**

Create `app/src/services/ideaApi.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { generateIdeas, generateWords, transformIdea } from "./ideaApi";

describe("ideaApi", () => {
  it("falls back to local words when no API endpoint is configured", async () => {
    const groups = await generateWords({ topic: "我没有项目灵感", intensity: "正常" });

    expect(groups).toHaveLength(6);
    expect(groups[0]?.words).toHaveLength(8);
  });

  it("falls back to local ideas when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network failed")));
    const groups = await generateWords({ topic: "开发者工具", intensity: "正常" });
    const ideas = await generateIdeas({ topic: "开发者工具", sourceWords: groups.map((group) => group.words[0]) });

    expect(ideas.length).toBeGreaterThanOrEqual(3);
    expect(ideas[0]?.sourceWords).toHaveLength(6);
    vi.unstubAllGlobals();
  });

  it("transforms an idea through fallback when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network failed")));
    const groups = await generateWords({ topic: "内容选题", intensity: "轻微" });
    const ideas = await generateIdeas({ topic: "内容选题", sourceWords: groups.map((group) => group.words[0]) });
    const transformed = await transformIdea({ idea: ideas[0], direction: "只保留核心隐喻" });

    expect(transformed.parentId).toBe(ideas[0]?.id);
    expect(transformed.transformDirection).toBe("只保留核心隐喻");
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run tests and confirm they fail**

Run:

```powershell
Set-Location .\app
npm test -- src/services/ideaApi.test.ts
```

Expected:

```text
FAIL src/services/ideaApi.test.ts
Cannot find module './ideaApi'
```

- [ ] **Step 3: Implement typed service**

Write `app/src/services/ideaApi.ts`:

```ts
import type { DimensionGroup, DimensionWord, IdeaCard, Intensity, TransformDirection } from "../types/idea";
import { generateFallbackIdeas, generateFallbackWords, transformFallbackIdea } from "../lib/ideaEngine";

interface GenerateWordsRequest {
  topic: string;
  intensity: Intensity;
}

interface GenerateIdeasRequest {
  topic: string;
  sourceWords: DimensionWord[];
}

interface TransformIdeaRequest {
  idea: IdeaCard;
  direction: TransformDirection;
}

const API_BASE_URL = import.meta.env.VITE_IDEA_API_URL as string | undefined;

async function postJson<TRequest, TResponse>(path: string, body: TRequest): Promise<TResponse> {
  if (!API_BASE_URL) {
    throw new Error("AI 接口未配置");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`AI 接口返回 ${response.status}`);
  }

  return (await response.json()) as TResponse;
}

export async function generateWords(request: GenerateWordsRequest): Promise<DimensionGroup[]> {
  try {
    return await postJson<GenerateWordsRequest, DimensionGroup[]>("/words", request);
  } catch {
    return generateFallbackWords(request.topic, request.intensity);
  }
}

export async function generateIdeas(request: GenerateIdeasRequest): Promise<IdeaCard[]> {
  try {
    return await postJson<GenerateIdeasRequest, IdeaCard[]>("/ideas", request);
  } catch {
    return generateFallbackIdeas(request.topic, request.sourceWords);
  }
}

export async function transformIdea(request: TransformIdeaRequest): Promise<IdeaCard> {
  try {
    return await postJson<TransformIdeaRequest, IdeaCard>("/transform", request);
  } catch {
    return transformFallbackIdea(request.idea, request.direction);
  }
}
```

- [ ] **Step 4: Run service tests**

Run:

```powershell
Set-Location .\app
npm test -- src/services/ideaApi.test.ts
```

Expected:

```text
PASS src/services/ideaApi.test.ts
```

- [ ] **Step 5: Commit service**

Run:

```powershell
Set-Location ..
git add app/src/services
git commit -m "feat: add idea api fallback service"
```

Expected:

```text
[main ...] feat: add idea api fallback service
```

---

## Task 4: Zustand Store and Local Persistence

**Files:**
- Create: `./app/src/store/storage.ts`
- Create: `./app/src/store/ideaStore.ts`
- Test: `./app/src/store/ideaStore.test.ts`

- [ ] **Step 1: Write store tests**

Create `app/src/store/ideaStore.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests and confirm they fail**

Run:

```powershell
Set-Location .\app
npm test -- src/store/ideaStore.test.ts
```

Expected:

```text
FAIL src/store/ideaStore.test.ts
Cannot find module './ideaStore'
```

- [ ] **Step 3: Create localStorage helpers**

Write `app/src/store/storage.ts`:

```ts
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

export function saveFavorites(favorites: FavoriteIdea[]): void {
  const state: StoredState = {
    version: 1,
    favorites,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
```

- [ ] **Step 4: Implement store**

Write `app/src/store/ideaStore.ts`:

```ts
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
  error: undefined,
};

function selectedWords(groups: DimensionGroup[]): DimensionWord[] {
  return groups.flatMap((group) => group.words.filter((word) => word.selected).slice(0, 1));
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

    set({ loading: "words", error: undefined });
    const groups = await requestWords({ topic, intensity });
    set({ groups, ideas: [], activeIdeaId: undefined, loading: "idle" });
  },
  toggleWordLock: (wordId) =>
    set((state) => ({
      groups: state.groups.map((group) => ({
        ...group,
        words: group.words.map((word) => (word.id === wordId ? { ...word, locked: !word.locked } : word)),
      })),
    })),
  selectWord: (wordId) =>
    set((state) => ({
      groups: state.groups.map((group) => ({
        ...group,
        words: group.words.map((word) => ({
          ...word,
          selected: word.id === wordId ? true : word.groupType === state.groups.flatMap((item) => item.words).find((item) => item.id === wordId)?.groupType ? false : word.selected,
        })),
      })),
    })),
  rerollUnlockedWords: async () => {
    const { topic, intensity, groups } = get();
    set({ loading: "words", error: undefined });
    const freshGroups = await requestWords({ topic: `${topic} ${Date.now()}`, intensity });
    const nextGroups = freshGroups.map((freshGroup) => {
      const currentGroup = groups.find((group) => group.type === freshGroup.type);
      const locked = currentGroup?.words.filter((word) => word.locked) ?? [];
      return {
        ...freshGroup,
        words: [...locked, ...freshGroup.words.filter((word) => !locked.some((lockedWord) => lockedWord.text === word.text))].slice(0, 8),
      };
    });
    set({ groups: nextGroups, loading: "idle" });
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

    set({ loading: "ideas", error: undefined });
    const ideas = await requestIdeas({ topic, sourceWords: words });
    set({ ideas, activeIdeaId: ideas[0]?.id, loading: "idle" });
  },
  setActiveIdea: (ideaId) => set({ activeIdeaId: ideaId }),
  transformActiveIdea: async (direction) => {
    const { ideas, activeIdeaId } = get();
    const idea = ideas.find((item) => item.id === activeIdeaId);
    if (!idea) {
      set({ error: "先选中一张脑洞卡片。" });
      return;
    }

    set({ loading: "transform", error: undefined });
    const transformed = await requestTransform({ idea, direction });
    set((state) => ({
      ideas: [transformed, ...state.ideas],
      activeIdeaId: transformed.id,
      loading: "idle",
    }));
  },
  toggleFavorite: (ideaId) => {
    const { ideas, favorites } = get();
    const existing = favorites.find((favorite) => favorite.idea.id === ideaId);
    const nextFavorites = existing
      ? favorites.filter((favorite) => favorite.idea.id !== ideaId)
      : [
          ...favorites,
          {
            idea: ideas.find((idea) => idea.id === ideaId) as IdeaCard,
            savedAt: new Date().toISOString(),
          },
        ];

    saveFavorites(nextFavorites);
    set({ favorites: nextFavorites });
  },
}));
```

- [ ] **Step 5: Run store tests**

Run:

```powershell
Set-Location .\app
npm test -- src/store/ideaStore.test.ts
```

Expected:

```text
PASS src/store/ideaStore.test.ts
```

- [ ] **Step 6: Commit store**

Run:

```powershell
Set-Location ..
git add app/src/store
git commit -m "feat: add idea workbench store"
```

Expected:

```text
[main ...] feat: add idea workbench store
```

---

## Task 5: UI Foundation and App Shell

**Files:**
- Create: `./app/src/lib/cn.ts`
- Create: `./app/src/components/ui/Button.tsx`
- Create: `./app/src/components/ui/Panel.tsx`
- Create: `./app/src/components/ui/Chip.tsx`
- Create: `./app/src/components/layout/AppShell.tsx`
- Modify: `./app/src/App.tsx`

- [ ] **Step 1: Create class name helper**

Write `app/src/lib/cn.ts`:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: Create button component**

Write `app/src/components/ui/Button.tsx`:

```tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  icon?: ReactNode;
}

export function Button({ className, variant = "secondary", icon, children, ...props }: ButtonProps): JSX.Element {
  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-spark-500 text-white hover:bg-spark-600 active:scale-[0.99]",
        variant === "secondary" && "border border-line-100 bg-paper-0 text-ink-900 hover:border-spark-500 hover:text-spark-600",
        variant === "ghost" && "text-ink-700 hover:bg-paper-100 hover:text-ink-900",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
```

- [ ] **Step 3: Create panel component**

Write `app/src/components/ui/Panel.tsx`:

```tsx
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface PanelProps {
  title?: string;
  eyebrow?: string;
  className?: string;
  children: ReactNode;
}

export function Panel({ title, eyebrow, className, children }: PanelProps): JSX.Element {
  return (
    <section className={cn("rounded-lg border border-line-100 bg-paper-0 p-5 shadow-soft", className)}>
      {(eyebrow || title) && (
        <header className="mb-4">
          {eyebrow && <p className="font-mono text-xs text-spark-500">{eyebrow}</p>}
          {title && <h2 className="mt-1 text-lg font-semibold text-ink-900">{title}</h2>}
        </header>
      )}
      {children}
    </section>
  );
}
```

- [ ] **Step 4: Create chip component**

Write `app/src/components/ui/Chip.tsx`:

```tsx
import { Lock, Unlock } from "lucide-react";
import { cn } from "../../lib/cn";
import type { DimensionGroupType } from "../../types/idea";

const GROUP_COLOR: Record<DimensionGroupType, string> = {
  人群: "bg-sky-100",
  场景: "bg-yellow-100",
  情绪: "bg-rose-100",
  物件: "bg-mint-100",
  结构: "bg-violet-100",
  限制: "bg-paper-100 border-dashed",
};

interface ChipProps {
  text: string;
  groupType: DimensionGroupType;
  selected: boolean;
  locked: boolean;
  onSelect: () => void;
  onToggleLock: () => void;
}

export function Chip({ text, groupType, selected, locked, onSelect, onToggleLock }: ChipProps): JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-1 rounded-full border border-transparent px-3 text-sm text-ink-900 transition",
        GROUP_COLOR[groupType],
        selected && "border-spark-500 ring-2 ring-spark-500/20",
        locked && "border-ink-700",
      )}
    >
      <button className="max-w-32 truncate" type="button" onClick={onSelect} title={text}>
        {text}
      </button>
      <button type="button" onClick={onToggleLock} aria-label={locked ? "解锁词" : "锁定词"}>
        {locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}
```

- [ ] **Step 5: Create app shell**

Write `app/src/components/layout/AppShell.tsx`:

```tsx
import type { ReactNode } from "react";
import { FlaskConical } from "lucide-react";

interface AppShellProps {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}

export function AppShell({ left, center, right }: AppShellProps): JSX.Element {
  return (
    <main className="min-h-screen bg-paper-50 text-ink-900">
      <div className="grid min-h-screen gap-4 p-4 lg:grid-cols-[280px_minmax(0,1fr)_360px]">
        <aside className="space-y-4">{left}</aside>
        <section className="min-w-0 space-y-4">
          <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line-100 bg-paper-0 px-5 py-4 shadow-soft">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-spark-500 text-white">
                <FlaskConical className="h-5 w-5" />
              </span>
              <div>
                <p className="font-mono text-xs text-spark-500">Idea Lab</p>
                <h1 className="font-serif text-2xl leading-tight">脑洞实验室</h1>
              </div>
            </div>
            <p className="text-sm text-ink-500">先陪人发散，再帮人落地。</p>
          </header>
          {center}
        </section>
        <aside className="space-y-4">{right}</aside>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Wire temporary shell in App**

Replace `app/src/App.tsx`:

```tsx
import { AppShell } from "./components/layout/AppShell";
import { Panel } from "./components/ui/Panel";

function App(): JSX.Element {
  return (
    <AppShell
      left={<Panel title="会话">当前 MVP 先做单次会话。</Panel>}
      center={<Panel title="发散工作台">这里会放主题输入、维度词和碰撞台。</Panel>}
      right={<Panel title="孵化箱">收藏的脑洞会出现在这里。</Panel>}
    />
  );
}

export default App;
```

- [ ] **Step 7: Verify UI foundation builds**

Run:

```powershell
Set-Location .\app
npm run build
```

Expected:

```text
✓ built
```

- [ ] **Step 8: Commit UI foundation**

Run:

```powershell
Set-Location ..
git add app/src
git commit -m "feat: add idea lab ui shell"
```

Expected:

```text
[main ...] feat: add idea lab ui shell
```

---

## Task 6: Core Workbench Components

**Files:**
- Create: `./app/src/components/workbench/TopicComposer.tsx`
- Create: `./app/src/components/workbench/DimensionBoard.tsx`
- Create: `./app/src/components/workbench/CollisionTray.tsx`
- Create: `./app/src/components/workbench/IdeaCard.tsx`
- Create: `./app/src/components/workbench/IdeaCardList.tsx`
- Create: `./app/src/components/workbench/TransformerPanel.tsx`
- Create: `./app/src/components/workbench/FavoriteDock.tsx`
- Modify: `./app/src/App.tsx`

- [ ] **Step 1: Create topic composer**

Write `app/src/components/workbench/TopicComposer.tsx`:

```tsx
import { Sparkles } from "lucide-react";
import { useIdeaStore } from "../../store/ideaStore";
import type { Intensity } from "../../types/idea";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";

const INTENSITIES: Intensity[] = ["轻微", "正常", "狂野"];

export function TopicComposer(): JSX.Element {
  const topic = useIdeaStore((state) => state.topic);
  const intensity = useIdeaStore((state) => state.intensity);
  const loading = useIdeaStore((state) => state.loading);
  const setTopic = useIdeaStore((state) => state.setTopic);
  const setIntensity = useIdeaStore((state) => state.setIntensity);
  const generateWords = useIdeaStore((state) => state.generateWords);

  return (
    <Panel eyebrow="Start" title="先给我一个模糊方向">
      <textarea
        className="min-h-28 w-full resize-none rounded-lg border border-line-100 bg-paper-50 p-4 text-base leading-7 outline-none transition focus:border-spark-500 focus:ring-2 focus:ring-spark-500/20"
        value={topic}
        onChange={(event) => setTopic(event.target.value)}
        placeholder="例如：我想做一个有趣的开发者工具"
      />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-line-100 bg-paper-100 p-1">
          {INTENSITIES.map((item) => (
            <button
              key={item}
              className={`rounded px-3 py-1.5 text-sm ${intensity === item ? "bg-paper-0 text-spark-600 shadow-sm" : "text-ink-500"}`}
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
```

- [ ] **Step 2: Create dimension board**

Write `app/src/components/workbench/DimensionBoard.tsx`:

```tsx
import { Shuffle } from "lucide-react";
import { useIdeaStore } from "../../store/ideaStore";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";
import { Panel } from "../ui/Panel";

export function DimensionBoard(): JSX.Element {
  const groups = useIdeaStore((state) => state.groups);
  const loading = useIdeaStore((state) => state.loading);
  const selectWord = useIdeaStore((state) => state.selectWord);
  const toggleWordLock = useIdeaStore((state) => state.toggleWordLock);
  const rerollUnlockedWords = useIdeaStore((state) => state.rerollUnlockedWords);

  if (groups.length === 0) {
    return (
      <Panel eyebrow="Words" title="维度词">
        <p className="text-sm leading-6 text-ink-500">输入主题后，这里会出现六组可以碰撞的词。</p>
      </Panel>
    );
  }

  return (
    <Panel eyebrow="Words" title="维度词">
      <div className="mb-4 flex justify-end">
        <Button variant="secondary" icon={<Shuffle className="h-4 w-4" />} disabled={loading !== "idle"} onClick={() => void rerollUnlockedWords()}>
          换一批刺激
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((group) => (
          <section key={group.type} className="rounded-lg bg-paper-50 p-4">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h3 className="font-semibold">{group.label}</h3>
              <p className="text-xs text-ink-500">{group.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {group.words.map((word) => (
                <Chip
                  key={word.id}
                  text={word.text}
                  groupType={word.groupType}
                  selected={word.selected}
                  locked={word.locked}
                  onSelect={() => selectWord(word.id)}
                  onToggleLock={() => toggleWordLock(word.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </Panel>
  );
}
```

- [ ] **Step 3: Create collision tray**

Write `app/src/components/workbench/CollisionTray.tsx`:

```tsx
import { GitMerge, Shuffle } from "lucide-react";
import { useIdeaStore } from "../../store/ideaStore";
import { DIMENSION_GROUPS } from "../../types/idea";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";

export function CollisionTray(): JSX.Element {
  const groups = useIdeaStore((state) => state.groups);
  const loading = useIdeaStore((state) => state.loading);
  const randomizeCollision = useIdeaStore((state) => state.randomizeCollision);
  const generateIdeas = useIdeaStore((state) => state.generateIdeas);
  const selected = groups.flatMap((group) => group.words.filter((word) => word.selected));

  return (
    <Panel eyebrow="Collision" title="碰撞台">
      <div className="grid gap-2 md:grid-cols-3">
        {DIMENSION_GROUPS.map((type) => {
          const word = selected.find((item) => item.groupType === type);
          return (
            <div key={type} className="rounded-lg border border-dashed border-line-100 bg-paper-50 p-3">
              <p className="text-xs text-ink-500">{type}</p>
              <p className="mt-1 min-h-6 font-medium">{word?.text ?? "还没选"}</p>
            </div>
          );
        })}
      </div>
      <p className="mt-4 rounded-lg bg-paper-100 p-3 text-sm leading-6 text-ink-700">
        {selected.length === 6 ? `给“${selected[0]?.text}”，在“${selected[1]?.text}”时，带着“${selected[2]?.text}”，用“${selected[3]?.text}”和“${selected[4]?.text}”结构，做一个“${selected[5]?.text}”的产品。` : "每类选一个词后，就可以把它们撞一下。"}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" icon={<Shuffle className="h-4 w-4" />} disabled={groups.length === 0} onClick={randomizeCollision}>
          随机组合
        </Button>
        <Button variant="primary" icon={<GitMerge className="h-4 w-4" />} disabled={selected.length !== 6 || loading !== "idle"} onClick={() => void generateIdeas()}>
          把这些词撞一下
        </Button>
      </div>
    </Panel>
  );
}
```

- [ ] **Step 4: Create idea card components**

Write `app/src/components/workbench/IdeaCard.tsx`:

```tsx
import { Bookmark, WandSparkles } from "lucide-react";
import { useIdeaStore } from "../../store/ideaStore";
import type { IdeaCard as IdeaCardType } from "../../types/idea";
import { Button } from "../ui/Button";

interface IdeaCardProps {
  idea: IdeaCardType;
}

export function IdeaCard({ idea }: IdeaCardProps): JSX.Element {
  const activeIdeaId = useIdeaStore((state) => state.activeIdeaId);
  const favorites = useIdeaStore((state) => state.favorites);
  const setActiveIdea = useIdeaStore((state) => state.setActiveIdea);
  const toggleFavorite = useIdeaStore((state) => state.toggleFavorite);
  const isFavorite = favorites.some((favorite) => favorite.idea.id === idea.id);

  return (
    <article className={`rounded-lg border bg-paper-0 p-5 transition ${activeIdeaId === idea.id ? "border-spark-500 shadow-soft" : "border-line-100"}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-serif text-2xl leading-8">{idea.title}</h3>
          <p className="mt-2 text-sm leading-6 text-ink-700">{idea.summary}</p>
        </div>
        <Button variant="ghost" onClick={() => setActiveIdea(idea.id)} icon={<WandSparkles className="h-4 w-4" />}>
          选中
        </Button>
      </div>
      <p className="mt-4 text-sm leading-6 text-ink-700">{idea.whyInteresting}</p>
      <p className="mt-3 rounded-md bg-paper-50 p-3 text-sm leading-6 text-ink-700">{idea.firstVersion}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {idea.sourceWords.map((word) => (
          <span key={word.id} className="rounded-full bg-paper-100 px-2.5 py-1 text-xs text-ink-700">
            {word.text}
          </span>
        ))}
      </div>
      <div className="mt-4">
        <Button variant={isFavorite ? "primary" : "secondary"} icon={<Bookmark className="h-4 w-4" />} onClick={() => toggleFavorite(idea.id)}>
          {isFavorite ? "已收藏" : "收藏"}
        </Button>
      </div>
    </article>
  );
}
```

Write `app/src/components/workbench/IdeaCardList.tsx`:

```tsx
import { useIdeaStore } from "../../store/ideaStore";
import { Panel } from "../ui/Panel";
import { IdeaCard } from "./IdeaCard";

export function IdeaCardList(): JSX.Element {
  const ideas = useIdeaStore((state) => state.ideas);
  const loading = useIdeaStore((state) => state.loading);

  return (
    <Panel eyebrow="Ideas" title="脑洞卡片">
      {loading === "ideas" && <p className="text-sm text-ink-500">正在碰撞这些词。</p>}
      {ideas.length === 0 && loading !== "ideas" && <p className="text-sm leading-6 text-ink-500">脑洞会从碰撞台下面长出来。</p>}
      <div className="space-y-3">
        {ideas.map((idea) => (
          <IdeaCard key={idea.id} idea={idea} />
        ))}
      </div>
    </Panel>
  );
}
```

- [ ] **Step 5: Create transformer panel**

Write `app/src/components/workbench/TransformerPanel.tsx`:

```tsx
import { WandSparkles } from "lucide-react";
import { useIdeaStore } from "../../store/ideaStore";
import { TRANSFORM_DIRECTIONS } from "../../types/idea";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";

export function TransformerPanel(): JSX.Element {
  const ideas = useIdeaStore((state) => state.ideas);
  const activeIdeaId = useIdeaStore((state) => state.activeIdeaId);
  const loading = useIdeaStore((state) => state.loading);
  const transformActiveIdea = useIdeaStore((state) => state.transformActiveIdea);
  const activeIdea = ideas.find((idea) => idea.id === activeIdeaId);

  return (
    <Panel eyebrow="Transform" title="变形器">
      {!activeIdea && <p className="text-sm leading-6 text-ink-500">选中一张脑洞卡片，再换一个角度扭它。</p>}
      {activeIdea && <p className="mb-3 text-sm leading-6 text-ink-700">正在变形：{activeIdea.title}</p>}
      <div className="grid gap-2">
        {TRANSFORM_DIRECTIONS.map((direction) => (
          <Button key={direction} variant="secondary" icon={<WandSparkles className="h-4 w-4" />} disabled={!activeIdea || loading !== "idle"} onClick={() => void transformActiveIdea(direction)}>
            {direction}
          </Button>
        ))}
      </div>
    </Panel>
  );
}
```

- [ ] **Step 6: Create favorite dock**

Write `app/src/components/workbench/FavoriteDock.tsx`:

```tsx
import { Bookmark } from "lucide-react";
import { useEffect } from "react";
import { useIdeaStore } from "../../store/ideaStore";
import { Panel } from "../ui/Panel";

export function FavoriteDock(): JSX.Element {
  const favorites = useIdeaStore((state) => state.favorites);
  const hydrate = useIdeaStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <Panel eyebrow="Incubator" title="孵化箱">
      {favorites.length === 0 && <p className="text-sm leading-6 text-ink-500">先收藏一个有生命力的脑洞，它会在这里继续发酵。</p>}
      <div className="space-y-2">
        {favorites.map((favorite) => (
          <article key={favorite.idea.id} className="rounded-lg bg-mint-100 p-3">
            <div className="flex items-center gap-2">
              <Bookmark className="h-4 w-4 text-ink-700" />
              <h3 className="font-medium">{favorite.idea.title}</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-ink-700">{favorite.idea.summary}</p>
          </article>
        ))}
      </div>
    </Panel>
  );
}
```

- [ ] **Step 7: Compose final MVP page**

Replace `app/src/App.tsx`:

```tsx
import { AppShell } from "./components/layout/AppShell";
import { Panel } from "./components/ui/Panel";
import { CollisionTray } from "./components/workbench/CollisionTray";
import { DimensionBoard } from "./components/workbench/DimensionBoard";
import { FavoriteDock } from "./components/workbench/FavoriteDock";
import { IdeaCardList } from "./components/workbench/IdeaCardList";
import { TopicComposer } from "./components/workbench/TopicComposer";
import { TransformerPanel } from "./components/workbench/TransformerPanel";
import { useIdeaStore } from "./store/ideaStore";

function App(): JSX.Element {
  const error = useIdeaStore((state) => state.error);

  return (
    <AppShell
      left={
        <>
          <Panel eyebrow="Session" title="当前会话">
            <p className="text-sm leading-6 text-ink-500">MVP 先把一次发散流程做顺。会话管理放到第二阶段。</p>
          </Panel>
          <FavoriteDock />
        </>
      }
      center={
        <>
          <TopicComposer />
          {error && <div className="rounded-lg border border-amber-600 bg-yellow-100 p-3 text-sm text-ink-900">{error}</div>}
          <DimensionBoard />
          <CollisionTray />
          <IdeaCardList />
        </>
      }
      right={<TransformerPanel />}
    />
  );
}

export default App;
```

- [ ] **Step 8: Verify workbench builds**

Run:

```powershell
Set-Location .\app
npm run build
```

Expected:

```text
✓ built
```

- [ ] **Step 9: Commit workbench UI**

Run:

```powershell
Set-Location ..
git add app/src
git commit -m "feat: build mvp idea workbench"
```

Expected:

```text
[main ...] feat: build mvp idea workbench
```

---

## Task 7: Responsive Polish, Loading States, and Accessibility Pass

**Files:**
- Modify: `./app/src/components/layout/AppShell.tsx`
- Modify: `./app/src/components/workbench/TopicComposer.tsx`
- Modify: `./app/src/components/workbench/DimensionBoard.tsx`
- Modify: `./app/src/components/workbench/IdeaCard.tsx`
- Modify: `./app/src/index.css`

- [ ] **Step 1: Add reduced motion support**

Append to `app/src/index.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

- [ ] **Step 2: Improve mobile shell**

In `app/src/components/layout/AppShell.tsx`, keep the existing component but ensure the grid class remains:

```tsx
<div className="grid min-h-screen gap-4 p-4 lg:grid-cols-[280px_minmax(0,1fr)_360px]">
```

Expected behavior:

```text
Mobile stacks left, center, right as one column.
Desktop uses three columns.
```

- [ ] **Step 3: Add accessible labels to the topic input**

In `TopicComposer.tsx`, add a visible label before the textarea:

```tsx
<label className="mb-2 block text-sm font-medium text-ink-700" htmlFor="topic-input">
  主题
</label>
<textarea id="topic-input" ... />
```

Expected:

```text
The textarea has an associated label named 主题.
```

- [ ] **Step 4: Ensure long idea text wraps**

In `IdeaCard.tsx`, add `break-words` to title and paragraph containers:

```tsx
<h3 className="break-words font-serif text-2xl leading-8">{idea.title}</h3>
```

Expected:

```text
Long generated words do not overflow the card.
```

- [ ] **Step 5: Run build**

Run:

```powershell
Set-Location .\app
npm run build
```

Expected:

```text
✓ built
```

- [ ] **Step 6: Commit polish**

Run:

```powershell
Set-Location ..
git add app/src
git commit -m "polish: improve mvp responsiveness and states"
```

Expected:

```text
[main ...] polish: improve mvp responsiveness and states
```

---

## Task 8: Playwright End-to-End MVP Flow

**Files:**
- Create: `./app/playwright.config.ts`
- Create: `./app/e2e/mvp-flow.spec.ts`

- [ ] **Step 1: Create Playwright config**

Write `app/playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"] },
    },
  ],
});
```

- [ ] **Step 2: Create E2E flow**

Write `app/e2e/mvp-flow.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("user can complete the MVP creativity flow", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("主题").fill("我想做一个有趣的开发者工具");
  await page.getByRole("button", { name: "开始发散" }).click();

  await expect(page.getByText("维度词")).toBeVisible();
  await expect(page.getByRole("button", { name: "把这些词撞一下" })).toBeEnabled();

  await page.getByRole("button", { name: "换一批刺激" }).click();
  await page.getByRole("button", { name: "随机组合" }).click();
  await page.getByRole("button", { name: "把这些词撞一下" }).click();

  await expect(page.getByText("脑洞卡片")).toBeVisible();
  await page.getByRole("button", { name: "选中" }).first().click();
  await page.getByRole("button", { name: "更游戏化一点" }).click();
  await expect(page.getByText("更游戏化一点")).toBeVisible();

  await page.getByRole("button", { name: "收藏" }).first().click();
  await expect(page.getByText("已收藏")).toBeVisible();

  await page.reload();
  await expect(page.getByText("孵化箱")).toBeVisible();
});
```

- [ ] **Step 3: Install Playwright browser**

Run:

```powershell
Set-Location .\app
npx playwright install chromium
```

Expected:

```text
Chromium is installed
```

- [ ] **Step 4: Run E2E tests**

Run:

```powershell
Set-Location .\app
npm run e2e
```

Expected:

```text
2 passed
```

- [ ] **Step 5: Commit E2E tests**

Run:

```powershell
Set-Location ..
git add app/playwright.config.ts app/e2e
git commit -m "test: cover mvp creativity flow"
```

Expected:

```text
[main ...] test: cover mvp creativity flow
```

---

## Task 9: Documentation and Final Verification

**Files:**
- Create or Modify: `./README.md`
- Create or Modify: `./ARCHITECTURE.md`
- Modify: `./CONTEXT.md`

- [ ] **Step 1: Write README**

Write `README.md`:

```md
# 脑洞实验室

脑洞实验室是一个帮助用户从灵感枯竭重新进入发散状态的 AI 创意工作台。第一版支持输入主题、生成维度词、锁定和重掷词、碰撞脑洞、变形脑洞，以及本地收藏。

## 本地运行

```powershell
Set-Location .\app
npm install
npm run dev
```

打开终端显示的本地地址，通常是 `http://127.0.0.1:5173`。

## 测试

```powershell
Set-Location .\app
npm test
npm run build
npm run e2e
```

## 技术架构

- Vite + React + TypeScript：负责前端应用。
- Tailwind CSS：负责视觉样式。
- Zustand：负责主题、词组、脑洞和收藏状态。
- localStorage：保存第一版收藏内容。
- Vitest：测试本地生成逻辑和状态管理。
- Playwright：测试完整使用路径。

## 已完成功能

- 主题输入和发散强度选择。
- 六类维度词生成。
- 词语锁定、选择和重掷。
- 碰撞生成脑洞卡片。
- 脑洞变形。
- 收藏和本地持久化。

## 后续阶段

- 第二阶段增加素材池、联想路径、角色圆桌、孵化箱混合和会话管理。
- 第三阶段增加账号、同步、模板库、分享和团队工作坊。

## 搜索记录

- 已在前期调研 GitHub 和 skills 项目，结论沉淀在 `PROJECT_VISION.md`、`TASKS.md` 和 `DESIGN.md`。
```

- [ ] **Step 2: Write architecture document**

Write `ARCHITECTURE.md`:

```md
# 脑洞实验室架构说明

## 模块职责

- `app/src/types/idea.ts`：定义维度词、脑洞卡片、收藏和会话类型。
- `app/src/data/fallbackWords.ts`：提供六类本地维度词。
- `app/src/data/fallbackIdeas.ts`：提供本地脑洞标题和变形文案。
- `app/src/lib/ideaEngine.ts`：在没有 AI 接口时生成词、脑洞和变形结果。
- `app/src/services/ideaApi.ts`：统一处理 AI 请求；失败时自动回到本地生成。
- `app/src/store/storage.ts`：读取和保存 localStorage。
- `app/src/store/ideaStore.ts`：管理主题、词组、脑洞、变形和收藏。
- `app/src/components/layout/AppShell.tsx`：组织三栏工作台布局。
- `app/src/components/workbench/*`：实现主题输入、维度词、碰撞台、脑洞卡片、变形器和收藏区。

## 数据流

用户输入主题后，`TopicComposer` 调用 `ideaStore.generateWords()`。store 通过 `ideaApi.generateWords()` 获取六类词；如果 AI 不可用，则使用 `ideaEngine.generateFallbackWords()`。用户选择词后，`CollisionTray` 调用 `ideaStore.generateIdeas()`，生成脑洞卡片。用户选中脑洞后，`TransformerPanel` 调用 `ideaStore.transformActiveIdea()` 生成变体。收藏动作写入 Zustand，同时通过 `storage.ts` 保存到 localStorage。

## 关键决定

- 第一版只做单人本地 MVP，减少账号和后端复杂度。
- AI 请求集中在 service 层，组件不直接调用 fetch。
- 本地 fallback 是产品能力的一部分，不只是调试数据；这样没有 AI 接口时也能完整演示。
- 三栏布局延续 `DESIGN.md` 的轻实验室风格，移动端自动堆叠。
```

- [ ] **Step 3: Update context**

Write `CONTEXT.md` with:

```md
# 当前上下文

当前正在做：开发“脑洞实验室”第一阶段 MVP。

上次停在：已完成 MVP 开发计划，计划文件为 `docs/superpowers/plans/2026-07-07-idea-lab-mvp.md`。

关键决定：

- 前端应用放在 `app/` 目录，避免和现有产品文档、脚本、样张混在一起。
- 第一版只做主题输入、维度词、锁定/重掷、碰撞、变形、收藏和本地持久化。
- 技术栈为 Vite + React + TypeScript + Tailwind CSS + Zustand + Vitest + Playwright。
- AI 能力统一封装在 `services/ideaApi.ts`；没有接口或接口失败时，使用本地 fallback，保证产品可演示。
- MVP 完成验收路径为：输入主题 -> 生成词 -> 锁词/重掷 -> 碰撞 -> 生成脑洞 -> 变形 -> 收藏 -> 刷新后仍在。
```

- [ ] **Step 4: Run full verification**

Run:

```powershell
Set-Location .\app
npm test
npm run build
npm run e2e
```

Expected:

```text
All unit tests pass.
Build succeeds.
Playwright reports 2 passed.
```

- [ ] **Step 5: Commit docs**

Run:

```powershell
Set-Location ..
git add README.md ARCHITECTURE.md CONTEXT.md
git commit -m "docs: document mvp development state"
```

Expected:

```text
[main ...] docs: document mvp development state
```

---

## Self-Review

### Spec Coverage

- Topic input: Task 6, `TopicComposer`.
- Six dimension groups: Task 2, `fallbackWords`; Task 6, `DimensionBoard`.
- Lock and reroll: Task 4 store actions; Task 6 dimension UI.
- Collision tray: Task 6, `CollisionTray`.
- Idea generation: Task 2 engine, Task 3 service, Task 4 store, Task 6 UI.
- Transform: Task 2 engine, Task 3 service, Task 4 store, Task 6 `TransformerPanel`.
- Favorite persistence: Task 4 storage/store, Task 6 `FavoriteDock`.
- Fallback without AI: Task 2 and Task 3.
- Main flow verification: Task 8 Playwright.
- Documentation and context: Task 9.

### Placeholder Scan

The plan contains no undefined implementation gaps. Every created file has concrete content or an exact command.

### Type Consistency

- `DimensionGroupType`, `Intensity`, and `TransformDirection` are defined in `types/idea.ts` and reused everywhere.
- Store actions use the same names in tests and components.
- `IdeaCard` favorites store the full idea object, so refresh persistence does not depend on active session state.

## Execution Recommendation

Use subagent-driven execution task by task if parallel review is available. If executing in this same session, run tasks sequentially because Task 2 depends on Task 1, Task 3 depends on Task 2, Task 4 depends on Task 3, and the UI depends on the store.
