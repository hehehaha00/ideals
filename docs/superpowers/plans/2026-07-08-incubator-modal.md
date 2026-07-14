# Incubator Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the lightweight favorites list into a modal incubator that stores ideas, filters them by status, shows details, and mixes 2-3 selected ideas back into the main divergent workflow.

**Architecture:** Keep the main workspace single-column and move saved ideas into an overlay modal. Reuse existing `favorites` as the incubator storage for V1, add UI-only selection/filter/detail state to the store, and add a real AI `/api/idea/mix` route that returns a mixed topic. No mock fallback: if the LLM fails, the UI shows the existing `LLM 有问题：...` error.

**Tech Stack:** Vite, React, TypeScript, Tailwind CSS, Zustand, Node HTTP AI proxy, SSE, Vitest, Playwright.

---

## File Structure

- Modify `app/src/types/idea.ts`: add incubator filter/action types and `MixedIdeaSeed`.
- Modify `app/server/promptBuilder.ts`: add `buildMixIdeasPrompt()`.
- Modify `app/server/modelOutput.ts`: add `normalizeMixedIdeaSeed()`.
- Modify `app/server/index.ts`: add `/api/idea/mix`.
- Modify `app/src/services/ideaApi.ts`: add `mixIdeas()`.
- Modify `app/src/store/ideaStore.ts`: add modal open/filter/detail/selection state and `mixSelectedIncubatorIdeas()`.
- Create `app/src/components/workbench/IncubatorModal.tsx`: render modal, filters, idea grid, detail panel, selected mixing bar.
- Modify `app/src/App.tsx`: replace inline favorites list with modal trigger and mounted modal.
- Modify `app/src/components/workbench/IdeaCard.tsx`: rename the bottom save action to incubator language while preserving toggle behavior.
- Update tests in `app/server/promptBuilder.test.ts`, `app/server/modelOutput.test.ts`, `app/src/services/ideaApi.test.ts`, `app/src/store/ideaStore.test.ts`, and `app/e2e/mvp-flow.spec.ts`.
- Update `CONTEXT.md`, `ARCHITECTURE.md`, `DESIGN.md`, and `TASKS.md`.

## Visual Thesis

A warm paper lightbox for living ideas: the modal should feel like opening a tray of preserved sparks, with dense but calm cards, colored status tags, and one clear orange mixing action.

## Content Plan

1. Header: "孵化箱" plus saved count and close action.
2. Filter row: all, unrefined, refined, actionable, mix-ready, today, this week.
3. Idea grid: compact cards with title, summary, source path, status tags, saved time, and selection state.
4. Detail column: selected idea's source path, refinement summary when available, and actions.
5. Bottom bar: appears when 2-3 ideas are selected and triggers mixing.

## Interaction Thesis

- The modal opens over the current workbench so users feel they are temporarily retrieving old thoughts.
- Selecting cards creates a small "A + B -> ?" composition bar rather than a separate workflow.
- Mixing closes the modal, fills the main topic with the AI-generated mixed topic, and automatically starts a new mind map.

---

### Task 1: Add Mix Contract

**Files:**
- Modify: `app/src/types/idea.ts`
- Modify: `app/server/modelOutput.ts`
- Modify: `app/server/promptBuilder.ts`
- Test: `app/server/modelOutput.test.ts`
- Test: `app/server/promptBuilder.test.ts`

- [ ] Write failing tests for `buildMixIdeasPrompt()` and `normalizeMixedIdeaSeed()`.
- [ ] Run `npm test -- server/promptBuilder.test.ts server/modelOutput.test.ts`; expect missing export failures.
- [ ] Add `MixedIdeaSeed` and implement the prompt and normalizer.
- [ ] Run the same tests and confirm they pass.

### Task 2: Add API And Store

**Files:**
- Modify: `app/server/index.ts`
- Modify: `app/src/services/ideaApi.ts`
- Modify: `app/src/store/ideaStore.ts`
- Test: `app/src/services/ideaApi.test.ts`
- Test: `app/src/store/ideaStore.test.ts`

- [ ] Write failing tests for streaming `mixIdeas()` and store `mixSelectedIncubatorIdeas()`.
- [ ] Run `npm test -- src/services/ideaApi.test.ts src/store/ideaStore.test.ts`; expect missing function/action failures.
- [ ] Add `/api/idea/mix`, service call, store modal state, selection guards, and mix action.
- [ ] Run the same tests and confirm they pass.

### Task 3: Build Incubator Modal UI

**Files:**
- Create: `app/src/components/workbench/IncubatorModal.tsx`
- Modify: `app/src/App.tsx`
- Modify: `app/src/components/workbench/IdeaCard.tsx`
- Test: `app/e2e/mvp-flow.spec.ts`

- [ ] Add failing E2E assertions for opening "孵化箱", filtering, selecting 2 ideas, and clicking "混合一下".
- [ ] Create modal with header, filters, grid, detail panel, empty state, selected bottom bar, and responsive layout.
- [ ] Replace inline favorites list with modal trigger.
- [ ] Run desktop and mobile E2E.

### Task 4: Docs And Verification

**Files:**
- Modify: `CONTEXT.md`
- Modify: `ARCHITECTURE.md`
- Modify: `DESIGN.md`
- Modify: `TASKS.md`

- [ ] Document incubator modal V1 and `/api/idea/mix`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run desktop and mobile Playwright flows.

## Self-Review

- Spec coverage: covers modal, filters, details, multi-select, AI mix route, no-fallback behavior, docs, and verification.
- Placeholder scan: no TODO/TBD placeholders.
- Type consistency: uses `MixedIdeaSeed`, `mixIdeas`, `mixSelectedIncubatorIdeas`, and incubator selection naming consistently.
