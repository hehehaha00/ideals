# Idea Refinery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an AI-driven refinement flow that turns a selected idea card into vitality analysis, human-perspective roundtable feedback, three landing directions, an MVP ladder, and next actions.

**Architecture:** Keep refinement inside the existing single-column idea card flow. The frontend calls a new `/api/idea/refine` streaming endpoint through the same SSE client, stores one refinement per idea, and renders a compact "炼化" panel under the active card. AI failures are surfaced as user-visible errors; local mock or fallback generation is removed from the frontend API layer.

**Tech Stack:** Vite, React, TypeScript, Tailwind CSS, Zustand, Node HTTP AI proxy, SSE, Vitest, Playwright.

---

## File Structure

- Modify `app/src/types/idea.ts`: add `IdeaRefinement`, `RefinementRoleFeedback`, `RefinementDirection`, `RefinementMvpStep`, and `RefinementAction`.
- Modify `app/src/services/ideaApi.ts`: remove fallback catches and add `refineIdea()`.
- Modify `app/server/promptBuilder.ts`: add `buildRefinePrompt()`.
- Modify `app/server/modelOutput.ts`: add `normalizeIdeaRefinement()`.
- Modify `app/server/index.ts`: add `/api/idea/refine` route.
- Modify `app/src/store/ideaStore.ts`: add `refinementsByIdeaId`, `refineActiveIdea()`, and `chooseRefinementAction()`.
- Create `app/src/components/workbench/IdeaRefinery.tsx`: render the AI炼化 result inside the active idea card.
- Modify `app/src/components/workbench/IdeaCard.tsx`: add the refine CTA and embedded panel.
- Modify tests in `app/src/services/ideaApi.test.ts`, `app/src/store/ideaStore.test.ts`, `app/server/promptBuilder.test.ts`, and `app/server/modelOutput.test.ts`.
- Update `CONTEXT.md`, `ARCHITECTURE.md`, `DESIGN.md`, and `TASKS.md`.

## Visual Thesis

Warm paper workspace plus bright cognitive tags: refinement should feel like a small internal workshop where different human voices challenge an idea, not like a business dashboard.

## Content Plan

1. Active card shows a primary "炼化这个脑洞" action.
2. Streaming state says the AI is reading the idea, not inventing fake content.
3. Result appears as five scan-friendly bands: vitality, roundtable, directions, MVP ladder, next actions.
4. Errors appear inline and explain that the LLM connection or output failed.

## Interaction Thesis

- Refinement expands in place below the selected card with a soft entrance.
- Role feedback uses colored labels so users can scan emotional, product, engineering, and business perspectives.
- The three final actions are explicit: continue divergence, narrow into execution, or save to incubator.

---

### Task 1: Lock No-Fallback API Behavior

**Files:**
- Modify: `app/src/services/ideaApi.ts`
- Test: `app/src/services/ideaApi.test.ts`

- [ ] Replace fallback tests with failing tests that expect `generateWords`, `generateMindMap`, `generateIdeas`, and `transformIdea` to reject when `fetch` fails.
- [ ] Run `npm test -- src/services/ideaApi.test.ts`; expected failure: functions currently resolve fallback content.
- [ ] Remove `generateFallbackWords`, `generateFallbackMindMap`, `generateFallbackIdeas`, and `transformFallbackIdea` imports from `ideaApi.ts`.
- [ ] Let `postStream()` errors propagate with helpful messages.
- [ ] Run `npm test -- src/services/ideaApi.test.ts`; expected result: API tests pass.

### Task 2: Add Refinement Contract

**Files:**
- Modify: `app/src/types/idea.ts`
- Modify: `app/server/modelOutput.ts`
- Test: `app/server/modelOutput.test.ts`

