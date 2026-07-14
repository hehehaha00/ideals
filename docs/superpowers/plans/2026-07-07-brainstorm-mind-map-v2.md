# Brainstorm Mind Map V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interactive divergent mind map flow that turns one vague topic into categorized, color-coded idea nodes and lets users collide selected nodes into project ideas.

**Architecture:** Keep the current single-column app shell, but add a new brainstorm map model beside existing dimension groups. The frontend calls `/api/idea/map`; if the AI proxy fails, `ideaEngine` creates a deterministic fallback map. The UI renders the map as SVG edges plus positioned HTML node cards, while existing idea generation reuses selected map nodes converted into `DimensionWord` objects.

**Tech Stack:** Vite, React, TypeScript, Tailwind CSS, Zustand, local Node AI proxy, Vitest, Playwright.

---

## File Structure

- Modify `app/src/types/idea.ts`: add `MindNode`, `MindEdge`, `BrainstormMap`, `MindNodeCategory`, `StuckType`, and helper category constants.
- Modify `app/src/lib/ideaEngine.ts`: add `generateFallbackMindMap()` and a converter from selected map nodes to collision words.
- Modify `app/src/services/ideaApi.ts`: add `generateMindMap()` using the same streaming/fallback pattern as words, ideas, and transform.
- Modify `app/server/promptBuilder.ts`: add `buildMindMapPrompt()`.
- Modify `app/server/modelOutput.ts`: add `normalizeBrainstormMap()`.
- Modify `app/server/index.ts`: add `/api/idea/map` route.
- Modify `app/src/store/ideaStore.ts`: store `mindMap`, `activeMindNodeId`, and actions to generate/select/lock/expand/use map nodes.
- Create `app/src/components/workbench/MindMapCanvas.tsx`: render SVG curved edges, colored node cards, legend, selected-node tray, and collision action.
- Modify `app/src/App.tsx`: insert mind map after the input and before legacy dimension/collision sections.
- Modify `app/e2e/mvp-flow.spec.ts`: verify initial map absence, map appearance, node selection, and idea generation from selected nodes.
- Modify tests in `app/src/services/ideaApi.test.ts`, `app/src/lib/ideaEngine.test.ts`, `app/src/store/ideaStore.test.ts`, `app/server/promptBuilder.test.ts`, and `app/server/modelOutput.test.ts`.
- Update `CONTEXT.md`, `ARCHITECTURE.md`, and optionally `TASKS.md`.

## Visual Thesis

Warm paper surface with bright cognitive labels: the mind map should feel like a clear creative lab diagram, not a dense graph editor. It can be more vivid than the current MVP through colored cards, glowing selected paths, soft curved lines, and a compact legend, but every color maps to meaning.

## Content Plan

1. Initial state: one large input remains the first screen.
2. Generated state: input shrinks upward; a mind map appears as the main workspace.
3. Interaction state: clicking nodes highlights paths and explains why that node exists.
4. Collision state: selected nodes become a tray; one button creates idea cards.

## Interaction Thesis

- Nodes grow outward from the center after generation, with categories visually grouped around the topic.
- Hover and selected states should make the active path obvious without moving layout.
- The old idea cards stay below the map so the product feels like a flow from messy divergence to clearer project directions.

---

### Task 1: Add Mind Map Domain Model

**Files:**
- Modify: `app/src/types/idea.ts`
- Test: `app/src/lib/ideaEngine.test.ts`

- [ ] Write a failing test that imports `generateFallbackMindMap()` and expects a center node, seven category branches, edges, and selectable non-center nodes.
- [ ] Run `npm test -- src/lib/ideaEngine.test.ts` and confirm it fails because `generateFallbackMindMap` is missing.
- [ ] Add `MindNodeCategory`, `StuckType`, `MindNode`, `MindEdge`, and `BrainstormMap` to `types/idea.ts`.
- [ ] Implement `generateFallbackMindMap(topic, intensity)` in `ideaEngine.ts`.
- [ ] Run `npm test -- src/lib/ideaEngine.test.ts` and confirm the new test passes.

