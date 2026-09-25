# Component Deltas

> **MATCH THE APPROVED CD COMPOSITION. DO NOT MATCH THE CURRENT PRODUCTION COMPOSITION.**
> **KEEP means visually equivalent already, not merely architecturally reusable.** A component can be reused in implementation while its rendered composition is RECOMPOSE/REPLACE. Every matrix in this package lists **Implementation reuse** and **Visual action** as separate columns.
> **Correction (2026-09-24, post-VC-1):** the first version of this handover marked the SideNav and lifecycle panel KEEP. That was wrong for the lifecycle panel and incomplete for the app rail and header. See §0 and LIFECYCLE_NAV_CONVERGENCE.md.

Action types: **KEEP · RESTYLE · REPOSITION · RECOMPOSE · REPLACE · ADD · REMOVE**.
The target CSS for `document.module.css` is the complete file `reference/document.module.target.css`. Replace the production file wholesale; don't merge.

## 1. Composition matrix (revised)

| Surface | Current production | Approved CD target | Implementation reuse | Visual action | Phase |
|---|---|---|---|---|---|
| Workspace shell | 64 + 224 dark rails, flex main | same | AppShell workspace variant | KEEP | — |
| App rail: items | Home, Projects, Studies, Search, Ask Qori, Work Queue | Home, Projects, Studies, Ask Qori | SideNav `navItems` (filtered in inverse variant) | RECOMPOSE (remove Search, Work Queue) | VC-2A |
| App rail: bottom | divider, Admin, avatar | spacer, (Learn), Admin, avatar | SideNav footer | REPOSITION (Admin to the bottom; Learn omitted) | VC-2A |
| App rail: tiles/marker | 40px tiles, brass marker | same | — | KEEP | — |
| Lifecycle: structure | flat 7 stages from `computeLifecycleNodes` | 5 groups, 15 items | LifecycleRail + new `workspaceLifecycle.ts` config; `computeLifecycleNodes` still supplies the Plan lock | **RECOMPOSE** | VC-2A |
| Lifecycle: group headings | none | mono caps headings | new `.grp` | ADD | VC-2A |
| Lifecycle: Overview row | row 1, `aria-current="step"` | none (study name links to overview) | LifecycleRail study head | REMOVE row, REPOSITION to name link | VC-2A |
| Lifecycle: Sources/Evidence/Findings/Outputs | locked rows, no routes | not present | — | REMOVE | VC-2A |
| Lifecycle: unimplemented CD items | — | 13 dimmed placeholders | config `kind:'placeholder'` | ADD (non-interactive) | VC-2A |
| Lifecycle: leading icons, hint lines | present | none | — | REMOVE | VC-2A |
| Lifecycle: active | brand-tint fill + left rule | left rule + brass gradient, label 600 | `.nvOn` | RESTYLE | VC-2A |
| Lifecycle: ≤1023 horizontal leak | fixed | vertical | — | (landed VC-1) | VC-1 ✓ |
| Header: status indicator | save state only during activity | persistent dot + status label | SaveStateIndicator (new `status` usage) | ADD | VC-2A |
| Header: Review toggle | absent on Brief | icon toggle after actions | ArtifactHeader `railToggles` | ADD | VC-2A |
| Header: bar + tabs | paper, stretched tabs | same | ArtifactHeader | KEEP (VC-1 landed) | VC-1 ✓ |
| Document width | centered 640 | same | document.module.css | KEEP (VC-1 landed) | VC-1 ✓ |
| Status notice | `Alert rule` | same | Alert | KEEP | — |
| Masthead | sans title, visible system chip, 3 rules | editorial block | Masthead | RECOMPOSE | VC-2B |
| Metadata row | sans keys | mono caps keys | Masthead | RESTYLE | VC-2B |
| Quick Facts | boxed cards | open `<dl>` row | FactsGrid | REPLACE | VC-2B |
| Section header / separation | sans 22/700, ruled | display 27/500, whitespace | DocumentSection | REPLACE | VC-2B |
| Prose / h3 / kv | sans | serif / mono label | blockProse | REPLACE | VC-2B |
| Structured rows / IDs | grey 13px IDs | 56px brass-deep ID column | StructuredItemRow(s), IdTag | RESTYLE | VC-2B |
| Priority | pill | mono text tag | StructuredItemRow | REPLACE | VC-2B |
| Provenance | loud chips | quiet, hover reveal | ProvenanceTag | RESTYLE + REPOSITION | VC-2B |
| System block (view) | tinted box + label | none | FactsGrid, Masthead | REMOVE | VC-2B |
| Tables | sans, 2px rule | serif, mono header, 1px | DocumentTable | RESTYLE | VC-2B |
| Collapsibles | bordered boxes | ruled rows + chevron | CollapsibleSection | REPLACE | VC-2B |
| Approval checklist (doc) | unruled | ruled, mono glyphs | ApprovalSection | RESTYLE | VC-2B |
| Editor content | CC-6 | same | ArtifactEditor | KEEP | — |
| Editor toolbar | paper (VC-1) | same | EditToolbar | KEEP | VC-1 ✓ |
| Context rail shell | 344 / strip / overlay / sheet | same (Review tab only; DDR-05) | ContextRail | KEEP | — |
| Review panel | stacked form | status hierarchy, ruled checklist, sm action row | ReviewRail | RECOMPOSE | VC-3 |
| Dead styles | BriefDocument.module.css review copy; legacy doc classes | — | — | REMOVE | VC-2B |

