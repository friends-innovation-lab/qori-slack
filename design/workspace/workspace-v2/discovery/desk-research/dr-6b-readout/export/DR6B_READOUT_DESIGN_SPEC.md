# DR-6b — Desk research · AI-assisted Readout (Revision 2)

Status: **DR-6b CD DESIGN REVISION — READY FOR OWNER AND ARCHITECTURE REVIEW.** Design only. No implementation authorization. No code, API, schema, migration or production component changes are implied as done. Do not hand off to Claude Code.
Screens: `screens/00 Index.html`. Builds on SPEC-2 (`../DESK_RESEARCH_DESIGN_SPEC.md`, DR01–DR11 — unchanged), NAV-1 and Discovery (`../../screens/`).
Repository reviewed read-only: `friends-innovation-lab/qori-slack@dev` (tree 49593a1e9620, 2026-10-13). Nothing in the repo was changed.

Principle: **AI drafts. Researchers decide. Evidence stays traceable.**

## 0. Change log (Rev 1 → Rev 2)
| Screen | Change |
|---|---|
| All RO screens | Canonical IDs `IN-0001 r1`, `RO-0001` (was `IN-01`, `RO-01`). Findings carry an "Evidence-supported" kind label. "Gaps and limitations" renamed **Evidence limitations**. Save state copy matches `SaveStateIndicator` ("Saved · 10:42 AM"). |
| RO01, RO02 | Mast states study ownership: "Readouts · Study · Status page usability — Cite accepted insights from any study in Claim Status Experience". |
| RO03 | Study meta in mast; eligibility copy names the project boundary; cross-study insight shows "Added in study · …" (needs data, §7). |
| RO04a, RO04b | Study meta. RO04b note restates server validation scope. |
| RO05, RO06, RO07, RO10a | Study meta. New section **4 Implications for the Research Brief** (Q1, G1, P1, H1) with kind labels, "Suggested by Qori", per-item Reviewed checkbox, "Based on" finding links + insight citations. Evidence → §5. RO10a concurrency note uses `expectedVersion`. |
| RO08 | Study meta. New check group **3 Implications** (links + reviewed; H1 blocks). Validation copy states what the server checks and that it does not judge truth. Summary counts implications. |
| RO09 | Same as RO08, resolved. Dialog adds: approval doesn't change the brief; what was and wasn't checked. Role note uses `canReview` roles. |
| RO10b | Implications read-only. View-only copy matches `useProjectPermissions` reasons. |
| RO11 | Study meta. Read-only Implications with brief notice + "Open Research Brief" (navigation only). Evidence §5, Provenance §6. |
| RO12 | Readout row names the study. "Into the brief" gains one pointer sentence. Annotation states manual handoff. |
| RO00, RO13 | Index revision note. RO13 unchanged (frames pick up changes). |
| DR01–DR11 | Unchanged. The Readouts tab remains a proposal (D-RO1). |

## 1. Owner decisions — resolved
- **R1 Ownership.** A readout belongs to **one study**. Its evidence set may include eligible accepted Desk research insights from **any study in the same project**. Insights from other projects are never listed or citable. Shown in every RO mast as "Study · {name}".
- **R2 Implications for the Research Brief** is a required section (§3).
- **R3 Brief handoff is manual** for MVP (§6). No auto-population, one-click transfer, sync, or brief approval effect.
- **R4 Safeguards kept**: pinned immutable accepted revisions; withdrawn citation blocks; newer accepted revision requires a decision; findings checked before approval; approval freezes; later evidence changes flag out of date. Server validation checks citation identity, project scope, revision state and approval eligibility — **never the truth of narrative**.
- **R5 Explicit Save draft** remains separate from Approve.

