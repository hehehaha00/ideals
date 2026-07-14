# Discussion Branch And Intervention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement this plan task-by-task. All production changes follow RED-GREEN-REFACTOR.

**Goal:** 让用户把圆桌讨论方向生成新的画布分支，并通过有限追问、反对或补充参与角色讨论。

**Architecture:** 在现有 `IdeaDiscussion` 上增加持久化介入记录，并新增两个统一 SSE 接口：一个返回有限角色回应，一个返回标准导图扩展。Store 复用现有请求修订号、历史和持久化边界；报告面板负责有限介入表单和方向继续按钮，App 在分支成功后切回画布。

**Tech Stack:** React + TypeScript + Zustand + Node HTTP SSE + Vitest + Playwright + Tailwind + GSAP。

---

### Task 1: 数据契约与旧数据兼容

**Files:**
- Modify: `app/src/types/idea.ts`
- Modify: `app/src/store/storage.ts`
- Test: `app/src/store/storage.test.ts`

- [ ] 先写失败测试：旧讨论补空 `interventions`，合法介入和节点 `discussionOrigin` 可恢复，未知动作/角色、超过两条回应、错误来源或第四次介入被过滤。
- [ ] 运行 `npm test -- --run src/store/storage.test.ts`，确认因字段和解析缺失失败。
- [ ] 定义方向 key、三种介入类型、介入记录和节点来源；storage 对每条介入严格收窄，每场最多三条，旧 V2 自动补空数组。
- [ ] 再运行 storage 测试和 `npx tsc --noEmit`，确认通过。

### Task 2: 介入与分支 API

**Files:**
- Modify: `app/src/services/ideaApi.ts`
- Modify: `app/server/promptBuilder.ts`
- Modify: `app/server/modelOutput.ts`
- Modify: `app/server/index.ts`
- Test: `app/src/services/ideaApi.test.ts`
- Test: `app/server/promptBuilder.test.ts`
- Test: `app/server/modelOutput.test.ts`

- [ ] 先写失败测试：介入 prompt 包含用户动作、来源观点和目标角色；分支 prompt 包含方向与当前导图；归一化拒绝非法角色、重复回应、空文本、少于 4 或多于 6 个节点。
- [ ] 运行三组定向测试确认 RED。
- [ ] 新增 `respondToDiscussion` 和 `branchFromDiscussion` service；新增 `/discussion/respond` 与 `/discussion/branch` 路由，复用 `handleAiOperation`。
- [ ] 介入结果归一化为 1-2 条合法回应；分支复用 `normalizeMindMapExpansion` 并给节点写入 `discussionOrigin`。
- [ ] 运行定向测试、TypeScript 和 build。

### Task 3: Store 请求、持久化与分支合并

**Files:**
- Modify: `app/src/store/ideaStore.ts`
- Test: `app/src/store/ideaStore.test.ts`

- [ ] 先写失败测试：介入成功追加且最多三次；失败保留旧记录；停止/切换脑洞使旧响应失效；方向分支同时校验 idea/map revision；失败不改图；成功写入历史并合并 4-6 个节点。
- [ ] 运行 Store 测试确认 RED。
- [ ] 新增 `respondToDiscussion`、`continueDiscussionDirection` 和 loading `discussionResponse | discussionBranch`；持久化介入，合并分支并发布导航意图。
- [ ] 分支成功返回布尔结果，供 App 决定是否切回画布；重复提交由 loading 锁阻止。
- [ ] 运行 Store、storage、motion 测试和 TypeScript。

### Task 4: 报告介入 UI 与方向继续

**Files:**
- Modify: `app/src/components/workbench/IdeaDiscussionPanel.tsx`
- Modify: `app/src/components/workbench/IdeaCard.tsx`
- Modify: `app/src/components/workbench/IdeaCardList.tsx`
- Modify: `app/src/App.tsx`
- Modify: `app/src/components/workbench/useMindMapMotion.ts`
- Test: `app/src/components/workbench/ideaDiscussionPanel.test.tsx`
- Test: `app/src/components/workbench/workbenchVisual.test.ts`
- Test: `app/src/components/workbench/useMindMapMotion.test.tsx`

- [ ] 先写失败测试：方向选择后出现继续按钮；介入表单支持追问/不同意/补充、目标角色和 180 字限制；观点旁入口带入上下文；三次后关闭；loading 时全部锁定。
- [ ] 运行组件测试确认 RED。
- [ ] 实现连续批注式介入记录、轻量表单和“沿这个方向继续”；不新增聊天气泡或嵌套卡片。
- [ ] App 在分支成功后进入 map，导航意图聚焦新分支；motion 将 `discussionBranch` 当作扩展爆发，将 `discussionResponse` 当作非导图操作。
- [ ] 运行 UI、motion、TypeScript 和 build。

### Task 5: E2E、文档和全量验证

**Files:**
- Modify: `app/e2e/mvp-flow.spec.ts`
- Modify: `CONTEXT.md`
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`

- [ ] 新增 Chromium 流程：生成讨论 → 追问角色 → 刷新保留回应 → 选择方向 → 生成分支 → 返回画布看到节点与来源 → 撤销分支。
- [ ] 快速路径继续断言默认画布没有介入或方向入口。
- [ ] 更新产品功能、模块职责、API 和数据流记录。
- [ ] 运行 `npm test -- --run`、`npm run build`、Chromium E2E 和 `git diff --check`，全部为零失败。
