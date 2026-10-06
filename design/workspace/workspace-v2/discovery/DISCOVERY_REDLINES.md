# Qori Discovery Workspace — Visual Redlines

Status: APPROVED (companion to DISCOVERY_WORKSPACE_DESIGN_SPEC.md, same authority)
Role: Exact visual values for every NEW Discovery component and page composition
Reference screens: `screens/00 Index.html` (static hi-fi), `screens/20 Component Redlines.html` (component states), `screens/discovery.css` §B (values below, as CSS)
Implementation rule: Values here are final. Where a value is missing, use the existing Workspace component/token named in the row. Never invent a new color, radius or type size. Where a design need conflicts with API truth, stop and raise it (see §F).

---

## 0. Ground rules

- **Tokens:** use production `tokens.css` names in workspace scope (`:root[data-qori-surface="workspace"]`). The reference CSS defines the same names with v2 values only so the screens render.
- **New tokens (layout only, add to block 1):**
  - `--layout-discovery-wide: 1040px`: survey stage content measure
  - `--layout-stage-strip: 64px`: stage strip height at ≥981
  - `--layout-match-list: 320px`: match list column at ≥1181
- **No new colors.** Every color below is an existing token.
- **Type floor:** 11px (TYPOGRAPHY.md). Role names below refer to TYPOGRAPHY.md:
  - *UI 13/20* = `--font-ui` 13px / 20px
  - *mono caps 11* = `--font-mono` 11/16, weight 600, tracking 0.14em, uppercase
  - *serif 15/24* = `--font-serif`
  - *display 27/31* = `--font-display`
- **Spacing:** `--space-1` 4 · `--space-2` 8 · `--space-3` 12 · `--space-4` 16 · `--space-5` 24 · 32 · 48. 32 and 48 follow GEOMETRY.md. Use the existing names.
- **Radii:**
  - 3 `--radius-xs`: markers, crumbs, kbd
  - 4: inputs, chips, sample chips, notes
  - 6 `--radius-md`: buttons, drop zone, segmented options, bulk box, option group, split container
  - 8 `--radius-lg`: popovers
  - 10 `--radius-xl`: bottom sheet top corners
  - 0: document surfaces (tables, rows, sections)
- **Icons:** lucide.
  - 12px in badges, glyphs and stage glyphs.
  - 14px in buttons and inline notes.
  - 16px in alerts, drop zones and file rows.
  - Stroke 2 (lucide default). All decorative icons get `aria-hidden`.
- **Focus:** `2px solid --color-focus`, offset 2, everywhere. Exceptions are rows, list items and stage items, which use offset −2 (inset).
- **Disabled:** buttons opacity .45 with `cursor:not-allowed` (existing Button). Every disabled gate shows its reason as visible text next to it, not only in `title`.
- **Breakpoints:** xl ≥1181 · lg 981–1180 · md 768–980 · sm ≤767 (`WORKSPACE_BREAKPOINTS`).

---

## A. Page compositions

| Page | Header (ArtifactHeader 52) | Below header | Canvas measure | Rail default |
|---|---|---|---|---|
| Hub `/discovery` | crumb `{Project} › Discovery` · Comments | — | doc 640 (+48 gutters) | closed |
| Intake `/discovery/new/:type` | crumb `… › Add {type}` | survey only: stage strip | doc 640 | none |
| Run `/discovery/runs/:id` | crumb `… › {topic}` · tabs Report/Sources/Extracted · StatusBadge · Evidence (DISC-6) · Comments · overflow | survey only: stage strip | doc 640 | closed |
| Survey stage Fields / Privacy / Matches | crumb · stage StatusBadge (expiry) · Comments | stage strip | wide 1040 | closed |
| Survey stage Groups / Summary readiness | same | stage strip | doc 640 | closed |
| Synthesis select | crumb `… › Synthesis › New` | — | doc 640 | none |
| Synthesis document | crumb · History menu (qt sm) · Evidence · Comments | — | doc 640 | closed; opens on marker |
| Brief intake | crumb `Research Brief › New brief` | — | doc 640 | none |

**Hub masthead block**, top to bottom:
1. Eyebrow "Discovery". Mono eyebrow 11, `--color-brand-deep`.
2. H1 = project name. Display 44/46.
3. Meta row: "SCOPE Project discovery · shared by all studies in {Project}".
4. 12px gap, then the status line. UI 13/20 `--color-text-muted`. Counts in 600 `--color-text-meta`. Separators "·" in `--color-text-quiet`. Each segment is `nowrap`.
5. 16px gap, then the action row (gap 8):
   - **Add evidence ▾**: primary Button 32 high, menu popover radius 8, `--elevation-md`, min-width 248. Items are UI 13 600 plus a 12 muted sub-line, padding 8 12.
   - **Synthesize across sources**: quiet Button (DISC-5).
6. Sections:
   - Numbered `h2` (display 27/31).
   - Section number: mono 11 600 `--color-text-muted`, set before the title, gap 12.
   - Count: mono 11 muted, after the title.
   - Provenance tag: right-aligned and **always visible** on Discovery pages. Brief/Plan hide it at rest; Discovery shows it.

**Run masthead:**
- Eyebrow = type + static marker (gap 12).
- H1 = topic.
- Meta row: Updated · Version · template id (mono 11 muted) · Provenance tag right-aligned.
- FactsGrid, unchanged.

**Survey stage head** (above stage content):
- Flex row, wraps.
- Left: `h2` display 27/31, then a serif 15/24 `--color-text-meta` description, max 66ch.
- Right: stage meta (StatusBadge or UI 13 count).
- 24px bottom margin.

**Gate bar** (survey stages):
- Sticky to the bottom of the scroll area, `--z-sticky`.
- Background `--color-paper`. Top border 1px `--color-border-emphasis`. Padding 16 0. Gap 16.
- Reason text: UI 12/16 muted, with counts in 600 `--color-text-meta`.
- The primary gate button sits at the right.

