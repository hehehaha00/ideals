# 当前上下文

当前正在做：给“脑洞实验室”第一阶段 MVP 接入真实 AI 中转站。

上次停在：已完成本地 AI API 代理、流式前端消费、缓存、上下文压缩、提示词拼接和模型 JSON 校验，并用真实中转站 key 测通。

关键决定：

- 前端应用放在 `app/` 目录，避免和现有产品文档、脚本、样张混在一起。
- 第一版只做主题输入、维度词、锁定/重掷、碰撞、变形、收藏和本地持久化。
- 技术栈为 Vite + React + TypeScript + Tailwind CSS + Zustand + Vitest + Playwright。
- AI key 不进入前端打包，通过 `app/server` 本地代理读取环境变量或未提交的 `.env.local`。
- 中转站默认地址为 `https://sub2.congmingai.com`，默认模型为 `gpt-5.5`。
- 当前网络直连中转站会返回 Cloudflare 403；通过 `IDEA_AI_PROXY_URL=http://127.0.0.1:7897` 可以真实请求成功。
- AI 能力统一封装在 `services/ideaApi.ts`；代理、网络或模型失败时，使用本地 fallback，保证产品可演示。
- 服务端支持 SSE 流式转发、10 分钟内存缓存、上下文压缩、提示词拼接和模型 JSON 结构校验。
- Playwright 使用系统 Chrome 跑桌面和移动端主流程，避免依赖浏览器下载。
- MVP 完成验收路径为：输入主题 -> 生成词 -> 锁词/重掷 -> 碰撞 -> 生成脑洞 -> 变形 -> 收藏 -> 刷新后仍在。
