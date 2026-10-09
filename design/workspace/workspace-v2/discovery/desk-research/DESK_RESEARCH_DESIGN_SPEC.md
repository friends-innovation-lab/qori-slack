# SPEC-2 — Discovery · Desk research (insight-first)

Status: **CD design approved — D1–D9 decisions locked.** Design only. No application code, schema, API or migration changes are implied as done.
Screens: `screens/DR00 Index.html`. Builds on NAV-1 (`../../study-shell/`) and Discovery (`../DISCOVERY_REDLINES.md`, `../DISCOVERY_WORKSPACE_DESIGN_SPEC.md`).

---

## Owner-Approved Decisions (D1–D9)

| Decision | Question | Approved Answer |
|----------|----------|-----------------|
| **D1** | Project scope in a study shell. Rail counts. | Project-wide insights. Rail count = insights needing review (proposed). |
| **D2** | Who may accept. | Researchers and above. May self-accept their own edits. |
| **D3** | Save and accept in one step. | Separate actions. Save creates a proposed revision; Accept is deliberate. |
| **D4** | Per-file processing status. | Only if supported by data. Otherwise inherits run status. |
| **D5** | Withdrawal and rejection reversibility. | No one-click undo. Restore is future-only. |
| **D6** | Reasons. | Withdrawal reason **required**. Reject reason remains optional. |
| **D7** | Display ID format. | `IN-0001` (four-digit, zero-padded). Stable per project, never reused. |
| **D8** | Pre-DR-1 behaviour. | Existing run-ledger remains until DR-1/DR-4 ships. |
| **D9** | Removing a cited source. | **Protect sources cited by accepted revisions.** Block removal; surface "in use" indicator. |

---

## 1. What changes

- `/studies/:id/discovery/desk` (NAV-1 S04) changes from a run ledger to an **Insights** list. Runs and files move to a **Sources** header tab: `/discovery/desk/sources`.
- What stays the same: the dark lifecycle rail, the rail row, the breadcrumb (Discovery › Desk research), the centered document canvas, the Discovery Overview vs. Desk research split, the run pages (S06), and the Brief and Plan gates.
- **Scope is the project.** The same list appears in every study of the project. The mast meta says "Project · {name} — Shared by every study in this project."
- **Rail count** shows insights needing review (proposed), not run count (per D1).

---

## 2. Layout

Header: breadcrumb · tabs `Insights n` / `Sources n` · panel toggle. Canvas (640 measure): mast → status line → Add sources → filters (DR01) → **1 Proposed** → **2 Accepted** → collapsed **Rejected** / **Withdrawn** groups. Selecting a row opens the **Insight panel** (DR04) in the existing 344px ContextRail slot, with Insight and History tabs and a pinned action bar.

---

## 3. Status model (UI)

| UI status | Derived from (DR-1, planned) | Row group | Synthesis-eligible |
|---|---|---|---|
| Needs review (proposed) | no `accepted_revision_id`; latest revision proposed | Proposed | No |
| Accepted · rN | `accepted_revision_id` = latest | Accepted | Yes (rN) |
| Accepted · rN + Revision rM pending | `accepted_revision_id` ≠ `latest_revision_id`; latest proposed | Accepted, with pending block | Yes (rN only) |
| Accepted · rN + rM rejected | latest decision on rM = rejected | Accepted | Yes (rN) |
| Rejected | never accepted; latest decision rejected | Rejected group | No |
| Withdrawn | withdrawal decision on construct | Withdrawn group | No (history kept) |

Each insight appears once. The "Needs review" chip counts any insight whose latest revision is proposed, so it can be higher than the Proposed section count.

---

## 4. Redlines (desk.css)