---

## B. New components

### B1 DiscoveryMarker (extends `IdTag`)
| Property | Static (DISC-3) | Button (DISC-6) |
|---|---|---|
| Type | mono 11/16 600, 0.05em, `--color-brand-deep` | same |
| Box | none (IdTag) | height 20, padding 0 6, radius 3, inset 1px `--color-border-emphasis`, bg `--color-paper` |
| Hover | — | bg `--color-brand-tint`, border `--color-brand` |
| Focus | — | 2px `--color-focus`, offset 2 |
| Selected (`aria-pressed`, the rail is showing this artifact) | — | bg `--color-brand-soft`, border `--color-brand-deep` |
| Unavailable (deleted artifact) | `--color-text-muted`, strikethrough `--color-text-quiet`, never a button | same |
| Pre-Ready | "—" mono 11 `--color-text-quiet`, `aria-label="No marker yet"` | same |
| Group | inline-flex, gap 4, wraps | same |

- One treatment for D, S, V and X. There's no per-type color: the letter carries the type.
- Accessible name: "Evidence from D1, desk research: {run name}".
- A marker is rendered as a button **only** when the API returns a resolvable target.

### B2 StatusBadge: Discovery keys (extend `StatusBadge.tsx` config)
| Key | Glyph (12) | Text color | Default text |
|---|---|---|---|
| `ready` | Check | `--color-success` | Ready |
| `processing` | LoaderCircle (spins; static under reduced motion) | `--color-info` | Analyzing |
| `needs_review` | 6px dot `--color-brand` | `--color-brand-text` | {Stage} · your review |
| `expiring` | Clock | `--color-brand-text` | Expires in {h m} |
| `failed` | TriangleAlert | `--color-error` | Failed · {reason} |
| `stale` | 8px ring, 1.5px `--color-brand` | `--color-brand-text` | Out of date |
| `superseded` | History | `--color-text-muted` | Superseded |

- Type: UI 12/16 500.
- Gap 6.
- **No background pill.** This matches the v2 header status style.

### B3 Lifecycle Discovery rows (extend `LifecycleRail` inverse + `workspaceLifecycle.ts`)
- **Rows:** All evidence · Desk Research · Stakeholders · Surveys · Synthesis. Geometry is LIFECYCLE_NAV_CONVERGENCE §1, unchanged.
- **Count:** after the label. Mono 11/16 500, 0.06em, `--color-text-inverse-quiet`. Hidden when 0 or loading.
- **Needs-review dot:**
  - 6×6, `--color-indicator-inverse`, after the count, gap 8 (row gap).
  - sr text: ", needs your review".
- **Synthesis glyph:**
  - Current: Check 12 `--color-success-inverse`.
  - Stale: ring 8, 1.5px `--color-indicator-inverse`, sr ", out of date".
  - None: nothing.
- **Before DISC-5:** Synthesis is a dim placeholder (`kind:'placeholder'`).
- Discovery rows never show a lock.

### B4 Hub status line + actions
See §A.

### B5 ReviewQueue
| Part | Value |
|---|---|
| Row | grid `minmax(0,1fr) minmax(0,1.15fr) auto`, gap 16, min-height 56, padding 12 2, hairline top (last also bottom) |
| Object | type line mono caps 11 `--color-text-muted` · name UI 13/20 600 `--color-text` |
| Gate | UI 13/20 `--color-text-meta`, glyph 12, gap 8. Expiring `--color-brand-text` + Clock; failed `--color-error` + TriangleAlert |
| Action | UI 13 600 link ("Continue →", "Resolve →"). The row itself is not a target |
| Sort | expiring → failed → gate pending; ties by updated desc |
| ≤980 | grid `1fr auto`; gate goes to row 2; action spans both rows |
| Empty | section not rendered |

### B6 RunLedgerTable (composition of DocumentTable)
| Part | Value |
|---|---|
| Table | `table-layout:fixed`; cols 56 / 1fr / 184 / 108 |
| Header | DocumentTable th (mono caps 11, emphasis bottom border, 8 bottom padding) |
| Group row | padding 24 2 8, mono caps 11 muted, emphasis bottom border; count after label (0.06em, `--color-text-quiet`) |
| Cell | padding 12 12 12 2, hairline bottom, top-aligned |
| Run name | serif 15/22 600 `--color-text`, no underline at rest; hover underline `--color-brand` (offset 2.5) |
| Run meta | UI 12/16 `--color-text-muted`, margin-top 2: "{n} files · {date}" / "1 CSV · {n} responses · {date}" / "started {relative}" |
| Status cell | StatusBadge, padding-top 15 (baseline-aligned with the name) |
| Used by | UI 12/16 `--color-text-meta`: "X2 · Brief"; "—" when none |
| Collapse | >10 rows per group: show 10 + row "Show all {n}" (text button UI 12 600) |
| Filter | >15 runs: Input h32, max 240, above the table, gap 12 |
| ≤980 | rows become grid `48px 1fr auto`, gap 4 12; Used by on line 2 |

### B7 Hub section blocks
- **State paragraph:** serif 16/28, max 66ch.
- **Focus list:** rows padding 8 0, hairline top, grid `24px 1fr auto`. The counter is mono 11 600 muted. Markers sit right.
- **Stale rule:**
  - 2px top border `--color-brand`, padding-top 12.
  - UI 13/20 `--color-text-meta`.
  - Contents: StatusBadge `stale` + reason + "Synthesize again…" link.
- **Knowledge gaps:** existing StructuredItemRow (ID col 56 holds the marker). Show 5 rows, then "Show {n} more" text button. Provenance tag "GENERATED · FROM SOURCE-SPECIFIC RUNS".
- **Into the brief:**
  - State paragraph, then an info-tone Notice for post-Brief evidence, then a quiet Button "Open brief" / "Start brief".
  - "The brief isn't informed by Discovery." uses the same style as any other state paragraph.

