# Brief Reviewer Authorization

**Status:** Backlog  
**Created:** 2026-09-16  
**Related to:** fix/brief-study-identity-mismatch  

## Current Gap

Any authenticated user with project access can approve or request changes on a Brief. There is no role-specific enforcement.

**Current behavior:**
- Researcher sees approval controls on their own Brief
- Admin sees approval controls (no distinction from reviewer)
- Backend accepts approve/request-changes from any project member
- `brief_reviewer_id` is stored but not enforced

**Endpoints affected:**
- `POST /api/v1/studies/:studyId/brief/approve`
- `POST /api/v1/studies/:studyId/brief/request-changes`

## Target Behavior

1. **Researcher view:** Shows Brief status and feedback, but NOT approval actions
2. **Assigned reviewer view:** Shows Approve / Request Changes actions
3. **Admin view:** Explicitly defined (either acts as any-reviewer or requires assignment)
4. **Backend enforcement:** Validate that actor is the assigned reviewer before processing approve/request-changes

## Implementation Notes

- `research_studies.brief_reviewer_id` exists but is not populated or enforced
- Need to add reviewer assignment flow (e.g., researcher assigns reviewer at submission, or admin assigns)
- Frontend must conditionally render approval controls based on actor role
- Backend must check `brief_reviewer_id` against `req.ctx.actor.publicId` before approving

## Related UX Backlog Items

See `docs/backlog/workspace-ux.md` for related items:
- Role-specific Brief review mode
- Generation Experience / Designing the Wait
- Document workspace visual polish
