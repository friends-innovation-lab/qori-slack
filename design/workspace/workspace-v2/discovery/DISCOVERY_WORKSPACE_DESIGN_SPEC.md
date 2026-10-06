# Qori Discovery Workspace — Design Specification

Status: APPROVED
Role: UX/UI implementation authority for Qori Workspace Discovery
Scope: Discovery Workspace experience
Architecture authority: Qori Discovery architecture/domain specifications
Implementation rule: Where this design document conflicts with canonical domain behavior or API truth, implementation must stop and reconcile the conflict rather than inventing behavior.

Revision: 2 (2026-10-06). This revision reconciles the spec with DISC-0, DISC-1 and DISC-2 (see §16), adds milestone phasing (§20) and binds the visual redlines (§21).
Companion authority: `DISCOVERY_REDLINES.md` (exact visual values) and `screens/` (static hi-fi reference screens). Together with this document they form one design authority.
Researched against `friends-innovation-lab/qori-slack@dev` (tree e8feb5d5fa2b), 2026-10-05.
Continues the Workspace v2 system (UX-3A.1 visual convergence, VC-2A landed: grouped lifecycle in `workspaceLifecycle.ts`, filtered workspace rail in `SideNav.tsx`).

---

## 1. Design Thesis

**Discovery is a ledger with a reading room. It is not a dashboard.**

What a researcher needs from Discovery is accountancy: what came in, what Qori did with it, what is waiting on them, and what the evidence adds up to. So the Discovery hub reads like the Brief and Plan. It sits on the same document canvas, in the same serif reading column, with the same section rhythm. It is a ledger of evidence, not a grid of tiles. Operational detail (files, gates, statuses) appears as dense, scannable rows. Interpretation (themes, gaps, synthesis) appears as readable prose. These two registers never share a container, so a researcher can always tell the difference between a fact about the workflow and a claim about the world.

Three layers, always named the same way and always visible in the same order:

```
SOURCES            →   DISCOVERY RUNS / ARTIFACTS      →   CROSS-SOURCE SYNTHESIS   →   BRIEF
what came in           what Qori did with each set          what it adds up to           what we'll study
(files, CSV)           (desk · stakeholder · survey)        (researcher-triggered)       (researcher-selected)
```

Provenance is how the researcher moves backwards through those layers. Every synthesized statement carries short markers (`D1`, `S1`, `V1`), and these extend the marker convention that `brief.app-service.ts` already writes into Brief discovery tables. Pressing a marker opens the existing ContextRail in a new **Evidence** mode. The rail walks claim → artifact passage → source file as a breadcrumb trail. It is never drawn as a graph.

Discovery is encouraged and never required. The Brief row in the lifecycle is never locked by Discovery. A Brief always states what informed it, and "Not informed by Discovery" is a stated, neutral fact. It is not a warning.

---

## 2. Existing Workspace Patterns Reused

| Pattern | Repository source | How Discovery uses it |
|---|---|---|
| Three-region workspace frame | `components/study/workspace/WorkspaceLayout.tsx` (+ `.module.css`) | Every Discovery screen. `nav` = LifecycleRail inverse, `header` = ArtifactHeader, `canvas` = document, `rail` = ContextRail |
| Dark 64px app rail | `shell/SideNav.tsx` `variant="inverse"`, `workspaceNavItems` | Unchanged |
| Grouped lifecycle panel | `study/LifecycleRail.tsx` inverse + `workspaceLifecycle.ts` | Discovery group rows go from placeholder to route (§3.2) |
| Breakpoints | `hooks/useMediaQuery.ts` `WORKSPACE_BREAKPOINTS` (1180 / 980 / 767) | Same thresholds, same drawer/overlay/sheet behavior |
| Tabbed side panel | `study/workspace/ContextRail.tsx` (`RailModeId`, tablist, Escape, focus return) | Adds mode `evidence`; reuses `comments` |
| Cross-artifact navigation + return | `study/workspace/ReferenceNavigationProvider.tsx`, `document/ReferenceLink.tsx` | Marker → artifact passage navigation with "Return to synthesis" |
| Trusted-label rule | `ReferenceLink.getDisplayLabel` ("never humanize raw keys"), `sectionLabels.ts` | The same rule for Discovery section anchors and source labels |
| Document canvas | `document/Masthead.tsx`, `FactsGrid.tsx`, `DocumentSection.tsx`, `CollapsibleSection.tsx`, `DocumentTable.tsx`, `document.module.css` | Hub, run pages, survey summary, synthesis |
| Provenance labels | `document/ProvenanceTag.tsx` (renders `FieldProvenance.label` verbatim) | "COMPUTED · DETERMINISTIC" vs "GENERATED" vs "RESEARCHER" |
| Stable IDs | `document/IdTag.tsx` (mono tag) | Discovery markers `D1`, `S1`, `V1`, `X1`; claim IDs `X1-K03` |
| Prefill-with-provenance fields | `ui/ProvenanceField.tsx` | Problem statement on intake forms; Discovery-prefilled Brief fields |
| Status | `ui/StatusBadge.tsx` (icon + glyph + text, never color alone) | New statuses added to config (§15) |
| Markdown rendering | `editor/MarkdownDisplay.tsx` | Renders the existing YAML-produced Discovery markdown |
| Feedback | `ui/Alert`, `EmptyState`, `ErrorState`, `Skeleton`, `Button`, `Input`, `Textarea`, `Select` | All forms and states |
| Tokens | `styles/tokens.css` (paper, hairline, ink 1–5, brass, good/crit/info; Instrument Sans / Source Serif 4 / JetBrains Mono) | No new colors. Brass = researcher attention, info = Qori working, good = done, crit = failure |
| Tabs inside an artifact | `document/ArtifactTabs.tsx` | Run page: Report · Sources · Extracted |

Domain patterns preserved verbatim: Slack field labels ("What topic are you exploring?", "What do you need this source to tell you?"), file limits (10 files; pdf/docx/doc/txt/md; CSV for surveys), PII statuses (`pending/clear/redacted/restricted`), entry review statuses (`reviewed/no_grouping_applies/uncodable`), code origins (`qori_proposed/researcher_added/inherited`), the researcher-facing term "Response groups" (rev3: "codebook" stays internal), the bulk-never-touches-flagged invariant, and the gate order enforced by `surveySynthesisAction.ts`.

---

## 3. Discovery Information Architecture

### 3.1 Flow

```
Project intake (problem_statement — required, NewProject.tsx)
        │
        ▼
┌──────────────────────────── DISCOVERY (project-scoped) ───────────────────────────┐
│                                                                                   │
│  Add evidence ──► Desk run ─────────┐                                             │
│               ──► Stakeholder run ──┼──► Artifacts D1, S1, V1 … (each "Ready")    │
│               ──► Survey run ───────┘        │                                    │
│                    (Fields → Privacy →       │  researcher selects ≥2             │
│                     Groups → Matches →       ▼                                    │
│                     Summary)          Cross-source synthesis X1 (optional)        │
│                                              │                                    │
└──────────────────────────────────────────────┼────────────────────────────────────┘
                                               ▼
                   Brief intake: "What informs this brief?"
                   ( ) Synthesis X1   ( ) Selected artifacts   ( ) No Discovery
                                               │
                                               ▼
                                        Research Brief → Plan → …
```

### 3.2 Lifecycle navigation change (the one navigation change)

The Discovery group in `WORKSPACE_LIFECYCLE` currently holds three placeholders: Desk Research, Stakeholders and Surveys. The proposal makes them routes and adds two rows:

```
DISCOVERY
  All evidence          ← NEW row: the hub
  Desk Research     2
  Stakeholders      1
  Surveys           1 ●  ← brass dot = something needs your review
  Synthesis             ← NEW row: cross-source synthesis
PLANNING
  Research Brief
  …
```

- Row anatomy, height, 2px brass active rule and typography follow LIFECYCLE_NAV_CONVERGENCE.md unchanged.
- **Counts settle the open VC-2A decision on Discovery counts.** A count is the number of artifacts of that type in **Ready** state, taken from the list endpoint. A placeholder row shows no count. Zero shows no count, not "0".
- The **needs-review dot** is a 6px brass dot after the count, with sr-only text ", 1 needs your review". It is the only attention signal in the panel.
- Discovery rows **never lock**, and Discovery state never locks Research Brief.
- Before DISC-5, "Synthesis" renders as a dim, non-interactive placeholder (the LIFECYCLE_NAV_CONVERGENCE option B rule).
- "Synthesis" shows a state glyph only: a check when current, a small "stale" ring when inputs have changed (sr: ", out of date"), and nothing when none exists.
- Type rows (Desk Research, etc.) open the hub filtered to that type. They are views of one ledger, not separate products.