## 2. Per-file deltas

### `frontend/src/components/study/document/document.module.css`: REPLACE
Replace it with `reference/document.module.target.css`. Class names are unchanged, so no TSX edits are needed for styling. The new classes `srOnly`, `tableScroll`, `cellCenter`, `cellEmphasis`, `stackedTable`, `collapsibleChevron`, `collapsibleTitle` and `collapsibleSummary` need the small TSX changes below.

### `Masthead.tsx`: RECOMPOSE (markup only)
- Change `<span className={styles.systemLabel}>READ-ONLY · SYSTEM</span>` to `className={styles.srOnly}`.
- No prop changes.

### `FactsGrid.tsx`: REPLACE composition (markup only)
- Remove the `<div className={styles.systemBlock}>` wrapper. Render `<dl className={styles.factsGrid}>` directly.
- Put `<span className={styles.srOnly}>READ-ONLY · SYSTEM</span>` as the first child of a `<div>` wrapper that has no class, or drop it if a test doesn't need it. The `<dl>` must not contain a `<span>`, since that's invalid content.
- Filtering (`exists`) is unchanged.

### `CollapsibleSection.tsx`: EXTEND markup
```tsx
<details className={styles.collapsible}>
  <summary>
    <span className={styles.collapsibleChevron} aria-hidden="true"><ChevronRight size={12} /></span>
    <span className={styles.collapsibleTitle}>{title}</span>
    {summary && <span className={styles.collapsibleSummary}>{summary}</span>}
  </summary>
  <div className={styles.collapsibleInner}>{children}</div>
</details>
```
`summary?: string` is optional; pages may pass it later (copy is DDR-15).

### `DocumentTable.tsx`: EXTEND markup
- Wrap in `<div className={styles.tableScroll}>`.
- Add `className={styles.stackedTable}` on `<table>` (unless `stackOnNarrow === false`).
- Add `data-label={col.label}` on each `td`.
- `align:'center'` → `className={styles.cellCenter}`.
- Empty-label header rows (Document information) → `<thead className={styles.srOnly}>`.

### `LifecycleRail.tsx` / `LifecycleRail.module.css`: RECOMPOSE (VC-2A). The full spec is in LIFECYCLE_NAV_CONVERGENCE.md §1 and §4. The leak fix below landed in VC-1.
- Wrap the entire legacy `@media (max-width:1023px)` block's selectors with `:not(.railInverse)`. Concretely: `.rail:not(.railInverse)`, `.rail:not(.railInverse) .list`, `.rail:not(.railInverse) .list::before`, `.rail:not(.railInverse) .node`, `.rail:not(.railInverse) .hint`, `.rail:not(.railInverse) .currentMarker`.
- `.railInverse { padding: 0 0 var(--space-5) }` already exists; add `padding-top: 0` explicitly, because the base `.rail` padding (16px 0) currently wins for `padding-top`.
- In the ≤980 drawer, `.railInverse` stays 224px and the drawer is 288px (64 + 224).

