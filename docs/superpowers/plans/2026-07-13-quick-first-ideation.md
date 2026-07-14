# 轻量发散与按需深入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户输入一句话后直接获得可自由思考的关键词画布，并只在主动选择时进入碰撞配方、来源谱系和反共识挑战。

**Architecture:** 保留现有全屏导图作为默认体验，不增加会话创建步骤。碰撞配方作为脑洞生成请求的可选参数并写入来源快照；反共识挑战使用独立 AI 路由和持久化结果，只在脑洞报告中按需打开。渐进式 UI 负责隐藏深度能力，但不删除现有编辑、执行计划和来源返回能力。

**Tech Stack:** React 18、TypeScript strict、Zustand、Vite、Node HTTP 代理、SSE、Vitest、Playwright。

---

### Task 1: 碰撞配方数据契约与 AI 生成

**Files:**
- Modify: `app/src/types/idea.ts`
- Modify: `app/src/services/ideaApi.ts`
- Modify: `app/src/services/ideaApi.test.ts`
- Modify: `app/src/store/ideaStore.ts`
- Modify: `app/src/store/ideaStore.test.ts`
- Modify: `app/src/store/storage.ts`
- Modify: `app/src/store/storage.test.ts`
- Modify: `app/server/index.ts`
- Modify: `app/server/promptBuilder.ts`
- Modify: `app/server/promptBuilder.test.ts`

- [x] 先写失败测试：`generateIdeasFromMindMap(viewport, recipe?)` 将可选配方传给 `/ideas`，每个结果的来源快照保存配方，刷新后仍可恢复。
- [x] 定义六种配方：随机碰撞、换个人群、放大情绪、加一个限制、借用结构、反过来做；请求缺省时保持现有生成行为。
- [x] 服务端 `buildIdeasPrompt()` 只在有配方时追加明确思维动作，不改变 JSON 输出结构。
- [x] 严格解析持久化配方；未知值丢弃而不是破坏整个脑洞。
- [x] 运行定向测试与生产构建，115 项配方核心测试通过。

### Task 2: 反共识挑战数据、接口与持久化

**Files:**
- Modify: `app/src/types/idea.ts`
- Modify: `app/src/services/ideaApi.ts`
- Modify: `app/src/services/ideaApi.test.ts`
- Modify: `app/src/store/ideaStore.ts`
- Modify: `app/src/store/ideaStore.test.ts`
- Modify: `app/src/store/storage.ts`
- Modify: `app/src/store/storage.test.ts`
- Modify: `app/server/index.ts`
- Modify: `app/server/promptBuilder.ts`
- Modify: `app/server/promptBuilder.test.ts`
- Modify: `app/server/modelOutput.ts`
- Modify: `app/server/modelOutput.test.ts`

- [x] 先写失败测试：用户选择挑战角色后，接口返回“一句质疑、被忽略风险、新方向”，结果按脑洞和角色持久化。
- [x] 定义五种角色：懒人用户、毒舌用户、极端用户、工程师、反常识派；同角色可重新挑战并用最新结果替换。
- [x] 新增 `/api/idea/challenge` SSE 路由、提示词和严格输出归一化；缺字段返回明确错误，不伪造结果。
- [x] Store 新增 `challengeIdea(ideaId, role)`、`challengesByIdeaId` 和 `loading: "challenge"`，沿用请求编号与修订号防止旧结果覆盖。
- [x] 运行服务、状态、存储定向测试，旧工作区兼容空挑战集合。

### Task 3: 碰撞配方渐进式入口

**Files:**
- Create: `app/src/components/workbench/CollisionRecipePicker.tsx`
- Modify: `app/src/components/workbench/MindMapCanvas.tsx`
- Modify: `app/src/components/workbench/workbenchVisual.test.ts`

- [x] 先写失败测试：用户只浏览关键词时不出现配方面板；选中至少三个节点并点击“用这些词碰撞”后才出现配方。
- [x] 配方选择器默认突出“随机碰撞”，其他五项使用短名称和一句动作说明；Esc、取消和选择后关闭。
- [x] 选择配方后调用 `generateIdeasFromMindMap(viewport, recipe)`；AI 与动画期间选择器和画布都不可操作。
- [x] 底部默认只突出“继续发散”和“用这些词碰撞”，分组与批量编辑仍只在多选后出现。
- [x] 运行视觉/几何测试并验证拖动、来源恢复、大图裁剪没有回归。

### Task 4: 报告中的按需反共识挑战

**Files:**
- Create: `app/src/components/workbench/IdeaChallengePanel.tsx`
- Create: `app/src/components/workbench/ideaChallengePanel.test.tsx`
- Modify: `app/src/components/workbench/IdeaCard.tsx`
- Modify: `app/src/components/workbench/IdeaRefinery.tsx`
- Modify: `app/src/components/workbench/workbenchVisual.test.ts`

- [x] 先写失败测试：未操作时报告只展示基本脑洞与来源；点击“换个立场”才出现角色选择。
- [x] 挑战结果使用连续的编辑部批注版式展示质疑、风险和新方向，不使用三张嵌套卡片。
- [x] “深入验证”替代“生成完整报告”；反共识挑战和深入验证都是次级入口，未炼化时只保留一个明确主操作。
- [x] 挑战期间锁定当前报告操作，失败保留原报告并显示现有错误提示。
- [x] 运行组件、视觉和 Store 定向测试，验证刷新后挑战仍存在。

### Task 5: 快速路径与完整路径验收

**Files:**
- Modify: `app/e2e/mvp-flow.spec.ts`
- Modify: `app/src/index.css`
- Modify: `CONTEXT.md`
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`

- [x] 增加快速路径 E2E：主页输入一句话后直接进入关键词画布，用户无需碰撞即可拖动、扩展或离开。
- [x] 增加深入路径 E2E：选择节点、选择配方、生成脑洞、打开谱系、发起挑战、深入验证、收束推进。
- [x] 清理新增 UI 中不受支持的透明度类，沿用现有 cosmic 视觉 token，不新增大面积说明和卡片。
- [x] 运行全量 Vitest（18 文件/309 项）、`npm run build`、`git diff --check`。
- [x] 在 Chromium 桌面配置完成快速路径和深入路径验收；手机端仍不作为本轮范围。
