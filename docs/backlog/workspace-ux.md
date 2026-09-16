# Workspace UX Backlog

**Created:** 2026-09-16
**Related to:** Document workspace, brief review experience

## Backlog Items

### 1. Generation Experience / Designing the Wait
When Brief or Plan generation is in progress, provide meaningful feedback:
- Streaming progress indicator
- Stage-by-stage updates (loading template, running AI tasks, writing to GitHub, extracting variables)
- Estimated completion time (if predictable)
- Graceful handling of partial success

### 2. Role-Specific Brief Review Mode
Different views based on actor role:
- **Researcher:** Read-only status, feedback display, no approval actions
- **Reviewer:** Approve / Request Changes actions, inline commenting
- **Admin:** Configurable (either unrestricted or requires assignment)

See `docs/backlog/brief-reviewer-authorization.md` for authorization requirements.

### 3. Synthetic Researcher/Reviewer Test Users
Create test fixtures for:
- Researcher-role actor (cannot approve own Brief)
- Reviewer-role actor (can approve assigned Briefs)
- Admin-role actor (full access)

Use in integration tests to verify role-specific behavior.

### 4. Document Workspace Visual Polish
Google Docs / TipTap feel:
- Smooth inline editing with autosave
- Collaborative presence indicators (future)
- Clean typography and spacing
- Mobile-responsive layout

### 5. Connected Study Navigation Rail
Explicit complete/current/locked states for each artifact:
- Greyed out + lock icon for locked artifacts
- Check mark for completed artifacts
- Highlight current artifact
- Show dependencies (Plan requires approved Brief)

### 6. Overview CTA for Existing Plan
When Plan already exists:
- "Open research plan" instead of "Create research plan"
- Direct link to Plan document
- Show Plan status (draft/approved/etc.)

## Priority Notes

These are UX polish items, not functional blockers. Prioritize after:
1. Brief study identity fix (current PR)
2. Plan cascade consumption
3. Core workflow completion