### `SideNav.tsx` (inverse variant): RECOMPOSE (VC-2A)
- The inverse variant renders `navItems.filter(i => ['/', '/projects', '/studies', '/ask'].includes(i.to))`, in that order. The default (non-workspace) variant is unchanged.
- Footer: `<span class="spacer"/>` (flex 1), then Admin (owners only, same tile), then the avatar/UserMenu. Remove `.dividerInverse` from the inverse render.

### `ArtifactHeader.tsx`: ADD status + Review toggle (VC-2A)
- New optional prop `status?: { tone: 'neutral'|'warning'|'success'|'error'; label: string }`.
- Render rule: if the `saveState` node is non-null, render `saveState`; otherwise render `<span class="saveState"><span class="saveDot saveDot{Tone}"/>{label}</span>` in the same slot. Same classes, so no new CSS.
- Brief passes it from `vm.approval`:
  - pending: warning "Pending approval"
  - changes requested: error "Changes requested"
  - approved: success "Approved"
- Plan passes `{ tone: 'neutral', label: vm.masthead.versionDisplay }` when present.
- Order after the GitHub link and rule: actions first, then `railToggles` (CD order).
- BriefDocument passes `railToggles={<button class="iconButton" aria-label="Review panel" aria-pressed={railMode==='review'} aria-controls="context-rail" onClick={toggle}><ShieldCheck size={16} aria-hidden/></button>}` whenever `showRail` is true. This makes the rail sheet reachable at ≤767.
- `.saveDotNeutral { background: var(--color-text-disabled) }` is the only CSS addition.

### `ArtifactHeader.module.css`: RESTYLE (VC-1 landed)
- `.header { background-color: var(--color-paper); gap: var(--space-3); padding: 0 var(--space-5); }`
- ≤767: `.header { padding: 0 var(--space-3); gap: var(--space-2) }`, and hide `.githubLink` and `.rule`.

### `document.module.css` → artifact tabs (inside the target file)
Tabs stretch to the full 52px (`align-self: stretch` on `.artifactTabs` and `height:100%` on the link). Rest 400, active 600, underline `--color-indicator` 2px with `margin-bottom:-1px`.

### `editor.module.css`: RESTYLE
- `.toolbar { background-color: var(--color-paper); }`
- Nothing else changes.

### `BriefDocument.module.css`: REMOVE
Delete every rule except `.inlineFeedback`. Nothing on the page references the others (they were superseded by `ReviewRail.module.css` in CC-7). Verify with `grep -n "styles\.\(review\|checklist\|feedback\)" src/pages/BriefDocument.tsx`.

### `PlanDocument.module.css`: KEEP (`.emptyCanvas` only)

## 3. Review rail: current vs target

