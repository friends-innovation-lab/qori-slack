# Implementation Handoff — Brief + Plan Document Workspace

## Architecture rules (non-negotiable)
1. **Section parity:** the Workspace Brief/Plan must contain the same substantive sections, in the same order, as the generated GitHub artifacts. Section order is owned by the YAML `output_template` (`research_brief.yaml` v7.1, `research_plan.yaml` v7.2); the frontend must not reorder or omit.
2. **Canonical flow:** Workspace edit → canonical Qori structured state → deterministic Markdown render → update the SAME GitHub artifact. Arbitrary Markdown is never persisted as canonical state.
3. **GitHub is a projection, not the canonical source.** Sync failure never blocks Workspace editing.
4. **Brief is approval-gated; Plan is not.** The Brief is the only approval gate in the study lifecycle.

## Component / block inventory
- `ArtifactDocShell` — breadcrumb + page head (title, status pill, GitHub link, save-state, mode actions) + artifact tablist + alert slot + document/rail flex row
- `ArtifactEditor` — TipTap instance, whole-document editable toggle
- `EditToolbar` — sticky formatting toolbar (edit mode only)
- `SectionHeading` (with `ProvenanceTag`), `IdTag`, `StructuredItemRows`, `StructuredTable`, `FactsGrid`, `ResearchPeriod`, `SystemDetails` (collapsed metadata sections), `Masthead`
- `ReviewRail`, `ApprovalCard`, `FeedbackCard`, `AlertBanner` (USWDS variants)
- `SaveStateIndicator` — staged pipeline indicator

## Expected TipTap node types & attributes
| Node | Attrs | Notes |
|---|---|---|
| `qoriDoc` | `artifactType` ('research_brief'\|'research_plan'), `templateVersion`, `studySlug` | root |
| `qoriSection` | `sectionId` ('summary','problem','p-timeline'…), `provenance` ('canonical'\|'generated'\|'system'), `order` | non-draggable, non-deletable; owns heading |
| `qoriProse` | — | rich text inside generated sections; marks: bold, italic, link, superscript (citations) |
| `qoriStructuredItem` | `stableId` ('OBJ-001'…), `kind` ('objective'\|'question'\|'barrier'\|'deliverable'\|'risk'), `priority?`, `source?` | text content editable; ID chip is an atomic leaf |
| `qoriIdTag` | `stableId` | atomic inline leaf; not deletable independently; future click target |
| `qoriTable` | `binding` ('risks'\|'segments'\|'commitments'\|'timeline') | cell editing only where row provenance allows |
| `qoriSystemBlock` | `blockType` ('facts'\|'timeline'\|'masthead'\|'checklist'\|'period') | atomic, `contenteditable=false` |
| `qoriCitation` | `marker` ('[D1]'…), `sourceRef` | inline atomic superscript |

## Content provenance — who may edit what
| Class | Blocks | Edit behavior |
|---|---|---|
| **Editable canonical** | Objectives (OBJ), research questions (RQ), target barriers (TB), participant segments, out-of-scope items, risk rows, deliverable rows | Inline editable. Text edits mutate the canonical structured object; the ID never changes. Add/remove allocates/retires IDs server-side — never renumbers. In the PLAN, objectives/questions render read-only (inherited from the approved brief; edited upstream). |
| **Generated, editable** | Summary, problem narrative, background, method prose, participant prose, deliverables narrative | Inline editable. Edit overwrites the stored prose value for that section; edited prose is canonical after save. A future "regenerate" affordance may restore AI output. |
| **Read-only / system** | Title, masthead, quick-facts grid, compensation math, timeline table + research period, approval checklist, brief-commitments table, validity checklist, provenance, document information | Not editable in the document. Rendered from computed/handler values. Timeline changes happen through study settings, not free text. |

## Stable ID handling
- Presentation: system monospace stack, 13px, ink-2 `#3d4551`, leading position on the item; hover = light blue tint + tooltip
- IDs are assigned by the handler (mechanical, sequential) at generation; the frontend NEVER mints, renumbers, or reuses IDs
- Serialization: `qoriStructuredItem` nodes round-trip to their canonical objects keyed by `stableId`

## Structured data → document rendering model
The TipTap doc is a **projection** of canonical state, built per artifact type from: (1) the section order in the YAML output_template, (2) canonical structured arrays (objectives, questions, barriers, risks, phases…), (3) stored prose values per generated section, (4) computed/system values (facts, compensation, period). Save serializes editable nodes back to their structured fields; the deterministic Markdown renderer then re-renders the artifact from canonical state — the Workspace never writes Markdown directly.

## States developers must implement
See `state-matrix.md`. Machines: mode (view/edit), save pipeline (saved→dirty→saving→rendering→pushing→synced, + failure branches), brief approval (pending→approved | changes-requested→revise→resubmitted), staleness (approved+save→approved·edited).

## Known gaps from CD design
- `design/workspace/` and `frontend/src/` not visible on `qori-slack@main` at design time — reconcile component names against the implementation branch
- Save-failure and sync-failure visuals are specified (interaction-model.md) but not built as HTML states
- Confirm-discard dialog on Cancel-while-dirty specified, not built
