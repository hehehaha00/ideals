# Mind Map Collision Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add GSAP-powered collision motion, deterministic non-overlapping node scattering, and complete interaction locking while AI map actions run.

**Architecture:** Keep layout as pure deterministic geometry functions, keep AI state in Zustand, and isolate GSAP timelines inside a dedicated React hook/component layer. The canvas renders a semantic busy overlay and passes a disabled contract to every interactive node while business requests are active.

**Tech Stack:** React 18, TypeScript strict mode, Zustand, GSAP, @gsap/react, Vitest, Testing Library, Playwright.

---

### Task 1: Deterministic scattered layout

**Files:**
- Create: `app/server/mindMapLayout.ts`
- Create: `app/server/mindMapLayout.test.ts`
- Modify: `app/server/modelOutput.ts`

- [ ] Write failing tests proving 28 mixed nodes remain inside `x=12..87`, `y=20..80`, occupy all four quadrants, and keep a minimum label-aware separation.
- [ ] Run `npm test -- --run server/mindMapLayout.test.ts --reporter=dot` and verify RED.
- [ ] Implement seeded category sectors plus bounded collision relaxation in `layoutMindMapNodes()`.
- [ ] Use the pure layout function from `normalizeBrainstormMap()` and `normalizeMindMapExpansion()`.
- [ ] Run layout and model-output tests and verify GREEN.

### Task 2: Busy-state interaction contract

**Files:**
- Modify: `app/src/components/workbench/workbenchVisual.test.ts`
- Modify: `app/src/components/workbench/MindMapCanvas.tsx`
- Modify: `app/src/components/workbench/MindMapNode.tsx`

- [ ] Write failing tests proving map actions set `aria-busy`, render an operation-specific blocking layer, disable node/lock controls, and prevent pointer-driven movement.
- [ ] Run the focused visual test and verify RED.
- [ ] Add a shared `interactionLocked` prop derived from `loading !== "idle"`, block pointer handlers, and disable all canvas controls while busy.
- [ ] Add operation labels for map generation, expansion, reroll and idea collision.
- [ ] Run the focused visual test and verify GREEN.

### Task 3: GSAP collision choreography

**Files:**
- Modify: `app/package.json`
- Modify: `app/package-lock.json`
- Create: `app/src/components/workbench/useMindMapMotion.ts`
- Create: `app/src/components/workbench/MindMapActivity.tsx`
- Modify: `app/src/components/workbench/MindMapCanvas.tsx`
- Modify: `app/src/components/workbench/MindMapNode.tsx`
- Modify: `app/src/components/workbench/MindMapEdges.tsx`
- Modify: `app/src/index.css`
- Modify: `app/src/components/workbench/workbenchVisual.test.ts`

- [ ] Add failing semantic tests for motion targets, expansion-origin metadata, energy overlay and reduced-motion fallback.
- [ ] Install `gsap` and `@gsap/react`.
- [ ] Implement `useMindMapMotion()` with scoped timelines for initial burst, expansion burst, reroll collapse/scatter and collision convergence.
- [ ] Render the energy core, orbit rings, particles, path pulse and bottom-right AI activity readout.
- [ ] Use `transform`/`opacity`/SVG stroke animation only and clean every timeline on dependency changes and unmount.
- [ ] Run focused tests and production build.

### Task 4: End-to-end verification and records

**Files:**
- Modify: `app/e2e/mvp-flow.spec.ts`
- Modify: `CONTEXT.md`
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`

- [ ] Extend desktop E2E to assert busy interaction locking, generated-node motion markers and restored interaction after completion.
- [ ] Run all unit tests, production build and desktop Playwright flow.
- [ ] Inspect 1280×720 and 1440×900 screenshots, including a real expansion action.
- [ ] Update project records with GSAP, layout and interaction-lock decisions.
- [ ] Complete a final Critical/Important code review and `git diff --check`.