| Aspect | Current (`ReviewRail.module.css`) | Target |
|---|---|---|
| Width | 344 (ContextRail) | 344: KEEP |
| Tab row | 48px, 13px tabs, brass-deep 2px underline, close ×; matches | KEEP |
| Body padding | `16 16 48` | `20 20 48` (header optical alignment with the canvas's 48px top) |
| Eyebrow | 11px 600 0.14em UI sans | 11px **mono** 600 0.14em caps muted |
| Status heading | Cormorant 21/25 500. Pending = `--color-text` | Cormorant 21/25 500. Pending = `--color-warning` (brass-text). Approved = success. Changes = error |
| Status → body | 8px | 4px eyebrow→status, 8px status→body |
| Body copy | serif 13.5/22 meta, full width | serif 13.5/22 `--color-text-meta`, `max-width: 32ch` |
| Checklist | flex column, gap 8, no rules | ruled list: top hairline, each item 8px 0 padding + bottom hairline, 16px margin-top, 13px UI label, 16px checkbox |
| Actions | vertical column. Approve `md` 40px full width, Request changes `sm` | **one row**, gap 8, `padding: 16px 0`, top hairline (none when directly after the checklist). Approve **`size="sm"`** primary, auto width. Request changes `sm` secondary |
| Approve hint | 12px below actions | 12/18 muted, 8px below the action row; shown only while disabled |
| Request-changes form | Textarea, then column of Cancel/Submit | Textarea label "Feedback". Row: Cancel (secondary sm) left, Submit (primary sm) right |
| Approved | status + body | status + body; no controls |
| Changes requested | status + body + 2px error-rule italic quote | same; quote 13.5/22 italic `--color-text-meta`, 12px left padding |
| Rules | none | tab row bottom; checklist rules; actions top rule. No card borders anywhere |

**Target CSS (replace `ReviewRail.module.css` rules of the same name):**
```css
.reviewRail{padding:var(--space-1) var(--space-1) 0}
.reviewEyebrow{margin:0;font:var(--weight-semibold) var(--type-label-size)/var(--type-label-line) var(--font-mono);letter-spacing:var(--type-label-track);text-transform:uppercase;color:var(--color-text-muted)}
.reviewStatus{margin:var(--space-1) 0 var(--space-2);font:var(--weight-medium) var(--type-rail-status-size)/var(--type-rail-status-line) var(--font-display);color:var(--color-text)}
.reviewStatusWarning{color:var(--color-warning)}
.reviewBody{margin:0;max-width:32ch;font:var(--type-doc-note-size)/var(--type-doc-note-line) var(--font-serif);color:var(--color-text-meta)}
.reviewChecklist{border:0;padding:0;margin:var(--space-4) 0 0}
.checklistList{list-style:none;margin:0;padding:0;display:block;border-top:1px solid var(--color-border)}
.checklistItem{display:flex;gap:var(--space-2);align-items:flex-start;padding:var(--space-2) 0;border-bottom:1px solid var(--color-border);font:var(--type-ui-size)/var(--type-ui-line) var(--font-ui);color:var(--color-text);cursor:pointer}
.checklistItem input[type='checkbox']{width:16px;height:16px;margin:2px 0 0;accent-color:var(--color-text);flex-shrink:0}
.reviewActions{display:flex;flex-direction:row;flex-wrap:wrap;gap:var(--space-2);padding:var(--space-4) 0;border-top:1px solid var(--color-border)}
.reviewChecklist + .reviewActions{border-top:0}
.reviewHint{margin:0;font:12px/18px var(--font-ui);color:var(--color-text-muted)}
.reviewFeedback{margin:var(--space-3) 0 0;padding:0 0 0 var(--space-3);border-left:2px solid var(--color-error);font:italic var(--type-doc-note-size)/var(--type-doc-note-line) var(--font-serif);color:var(--color-text-meta)}
```
`ContextRail.module.css`: `.railBody { padding: var(--space-5) var(--space-5) var(--space-7); }`.
`ReviewRail.tsx`: Approve `<Button size="sm">`, Submit `<Button size="sm">`. In the form, render the action row with Cancel first and Submit second, in the same row. No logic changes.

## 4. Dead legacy classes to remove from document.module.css
`.pageHead`, `.pageHeadLeft`, `.pageTitle`, `.pageMeta`, `.pageActions`, `.githubLink` (document copy), `.reviewRail`, `.reviewCard`, `.reviewCardHeader`, `.reviewCardBody`, `.reviewCardText`, `.reviewRailNote`, `.railCloseButton`, `.railToggle`, `.overlay`, `.editableBlock`, `.provCanonical`, `.provGenerated`, `.provSystem`, `.provInherited`.

Before deleting, run `grep -rn "docStyles\.\(pageHead\|reviewCard\|railToggle\|editableBlock\|prov[A-Z]\)" frontend/src`. Any hit that isn't on a workspace route gets the class moved into that page's module, not deleted. The target file already omits them.
