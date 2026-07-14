# UI Convergence V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 收束脑洞实验室 UI，让主页面从功能堆叠变成“一个输入框 + 导图主舞台 + 脑洞卡 + 孵化箱抽屉”的阶段式创意流程。

**Architecture:** 保留现有 Zustand 状态和 AI 接口，不改后端协议。前端只重排信息架构：`App` 增加阶段条和高级折叠区，`MindMapCanvas` 强化主舞台，`IncubatorModal` 改为右侧灵感抽屉，E2E 锁定新主路径。

**Tech Stack:** Vite, React, TypeScript, Tailwind CSS, Zustand, Vitest, Playwright.

---

### Task 1: Lock New UI Contract With E2E

**Files:**
- Modify: `app/e2e/mvp-flow.spec.ts`

- [ ] **Step 1: Update expectations**

Require the initial screen to stay minimal, the generated screen to show a stage rail, and legacy word collision to be hidden behind `高级词组碰撞`.

- [ ] **Step 2: Verify red**

Run: `npm run e2e -- --project=chromium`
Expected: fail because stage rail and advanced disclosure do not exist yet.

### Task 2: Stage-Based Main Page

**Files:**
- Modify: `app/src/App.tsx`
- Modify: `app/src/components/workbench/TopicComposer.tsx`

- [ ] **Step 1: Add stage rail**

Derive stage state from `mindMap`, `ideas`, `favorites`, `loading`, and render `输入 / 发散 / 碰撞 / 脑洞 / 孵化`.

- [ ] **Step 2: Move legacy panels**

Remove direct `DimensionBoard` and `CollisionTray` rendering from the main flow and place them inside a collapsed advanced section that appears only when `groups.length > 0`.

### Task 3: Mind Map As Primary Workspace

**Files:**
- Modify: `app/src/components/workbench/MindMapCanvas.tsx`
- Modify: `app/src/index.css`

- [ ] **Step 1: Strengthen visual hierarchy**

Make the map container feel like the main workspace: larger surface, clearer selected-node tray, one dominant primary action, and quieter legend.

- [ ] **Step 2: Preserve node interactions**

Keep click, lock, reroll, continue expanding, and selected-node collision behavior unchanged.

### Task 4: Incubator Drawer

**Files:**
- Modify: `app/src/components/workbench/IncubatorModal.tsx`

- [ ] **Step 1: Change modal shell**

Use a right-side drawer on desktop and a full-width sheet on mobile while preserving `role="dialog"` and the existing filters, cards, details, and mix action.

- [ ] **Step 2: Simplify inner hierarchy**

Make filters compact, idea cards scannable, and detail panel feel like a current-item inspector instead of a two-column admin page.

### Task 5: Verification

**Files:**
- Test: `app/e2e/mvp-flow.spec.ts`
- Test: `app/src/store/ideaStore.test.ts`

- [ ] **Step 1: Run unit tests**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: TypeScript and Vite build succeed.

- [ ] **Step 3: Run E2E**

Run: `npm run e2e -- --project=chromium`
Expected: desktop flow passes.

Run: `npm run e2e -- --project=mobile`
Expected: mobile flow passes.
