# Single Idea Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the multi-card idea wall with a desktop report workspace that shows a compact idea navigator and one complete active idea report.

**Architecture:** Keep Zustand as the only state source. `IdeaCardList` owns navigation and active selection, `IdeaCard` becomes the report shell, and `IdeaRefinery` renders structured report sections without nested cards.

**Tech Stack:** React 18, TypeScript strict mode, Zustand, Tailwind CSS, Lucide React, Vitest, Testing Library, Playwright.

---

### Task 1: Report navigation and single active result

**Files:**
- Modify: `app/src/components/workbench/workbenchVisual.test.ts`
- Modify: `app/src/components/workbench/IdeaCardList.tsx`
- Modify: `app/src/components/workbench/IdeaCard.tsx`

- [ ] Add failing tests asserting one report article, a navigation button for every idea, and `aria-current` on the active idea.
- [ ] Run the focused visual test and verify RED.
- [ ] Replace the six-column card grid with a desktop two-column report workspace.
- [ ] Select the first idea when `activeIdeaId` is missing and switch reports through `setActiveIdea()`.
- [ ] Run the focused test and verify GREEN.

### Task 2: Report hierarchy and action simplification

**Files:**
- Modify: `app/src/components/workbench/workbenchVisual.test.ts`
- Modify: `app/src/components/workbench/IdeaCard.tsx`
- Modify: `app/src/components/workbench/IdeaRefinery.tsx`

- [ ] Add failing tests for report title, source path, transform menu, one pre-refine primary action and one post-refine primary action.
- [ ] Run the focused test and verify RED.
- [ ] Build the report header and unframed “why / first version” sections.
- [ ] Move transform directions into a single menu and keep favorite/continue-divergence secondary.
- [ ] Rename the refine entry to “生成完整报告” and make refined “收束推进” the single primary action.
- [ ] Run focused tests and verify GREEN.

### Task 3: Structured refinement report

**Files:**
- Modify: `app/src/components/workbench/workbenchVisual.test.ts`
- Modify: `app/src/components/workbench/IdeaRefinery.tsx`
- Modify: `app/src/index.css`

- [ ] Add failing tests for a direction comparison table, MVP timeline and six editorial annotations.
- [ ] Run the focused test and verify RED.
- [ ] Render vitality as compact report metadata, directions as a semantic table, MVP steps as a vertical timeline and role feedback as blockquotes.
- [ ] Remove nested card styling and establish report spacing, sticky navigation and restrained dividers.
- [ ] Run focused tests and production build.

### Task 4: Flow verification and records

**Files:**
- Modify: `app/e2e/mvp-flow.spec.ts`
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`
- Modify: `CONTEXT.md`

- [ ] Update desktop E2E for report navigation, transform menu, full report generation and incubator behavior.
- [ ] Run all unit tests, production build and desktop Playwright flow.
- [ ] Inspect 1280×720 and 1440×900 screenshots for hierarchy and overflow.
- [ ] Update project records and complete a final Critical/Important review.