### B8 FileDropList
| State | Zone | Notes |
|---|---|---|
| Rest | min-height 112, padding 24, 1px **dashed** `--color-border-emphasis`, radius 6, bg `--color-paper`, column, gap 8, centered | line 1 UI 13/20 meta + Upload 16 · "Choose files" quiet Button sm (h28) · hint UI 12/16 muted |
| Drag-over | border **solid** `--color-brand`, bg `--color-brand-wash`, copy "Drop to add {n} files" | — |
| Error | border solid `--color-error`; message under the zone UI 12 `--color-error` + TriangleAlert 12, `role="alert"` | — |
| Full / single CSV chosen | bg `--color-surface-muted`, copy "10 of 10 files added" / "1 CSV selected" + "Replace file" | Choose button hidden at 10 files |

**File row:**
- Grid `16 / 1fr / 64 / 72 / 28`, gap 12, min-height 44, padding 6 2, hairline bottom.
- Icon 16 muted (FileText; FileSpreadsheet for CSV).
- Name: UI 13/20 `--color-text`. **Middle truncation** keeps the tail: render head (ellipsis) and tail (`.ext`, or the last ~8 characters) as separate spans. The full name stays in `title` and the accessible name.
- Type and size: mono 11 muted, 0.04em. Size is right-aligned.
- Remove: IconButton 28 "Remove {filename}".
- **Rejected row:** bg `--color-error-surface`, icon TriangleAlert in `--color-error`, the reason in UI 12 `--color-error` replaces type and size. The row is never dropped silently.
- **≤767:** the type and size columns are hidden; the reject reason wraps to line 2.

**Intake context notes:**
- Used for the role-only rule and the desk context line.
- Flex, gap 12, padding 12 16, radius 6, bg `--color-surface-muted`, UI 13/20 meta, icon 16 muted.
- These are not Alerts: they're information, not warnings.

**Form actions:**
- Top hairline, padding-top 24, gap 12.
- Primary Button lg (h40), Cancel quiet lg.
- ≤767: stacked, full width, h44.

### B9 ProcessingLedger
| Part | Value |
|---|---|
| List | padding 8 0, hairline top + bottom, `role="status"` `aria-live="polite"`; section `aria-busy="true"` |
| Row | grid `16 / 1fr / auto`, gap 12, height 36, UI 13/20 |
| Done | text `--color-text-meta`, Check 14 `--color-success` |
| Current | text `--color-text` 600, LoaderCircle 14 `--color-info` |
| Pending | text `--color-text-muted`, 6px dot `--color-text-disabled` |
| Failed | text `--color-error` 600, TriangleAlert 14 |
| Time | mono 11 muted (timestamp for done; elapsed for current, shown after 60 s) |
| Fallback | if step progress isn't reported: one current row "Analyzing… this usually takes a few minutes" (see §F-2) |
| "You can / available when ready" | two-column grid gap 24 (≤980 one column); H3 mono caps; list UI 13/22 meta |

### B10 Privacy block (desk/stakeholder)
- **Container:** existing Alert in error tone. Border `rgba(156,42,31,.35)`, bg `--color-error-surface`, radius 6, padding 16.
- **Heading:** UI 14/20 600 `--color-error` + TriangleAlert 16.
- **Findings table:**
  - Rows separated by a 1px error-tint rule.
  - Columns: filename UI 13 600 · label UI 13 `--color-error`, nowrap · masked snippet mono 12 meta.
- **Masking rule:** keep the first character of an email local part and the last 4 digits of numbers. Replace everything else with •.
- **Actions** (gap 8), least destructive first: Replace files (quiet) · Remove flagged files and retry (quiet; disabled with a visible reason when every file is flagged) · Delete run (critical outline).

### B11 Source identity (SourceTable)
- **Name cell:** FileText 16 muted (margin-top 3) + filename UI 13/20 600 `--color-text`. The name wraps (`word-break:break-word`) and is **never truncated** in this table.
- **Second line:** mono 11 400 muted: "{size} · {EvidenceSource publicId}".
- **Columns:** File (1fr) · Type 64 · Added 76 · Privacy 96 (StatusBadge ShieldCheck "Passed" / error variants) · Used in 72 (markers).
- **Row interaction (DISC-6 only):** hover `--color-surface-hover`, selected `--color-brand-wash`, row opens the Evidence rail at source level. In DISC-3, rows are not interactive.
- **Never** render prepared or extracted source text.

### B12 Extracted variables
- **Group:** margin-top 32. Head row: H3 mono caps (plain-language label) + the variable key verbatim from the API (mono 11 muted) + count right-aligned (mono 11 muted). Bottom border emphasis, padding-bottom 8.
- **Row:**
  - Grid `96 / 1fr / auto`, gap 16, padding 12 2, hairline bottom.
  - The ID is IdTag style in a 96 column (ids like `barrier-003` exceed 56).
  - Text: serif 15/24.
  - Source: serif italic 13.5/22 muted, right-aligned, max 200. `source_document` / `SH-xxx`, otherwise empty.
- **Lineage line:** hairline top and bottom, padding 12 0, UI 13/20 muted, ListTree 14: "Lineage: report v{n} → {k} study variables."
- **Survey groups:** Findings (`survey_findings`) and Knowledge gaps (`knowledge_gaps`) **only**.
- **Extraction failed:** Notice in error tone: "The report was written, but Qori couldn't extract items for the brief. This run can't inform a brief until extraction succeeds." + "Retry extraction".

