# Accessibility Notes — WCAG 2.2 AA

## Intent
The document workspace targets WCAG 2.2 AA throughout: contrast, keyboard operability, focus visibility (2.4.11/12), target size (2.5.8), and status messages (4.1.3). USWDS-compatible components inherit USWDS's audited patterns wherever possible.

## Keyboard navigation
- Full flow operable without a pointer: breadcrumb → page-head actions → artifact tabs → banner actions → document → review rail
- Artifact switcher is a `tablist` with arrow-key navigation; Enter/Space activates
- Edit toolbar is `role="toolbar"` with roving tabindex (arrow keys move between tools; one tab stop)
- `Esc` in edit mode moves focus from an editable block to the Save/Cancel group without discarding
- Collapsed metadata sections are native `<details>/<summary>` — keyboard and SR support for free

## Focus management entering/leaving edit mode
- **Enter:** focus moves to the first editable block; an `aria-live` announcement states "Editing Research Brief. N editable sections. Save is disabled until you make a change."
- **Leave (Save):** focus returns to the Edit button; pipeline completion announced
- **Leave (Cancel):** focus returns to the Edit button; "Changes discarded" announced
- Focus indicator: 3px `#2491ff` outline, never suppressed; never obscured by the sticky toolbar (2.4.12)

## Screen reader labels
- Landmarks: `header` (topbar), `nav[aria-label="Primary"]` (sidebar), `nav[aria-label="Breadcrumb"]`, `main` (document), `aside[aria-label="Review"]`
- Editable regions are labelled by their section headings (`aria-labelledby`)
- ID tags: `aria-label="Stable ID OBJ-001"`; priority pills read as text ("Primary")
- Read-only blocks in edit mode: `aria-readonly="true"` + visible READ-ONLY tag
- Status pill and save-state are text, not icon-only

## Status announcements
- Save pipeline stages, approval changes, and banner swaps announce via `aria-live="polite"`; save failure uses `role="alert"`
- Banners carry `role="status"` and lead with a bold text label ("Changes requested"), never color alone

## Non-color status indicators
- Approval states pair color with icon + text: ✓ Approved, ⚠ pending/stale, ✕/● changes requested
- Flagged sections combine the red rule with the "● Feedback" text marker
- Save-state combines dot color with explicit text; editable vs read-only combines outline style with tags

## Review rail
- `aside[aria-label="Review"]`; feedback cards are list items with reviewer name, date, section anchor, and quoted text as real text
- Section anchors will become links (future); today they are informational
- Overlay mode (narrow viewports): opens from a real button ("Review · 2"), traps focus while open, `Esc` closes, focus returns to the toggle

## Mobile behavior
- Single column; document text reflows (no horizontal scroll at 320px, 1.4.10); tables scroll within their own container with visible affordance
- Sidebar collapses to an icon rail with `aria-label`s preserved; hit targets ≥44px
- Review rail is the overlay pattern above

## Reduced motion
- `prefers-reduced-motion: reduce` disables the save-state pulse animation and any banner transitions; state changes remain announced via text/aria-live