### 3.3 Scope and routes

Discovery data is **project-scoped**: `evidence_sources.study_id IS NULL`, `loadDiscoveryArtifacts(projectId)`, files at `{projectSlug}/00-discovery/`. The workspace frame is study-scoped (`/studies/:studyPublicId/*`), and Phase 2D runs one study per project. Discovery pages therefore live under the study route for frame continuity, and the header states the scope ("Project discovery · shared by all studies in {Project}").

| Route (under `/studies/:studyPublicId`) | Screen |
|---|---|
| `/discovery` | Hub: all evidence |
| `/discovery?type=desk\|stakeholder\|survey` | Hub filtered (from the type rows) |
| `/discovery/new/:type` | Add evidence |
| `/discovery/runs/:runId` | Run page (desk/stakeholder) or survey run, Report tab |
| `/discovery/runs/:runId/sources` | Run page, Sources tab |
| `/discovery/runs/:runId/extracted` | Run page, Extracted tab |
| `/discovery/runs/:runId/{fields\|privacy\|groups\|matches\|summary}` | Survey stage |
| `/discovery/synthesis` | Current synthesis, or empty/selection state |
| `/discovery/synthesis/new` | Select artifacts and run |
| `/discovery/synthesis/:synthesisId` | A specific (incl. superseded) synthesis |

Source detail has no route. It lives in the Evidence rail and is deep-linkable via `?evidence=source:{publicId}`.

---

## 4. Discovery Hub

### 4.1 Layout

```
┌──┬────────────────┬──────────────────────────────────────────────┬────────────┐
│  │ DISCOVERY      │ ArtifactHeader                               │ ContextRail│
│  │  All evidence ▌│  Discovery                                   │ (closed by │
│ap│  Desk Res.   2 │  Project discovery · shared by all studies   │  default;  │
│p │  Stakeholders 1│  4 artifacts · 1 needs review · Synthesis    │  Evidence  │
│  │  Surveys    1 ●│  out of date        [Synthesize…] [Add evid.▾]│  / Comments│
│r │  Synthesis   ◌ │──────────────────────────────────────────────│  strip)    │
│a │ PLANNING       │  1  Needs your review                        │            │
│i │  Research Brief│  2  Discovery runs                           │            │
│l │  …             │  3  Across sources                           │            │
│  │                │  4  What we don't know yet                   │            │
│  │                │  5  Into the brief                           │            │
└──┴────────────────┴──────────────────────────────────────────────┴────────────┘
```

**Header** (ArtifactHeader, no new component):
- Eyebrow "Discovery". Title is the project name in display serif.
- Status line, plain ink-3 text: counts, review count, synthesis state. The words carry the meaning, with no badges.
- Primary action: **Add evidence ▾**, a menu button with Documents · Stakeholder material · Survey data (CSV).
- Secondary action: **Synthesize across sources**. It is disabled with an inline reason ("Needs two ready artifacts") when fewer than two are Ready.

**Canvas** sections use the document numbering and serif headings from Brief/Plan.

**§1 Needs your review.** Rendered only when something is waiting. This is a queue, not a card stack:

```
Survey · Benefits satisfaction (V2)     Privacy review — 14 flagged entries     Continue →
Survey · Claims follow-up (V3)          Fields — upload expires in 1 h 38 m      Continue →
Desk · Accessibility policy             Failed — personal information detected  Resolve →
```

Each row reads Object · Gate · Consequence/count · Action. It is sorted by expiry first (survey CSV staging has a 2-hour TTL in `pendingCsvStore.ts`), then failures, then gates.

**§2 Discovery runs.** One DocumentTable grouped by type, with sticky group sub-headers "Desk research", "Stakeholder synthesis", "Survey synthesis".

| Marker | Run (topic) | Sources | Status | Updated | Used by |
|---|---|---|---|---|---|
| `D1` | Accessibility policy review | 3 files | ✓ Ready | Sep 30 | Brief · X1 |
| — | Competitor portals | 5 files | ◷ Analyzing | now | — |
| `S1` | Claims operations interviews | 6 transcripts | ✓ Ready | Sep 28 | X1 |
| `V1` | Post-launch satisfaction | 1 CSV · 412 resp. | ● Matches — your review | Oct 2 | — |

- The run name is a link to the run page. The marker is an IdTag. Markers are assigned once a run reaches Ready and stay stable after that.
- "Used by" lists forward links: the Brief (from `discovery_sources`) and the synthesis id. This answers "what will inform the Brief?" from the ledger side.
- Above 10 rows per group, the group collapses to its 10 most recent with "Show all 23". A filter field (filename/topic) appears once there are more than 15 runs.

**§3 Across sources.** One short prose block, with exactly one of these states:
- No synthesis: "No cross-source synthesis yet. When two or more runs are ready, you can ask Qori to compare them." + link.
- Current: "Synthesis X1 compares D1, S1, V1 (Oct 3)." + the top three "Recommended focus" statements + "Read synthesis →".
- Stale: the same text, plus a brass rule and "V2 became ready after this synthesis. It is not included." + "Synthesize again…".

**§4 What we don't know yet.** Knowledge gaps pooled from Ready artifacts (`knowledge_gaps` is emitted by all three YAMLs). Each gap is a sentence with its marker. The list is collapsible and starts collapsed past five items. It carries the label "GENERATED · from source-specific runs" and is not deduplicated across sources. Deduplication happens in synthesis.

**§5 Into the brief.** One line of state plus an action:
- No Brief: "The brief hasn't been started." → **Start brief** (goes to Brief intake, §10).
- Brief exists: "Brief informed by X1 (D1, S1, V1)." or "Brief not informed by Discovery." → **Open brief**.
- Brief exists and Discovery changed since: "D2 became ready after the brief was generated." This is informational only and offers no action, because Brief regeneration belongs to the Brief workflow.

### 4.2 Empty state (no Discovery yet)

The canvas shows a single explanatory section, not three sales tiles:

> **What do we already know?**
> Discovery collects what exists before you design new research: documents and prior studies, what stakeholders are telling you, and survey data you already have. Qori analyzes each source, and when you're ready, compares them, so your brief starts from evidence.
>
> Desk research: reports, policies, prior studies (PDF, Word, text, Markdown) · **Add documents**
> Stakeholder material: interview transcripts and notes · **Add stakeholder material**
> Survey data: an exported CSV with closed and open-ended questions · **Add survey data**
>
> Discovery is optional. **Start the brief without Discovery →**

The skip link is a quiet text link with equal weight to the explanation. It is never hidden.

### 4.3 Returning state

The hub *is* the returning state. §1 surfaces whatever is waiting, and the header status line states it in one sentence. If nothing is waiting, §1 is absent and the page opens on §2.

### 4.4 Completed state

Discovery has no "complete" state, and Qori never declares one. The furthest state is: all runs Ready, synthesis current, Brief informed. The status line then reads "4 artifacts · Synthesis current · Brief informed by X1". There is no celebration and no checkmark on the group heading.

---

## 5. Adding Evidence

A full-width form on the canvas at `/discovery/new/:type`, not a modal. The ContextRail is closed. One form serves all three types with type-specific fields.

### 5.1 Common fields (verbatim from the Slack contract)

1. **Research problem.** A ProvenanceField, `variant="derived"`: "From project intake". This is read-only and shown because gaps are derived against it. If the project has no problem statement, show an Alert (warning): "Knowledge gaps can't be derived without a project problem statement" with a link to project settings. Submission is still allowed, matching YAML `skip_when`.
2. **What topic are you exploring?** Required. Hint: "Used as the run name". It must contain a letter or number (`slugifyTopic` rule), and the error says so in those words.
3. **What do you need this source to tell you?** Required textarea. Hint: "How this source relates to the project problem. Gaps are derived against this."
4. **Files.** A drop zone plus a "Choose files" button, which is the keyboard path.

### 5.2 Desk research

- Files: up to 10; PDF, Word (.docx/.doc), text, Markdown.
- The file list renders as rows: icon · filename (middle-truncated) · type · size · remove (×, labelled "Remove {filename}"). Rejected files appear inline as a crit row with the reason ("Not a supported type: .pptx"). They are never silently dropped.
- Submit: **Analyze documents**. Cancel returns to the hub.

### 5.3 Stakeholder material