### B13 SurveyStageStrip
| Part | Value |
|---|---|
| Bar | height `--layout-stage-strip` 64 (≤980: 48), bg `--color-paper`, bottom hairline, padding 0 24; inner `ol` max-width 1040, centered, flex |
| Item | flex 1 (≤980: auto), min-width 0; link with grid `20px 1fr`, column gap 8, padding 0 8, radius 6, full bar height |
| Connector | before each item after the first: 16×1 `--color-border-emphasis`, margin-right 8 |
| Glyph | 20 circle; mono 11 600 number or icon 12; default inset 1px `--color-border-emphasis` + `--color-text-muted` |
| Label | UI 13/18; ellipsis |
| Gate line | UI 12/16 `--color-text-muted`; ellipsis; attention variant `--color-brand-text` |
| Done | glyph bg `--color-success-surface`, Check `--color-success`; label `--color-text-meta`; link (read-only past) |
| Current | glyph bg `--color-text`, number `--color-paper`; label 600 `--color-text`; 2px `--color-indicator` bar at bottom −1, inset 8 left/right; `aria-current="step"` |
| Available (not started) | default glyph with number; link |
| Locked | glyph Lock 12 `--color-text-quiet` + ring; label `--color-text-muted`; `aria-disabled="true"`; gate line "Locked · {reason}" also referenced by `aria-describedby`; no hover; focusable |
| Failed (upload expired) | glyph bg `--color-error-surface`, TriangleAlert `--color-error`; gate `--color-error` |
| Hover | `--color-surface-hover` (not locked) |
| Focus | 2px `--color-focus`, offset −2, radius 6 |
| ≤980 | gate hidden (in `title`); strip scrolls horizontally; 24px mask fade both ends; scroll the current item into view by setting `scrollLeft` (never `scrollIntoView`) |
| ≤767 | strip replaced by a disclosure: summary h44, "Stage {n} of 6" (mono 11 muted) + **label** 600 + gate (UI 12 muted) + ChevronDown 14; panel lists the 6 items at h44 with the gate visible |

**Stages, verbatim:** Upload · Fields · Privacy · Response groups · Matches · Summary.

**Gate-line copy:**

| Stage | Done | Current | Locked |
|---|---|---|---|
| Upload | "{rows} rows · {cols} columns" | "CSV · one per run" | — |
| Fields | "{n} confirmed" | "{a} of {b} confirmed" | — |
| Privacy | "{n} reviewed · {r} restricted" | "{n} flagged need you" | — |
| Response groups | "v{n} accepted · {k} groups" | "Draft · {k} groups" | — |
| Matches | "{n} decided · {u} uncodable" | "{a} of {b} decided" | — |
| Summary | "Created {date}" | "Ready to create" | — |

Locked reasons: "confirm fields first", "finish privacy review", "accept groups first", "accept matches first".

### B14 FieldReviewTable
| Part | Value |
|---|---|
| Columns (≥1181) | Field 200 · Sample values 1fr · Present / missing 104 · Qori's guess 104 · Your role 168 · Demog. 64 · Confirmation 128 |
| ≤1180 | sample values column hidden |
| ≤980 | present/missing hidden |
| ≤767 | each field becomes a list row: name + one line "{role} · {status} · Edit/Confirm"; Edit opens a sheet with all controls; dismissible banner "Field review is easier on a wider screen" |
| Row | min-height 56, cell padding 12 12 12 0, hairline, middle-aligned; hover `--color-surface-hover` |
| Field name | mono 12/16 600 `--color-text`, 2-line clamp, `word-break:break-all`, full name in `title` + accessible name |
| Sample chip | h22, padding 0 8, radius 4, bg `--color-surface-muted`, UI 12 meta, max 24ch, ellipsis; max 3; gap 4 |
| Present / missing | UI 13 tabular, "{present} / {missing}" with the missing part UI 12 muted |
| Qori's guess | UI 13 `--color-text-muted` |
| Your role | native Select h32, radius 4, border `--color-border-control`, UI 13, chevron 12 at right 10; options = API role enum verbatim (§F-3) |
| Changed by you | "YOU" mono caps 11 `--color-brand-text`, margin-left 6, after the select |
| Needs confirmation | quiet Button sm (h28) "Confirm" with Check 12 |
| Confirmed | Check 12 + "Confirmed" UI 12 500 `--color-success` |
| Needs order | 6px dot `--color-brand` + "Needs order" UI 12 500 `--color-brand-text`; ordinal sub-row opens |
| Save error | row bg `--color-error-surface`; status "Not saved · Retry" `--color-error` |
| Demographic | native checkbox 16, accent `--color-text`, label "…is demographic" |
| Filter chips | h28, padding 0 12, radius 999, UI 12 meta, inset 1px hairline; pressed bg `--color-text` / `--color-paper`; count mono 11. Filter input h32, max 220, right-aligned |
| Ordinal sub-row | cell bg `--color-surface-muted`, padding 16 24; note UI 12/16 muted with "Suggested order" in 600 meta; list max-width 440; item h36, grid `24 1fr 28 28`, bg `--color-paper`, hairlines; index mono 11 600 muted; ▲/▼ IconButton 28 (disabled at ends, opacity .35); dragging `--elevation-md`; then primary Button sm "Confirm order" |
| Pagination | 50 per page; pager UI 12 muted right-aligned |
| Bulk | quiet Button in the gate bar: "Confirm {n} remaining as guessed" (n excludes ordinals without an order) + reason text |
| Expiry | stage-head StatusBadge `expiring`; ≤15 min → warning-tone Alert above the dataset line; expired → strip Fields `failed` + Alert (spec §7.3) |
| Dataset line | hairline top/bottom, padding 12 0, gap 16; filename mono 12 600; counts UI 13 muted |
| Parse warnings | info-tone Alert, Info 16 heading "Qori read the file with {n} warnings", body UI 13 |

### B15 Gate bar
See §A.

