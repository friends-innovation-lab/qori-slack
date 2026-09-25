# UX-3A.1 Implementation Phases (revised after VC-1)

> **MATCH THE APPROVED CD COMPOSITION. DO NOT MATCH THE CURRENT PRODUCTION COMPOSITION.**
> **KEEP means visually equivalent already, not merely architecturally reusable.** A component can be reused in implementation while its rendered composition is RECOMPOSE/REPLACE. Every matrix in this package lists **Implementation reuse** and **Visual action** as separate columns.
> **Correction (2026-09-24, post-VC-1):** the first version of this handover marked the SideNav and lifecycle panel KEEP. That was wrong for the lifecycle panel and incomplete for the app rail and header. See §0 and LIFECYCLE_NAV_CONVERGENCE.md.



**Global rules**
- **Never modify:** `packages/**`, `backend/**`, `frontend/src/api/**`, `frontend/src/hooks/use*ViewModel.ts`, `editor/{markdownBridge,serializer,useSavePipeline,MarkdownDisplay}.ts(x)`, `editor/extensions/*`, `styles/tokens.css` (no new values needed).
- **Always pass unmodified:** `editor/__tests__/{markdown-api,markdown-roundtrip,serializer,tiptap-hydration,useSavePipeline}.test.ts`, `packages/artifact-contracts/src/__tests__/*`, `pages/__tests__/no-provenance-literals.test.ts`, `styles/__tests__/tokens.test.ts`, all `*.a11y.test.tsx`.
- Tests asserting removed visuals (e.g. a visible "READ-ONLY · SYSTEM", `.systemBlock` wrapper, Approve width) are updated in the same PR and listed under "Test changes."
- Every PR attaches screenshots of **Brief pending, Brief approved, Plan view, Plan edit** at 1440, 1100, 900 and 390, side by side with the matching approved state in `workspace2-states/` (01–08).

---

## VC-1: Shell and document geometry (**merged, historical record; do not redo**)
**Files allowed:** `document.module.css` (`.docWrap`, `.docCol` and the responsive column padding only), `ArtifactHeader.module.css`, `LifecycleRail.module.css`, `editor.module.css` (`.toolbar` background only).
**Tasks:**
- Centered 640 measure (GEOMETRY §2).
- Header on paper.
- Stretched tabs with the indicator underline.
- Lifecycle leak removed and padding fixed.
- Toolbar on paper.
**Expected:** the document sits centered at the approved width and the lifecycle panel is vertical at every width. The type isn't converged yet.
**New tests:**
- `WorkspaceLayout.visual.test.tsx`: the `.docCol` computed `max-width` is `736px` and `margin-left === margin-right`.
- `LifecycleRail.test.tsx`: in the inverse variant at a mocked 1000px viewport, `.list` has `flex-direction: column`.
**Acceptance:** GEOMETRY §2 values hold at 1440/1280/1100/900/768/390, and there's no horizontal lifecycle list at any width.

## VC-2A: Workspace frame and lifecycle convergence
**Prerequisites:** VC-1 merged. Q1 and Q2 answered (defaults apply if unanswered: study-name link; no counts or checks).
**Files allowed:**
- `components/study/LifecycleRail.{tsx,module.css,test.tsx}`
- new `components/study/workspaceLifecycle.ts`
- `components/shell/SideNav.{tsx,module.css,test.tsx}` (inverse variant only)
- `components/study/document/ArtifactHeader.{tsx,module.css}`
- `document.module.css` (`.saveDotNeutral` only)
- `pages/BriefDocument.tsx` and `pages/PlanDocument.tsx` (pass `status` and `railToggles` props only)
- tests
**Must not change:** `lifecycle.ts` (`computeLifecycleNodes`, `stageRoutes`), StudyOverview, the default (non-workspace) SideNav and LifecycleRail variants, routes, and any data or mutation code.
**Tasks:** LIFECYCLE_NAV_CONVERGENCE.md §1 and §4 in full, plus COMPONENT_DELTAS §2 (SideNav, ArtifactHeader).
**Expected:** at every width, the frame is the CD composition:
- app rail with 4 items, then Admin and the avatar
- lifecycle with 5 groups and 15 items: Brief/Plan routable, 13 dimmed placeholders
- header with a persistent status and the Review toggle
**New tests:**
- The lifecycle renders exactly the 5 group headings and 15 labels, in order.
- Only Research Brief and Research Plan are links. The 13 placeholders are not focusable and have the accessible suffix "not yet available".
- Research Plan is `aria-disabled` with a lock glyph iff `computeLifecycleNodes(status)` returns plan `locked`.
- No Overview, Sources, Evidence, Findings or Outputs text in the inverse nav.
- The study name links to `/studies/:id`.
- The inverse SideNav contains exactly Home, Projects, Studies, Ask Qori and (owner) Admin.
- The ArtifactHeader shows the status label when `saveState` is null, and shows `saveState` otherwise.
- The Brief header has a Review toggle whose `aria-pressed` tracks the rail.
**Acceptance:**
- Screenshot-level: production Brief at 1440, 1100, 900 and 390, next to `workspace2-states/01` (and the drawer at 900 and 390), is the same frame composition (LIFECYCLE_NAV_CONVERGENCE §6).
- The existing `LifecycleRail.test.tsx` cases for the **default** variant pass unchanged.
- The inverse-variant cases are rewritten and listed under "Test changes".