- Same fields and limits.
- Fixed info note above the files, ink-3: "Qori refers to stakeholders by role (SH-001, SH-002), never by name." This states the role-only attribution rule from `stakeholder_synthesis.yaml` up front.
- **Desk context line (DISC-0 confirmed):** Desk Research feeds Stakeholder Synthesis when upstream desk variables exist. Runtime injects desk `discovered_barriers` and `knowledge_gaps`. When this applies, the form shows a second note: "Builds on desk research in this project. Barriers and knowledge gaps from D1 and D2 are given to Qori as context." The stakeholder run masthead repeats it as a fact: "Builds on D1 · D2". The markers come from the API (REDLINES §F-1).
- Submit: **Synthesize stakeholder material**.

### 5.4 Survey data

- Extra fields: **What's the survey called?** (required) and **Which questions should Qori focus on?** (optional textarea; placeholder "e.g., Q5: What was most frustrating?").
- File: **one CSV per survey run** (see §17 D7). The hint says: "CSV only. Export Excel files as CSV first." This fixes the Slack hub copy, which wrongly says "CSV, Excel".
- Submit: **Upload and read fields**. This goes directly to the survey run's Fields stage (§7).

### 5.5 Sequence and states (desk/stakeholder)

```
Form ─submit─► Run page (Report tab shows processing ledger)
                 Uploading 3 files          ✓
                 Reading documents          ✓
                 Privacy check              ✓   ── or ──►  Failed: personal information detected
                 Analyzing                  ◷
                 Extracting for the brief   ·
               ─► Ready (report renders; marker assigned; nav count increments)
```

- Steps appear only if the backend can report them truthfully (§16). Otherwise there are two states: "Analyzing… this usually takes a few minutes" and the outcome.
- The researcher can leave. The run keeps processing and appears in §2 as "◷ Analyzing". Completion announces via the hub's live region if the researcher is on the hub.

### 5.6 Privacy failure (desk/stakeholder)

Current backend behavior is a hard stop (`PrivacyError` with `{label, snippet}` findings). There is no override path, and the design does not invent one.

```
⚠ Qori found possible personal information and did not analyze these files.
  policy-appendix.pdf   Email address   "…contact j••••@va.gov for…"
  notes-0912.docx       Phone number    "…call (•••) •••-4410…"
  Remove or redact the information in your files, then upload them again.
  [Replace files]  [Remove flagged files and retry]  [Delete run]
```

Snippets are masked in the UI. "Remove flagged files and retry" re-submits the remaining files under the same topic and intent.

---

## 6. Source / Discovery Run Experience

### 6.1 Run page (desk, stakeholder, and Ready survey runs)

**Header:** eyebrow is the type ("Desk research"), title is the topic, then the marker IdTag, StatusBadge and "Updated Sep 30 by {actor}". Actions: **Comment** (the existing comments rail) and an overflow menu (Run again with these sources · Delete run).

**ArtifactTabs:** **Report · Sources · Extracted**

- **Report.** A masthead FactsGrid (Research problem · This source contributes · Documents · Date), then the YAML markdown via MarkdownDisplay. Section anchors come from the YAML `##` headings, e.g. desk: Executive Summary, Key Themes, Knowledge Gaps and Research Implications, Sources and Documents. The whole body carries one ProvenanceTag ("GENERATED") at the top. The run page is read-only, because editing generated Discovery artifacts is deferred, as it is in Slack.
- **Sources.** A table with one row per EvidenceSource:

  | File | Type | Added | Privacy | Used in |
  |---|---|---|---|---|
  | accessibility-policy-2025-final-v3-with-appendices.pdf → middle-truncated | PDF | Sep 30 | ✓ Passed | D1 |

  A row opens the source in the Evidence rail (§11). The file name is never truncated for assistive tech.
- **Extracted.** Answers "what will inform the Brief?" for this run. It lists the cascade variables this run emitted, grouped by key and labelled in plain language:
  - Desk: Barriers · Metrics · Journeys · Method suggestions · Knowledge gaps · Sources
  - Stakeholder: Constraints · Priorities · Alignment gaps · Questions for users · Backstage observations · Failure modes
  - Survey: Findings (`survey_findings`) · Knowledge gaps (`knowledge_gaps`). These are the only current survey outputs (DISC-0). `survey_themes` and `survey_recommendations` are retired, and `sample_demographics` is not a canonical variable. None of the three is ever rendered.

  Each item is one line with its stable id (`barrier-003`) and `source_document`/`SH-xxx` where present. An intro line says: "These items are what a brief receives when this run is selected."

### 6.2 Processing ledger

Shown in place of the report while processing: a vertical list of steps with state glyphs (✓ done, ◷ current with `aria-busy`, · pending). Each step is plain text, with no percentage bars unless the backend reports real progress. Elapsed time is shown after 60 s, without fabricated estimates.

### 6.3 Failures

| Failure | Message | Recovery |
|---|---|---|
| Privacy block | §5.6 | Replace / remove flagged / delete |
| Unreadable document | "Qori couldn't read scan-002.pdf (no extractable text)." | Remove file and retry · Replace |
| Validation (`validateDocuments`) | Verbatim service message | Back to form, values kept |
| Analysis failed | "Analysis didn't finish. No artifact was created." + time | Retry (same inputs) · Delete run |
| Extraction failed (`Cascade variable extraction failed`) | "The report was written, but Qori couldn't extract items for the brief. This run can't inform a brief until extraction succeeds." | Retry extraction |

Every failure keeps the run, its sources and its inputs. Nothing has to be re-entered.

### 6.4 Run identity

Workspace runs are identified by the run, not by the topic slug. Two runs with the same topic coexist and are told apart by marker and date. The form warns but doesn't block: "You already have a desk research run called 'Accessibility policy' (D1, Sep 30). This will create a separate run."

---

## 7. Survey Workflow

### 7.1 Shape

A survey run is one page with a **stage strip** under the header, the same sub-strip vocabulary as the M3 handoff (`substrip.css`):

```
 ✓ Upload   ✓ Fields   ● Privacy   🔒 Response groups   🔒 Matches   🔒 Summary
            confirmed   14 flagged
```

- Each stage is a link (`aria-current="step"` on the current one). A locked stage is `aria-disabled` with its reason as a tooltip and sr text ("Locked: complete privacy review first").
- Done stages stay reachable read-only, showing what was decided, by whom and when.
- Under each label, a second line states the gate in numbers: "38 of 41 fields confirmed", "14 flagged", "v1 accepted", "212 / 240 reviewed".
- The stage strip is the answer to "where am I / what remains". No other progress indicator is used.

Stage canvases use the full width (the reading measure is relaxed for tables). The ContextRail defaults closed on survey stages.

### 7.2 Upload

Covered by §5.4. After upload, the page shows a dataset line (`survey-export-oct.csv · 412 rows · 41 columns`) and any `parseWarnings` as an info Alert listing each warning. Warnings never block. The page then advances to Fields.

### 7.3 Fields (schema review)

```
Fields                                                      Upload expires in 1 h 38 m
Qori guessed each column's role. Confirm or correct every one; numbers are computed
from your confirmed roles, not Qori's guesses.

[Needs confirmation 3] [All 41] [Open text 6] [Demographic 4]      Filter fields…

Field                  Sample values                 Present/Missing  Qori's guess  Your role       Demog.
Q3_satisfaction        Very satisfied · Neutral · …  398 / 14         ordinal       [Ordinal ▾] ✓   ☐
  └ Order: 1 Very dissatisfied ▲▼  2 Dissatisfied ▲▼  3 Neutral ▲▼ …   [Confirm order]
Q7_frustrations        "The status page never…" …    301 / 111        open text     [Open text ▾] ✓ ☐
respondent_id          R-1009 · R-1010 · …           412 / 0          id            [ID ▾] ✓        ☐
```

