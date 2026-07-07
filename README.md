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
