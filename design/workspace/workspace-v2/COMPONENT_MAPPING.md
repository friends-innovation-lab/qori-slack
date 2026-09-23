# Workspace v2 → Production Component Mapping

**Repo:** `friends-innovation-lab/qori-slack` @ `dev` `7f0366d8` · **Display contract:** `BriefViewModel` / `PlanViewModel` (`@qori/artifact-contracts`) · **Decisions:** KEEP / RESTYLE / EXTEND / NEW
Exact CSS for every row is in `reference/workspace-v2.reference.css`, under a banner that names the target module file.

## 1. Concept matrix

| Workspace v2 concept | Production component / file | Decision | Required design change |
|---|---|---|---|
| Workspace shell | `shell/AppShell.tsx` + `.module.css` | EXTEND | Add `workspace` variant: full-height flex, no page padding/max-width, TopBar not rendered (DDR-01). Selected by route match (§3.1). Skip link, toast region and `main#main-content` are unchanged. |
| Application icon rail | `shell/SideNav.tsx` + `.module.css` | EXTEND | `variant="inverse"` renders the existing `navItems` as the 64px dark rail. Labels become visually hidden plus a tooltip. The collapse button is hidden, and a user-menu avatar is added at the bottom (moved from TopBar, DDR-01). |
| Lifecycle navigation | `study/LifecycleRail.tsx` + `.module.css` | EXTEND | `variant="inverse"`: 224px dark panel with a study header (eyebrow, study name, back link). The existing `LifecycleNode[]` and stage routes are unchanged. `aria-current="step"` marks `is_current`. The spine line is retired. |
| Three-region layout (nav · canvas · rail) | none | NEW `study/workspace/WorkspaceLayout.tsx` | Owns the lifecycle slot, artifact header slot, canvas scroller and rail slot, plus the ≤980 drawer. Needed because no production element has a fixed-height, independently scrolling document canvas. |
| Artifact header bar | `pages/*Document.tsx` inline breadcrumbs + page head + `ArtifactTabs` | NEW `study/document/ArtifactHeader.tsx` | 52px bar: crumb (study), `ArtifactTabs`, `SaveStateIndicator`, GitHub link, rail toggles, Edit/Cancel/Save. It composes existing parts. `PageHeader` is page-title semantics and can't be reused. |
| Brief ↔ Plan tabs | `document/ArtifactTabs.tsx` | EXTEND | Semantics fix (PF-06): `<nav aria-label="Study artifacts"><ul>` with links and `aria-current="page"`, replacing `role="tab"`. Restyled as header tabs with a 2px `--color-indicator` underline. |
| Status notice | Brief inline alert `<div>`s; Plan uses `ui/Alert` | EXTEND `ui/Alert` | Add `appearance="rule"`: dot, bold state word and text on one line with a bottom hairline. Replaces the three 8px-left-border banners in Brief. `role` behavior is unchanged. |
| Document masthead | `document/Masthead.tsx` | EXTEND | Accepts `masthead: MastheadViewModel` + `artifactLabel` + `showStatus`. Renders an `<h1>` with the eyebrow (`artifactLabel`) and title (`masthead.studyName`) as two block spans, followed by the meta `<dl>`. The system box and READ-ONLY label are removed from view (label stays as visually-hidden text). |
| Quick Facts | `document/FactsGrid.tsx` | EXTEND | Accepts `QuickFact[]` and drops `exists:false`. Renders `<dl>`/`<div>`/`<dt>`/`<dd>` as an open grid between hairlines, no boxes. |
| Document section | `document/DocumentSection.tsx` | EXTEND | `provenance` accepts `FieldProvenance[]` from the view model (legacy string union kept until CC-5). Heading row = `h2` + lock glyph (all read-only) + `ProvenanceTag`. Optional `sourceNote`. `id` anchor. Display type restyle. |
| Provenance | `document/ProvenanceTag.tsx` | EXTEND + RESTYLE | Renders `FieldProvenance.label` verbatim (deduped, " + "-joined for several). Quiet mono label, no colored chip, opacity 0 until section hover/focus-within. Text always in the DOM. |
| Structured rows | `document/StructuredItemRow(s).tsx`, `IdTag.tsx` | RESTYLE | Hairline rows, 56px mono ID column in `--color-brand-deep`, serif text. The priority pill becomes a mono uppercase tag. Props are unchanged. |
| Editorial tables | `document/DocumentTable.tsx` | EXTEND | Wraps the table in `div.tableScroll`. Adds `data-label` on every `td` (for ≤767 stacking). Column option `emphasis?: boolean` (bold cell, replaces Brief's `<b>` count). Mono header row, serif cells, horizontal hairlines only. |
| System sections (collapsed) | `document/CollapsibleSection.tsx` | EXTEND | Optional `summary?: string` (right-aligned). Chevron glyph. Grouped hairline rows, first-of-group top rule `--color-border-emphasis`. |
| Read-only system block | `document.module.css .systemBlock/.systemLabel` | RESTYLE | View mode: no tinted box; the label is visually hidden. Read-only status is carried by the section lock glyph and provenance. |
| Approval checklist (document) | `document/ApprovalSection.tsx` | RESTYLE | Hairline list, mono ○/✓ glyphs. Copy and props are unchanged (PF-08 flagged). |
| Editor | `editor/ArtifactEditor.tsx` | RESTYLE (+ DDR-09) | CSS only, plus an optional decoration-only `Focus` extension. Schema, extensions, hydration and serialization are untouched. |
| Editor toolbar | `editor/EditToolbar.tsx` | RESTYLE (+ a11y) | Floating centered pill, sticky inside the canvas. `aria-pressed` and `aria-label` on tools, roving tabindex. Tool set unchanged (DDR-08). |
| Save state | `document/SaveStateIndicator.tsx` | EXTEND | Add `syncPending` state and `savedAt?: string` prop. Stop rendering "now" as the saved time (PF-07). Pages map `useSavePipeline().state` per SPEC §8.5. |
| Context rail | Brief inline `<aside class="review-rail">`, `document/ReviewRail.tsx` | NEW `study/workspace/ContextRail.tsx` | Tabbed rail shell with open / strip / overlay / sheet states. Only the Review mode ships in UX-3A (DDR-05). |
| Review | `document/ReviewRail.tsx` + Brief inline rail | EXTEND | Becomes the Review panel *content*. Accepts `approval: BriefApprovalState` and adds `checklist`, `onApprove`, `onRequestChanges`, `pending` props so Brief's inline rail JSX can be replaced. Same mutations and payloads. |
| Buttons | `ui/Button.tsx` | EXTEND | `size?: 'md' \| 'sm'` (default `md` = current 40px). Workspace header and rail use `sm` (32px; 40px ≤767). Variant restyle via tokens. |
| Citations `[D1]` | `MarkdownDisplay` renders `<sup>` | RESTYLE | Mono brass-deep superscript. **No trace card**: no trace data exists in any contract (SPEC §9.5). |
| Lifecycle data | `pages/StudyOverview.tsx computeLifecycleNodes` | KEEP (move) | Extract unchanged to `study/lifecycle.ts` so Brief/Plan can render the panel (DDR-03). No new logic. |
| Document viewer text | `editor/MarkdownDisplay.tsx` | KEEP | Unchanged. Styling comes from `className={docStyles.blockProse}`. |

## 2. Migration matrix (every relevant production file)

| File | Class | Notes |
|---|---|---|
| `styles/tokens.css` | EXTEND | Append `reference/tokens.reference.css` blocks 1 and 2. Existing `:root` stays untouched (DDR-04 = B) |
| `styles/typography.css` | KEEP (+ @font-face if DDR-07 = self-host) | Global h1–h4 rules stay for non-workspace pages |
| `styles/reset.css` | RESTYLE | `a` uses `--color-link`/`--color-link-hover`, underline color `--color-border-emphasis`. Skip link `z-index: var(--z-skip)`. No other change |
| `styles/brief-document.css` | **DELETE** (end of CC-5) | Every rule is superseded by `document.module.css` |
| `index.html` | EXTEND | Second font link. Public Sans stays (TOKENS §4) |
| `shell/AppShell.*` | EXTEND | `workspace` variant |
| `shell/SideNav.*` | EXTEND | `inverse` variant + avatar menu |
| `shell/TopBar.*` | KEEP | Not rendered in the workspace variant (DDR-01). Its user-menu logic moves to a shared `UserMenu` extracted from TopBar (same JSX, same handlers). |
| `shell/Breadcrumbs.*`, `shell/PageHeader.*` | KEEP | Not used on workspace routes |
| `study/LifecycleRail.*` | EXTEND | `inverse` variant + `study` header props |
| `study/lifecycle.ts` | NEW (moved code) | `computeLifecycleNodes` verbatim from StudyOverview |
| `study/workspace/WorkspaceLayout.*` | NEW | See §1 |
| `study/workspace/ContextRail.*` | NEW | See SPEC §10 |
| `document/ArtifactHeader.*` | NEW | See §3.4 |
| `document/ArtifactTabs.tsx` | EXTEND | nav semantics |
| `document/Masthead.tsx` | EXTEND | `artifactLabel` |
| `document/DocumentSection.tsx` | EXTEND | head row, `sourceNote` |
| `document/ProvenanceTag.tsx` | RESTYLE | |
| `document/FactsGrid.tsx` | RESTYLE | dl markup |
| `document/StructuredItemRow(s).tsx`, `IdTag.tsx` | RESTYLE | |
| `document/DocumentTable.tsx` | EXTEND | scroll wrapper, `data-label`, `emphasis` |
| `document/CollapsibleSection.tsx` | EXTEND | `summary`, chevron |
| `document/ApprovalSection.tsx` | RESTYLE | glyph classes |
| `document/SaveStateIndicator.tsx` | EXTEND | `syncPending`, `savedAt` |
| `document/ReviewRail.tsx` | EXTEND | actions + checklist props |
| `document/document.module.css` | RESTYLE | Per reference CSS. Remove the dead `var(--x, #hex)` fallbacks |
| `document/index.ts` | EXTEND | export `ArtifactHeader` |
| `editor/ArtifactEditor.tsx` | RESTYLE (+ DDR-09) | Adds `Focus` extension only if approved |
| `editor/EditToolbar.tsx` | RESTYLE | a11y attrs, roving focus |
| `editor/editor.module.css` | RESTYLE | Per reference CSS |
| `editor/extensions/*`, `markdownBridge.ts`, `serializer.ts`, `useSavePipeline.ts`, `MarkdownDisplay.tsx` | **KEEP — must not change** | Locked architecture |
| `ui/Button.*` | EXTEND | `size` |
| `ui/Alert.*` | EXTEND | `appearance="rule"` |
| `ui/Textarea.tsx`, `Input.module.css` | RESTYLE (token-driven only) | Border uses `--color-border-control` |
| `ui/StatusBadge.*` | KEEP | Not used in the workspace header after CC-4 (PF-16) |
| `pages/PlanDocument.*` | RESTYLE (composition) | CC-4 |
| `pages/BriefDocument.*` | RESTYLE (composition) | CC-5/CC-7 |
| `pages/StudyOverview.tsx` | KEEP (import change only) | Imports `computeLifecycleNodes` from `study/lifecycle.ts` |
| `packages/api-contracts/*` | **KEEP — must not change** | |
| `packages/artifact-contracts/**` (incl. `workspace-projection.ts`) | **KEEP — must not change** | Display contract. Gaps → DDR + projection ticket |
| `hooks/useBriefViewModel.ts`, `hooks/usePlanViewModel.ts` | KEEP (adopted) | Pages switch to these in CC-4/CC-5 (PF-19, PF-21) |

## 3. Component specifications

Each spec: **Preserve** (behavior/props that must not change), **Target** (visual), **States**, **CSS** (reference class names), **A11y**, **Prototype ref** (file in this Claude Design project).

### 3.1 AppShell — EXTEND
- **Preserve:** skip link, `main#main-content` with `tabIndex={-1}`, toast live region, mobile-nav state, all props.
- **Target:** when the current path matches `/studies/:studyPublicId/brief` or `/studies/:studyPublicId/plan` (exact; `/new` excluded), render `div.shellWorkspace`: SideNav `variant="inverse"` + `main.main` (no padding, no max-width) holding the page. TopBar isn't rendered (DDR-01). The match list is a constant `WORKSPACE_ROUTE_PATTERNS` in `AppShell.tsx`. It starts empty in CC-3 and CC-4 adds Plan, CC-5 adds Brief, so each route switches only when its page is ready.
- **States:** default; nav drawer open (≤980): SideNav + lifecycle panel slide in together (the drawer is owned by WorkspaceLayout, see RESPONSIVE).
- **A11y:** exactly one `main` landmark. The skip link targets `#main-content`. With TopBar absent there is no `banner` landmark on workspace routes. The ArtifactHeader is a `header` *inside* `main` (it's not a banner).
- **Prototype ref:** `workspace2-chrome.jsx` `.app`.

### 3.2 SideNav — EXTEND (`variant?: 'default' | 'inverse'`)
- **Preserve:** `navItems` list and routes exactly as production (Home, Projects, Studies, Search, Ask Qori, Work Queue, Admin for owners). `NavLink` active logic, Escape and focus behavior for the mobile sheet, `aria-label="Main"`.
- **Target (inverse):** 64px column, `--color-surface-inverse`. Qori logo asset (24px) at the top in a 40px box. 40×40 icon tiles (`--radius-xl`) with lucide icons at 20px. Rest color `--color-text-inverse-quiet`, hover `--color-text-inverse` on `--color-hover-inverse`, active `--color-indicator-inverse` on `--color-brand-tint` with a 2px left marker 12px outside the tile. Admin sits below a 24px divider. The bottom holds a 32px avatar (initials from `me.actor.display_name`, brass fill) that opens the user menu (Sign out), anchored to the right of the avatar. The collapse button isn't rendered.
- **States:** rest, hover, active, focus-visible (`--focus-ring-inverse`), tooltip on hover/focus (label, 12px, dark chip, `--z-popover`, 300ms show delay, instant hide).
- **A11y:** labels stay in the DOM as `.label` visually hidden, so each link's name = label. The tooltip is `aria-hidden="true"` (duplicate of the name). The avatar button: `aria-haspopup="menu"`, `aria-expanded`, `aria-label="User menu for {name}"`. The menu: `role="menu"`; Escape closes it and returns focus to the avatar.
- **Prototype ref:** `.arail`.

### 3.3 LifecycleRail — EXTEND (`variant?: 'default' | 'inverse'`, `study?: { name: string; backTo: string; backLabel: string; orgName?: string }`)
- **Preserve:** `studyPublicId`, `nodes: LifecycleNode[]`, `stageRoutes`, locked-node click prevention, `aria-disabled`, and the aria-label composition (label, count, unlock hint).
- **Target (inverse):** 224px, `--color-surface-inverse-2`. Study head: eyebrow (`orgName` if provided, else "Study", mono caps quiet), name (display 19/24), back link "← All studies" (`backTo="/projects/…"` or `/`, whichever the page already links; DDR-01 note). Nodes are full-width rows at 13px with a 2px left border. The active row (current route) gets the brass border, tint and weight 600. Count is mono right-aligned. Locked rows are quiet text with a quiet lock icon (not red on dark), and the unlock hint is shown below in italic 12px.
- **States:** locked, readiness_warning (brass icon), suggested (inverse icon), free (quiet), current, active route, hover, focus.
- **A11y:** `nav aria-label="Study lifecycle"`. The node matching `is_current` gets `aria-current="step"`, and the active route link keeps NavLink's `aria-current="page"`. Where both apply, `page` wins. Locked links are `aria-disabled="true"` and stay focusable so the hint is discoverable.
- **Prototype ref:** `.srail`. The prototype's grouped Discovery/Planning/Fieldwork list is **not** used: production `LifecycleNode` stages are the contract.

### 3.4 ArtifactHeader — NEW (`study/document/ArtifactHeader.tsx`)
Props: `studyName`, `studyPublicId`, `active: 'brief'|'plan'`, `saveState?: ReactNode`, `githubUrl?: string|null`, `railToggles?: ReactNode`, `actions: ReactNode`, `onNavToggle: () => void`, `navOpen: boolean`.
- **Target:** 52px, paper, bottom hairline, `padding: 0 24px`, `gap: 12px`. Order: nav toggle (≤980 only) · crumb `nav[aria-label=Breadcrumb] > ol > li > Link` (study name, max 220px, ellipsis, hidden ≤980) · `ArtifactTabs` · grow · saveState · GitHub link ("GitHub ↗", 12px) · 1px×20px rule · railToggles · actions (Buttons `size="sm"`).
- **States:** view (Edit secondary button), editing (Cancel secondary, Save primary; disabled when not dirty or saving; loading while saving).
- **A11y:** `<header>` inside `main`. Nav toggle: `aria-label="Study navigation"`, `aria-expanded={navOpen}`, `aria-controls="workspace-nav"`. Rail toggles: `aria-pressed`, `aria-controls="context-rail"`, `aria-label="Review panel"`.
- **Prototype ref:** `W2Header` in `workspace2-chrome.jsx`.

### 3.5 ArtifactTabs — EXTEND
- **Preserve:** props, routes, labels "Brief" / "Research Plan".
- **Target:** tabs fill the header height, 13px, 12px horizontal padding, active weight 600 with a 2px `--color-indicator` underline sitting on the header hairline.
- **A11y:** `nav aria-label="Study artifacts"` > `ul` > `li` > `Link aria-current={active ? 'page' : undefined}`. Remove `role="tablist"`, `role="tab"` and `aria-selected`: these are navigation links, not an ARIA tab widget (PF-06). While editing, the inactive tab stays a link. Navigating away discards unsaved edits, same as production today (no guard is added in UX-3A).

### 3.6 Alert — EXTEND (`appearance?: 'banner' | 'rule'`)
- **Preserve:** `variant`, `title`, `children`, and `role` (`alert` for error, else `status`).
- **Target (rule):** `.notice` + `.notice{Success|Warning|Error}`: 8px dot, then `title` in bold state color, then children in 13px `--color-text-muted`. `padding: 12px 0`, bottom hairline, `margin-bottom: 32px`. An optional action (e.g. Brief "Revise") sits right-aligned as a `size="sm"` secondary Button. Lucide icons aren't rendered in `rule`; the dot plus text carries the state.
- **Used for:** Brief approved / pending / changes requested; Plan save_failed / sync_failed.

### 3.7 Masthead: EXTEND
- **New props:** `masthead?: MastheadViewModel`, `artifactLabel?: string`, `showStatus?: boolean` (default false). The legacy discrete props (`studyName`, `researcherName`, `date`, `status`) are kept until CC-4, then removed.
- **Meta items** (only if the value is non-empty, in this order): Researcher `researcherName` · Requested by `requestorName` · Date `dateFormatted` (projection-formatted, never re-formatted) · Status `versionDisplay ?? statusDisplay` only when `showStatus`. Plan passes `showStatus` (shows "Current · v2"). Brief doesn't (the notice carries approval state).
- **Markup:** `<header class="masthead">` > `<h1 class="mastTitle"><span class="mastEyebrow">{artifactLabel}</span><span class="mastName">{masthead.studyName}</span></h1>` > `<dl class="mastMeta">` of `div.mastheadItem > dt.mastheadKey + dd.mastheadValue`. The READ-ONLY · SYSTEM text is visually hidden inside the header.
- **Sizes:** h1 44/46 (≥981), 36/40 (768–980), 32/36 (≤767). Meta stacks vertically ≤767.
- **A11y:** one h1 per page, accessible name "Research Brief {Study}". Existing tests that query `heading /Research Brief/i` still pass.
- **Prototype ref:** `W2Mast`.

### 3.8 FactsGrid: EXTEND
- **Props:** `facts: QuickFact[]` (the current `{label,value,sub?}` shape is a structural subset, so Plan's existing call still type-checks). Items with `exists === false` aren't rendered. Returns null when none remain.
- **Target:** `<dl class="factsGrid">` with `div.factItem > dt.factKey, dd.factValue, dd.factSub`. `auto-fit minmax(132px,1fr)`, gap 16/32, padding 24px 0, bottom hairline. Two columns ≤767.
- **Order** is the page's explicit array. Brief: method, participants, timeline, decisionDeadline, budget. Plan: method, participants, sessions, timeline.

### 3.9 DocumentSection: EXTEND
- **Preserve:** `sectionId`, `title`, `children`, `data-sec`.
- **Props:** `provenance?: FieldProvenance | FieldProvenance[] | LegacyProvenance` where `LegacyProvenance` = the current string union. `editable` is only read with a legacy value, and both are removed in CC-5. `sourceNote?: ReactNode`. Adds `id={"sec-" + sectionId}` and `aria-labelledby`.
- **Derived display (allowed, SPEC §9.2):** `locked = list.every(p => !p.editable)`, `inherited = list.every(p => p.authority === 'inherited')`. The page passes `sourceNote` when `inherited` (the link needs `studyPublicId`).
- **Markup:** `<section class="docSec" data-sec id aria-labelledby><div class="secHead"><h2 class="secHeading" id>{title}</h2>{locked && lock}<ProvenanceTag provenance={list}/></div>{sourceNote}{children}</section>`.
- **States:**
  - *default:* heading only; provenance at opacity 0.
  - *hover / focus-within:* provenance at opacity 1 (`--motion-fast`).
  - *read-only* (any authority, all `editable:false`): lucide `Lock` 14px `--color-text-muted`, `aria-hidden`, with `title="Read-only"`. Always visible.
  - *inherited:* lock plus `sourceNote` "From the approved brief" (12px muted, link).
  - *editing:* not mounted (production swaps to `ArtifactEditor`); see SPEC §8.
  - *flagged:* reserved `.secFlag`, not rendered in UX-3A.
- **Spacing:** `margin-top: 48px` (32 ≤767); head row → content 16px; no rules between sections.
- **Prototype ref:** `W2Sec`.

### 3.10 ProvenanceTag: EXTEND + RESTYLE
- **Props:** `provenance: FieldProvenance | FieldProvenance[] | LegacyProvenance`, plus the legacy `editable`. The text is the deduped `label`s joined " + ". The legacy map (`SYSTEM · READ-ONLY`, etc.) is only used for legacy values and is deleted in CC-5 (PF-22).
- **Target:** mono 11/16, 0.14em, uppercase, `--color-text-muted`, no background, `margin-left:auto`. Opacity 0, revealed per §3.9. ≤767: visually hidden.
- **Class names** `provCanonical` etc. are retired. One class, `provTag`, is used for every authority.
- **A11y:** always in the accessibility tree and never `aria-hidden`. It sits outside the `h2`.

### 3.11### 3.11 StructuredItemRows / StructuredItemRow / IdTag — RESTYLE
- **Preserve:** props, `data-stable-id`, `title` tooltip.
- **Target:** rows are separated by a top hairline, and the last row gets a bottom hairline. `padding: 12px 2px`, `gap: 16px`. The ID column is 56px, mono 11 600 0.05em, `--color-brand-deep`, with a `--color-brand-tint` chip on hover. Text is serif 15/24, and the `source` em is 13.5 muted italic. Priority is mono caps 11: Primary in `--color-brand-deep`, Secondary/Exploratory in `--color-text-muted`. ≤767: ID stacks above the text.
- **A11y:** the ID stays plain text; it isn't made focusable in UX-3A (no action attached).

### 3.12 DocumentTable — EXTEND
- **Preserve:** `columns`, `rows`, returns null when empty, `align` and `width`.
- **Add:** wrapper `div.tableScroll`; `td data-label={col.label}`; `column.emphasis?: boolean` → `td.cellEmphasis`; `align:'center'` → `td.cellCenter`; `stackOnNarrow?: boolean` (default true) → `table.stackedTable`.
- **Target:** header mono caps 11 with a 1px `--color-border-emphasis` rule under it. Cells are serif 14/22 `--color-text-meta`, horizontal hairlines only, no fills, no vertical borders. Tables with an empty header (Document information) render `thead` visually hidden.
- **≤767:** stacked label/value rows (reference CSS `.stackedTable`). 768–1180: horizontal scroll inside `.tableScroll` if it overflows.
- **A11y:** real `<table>`, `<th scope="col">`. Stacked mode keeps table semantics (CSS display change only). Chromium/Firefox keep table roles for `display:block` rows when `role` is set explicitly, so add `role="table"`, `role="row"` and `role="cell"` in stacked mode.

### 3.13 CollapsibleSection — EXTEND (`summary?: string`)
- **Target:** `<details class="collapsible"><summary><span class="collapsibleChevron" aria-hidden><ChevronRight size={12}/></span><span class="collapsibleTitle">{title}</span>{summary && <span class="collapsibleSummary">{summary}</span>}</summary><div class="collapsibleInner">…</div></details>`. The first collapsible after a section gets a 48px top gap and an emphasis top rule. The chevron rotates 90° when open.
- **Usage:** Validity checklist `summary={checks.length + " checks"}`, Research provenance `summary={objectives.length + " objectives · " + questions.length + " questions"}`, Document information: no summary. **Copy is proposed, not approved** (DDR-15).
- **A11y:** native details/summary. Summary text is the accessible name; no ARIA added.

### 3.14 ApprovalSection — RESTYLE
- **Preserve:** props and copy (PF-08 flagged).
- **Target:** hairline list, mono glyph `○` (`.approvalGlyph`) or `✓` (`.approvalCheckmark`) when `isApproved`. Note in serif 13.5 muted.
- **A11y:** add visually hidden text "Complete" / "Not complete" after each glyph (the glyph itself is `aria-hidden`).

### 3.15 SaveStateIndicator — EXTEND
- **Preserve:** `state` values `saved|dirty|saving|error`, `label` override, `aria-live="polite"`.
- **Add:** `syncPending` state; `savedAt?: string` (ISO). The default "saved" label = `Saved · {time(savedAt)}`, or just `Saved` when `savedAt` is absent. It never formats `new Date()` (PF-07).
- **Dot colors:** saved success · dirty brand · saving info (pulse; static with reduced motion) · error error · syncPending brand.
- **Mapping** from `useSavePipeline` is in SPEC §8.5.

### 3.16 ReviewRail: EXTEND
- **Props:** `approval: BriefApprovalState` (replaces `briefStatus`/`reviewerName`/`approvedAt`/`changeFeedback`; legacy props removed in CC-7), `checklist`, `onChecklistChange`, `onApprove`, `approving`, `onRequestChanges(comment)`, `requesting`. Names use `approval.reviewerDisplayName`, and `approval.approvedAt` is formatted in React (allowed, SPEC §1.1 rule 6). `isOverlay`/`onClose` are removed in CC-7.
- **Status source:** `approval.status` only (the `isPendingApproval`/`isApproved`/`isChangesRequested` booleans are equivalent; use the booleans). `status === null` → the rail isn't rendered.
- **Target:** eyebrow "Brief approval" → `h2.reviewStatus` (display 21/25) in the state color → body serif 13.5 → checklist (hairline list, 16px checkbox, 13px label; the 4 production keys and labels) → actions (Approve primary `sm`, disabled until all checked; Request changes secondary `sm`). Request-changes: `Textarea label="Feedback"` then Cancel/Submit. Changes-requested feedback renders as a 2px error-rule italic quote.
- **A11y:** status `h2` inside the tabpanel. Checklist is a `fieldset` with a visually hidden legend. The disabled Approve has `aria-describedby` pointing at the hint "Confirm all four checks to approve." (DDR-15).
- **Prototype ref:** `.rvstat`, `.rvacts`. `.rvlog` isn't built (no event data in `BriefApprovalState`).

### 3.17 Button — EXTEND (`size?: 'md'|'sm'`)
- **md:** unchanged 40px (forms, empty states). **sm:** 32px tall, `0 16px`, 13px 600; 40px ≤767.
- **Variants** (token-driven): primary ink/paper, hover `--color-text-strong`; secondary paper with an emphasis border, hover border muted. Disabled opacity 0.45. The focus ring comes from the global `:focus-visible` rule.
- **Approve** uses `primary` (production rule "commit actions use the primary ink button"). The prototype's green `.btn.good` is **not** adopted.

### 3.18 WorkspaceLayout — NEW (`study/workspace/WorkspaceLayout.tsx`)
Props: `nav: ReactNode` (LifecycleRail), `header: ReactNode` (ArtifactHeader), `rail?: ReactNode` (ContextRail), `navOpen: boolean`, `onNavClose: () => void`, `children` (document column).
- **Target:** `div.workspace` = `div#workspace-nav.navRegion` (lifecycle) + `div.column` [ header + `div.body` [ `div.canvas` (scroll owner) > children ] + rail ].
- **≤980:** navRegion becomes a drawer (RESPONSIVE §3) with a scrim, and SideNav's inverse rail renders *inside* the drawer to the left of the lifecycle panel (the SideNav column is hidden outside the drawer at ≤980).
- **A11y:** drawer = `role="dialog" aria-modal="true" aria-label="Study navigation"` while open at ≤980 only. Focus trap; Escape closes; focus returns to the nav toggle. The scrim click closes it. Outside the drawer breakpoint there is no dialog role.

### 3.19 ContextRail — NEW
See SPEC §10 for the full behavior. Props: `modes: {id: 'review'|'coaching'|'comments'; label: string; count?: number; content: ReactNode}[]`, `activeMode: string|null` (null = collapsed), `onModeChange(id|null)`, `defaultOpenAt?: 'xl'`.

## 4. Projection binding (exact view-model paths per surface)

Pages pass these paths through. Nothing on this list is computed in React.

### 4.1 Shared
| Surface | Brief (`vm: BriefViewModel`) | Plan (`vm: PlanViewModel`) |
|---|---|---|
| Header crumb / lifecycle study name | `vm.study.name` | `vm.study.name` |
| Header GitHub link | `vm.githubUrl` | `vm.githubUrl` |
| Masthead | `vm.masthead` (showStatus false) | `vm.masthead` (showStatus true → `versionDisplay`) |
| Notice | `vm.approval` (booleans + `reviewerDisplayName`, `changeFeedback`, `approvedAt`) | — (save/sync notices come from `useSavePipeline`) |
| Review rail | `vm.approval` | — |
| Document information | `vm.artifact.createdAt/model/templateId/templateVersion/path`, `vm.study.name`; rows with empty values omitted (DDR-16) | same (already filters) |

### 4.2 Existence gates
| Section | Brief render condition | Plan render condition |
|---|---|---|
| Summary | always (quick facts inside) | always (fallback copy "Plan generated. See sections below." when `!sections.summary.exists`) |
| Problem | `sections.problemNarrative.exists \|\| barriers.exists` | — |
| Background | — | `sections.background.exists` |
| What we'll learn / Objectives | `objectives.exists \|\| questions.exists` | `objectives.exists` |
| Research questions (Plan) | — | `questions.exists` |
| Method | `quickFacts.method.exists \|\| sections.methodProse.exists` | always (as today) |
| Participants | `participantSegments.exists \|\| sections.participantsProse.exists` | always (as today) |
| Out of scope | `sections.outOfScope.exists` | — |
| Timeline | `timeline.exists \|\| timeline.summary.startDate \|\| quickFacts.decisionDeadline.exists` | `timeline.exists` |
| Deliverables | — | `sections.deliverables.exists \|\| deliverablesTable?.exists` |
| Risks | `risks.exists` | `risks.exists` |
| Brief commitments | — | `commitments.exists` |

These match the current page conditions and just switch to the `exists` flags.

### 4.3 Section → `provenance` array (render order; include only entries whose data renders)
| Section | Brief | Resulting label today | Plan | Resulting label today |
|---|---|---|---|---|
| Summary | `[sections.summary.provenance]` | GENERATED · EDITABLE | `[sections.summary.provenance]` | GENERATED · EDITABLE |
| Problem | `[sections.problemNarrative.provenance, barriers.provenance]` | GENERATED · EDITABLE + CANONICAL · READ-ONLY | — | — |
| Background | — | — | `[sections.background.provenance]` | GENERATED · EDITABLE |
| What we'll learn / Objectives | `[objectives.provenance, questions.provenance]` | CANONICAL · READ-ONLY (lock) | `[objectives.provenance]` | INHERITED · READ-ONLY (lock + source) |
| Research questions | (inside above) | — | `[questions.provenance]` | INHERITED · READ-ONLY (lock + source) |
| Method | `[sections.methodProse.provenance]` | GENERATED · EDITABLE | `[sections.methodApproach, sessionFormat, dataCollection].provenance` (existing only) | GENERATED · EDITABLE |
| Participants | `[participantSegments.provenance, sections.participantsProse.provenance]` | GENERATED · EDITABLE | `[sections.participantsProse.provenance]` | GENERATED · EDITABLE |
| Out of scope | `[sections.outOfScope.provenance]` | GENERATED · EDITABLE | — | — |
| Timeline | `[timeline.provenance]` | COMPUTED · READ-ONLY (lock) | `[timeline.provenance]` | INHERITED · READ-ONLY (lock + source) |
| Deliverables | — | — | `[sections.deliverables.provenance]` or `[deliverablesTable.provenance]` | GENERATED · EDITABLE |
| Risks | `[risks.provenance]` | GENERATED · READ-ONLY (lock) | `[risks.provenance]` | GENERATED · READ-ONLY (lock) |
| Brief commitments | — | — | `[commitments.provenance]` | READ-ONLY · SYSTEM (lock) |
| Approval (Brief) | none (`ApprovalSection` keeps its internal label) | — | — | — |

The "Resulting label" columns are what `workspace-projection.ts` produces at `7f0366d8`. They're for QA only. Tests assert against `vm.*.provenance.label`, not these literals.

### 4.4 Structured rows and tables
| Surface | Path |
|---|---|
| Barriers rows | `vm.barriers.items` → `{id, barrier → text, source}` |
| Objectives rows | `vm.objectives.items` → `{id, objective → text}` |
| Questions rows | `vm.questions.items` → `{id, question → text, priority}` |
| Brief participant segments table | `vm.participantSegments.items` (Segment / Count *emphasis, center* / Rationale). Fallback prose `vm.participantSegments.approach`. Recruitment `vm.recruitmentSources` |
| Brief risks table | `vm.risks.items` (Risk / Source / Mitigation) |
| Plan risks table | `vm.risks.items` (Risk / Likelihood *center* / Mitigation) |
| Timeline table | `vm.timeline.phases` (Brief: Phase / Dates; Plan: + Duration *center*) |
| Research period (Plan) | `vm.timeline.summary.dateRange`, `.duration` |
| Brief commitments (Plan) | `vm.commitments.items` |
| Discovery sources (Brief, inside Research provenance) | `vm.discoverySources?.items` |
| Research provenance counts | `vm.objectives.count`, `vm.questions.count`, `vm.barriers.count`, `vm.quickFacts.method`, Brief `vm.quickFacts.budget` / Plan `vm.budget` |
| Plan compensation | `vm.compensation` (render only if non-null; contract `unsupported`) |