- **Qori's guess** is ink-4 text with "Suggested" semantics. **Your role** is a native Select. A row is confirmed only after the researcher has acted on it: changed the role, or pressed the row's ✓ "Confirm".
- **Confirm remaining as guessed** is a bulk action. Its label states the count ("Confirm 3 remaining as guessed"), and it **excludes ordinal fields without a confirmed order**. Those stay "Needs order".
- **Ordinal order** opens an inline sub-row with ▲/▼ buttons (keyboard operable) as well as drag. The initial order is Qori's suggestion (`ordinalSuggestions.ts`), labelled "Suggested order". Help text: "Without a confirmed order Qori reports the distribution but no median" (rev3 rule).
- **Demographic** is a checkbox. Its tooltip: "Used to describe who responded."
- Long field names wrap to two lines, then truncate with the full name in `title` and the accessible name. Sample values show three chips, each truncated to 24 characters.
- The table paginates at 50 rows, so Slack's 10-per-page limit doesn't apply.
- **Expiry:** the countdown is visible in the stage header. At ≤15 minutes it becomes a brass Alert. On expiry (`review_status: expired`) the page shows: "The uploaded file expired before fields were confirmed. Your confirmed roles are kept; upload the same CSV again to continue." The same CSV hash can then reuse the accepted schema (rev3 Source Versioning).
- Primary action **Confirm fields and compute** is enabled when 0 rows need confirmation. Afterwards a **Dataset facts** panel appears (respondents, per-field present/missing, distributions, medians where allowed, cross-tabs). It is tagged **COMPUTED · DETERMINISTIC**, with this note: "The same file and the same confirmed fields always give the same numbers."

### 7.4 Privacy

```
Privacy review                                           212 of 240 entries reviewed
Only reviewed entries can be analyzed. Restricted entries are excluded.

FLAGGED — 14   Each needs your decision
  R-1044 · Q7_frustrations
  "I called (•••) •••-4410 three times and…"   [PHONE] detected
  ( ) Clear as written   ( ) Redact   ( ) Restrict
      Redact → editable text with [PHONE] pre-applied

NOT FLAGGED — 226
  [Approve all 226 unflagged entries as clear]   Flagged entries are never included in bulk approval.
  ▸ Show entries (paged, 50)
```

- Flagged entries are always listed individually and never collapsed. Detected spans are highlighted with a crit-tint background and announced as "phone number detected".
- Radio groups per entry. Redact reveals a textarea. Decisions save per entry (autosave with the SaveStateIndicator pattern).
- Bulk approval is a single button whose label states its exact scope. After use it becomes "226 approved as clear · Undo". Undo is available until the stage is completed.
- Gate: **Continue to response groups** is enabled when 0 entries are `pending`.
- Raw entry text is shown only on this stage (per the model comment, "raw entry_text accessible only via authorized privacy-review paths"). Every other stage shows approved or redacted text.

### 7.5 Response groups (codebook)

```
Response groups · draft                                         Proposed by Qori from 226 approved entries
Groups describe kinds of answers. Counts come later, from matches you accept.

  Status page is unclear          Qori proposed
  Definition  …   Include when …   Exclude when …
  [Keep] [Edit] [Remove]

  + Add a group
                                       [Accept these 7 groups]   (creates version 1)
```

- One block per code: label (serif, editable in place on Edit), Definition, Include when, Exclude when. Origin is shown as a quiet tag: "Qori proposed" / "Added by you" / "Carried from v1".
- Actions: Keep · Edit · Remove · Add. **No merge**, because runtime doesn't support it.
- Accept states versioning plainly: "Accepting creates version 1. Accepted groups can't be changed; editing later creates version 2."
- No counts or percentages appear on this stage (rev3: no authoritative qualitative counts before adjudication).

### 7.6 Matches (assignment adjudication)

A split view at ≥981px:

```
┌ Entries ─────────────────────┐┌ R-1044 · Q7_frustrations ───────────────────────┐
│ [Proposed 180] [No proposal  ││ "I called [PHONE] three times and the status   │
│  46] [Reviewed 0]            ││  page still said 'received'."                  │
│ ▸ R-1044  "I called [PHONE]…"││                                                │
│   R-1051  "Couldn't find…"   ││ Groups                                         │
│   …                          ││ ☑ Status page is unclear      Qori proposed    │
│                              ││ ☐ Phone support is hard to reach               │
│                              ││ ☐ …                                            │
│                              ││ Decision  (•) Reviewed  ( ) No group applies   │
│                              ││           ( ) Uncodable                        │
│                              ││                    [Save and next ↓]           │
└──────────────────────────────┘└────────────────────────────────────────────────┘
 [Accept Qori's proposed matches for 180 entries]  Entries without a proposal still need you.
```

- Proposed checkboxes are pre-checked and tagged "Qori proposed". Researcher-added checks are tagged "Added by you".
- Bulk acceptance applies **only to entries with Qori proposals**, and its label says so. Researcher-added codes are always kept.
- Keyboard: ↑/↓ move through the entry list, Space toggles the focused group, 1/2/3 choose a decision, Enter saves and moves to the next entry. A shortcut legend is reachable via "?".
- Gate: **Accept matches** is enabled when every entry has a decision. On acceptance, group counts appear for the first time, labelled "unique respondents · computed from accepted matches".

### 7.7 Summary readiness and final synthesis

Before generation, the Summary stage shows a **readiness checklist** that mirrors the server gates exactly:

```
Ready to create the survey summary
 ✓ Fields confirmed                 41 fields · Oct 2 · you
 ✓ Privacy review complete          240 entries · 3 restricted
 ✓ Response groups accepted         v1 · 7 groups
 ✓ Matches accepted                 240 entries · 12 uncodable
                                    [Create survey summary]
```

Any unchecked row is a link to its stage. There is no bypass.

After generation, the survey artifact (`V1`) renders with **two visually separated registers**:

1. **Computed from the data** (ProvenanceTag "COMPUTED · DETERMINISTIC"). Respondents, field distributions, medians, cross-tabs and response-group frequencies, rendered as DocumentTables with numerator/denominator ("118 of 398 · 30%").
2. **Qori's interpretation** (ProvenanceTag "GENERATED"). The YAML sections Executive Summary · What Respondents Described · Preliminary Qualitative Observations · What This Means · Evidence Gaps. Quotes show respondent display IDs (`R-1044`) and are drawn only from approved or redacted text.

Between the two registers sits a hairline divider and one sentence: "Numbers above are calculated by code. The interpretation below is written by Qori from those numbers and approved responses."

### 7.8 Returning to a survey mid-way

Opening a survey run always lands on the earliest incomplete stage. Decisions persist per entry. Before acceptance, a draft codebook or draft coding run resumes as-is (`codebookResumability`). If the CSV staging expired before Fields completed, see §7.3.

---

## 8. Discovery Artifact Experience

Reading a source-specific artifact (desk report, stakeholder synthesis, survey summary):

- **Same reading column** as the Brief: serif body, max measure from TYPOGRAPHY.md, numbered `##` sections, an anchored table of contents in the header's section menu (the existing pattern).
- **Provenance at the top:** the masthead FactsGrid states problem, intent, document count, date and the generating template version (`desk_research v7.1`). This last item is meta text in mono ink-4.
- **Inline attribution as-written.** Desk quotes carry "— *document name*". Stakeholder quotes carry `SH-00x`. Survey quotes carry `R-xxxx`. Where the attribution exactly matches a source label on the run, it becomes a button that opens that source in the Evidence rail. Where it doesn't match, it stays plain text and is never guessed.
- **Confidence lines** (desk themes `[HIGH]`, stakeholder "Confidence — Strong/Moderate/Limited") render as small-caps meta text, never as colored chips. They are Qori's assessment, not a measurement.
- **Collapsed YAML `<details>` blocks** (Methodology, Research provenance, Document details) render as CollapsibleSection, closed by default.
- **Stakeholder alignment marks** (✓/⚠/✗) render as glyph + word ("Aligned", "Partial", "Conflicts") for accessibility.

---

## 9. Cross-Source Synthesis

New capability. It is researcher-triggered and never automatic.

### 9.1 Selecting artifacts (`/discovery/synthesis/new`)

```
Synthesize across sources
Choose the Discovery runs Qori should compare. Qori will only make claims it can
trace to the runs you select.

fieldset legend: Runs to compare (choose at least two)
☑ D1  Desk research · Accessibility policy review      3 files       Sep 30
☑ S1  Stakeholder · Claims operations interviews         6 transcripts Sep 28
☑ V1  Survey · Post-launch satisfaction                  412 resp.     Oct 2
☐ D2  Desk research · Competitor portals                 Analyzing — not available yet
                                                         (disabled, reason shown)

What should this synthesis help decide? (optional)
[ prefilled: project problem statement — editable ]

                                            [Compare 3 runs]   Cancel
```

- Only **Ready** artifacts are selectable. Others are listed, disabled, with a reason.
- At least two must be selected (synthesis is comparison). Selecting one shows the reason: "With one run, open its report instead."
- Mixed types are allowed but not required. Two desk runs are a valid comparison.
- On re-run, the previous selection is pre-checked. New Ready artifacts since then are flagged "New since X1".

### 9.2 Processing

