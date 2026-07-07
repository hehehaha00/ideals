# 脑洞实验室

脑洞实验室是一个帮助用户从灵感枯竭重新进入发散状态的 AI 创意工作台。第一版支持输入主题、生成维度词、锁定和重掷词、碰撞脑洞、变形脑洞，以及本地收藏。

## 本地运行

```powershell
Set-Location .\app
npm install
npm run dev
```

打开终端显示的本地地址，通常是 `http://127.0.0.1:5173`。

## AI 配置

真实 AI 通过本地代理调用中转站，密钥不会进入浏览器打包结果。复制 `app/.env.example` 为 `app/.env.local` 后填写本地密钥即可。

```powershell
Set-Location .\app
Copy-Item .env.example .env.local
```

需要配置的变量：

- `IDEA_AI_BASE_URL`：中转站地址，默认 `https://sub2.congmingai.com`。
- `IDEA_AI_MODEL`：模型名，默认 `gpt-5.5`。
- `IDEA_AI_API_KEY`：中转站 key。
- `IDEA_AI_CACHE_TTL_MS`：AI 结果缓存时间，默认 10 分钟。

如果没有配置 key，产品会自动使用本地 fallback，仍然可以完整演示。

## 测试

```powershell
Set-Location .\app
npm test
npm run build
npm run e2e
```

## 技术架构

- Vite + React + TypeScript：负责前端应用。
- 本地 Node API 代理：负责中转站 key、流式请求、缓存、提示词拼接和 JSON 校验。
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
- 接入 OpenAI 兼容中转站，支持流式接收、服务端缓存、上下文压缩和失败 fallback。

## 后续阶段

- 第二阶段增加素材池、联想路径、角色圆桌、孵化箱混合和会话管理。
- 第三阶段增加账号、同步、模板库、分享和团队工作坊。

## 搜索记录

- 已在前期调研 GitHub 和 skills 项目，结论沉淀在 `PROJECT_VISION.md`、`TASKS.md` 和 `DESIGN.md`。
