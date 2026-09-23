# UX-3A: Phased Implementation Plan for Claude Code

There is one PR per phase. Every phase is visually shippable on its own, so `dev` never shows a half-migrated page.

**Global rules for every phase**
- **Never modify:** `frontend/src/components/study/editor/{markdownBridge.ts,serializer.ts,useSavePipeline.ts,MarkdownDisplay.tsx}`, `editor/extensions/*`, `packages/**`, `backend/**`, `frontend/src/api/**`, `frontend/src/auth/**`.
- **Always pass unmodified:** `frontend/src/components/study/editor/__tests__/*` and `packages/artifact-contracts/src/__tests__/*` (`npm -w @qori/artifact-contracts test`).
- **View-model rules** (SPEC §1.1) apply to every page change. No provenance strings, `exists` recomputation or derivation in React.
- **Always pass:** `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:a11y`.
- If a test asserts markup this spec intentionally removes (e.g. `role="tab"` or a visible "READ-ONLY · SYSTEM"), update that assertion in the same PR and list each change under "Test changes" in the PR description. Don't delete tests.
- No literal hex, rgba, z-index or off-scale px in changed CSS. Use tokens (TOKENS.md).
- Read `reference/` files, but never import them. They aren't production.

---

## CC-1: Design-system foundation (workspace-scoped, DDR-04 = B)
**Prerequisites:** DDR-07 answered. Record `git rev-parse origin/dev` in the PR. If it isn't `7f0366d8…`, run the diff in SPEC §0.
**Allowed:** `frontend/src/styles/tokens.css`, `typography.css` (only for `@font-face` if self-hosting), `reset.css`, `frontend/index.html`, `frontend/public/fonts/**` (if self-hosting), `frontend/src/styles/__tests__/**`.
**Must not change:** any `.tsx`, any `*.module.css`, `brief-document.css`, and any existing declaration inside production `:root`.
**Tasks**
1. Append `reference/tokens.reference.css` blocks 1 and 2 to `tokens.css` (drop the reference header comment). For each PF-02 alias at `:root`, copy the fallback literal from `document.module.css` and list it in the PR.
2. Add the second font `<link>` (TOKENS §4) and keep Public Sans. Or add `@font-face` rules if self-hosting.
3. `reset.css`: `.skip-link { z-index: var(--z-skip) }`. The link rules stay on `--color-link` (blue at `:root`, brass in scope). Add `text-decoration-color: var(--color-border-emphasis)` **inside `:root[data-qori-surface="workspace"] a` only**.
**Expected visual:** **no change on any route.** The scope attribute isn't set by anything until CC-3/CC-4.
**Unchanged behavior:** everything.
**New tests:**
- `styles/__tests__/tokens.test.ts`:
  - every `var(--x)` used in `src/**/*.css` is defined in `tokens.css`
  - the production `:root` declarations are unchanged (snapshot of the pre-CC-1 declaration list)
  - every name overridden in the workspace block already exists at `:root`
- Computed-style test: with no attribute, `--font-ui` contains "Public Sans" and `--color-link` is the production value. With `data-qori-surface="workspace"` on `<html>`, they are Instrument Sans and #8A6B32.
**Acceptance:** zero undefined custom properties. Existing axe tests pass. Visual diff of Home, Projects, NewProject, a Brief and a Plan against `dev` shows no changes.
**Manual QA:** load those five routes and compare them to `dev`. In DevTools, set `document.documentElement.dataset.qoriSurface='workspace'` on a Plan and confirm the fonts and brass appear. Remove the attribute and confirm everything reverts.