The same processing ledger as §6.2 (Reading selected runs · Comparing · Checking every claim has support · Writing). Leaving is allowed. The previous synthesis, if any, stays readable and current until the new one completes.

### 9.3 Reading the synthesis (`X1`)

Header: "Cross-source synthesis", title = the decision question (or the project name), marker `X1`, "Compares D1 · S1 · V1", date, ProvenanceTag "GENERATED".

Sections, in this order:

1. **What we know.** Statements, each a row:

   ```
   X1-K01  Veterans can't tell where their claim is after submission.       D1 · S1 · V1
           Supported by 3 of 3 selected runs
   X1-K02  Status labels are written in internal terms.                     D1 · S1
           Supported by 2 of 3
   X1-K03  Phone support is the main fallback.                              V1
           Single source
   ```

   - The **support line is computed from the citations**: the number of distinct cited artifacts out of those selected. It is not a model confidence score. "Single source" is stated plainly, not as a demerit.
   - Markers are buttons (§11).

2. **Where sources agree.** Statements whose support spans more than one *type* of source. This is the triangulation the researcher cares about.

3. **Where sources conflict.** Paired rows:

   ```
   X1-T01  Stakeholders believe the status page is rarely used.             S1
           Survey respondents report checking it repeatedly.                 V1
           Why it matters: …
   ```

   Both sides are cited. A conflict with one side uncited is not rendered.

4. **What we don't know.** Gaps reconciled across the runs' `knowledge_gaps`. Each cites the runs that raised it. If the backend merges gaps, the merged statement cites all originals.

5. **Implications for research.** Prose, cited.

6. **Recommended focus for the brief.** A numbered list of 3–5 items, each cited, each with a checkbox at handoff time (§10). This is the bridge into the Brief.

Statements are presentational rows in the document column, not cards: hairline between rows, IdTag left, markers right-aligned. At ≤767px the markers wrap below the statement.

### 9.4 Researcher control inside synthesis

- **Set aside** (per statement, overflow menu): moves a statement to a collapsed "Set aside by you" list at the end of its section, with actor and time. Set-aside statements are excluded from the Brief handoff. They are not deleted.
- **Mark synthesis reviewed:** an explicit action in the header. Until it's taken the header reads "Not yet reviewed by you". The action is informational and doesn't gate the Brief, because Discovery never gates.
- No inline editing of Qori's statements in MVP (§18). The researcher's corrections go into the Brief.

### 9.5 Re-running and history

- **Synthesize again…** opens §9.1 with the prior selection. On completion, the new synthesis becomes current (`X2`), and the old one is kept as "X1 · superseded Oct 5", read-only, reachable from a "History" menu in the header.
- No diff view (deferred). The superseded header states only what changed in the *selection*: "X2 adds V2; removes nothing."

### 9.6 Stale

A synthesis is **out of date** when any artifact it compares has been re-run or deleted, or when a new artifact in the project became Ready after it. This is shown in three places, consistently:
- The nav ring on "Synthesis"
- Hub §3
- A brass Alert at the top of the synthesis: "V2 became ready after this synthesis and isn't included." → **Synthesize again…**

There is no auto re-run.

---

## 10. Discovery → Brief

### 10.1 Brief intake, step 0: "What informs this brief?"

This is added as the first fieldset of the existing `BriefForm` (the form keeps its 13-field contract):

```
What informs this brief?

(•) Cross-source synthesis X1 — compares D1, S1, V1 · Oct 3            Recommended
    Carry these focus items into the brief:
    ☑ 1. Make claim status legible after submission              D1 · S1 · V1
    ☑ 2. Test status language with Veterans                      D1 · S1
    ☐ 3. Phone support as fallback                               V1
( ) Selected Discovery runs
    ☐ D1 Accessibility policy review   ☐ S1 Claims operations interviews   ☐ V1 Post-launch…
( ) No Discovery — start from the project problem statement
```

- **Default selection:**
  - Synthesis when a current one exists.
  - Otherwise "Selected runs" with all Ready runs pre-checked.
  - Otherwise "No Discovery". In that case the other two options are absent and one line reads "No Discovery yet. You can add evidence first, or continue." with a link to the hub.
- **"Recommended" never appears on "No Discovery",** and it never appears on a stale synthesis. A stale synthesis is shown with "Out of date: doesn't include V2" and is still selectable.
- **Selection maps to existing behavior where possible.** "Selected runs" maps to `discovery_selections: ['desk-research::slug', …]`, which `SubmitBriefInput` and `executeBrief` already accept. "Synthesis" is new (§16).
- **Prefilled fields** below use ProvenanceField: "From Discovery synthesis X1 — change if needed". Prefill never applies to required researcher judgments (problem statement, learning objectives). Those receive *suggestions* shown beneath the field with "Use suggestion", not silent defaults.

### 10.2 On the Brief document

- **Masthead fact (FactsGrid):** "Informed by" = `X1 (D1 · S1 · V1)` · or `D1 · S1` · or "Not informed by Discovery". The last is plain text in ink-3, the same weight as the others. It is not a warning, and the Brief is never punished for it.
- The existing **Discovery sources** table (from `discovery_sources`) shows marker, run, type, date. Each row links to the run.
- **"Why is this in the Brief?"** For target barriers (`TB-xxx`) and research questions (`RQ-xxx`), the `source` value renders as Discovery markers **only when it resolves to a selected artifact or synthesis statement**. Pressing it opens the Evidence rail on the Brief page. Unresolvable sources render as their verbatim text, and "Researcher hypothesis" renders as-is. The rail never manufactures a link (see the honesty rule, §11.4).

### 10.3 Brief without Discovery

The flow is identical, minus the evidence choices. Coaching and review are unaffected. The hub's §5 later reads "Brief not informed by Discovery." If Discovery is added after the Brief, hub §5 says so informationally. Re-generating the Brief remains a Brief-workflow decision.

---

## 11. Provenance Interaction

### 11.1 Model

```
Synthesis statement   ──►   Artifact passage            ──►   EvidenceSource
X1-K02 "Status labels…"     D1 · Key Themes · Theme 2          accessibility-policy.pdf
                            "> 'Labels such as …'"             PDF · uploaded Sep 30 · privacy passed
                            S1 · 01 Constraints · SH-003        claims-ops-interview-03.docx
```

### 11.2 Interaction: the Evidence rail

1. **Marker press** (`D1` on a synthesis statement): the ContextRail opens in mode **Evidence** (docked ≥1181, overlay 981–1180, sheet ≤767, per ContextRail). Focus moves to the rail heading.
2. **Rail level 1, the claim.** The statement, its id, its support line, then **one entry per cited artifact**: marker · type · run name · the cited passage (≤3 lines, quote styling) · **Open in report →**.
3. **Open in report** navigates the canvas to the run page, scrolls to the anchored section and highlights the passage. A **Return to synthesis X1** pill appears in the header (ReferenceNavigationProvider origin/return pattern). The rail stays open, now showing that artifact's sources.
4. **Rail level 2, the source.** Pressing a source (from the rail list or the Sources tab) shows: filename (full, wrapping), type, size, added by/at, privacy result, which runs used it (markers), and for surveys, rows/columns and the confirmed schema version. Raw file contents are not shown in MVP (§18).
5. **Breadcrumb at the top of the rail**: `X1-K02 › D1 › accessibility-policy.pdf`. Each crumb is a button. Back (←) and Escape step up one level. Escape at level 1 closes the rail (overlay/sheet) and returns focus to the originating marker.

### 11.3 Same pattern, other entry points

- Brief `TB/RQ` markers → Evidence rail (artifact level; synthesis statement level when the Brief came from X1).
- Hub §4 gap markers → Evidence rail at artifact level.
- Run page inline attributions → Evidence rail at source level.

### 11.4 Honesty rules (non-negotiable)

- A link is rendered only for a relationship the backend recorded. If a statement cites an artifact but no passage was recorded, the rail says: "Linked to D1 as a whole. Qori didn't record a specific passage." Then it offers **Open report**.
- Desk and stakeholder artifacts today carry document names and SH-ids in prose, not structured passage anchors. Passage-level linking for those is **NEW** (§16). Until it exists, the rail operates at artifact level for them.
- Unknown or unresolvable references render as the neutral "Source reference" (ReferenceLink rule).

---

## 12. Key Interaction States

