# Fullscreen Mind Map Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve creative work, reject stale AI results, protect the local AI proxy, and replace the post-submit stacked page with a desktop-first fullscreen draggable mind map.

**Architecture:** Upgrade local persistence to a validated versioned workspace snapshot, add state revision checks around AI mutations, and add origin plus queue policies at the server boundary. Split the mind-map renderer into geometry, edge, and node units so dragging and visual hierarchy remain testable without growing the Zustand store or canvas component further.

**Tech Stack:** React 18, TypeScript strict mode, Zustand, Vite, Node HTTP, Vitest, Testing Library, Playwright.

---

### Task 1: Versioned workspace and incubator persistence

**Files:**
- Modify: `app/src/types/idea.ts`
- Modify: `app/src/store/storage.ts`
- Create: `app/src/store/storage.test.ts`
- Modify: `app/src/store/ideaStore.ts`
- Modify: `app/src/store/ideaStore.test.ts`

- [ ] **Step 1: Write failing storage migration and validation tests**

Add tests that load version 1 favorites, reject malformed entries individually, persist a version 2 workspace, and return a failure result when `localStorage.setItem` throws.

```ts
it("migrates v1 favorites into v2 incubator entries", () => {
  localStorage.setItem("idea-lab:v1", JSON.stringify({ version: 1, favorites: [{ idea, savedAt }] }));
  expect(loadStoredState().incubatorEntries[0]?.idea.id).toBe(idea.id);
});

it("reports storage write failures", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
  expect(saveStoredState(snapshot)).toEqual({ ok: false, message: expect.stringContaining("保存失败") });
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/store/storage.test.ts`

Expected: FAIL because version 2 storage APIs do not exist.

- [ ] **Step 3: Implement version 2 storage and migration**

Add `IncubatorEntry`, `WorkspaceSnapshot`, and `StoredIdeaState` types. Preserve the version 1 key for migration, write version 2 to `idea-lab:v2`, validate nested idea identifiers, and return `{ ok: true } | { ok: false; message: string }` from writes.

- [ ] **Step 4: Write failing store persistence test**

Add a regression test covering `refine -> incubate -> generate another map -> hydrate`, asserting that the incubated refinement survives and the active workspace restores independently.

- [ ] **Step 5: Run focused store test and verify RED**

Run: `npm test -- src/store/ideaStore.test.ts`

Expected: FAIL because hydrate only restores favorites and refinements are cleared.

- [ ] **Step 6: Integrate version 2 persistence into the store**

Persist stable workspace fields and enriched incubator entries after successful state mutations. Keep loading, error, stream text, modal open state, and temporary incubator selection ephemeral. Surface save failures through the existing `error` field without rolling back memory state.

- [ ] **Step 7: Run storage and store tests**

Run: `npm test -- src/store/storage.test.ts src/store/ideaStore.test.ts`

Expected: PASS.

### Task 2: Request revision protection and draggable node state

**Files:**
- Modify: `app/src/store/ideaStore.ts`
- Modify: `app/src/store/ideaStore.test.ts`

- [ ] **Step 1: Write failing stale-response tests**

Cover a map request followed by `setTopic`, and a reroll followed by `moveMindNode` or `toggleMindNodeLock`. Resolve the old Promise and assert that it cannot replace current state.

```ts
const pending = deferred<BrainstormMap>();
requestMindMapMock.mockReturnValueOnce(pending.promise);
const request = useIdeaStore.getState().generateMindMap();
useIdeaStore.getState().setTopic("新主题");
pending.resolve(oldMap);
await request;
expect(useIdeaStore.getState().mindMap).not.toEqual(oldMap);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/store/ideaStore.test.ts`

Expected: FAIL because current request checks do not include state revisions.

- [ ] **Step 3: Add revision-aware request guards**

Track topic, map, and idea revisions inside the store. Increment the relevant revision for edits, selection, lock, and drag actions. Capture revisions at request start and require both request identity and matching revisions before commit. Add `moveMindNode(nodeId, x, y)` and `persistWorkspace()` actions.

- [ ] **Step 4: Run store tests**

Run: `npm test -- src/store/ideaStore.test.ts`

Expected: PASS, including existing stale-request tests.

### Task 3: AI proxy origin and bounded queue

**Files:**
- Create: `app/server/originPolicy.ts`
- Create: `app/server/originPolicy.test.ts`
- Modify: `app/server/config.ts`
- Modify: `app/server/config.test.ts`
- Modify: `app/server/llmGateway.ts`
- Modify: `app/server/llmGateway.test.ts`
- Modify: `app/server/index.ts`
- Modify: `app/.env.example`

- [ ] **Step 1: Write failing origin policy tests**

Test configured loopback origins, rejected external origins, concrete `Access-Control-Allow-Origin`, `Vary: Origin`, and OPTIONS rejection before request-body/model work.

- [ ] **Step 2: Run origin tests and verify RED**

Run: `npm test -- server/originPolicy.test.ts`

Expected: FAIL because the policy module does not exist.

- [ ] **Step 3: Implement origin policy and config**

