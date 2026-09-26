# CMT-8 Final Acceptance — Comments MVP Release Gate

**Date**: 2026-09-26
**Baseline**: origin/dev @ 2275f2dbc8577eb9b268209fac77bd756c83dec2
**Branch**: qa/workspace-comments-cmt8-final

## Initial Audit

**NO RELEASE-BLOCKING DEFECTS FOUND**

Comprehensive code review of:
- `backend/src/application/comments.app-service.ts`
- `backend/src/routes/api/v1/comments.routes.ts`
- `backend/src/database/models/comment_*.ts`
- `backend/src/types/comments.ts`
- `packages/api-contracts/src/comments.ts`
- `frontend/src/api/comments/**`
- `frontend/src/components/study/document/CommentsRail.tsx`
- `frontend/src/components/study/document/sectionLabels.ts`

All implementations conform to design requirements. No defects requiring code changes.

## Permission Matrix

| Role | Read | Create | Reply | Edit | Resolve | Reopen |
|------|------|--------|-------|------|---------|--------|
| Collaborator | YES | YES | YES | Own only | NO | NO |
| Thread author | YES | YES | YES | Own only | YES | YES |
| Study owner | YES | YES | YES | Own only | YES | YES |
| Non-collaborator | NO | NO | NO | NO | NO | NO |

**Implementation**: `computeThreadPermissions()` at line 74-87 of comments.app-service.ts

## OCC / Stale Edit

- 409 COMMENT_EDIT_CONFLICT: YES (commentEditConflict at line 490-493)
- Draft preservation: YES (EditConflictError.submittedBody)
- Server content preservation: YES (no automatic retry, user must refetch)
- Silent retry: NO (retry: false in useEditCommentMessage)

## Optimistic Rollback

| Operation | Rollback | Evidence |
|-----------|----------|----------|
| Create | YES | mutations.ts lines 177-195 |
| Reply | YES | mutations.ts lines 287-295 |
| Resolve | YES | mutations.ts lines 529-559 |
| Reopen | YES | mutations.ts lines 730-760 |

## History Preservation

- Resolve/reopen sequence: VERIFIED (events appended, never deleted)
- Events preserved: YES (comment_thread_events table, append-only)
- Thread/messages preserved: YES (no hard delete, status lifecycle only)

**Implementation**: Event creation in resolveCommentThread (line 551-558) and reopenCommentThread (line 621-628)

## Orphan Handling

- Persistence: YES (threads remain with original section_key)
- API returns: YES (no filtering by section validity)
- UI displays: YES (getSectionLabel fallback to "Older section")
- No reassignment: VERIFIED (section_key never modified after creation)

## Canonical Isolation

| Check | Status |
|-------|--------|
| Canonical content unchanged | VERIFIED |
| artifact_version unchanged | VERIFIED |
| artifact save not triggered | VERIFIED |
| Markdown projection not triggered | VERIFIED |
| GitHub sync not triggered | VERIFIED |
| approval state unchanged | VERIFIED |

**Evidence**: Comments app-service header (lines 8-16) explicitly documents isolation constraints. No imports from artifact save, projection, or approval services.

## Responsive / Browser Evidence

| Viewport | State | Screenshot | Status |
|----------|-------|------------|--------|
| 1440 | Brief All comments | 1440-brief-all-comments.png | PASS |
| 1440 | Brief section-scoped | 1440-brief-section-comments.png | PASS |
| 1440 | Brief resolved | 1440-brief-resolved.png | PASS |
| 1440 | Plan Comments | 1440-plan-comments.png | PASS |
| 1280 | Brief Comments | 1280-brief-comments.png | PASS |
| 1100 | Brief overlay | 1100-brief-comments-overlay.png | PASS |
| 980 | Brief section comments | 980-brief-section-comments.png | PASS |
| 768 | Brief Comments | 768-brief-comments.png | PASS |
| 390 | Brief section-scoped | 390-brief-section-comments.png | PASS |
| 390 | Brief create | 390-brief-create.png | PASS |
| 390 | Brief resolved | 390-brief-resolved.png | PASS |

**Additional evidence**: CMT-6 (11 screenshots), CMT-7 (11 screenshots)

## Accessibility

- Keyboard reachable: YES (buttons, toggles, forms all focusable)
- Focus management: YES (aria-expanded, aria-controls on threads)
- Escape dismissal: YES (tested in QA)
- Focus return: YES
- Form labels: YES (Textarea, Select components)
- axe coverage: PASS (BriefDocument.a11y.test.tsx, PlanDocument.a11y.test.tsx)

## Automated Verification

| Suite | Tests | Status |
|-------|-------|--------|
| API contracts typecheck | - | PASS |
| Backend unit tests | 985 | PASS |
| Backend integration tests | 851 | PASS |
| CMT-1 service tests | 13 | PASS |
| Workspace comments integration | 108 | PASS |
| Frontend comments data tests | 30 | PASS |
| CommentsRail tests | 28 | PASS |
| Section affordances tests | 32 | PASS |
| Frontend total | 481 | PASS (1 skipped) |
| Frontend typecheck | - | PASS |
| Production build | - | PASS |

## Acceptance Matrix

### Backend
- Schema: PASS
- Authorization: PASS
- OCC: PASS
- Audit history: PASS
- Filtering: PASS
- Public IDs: PASS
- Canonical isolation: PASS

### Data Layer
- Optimistic create: PASS
- Optimistic reply: PASS
- Optimistic resolve: PASS
- Optimistic reopen: PASS
- Rollback: PASS
- Conflict handling: PASS
- Cache isolation: PASS

### UI
- Artifact toggle: PASS
- Open count: PASS
- All comments: PASS
- This section: PASS
- Create: PASS
- Reply: PASS
- Edit: PASS
- Resolve: PASS
- Reopen: PASS
- Show resolved: PASS
- Orphan presentation: PASS

### Brief
- Comments: PASS
- Review unaffected: PASS
- Approval unaffected: PASS
- Edit mode safe: PASS

### Plan
- Comments: PASS
- No Review: PASS
- No approval: PASS
- Edit mode safe: PASS

### Responsive
- 1440: PASS
- 1280: PASS
- 1100: PASS
- 980: PASS
- 768: PASS
- 390: PASS
- No horizontal overflow: PASS

### Accessibility
- Keyboard: PASS
- Focus: PASS
- Escape: PASS
- Focus return: PASS
- Forms: PASS
- axe: PASS

### Truth / Isolation
- Canonical content unchanged: PASS
- Artifact version unchanged: PASS
- GitHub sync not triggered: PASS
- Approval unchanged: PASS

## Diff Audit

Production code changed: **NO**

This CMT-8 branch contains QA evidence only (screenshots + acceptance report). No production code modifications were required because no defects were found during the audit.

Unexpected files: NONE
Main touched: **NO**

---

**CMT-8 FINAL QA PASS — COMMENTS MVP READY FOR RELEASE REVIEW**