- **DR01 Filter bar.** Status chips (existing `.chips`) + source select (`.selctl.sm`, min 220). Below 767px the chips scroll horizontally and the select goes full width.
- **DR02 InsightRow.** Grid `56px | 1fr | auto`, gap 6/16, padding 16/8/16/2. ID mono 11/600 brand-deep. Wording serif 15.5/26 (proposed rows use text-meta). Meta 12/18 muted: origin tag + decision + source file names + limitation flag. Selected: brand-wash + 2px inset indicator. **Pending block:** dashed border-emphasis, radius-sm, label "Revision rM pending · Edited by … · not in use", plus a diff preview.
- **Display ID format:** `IN-0001` — four-digit, zero-padded, stable per project, never reused (per D7).
- **Origin tag (`.ptag`).** Mono 11 uppercase. "Proposed by Qori" uses the sparkles glyph and brand-text. Human edits use the pencil glyph and text-meta.
- **DR03 InsightPanel.** Version blocks: **In use** = solid border + 2px success top rule + check badge. **Pending/AI** = dashed, paper background, labelled "Qori's interpretation" or "Pending · rM". **Past** = muted surface. Eligibility line 12px (success check, or muted slash). Action bar pinned, border-top emphasis, with a `.why` line that always states the consequence.
- **DR04 EvidenceReference.** File name 13/600 + "Added {date} · {run}". Locator `dl` 72px label column: Page, Section, Excerpt ("Not recorded" when missing). A recorded excerpt shows as a **Source excerpt** block: muted surface, roman serif 14/22. This is the only verbatim source text. With no locator at all, the reference shows the existing `.emiss` note "Source-level attribution. Linked to this source as a whole. No page, section or excerpt was recorded."
- **DR05 InsightEditor.** Replaces the row in place, on a brand-wash ground with a brand top rule. Serif textarea, then a reference list (each row: Page/Section/Excerpt inputs or a "source as a whole" checkbox), then an add-reference select limited to processed project sources.
- **DR06 RevisionHistory.** Newest first. Each revision shows ID, status badge, an "In use" tag where it applies, wording, and its decision lines (who · when · optional note). Each revision has a "View" link that opens it read-only with its snapshot.
- **DR07 ConfirmDialog.** `alertdialog`, max 480, radius-lg, elevation-lg. Below 767px it becomes a bottom sheet. Destructive button `.btn.crit` (error token).
- **AI vs. evidence rule:** AI or proposed wording never sits on a muted surface, and source excerpts never sit in a dashed block.

---

## 5. Interaction & state notes

- **Accept** is enabled only when the revision has at least one reference. It sends `expectedRevisionId` and records an immutable decision. The panel shows "Accepted rN", and the row moves to Accepted. **Researchers and above may self-accept** (per D2).
- **Reject** opens an inline optional note and a confirm. Nothing is deleted. On a never-accepted proposal, the insight moves to the Rejected group. On a draft over an accepted revision, the accepted revision is unchanged and the row meta adds "rM rejected {date}" (DR07).
- **Edit** (DR05). **Save always creates a new proposed revision** with its own evidence snapshot. **It never accepts** (per D3). Validation: wording is required and at least one reference is required. Qori never fills in the excerpt field.
- **Accept rM over rN** moves the accepted pointer. rN becomes Superseded and can still be viewed.
- **Withdraw** is available only when an accepted revision exists. The dialog lists three consequences: no future synthesis, earlier syntheses kept but marked out of date, history kept. **The reason is required** (per D6). It shows no "used in N syntheses" count unless the API provides one.
- **No one-click undo** for withdrawal or rejection (per D5). Restore is future-only.
- **Concurrency** (DR10a). Every write carries the base or expected revision. On a 409 nothing is written and the user's text is kept. Latest vs. theirs is shown side by side, with three actions: rebase onto latest, review latest, or discard. A decision conflict reloads the panel with a one-line explanation and is not retried.
- **Permissions** (DR10b). Viewers can see everything. Write controls are disabled with a visible reason, and the panel has no action bar. A 403 mid-action shows an alert, refetches the role, and switches the page to view-only.
- **Sources** (DR03). Files are grouped by DiscoveryRun. Failures appear first under "Needs you": privacy uses the existing 05b screen; an unreadable file can be replaced or removed. One failed file doesn't block its run. The Source panel shows metadata and a processing ledger (B9). **Sources cited by accepted revisions are protected** — removal is blocked with an "in use" indicator (per D9). **Per-file status only if supported by data**, otherwise inherits run status (per D4).
- **Empty** (DR02). With zero sources: one explainer row and one action. If sources exist but none has finished processing, the page shows DR01 with the processing notice and an empty Proposed section.
- **Focus.** Opening the panel moves focus to the panel ID heading. Escape or close returns focus to the row. The dialog's initial focus is Cancel.