### Task 2: Add Frontend API Support

**Files:**
- Modify: `app/src/services/ideaApi.ts`
- Test: `app/src/services/ideaApi.test.ts`

- [ ] Write a failing streaming test for `generateMindMap()` that returns `event: done` with a `map`.
- [ ] Write a fallback test for `generateMindMap()` when fetch fails.
- [ ] Run `npm test -- src/services/ideaApi.test.ts` and confirm both fail because the function is missing.
- [ ] Add `GenerateMindMapRequest` and `generateMindMap()` to `ideaApi.ts`.
- [ ] Run `npm test -- src/services/ideaApi.test.ts` and confirm the tests pass.

### Task 3: Add Server Prompt and Normalization

**Files:**
- Modify: `app/server/promptBuilder.ts`
- Modify: `app/server/modelOutput.ts`
- Modify: `app/server/index.ts`
- Tests: `app/server/promptBuilder.test.ts`, `app/server/modelOutput.test.ts`

- [ ] Write failing tests for `buildMindMapPrompt()` requiring the prompt to request categorized nodes, edges, stuck type, and JSON-only output.
- [ ] Write failing tests for `normalizeBrainstormMap()` requiring stable IDs, a center node, category defaults, and edges.
- [ ] Run `npm test -- server/promptBuilder.test.ts server/modelOutput.test.ts` and confirm failures are about missing exports.
- [ ] Implement the prompt builder and normalizer.
- [ ] Add `/api/idea/map` route to `server/index.ts`.
- [ ] Run `npm test -- server/promptBuilder.test.ts server/modelOutput.test.ts`.

### Task 4: Add Zustand Map State

**Files:**
- Modify: `app/src/store/ideaStore.ts`
- Test: `app/src/store/ideaStore.test.ts`

- [ ] Write failing store tests for `generateMindMap`, `toggleMindNode`, and `generateIdeasFromMindMap`.
- [ ] Run `npm test -- src/store/ideaStore.test.ts` and confirm failures are missing actions/state.
- [ ] Add map state and actions to the store.
- [ ] Convert selected mind nodes into six `DimensionWord` values so existing idea generation remains compatible.
- [ ] Run `npm test -- src/store/ideaStore.test.ts`.

### Task 5: Build MindMapCanvas UI

**Files:**
- Create: `app/src/components/workbench/MindMapCanvas.tsx`
- Modify: `app/src/App.tsx`
- Test: `app/e2e/mvp-flow.spec.ts`

- [ ] Write failing E2E expectations: no mind map at first load; after “开始发散”, “发散思维导图” appears with category labels and colored node buttons.
- [ ] Run `npm run e2e` and confirm failures are about missing mind map UI.
- [ ] Create `MindMapCanvas` using SVG edges and absolutely positioned node buttons.
- [ ] Add a selected-node tray and “用这些节点碰撞成想法” action.
- [ ] Insert the component into `App.tsx`.
- [ ] Run `npm run e2e`.

### Task 6: Visual Polish and Regression Verification

**Files:**
- Modify: `CONTEXT.md`
- Modify: `ARCHITECTURE.md`
- Optional: `TASKS.md`

- [ ] Update docs to say V2 now centers on an interactive divergent mind map.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `npm run e2e`.
- [ ] Start dev server and capture desktop/mobile screenshots using system Chrome.
- [ ] Fix visual regressions if the map overlaps, labels overflow, or mobile layout breaks.

## Self-Review

- Spec coverage: covers data model, AI/fallback, server route, state, UI, E2E, docs.
- Placeholder scan: no TODO/TBD placeholders.
- Type consistency: the plan consistently uses `BrainstormMap`, `MindNode`, `MindEdge`, and `generateMindMap`.
