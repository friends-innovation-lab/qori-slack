# UX-3A.1: Workspace Visual Convergence Spec

**Compared:** `qori-slack@dev` (15 commits past `7f0366d8`, read 2026-09-24T21:05Z) vs the approved Workspace v2 design (Claude Design project "Qori": `workspace2.css`, `workspace2-*.jsx`, `workspace2-states/01–08`) and `design/workspace/workspace-v2/reference/`.
**Rule:** visual source of truth = approved v2. Functional source of truth = production. This spec changes **composition, CSS and layout only**.

---

## 1. Overall diagnosis

The architecture migration (CC-1…CC-8) landed. The visual migration mostly didn't.

1. **`document.module.css` was never replaced.** CC-2 was meant to swap it for the reference blocks. Instead, production kept its pre-v2 rules and only added classes. The reference file `workspace-v2.reference.css` exists in the repo but none of its document-block values are applied. Nearly every document-canvas miss traces back to this one file.
2. **Legacy type tokens drive the document.** `.secHeading` and `.mastTitle` use `--text-h1/h2-*` (28/22px, weight 700) and set no `font-family`, so they render in Instrument Sans bold, not Cormorant 500. `.blockProse` sets no family, so body prose renders in the UI sans. The serif editorial voice only shows up in structured rows and kv paragraphs.
3. **The canvas geometry is app-layout geometry.** `.docCol` is `max-width: 840px` with no `margin: auto`, and `.docWrap` is a flex row with a 32px gap left over from the old inline rail. The column hugs the left edge of the canvas and runs about 200px wider than the approved reading column.
4. **Old compositions were restyled, not replaced.** Quick Facts are still bordered cards inside a tinted `systemBlock`. Provenance is still colored chips. Priority is still colored pills. Collapsibles are still bordered boxes. Sections are still separated by bottom rules. "READ-ONLY · SYSTEM" labels are still visibly pinned to the masthead and facts.
5. **Shell pieces are close but carry legacy leaks.** The biggest: `LifecycleRail.module.css`'s legacy `@media (max-width:1023px)` block also hits the inverse variant, so at 981–1023px and inside the ≤980 drawer the dark lifecycle list turns into a **horizontal** strip.

So production reads as "the old Qori app with a dark sidebar." The target reads as "an editorial research document in a research workspace."

## 2. Largest structural mismatches (top 10)

| # | Mismatch | Evidence (dev) | Action |
|---|---|---|---|
| 1 | Reading column too wide and left-aligned | `.docCol{max-width:840px}` with no auto margins; `.docWrap{display:flex;gap:32px;margin-top:16px}` | REPLACE geometry: centered 640px measure, 48px padding |
| 2 | Section headings are sans bold, not display serif | `.secHeading{font-size:var(--text-h2-size);font-weight:700}`, no family | REPLACE type role |
| 3 | Body prose is UI sans | `.blockProse{font-size:15px;line-height:1.7}`, no family | REPLACE type role (Source Serif 4 16/28) |
| 4 | Quick Facts are boxed cards in a tinted panel | `.systemBlock` bg + border + radius; `.factItem` border + radius + padding | REPLACE composition: open `<dl>` row between hairlines |
| 5 | Masthead reads as an app page title | `.mastTitle` 28px/700 sans; eyebrow 12px sans; visible absolute "READ-ONLY · SYSTEM"; extra bottom rule | RECOMPOSE (editorial title block) |
| 6 | Provenance is loud and always on | `.provTag` colored bg chips (success/info/warning), always visible | RESTYLE + REPOSITION (quiet mono, hover/focus reveal) |
| 7 | Section rhythm is dense and ruled | `.docSec{margin-bottom:32px;padding-bottom:24px;border-bottom:1px}`; head→content 12px | REPLACE rhythm (48px whitespace, no rules) |
| 8 | Lifecycle list goes horizontal at ≤1023 (incl. drawer) | legacy `.rail`/`.list` media block applies to `.railInverse` | REMOVE the leak (scope legacy responsive to non-inverse) |
| 9 | Review rail is a stacked form | `.reviewActions{flex-direction:column}`; Approve is `md` (40px) full-width; pending status colored `--color-text`; checklist has no rules | RECOMPOSE (status hierarchy, ruled checklist, inline action row) |
| 10 | Legacy chrome in the document | priority pills, bordered collapsibles, 2px table header rule, 13px sans tables, muted-grey 13px IDs, white header bar (`--color-surface`) | RESTYLE / REPLACE per COMPONENT_DELTAS |

