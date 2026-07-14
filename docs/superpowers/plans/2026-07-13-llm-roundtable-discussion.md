# LLM 编辑部圆桌讨论 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在脑洞报告中增加一个三轮、多角色、可采集火花的 LLM 编辑部圆桌讨论，并将采集结果回写到思维导图。

**Architecture:** 新增独立 `IdeaDiscussion` 数据契约和 `/api/idea/discussion` SSE 路由，单次模型调用返回完整三轮讨论。Store 使用现有请求编号、修订号和本地 V2 存储模式管理讨论；报告页新增按需讨论面板，默认画布不增加入口。讨论输出以结构化轮次保存，用户主动采集火花时再调用现有画布节点新增能力。

**Tech Stack:** React + TypeScript + Zustand + Vitest + Playwright + Node HTTP SSE + Tailwind。

---

### Task 1: 讨论数据契约与安全恢复

**Files:**
- Modify: `app/src/types/idea.ts`
- Modify: `app/src/store/storage.ts`
- Test: `app/src/store/storage.test.ts`

- [ ] **Step 1: 写失败测试**

为 `WorkspaceSnapshot` 增加讨论字段的恢复测试：合法讨论完整保留；未知角色、未知轮次、空观点和错误 `ideaId` 被过滤；旧 V2 工作区恢复为空对象。

- [ ] **Step 2: 运行测试确认失败**

运行 `npm test -- --run src/store/storage.test.ts`，预期因缺少 `IdeaDiscussion` 类型和恢复字段而失败。

- [ ] **Step 3: 实现最小契约**

在 `idea.ts` 中定义四个固定角色、三种讨论状态、贡献、轮次、收束方向和 `IdeaDiscussion`；在 `WorkspaceSnapshot` 添加 `discussionsByIdeaId`。在 storage 恢复函数中对讨论对象逐字段收窄，异常条目跳过，缺字段默认为空对象。

- [ ] **Step 4: 运行定向测试**

运行 `npm test -- --run src/store/storage.test.ts`，预期新增测试和原有测试全部通过。

### Task 2: 讨论提示词、响应归一化与 SSE 路由

**Files:**
- Modify: `app/src/services/ideaApi.ts`
- Modify: `app/server/promptBuilder.ts`
- Modify: `app/server/modelOutput.ts`
- Modify: `app/server/index.ts`
- Test: `app/src/services/ideaApi.test.ts`
- Test: `app/server/promptBuilder.test.ts`
- Test: `app/server/modelOutput.test.ts`

- [ ] **Step 1: 写失败测试**

测试讨论请求包含脑洞快照和固定角色；提示词要求三轮、短观点和火花；归一化函数拒绝未知角色、空 claim、同一贡献中不是单一对象的 spark、不完整 synthesis，以及第一轮没有完整覆盖四个固定角色；路由对非法 payload 返回 400。

- [ ] **Step 2: 运行测试确认失败**

运行 `npm test -- --run src/services/ideaApi.test.ts server/promptBuilder.test.ts server/modelOutput.test.ts`，预期因缺少 discussion 路由和归一化函数而失败。

- [ ] **Step 3: 实现最小 API**

新增 `DiscussionIdeaRequest` 和 `requestDiscussion`；服务端新增 `buildDiscussionPrompt`、`normalizeIdeaDiscussion` 和 `/api/idea/discussion`。路由统一使用现有 `handleAiOperation`，SSE 仍保持现有错误、截止时间和来源策略。

- [ ] **Step 4: 运行服务端与 API 测试**

运行上述三个测试文件，确认提示词、归一化和请求路径全部通过。

### Task 3: Store 讨论状态、过时保护和采集火花

**Files:**
- Modify: `app/src/store/ideaStore.ts`
- Modify: `app/src/store/storage.ts`
- Modify: `app/src/types/idea.ts`
- Test: `app/src/store/ideaStore.test.ts`

- [ ] **Step 1: 写失败测试**

覆盖：开始讨论进入 `discussion` loading；成功后只写入当前 idea 的讨论；旧请求返回不能覆盖当前 idea；失败保留旧讨论；取消后恢复 idle；采集火花只新增一次节点并持久化 `collectedSparkIds`。

- [ ] **Step 2: 运行测试确认失败**

运行 `npm test -- --run src/store/ideaStore.test.ts`，预期因缺少状态字段和 action 而失败。

- [ ] **Step 3: 实现 Store**

新增 `discussionsByIdeaId`、`discussionIdea`、`collectDiscussionSpark` 和对应 loading 类型。讨论请求沿用现有 request id / revision 校验；采集动作复用现有 `addMindMapNode` 的历史和持久化边界，不在 AI loading 时执行。

- [ ] **Step 4: 运行 Store 测试**

运行 `npm test -- --run src/store/ideaStore.test.ts src/store/storage.test.ts`，预期全部通过。

### Task 4: 编辑部圆桌讨论面板

**Files:**
- Create: `app/src/components/workbench/IdeaDiscussionPanel.tsx`
- Modify: `app/src/components/workbench/IdeaCard.tsx`
- Modify: `app/src/components/workbench/workbenchVisual.test.ts`
- Test: `app/src/components/workbench/ideaDiscussionPanel.test.tsx`

- [ ] **Step 1: 写失败测试**

测试默认关键词画布没有讨论入口；报告点击“召集讨论”才显示面板；轮次和观点按编辑部批注展示；火花有采集按钮；AI 工作期间按钮锁定；失败/取消保留已显示内容。

- [ ] **Step 2: 运行组件测试确认失败**

运行 `npm test -- --run src/components/workbench/ideaDiscussionPanel.test.tsx src/components/workbench/workbenchVisual.test.ts`，预期因缺少组件和入口而失败。

- [ ] **Step 3: 实现面板**

面板只通过 props 接收讨论、loading、错误和回调；使用三轮标题、角色标签、短观点、冲突和采集按钮；收束方向显示为三个可选方向，不自动执行深入验证。报告的“召集讨论”作为挑战区域后的次级入口，`loading !== idle` 时关闭并锁定。

- [ ] **Step 4: 运行组件测试**

运行定向组件测试，预期全部通过，并确认没有卡片套卡片或默认路径噪音。

### Task 5: 持久化、桌面 E2E 与项目记录

**Files:**
- Modify: `app/e2e/mvp-flow.spec.ts`
- Modify: `CONTEXT.md`
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`

- [ ] **Step 1: 写 E2E 失败用例**

增加深入路径：报告点击“召集讨论” -> 等待三轮观点 -> 采集火花 -> 断言画布出现新节点 -> 刷新后讨论和采集状态仍在；快速关键词路径继续断言没有讨论入口。

- [ ] **Step 2: 运行 E2E 确认失败**

运行 `npx playwright test e2e/mvp-flow.spec.ts --project=chromium`，预期新流程因 UI 和 API 未实现而失败。

- [ ] **Step 3: 补齐文档和兼容说明**

在三份项目文档中记录讨论入口、数据流、持久化字段和默认路径不变的决定；只更新当前功能相关段落。

- [ ] **Step 4: 全量验证**

运行：

```powershell
npm test -- --run
npm run build
npx playwright test e2e/mvp-flow.spec.ts --project=chromium
git diff --check
```

预期 0 个测试失败、构建成功、Chromium 快速/深入流程通过、无空白错误。