### B16 PrivacyReviewList
| Part | Value |
|---|---|
| Zone head | H3 mono caps + count (mono); hint UI 12/16 muted, mb 12; zones margin-top 32 |
| Entry | padding 16 0, hairline top (last also bottom) |
| Entry header | flex, gap 12: respondent id mono 11 600 `--color-text` · field mono 11 muted · detection mono caps 11 `--color-error` ("PHONE DETECTED") · right: save state + decision tag |
| Text | serif 15/24 `--color-text`, max 66ch, mb 12 |
| Detected span | `<mark>`: bg `--color-error-surface`, 1px `--color-error` underline offset 3, padding 0 2, radius 2; accessible name "{kind} detected" |
| Decision | fieldset segmented radios (legend sr or UI 12 muted): option h32, padding 0 12, radius 6, inset 1px `--color-border-emphasis`, UI 13 meta, gap 8; hover border `--color-text-muted`; checked bg `--color-text` / `--color-paper`; focus-within ring 2px offset 2; disabled `--color-text-disabled` |
| Redact | reveals Textarea (min 88, max 66ch, mt 12) prefilled with the detected token (e.g. `[EMAIL]`) |
| Save state | "Saved" UI 12 muted + Check 12; error "Couldn't save · Retry" `--color-error` |
| Decision tag | mono caps 11: Needs decision (muted) · Clear (success) · Redacted (meta) · Restricted · excluded (error) |
| Flagged list | always individually listed; paged at 50 with "Show {n} more flagged" quiet sm |
| Bulk default | box padding 16, radius 6, bg `--color-surface-muted`, gap 16: primary "Approve all {n} unflagged entries as clear" + hint UI 12 muted "Flagged entries are never included in bulk approval." |
| Bulk done | bg `--color-success-surface`, Check 16, "{n} approved as clear · {date} by you" (UI 12 500 success) + quiet sm "Undo" (until the stage completes) |
| Unflagged list | collapsible "Show unflagged entries" (CollapsibleSection), paged 50 |
| ≤767 | segmented options stack vertically, h44 each; bulk button full width |

### B17 ResponseGroupEditor
| Part | Value |
|---|---|
| Block | padding 20 0, hairline top (last also bottom) |
| Head | flex, gap 12, mb 12, wraps |
| Label | serif 17/24 600 `--color-text` |
| Origin | mono caps 11 muted: QORI PROPOSED · ADDED BY YOU (`--color-text-meta`) · CARRIED FROM V{n} · REMOVED BY YOU |
| Actions | right, gap 16: text buttons UI 12 600 meta (Keep · Edit · Remove); hover `--color-text` + underline. "Kept" state = Check 12 + "Kept" UI 12 500 success |
| Body | `dl` grid `120px 1fr`, gap 8 16; dt UI 12/22 600 muted; dd serif 14/22 meta, max 66ch |
| Editing | bg `--color-brand-wash`, padding 20 16, margin 0 −16, top rule `--color-brand`; label Input h36 serif 16 600; Definition Textarea; Include/Exclude Inputs; actions primary sm "Save" + "Cancel" |
| Removed | padding 12 0; label strikethrough 400 muted; action "Undo" |
| Add group | full-width button h44, 1px dashed emphasis, radius 6, UI 13 600 meta + Plus 14; hover border muted |
| Accept | gate bar: versioning sentence + primary "Accept these {n} groups"; disabled while any block is editing ("Finish editing {n} group first") |
| Accepted | stage title tag "V{n} · ACCEPTED {DATE}" (mono caps 11 muted); actions hidden |
| Never | counts, percentages, merge |

### B18 MatchReviewSplit
| Part | Value |
|---|---|
| Container | grid `--layout-match-list` (320; ≤1180: 280) / 1fr; 1px hairline, radius 6, overflow hidden; height = viewport − header − strip − gate bar (min 480) |
| List tabs | h40, bottom hairline, padding 0 8; tab UI 12 muted, count mono 11; active 600 + 2px `--color-indicator` |
| Tabs | Needs decision · Proposed · No proposal · Decided |
| Entry row | `role=option`, grid `1fr auto`, gap 4 8, padding 12 16, min-height 64, hairline bottom; id mono 11 600; state mono 11 muted ("2 groups" / "No proposal" / Check + "Decided" success); excerpt UI 13/20 meta, 2-line clamp |
| Row states | hover `--color-surface-hover` · selected `--color-surface-selected` + inset 2px `--color-indicator` · focus 2px inset |
| Detail | padding 24 32 (≤767: 16); head id + field + "Redacted text" tag; quote serif 17/28 max 60ch, mb 24 |
| Group options | fieldset (legend mono caps 11); option label grid `16 1fr auto`, gap 12, min-height 40, padding 0 8, hairline; hover `--color-surface-hover`; focus-within inset ring; origin tag right (Qori `--color-brand-text`, you `--color-text-meta`) |
| Decision | segmented radios (B16): Reviewed · No group applies · Uncodable |
| Footer | top hairline, padding-top 16, gap 16: primary "Save and next →" + kbd legend (kbd mono 11, padding 1 5, radius 3, inset 1px emphasis, bg `--color-surface`) |
| Bulk | B16 box: primary "Accept Qori's proposed matches for {n} entries" + hint "Only entries with a Qori proposal. Groups you added are kept. Entries without a proposal still need you." |
| ≤980 | single column: list view ↔ detail view; detail shows "← Entries" text button |
| Keys | ↑/↓ entries · Space toggle focused group · 1/2/3 decision · Enter save + next · ? shortcuts dialog; only while focus is inside the region and not in a text input |

### B19 ReadinessChecklist
- **Row:**
  - Grid `20 / 1fr / auto`, gap 12, min-height 56, padding 12 2, hairline.
  - Label: UI 14/20 600.
  - Meta: UI 12/16 muted, right-aligned.