Parse `IDEA_APP_ORIGINS` as a comma-separated allowlist with local Vite and preview defaults. Return 403 for a supplied disallowed Origin. Allow absent Origin for local non-browser tools while retaining all resource limits.

- [ ] **Step 4: Write failing gateway queue tests**

Create a gateway with concurrency 1 and queue capacity 1. Hold the first request, queue the second, and assert that the third rejects with a typed overload error. Add a deadline test whose queued request expires before obtaining a slot.

- [ ] **Step 5: Run gateway tests and verify RED**

Run: `npm test -- server/llmGateway.test.ts`

Expected: FAIL because the queue is currently unbounded and queue time has no deadline.

- [ ] **Step 6: Implement bounded queue and deadline**

Add `maxQueuedRequests` and `requestDeadlineMs` options, a typed `LlmOverloadedError`, abort-aware queue removal, and a single deadline signal covering queue plus upstream work. Map overload/deadline errors to clear SSE or HTTP errors in `index.ts`.

- [ ] **Step 7: Run server tests**

Run: `npm test -- server/originPolicy.test.ts server/config.test.ts server/llmGateway.test.ts server/relayClient.test.ts`

Expected: PASS.

### Task 4: Fullscreen map composition, drag behavior, and richer edges

**Files:**
- Create: `app/src/components/workbench/mindMapGeometry.ts`
- Create: `app/src/components/workbench/mindMapGeometry.test.ts`
- Create: `app/src/components/workbench/MindMapEdges.tsx`
- Create: `app/src/components/workbench/MindMapNode.tsx`
- Modify: `app/src/components/workbench/MindMapCanvas.tsx`
- Modify: `app/src/App.tsx`
- Modify: `app/src/index.css`
- Modify: `app/src/components/workbench/workbenchVisual.test.ts`

- [ ] **Step 1: Write failing geometry tests**

Test pointer-to-percent conversion with safe-area clamping and cubic edge generation for first-level and remote-association nodes.

```ts
expect(pointToCanvasPercent({ clientX: 500, clientY: 300 }, rect, safeArea)).toEqual({ x: 50, y: 50 });
expect(buildMindMapCurve(source, target, "远联想")).toContain("C");
```

- [ ] **Step 2: Run geometry tests and verify RED**

Run: `npm test -- src/components/workbench/mindMapGeometry.test.ts`

Expected: FAIL because geometry helpers do not exist.

- [ ] **Step 3: Implement geometry, edge, and node units**

Use Pointer Events with a movement threshold. Update coordinates during drag, persist on release, and suppress selection after a drag. Render category-aware cubic SVG paths with selected, remote, and primary variants. Render an explicit lock control and `aria-pressed` selection state.

- [ ] **Step 4: Write failing composition tests**

Update visual tests to assert that map mode hides the composer, stage rail, advanced collision, and idea wall; shows a fullscreen canvas; renders visible lock text; and switches to a separate idea-results view after collision.

- [ ] **Step 5: Run component tests and verify RED**

Run: `npm test -- src/components/workbench/workbenchVisual.test.ts`

Expected: FAIL because App still stacks all stages and MindMapCanvas still uses boxed layout.

- [ ] **Step 6: Implement App view switching and fullscreen map CSS**

Add home, map, and ideas views. The map view fills the viewport and owns only lightweight corner/top/bottom controls. Keep the current home atmosphere. Remove map-stage container boxes and legend cards from the active composition. Preserve the incubator modal as an overlay.

- [ ] **Step 7: Run frontend tests**

Run: `npm test -- src/components/workbench/mindMapGeometry.test.ts src/components/workbench/workbenchVisual.test.ts src/store/ideaStore.test.ts`

Expected: PASS.

### Task 5: Desktop end-to-end flow and project records

**Files:**
- Modify: `app/e2e/mvp-flow.spec.ts`
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`
- Modify: `CONTEXT.md`

- [ ] **Step 1: Update E2E expectations before implementation verification**

After submit, assert that the topic input and stage rail are hidden, the fullscreen map is visible, a node can be dragged, a node can be locked, and the path still reaches ideas, refinement, incubation, and refresh persistence.

- [ ] **Step 2: Run desktop E2E and fix only implementation defects**

Run: `npm run e2e -- --project=chromium --reporter=line`

Expected: PASS.

- [ ] **Step 3: Update project documentation**

Document version 2 persistence, request revisions, proxy origin/queue configuration, fullscreen map responsibilities, and desktop-first scope. Remove stale fallback-file references.

- [ ] **Step 4: Run full verification**

Run: `npm test -- --reporter=dot`

Expected: 0 failed tests.

Run: `npm run build`

Expected: TypeScript and Vite build exit 0.

Run: `npm run e2e -- --project=chromium --reporter=line`

Expected: 0 failed tests.

- [ ] **Step 5: Inspect the desktop UI in the in-app browser**

Verify at 1280x720 and 1440x900 that the map owns the viewport, nodes remain inside safe areas, lock status is legible, drag updates edges, and no stacked cards obscure the canvas.