---

## 6. Screen → domain contract

| Screen / element | Existing entity | Planned DR-1 |
|---|---|---|
| Insight row identity, `IN-0001` | EvidenceConstruct (stable id) | display key (D7: four-digit format) |
| Row wording / status | — | latest + accepted revision pointers, revision state |
| Version blocks, diff | — | immutable EvidenceConstruct revisions |
| Accept / Reject / Withdraw | — | immutable review decisions (actor, time, note) |
| Evidence references, locators | EvidenceRelationship (lineage) → EvidenceSource | JSONB evidence snapshot per revision (page, section, excerpt, source-level flag) |
| "Added … · {run}", Sources tab, processing ledger | EvidenceSource, DiscoveryRun, DiscoveryArtifact | per-file status (D4: only if data supports) |
| "Proposed by Qori … run X" | DiscoveryRun / DiscoveryArtifact provenance | revision origin field |
| Conflict (409) | — | optimistic concurrency (expected revision) |
| Eligibility line | — | derived: accepted pointer ∧ not withdrawn |
| Stale synthesis on withdraw | existing synthesis stale state (B7) | trigger on withdrawal |
| Source protection | — | block removal of sources cited by accepted revisions (D9) |

**Without DR-1:** the only data that exists is constructs, lineage, sources and runs. The UI cannot show any proposed or accepted distinction honestly. **Existing run-ledger remains until DR-1/DR-4 ships** (per D8).

---

## 7. Future-only (designed as hooks, not built)

- Jump to the passage inside a source viewer (today "Open source" opens the file).
- Restore a withdrawn insight, or reopen a rejected proposal.
- Bulk accept or reject.
- Structured reject and withdraw reasons.
- Diffing any two revisions (today: pending vs. in use only).
- "Used in N syntheses" counts and links from an insight.
- Running cross-source synthesis from Desk research (synthesis stays its own page).
- Comments on insights, live presence and edit locks.
- AI re-proposal when a source is replaced; duplicate merge.

---

## 8. Screen inventory

| Screen | File | Description |
|--------|------|-------------|
| Index | `screens/DR00 Index.html` | Navigation index for all screens |
| Overview | `screens/DR01 Overview.html` | Insights list with proposed/accepted/rejected groups |
| Empty | `screens/DR02 Empty.html` | Empty state — no sources yet |
| Sources | `screens/DR03 Sources - Processing and Failure.html` | Sources tab with run grouping, processing, failure states |
| Proposed | `screens/DR04 Proposed Insight Review.html` | Insight panel for proposed (AI-generated) insight |
| Edit | `screens/DR05 Edit Insight.html` | Inline editor for creating revision |
| Pending revision | `screens/DR06 Accepted with Pending Revision.html` | Accepted insight with pending revision overlay |
| Rejected revision | `screens/DR07 Revision Rejected.html` | Accepted insight after revision rejection |
| Withdraw confirm | `screens/DR08a Withdraw - Confirm.html` | Withdrawal confirmation dialog |
| Withdrawn | `screens/DR08b Withdrawn.html` | Withdrawn insight in withdrawn group |
| Evidence locator | `screens/DR09 Evidence Locator and Fallback.html` | Evidence reference panel with locator fields |
| Edit conflict | `screens/DR10a Edit Conflict.html` | Optimistic concurrency conflict resolution |
| Permission denied | `screens/DR10b Permission Denied.html` | View-only state for insufficient permissions |

---

## 9. CD notes

This design builds on the existing Discovery Workspace foundation and NAV-1 Study Shell. All screens use the locked visual convergence tokens and existing component library.

### HTML/CSS ownership

The HTML screen exports are CD-owned artifacts. Changes to screen structure or styling require CD approval before implementation.

### Dependencies

- NAV-1d Study Workspace shell (completed)
- Discovery domain foundation DISC-1 (completed)
- DR-1 backend schema (not yet implemented)

---

## Changelog

- **2026-10-09** — D1–D9 decisions locked per owner approval. Spec updated to reflect approved answers.