- **Complete glyph:** 20 circle `--color-success-surface` + Check 12 `--color-success`.
- **Incomplete glyph:** 20 circle, inset 1.5px `--color-border-emphasis`. The label becomes a link: "{Gate} — {count} need… →".
- **Below the list:** primary Button lg "Create survey summary". It's disabled with a visible reason while any row is incomplete.

### B20 Survey summary registers
- **Register head:** `h2` display 27/31 + Provenance tag **boxed** and always visible (inset 1px emphasis, radius 4, padding 2 6). Values are "COMPUTED · DETERMINISTIC" or "GENERATED".
- **Determinism note:** caption serif 13.5/22 muted, "The same file and the same confirmed fields always give the same numbers."
- **Tables:** DocumentTable. Numeric cells are UI 13 tabular, right-aligned: "{n} of {d} · {p}%".
- **Optional bar:**
  - 96×6 track `--color-surface-muted`, fill `--color-text-meta`, radius 1.
  - `aria-hidden`: the numbers are the content.
- **Divider:**
  - Margin-top 48, padding 16 0, emphasis rules top and bottom.
  - Serif italic 13.5/22 muted.
  - Copy: "Numbers above are calculated by code. The interpretation below is written by Qori from those numbers and approved responses."

### B21 SynthesisSelect row
| Part | Value |
|---|---|
| Fieldset legend | UI 13/20 600 + "(choose at least two)" 400 muted |
| Row | label; grid `16 / 40 / 1fr / 120 / 56`, gap 12, min-height 56, padding 8, hairline; hover `--color-surface-hover`; focus-within inset ring |
| Content | checkbox 16 · static marker · title UI 13/20 600 + type line UI 12 muted · meta UI 12 muted · date mono 11 muted right-aligned |
| New | "NEW SINCE X{n}" mono caps 11 `--color-brand-text`, margin-left 8 |
| Disabled | checkbox disabled; marker "—"; title muted; reason UI 12 muted spans the meta and date columns, linked by `aria-describedby` |
| Count | UI 12 muted under the list: "{n} selected" |
| One selected | primary disabled; reason "With one run, open its report instead." |
| Decision question | Textarea + caption "Prefilled from the project problem statement · editable" |
| ≤767 | grid `16 / 1fr / auto`; marker on row 1 above the title |

### B22 SynthesisStatementRow
| Part | Value |
|---|---|
| Row | grid `72 / 1fr / auto / 28`, gap 4 16, padding 16 2, hairline top; container closes with a hairline bottom |
| ID | mono 11/26 600, 0.05em, `--color-brand-deep` (`X2-K01`) |
| Statement | serif 15.5/26 `--color-text`, `text-wrap:pretty` |
| Support line | row 2, column 2; UI 12/16 muted. Computed from citations: "Supported by {n} of {m} selected runs", "Single source"; gaps "Raised by {n} of {m} selected runs"; agreements "{types} · {n} of {m} selected runs" |
| Markers | column 3, right-aligned, max-width 160, wrap, padding-top 3 |
| Overflow | IconButton 28 MoreHorizontal; opacity 0 → 1 on row hover / focus-within / open (≤980 always 1). Menu (popover radius 8, `--elevation-md`, min 200): Set aside · Show evidence (DISC-6) · Comment |
| Selected (rail open on it) | bg `--color-brand-wash` + inset 2px `--color-indicator` |
| Set aside | moved into a collapsed `details` at the section end: summary UI 12 600 muted "Set aside by you · {n}" + chevron; row text muted; line "Set aside by {actor} · {date} · Restore" |
| ≤980 | grid `72 / 1fr / 28`; markers move under the support line |
| ≤767 | grid `1fr 28`; ID on its own line (16 line-height) |

**Section order:** What we know · Where sources agree · Where sources conflict · What we don't know · Implications for research · Recommended focus for the brief.

### B23 ConflictPair
- **Container:** grid `72 / 1fr / auto`, padding 16 2, hairline top.
- **Each side:**
  - Grid `1fr auto`, padding 8 0.
  - Side label: mono caps 11 muted. Use the source type ("STAKEHOLDERS", "SURVEY", "DESK RESEARCH").
  - Text: serif 15.5/26.
  - Markers: right-aligned.
- **Between sides:** 1px **dashed** `--color-border-emphasis`.
- **Why it matters:** UI 13/20 meta with "Why it matters:" in 600.
- **Rule:** rendered only when both sides carry at least one marker.

### B24 Synthesis header widgets
- **Version line** (under the masthead):
  - Padding 12 0, bottom hairline, gap 12.
  - Reviewed: StatusBadge ready "Reviewed by you · {date}".
  - Not reviewed: UI 12 muted "Not yet reviewed by you" + quiet sm "Mark reviewed".
  - Superseded: StatusBadge `superseded`.
- **History menu:**
  - Header quiet sm Button: History 14 + "X{n} · current" + ChevronDown 12.
  - Popover min 300. Items are grid `40 1fr`: marker · state + date · sub-line "Compares D1 · S1 · V1". Newest first.
- **Stale alert:** existing Alert in warning tone (border `--color-brand`, bg `--color-brand-wash`). Heading ring + "Out of date". Body names the artifacts. Quiet sm "Synthesize again…".
- **Superseded notice:** existing Notice in neutral tone (grey dot), above the masthead. It contains "**Superseded by X{n}** on {date} · read-only. X{n} adds {markers}; removes {markers|nothing}." + "Open X{n} →".