| State | Hub | Nav | Run / survey page | Brief intake |
|---|---|---|---|---|
| **Empty** | §4.2 explainer + three entry links + skip | No counts | — | "No Discovery yet" line; one option |
| **Processing** | §2 row "◷ Analyzing" | No change until Ready | Processing ledger; `aria-busy`; leave allowed | Run listed disabled "Analyzing" |
| **Needs review** | §1 queue row; header count | Brass dot on type row | Stage strip current = ●; gate line in numbers | Survey run listed disabled "Needs your review" |
| **Ready** | §2 "✓ Ready", marker assigned | Count increments | Report renders | Selectable |
| **Failed** | §1 row "Failed — reason" + Resolve | Brass dot (needs you) | Failure Alert with recovery (§6.3) | Not listed |
| **Partially complete** | Mixed rows. §3 shows synthesis availability ("2 runs ready") | Counts reflect Ready only | — | Ready runs selectable; others disabled with reason |
| **Stale synthesis** | §3 brass rule + reason | Ring glyph on Synthesis | Synthesis brass Alert + Synthesize again | Synthesis option shows "Out of date…", no "Recommended" |
| **New evidence after Brief** | §5 informational line | — | — | — (Brief workflow owns regeneration) |
| **No Discovery before Brief** | §5 "Brief not informed by Discovery" | — | — | Default "No Discovery"; Brief masthead states it neutrally |
| **Expiring upload** | §1 sorted first with countdown | Brass dot | Fields stage countdown → Alert ≤15 min → expired state | — |
| **Load error** | ErrorState in canvas; nav still usable | — | ErrorState with Retry | Discovery fieldset shows "Couldn't load Discovery. You can continue without it or retry." |
| **Loading** | Skeleton rows (3) in §2 | Counts hidden until loaded | Skeleton report | Skeleton list |

---

## 13. Responsive Behavior

Same breakpoints as `WORKSPACE_BREAKPOINTS` and RESPONSIVE_CONVERGENCE.md.

| | ≥1181 (xl) | 981–1180 (lg) | 768–980 (md) | ≤767 (sm) |
|---|---|---|---|---|
| Lifecycle | Docked 224px | Docked | Drawer (with SideNav) | Drawer |
| ContextRail / Evidence | Docked 344px | Overlay | Overlay | Bottom sheet, `aria-modal` |
| Hub runs table | Full columns | Drop "Updated" | Stacked rows: line 1 marker · name · status; line 2 sources · used by | Stacked rows |
| Needs-review queue | One line per item | One line | Two lines | Two lines; action full-width |
| Stage strip | All labels + gate line | All labels, gate line in tooltip | Labels only; scrolls horizontally with edge fade; current stage scrolled into view programmatically (no `scrollIntoView` side effects on page) | Collapses to "Stage 3 of 6 · Privacy ▾" disclosure listing all stages |
| Fields table | Full table | Hide sample values (in row expand) | Row = field name + role select; expand for the rest | List of fields; "Edit" opens a sheet with all controls. Fully functional; banner "Field review is easier on a wider screen" (dismissible) |
| Privacy | Two zones, inline radios | Same | Same, stacked | Same, stacked; Redact textarea full-width |
| Matches | Split view | Split view (narrower list) | List → detail (detail is a page-level view with "← Entries") | Same as md |
| Synthesis statements | Markers right | Markers right | Markers below statement | Markers below |
| Brief step 0 | Inline radios + nested checklists | Same | Same | Same; marker chips wrap |

Large data:
- Run lists paginate at 50 with a filter.
- Fields paginate at 50.
- Privacy unflagged list pages at 50. Flagged entries are always fully listed, paged at 50 when there are more than 50.
- Matches list is virtualized, or paged at 100, with counts per filter.

---

## 14. Accessibility

**Landmarks and headings.** The existing `nav[aria-label="Study lifecycle"]`, `main` canvas and `aside` rail stay. The hub has one `h1` (project name) and `h2` per numbered section. Survey stage pages: `h1` = run name, `h2` = stage.

**Keyboard**
- All flows are complete without a pointer. Drag-and-drop (file drop, ordinal reorder) always has a button equivalent.
- The stage strip is `nav aria-label="Survey stages"` with links. Locked stages are focusable, `aria-disabled="true"`, and their reason is in `aria-describedby`.
- Matches shortcuts (§7.6) are active only when focus is inside the matches region. They never override text inputs. They are listed in a dialog opened with "?" or the "Keyboard shortcuts" link.
- The Evidence rail follows ContextRail: arrow keys across tabs, Escape closes overlay/sheet, focus returns to the originating marker.

**Selection**
- Synthesis selection and Brief step 0 are native `fieldset`/`legend` with radios and checkboxes. Disabled options keep their reason as visible text (not only `title`).
- Bulk action buttons state their exact scope in the accessible name ("Approve all 226 unflagged entries as clear").

**Status semantics**
- StatusBadge always pairs glyph and text.
- Processing ledgers use `role="status"` (polite). The hub has one polite live region announcing "D2 is ready" or "D2 failed".
- Nav counts and dots have sr text (", 2 ready", ", 1 needs your review").
- Countdown: visible text updates each minute. Announcements happen only at 15 and 5 minutes (polite), to avoid chatter.

**Errors**
- Form errors use the existing Input/ProvenanceField pattern (`aria-invalid`, `aria-describedby`, `role="alert"` on the message). On submit, an error summary Alert at the top receives focus and links to each field.
- Privacy and processing failures are an Alert with a heading, then recovery buttons in the order of least destructive first.

**Markers and provenance**
- Marker buttons have accessible names: "Evidence from D1, desk research: Accessibility policy review".
- Support lines are text, not icons.
- The Evidence rail breadcrumb is `nav aria-label="Evidence path"` with `aria-current` on the last crumb.

**Long filenames**
- Middle truncation keeps the extension visible (`accessibility-policy-20…ndices.pdf`). The full name is in the accessible name and `title`, and wraps in full in the rail.
- Never truncate in table cells read by screen readers. Truncation is visual only (CSS), with the full text in the DOM.

**Contrast.** Ink-3 meta on paper meets 4.5:1. Brass is used for rules and dots only, never as small text on paper (brass-text `#8A6B32` where text is needed). Crit-tint detection highlights keep ink text.

---

## 15. Component Inventory

| Component | Purpose | Status | Reuses |
|---|---|---|---|
| `LifecycleRail` Discovery rows | Route rows, counts, needs-review dot, synthesis glyph | Existing + extend | `LifecycleRail.tsx`, `workspaceLifecycle.ts` (`kind: 'route'` gains discovery stages) |
| `DiscoveryHubPage` | Hub canvas sections 1–5 | New page | WorkspaceLayout, ArtifactHeader, DocumentSection |
| `ReviewQueue` | "Needs your review" rows | New | DocumentTable row styles, Button |
| `RunLedgerTable` | Grouped runs table | New (composition) | DocumentTable, IdTag, StatusBadge |
| `DiscoveryMarker` | `D1`/`S1`/`V1`/`X1` tag, optionally a button | Extend | IdTag (adds button variant) |
| `EvidenceIntakeForm` | Add evidence (3 types) | New page | Input, Textarea, ProvenanceField (derived), Alert, Button |
| `FileDropList` | Drop zone + file rows + rejections | New | Button; tokens |
| `ProcessingLedger` | Step list with live status | New | StatusBadge glyphs |
| `RunPage` | Report · Sources · Extracted | New page | ArtifactTabs, Masthead, FactsGrid, MarkdownDisplay, CollapsibleSection, ProvenanceTag |
| `SourceTable` | EvidenceSources of a run | New (composition) | DocumentTable |
| `ExtractedVariablesList` | Cascade items per run | New | StructuredItemRow(s), IdTag |
| `PrivacyBlockAlert` | Desk/stakeholder PII stop | New (composition) | Alert |
| `SurveyStageStrip` | Six-stage gate strip | New | M3 `substrip.css` vocabulary, LifecycleRail glyphs |
| `FieldReviewTable` | Schema review | New | Select, checkbox, DocumentTable |
| `OrdinalOrderEditor` | Confirm category order | New | Button (▲▼) |
| `DatasetFactsPanel` | Deterministic stats | New | DocumentTable, ProvenanceTag ("COMPUTED · DETERMINISTIC") |
| `PrivacyReviewList` | Flagged / unflagged zones | New | radios, Textarea, SaveStateIndicator |
| `ResponseGroupEditor` | Codebook keep/edit/remove/add | New | Input, Textarea, Button |
| `MatchReviewSplit` | Entry list + adjudication | New | checkboxes, radios |
| `ReadinessChecklist` | Summary gates | New | StatusBadge glyphs |
| `SynthesisSelectForm` | Choose runs | New | fieldset, checkbox, Textarea |
| `SynthesisDocument` | X1 reading view | New page | Masthead, DocumentSection, IdTag |
| `SynthesisStatementRow` | Statement + support line + markers + set aside | New | IdTag, DiscoveryMarker |
| `ConflictPair` | Two cited sides | New | SynthesisStatementRow |
| `EvidenceRailPanel` | Claim → artifact → source | New rail mode | ContextRail (`RailModeId` + `'evidence'`), ReferenceNavigationProvider, ReferenceLink label rules |
| `BriefEvidenceChoice` | Brief step 0 | New fieldset in BriefForm | radios, checkboxes, DiscoveryMarker |
| `StatusBadge` new statuses | `processing`, `needs_review`, `ready`, `failed`, `stale`, `superseded`, `expiring` | Extend | `StatusBadge.tsx` config |
| `CommentsRail` on Discovery | Discuss runs/synthesis | Existing (scope extension) | CommentsRail |
| `EmptyState` / `ErrorState` / `Skeleton` | States | Existing | as-is |