## 2. User journey & navigation
1. Study › Discovery › Desk research › **Readouts** (RO01/RO02) → New readout.
2. Confirm title, optional question, evidence set (all eligible pre-selected) (RO03).
3. Generate → progress / failure (RO04a/b). Output is always Draft v1, not approved.
4. Edit, inspect citations, check findings, review implications, save (RO05–RO07, RO10a/b).
5. Review (RO08) → explicit confirm (RO09) → Approved vN, read-only (RO11).
6. Consult the approved readout while working on the study's Research Brief; enter what you choose through the brief editor (RO11, RO12).

Routes (proposed, all under the existing `studies/:studyPublicId` layout route in `frontend/src/App.tsx`): `discovery/desk/readouts`, `…/readouts/new`, `…/readouts/:id`, `…/readouts/:id/draft`, `…/readouts/:id/review`. Existing `discovery/desk` and `discovery/desk/sources` are untouched.

## 3. Document structure
| § | Section | Kind | Editable | Rule |
|---|---|---|---|---|
| — | Title, Question | researcher | yes | Question prefilled from project problem statement |
| 1 | Summary | narrative | yes | may cite |
| 2 | Findings F1… | **Evidence-supported** observation | yes | ≥1 citation each; Checked required |
| 3 | Evidence limitations L1… | metadata statements | yes | from sources/locators only; no new findings |
| 4 | **Implications for the Research Brief** | recommendation / hypothesis | yes | ≥1 linked finding each; Reviewed required |
| 5 | Evidence | canonical records | **no** | generated from pinned revisions |
| 6 | Provenance | system | no | approved versions only |

**Implication kinds** (mono label, text always carries meaning): `Suggested research question` (Q), `Knowledge gap · needs primary research` (G), `Recommended priority` (P) — all brand-text; `Hypothesis · not yet supported by evidence` (H) — text-meta with dashed underline. Findings use `Evidence-supported` (success). Every implication shows "Suggested by Qori" until edited and a **Based on** line: finding links (`.flink`, outlined, navigates within the document) then insight citation chips (`.cite`, pinned revision). A gap may have no single insight ("derived from findings"). Implications are never phrased as facts.

## 4. Component redlines (readout.css)
RO1 ReadoutRow · RO2 Toolbar · RO3 Draft line · RO4 NarrativeBlock · RO5 CitationChip · RO6 Evidence table · RO7 EvidenceSelectRow · RO8 ReviewCheck · RO9 Approved document — unchanged from Rev 1 except:
- **RO4b Kind label** `.kind` mono 11/600 .12em uppercase; `.obs` success, `.rec` brand-text, `.hyp` text-meta + dashed underline.
- **RO4c Based-on** `.basedon` 12/18 muted; `.flink` h20, mono 11/600, 1px border-emphasis ring, surface — visually distinct from citation chips (which are tinted) because findings are document-internal, citations are canonical records.
- Implication blocks are NarrativeBlocks (dashed until edited) with "Reviewed" instead of "Checked against evidence".
- Save state labels follow `SaveStateIndicator`: `Saved · {h:mm AM}`, `Unsaved changes`, `Saving...`, `Save failed — retry`; conflict uses "Not saved · newer version exists".

## 5. Interaction & validation
- **Eligibility** = insight in the readout's project ∧ status `accepted` or `accepted_with_pending` ∧ not withdrawn; cite `acceptedRevisionNumber`. Pending revisions never count.
- **Citations** are atomic tokens inserted from the evidence set; serialized as {insight public ID, revision public ID}.
- **Issues** (editor Issues tab, review page, server at approval):
  - Withdrawn cited insight → blocks.
  - Newer accepted revision → choose: cite rM or keep rN with note.
  - Finding without citation, or not Checked → blocks.
  - Implication without a linked finding, linked to a removed finding, or not Reviewed → blocks.
  - Citation outside the project or not at an accepted revision → rejected by server.