### B25 EvidenceRailPanel (ContextRail mode `evidence`)
| Part | Value |
|---|---|
| Rail | existing ContextRail: 344 docked ≥1181, overlay 981–1180 and 768–980 (`--elevation-overlay-end`), bottom sheet ≤767 (85vh, top radius 10, grab handle 36×4 radius 2 `--color-border-emphasis` at top 8, `--elevation-lg`, `aria-modal`, inert background, scrim `--color-scrim`) |
| Tabs | Evidence first (when available) · Comments |
| Breadcrumb | `nav aria-label="Evidence path"`; flex, gap 4, wraps; padding-bottom 12, mb 16, hairline bottom. Back IconButton 28 ArrowLeft (disabled at level 1) |
| Crumb | link: mono 11/16 600, 0.04em, `--color-text-muted`, padding 4 6, radius 3, max-width 160, ellipsis; hover `--color-text` + `--color-surface-hover`; focus ring |
| Current crumb | `span aria-current="location"`, `--color-text` on `--color-surface-muted` |
| Separator | "›" UI 13 `--color-text-quiet`, padding 0 2, aria-hidden |
| Level 1 · claim | eyebrow mono caps 11 "CLAIM · X2-K02"; claim serif 16/26 (heading, receives focus); support UI 12 muted, mb 24; eyebrow "EVIDENCE · {n}" |
| Artifact entry | padding 16 0, hairline; head: marker + type mono caps 11 + name UI 13/20 600 (own line); passage blockquote serif italic 13.5/22 meta, 2px `--color-border-emphasis` left rule, padding-left 12, 3-line clamp; location UI 12 muted ("Key Themes · Theme 1 · cites {file}"); action UI 12 600 link "Open in report →" |
| Selected entry | bg `--color-brand-wash`, bleeds to the rail edges (margin 0 −24, padding 16 24), inset 2px `--color-indicator`; its marker in the selected state |
| No passage recorded | note instead of quote: UI 12/18 muted, bg `--color-surface-muted`, radius 4, padding 8 12, Info 14. Copy: "Linked to {M} as a whole. Qori didn't record a specific passage." Action "Open report →" |
| Unavailable artifact | marker unavailable state; name muted; note with CircleSlash 14: "This run was deleted after the synthesis was created."; no action |
| Level 2 · artifact | display 21/25 run name; `dl` grid `96 1fr`, gap 8 12, UI 12/18 (dt muted); sources list rows min-height 44, FileText 14, UI 13, hover `--color-surface-hover`, current `--color-surface-selected` |
| Level 3 · source | eyebrow FileText 12 "SOURCE"; filename UI 14/20 600, full and wrapping (heading, receives focus); publicId mono 11 muted; `dl` Type · Added · Privacy · Used in (marker buttons); survey adds Rows · Columns · Schema version; note "Source file contents aren't shown in Workspace." |
| Return pill | header, after the grow: h28, padding 0 12, radius 999, bg `--color-surface-inverse-2`, text `--color-text-inverse` UI 12 600 + ArrowLeft 12: "Return to synthesis X{n}" |
| Passage highlight in report | target span bg `--color-brand-tint` with 8px horizontal bleed (box-shadow), fades over 1.8 s (existing `w2hl` timing); no fade under reduced motion |
| Keys | Escape steps up a level; at level 1 it closes (overlay/sheet) and returns focus to the originating marker |

### B26 BriefEvidenceChoice (first fieldset of BriefForm)
| Part | Value |
|---|---|
| Legend | display 27/31 "What informs this brief?" |
| Hint | UI 13/20 muted, mb 16: "Choose once. The brief will state what informed it." |
| Options box | 1px `--color-border-emphasis`, radius 6, bg `--color-paper`, overflow hidden; options separated by hairlines |
| Option | label grid `20 / 1fr / auto`, gap 12, padding 16; radio 18 accent `--color-text` |
| Title | UI 14/20 600 + inline static marker; meta UI 12/16 muted, mt 4 |
| Recommended | mono caps 11 `--color-brand-text`, inline after the title; **only** on a current synthesis |
| Stale | meta shows StatusBadge `stale` "Out of date — doesn't include {markers}"; still selectable; no Recommended |
| Hover | unselected `--color-surface-hover` |
| Selected | bg `--color-brand-wash`; nested panel revealed |
| Nested | padding 0 16 16 48 (≤767: 16); sub-label UI 12/16 600 meta; rows label grid `16 / 1fr / auto`, min-height 36, hairline top, UI 13/20; number mono 11 muted; markers right; disabled rows muted + reason UI 12 |
| No Discovery yet | line above the single option: bg `--color-surface-muted`, padding 12 16, UI 13 muted: "No Discovery yet. You can add evidence first, or continue." |
| Load error | same line: "Couldn't load Discovery. You can continue without it or retry." |
| Suggestion | under required judgment fields: bg `--color-surface-muted`, radius 4, padding 8 12, UI 12/18 muted, "Suggestion from X{n}:" 600 meta + quiet sm "Use suggestion" |
| Prefill | ProvenanceField caption "From Discovery synthesis X{n} · change if needed" |
| Masthead fact | FactsGrid "Informed by" = `X2 (D1 · S1 · V1)` / `D1 · S1` / "Not informed by Discovery". Identical style for all three (serif 15.5/20 600 `--color-text`) |

### B27 Hub empty explainer
- **Section:** `h2` "What do we already know?" + serif paragraph.
- **Rows:**
  - Emphasis top border.
  - Each row: grid `1fr auto`, padding 20 2, hairline bottom.
  - Title: serif 17/24 600. Description: UI 13/20 muted.
  - Quiet Button right (spans both lines).
- **Skip line:** margin-top 24, UI 14/20 meta, with the link in 600. It's always visible.

---

## C. Responsive summary