---

## 16. Repository Feasibility

Updated in Revision 2. DISC-0 (architecture reconciliation), DISC-1 (durable Discovery domain) and DISC-2 (shared Desk/Stakeholder execution) are complete and merged on dev/Railway.

### IMPLEMENTED (current repo truth)

- **Durable Discovery domain (DISC-1).** It covers:
  - `DiscoveryRun`, `EvidenceSource` and run ↔ source associations
  - canonical `DiscoveryArtifact` persistence with artifact versioning
  - artifact → StudyVariable lineage
  - GitHub as a projection, not canonical truth
- **Shared Desk/Stakeholder execution (DISC-2).** It covers:
  - one `executeDiscoveryRun()` path for Slack and REST
  - asynchronous REST run creation with durable worker claiming
  - heartbeat and stale recovery
  - prepared-source handling, with prepared content cleaned up at the terminal state
  - project authorization
  - polling
  - the Discovery REST API
- **Privacy hard stop** for desk/stakeholder (`PrivacyError {label, snippet}`).
- **Desk → Stakeholder context.** Desk `discovered_barriers` and `knowledge_gaps` are injected into stakeholder runs when they exist.
- **Survey domain, including Slice 2B, in repository/domain terms:**
  - schema inference and review (incl. `expired`)
  - deterministic stats
  - privacy dispositions
  - codebook versions
  - coding runs
  - entry reviews
  - synthesis gates

  Earlier "NOT BUILT" wording referred to production rollout, not to missing implementation.
- **Survey outputs:** `survey_findings` and `knowledge_gaps` only.
- **Survey input:** CSV only. Excel/XLS/XLSX is not supported anywhere in the UI.
- **Brief selection contract:** `SubmitBriefInput.discovery_selections` (`type::slug`), plus `discovery_sources` on the Brief.
- **Frontend frame:**
  - WorkspaceLayout, ContextRail and LifecycleRail inverse
  - document components, ProvenanceField, StatusBadge, MarkdownDisplay and ReferenceNavigationProvider
  - breakpoints

### NOT YET IMPLEMENTED: later DISC milestones (designed here, do not build ahead)

- **DISC-4: Workspace survey REST orchestration.** This means shared survey orchestration out of the Slack handler, plus REST for every survey stage.
- **DISC-5: Cross-source synthesis domain/service.** It covers:
  - the synthesis artifact
  - statement-level citations
  - the uncited-statement guard
  - deterministic support counts
  - set-aside state
  - versioning/supersession
  - staleness
- **DISC-6: Evidence rail backend/contracts and complete Discovery → Brief source links.** It covers:
  - claim → artifact → source resolution
  - passage anchors where recorded
  - Brief `informed_by`
  - TB/RQ structured source refs
- **Deferred (§18).** Document PII adjudication and durable survey staging beyond the TTL.

### Resolved repository inconsistencies (DISC-0)

1. **Survey synthesis variables:** `survey_findings` + `knowledge_gaps` are current. `survey_themes` and `survey_recommendations` are retired. `sample_demographics` is stale documentation.
2. **Slice 2B:** implemented in the domain. Workspace REST orchestration for it is DISC-4.
3. **Desk → Stakeholder:** confirmed (see §5.3).
4. **Excel:** CSV only. Older mentions are stale.

### Open API confirmations

These design needs must be confirmed rather than invented. The full list is REDLINES §F. The ones that affect DISC-3 directly are:
- F-2: run step progress
- F-4: persisted markers
- F-5: structured "used by"
- F-6: per-type counts
- F-8: source ids
- F-9: retry after a privacy block, given that DISC-2 cleans up prepared content at the terminal state
- F-10: "Run again" vs. artifact versioning

## 17. Design Decisions

- **D1. The hub is a document, not a dashboard.** It keeps the Brief/Plan reading rhythm, keeps the operational and interpretive registers separate, and avoids the BI and file-manager looks the brief rules out.
- **D2. One ledger with type views, not three products.** The type rows filter one table, so researchers learn one place. Cross-type comparison is the point of Discovery.
- **D3. Two added nav rows (All evidence, Synthesis).** The hub and synthesis need addresses. "All evidence" avoids colliding with "Overview" (the study-name link question from VC-2A).
- **D4. Discovery never locks, and never is "complete."** This follows from the principle that Discovery is encouraged, not mandatory, and that Qori must not declare research truth or completeness.
- **D5. Markers extend the existing D/S/V convention and add X.** The convention is already in Brief output, so the vocabulary carries across the lifecycle.
- **D6. Support is counted, not scored.** "Supported by 2 of 3 selected runs" is deterministic and checkable. A model confidence number would be a black box.
- **D7. One CSV per survey run.** Each CSV has its own schema, privacy set and codebook (all keyed by `evidence_source_id`). Bundling would hide that gates are per dataset.
- **D8. Survey stages are routes with a strip, not a wizard.** Researchers come back. Each gate has an address, a read-only past and a stated reason when locked.
- **D9. Bulk actions name their exact scope.** This preserves the bulk-never-touches-flagged invariant and the proposed-only match acceptance in the interface, not just in code.
- **D10. Evidence rail instead of a graph.** It reuses ContextRail and the reference-navigation return pattern, and provenance becomes a path with a breadcrumb.
- **D11. Synthesis needs at least two runs.** Single-run "synthesis" would duplicate the run's own report and blur what cross-source means.
- **D12. Set aside, not edit, inside synthesis.** The researcher keeps control without Qori-authored text becoming researcher-authored. Corrections belong in the Brief, which is already editable and reviewed.
- **D13. "Not informed by Discovery" is neutral.** The Brief must not be punished. Provenance is stated, never graded.
- **D14. Desk/stakeholder privacy stays a hard stop.** That is what the backend does today. Designing an override would misrepresent governance.
- **D15. Routes under the study, data under the project.** Frame continuity with Brief/Plan under Phase 2D. The header states the scope so the multi-study future isn't surprising.

---

## 18. Things Deliberately Deferred

- Editing generated Discovery artifacts (same as Slack today)
- Inline editing of synthesis statements; per-statement accept workflows beyond Set aside
- Diff between synthesis versions or artifact versions
- Viewing raw source file contents in-app (PDF viewer, transcript reader)
- Passage highlighting inside original source files
- Evidence graph, affinity board, drag-to-cluster, Miro-like canvases
- Merging response groups (not in runtime)
- XLSX ingestion; multiple CSVs in one survey run; survey authoring; skip-logic metadata
- Document PII adjudication (override of the hard stop)
- Stakeholder directory / CRM; tagging stakeholders across runs
- Web crawling or URL ingestion (`external_reference` source type exists but is out of scope)
- Cross-project or team-wide Discovery library
- Coaching rail on Discovery pages
- Automatic synthesis triggers or "Discovery complete" signals
- Merging Discovery synthesis with post-study affinity analysis (`affinity_mapping.yaml` stays separate; Discovery constructs remain project-scoped evidence a later analysis may cite)

---

## 19. Implementation Handoff

### 19.1 Screen and component hierarchy

