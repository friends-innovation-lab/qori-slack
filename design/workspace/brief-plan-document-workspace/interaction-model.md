# Interaction Model — Brief + Plan Document Workspace

## Modes

### View mode (default)
Document-first reading surface. Comfortable long-form width (max 840px), full section order matching the GitHub artifact. Structured IDs (OBJ-001, RQ-001, TB-001) visible inline. Status pill + "View on GitHub ↗" (secondary) under the H1. Right review rail on the Brief only.

### Edit mode
Entered ONLY via the explicit **Edit** button — the whole document becomes an editing session (no per-block save).
- Sticky formatting toolbar appears under the page head (`role="toolbar"`)
- Save/Cancel replace Edit in the page head; **Save stays disabled until the first change**
- Editable blocks show a dashed outline on hover, a grip handle, and a focus tint; read-only blocks dim slightly and reveal a READ-ONLY · SYSTEM tag on hover
- Section headings expose provenance tags (CANONICAL · EDITABLE / GENERATED · EDITABLE / SYSTEM · READ-ONLY)
- The review rail is hidden while editing

### Review mode (Brief only)
Review is view mode plus the approval machinery — not a separate surface. Reviewer and researcher see the same document.
- **Pending approval:** info banner; rail shows the approval card with **Approve** and **Request changes**
- **Approve →** success banner + green Approved pill; approval checklist boxes render checked; plan generation unblocks
- **Request changes →** changes-requested state
- **Changes requested:** error banner naming reviewer, date, and comment count; rail lists feedback cards anchored to sections (§ Participants, § Timeline); flagged sections get a red left rule + "● Feedback" heading marker; header actions become **Revise** (enters edit mode) and **Resubmit**
- **Revise → edit → save → Resubmit →** returns to pending (labelled "resubmitted")

## Save / Cancel / unsaved changes
- Any input in an editable block sets the dirty flag: save-state indicator switches to "Unsaved changes" (gold dot) and Save enables
- **Cancel** discards the editing session and reverts to the last saved canonical state (a confirm dialog is expected in production when dirty)
- **Save** runs the pipeline and returns to view mode

## Save pipeline (conceptual contract)
Workspace edit → **canonical Qori structured state** → deterministic artifact render → **update the SAME GitHub artifact**.
Surfaced as staged status text with a live dot: `Saving to canonical state… → Rendering artifact… → Updating GitHub projection… → Synced — GitHub updated` then settling to `Saved · <time>`. Announced via `aria-live="polite"`.

### Save failure
Pipeline halts at the failed stage; indicator turns red ("Save failed — retry"); document REMAINS in edit mode with content intact; Save re-enables as **Retry**. No partial canonical writes.

### GitHub sync failure
Canonical save succeeded but projection push failed: document exits edit mode (canonical state is safe), indicator shows "Saved — GitHub sync pending · Retry"; a warning banner offers retry. GitHub is a projection — sync failure never blocks Workspace editing.

## Plan-specific rules
- **No approval controls anywhere** — no approval card, no Approve/Request-changes, no approval checklist section
- Same view/edit/save model as the Brief
- Research period (start–end, derived from timeline phases) renders as a highlighted strip above the timeline table
- Timeline, deliverables, risks render as real document tables/lists — never raw JSON
- Objectives and research questions are inherited from the approved brief and render read-only (edited upstream in the Brief)

## Stable IDs
- OBJ-XXX / RQ-XXX / TB-XXX render as monospace inline tags leading their item, in both view and edit modes
- Editing an item's text never touches its ID — RQ-003 remains RQ-003 underneath
- Add/remove allocates/retires IDs server-side; IDs are never renumbered

## Future traceability affordances (anticipated, not built)
- ID tags become clickable: click opens provenance in the right rail; hover shows a lineage popover (source artifact, extraction date, downstream consumers)
- Hover today already shades the tag blue and shows an explanatory tooltip — the affordance slot is reserved
- Section-level comment threads will attach to `sectionId` or `stableId` and render in the rail

## Future stale-cascade warning
If the Brief is edited and saved AFTER approval (i.e., after a Plan exists), a warning banner appears: "Edited after approval — downstream artifacts (Research Plan, Discussion Guide) are flagged stale until re-reviewed." Acknowledge dismisses the banner; the stale flag on downstream artifacts persists until re-review. The Brief's pill shows "Approved · edited".