- **Server validation scope** (shown in RO08/RO09 copy): citation identity, project scope, revision state, withdrawal, approval eligibility, version match. It does **not** assess whether narrative or implications are true — that is the researcher's review.
- **Save** explicit, never approves; leave guard; 409 → keep text, compare, three actions. **Regenerate** always creates a new version, implications included; edits not copied.
- **Approval** one confirm; records approver, time, note, version, pinned revisions. Freezes the version. Does not publish and does not change the Research Brief.
- **After approval** evidence changes flag out of date; text never rewritten.
- **Permissions** reuse `useProjectPermissions().canReview` (owner, admin, researcher) for edit/regenerate/approve. Everyone with project access can read.

## 6. How the approved readout informs — and never modifies — the Research Brief
- The readout and the brief are separate artifacts of the same study. The readout never writes to brief fields (`research_questions`, `target_barriers`, `discovery_sources`, prose sections) and never changes `brief_status` (`pending_approval · changes_requested · approved`).
- Where the relationship is shown: RO11 Implications notice ("Approving this readout didn't change the Research Brief…") with an **Open Research Brief** link that only navigates; RO12 Discovery Overview "Into the brief" sentence and the Approved readouts section.
- The researcher reads Q/G/P/H items, decides which to use, and enters them through the brief's existing editor and approval flow (`BriefDocument` + `useApproveBrief`). Any wording carried over becomes brief content owned by the brief's provenance, not a live link.
- Not designed (out of scope): auto-population, "send to brief", copy buttons, background sync, brief approval effects, brief-side readout panel (see D-RO9).

## 7. Repository review — fit and mismatches (read-only, `dev`)
| # | Finding | Repo evidence | Design adjustment |
|---|---|---|---|
| M1 | Lifecycle rail already has **Outputs › Readouts** (placeholder). A Desk research "Readouts" tab risks two different "Readouts". | `frontend/src/components/study/workspaceLifecycle.ts` (Outputs group) | Keep artifact name **"Desk research readout"** in every mast/eyebrow; tab label is owner decision **D-RO13** (keep "Readouts" vs "Desk readouts"). |
| M2 | Desk tabs are defined separately on each page. | `frontend/src/pages/discovery/DeskInsightsPage.tsx` (~L759), `DeskSourcesPage.tsx` (~L211) | Adding the tab touches both pages (proposal; better as one shared tab list). |
| M3 | Desk mast shows the raw project public ID, not the project name. | `DeskInsightsPage.tsx` ~L728, `DeskSourcesPage.tsx` ~L178 ("Project · {projectPublicId}") | RO masts show study and project **names**; `ProjectMembership.project_name` / `StudyResource.name` exist. Flag for SPEC-2 owner. |
| M4 | Display ID is `IN-0001`. | `packages/api-contracts/src/insights.ts` `InsightSummary.displayId`; `InsightRow.tsx` | Applied everywhere. `RO-0001` mirrors it (D-RO7). |
| M5 | Insights are project-scoped; no origin-study field. | `insights.ts` (`projectId`, no study); `api/insights/client.ts` `projects/:id/insights` | Ownership fits. "Added in study · …" on RO03 **needs a new field** (proposed); fallback: omit. |
| M6 | Eligibility data exists: `status`, `acceptedRevisionNumber`, `withdrawnAt`, revision `publicId`. | `insights.ts` | Pin by revision public ID. Confirm whether `status=accepted` filter includes `accepted_with_pending` (D-RO14). |
| M7 | Concurrency is integer `version` / `expectedVersion`; 409 `CONCURRENCY_ERROR` returns `currentVersion`. | `insights.ts`, `api/insights/types.ts` | RO10a uses the same pattern. |
| M8 | Permissions are project-level only (`owner/admin/researcher` → `canReview`). No study-level roles. | `frontend/src/hooks/useProjectPermissions.ts` | Study-owned readouts are gated by project role. Copy aligned to existing reasons. |
| M9 | Save state component and labels exist. | `components/study/document/SaveStateIndicator.tsx` | Toolbar copy aligned. Reuse component. |
| M10 | Brief approval = `POST studies/:id/brief/approve {checklist_confirmed}`; statuses `pending_approval/changes_requested/approved`; brief has structured `research_questions` {id, question, priority} and `discovery_sources`. | `api/mutations/useApproveBrief.ts`, `api-contracts/src/responses.ts`, `api-contracts/src/enums.ts` | Manual handoff only; readout never touches these. Q items map naturally to `BriefQuestion` but are **not** written. |
| M11 | Provenance labels exist (`GENERATED`, `CANONICAL`, `READ-ONLY · SYSTEM`). | `components/study/document/ProvenanceTag.tsx` | Optional: section-level provenance on RO §5/§6 via `ProvenanceTag`; per-block origin stays `.ptag`. |
| M12 | Reference navigation + ContextRail exist for in-document references. | `components/study/workspace/ContextRail.tsx`, `ReferenceNavigationProvider.tsx`, `document/ReferenceLink.tsx` | Evidence panel = ContextRail; finding links may reuse reference navigation. |
| M13 | Generic `ArtifactResource` has `study_public_id` + `project_public_id`. | `api-contracts/src/responses.ts` | Candidate home for readouts (architecture decision; nothing assumed). |
| M14 | Evidence references carry `validation` (`verified`, `source_attributed_unverified`, `ai_unverified`). | `insights.ts` `EvidenceReference` | Inspector could show it; not designed (D-RO15). |
| M15 | Withdrawal reason is required (D6). | `insights.ts` comments | RO08 shows the reason. Fits. |