```
WorkspaceLayout
├─ nav: LifecycleRail (inverse)  — Discovery group: All evidence · Desk Research · Stakeholders · Surveys · Synthesis
├─ header: ArtifactHeader         — per screen (§4.1, §6.1, §7.1, §9.3)
├─ canvas
│  ├─ DiscoveryHubPage            — ReviewQueue · RunLedgerTable · AcrossSources · GapsList · IntoTheBrief
│  ├─ EvidenceIntakeForm          — common fields · type fields · FileDropList
│  ├─ RunPage                     — ArtifactTabs[Report(MarkdownDisplay) | Sources(SourceTable) | Extracted]
│  │   └─ ProcessingLedger | failure Alert (pre-Ready)
│  ├─ SurveyRunPage               — SurveyStageStrip
│  │   ├─ FieldReviewTable + OrdinalOrderEditor + DatasetFactsPanel
│  │   ├─ PrivacyReviewList
│  │   ├─ ResponseGroupEditor
│  │   ├─ MatchReviewSplit
│  │   └─ ReadinessChecklist → RunPage (Ready) with Computed / Interpretation registers
│  ├─ SynthesisSelectForm
│  └─ SynthesisDocument           — SynthesisStatementRow · ConflictPair · Recommended focus
└─ rail: ContextRail              — modes: evidence (EvidenceRailPanel), comments
BriefForm (existing)              — + BriefEvidenceChoice fieldset at top
BriefDocument (existing)          — Masthead "Informed by" fact; TB/RQ markers → evidence rail
```

### 19.2 Interaction contracts

- **Markers.** A marker is a button only when the backend returns a resolvable target; otherwise it's a static IdTag. Activation opens the Evidence rail at the right level. Focus returns to the marker on close.
- **Nav counts.** Count = Ready artifacts of that type. Dot = at least one run of that type needs researcher action (gate pending, failed, or expiring). Synthesis glyph = current / stale / none.
- **Gates.** Every gate button is disabled until its server-side precondition is met. The disabled reason is visible text. The UI never offers an action the server will reject.
- **Bulk actions.** The label contains the count and scope. Scope is computed server-side and echoed. After use, the action offers Undo until the stage is accepted.
- **Leaving mid-process.** Navigation is never blocked. Processing continues and the state appears in the hub.
- **Synthesis selection.** Only Ready artifacts are selectable, at least two. The prior selection is pre-checked on re-run, and new artifacts are flagged.
- **Brief step 0.** Exactly one option. Defaults per §10.1. "Selected runs" sends `discovery_selections` in `type::slug` form. Prefill is shown with ProvenanceField, and required judgment fields get suggestions only.
- **Provenance honesty.** No link without a recorded relationship. The artifact-level fallback copy is shown when no passage was recorded.

### 19.3 State requirements (what the API must expose)

- **Run:** id, marker (when Ready), type, topic, intent, status (`processing | needs_review | ready | failed`), step (if reported), failure {kind, message, findings[]}, sources[], created/updated by/at, used_by {brief?, syntheses[]}.
- **Survey run:** additionally stage states {fields, privacy, groups, matches, summary} with counts (confirmed/total, pending/flagged/total, codebook version + status, reviewed/total) and `upload_expires_at`.
- **Synthesis:** id, marker, status, selected artifact markers, statements[{id, section, text, citations[{artifact_marker, passage?}], support {cited, selected}, set_aside_by?}], reviewed_by?, superseded_by?, stale {reason, artifacts[]}.
- **Brief:** `informed_by` {kind: synthesis|artifacts|none, markers[]} plus TB/RQ structured source refs (when available).

### 19.4 Acceptance criteria

1. With no Discovery, the hub shows the explainer, three entry points and a visible "Start the brief without Discovery" link. Research Brief is never locked by Discovery state.
2. Discovery nav rows are links. Counts appear only for Ready artifacts. A run needing review shows the dot with sr text.
3. Adding desk research with an unsupported file shows the rejection inline. Submitting with a topic that has no letters or numbers shows "Topic must contain a letter or number".
4. A desk run blocked by PII shows each finding with masked snippets and the three recovery actions. Inputs are kept.
5. Survey: Confirm fields stays disabled while any field needs confirmation, including ordinal fields with no confirmed order. Bulk confirm excludes them and says so.
6. Survey: Bulk approval in privacy never changes a flagged entry, and its label states the unflagged count.
7. Survey: No group counts appear before matches are accepted.
8. Survey: Create survey summary is available only when all four checklist rows are complete. Each incomplete row links to its stage.
9. The survey summary visibly separates "Computed from the data" from "Qori's interpretation", with distinct provenance tags.
10. Synthesis cannot be started with fewer than two Ready runs. Non-Ready runs appear disabled with a reason.
11. Every synthesis statement shows at least one marker and a computed support line. Conflict rows show citations on both sides.
12. Pressing a marker opens the Evidence rail. The breadcrumb reflects the path. Escape steps back and finally returns focus to the marker.
13. A new Ready artifact after a synthesis marks it out of date in the nav, hub §3 and the synthesis page, with no automatic re-run.
14. Brief intake offers synthesis / selected runs / none. "Recommended" never labels "none" or a stale synthesis. The resulting Brief masthead states what informed it, and "Not informed by Discovery" uses neutral styling.
15. All screens pass the existing a11y test patterns (`*.a11y.test.tsx`): landmarks, headings, named controls, no color-only status, focus return on rail close.
16. At ≤980px the runs table stacks. At ≤767px the Evidence rail is a modal sheet with inert background (WorkspaceLayout CC-8 behavior). The Fields stage remains fully operable.

### 19.5 Tokens and components to reuse

- **Tokens:** `tokens.css` only, with no new hues. Paper/hairline surfaces. Ink-1–5 hierarchy. Brass = researcher attention (active rule, needs-review dot, stale rule). Info = Qori working. Good = Ready/done. Crit = failure and PII highlights.
- **Type:** Source Serif 4 for reading/statements, Instrument Sans for UI/tables, JetBrains Mono for markers/ids/filenames-in-meta.
- **Components:** WorkspaceLayout, LifecycleRail, ContextRail, ArtifactHeader, ArtifactTabs, Masthead, FactsGrid, DocumentSection, CollapsibleSection, DocumentTable, StructuredItemRow, IdTag, ProvenanceTag, ProvenanceField, StatusBadge, MarkdownDisplay, SaveStateIndicator, ReferenceNavigationProvider, Alert, EmptyState, ErrorState, Skeleton, Button, Input, Textarea, Select.
- **Specs:** LIFECYCLE_NAV_CONVERGENCE.md (row geometry), TYPOGRAPHY.md, RESPONSIVE_CONVERGENCE.md, GEOMETRY.md.
- **Discovery visuals:** DISCOVERY_REDLINES.md and `screens/`. These are binding, see §21.

---

## 20. Implementation Phasing

Annotated on every reference screen. A magenta "DISC-n" tag marks any region that belongs to a later milestone than the screen it appears on. Implement only the current milestone. When a later backend is absent, render what REDLINES §D specifies, and never a stub of the later behavior.

| Milestone | Scope (design) | Screens |
|---|---|---|
| **DISC-3** | Lifecycle navigation (§3.2) · Discovery Hub (§4) · Desk intake (§5.2) · Stakeholder intake (§5.3) · run pages: processing, failures, Report, Sources, Extracted (§6, §8) | 01–08 |
| **DISC-4** | Shared survey orchestration + Workspace survey: upload (CSV), Fields, Privacy, Response groups, Matches, Summary (§5.4, §7) | 09–14b |
| **DISC-5** | Cross-source synthesis: selection, document, agreements/conflicts/gaps/implications/focus, set aside, reviewed, X1/X2 versions, stale (§9) | 15–16b |
| **DISC-6** | Discovery → Brief step 0 and masthead (§10) · Evidence rail and interactive markers (§11) | 17a–18b |

**Rules that hold across milestones:**
- Discovery rows never lock.
- "Not informed by Discovery" is neutral.
- Provenance is never shown without a recorded relationship.

## 21. Visual Authority

- **`DISCOVERY_REDLINES.md`:** exact widths, spacing, padding, type roles, borders, radii, row heights, icon sizes and badge treatments. It also defines the selected, hover, focus, disabled, error and empty states and the responsive behavior of every new Discovery component (B1–B27). It covers the page compositions (§A), the milestone render-instead rules (§D) and the API flags (§F).
- **`screens/00 Index.html`:** 25 static hi-fi reference screens covering every state in §4–§13, plus `19 Responsive.html` and `20 Component Redlines.html` (all component states). The styling in `screens/discovery.css` §B uses production token names. It is a design reference, not production CSS.
- **Precedence:** this spec governs behavior and copy. REDLINES governs visual values. The screens illustrate both. If they disagree, raise it. Do not choose.
- **New tokens:** layout tokens only (`--layout-discovery-wide`, `--layout-stage-strip`, `--layout-match-list`). No new colors, radii or type sizes.

DISCOVERY WORKSPACE DESIGN — APPROVED