## VC-2B: Document composition and typography (was VC-2)
**Files allowed:**
- `document.module.css`: replace wholesale with `reference/document.module.target.css`
- `Masthead.tsx`, `FactsGrid.tsx`, `CollapsibleSection.tsx`, `DocumentTable.tsx`: markup per COMPONENT_DELTAS §2
- `BriefDocument.module.css`: dead rules removed
- `document/__tests__/*`
**Must not change:** any page TSX logic or props, view-model usage.
**Tasks:** COMPONENT_DELTAS §1 rows F–O, the dead-class removal (§4), and TYPOGRAPHY in full.
**Expected:** Brief and Plan read as the approved editorial artifact: display-serif masthead and sections, serif prose, open facts row, quiet provenance, brass-deep ID column, ruled tables and collapsibles.
**New tests:**
- `styles/__tests__/workspace-typography.test.ts`: fails if `document.module.css`, `ReviewRail.module.css`, `ContextRail.module.css`, `ArtifactHeader.module.css` or `editor.module.css` reference `--text-h1`, `--text-h2`, `--text-h3` or `--text-body-size`.
- Every class listed in TYPOGRAPHY with a `Family` other than "UI" declares `font-family` or a `font:` shorthand.
- Component tests:
  - FactsGrid renders no `.systemBlock`.
  - Masthead's system label has class `srOnly`.
  - CollapsibleSection renders a chevron that is `aria-hidden`.
  - DocumentTable cells carry `data-label`.
**Acceptance:** TYPOGRAPHY acceptance check passes via computed styles in a Playwright or Vitest-browser snapshot. No document surface has border-radius > 0 or a background fill.

## VC-3: Editor and review rail convergence (after VC-2B)
**Files allowed:** `ReviewRail.module.css`, `ReviewRail.tsx` (Button sizes and action-row order only), `ContextRail.module.css` (`.railBody` padding), `editor.module.css` (verify only), and their tests.
**Tasks:** COMPONENT_DELTAS §3.
**Expected:** the rail matches `workspace2-states` Review states: a mono eyebrow, then the display status in the state color, serif copy at 32ch, a ruled checklist, and one sm action row.
**New tests:**
- ReviewRail: the Approve button has the `sm` class and shares a row with Request changes (same `offsetTop` in jsdom via a class assertion).
- The pending status has `reviewStatusWarning`.
- Existing gating tests pass unchanged.
**Acceptance:** approve/request-changes behavior is identical (existing tests). Visual match to the approved rail at 1440 and in the sheet at 390.

## VC-4: Visual QA and responsive corrections
**Files allowed:** any CSS module touched in VC-1–VC-3, for fixes only.
**Tasks:**
- Walk RESPONSIVE_CONVERGENCE at 6 widths × 4 states.
- Fix drift.
- Confirm reduced motion, focus rings and 200% zoom.
- Run axe (existing a11y tests).
**Order of review:** frame first (LIFECYCLE_NAV_CONVERGENCE §6 and SPEC §0), then document. A frame mismatch fails the phase regardless of document fidelity.
**Acceptance (the UX-3A.1 bar):** a reviewer shown a production screenshot and the approved CD screenshot at the same width and state identifies them as the same product design. This is signed off by design in the PR with the screenshot grid attached.