- [ ] Write a failing normalizer test for a model payload containing `vitality`, `roundtable`, `directions`, `mvpLadder`, and `actions`.
- [ ] Run `npm test -- server/modelOutput.test.ts`; expected failure: `normalizeIdeaRefinement` is missing.
- [ ] Add refinement types to `idea.ts`.
- [ ] Implement `normalizeIdeaRefinement(raw, idea)` with stable defaults only for missing fields inside an otherwise valid AI response, not as an offline fallback.
- [ ] Run `npm test -- server/modelOutput.test.ts`; expected result: normalizer tests pass.

### Task 3: Add Refinement Prompt And Route

**Files:**
- Modify: `app/server/promptBuilder.ts`
- Modify: `app/server/index.ts`
- Test: `app/server/promptBuilder.test.ts`

- [ ] Write a failing prompt test requiring vitality analysis, six role voices, toy/tool/product directions, 1-hour/1-day/1-week MVPs, and three next actions.
- [ ] Run `npm test -- server/promptBuilder.test.ts`; expected failure: `buildRefinePrompt` is missing.
- [ ] Implement `buildRefinePrompt({ idea })`.
- [ ] Add `RefineBody`, route parsing, and `/api/idea/refine` to `server/index.ts`.
- [ ] Run `npm test -- server/promptBuilder.test.ts server/modelOutput.test.ts`; expected result: prompt and model tests pass.

### Task 4: Add Frontend Refinement API And Store

**Files:**
- Modify: `app/src/services/ideaApi.ts`
- Modify: `app/src/store/ideaStore.ts`
- Test: `app/src/services/ideaApi.test.ts`
- Test: `app/src/store/ideaStore.test.ts`

- [ ] Write a failing `refineIdea()` streaming test that reads `event: done` with a `refinement`.
- [ ] Write a failing store test that calls `refineActiveIdea()` and stores the result under the selected idea id.
- [ ] Run `npm test -- src/services/ideaApi.test.ts src/store/ideaStore.test.ts`; expected failure: missing API/store action.
- [ ] Add `refineIdea()` to `ideaApi.ts`.
- [ ] Add `loading: "refine"` support and `refinementsByIdeaId` to the store.
- [ ] Catch store-level errors and set `error` while resetting `loading` to `idle`.
- [ ] Run `npm test -- src/services/ideaApi.test.ts src/store/ideaStore.test.ts`; expected result: tests pass.

### Task 5: Build In-Card Refinery UI

**Files:**
- Create: `app/src/components/workbench/IdeaRefinery.tsx`
- Modify: `app/src/components/workbench/IdeaCard.tsx`
- Test: `app/e2e/mvp-flow.spec.ts`

- [ ] Add an E2E expectation for a selected card showing "炼化这个脑洞" and the refinement sections after the AI response.
- [ ] Run `npm run e2e`; expected failure: UI does not exist.
- [ ] Create `IdeaRefinery` with vitality, roundtable, directions, MVP ladder, and action buttons.
- [ ] Render `IdeaRefinery` only inside the active `IdeaCard`.
- [ ] Show inline loading and error states; do not render mock refinement content.
- [ ] Run `npm run e2e`; expected result: the refinement flow is visible and usable.

### Task 6: Documentation And Verification

**Files:**
- Modify: `CONTEXT.md`
- Modify: `ARCHITECTURE.md`
- Modify: `DESIGN.md`
- Modify: `TASKS.md`

- [ ] Document that the product now has a divergence-to-refinement loop.
- [ ] Document that AI routes do not fall back to local mock content.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Start the dev server and run a real LLM smoke test for `/api/idea/refine`.
- [ ] Capture or inspect the browser flow if the server is available.

## Self-Review

- Spec coverage: covers no-fallback behavior, AI refinement contract, prompt, route, store, UI, docs, and verification.
- Placeholder scan: no TODO/TBD placeholders.
- Type consistency: uses `IdeaRefinement`, `refineIdea`, `normalizeIdeaRefinement`, and `refineActiveIdea` consistently.