## 3. Area audit (A–U)

Each area gives **Current → Target → Delta → Action → Files → Acceptance**. Exact values are in GEOMETRY.md and TYPOGRAPHY.md.

### A. Workspace shell
- **Current:** `shellWorkspace` flex with 64 + 224 dark rails, main is `display:flex`. Matches the target structure.
- **Target:** same.
- **Delta:** none structural. The canvas has no background owner; `--color-paper` comes from the shell. OK.
- **Action:** KEEP.
- **Files:** —
- **Acceptance:** at 1440, 64 + 224 dark rails are flush left, the canvas is paper `#FAFAF7`, and only the canvas and rail body scroll.

### B. SideNav (inverse)
- **Current:** 64px, 40×40 tiles `--radius-xl` 10, active 2px brass marker.
- **Target:** 64px, 38–40px tiles, radius 9–10, 25px Cormorant "Q" mark or logo, 30–32px avatar.
- **Delta:** the `.mark` holds the logo image. Tile and marker geometry are within tolerance.
- **Action:** KEEP.
- **Files:** —
- **Acceptance:** the active marker sits 12–13px outside the tile, and tooltips appear on hover/focus.

### C. Lifecycle panel
- **Current:** 224px dark with study head and rows. The legacy ≤1023 block makes the list horizontal (mismatch #8). `.rail` base `padding: 16px 0` stacks with the `.railInverse` padding. The back link reads "All studies" pointing to `/`.
- **Target:** vertical at every width (docked or drawer). The study head is 20/20/16 padding, a mono eyebrow, a 19px display name and a back link. Rows are 36px min with a 2px left rule and a mono count.
- **Delta:** responsive leak and a double top padding.
- **Action:** REMOVE the leak. RESTYLE padding.
- **Files:** `LifecycleRail.module.css`.
- **Acceptance:** at 1000px and inside the drawer at 900/390 the list is vertical, and the first row sits 8px under the head rule.

### D. Top artifact bar
- **Current:** 52px, `background: var(--color-surface)` (#FFF), 24px x-padding, gap 12. Tabs are 500 weight with a `--color-text` underline and `padding: 8px 12px`.
- **Target:** 52px on **paper**, x-padding 20–24, gap 12–14. Tabs fill the bar height (`align-self: stretch`), 13px, rest 400, active 600 with a 2px `--color-indicator` underline sitting on the hairline.
- **Delta:** white bar on paper creates a visible band. The tab underline is ink, not the indicator, and tabs don't stretch.
- **Action:** RESTYLE.
- **Files:** `ArtifactHeader.module.css`, `document.module.css` (`.artifactTabs`, `.artifactTab*`).
- **Acceptance:** the header background equals the canvas, and the active-tab underline is brass-deep and flush with the header's bottom hairline.

### E. Document canvas width and centering
- **Current:** 840px max, left-aligned, 16px top offset, flex row wrapper.
- **Target:** reading column content **640px**, padding **48px** sides, **48–56px** top, **128–140px** bottom, centered in the canvas (`margin: 0 auto`). Outer max-width = 736px.
- **Delta:** mismatch #1.
- **Action:** REPLACE.
- **Files:** `document.module.css` (`.docWrap`, `.docCol`).
- **Acceptance:** at 1440 with the rail open (canvas 808px) the column is centered ±1px. At 1440 with the rail closed (canvas 1104px) there's ≥180px of paper on each side of the column.

### F. Masthead
- **Current:** h1 28/34 700 sans. The eyebrow is 12px sans muted. A visible "READ-ONLY · SYSTEM" chip is pinned top-right. The meta row has a top rule, and the masthead adds its own bottom rule and padding.
- **Target:** mono eyebrow 11px, 0.2em, brass-deep, 12–14px above the title. Title in Cormorant 44/46 500, −0.015em, 16px above meta. The meta row sits between **two** hairlines with 12–13px vertical padding. No visible system label.
- **Delta:** mismatch #5.
- **Action:** RECOMPOSE.
- **Files:** `Masthead.tsx` (label → visually hidden), `document.module.css`.
- **Acceptance:** the title is Cormorant at 44px computed, "READ-ONLY · SYSTEM" isn't visible (still in the accessibility tree), and exactly two hairlines bracket the meta.

### G. Metadata row
- **Current:** keys 11px sans 700, 0.05em; values 13px `--color-text-secondary`; gap 6/22.
- **Target:** keys mono 11px 600, 0.14em uppercase `--color-text-muted`, 8px before the value. Values 13px UI `--color-text-muted`. Gap 4 row / 24 column.
- **Action:** RESTYLE.
- **Files:** `document.module.css`.
- **Acceptance:** computed key `font-family` is JetBrains Mono.

### H. Quick Facts
- **Current:** a tinted, bordered, rounded `systemBlock` wrapping a grid of bordered cards; visible "READ-ONLY · SYSTEM" chip; 13px sans 700 values.
- **Target:** an **open** `<dl>` grid, `auto-fit minmax(132px,1fr)`, gap 16–18 row / 28–32 column, padding 20–24px 0, bottom hairline only. No boxes, fills or visible labels. Keys mono 11 caps; values Source Serif 4 15.5/20 600; sub 12px UI muted.
- **Delta:** mismatch #4.
- **Action:** REPLACE composition.
- **Files:** `FactsGrid.tsx` (drop the `systemBlock` wrapper and move the label into `srOnly`), `document.module.css`.
- **Acceptance:** zero borders or backgrounds on `.factItem`, and one hairline under the grid.

### I. Section headers
- **Current:** a `secHead` flex row with an h2 at 22/28 sans 700, gap 8, 12px to content.
- **Target:** h2 in Cormorant 27/31 500, −0.005em. The head row has gap 10–12, lock glyph, and provenance pushed right (`margin-left:auto`). 14–16px from head row to content.
- **Delta:** mismatch #2.
- **Action:** REPLACE type, RESTYLE row.
- **Files:** `document.module.css`.
- **Acceptance:** computed h2 is Cormorant Garamond 27px weight 500.

### J. Prose typography
- **Current:** 15px sans, line-height 1.7, 12px paragraph gap, no measure.
- **Target:** Source Serif 4 16/28, paragraphs 16px apart, `max-width: 66ch`. Lists 15.5/26 with quiet markers. Markdown h3 as mono caps label. Links brass-text with a hairline underline.
- **Delta:** mismatch #3.
- **Action:** REPLACE.
- **Files:** `document.module.css` (`.blockProse`, `.block`, `.kvParagraph`).
- **Acceptance:** computed `.blockProse p` font-family starts with "Source Serif 4", and the line box is 28px.

### K. Structured item rows
- **Current:** hairline list (good), top border on the container, 15px, 1.55. IDs are 13px mono `--color-text-muted`, gap 16. Priority is a colored pill.
- **Target:** top hairline per row plus a bottom hairline on the last row. Padding 12px 2px. 56px ID column in 11px mono 600, `--color-brand-deep`. Text serif 15/24. Priority is mono 11 caps text: Primary brass-deep, others muted.
- **Action:** RESTYLE (rows, IDs). REPLACE (priority pill → text tag).
- **Files:** `document.module.css`.
- **Acceptance:** IDs align in a 56px column, and no priority element has a background or border.

### L. Tables
- **Current:** 13px sans, header 12px sans caps with a **2px** rule, cell padding 8/12, last row unruled.
- **Target:** header mono 11 caps 0.14em muted, **1px** `--color-border-emphasis` rule, padding `0 12 8 2`. Cells Source Serif 4 14/22 `--color-text-meta`, padding `12 12 12 2`, horizontal hairlines only, **last row keeps its hairline**. Wrapped in `.tableScroll`.
- **Action:** RESTYLE.
- **Files:** `document.module.css`, `DocumentTable.tsx` (wrapper + `data-label` if missing).
- **Acceptance:** header rule computes to 1px, and cell family is serif.

### M. Provenance and editability
- **Current:** colored chips (canonical green, generated blue, inherited amber), always visible, beside the heading.
- **Target:** mono 11 caps 0.14em `--color-text-muted`, no fill, right-aligned in the head row, **opacity 0** until section `:hover` / `:focus-within`, and visually hidden ≤767. Lock glyph always visible for all-read-only sections. Label text comes from the view model (unchanged).
- **Delta:** mismatch #6.
- **Action:** RESTYLE + REPOSITION.
- **Files:** `document.module.css` (retire `.provCanonical/.provGenerated/.provSystem/.provInherited` hues).
- **Acceptance:** at rest no provenance text is visible, and hovering a section reveals it in muted mono. Axe still finds the text.

### N. System / read-only treatment
- **Current:** the `systemBlock` tinted box plus a visible absolute label on masthead and facts.
- **Target:** no tinted box in view mode. Read-only is carried by the lock glyph plus provenance only. "READ-ONLY · SYSTEM" text becomes visually hidden.
- **Action:** REMOVE the visual box and label. KEEP the text for screen readers.
- **Files:** `document.module.css`, `Masthead.tsx`, `FactsGrid.tsx`.
- **Acceptance:** no `.systemBlock` background is rendered anywhere in view mode.

### O. Collapsible metadata
- **Current:** bordered, rounded boxes with 16px gaps; summary 13px 600 muted with a hover fill; native marker.
- **Target:** grouped hairline rows. The first collapsible after content gets a 48px gap and a top rule in `--color-border-emphasis`, each row a bottom hairline. Summary padding 16px 2px with a 12px chevron (rotates 90°), title 13px 600 `--color-text-meta`, optional right-aligned summary text. Inner prose serif 13.5/22 muted.
- **Action:** REPLACE composition.
- **Files:** `CollapsibleSection.tsx` (chevron + `summary` prop), `document.module.css`.
- **Acceptance:** no border-radius or box borders; three collapsibles render as a ruled list.

### P. Editor view
- **Current:** close to target (CC-6). The toolbar background is `--color-surface` (white). The editor column inherits the wrong `.docCol` geometry, so it's wide and left-aligned.
- **Target:** same centered 640 column as view mode. Toolbar floating pill on **paper**, centered.
- **Action:** RESTYLE (toolbar bg). The geometry fix comes from E.
- **Files:** `editor.module.css`.
- **Acceptance:** toggling view ↔ edit keeps the column's left edge within ±2px.

### Q. Review rail
See COMPONENT_DELTAS §3.

### R. Spacing rhythm
- **Target sequence:** notice → 32–34px → eyebrow → 12–14 → title → 16 → meta row → 24 → first section. Section to section 48–52. Head to content 14–16. Paragraph gap 16. Subheading (h3) 24 above, 12 below. Table/rows block to next block 16.
- **Action:** REPLACE (GEOMETRY §3).

### S. Horizontal rules
- **Allowed rules only:** masthead meta (top + bottom), facts bottom, notice bottom, structured rows, table header (emphasis) and rows, collapsible group top (emphasis) and rows, header bottom, rail tab-row bottom, rail section separators.
- **Removed:** section bottom rules, masthead outer bottom rule, facts/card/collapsible box borders, 2px table rule.
- **Weight:** always 1px, except active tab/rail indicators (2px) and the feedback quote rule (2px).

### T. Responsive behavior
See RESPONSIVE_CONVERGENCE.md.

### U. Mobile composition (≤767)
- **Target:**
  - Single column with 16px sides and 24px top.
  - Masthead 32/36 with stacked meta.
  - Facts in 2 columns.
  - Rows stack the ID above the text.
  - Tables stack into label/value blocks.
  - Provenance is visually hidden.
  - The rail is a full-screen sheet and the lifecycle a drawer.
  - The toolbar is a full-bleed sticky bar.
- **Current:** most of this exists in the rail and editor CSS. The document-side stacking is partial (facts 2-col and rows stack exist; tables don't stack; masthead doesn't downsize).
- **Action:** RESTYLE.

## 4. Brief vs Plan: one system

- **Shared (must be byte-identical CSS, no page-level overrides):** shell, ArtifactHeader, Masthead, column geometry, all type roles, meta row, FactsGrid, DocumentSection, ProvenanceTag, rows, tables, collapsibles, notices, editor, toolbar.
- **Different (functional only):**
  - Brief has the Review rail and approval notices.
  - Plan has no rail or strip, plus the research period line, inherited source notes, and a footnote.
  - Artifact-specific sections and columns differ.
- **Rule:** `BriefDocument.module.css` and `PlanDocument.module.css` may contain **no** document typography or spacing. `BriefDocument.module.css` currently holds a dead copy of review-panel styles (`.reviewStatus*`, `.checklistItem`, …, superseded by `ReviewRail.module.css`). REMOVE it, keeping only `.inlineFeedback`.

## 5. Protected architecture

This convergence needs **no** functional or domain change. Untouched:
- `@qori/artifact-contracts`, the projections, `useBriefViewModel` and `usePlanViewModel`
- stable IDs, serializer, markdown bridge, TipTap schema and extensions, Brief hydration
- `artifact_version`, the save pipeline, the approval state machine and payloads
- GitHub projection and the backend

Allowed TSX changes are presentational only:
- `Masthead` and `FactsGrid`: system label moves into `srOnly`, and the wrapper is removed
- `CollapsibleSection`: chevron plus optional `summary`
- `DocumentTable`: scroll wrapper and `data-label`
- `ReviewRail`: action row markup and Button sizes

No props that carry data change.
