# Component Deltas

Action types: **KEEP · RESTYLE · REPOSITION · RECOMPOSE · REPLACE · REMOVE**.
The target CSS for `document.module.css` is the complete file `reference/document.module.target.css`. Replace the production file wholesale; don't merge.

## 1. Composition matrix

| Surface | Current production | Target | Action |
|---|---|---|---|
| Workspace shell | 64 + 224 dark rails, flex main | same | KEEP |
| SideNav inverse | 64px icon rail | same | KEEP |
| Lifecycle panel | dark 224px; turns horizontal ≤1023 | vertical at all widths | REMOVE leak + RESTYLE padding |
| Artifact header | white bar, ink tab underline | paper bar, brass-deep underline, stretched tabs | RESTYLE |
| Document width | 840px, left-aligned, flex wrapper | 640px measure, centered, 48px pad | REPLACE |
| Status notice | `Alert rule` | same, spacing 32 below | KEEP (+ verify spacing) |
| Masthead | sans 28/700 title, visible system chip, 3 rules | editorial eyebrow + 44px display title, meta between 2 hairlines | RECOMPOSE |
| Metadata row | sans keys 700 | mono caps keys, muted values | RESTYLE |
| Quick Facts | tinted box + bordered cards | open `<dl>` row between hairlines | REPLACE |
| Section header | sans 22/700 | Cormorant 27/500 + lock + right-aligned provenance | REPLACE (type) + RESTYLE |
| Section separation | bottom rule + padding | 48px whitespace, no rule | REPLACE |
| Prose | 15px sans | Source Serif 4 16/28, 66ch | REPLACE |
| Subheading (h3) | 18px sans 700 | mono 11 caps 0.16em muted | REPLACE |
| kv paragraph | serif + sans bold key | same family pair, sizes per TYPOGRAPHY | RESTYLE |
| Structured rows | hairlines, grey 13px IDs | 56px brass-deep mono ID column | RESTYLE |
| Priority | colored pill | mono caps text tag | REPLACE |
| Provenance | colored chips, always on | quiet mono, hover/focus reveal | RESTYLE + REPOSITION |
| System block (view) | tinted rounded box + visible label | no box; label visually hidden | REMOVE |
| Tables | sans 13, 2px header rule | serif cells, mono header, 1px emphasis rule | RESTYLE |
| Collapsibles | bordered rounded boxes | grouped hairline rows + chevron | REPLACE |
| Approval checklist (doc) | serif list, no rules | hairline list, ○/✓ mono glyphs | RESTYLE |
| Save state | 8px dot, 12px | 7–8px dot, 12px | KEEP |
| Editor content | CC-6 styles | same | KEEP |
| Editor toolbar | white pill | paper pill | RESTYLE |
| Context rail shell | 344 docked / strip / overlay / sheet | same | KEEP |
| Review panel | stacked form, full-width md Approve | status hierarchy, ruled checklist, inline sm action row | RECOMPOSE |
| `BriefDocument.module.css` review copy | dead duplicate styles | — | REMOVE |
| `.pageHead`, `.reviewRail/.reviewCard*`, `.railToggle`, `.editableBlock` in document.module.css | legacy, unused on workspace routes | — | REMOVE (confirm with `grep` first; see §4) |

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

### `LifecycleRail.module.css`: REMOVE leak + RESTYLE
- Wrap the entire legacy `@media (max-width:1023px)` block's selectors with `:not(.railInverse)`. Concretely: `.rail:not(.railInverse)`, `.rail:not(.railInverse) .list`, `.rail:not(.railInverse) .list::before`, `.rail:not(.railInverse) .node`, `.rail:not(.railInverse) .hint`, `.rail:not(.railInverse) .currentMarker`.
- `.railInverse { padding: 0 0 var(--space-5) }` already exists; add `padding-top: 0` explicitly, because the base `.rail` padding (16px 0) currently wins for `padding-top`.
- In the ≤980 drawer, `.railInverse` stays 224px and the drawer is 288px (64 + 224).

### `ArtifactHeader.module.css`: RESTYLE
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