| Pattern | ≥1181 | 981–1180 | 768–980 | ≤767 |
|---|---|---|---|---|
| Lifecycle | docked 224 | docked | drawer 288 + scrim | drawer |
| Header | crumb · tabs · status · tools | same | crumb hidden; nav toggle | padding 0 12; status hidden (`hide-sm`) |
| Doc gutters | 48 | 48 | 24 | 16 |
| Ledger | table | table | 2-line grid rows | same |
| Stage strip | labels + gate | same | labels, scroll + fade | disclosure |
| Fields | 7 columns | no samples | no samples / no present-missing | list + edit sheet + banner |
| Privacy | inline radios | same | same | stacked radios h44 |
| Matches | split 320 | split 280 | list ↔ detail | same |
| Statements | markers right | same | markers under | ID on its own line |
| Evidence rail | docked 344 | overlay | overlay | bottom sheet 85vh |
| Brief step 0 | nested indent 48 | same | same | indent 16 |

Reference renders: `screens/19 Responsive.html`.

---

## D. Milestone map: build only your milestone

| Milestone | Build | Render instead (when the later backend is absent) |
|---|---|---|
| **DISC-3** | Lifecycle rows (All evidence, Desk Research, Stakeholders, Surveys as routes; Synthesis as a dim placeholder) · Hub §1, §2, §4, §5 · Desk intake · Stakeholder intake · Run page (Report, Sources, Extracted, processing, failures) · B1 static markers, B2, B3, B5–B12, B27 | **Hub:** §3 not rendered. The "Synthesize across sources" button is absent. The "Add evidence" menu has 2 items. **Ledger:** the survey group lists only Ready survey artifacts from the list endpoint, read-only. **§5:** from Brief `discovery_sources` ("The brief is informed by D1 · S1." / "The brief isn't informed by Discovery."). Markers are static. Attribution is plain text. Source rows are not interactive. The Evidence tool is absent. |
| **DISC-4** | Survey intake (CSV), Fields, Privacy, Response groups, Matches, Summary readiness, Survey summary · B13–B20 · survey rows in queue and ledger · survey nav dot | — |
| **DISC-5** | Synthesis select, document, stale, history, set aside, reviewed · B21–B24 · Hub §3 · header Synthesize button · nav Synthesis row + glyph · "Used by X#" | Markers stay static until DISC-6. The overflow menu has "Set aside" and "Comment" only. |
| **DISC-6** | Evidence rail (B25) · marker buttons · run-page attribution buttons · Sources row → rail · Brief step 0 (B26) · Brief masthead "Informed by" with X# · TB/RQ markers | — |

The screens carry magenta "DISC-n" tags on regions that belong to a later milestone than the screen itself.

---

## E. Accessibility specifics (in addition to spec §14)

- **Stage strip:**
  - `nav aria-label="Survey stages"` containing an `ol`.
  - Current item: `aria-current="step"`.
  - Locked items: `aria-disabled="true"`, focusable, with the reason in `aria-describedby`.
  - The ≤767 disclosure is a native `details/summary`.
- **Segmented decisions:** native radio `fieldset` + `legend` ("Decision for R-1044"). The labels are the targets: 32 high (44 at ≤767).
- **Match list:** `listbox` / `option` with `aria-selected`, roving tabindex.
- **Detected PII:** `<mark>` with an accessible name "{kind} detected". Color is never the only signal: the detection tag text is always present.
- **Bulk buttons:** the accessible name contains the exact scope and count.
- **Breadcrumb:** `nav aria-label="Evidence path"`. Current crumb: `aria-current="location"`. Truncated crumbs carry the full text in `title` and the accessible name.
- **Markers:** the accessible name includes the type and run name. Pressed state uses `aria-pressed`.
- **Live regions:**
  - Hub: one polite region ("D2 is ready", "D2 failed").
  - Processing ledger: `role="status"`.
  - Expiry: announced at 15 and 5 minutes only.
- **Bottom sheet:** `aria-modal="true"`, background inert, focus trapped, Escape closes.

---

## F. Flags: design needs that the API must confirm (do not invent)

| # | Need | Used by | If unavailable |
|---|---|---|---|
| F-1 | Which desk runs feed a stakeholder run (`discovered_barriers`, `knowledge_gaps` injection) | Stakeholder intake context line; stakeholder run masthead | Show the sentence without markers ("Desk research in this project is given to Qori as context."). If the API can't say whether any exists, show nothing |
| F-2 | DiscoveryRun step progress (beyond status) | ProcessingLedger steps | Two-state fallback (B9) |
| F-3 | Survey field role enum | Fields "Your role" select | Render the enum verbatim. The mock's list is illustrative |
| F-4 | Stable marker per artifact (D1, S1, V1, X1) assigned at Ready and persisted | Everywhere | Do **not** derive markers from list order on the client. Raise it before DISC-3 ships markers |
| F-5 | Structured "used by" lineage (Brief → artifacts/synthesis) | Ledger "Used by", Hub §5 | DISC-3: parse only Brief `discovery_sources` as returned; show "—" when unparseable |
| F-6 | Ready-count and needs-attention per type, in one call | Nav counts and dots | Hide counts until loaded. Never show stale counts |
| F-7 | `upload_expires_at` on survey staging | Expiry badge, queue sort | DISC-4 dependency |
| F-8 | EvidenceSource public id + size + privacy result per source | Sources table, rail level 3 | Omit the mono id line, keep the filename |
| F-9 | **Retry after a privacy block.** DISC-2 deletes prepared content at the terminal state. "Remove flagged files and retry" needs the unflagged originals to still be available | Privacy-blocked run | If the files aren't retained, replace the action with "Upload files again" (inputs kept), and remove "Remove flagged files and retry" |
| F-10 | "Run again with these sources" vs. DISC-1 artifact versioning (new version of the same run vs. a new run) | Run overflow menu | Hide the action until resolved. Deletion semantics come from the same answer |
| F-11 | Topic duplicate lookup | Intake duplicate notice | Skip the notice |
| F-12 | Passage anchors for desk/stakeholder citations | Evidence rail quotes | Artifact-level note (B25). This is the expected state until the backend records passages |
