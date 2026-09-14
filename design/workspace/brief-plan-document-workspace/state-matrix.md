# State Matrix — Brief + Plan

| State | Visible controls | Editable content | Status messaging | Allowed actions | Forbidden actions |
|---|---|---|---|---|---|
| **Brief draft** (pre-submit) | Edit, Submit for approval, GitHub link | — (until Edit) | Gray "Draft" pill · Saved | Edit, submit, navigate | Approve/request changes (no reviewer yet) |
| **Brief pending approval** | Edit, GitHub link; rail: Approve, Request changes | — | Gold "Pending approval" pill · info banner | Reviewer: approve / request changes. Researcher: edit (returns to pending), navigate | Generate plan (blocked until approved) |
| **Brief changes requested** | Revise, Resubmit, GitHub link; rail: feedback cards | — (until Revise) | Red "Changes requested" pill · error banner (reviewer, date, count) · flagged sections | Revise (→ edit), resubmit, read feedback | Approve (reviewer must re-review after resubmit) |
| **Brief approved** | Edit, GitHub link; rail: approved card | — (until Edit) | Green "✓ Approved" pill · success banner · checklist checked | Edit (triggers stale warning on save), open plan | Request changes (approval is settled; changes go through re-review) |
| **Brief editing** | Cancel, Save (disabled until dirty), toolbar | Canonical + generated blocks; system blocks locked | "Unsaved changes" once dirty · provenance tags visible | Type in editable blocks, save, cancel | Navigate tabs, approve, resubmit, edit system blocks |
| **Brief save pending** | none (controls suppressed) | frozen | Staged: Saving to canonical state… → Rendering artifact… → Updating GitHub projection… | wait | any input |
| **Brief save failed** | Retry (Save re-enabled), Cancel | still editable — content intact | Red "Save failed — retry" at failed stage | retry, keep editing, cancel | silent data loss; partial canonical writes |
| **Plan view** | Edit, GitHub link | — | Gray "Current · v1" pill · Saved | Edit, navigate | Approve / request changes (Plan has NO approval gate) |
| **Plan editing** | Cancel, Save (disabled until dirty), toolbar | Generated prose + plan-owned canonical rows; inherited objectives/questions and system blocks locked | "Unsaved changes" once dirty | Type, save, cancel | Edit inherited OBJ/RQ (upstream in Brief), edit timeline table |
| **Plan save pending** | none | frozen | Same staged pipeline as Brief | wait | any input |
| **Plan save failed** | Retry, Cancel | still editable — content intact | Red "Save failed — retry" | retry, keep editing, cancel | silent data loss |

Cross-cutting: GitHub-sync-failed variant (canonical saved, projection pending) shows "Saved — GitHub sync pending · Retry" and never blocks further editing. Brief edited after approval → "Approved · edited" pill + stale-cascade warning banner.
