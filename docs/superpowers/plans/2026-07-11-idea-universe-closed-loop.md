# 灵感宇宙闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户从画布碰撞出脑洞后，能够看见来源星座、精确返回原位置、继续发散或转成可执行计划，同时补齐画布编辑、导出、版本恢复和大规模性能。

**Architecture:** 在现有 Zustand 工作区上扩展持久化的数据契约：脑洞保存来源节点和镜头快照，导图保存分组、备注和显式版本，炼化结果可生成本地执行计划。页面通过一次性导航意图恢复画布，不让报告组件直接操纵视口；导出使用纯函数生成 JSON/Markdown，性能优化保持业务状态与渲染裁剪分离。

**Tech Stack:** React 18、TypeScript strict、Zustand、SVG、GSAP、Vitest、Playwright。

---

### Task 1: 来源快照与精确返回契约

**Files:**
- Modify: `app/src/types/idea.ts`
- Modify: `app/src/store/ideaStore.ts`
- Modify: `app/src/store/storage.ts`
- Test: `app/src/store/ideaStore.test.ts`
- Test: `app/src/store/storage.test.ts`

- [x] 先写失败测试：碰撞生成的每个脑洞保存 `mapId`、来源节点 ID、活动节点和镜头；恢复来源时重新选中这些节点并发布一次性导航意图。
- [x] 运行目标测试并确认因字段和动作不存在而失败。
- [x] 实现 `IdeaOriginSnapshot`、`MindMapNavigationIntent`、`generateIdeasFromMindMap(viewport?)` 和 `restoreIdeaOrigin()`；旧工作区缺少快照时保持兼容。
- [x] 验证目标测试通过，旧请求修订和 50 步撤销边界不回退。

### Task 2: 来源星座、精确返回和真实继续发散

**Files:**
- Create: `app/src/components/workbench/IdeaOriginConstellation.tsx`
- Modify: `app/src/App.tsx`
- Modify: `app/src/components/workbench/IdeaCardList.tsx`
- Modify: `app/src/components/workbench/IdeaCard.tsx`
- Modify: `app/src/components/workbench/MindMapCanvas.tsx`
- Test: `app/src/components/workbench/workbenchVisual.test.ts`

- [ ] 先写失败测试：报告显示来源星座；点击来源节点或返回按钮恢复来源镜头；继续发散切回导图并从来源活动节点发起 AI 扩展。
- [ ] 运行视觉测试确认失败。
- [ ] 实现可交互 SVG 来源星座和 App 回调链；Canvas 消费一次导航意图并恢复视口；继续发散先恢复来源，再调用现有扩展流程。
- [ ] 验证普通返回、来源节点返回和继续发散三条路径均通过。

### Task 3: 节点编辑、分组和上下文工具栏

**Files:**
- Modify: `app/src/types/idea.ts`
- Modify: `app/src/store/ideaStore.ts`
- Modify: `app/src/store/storage.ts`
- Create: `app/src/components/workbench/MindMapContextPanel.tsx`
- Create: `app/src/components/workbench/MindMapGroups.tsx`
- Modify: `app/src/components/workbench/MindMapCanvas.tsx`
- Test: `app/src/store/ideaStore.test.ts`
- Test: `app/src/components/workbench/workbenchVisual.test.ts`

- [ ] 先写失败测试：重命名、备注、修改父节点、删除整个子树、把多选节点加入命名分组，以及撤销恢复。
- [ ] 实现 `MindNode.note`、`MindNode.groupId`、`MindNodeGroup` 和对应 store 动作；删除必须二次确认，中心节点不可删除或改父节点。
- [ ] 选择一个节点时显示上下文面板；多选时在现有底部工具栏提供“建立分组”；画布绘制轻量分组范围但不新增卡片容器。
- [ ] 验证编辑会持久化、可撤销，并使进行中的旧 AI 请求失效。

### Task 4: 决策报告与真实执行计划

**Files:**
- Modify: `app/src/types/idea.ts`
- Modify: `app/src/store/ideaStore.ts`
- Modify: `app/src/store/storage.ts`
- Create: `app/src/components/workbench/IdeaDecisionBrief.tsx`
- Create: `app/src/components/workbench/IdeaExecutionPlan.tsx`
- Modify: `app/src/components/workbench/IdeaCard.tsx`
- Modify: `app/src/components/workbench/IdeaRefinery.tsx`
- Test: `app/src/store/ideaStore.test.ts`
- Test: `app/src/components/workbench/workbenchVisual.test.ts`

- [ ] 先写失败测试：炼化后的首屏展示目标用户、核心价值、最大未知和第一项实验；“收束推进”创建可勾选的执行计划，而不是只记录文案。
- [ ] 使用现有炼化数据生成稳定的 `IdeaExecutionPlan`：1 小时、1 天、1 周任务、验证标准、完成状态和更新时间。
- [ ] 报告详情使用渐进展开，固定操作栏只保留一个主操作；任务勾选实时持久化。
- [ ] 验证刷新后执行计划和完成状态仍存在。

### Task 5: 导出、版本历史与规模性能

**Files:**
- Create: `app/src/lib/workspaceExport.ts`
- Test: `app/src/lib/workspaceExport.test.ts`
- Create: `app/src/components/workbench/MindMapVersionPanel.tsx`
- Modify: `app/src/types/idea.ts`
- Modify: `app/src/store/ideaStore.ts`
- Modify: `app/src/store/storage.ts`
- Modify: `app/src/components/workbench/MindMapCanvas.tsx`
- Modify: `app/src/components/workbench/MindMapNode.tsx`
- Modify: `app/src/components/workbench/MindMapEdges.tsx`
- Modify: `app/src/components/workbench/mindMapGeometry.ts`
- Test: `app/src/components/workbench/mindMapGeometry.test.ts`
- Test: `app/src/components/workbench/workbenchVisual.test.ts`

- [x] 先写失败测试并实现导出导图 JSON 与导出报告 Markdown；版本和大图裁剪测试留在本任务后续。
- [ ] 实现纯导出函数和浏览器下载入口；版本快照保存完整 map 和活动节点，恢复会建立撤销边界。
- [ ] 静态节点和连线使用 memo；拖动画布时通过稳定 viewport ref 避免所有节点重渲染；大图才启用带缓冲区的视口裁剪。
- [ ] 运行 200、500、1000 节点几何测试，确认中心附近和来源活动节点不会被误裁掉。

### Task 6: 视觉 token、集成和全量验收

**Files:**
- Modify: `app/src/index.css`
- Modify: `app/src/**/*.tsx`
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`
- Modify: `CONTEXT.md`
- Modify: `app/e2e/mvp-flow.spec.ts`

- [ ] 建立 `cosmic` 文字强弱 token，替换所有不会由 Tailwind 生成的 `text-white/36`、`/42`、`/56`、`/68` 等类，并添加静态回归扫描。
- [ ] 合并上下文工具，只在选中时展示编辑动作；保持顶部为历史和视图工具，底部为发散和碰撞主流程。
- [ ] 更新 E2E：碰撞保存来源、报告返回来源、继续发散、节点编辑、执行计划、导出和版本恢复。
- [ ] 运行全量 Vitest、TypeScript/Vite 构建、Chromium E2E、`git diff --check`，再用 1280×720 和 1440×900 做真实页面验收。
