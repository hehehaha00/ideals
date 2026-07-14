# 有秩序的灵感宇宙画布 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把无限思维导图升级为可导航、可整理、可恢复的灵感宇宙主画布。

**Architecture:** 保留现有百分比世界坐标和 SVG 连线，在 `MindMapCanvas` 外增加视口、框选和固定 HUD；把节点编辑、折叠、批量动作和有限历史放入 Zustand。新增的微缩星图、搜索栏和新增节点表单都是画布内的独立组件，通过明确回调连接页面状态。

**Tech Stack:** React 18、TypeScript strict、Zustand、SVG、Pointer Events、GSAP、Vitest、Playwright。

**Status:** 已于 2026-07-11 完成实现和桌面验收。

---

### Task 1: 扩展节点模型与几何工具

**Files:**
- Modify: `app/src/types/idea.ts`
- Modify: `app/src/components/workbench/mindMapGeometry.ts`
- Test: `app/src/components/workbench/mindMapGeometry.test.ts`

- [x] **Step 1: 写失败测试**：覆盖世界坐标与视口坐标互换、框选矩形命中和折叠节点默认值。
- [x] **Step 2: 运行几何测试确认失败**：`npm test -- src/components/workbench/mindMapGeometry.test.ts --run`。
- [x] **Step 3: 实现**：为 `MindNode` 增加可选 `collapsed`，增加 `screenToWorldPercent`、`worldPercentToScreen` 和 `nodesInSelectionRect`，保持现有安全区拖动行为兼容。
- [x] **Step 4: 运行测试确认通过**。

### Task 2: 画布工作区状态、历史与本地节点

**Files:**
- Modify: `app/src/store/ideaStore.ts`
- Modify: `app/src/store/storage.ts`
- Modify: `app/src/types/idea.ts`
- Test: `app/src/store/ideaStore.test.ts`, `app/src/store/storage.test.ts`

- [x] **Step 1: 写失败测试**：验证新增节点、切换折叠、批量锁定/解锁、清除选择、撤销和重做。
- [x] **Step 2: 运行目标测试确认失败**：`npm test -- src/store/ideaStore.test.ts src/store/storage.test.ts --run`。
- [x] **Step 3: 实现**：添加 `addMindNode`、`toggleMindNodeCollapsed`、`setMindNodesSelected`、`setMindNodesLocked`、`undoMindMap`、`redoMindMap`；历史只保存最近 50 个本地编辑快照，AI 请求成功后清空重做栈并建立边界。
- [x] **Step 4: 运行目标测试确认通过**。

### Task 3: 视口 HUD 与微缩星图

**Files:**
- Create: `app/src/components/workbench/MindMapMinimap.tsx`
- Modify: `app/src/components/workbench/MindMapCanvas.tsx`
- Modify: `app/src/index.css`
- Test: `app/src/components/workbench/workbenchVisual.test.ts`

- [x] **Step 1: 写失败测试**：验证微缩星图、视口矩形、缩放比例、回中和适应全部节点控件存在且 AI 工作时禁用。
- [x] **Step 2: 运行测试确认失败**。
- [x] **Step 3: 实现**：把视口状态集中在画布，微缩星图使用 SVG 绘制节点密度和可点击视口；点击微缩星图移动视口，不改变世界数据。
- [x] **Step 3a: 实现缩放层级**：`scale < 0.55` 只显示星点，`0.55 <= scale <= 1.55` 显示关键词，`scale > 1.55` 显示来源和折叠入口；三档均保留可访问标签。
- [x] **Step 4: 运行测试确认通过**。

### Task 4: 框选、多选与批量工具条

**Files:**
- Create: `app/src/components/workbench/MindMapSelectionToolbar.tsx`
- Modify: `app/src/components/workbench/MindMapCanvas.tsx`
- Modify: `app/src/components/workbench/MindMapNode.tsx`
- Test: `app/src/components/workbench/workbenchVisual.test.ts`

- [x] **Step 1: 写失败测试**：验证空白拖拽产生选择框、Shift 追加选择、批量锁定和清除选择。
- [x] **Step 2: 运行测试确认失败**。
- [x] **Step 3: 实现**：在世界层上绘制选择矩形，把屏幕坐标换算为世界坐标；节点按钮保留独立拖动和点击，选择工具条固定在底部上方。
- [x] **Step 4: 运行测试确认通过**。

### Task 5: 手动新增节点、搜索、聚焦和折叠

**Files:**
- Create: `app/src/components/workbench/MindMapNodeComposer.tsx`
- Create: `app/src/components/workbench/MindMapSearch.tsx`
- Modify: `app/src/components/workbench/MindMapCanvas.tsx`
- Modify: `app/src/components/workbench/MindMapEdges.tsx`
- Test: `app/src/components/workbench/workbenchVisual.test.ts`

- [x] **Step 1: 写失败测试**：验证双击空白打开表单、空名称拒绝提交、搜索命中后显示信标、折叠后隐藏子节点但保留数量。
- [x] **Step 2: 运行测试确认失败**。
- [x] **Step 3: 实现**：新增节点连接活动节点或中心；搜索使用本地过滤并平滑更新视口；折叠在渲染层过滤后代节点，边同步过滤。
- [x] **Step 4: 运行测试确认通过**。

### Task 6: 新生节点和局部聚焦视觉

**Files:**
- Modify: `app/src/components/workbench/useMindMapMotion.ts`
- Modify: `app/src/components/workbench/MindMapNode.tsx`
- Modify: `app/src/components/workbench/MindMapEdges.tsx`
- Modify: `app/src/index.css`
- Test: `app/src/components/workbench/useMindMapMotion.test.tsx`, `app/src/components/workbench/workbenchVisual.test.ts`

- [x] **Step 1: 写失败测试**：验证新节点获得短暂标记、聚焦节点路径增强、减少动态效果时不影响可读状态。
- [x] **Step 2: 运行测试确认失败**。
- [x] **Step 3: 实现**：根据新增节点 ID 建立动画目标集合，增加能量尾迹和信标 class；局部聚焦只调整 opacity 和路径权重。
- [x] **Step 4: 运行测试确认通过**。

### Task 7: 全量验证和文档

**Files:**
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`
- Modify: `CONTEXT.md`
- Modify: `app/e2e/mvp-flow.spec.ts`

- [x] **Step 1: 更新桌面 E2E**：覆盖微缩星图、搜索、折叠和撤销重做的核心路径。
- [x] **Step 2: 运行 `npm test -- --reporter=dot`、`npm run build`、`npx playwright test --project=chromium --reporter=line --output=temp-report` 和 `git diff --check`。
- [x] **Step 3: 用 1280x720 和 1440x900 浏览器检查无溢出、固定 HUD、视口矩形和节点可读性。
- [x] **Step 4: 记录完成状态和剩余风险**：不引入移动端专项范围。
