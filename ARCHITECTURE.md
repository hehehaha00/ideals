# 脑洞实验室架构说明

## 模块职责

- `app/src/types/idea.ts`：定义维度词、脑洞卡片、收藏和会话类型。
- `app/src/data/fallbackWords.ts`：提供六类本地维度词。
- `app/src/data/fallbackIdeas.ts`：提供本地脑洞标题和变形文案。
- `app/src/lib/ideaEngine.ts`：在没有 AI 接口时生成词、脑洞和变形结果。
- `app/src/services/ideaApi.ts`：统一处理前端 AI 请求；读取本地代理 SSE，失败时自动回到本地生成。
- `app/src/store/storage.ts`：读取和保存 localStorage。
- `app/src/store/ideaStore.ts`：管理主题、词组、脑洞、变形、流式进度和收藏。
- `app/src/components/layout/AppShell.tsx`：组织三栏工作台布局。
- `app/src/components/workbench/*`：实现主题输入、维度词、碰撞台、脑洞卡片、变形器和收藏区。
- `app/server/index.ts`：启动本地 AI API 代理，提供 `/api/idea/words`、`/api/idea/ideas`、`/api/idea/transform`。
- `app/server/relayClient.ts`：调用 OpenAI 兼容 `/v1/chat/completions`，解析流式 delta。
- `app/server/promptBuilder.ts`：拼接系统提示词和用户提示词，并压缩上下文。
- `app/server/modelOutput.ts`：解析模型 JSON，整理成前端可用结构。
- `app/server/responseCache.ts`：按模型、操作和压缩输入做内存缓存。
- `app/server/config.ts`：读取 `.env.local` 或系统环境变量中的中转站配置。

## 数据流

用户输入主题后，`TopicComposer` 调用 `ideaStore.generateWords()`。store 通过 `ideaApi.generateWords()` 请求同源 `/api/idea/words`。Vite 开发代理把请求转到本地 Node API 代理。代理读取密钥后调用中转站模型，边接收 delta 边通过 SSE 发回前端，最终把模型 JSON 校验成稳定结构。用户选择词后，`CollisionTray` 调用 `ideaStore.generateIdeas()`，生成脑洞卡片。用户选中脑洞后，`TransformerPanel` 调用 `ideaStore.transformActiveIdea()` 生成变体。收藏动作写入 Zustand，同时通过 `storage.ts` 保存到 localStorage。

如果本地代理未启动、key 未配置、网络失败、模型输出无法解析，前端会自动使用 `ideaEngine` 的本地 fallback，保证页面不空白。

## 关键决定

- 第一版只做单人本地 MVP，减少账号和后端复杂度。
- AI key 只在本地 Node API 代理中读取，不进入前端环境变量和浏览器包。
- 中转站直连被网络或 Cloudflare 拦截时，可通过 `IDEA_AI_PROXY_URL` 让代理层走本地 HTTP 代理。
- AI 请求集中在 service 层，组件不直接调用 fetch。
- 本地 fallback 是产品能力的一部分，不只是调试数据；这样没有 AI 接口时也能完整演示。
- 提示词强制只输出 JSON，服务端再做结构校验，避免模型散文式输出把页面打崩。
- 缓存放在服务端内存里，按操作、模型和输入缓存 10 分钟，减少重复请求。
- 上下文压缩在 `promptBuilder.ts` 完成，避免长主题或长脑洞撑爆请求。
- 三栏布局延续 `DESIGN.md` 的轻实验室风格，移动端自动堆叠。