## CC-2: Editorial document primitives
**Prerequisites:** CC-1 merged.
**Allowed:** `frontend/src/components/study/document/**` (all tsx, css, tests, `index.ts`), `frontend/src/components/ui/Button.{tsx,module.css}`, `ui/Alert.{tsx,module.css}`, `ui/Input.module.css` (border token only).
**Must not change:** `pages/**`, `shell/**`, `editor/**`, `styles/brief-document.css`.
**Tasks:** implement COMPONENT_MAPPING §3.5–3.17 for: ArtifactTabs, Alert `appearance="rule"`, Masthead `artifactLabel`, FactsGrid, DocumentSection, ProvenanceTag, StructuredItemRow(s), IdTag, DocumentTable, CollapsibleSection, ApprovalSection, SaveStateIndicator, Button `size`. Also create `document/ArtifactHeader.tsx` (not used by pages until CC-4). Copy the CSS from the reference `document.module.css` / `ArtifactHeader.module.css` / `Button.module.css` blocks. Remove dead `var(--x,#hex)` fallbacks. Leave `ReviewRail` visually as-is (CC-7). Add the view-model props from COMPONENT_MAPPING §3.7–3.10 (`Masthead masthead`, `FactsGrid QuickFact[]`, `DocumentSection`/`ProvenanceTag` `FieldProvenance[]`) **alongside** the legacy props, so the current PlanDocument compiles unchanged. Import the types from `@qori/artifact-contracts`.
**Expected visual:** PlanDocument (which already uses these primitives) looks roughly 70% like v2 inside the old light shell: display headings, quiet provenance, hairline rows, editorial tables, un-boxed facts. Brief is unchanged (it doesn't use the primitives yet).
**Unchanged behavior:** every prop keeps its type and default. Masthead without `artifactLabel` renders as before, minus the box. Priority mapping, table null-on-empty and `data-stable-id` are unchanged.
**New tests** (in `__tests__/DocumentComponents.test.tsx`): provenance text is in the DOM, outside the `h2`, and not `aria-hidden` · a system section renders a lock with `aria-hidden` · an inherited section renders `sourceNote` · ArtifactTabs has `nav[aria-label="Study artifacts"]` and `aria-current="page"` on the active link, with no `role="tab"` · Masthead with `artifactLabel` renders one `h1` with name "Research Brief {study}" · FactsGrid renders `dl/dt/dd` · DocumentTable renders `data-label` and `.tableScroll` · SaveStateIndicator never shows a time without `savedAt` · Button `size="sm"` class · Alert `appearance="rule"` keeps `role="alert"` for error. · ProvenanceTag renders `FieldProvenance.label` verbatim, and dedupes and " + "-joins arrays · DocumentSection shows a lock only when every entry is `editable:false` · FactsGrid omits `exists:false` and returns null when all are false · Masthead with `masthead` renders `dateFormatted` as-is and shows status only with `showStatus`.
**Acceptance:** all listed tests pass; `PlanDocument.test.tsx` passes (update only the documented assertions).
**Manual QA:** open a Plan. Hover each section and check the provenance fades in. Tab through: provenance appears on focus-within. Check with VoiceOver that "Summary, heading level 2" is followed by "Generated · Editable".

## CC-3: Workspace shell
**Prerequisites:** CC-2 merged; **DDR-01 answered**.
**Allowed:** `shell/AppShell.{tsx,module.css,test.tsx}`, `shell/SideNav.{tsx,module.css}`, `shell/TopBar.tsx` (only to extract `UserMenu`), new `shell/UserMenu.{tsx,module.css}`, `study/LifecycleRail.{tsx,module.css,test.tsx}`, new `study/lifecycle.ts`, new `study/workspace/{WorkspaceLayout,ContextRail}.{tsx,module.css}` + tests, `pages/StudyOverview.tsx` (import line only), new `hooks/useMediaQuery.ts`.
**Must not change:** `pages/BriefDocument.*`, `pages/PlanDocument.*`, `document/**`, `editor/**`.
**Tasks**
1. `AppShell`: add `WORKSPACE_ROUTE_PATTERNS = [] as const` and the `workspace` variant (COMPONENT_MAPPING §3.1). While a pattern matches, a `useLayoutEffect` sets `document.documentElement.dataset.qoriSurface = 'workspace'`, and deletes it on cleanup or route change (DDR-04 = B). The array stays **empty** in this PR.
2. `SideNav variant="inverse"` (§3.2), with visually hidden labels, tooltip and avatar + `UserMenu`.
3. `LifecycleRail variant="inverse"` + `study` prop (§3.3); `aria-current="step"`.
4. Move `computeLifecycleNodes` verbatim to `study/lifecycle.ts`; StudyOverview imports it.
5. `WorkspaceLayout` (§3.18) with drawer behavior (RESPONSIVE §3).
6. `ContextRail` (SPEC §10.1) with docked / strip / overlay / sheet, tabs, focus management. Render it with a test-only mode in unit tests.
**Expected visual:** no route changes appearance (the pattern list is empty). Storybook-free verification is through tests and a temporary local toggle (don't commit the toggle).
**Unchanged behavior:** all existing shell tests and nav items. StudyOverview renders identically.
**New tests:** AppShell renders the workspace variant for a matched pattern (inject via prop in the test) · `<html data-qori-surface>` is set on a matched route and removed after navigating to a non-matched route · SideNav inverse keeps accessible names for all items · LifecycleRail inverse: locked node is `aria-disabled` and still focusable, current node has `aria-current="step"` · WorkspaceLayout drawer: Escape closes and focus returns to the toggle · ContextRail: arrow keys move tabs, Escape closes the overlay, close returns focus, the sheet traps focus.
**Acceptance:** tests pass; `computeLifecycleNodes` output is deep-equal before and after the move (snapshot).
**Manual QA:** none user-visible. Reviewer runs the local toggle at 1440, 1100, 900 and 375 widths.

## CC-4: Research Plan migration
**Prerequisites:** CC-3 merged; DDR-12 answered.
**Allowed:** `pages/PlanDocument.{tsx,module.css,test.tsx}`, `shell/AppShell.tsx` (add the Plan pattern only).
**Must not change:** `buildPlanEditorContent` body, save handler payload, `useSavePlanContent`, `document/**`, `editor/**`.
**Tasks**
0. Replace the inline `useMemo(projectPlanToWorkspace…)` with `usePlanViewModel(studyPublicId)`, called before any early return (fixes PF-19, PF-21). Keep `useStudyPlan` only for `plan_url` (empty state), `prose_sections` (editor builder) and `artifact_version` (save).
1. Wrap the page in `WorkspaceLayout`: nav = `LifecycleRail inverse` (nodes from `computeLifecycleNodes(plan.study.brief_status)`, study = `plan.study.name`); header = `ArtifactHeader active="plan"` with the save state mapping (SPEC §8.5), GitHub = `plan.plan_url`, actions = Edit / Cancel+Save (`size="sm"`). No rail.
2. Remove the inline breadcrumb, `pageHead`, `StatusBadge` (PF-16) and `ArtifactTabs` from the body (they move to the header).
3. `Masthead artifactLabel="Research Plan"`.
4. Every `DocumentSection` gets `provenance` per COMPONENT_MAPPING §4.3 (no string literals; fixes PF-20). Inherited sections (Objectives, Research questions, Timeline) get `sourceNote`. Remove the `systemBlock` wrappers and the "What we aim to learn…" line. Use `Masthead masthead={vm.masthead} artifactLabel="Research Plan" showStatus` and `FactsGrid facts={[qf.method, qf.participants, qf.sessions, qf.timeline]}`.
5. Timeline footnote → `p.docFootnote`, copy per DDR-12. Replace all remaining inline `style={{…}}` with module classes.
6. Save failure banners → `Alert appearance="rule"`.
7. Empty state (`!plan.plan_url`): render inside WorkspaceLayout with the header (tabs) and the existing EmptyState in the canvas.
8. Add the Plan pattern to `WORKSPACE_ROUTE_PATTERNS`.
**Expected visual:** Plan matches `reference/DocumentCanvas.reference.tsx` (Plan variant) inside the dark shell.
**Unchanged behavior:** section order, all conditions for rendering each section, the edit → save → sync pipeline, the payload (`artifact_version`, `sections`, `structured`), the no-approval gate.
**New tests:** header contains tabs, save state and Edit · h1 accessible name · inherited sections show the source link to `/studies/:id/brief` · no `StatusBadge` · save_failed shows `role="alert"` · the edit toolbar is visible in edit mode (existing). · each section's provenance text equals `projectPlanToWorkspace(fixture)` labels (compute the expected values from the projection, not literals) · rerendering from loading → loaded → no-plan → plan logs no React hook-order warning (PF-19).
**Acceptance:** `PlanDocument.test.tsx` passes (documented assertion updates only). Axe clean in view and edit.
**Manual QA:** at 1440, 1100, 900 and 375: navigate Plan → Brief tab → back; edit, type, save, and see "Saving… → Saved"; force a sync failure (mock) and see the warning rule; open the drawer ≤980 and Escape.

## CC-5: Research Brief convergence
**Prerequisites:** CC-4 merged; DDR-10 and DDR-16 answered; DDR-11 ship decision recorded.
**Allowed:** `pages/BriefDocument.{tsx,module.css,test.tsx}`, `shell/AppShell.tsx` (add the Brief pattern), delete `styles/brief-document.css`.
**Must not change:** `buildBriefEditorContent` (PF-04 stays unless DDR-11), approval/request-changes calls and payloads, the checklist keys and labels, `document/**`, `editor/**`.
**Tasks:** replace the inline `useMemo(projectBriefToWorkspace…)` with `useBriefViewModel(studyPublicId)` (PF-21). Keep `useStudyBrief` for `cascade_fields` (editor builder) and `artifact_version` (save). Apply the SPEC §7 table line by line, with provenance per COMPONENT_MAPPING §4.3 and existence gates per §4.2. Document information omits empty rows (DDR-16). Move the existing inline review `<aside>` JSX **unchanged in logic** into `ContextRail modes=[{id:'review', label:'Review', content: <existing JSX>}]` with default open per SPEC §10.1. Replace hex inline styles in that JSX with document.module.css classes (`reviewStatus*`, `reviewFeedback`, `reviewChecklist`, `reviewCheck`, `reviewActions`). If DDR-10 = yes: `artifact_version: brief.artifact_version ?? 1`. Remove grips (PF-05). Delete `brief-document.css` and its import. Add the Brief pattern.
**Expected visual:** Brief matches the reference Brief canvas and Review rail. There's visual parity with Plan chrome.
**Unchanged behavior:** status-driven rendering, checklist gating of Approve, the request-changes flow, Revise → edit mode, rail hidden while editing, save pipeline.
**New tests:** each `brief_status` renders the matching `Alert rule` tone and rail status heading · Approve disabled until 4 checks · request-changes submit calls the mutation with the trimmed comment · `.brief-doc` class no longer present · rail toggle `aria-pressed` reflects state. · provenance text equals `projectBriefToWorkspace(fixture)` labels · `src/pages/__tests__/no-provenance-literals.test.ts` reads `BriefDocument.tsx` and `PlanDocument.tsx` and asserts no match for `/(GENERATED|CANONICAL|INHERITED|COMPUTED|SYSTEM|USER INPUT) ·|· (EDITABLE|READ-ONLY|SYSTEM)/` · Document information has no "claude-sonnet" or "research_brief v" literals.
**Acceptance:** `BriefDocument.test.tsx` passes (documented updates only); `grep -r "brief-document.css" src` is empty; axe clean for 4 statuses.
**Manual QA:** walk pending → request changes → (backend) changes_requested → Revise → save; approve with all checks; confirm the rail is closed by default at 1100 and opens as an overlay.

## CC-6: TipTap visual integration
**Prerequisites:** CC-5 merged; DDR-08 and DDR-09 answered.
**Allowed:** `editor/editor.module.css`, `editor/EditToolbar.tsx`, `editor/ArtifactEditor.tsx` (extension list: add `Focus` only if DDR-09 = yes; wrapper markup for `.editorContext`), `frontend/package.json` + lockfile (only for `@tiptap/extensions` if DDR-09 = yes), editor component tests (new file `editor/__tests__/EditToolbar.test.tsx`).
**Must not change:** `extensions/*`, `markdownBridge.ts`, `serializer.ts`, `useSavePipeline.ts`, `MarkdownDisplay.tsx`, existing `editor/__tests__/*`.
**Tasks:** SPEC §8.1–8.4 and §8.6. CSS from the reference `editor.module.css` block. Toolbar: `aria-label`, `aria-pressed`, roving tabindex, `disabled` via `editor.can()`. Add the `.editorContext` line (copy DDR-15).
**Expected visual:** matches `reference/EditorStates.reference.tsx`.
**Unchanged behavior:** hydration, serialization and round-trip output are byte-identical (the existing tests prove it). Heading levels stay [2,3].
**New tests:** toolbar is one tab stop and arrows move focus · `aria-pressed` toggles with Bold · structured item's ID isn't in `editor.getText()` · system block has no `opacity` < 1 (computed style in jsdom via class assertion).
**Acceptance:** all editor tests pass unmodified; axe clean in edit mode.
**Manual QA:** edit a Plan section with keyboard only; Bold via toolbar and ⌘B; caret inside a section shows the brass rule (if DDR-09); a structured item's ID can't be selected or deleted.

## CC-7: Review mode
**Prerequisites:** CC-6 merged.
**Allowed:** `document/ReviewRail.tsx`, `document/document.module.css` (review blocks only), `document/__tests__/*`, `pages/BriefDocument.tsx` (replace the inline rail JSX with `<ReviewRail … />` props), `study/workspace/ContextRail.*` (bug fixes only).
**Must not change:** mutations, payloads, checklist keys and labels, `editor/**`.
**Tasks:** COMPONENT_MAPPING §3.16: `ReviewRail approval={vm.approval}`, and the legacy status props are removed. Remove the "Future: comment threads…" note. Remove `isOverlay`/`onClose` props and their test cases.
**Expected visual:** matches `reference/ContextRail.reference.tsx` for all 3 statuses.
**Unchanged behavior:** identical approve/request-changes semantics and gating.
**New tests:** ReviewRail unit tests for 3 statuses + request-changes form; the disabled Approve has `aria-describedby` hint; the checklist `fieldset` has a legend.
**Acceptance:** Brief tests pass; the inline rail JSX is gone from BriefDocument.
**Manual QA:** same as CC-5 review walk-through, using keyboard only.

## CC-8: Responsive and accessibility hardening
**Prerequisites:** CC-7 merged.
**Allowed:** any file changed in CC-2 through CC-7 (CSS and a11y attributes only), new `*.a11y.test.tsx` for BriefDocument and PlanDocument.
**Must not change:** everything in the global "never modify" list; no new features.
**Tasks:** walk RESPONSIVE §1–5 at 1440 / 1181 / 1180 / 981 / 980 / 768 / 767 / 375. Walk SPEC §12 items 1–14. Add `inert` handling for modal drawer and sheet. Add `scroll-padding-top` for the sticky toolbar. Check reduced motion.
**New tests:** `BriefDocument.a11y.test.tsx` (4 statuses) and `PlanDocument.a11y.test.tsx` (view, edit, empty), with `vitest-axe` reporting zero violations; a keyboard test for the Escape order (menu → rail → drawer).
**Acceptance:** zero axe violations; manual checklist signed off in the PR with screenshots at the 8 widths.
**Manual QA:** VoiceOver (Safari) and NVDA (Firefox) passes over Brief pending and Plan edit; 200% zoom at 1280 (the layout should behave as `md`); Windows High Contrast (focus rings visible, lock glyph visible).