Everything for readouts themselves (entity, versions, citations, generation job, validation, approval record, out-of-date flag, list endpoint) **does not exist** and is proposed.

## 8. Accessibility & responsive
Unchanged from Rev 1, plus: kind labels are text (not color); `.flink` has `aria-label="Based on finding F2"`; Reviewed/Checked checkboxes are labelled; implication sections reflow like findings at ≤767 (Based-on line wraps under text).

## 9. Remaining decisions (owner or architecture)
- **D-RO1** Readouts tab on Desk research (only proposed change to SPEC-2 screens; touches two pages, M2).
- **D-RO2** Default evidence selection: all eligible (designed) vs none.
- **D-RO3** Server-side citation check — architecture (scope fixed by R4).
- **D-RO4** Findings "Checked" and implications "Reviewed" required (designed) vs optional.
- **D-RO5** Keeping a superseded revision with a note vs forcing update.
- **D-RO6** May the last editor approve their own draft; one approver (designed) vs two.
- **D-RO7** `RO-0001` per study, never reused.
- **D-RO8** Explicit save (designed) vs autosave.
- **D-RO9** Any brief-side surface (e.g. read-only "Readouts to consult" link on the brief). Not designed.
- **D-RO10** Cancel generation. Not designed.
- **D-RO11** *Resolved by R1.*
- **D-RO12** Archive/delete readouts. Not designed.
- **D-RO13** Tab label vs Outputs › Readouts placeholder (M1).
- **D-RO14** Eligibility filter for `accepted_with_pending` (M6) — architecture.
- **D-RO15** Show evidence `validation` state in the inspector (M14).
- **D-RO16** Origin-study field for cross-study insights (M5) — architecture.
- **D-RO17** Storage: generic Artifact (M13) vs dedicated readout entity — architecture.

## 10. Future-only
Per-section redraft · comments/presence (comments API exists for artifacts) · export/share · version diff · restore past approved versions · bulk citation update · jump-to-passage · brief-side readout panel.

## 11. Handoff notes (after owner approval only)
Reuse DR2/DR3/DR4/DR7, `.pl`, `.alert`, `.notice`, `.histpop`, `.ledger`, `SaveStateIndicator`, `ContextRail`, `useProjectPermissions`. New: RO2, RO4/4b/4c, RO5, RO7, RO8, RO9. Never write to brief fields; never approve on save; regenerate only creates a version; every write sends `expectedVersion`; every approval re-validates server-side. All §7 "proposed" items are for architecture review, not existing contracts.
