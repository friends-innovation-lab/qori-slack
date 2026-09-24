# UX-3A.1 Implementation Phases (VC-1 … VC-4)

**Global rules**
- **Never modify:** `packages/**`, `backend/**`, `frontend/src/api/**`, `frontend/src/hooks/use*ViewModel.ts`, `editor/{markdownBridge,serializer,useSavePipeline,MarkdownDisplay}.ts(x)`, `editor/extensions/*`, `styles/tokens.css` (no new values needed).
- **Always pass unmodified:** `editor/__tests__/{markdown-api,markdown-roundtrip,serializer,tiptap-hydration,useSavePipeline}.test.ts`, `packages/artifact-contracts/src/__tests__/*`, `pages/__tests__/no-provenance-literals.test.ts`, `styles/__tests__/tokens.test.ts`, all `*.a11y.test.tsx`.
- Tests asserting removed visuals (e.g. a visible "READ-ONLY · SYSTEM", `.systemBlock` wrapper, Approve width) are updated in the same PR and listed under "Test changes."
- Every PR attaches screenshots of **Brief pending, Brief approved, Plan view, Plan edit** at 1440, 1100, 900 and 390, side by side with the matching approved state in `workspace2-states/` (01–08).

---

## VC-1: Shell and document geometry
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

## VC-2: Document composition and typography
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

## VC-3: Editor and review rail convergence
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
**Acceptance (the UX-3A.1 bar):** a reviewer shown a production screenshot and the approved CD screenshot at the same width and state identifies them as the same product design. This is signed off by design in the PR with the screenshot grid attached.
