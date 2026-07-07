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
