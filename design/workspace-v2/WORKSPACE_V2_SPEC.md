# Qori Workspace v2 (UX-3A): Production Implementation Specification

**Audience:** Claude Code, implementing in `friends-innovation-lab/qori-slack` on branch `dev`.
**Status:** handover. This isn't a design exploration.
**Rule:** design intent comes from the approved Workspace v2 prototype. Behavior and architecture come from production. Where they conflict, production wins and the design adapts.

Read order: this file → `TOKENS.md` → `COMPONENT_MAPPING.md` → `RESPONSIVE.md` → `IMPLEMENTATION_PHASES.md` → `reference/`.

---

## 0. Repository snapshot

| Item | Finding |
|---|---|
| Branch | `dev`, re-read 2026-09-23T18:28Z |
| HEAD | `7f0366d8a31bb87e99d39b78baee75604b61ffde`. A compare of `7f0366d8…dev` reports no changes. `b4e12a30` is an ancestor per the product owner; I couldn't resolve that short SHA myself, so it's recorded as reported. |
| `packages/artifact-contracts/src/` | **Present:** `brief.contract.ts`, `plan.contract.ts`, `types.ts`, `validator.ts`, `extractor.ts`, `workspace-projection.ts` (33.9 KB), `index.ts`, plus `__tests__/workspace-projection.test.ts` and five other suites |
| Projection API | `projectBriefToWorkspace(BriefProjectionInput): BriefViewModel`, `projectPlanToWorkspace(PlanProjectionInput): PlanViewModel`. Shared types: `FieldAuthority` (generated · inherited · system · canonical · computed · user_input · unsupported), `FieldProvenance {authority, editable, label}`, `QuickFact {label, value, sub?, exists}`, `ProseSection`, `MastheadViewModel`, `BriefApprovalState`, `TimelineSummary`, `ArtifactMetadata`, and the item types. The contract's `cascade` authority is projected as `canonical`. |
| Consumers | `BriefDocument.tsx` and `PlanDocument.tsx` both call `project*ToWorkspace` inside a local `useMemo`. `hooks/useBriefViewModel.ts` and `hooks/usePlanViewModel.ts` do the same input mapping, but no page imports them (PF-21). |
| Still page-side | Pages hardcode provenance strings and ignore `vm.*.provenance` (PF-20). Brief builds quick-fact markup by hand. Brief falls back to hardcoded model/template strings (PF-12). |
| `packages/api-contracts` | `StudyBriefResource` and `StudyPlanResource` are the raw projection inputs and the source of the optimistic `artifact_version`. `LifecycleNode` is unchanged. |

**DDR-00: RESOLVED (2026-09-23).** The display contract is `BriefViewModel` / `PlanViewModel` from `@qori/artifact-contracts`. As a result:
- Document primitives take view-model types directly (`FieldProvenance`, `QuickFact`, `MastheadViewModel`, `BriefApprovalState`). See COMPONENT_MAPPING §4.
- Pages get the view model from the existing hooks and pass fields through. They don't re-derive anything (§1.1).
- `packages/artifact-contracts/**` is locked. If Workspace v2 needs a value the view model doesn't provide, that's a **DESIGN DECISION REQUIRED** item plus a projection ticket, never React code.
- If `dev` moves past `7f0366d8` before CC-1, run `git diff 7f0366d8..origin/dev -- packages/artifact-contracts frontend/src/pages frontend/src/hooks frontend/src/components/study`. Re-check COMPONENT_MAPPING §4 if `workspace-projection.ts` changed.

---

## 1. Locked architecture (do not change)

Canonical Markdown · artifact contracts · Workspace projection (when present) · Markdown projection · `markdownBridge.ts` · `serializer.ts` · `QoriSection` / `QoriStructuredItem` / `QoriSystemBlock` schemas · stable OBJ/RQ/TB IDs · save payloads (`artifact_version`, `sections`, `structured`) · `useSavePipeline` states · Brief approval model (`pending_approval | changes_requested | approved`, `approve({checklist_confirmed:true})`, `requestChanges({comment})`) · Plan has **no** approval gate · GitHub projection behavior (`sync_failed` path) · React 19 + TS + CSS Modules · lucide-react icons · TipTap 3.

Not introduced: Tailwind, shadcn, MUI, Chakra, a second editor, or any new state store.

Tests that must pass **unmodified** in every phase:
- `frontend/src/components/study/editor/__tests__/*` (markdown-api, markdown-roundtrip, serializer, tiptap-hydration, useSavePipeline)
- `packages/artifact-contracts/src/__tests__/*` (brief-contract, plan-contract, types, validator, extractor, workspace-projection, yaml-integration)

### 1.1 View-model rules (binding for every phase)
1. **Source.** Pages call `useBriefViewModel(id)` / `usePlanViewModel(id)` unconditionally at the top of the component. Raw resource fields that the view model deliberately doesn't carry come from `useStudyBrief` / `useStudyPlan` (React Query dedupes the request). Those fields are editor hydration inputs (`prose_sections`, `cascade_fields`), the save version (`artifact_version`) and `plan_url` for the empty state.
2. **Provenance.** Render `vm.<field>.provenance.label` verbatim, and derive lock/read-only from `provenance.editable`. Pages never hardcode "GENERATED · EDITABLE" or similar strings.
3. **Existence.** Render conditionally on `exists` flags (`vm.sections.x.exists`, `vm.objectives.exists`, `QuickFact.exists`). Don't recompute from lengths or strings.
4. **Quick facts.** Pass `QuickFact` objects in an explicit order. `FactsGrid` drops `exists:false`.
5. **Save version.** Always read from the raw resource (`plan.artifact_version`, `brief.artifact_version`), never `vm.artifact.contentVersion`. The projection defaults that to 1, which would hide version conflicts.
6. **Presentation-only transforms allowed in React:** date formatting of values the view model leaves raw (`approval.approvedAt`, `pipeline.lastSavedAt`, `artifact.createdAt`), deduping and joining provenance labels (§9.2), and fixed render order. Nothing else.


---

## 2. Production findings

These are facts observed on `dev`. Each has a disposition: **fix in phase X**, **DDR**, or **out of scope (don't touch)**.

| ID | Finding | Disposition |
|---|---|---|
| PF-01 | ~~`packages/artifact-contracts` absent~~: it was read from a stale tree. Present at `7f0366d8` | Resolved (DDR-00) |
| PF-02 | `document.module.css` uses 8 undefined tokens (`--font-serif`, `--font-sans`, `--color-text-secondary`, `--color-bg`, `--color-success-ink`, `--color-success-dark`, `--color-info-ink`, `--color-border-secondary`), so serif text currently renders in Public Sans, and masthead values and review text have no color set | Fix CC-1 (aliases) |
| PF-03 | Brief save sends `artifact_version: 1 // TODO`, while `StudyBriefResource.artifact_version` exists. Plan correctly uses `plan.artifact_version` | DDR-10 |
| PF-04 | `buildBriefEditorContent` hydrates only `research_objectives`, passing the raw JSON string as markdown. The contract marks that field `editable:false` (cascade), while the five `generated`/`editable:true` prose sections (`summary`, `problem_narrative`, `method_prose`, `participants_prose`, `out_of_scope`) are never hydrated. After PF-20 is fixed, view mode will label those sections EDITABLE but edit mode won't offer them | DDR-11 (escalated) |
| PF-05 | Brief view renders `⋮⋮` grip spans (never visible) while nodes are `draggable:false` | Remove in CC-5 (dead markup that implies reordering) |
| PF-06 | `ArtifactTabs` and Brief's inline tabs use `role="tab"` on navigation links, with no tabpanel | Fix CC-2 |
| PF-07 | `SaveStateIndicator` default label formats `new Date()`, so Plan shows "Saved · {now}" before any save | Fix CC-2 |
| PF-08 | Two different approval checklists: `ApprovalSection` (4 static stakeholder items) vs Brief rail (4 local checkboxes, different wording). The API receives only `checklist_confirmed:true` | DDR-13 (copy/semantics). UX-3A keeps both as-is |
| PF-09 | Plan Timeline footnote: "Timeline begins after stakeholder approval of this plan". Plan has no approval gate | DDR-12 |
| PF-10 | SideNav links `/studies`, `/search`, `/ask`, `/queue`, `/admin` have no routes (they fall through to Home) | DDR-14. UX-3A keeps the items |
| PF-11 | Timeline duration falls back to `phases × 2 weeks` in `deriveTimelineSummary` (projection) | Out of scope (projection-owned; flag to contracts owner) |
| PF-12 | Brief "Document information" falls back to hardcoded `claude-sonnet-4-6` / `research_brief v7.1` when `vm.artifact.model` / `templateId` are empty. Plan filters empty rows instead | DDR-16 |
| PF-13 | Editor `.qori-system-block { opacity:.7 }` drops muted text below 4.5:1 | Fix CC-6 |
| PF-14 | Prototype `ProvenanceTag` equivalent was `aria-hidden` | Design-side defect; this spec requires SR-readable provenance |
| PF-15 | Lifecycle nodes are computed client-side in `StudyOverview` ("backend should provide this eventually") | DDR-03 |
| PF-16 | Plan header shows `<StatusBadge status="active"/>` hardcoded | Removed from header in CC-4 (the status isn't data-backed). The masthead Status shows `content_version` when present, as today |
| PF-17 | `SideNav` item labels are removed from the DOM when collapsed (`{!collapsed && …}`), so collapsed links rely on `title` for their name | Fix CC-3 in the inverse variant (visually hidden labels) |
| PF-18 | Brief rail hidden ≤1240px with no way to open it (the toggle exists but the `.overlay` class is never applied) | Fixed by ContextRail in CC-7 |
| PF-19 | **Rules-of-Hooks violation:** `PlanDocument` calls `useMemo` after the `isLoading`, `error` and `!plan.plan_url` early returns, so the hook count changes between renders (loading → loaded, or a plan appearing) | Fix CC-4: use `usePlanViewModel` at the top |
| PF-20 | Pages hardcode provenance, and 7 labels disagree with the contract's `vm.*.provenance`. Brief: What we'll learn (page CANONICAL · EDITABLE, contract CANONICAL · READ-ONLY), Risks (GENERATED · EDITABLE vs GENERATED · READ-ONLY), Timeline (SYSTEM · READ-ONLY vs COMPUTED · READ-ONLY). Plan: Objectives, Research questions and Timeline (system vs INHERITED · READ-ONLY), Risks (generated editable vs GENERATED · READ-ONLY) | Fix CC-4/CC-5: render vm provenance (§1.1 rule 2) |
| PF-21 | `useBriefViewModel` / `usePlanViewModel` duplicate the pages' inline projection mapping and are unused | Fix CC-4/CC-5: pages adopt the hooks and delete the inline `useMemo` |
| PF-22 | Two different "system" label strings: projection `READ-ONLY · SYSTEM` vs `ProvenanceTag` `SYSTEM · READ-ONLY` | Resolved by rule 2 (the projection label wins). The legacy ProvenanceTag map is removed in CC-5 |

---

## 3. Shell architecture

```
AppShell (variant = workspace when route ∈ WORKSPACE_ROUTE_PATTERNS)
├─ a.skip-link → #main-content
├─ SideNav variant="inverse"            64px  dark, global app nav (existing navItems)
└─ main#main-content
   └─ <PlanDocument> | <BriefDocument>
      └─ WorkspaceLayout
         ├─ #workspace-nav  LifecycleRail variant="inverse"   224px  dark, study stages
         └─ column
            ├─ ArtifactHeader              52px  crumb · ArtifactTabs · save · GitHub · rail toggles · actions
            └─ body
               ├─ .canvas  (scroll owner)  document column max 640 + padding
               │    Alert(rule) · Masthead · DocumentSection… · CollapsibleSection…
               │    or: EditToolbar (sticky) + ArtifactEditor
               └─ ContextRail  344 open | 48 strip | overlay | sheet
```

- The page body never scrolls on workspace routes (`height:100dvh; overflow:hidden`). The canvas and the rail body scroll independently. The lifecycle panel scrolls on its own if it overflows.
- **`DESIGN DECISION REQUIRED — DDR-01` (TopBar).** The prototype has no global top bar. Production TopBar carries the org lockup, the search trigger (routes to `/search`, which isn't routed) and the user menu. **Recommended default:** don't render TopBar on workspace routes. The user menu moves to the SideNav avatar, search stays reachable via the SideNav "Search" item, and the org name becomes the lifecycle panel eyebrow. The ⌘K hint is dropped (no shortcut handler exists). If rejected, TopBar stays at 56px above the workspace, the dark rails start below it, and `height` becomes `calc(100dvh - var(--layout-topbar))`. **CC-3 can't start until DDR-01 is answered.**
- Non-workspace routes (Home, Projects, forms, StudyOverview) keep the current AppShell layout. They only pick up the CC-1 token value changes.

---

## 4–6. Tokens, typography, components
See `TOKENS.md` and `COMPONENT_MAPPING.md`. Exact CSS is in `reference/workspace-v2.reference.css`.

---

## 7. Brief ↔ Plan convergence

Plan is already built from the shared primitives. Brief inlines equivalents under `.brief-doc` global classes and hex-coded inline styles. The target is **the same primitives, the same order of chrome, and Brief-specific semantics kept**. The Brief data model, queries and mutations don't change.

| Brief today (BriefDocument.tsx) | Converges to | Notes |
|---|---|---|
| Inline breadcrumb `<nav class="crumbs">` with hex styles | `ArtifactHeader` crumb | Study name only; Home is reachable in the app rail |
| Inline `h1` "Research Brief" + status pills + GitHub link | `Masthead artifactLabel="Research Brief"` + `Alert appearance="rule"` + header GitHub link | Status pill removed; the notice conveys state |
| Inline tab strip | `ArtifactTabs` (in header) | |
| Three inline alert banners (approved / pending / changes) | `Alert appearance="rule"` variants success / warning / error | "Revise" stays as the notice action → `setIsEditing(true)` |
| Inline save text + "Last saved" | `SaveStateIndicator` per §8.5 | |
| `.blk.ro` + `.masthead` | `Masthead masthead={vm.masthead} artifactLabel="Research Brief"` | Shows Requested by and Date. Status is omitted on Brief (the notice carries it) |
| `.doc-sec` + `h2` + `.prov` spans | `DocumentSection provenance={[…FieldProvenance]}` | Per-section field list in COMPONENT_MAPPING §4.3. Hardcoded strings removed (PF-20) |
| `.blk.ed` + `.grip` + `MarkdownDisplay` | `MarkdownDisplay className={docStyles.blockProse}` | Grip removed (PF-05) |
| `.facts` quick facts | `FactsGrid facts={[qf.method, qf.participants, qf.timeline, qf.decisionDeadline, qf.budget]}` | `qf = vm.quickFacts`. FactsGrid drops `exists:false` |
| `.itemrows` barriers / objectives / questions | `StructuredItemRows` + `StructuredItemRow` (`source` for barriers, `priority` for questions) | |
| `h3` "Target barriers for validation", "Research questions" | `h3.secSubheading` | |
| Participants `table.doc-table` | `DocumentTable` columns Segment / Count (`emphasis`, `align:'center'`) / Rationale | |
| Risks table | `DocumentTable` Risk / Source / Mitigation | |
| Timeline phases table or start/deadline facts | `DocumentTable` Phase / Dates; fallback `FactsGrid` | |
| `p.kv` Approach / Recruitment / Hard deadline | `p.kvParagraph` | |
| `ApprovalSection` | unchanged component, restyled | |
| `details.sys` ×3 | `CollapsibleSection` ×3 | Inner tables → `DocumentTable`. Content and copy unchanged (incl. PF-12 values) |
| Inline `<aside class="review-rail">` | `ContextRail` mode `review` → `ReviewRail` (extended) | CC-5 moves the JSX; CC-7 replaces it with ReviewRail |
| `import '@/styles/brief-document.css'` | removed; file deleted | |

**Brief-specific (keep, don't generalize):** approval gate and Review mode · status notices and Revise action · `generated+canonical` compound provenance · barriers with `source` · participant segments table · discovery sources table inside Research provenance · the "Approved → downstream stale" copy.

**Plan-specific:** no Review mode and no rail in UX-3A (DDR-05) · Objectives, Research questions and Timeline render `vm.*.provenance` (`INHERITED · READ-ONLY`, PF-20) with `sourceNote` "From the approved brief". The `systemBlock` wrapper and the "What we aim to learn — inherited from the approved brief:" line are replaced by the `sourceNote` · Research period header · Brief commitments table · Timeline footnote → `p.docFootnote` (copy per DDR-12).

---

## 8. TipTap design specification

Production swaps the whole view for `ArtifactEditor` while editing. The editor contains **only** the editable prose sections built by `buildPlanEditorContent` / `buildBriefEditorContent`. System and inherited sections aren't in the editor. That's production behavior and it stays. The design expresses it; it doesn't change it.

### 8.1 Editable content (QoriSection, `contenteditable` not false)
| State | Treatment |
|---|---|
| default | No chrome. Body serif 16/28, H2 display 27/31, H3 mono caps 11 |
| hover | `--color-brand-wash` fill, `cursor:text`, `--motion-fast` |
| focus (caret inside section) | 2px `--color-brand` left rule + wash. **Requires DDR-09** (`Focus` extension, `className:'has-focus'`, `mode:'shallowest'`, decoration only). **Fallback if rejected:** no per-section focus state; the ProseMirror root gets `outline: var(--focus-ring)` on `:focus-visible` (restore the production rule instead of the reference's `outline:none`). |
| dirty | Document-level only (production tracks one `isDirty`). Header save state shows "Unsaved changes" with a brand dot, and Save is enabled. No per-section dirty marker. |
| provenance | `::before` shows `attr(data-provenance)` mono caps top-right of each section, always visible while editing |

### 8.2 Read-only content inside the editor
- **QoriSection with `contenteditable="false"`** (provenance system/inherited): `--color-surface-muted` fill, `cursor:default`, label "{provenance} · read-only". **No opacity reduction.**
- **QoriSystemBlock:** muted fill, "System · read-only" label, `pointer-events:none`, `opacity:1` (fixes PF-13).
- **Editing-mode context line** above the editor (`.editorContext`, 12px muted): "Read-only sections — masthead, quick facts, {inherited|system} sections, timeline and approval — aren't shown while editing." **Copy is proposed** (DDR-15).

### 8.3 Inherited Plan content
In view mode: `DocumentSection provenance="inherited"`. The lock glyph and the `sourceNote` link to the Brief are always visible. In edit mode it's absent (not hydrated). No lock treatment appears inside the editor unless a future builder includes inherited sections, in which case §8.2 applies automatically through `data-provenance`.

### 8.4 Structured items (QoriStructuredItem)
The ID is rendered **only** via CSS `::before { content: attr(data-qori-item) }`. That makes it not selectable, not in the text content and not deletable, which matches the extension's contract that the ID is an attribute. Text is serif 15/24, rows are separated by hairlines, and the ID column is 56px `--color-brand-deep`. There's no dashed box (the production dashed border is retired). The toolbar hint "Structured blocks keep their IDs — RQ-003 stays RQ-003" stays.

### 8.5 Save state mapping (pages → SaveStateIndicator)
| Condition | `state` | label |
|---|---|---|
| not editing, `pipeline.state==='idle'`, no `lastSavedAt` | not rendered | — |
| not editing, `idle`, `lastSavedAt` | `saved` | `Saved · {time(lastSavedAt)}` via `savedAt` |
| editing, not dirty | not rendered | — |
| editing, dirty | `dirty` | "Unsaved changes" |
| `saving` | `saving` | "Saving…" |
| `synced` | `saved` | "Saved" (settles to idle after 3s, per the pipeline) |
| `sync_failed` | `syncPending` | "Saved · GitHub sync pending" + `Alert rule warning` below the header (Plan's existing copy) |
| `save_failed` | `error` | "Save failed" + `Alert rule error` with `pipeline.error` |

### 8.6 Toolbar (EditToolbar)
- **Location:** first child of the canvas document column while editing, centered, `position: sticky; top: 12px` relative to `.canvas`.
- **Dimensions:** 40px tall (4px pad + 32px tools), `--radius-xl`, 1px emphasis border, `--elevation-md`, width `max-content`, `max-width: 100%`, bottom margin 32px.
- **Tools** (production set, unchanged): Bold, Italic | H2, H3 | Bullet list, Numbered list | hint. **`DDR-08`**: adding Quote / Link / Table buttons (the extensions exist; markdown round-trips them) is a product call. Underline is never added (no markdown serialization).
- **Tool states:** rest `--color-text-meta`; hover `--color-surface-hover`; active (`editor.isActive`) `--color-brand-tint` + `--color-brand-deep` + 600; disabled (`!editor.can().chain()…run()`) quiet; focus-visible global ring.
- **Separators:** 1×16px `--color-border`, 8px side margins.
- **A11y:** `role="toolbar" aria-label="Formatting"`, each button `aria-label` (Bold, Italic, Heading 2, Heading 3, Bullet list, Numbered list) + `aria-pressed={isActive}`, roving tabindex (one tab stop; ←/→ move, Home/End jump). The hint is plain text outside the tab order.
- **Responsive:** ≥768 floating pill. ≤767 full-bleed bar, `top:0`, square corners, horizontal scroll if needed, hint hidden, 40px tools.

---

## 9. Provenance

Provenance stays in the system. The researcher experience is document-first. **All labels come from `FieldProvenance.label` in the view model.** React only decides *visibility*, never the text or editability.

### 9.1 Visibility by authority (view mode)
| `authority` (projected) | Label text (from projection) | Default | Hover / focus-within | Always visible | Screen reader |
|---|---|---|---|---|---|
| generated, editable | GENERATED · EDITABLE | hidden (opacity 0) | shown | — | label read after heading |
| generated, read-only | GENERATED · READ-ONLY | hidden | shown | lock glyph | label + lock `title` |
| canonical (contract `cascade`) | CANONICAL · READ-ONLY / · EDITABLE | hidden | shown | lock glyph if read-only | same |
| inherited | INHERITED · READ-ONLY | hidden | shown | lock glyph + "From the approved brief" link | label + link |
| system | READ-ONLY · SYSTEM | hidden | shown | lock glyph | label |
| computed | COMPUTED · READ-ONLY | hidden | shown | lock glyph | label |
| user_input | USER INPUT · READ-ONLY | hidden | shown | lock glyph | label |
| unsupported | UNSUPPORTED | **never rendered as a section.** If a section's only field is `unsupported`, the section doesn't render (the `exists` flags already enforce this) | — | — | — |

### 9.2 Sections composed of several fields
`DocumentSection` receives `provenance: FieldProvenance[]`, one per field it renders, in render order, and only fields whose `exists` is true.
- **Label:** distinct `label`s, deduped, joined with " + " (e.g. `GENERATED · EDITABLE + CANONICAL · READ-ONLY`). **DDR-17** covers the compound copy.
- **Lock glyph:** shown when *every* entry has `editable:false`.
- **Source line:** shown when *every* entry has `authority:'inherited'`.

### 9.3 Other rules
- Text-level provenance (IDs, citations) is always visible because it's content, not chrome.
- Section labels are never color-coded (the production chips' hues are retired). The label text carries the distinction.
- ≤767 there's no hover, so labels are visually hidden and remain SR-readable. Lock glyphs and source lines still show.
- Review mode doesn't change provenance visibility.
- Editing: labels show via the QoriSection `data-provenance` attribute (§8.1), which is set by the page's editor builder. Builders are unchanged.
- Quick facts, the masthead and the approval checklist have no `FieldProvenance` in the view model. They keep their existing visually hidden "READ-ONLY · SYSTEM" text in the component.
- The prototype's dark **trace cards** aren't built in UX-3A: no contract carries trace data. IDs keep their `title` tooltip.

---

## 10. Contextual rail

### 10.1 Phase-ready shell (implement in CC-3 / CC-7)
| Property | Spec |
|---|---|
| Open width | `--layout-context-rail` 344px (**DDR-02**: production's panel token is 384px. Recommended: new 344 token; 384 stays for Ask/trace) |
| Collapsed strip | 48px, docked right. One 32px icon button per mode (Review = lucide `ClipboardCheck`) with `aria-pressed=false` |
| Tab row | 48px, tabs 13px, active 600 + 2px `--color-indicator`, optional mono count. Close button (lucide `X` 16, `aria-label="Close panel"`) right-aligned |
| Open/close | Header rail toggle, strip icon, or tab close. Opening sets `activeMode`; closing sets `null` → strip |
| Researcher default | Brief: open on Review when `brief_status !== null` and the viewport is ≥1181 (production default, `showReviewRail=true`). Closed (strip) at ≤1180. Plan: **no rail and no strip** in UX-3A (no modes) |
| Reviewer mode | **Not a separate mode.** Production has no role gating; everyone sees Approve/Request changes (as today). **DDR-06** |
| While editing | Rail and strip unmounted (production hides the rail while editing). The header rail toggle is hidden |
| Overlay (981–1180 and 768–980) | `position:fixed`, full height, right edge, width `min(344px, 92vw)`, `--elevation-overlay-end`, `--z-rail-overlay`, no scrim, non-modal. The strip stays docked |
| Mobile (≤767) | Full-screen sheet (`inset:0`, `--z-drawer`), modal. No strip; opened from the header toggle |
| Scroll ownership | `.railBody` scrolls (`overscroll-behavior: contain`); tab row fixed |
| Focus | Open via toggle → focus moves to the active tab. Close → focus returns to the invoking control (toggle or strip button). Escape closes when overlay or sheet; docked rails ignore Escape |
| Semantics | `aside#context-rail aria-label="Document panel"` › `div role="tablist" aria-label="Panel mode"` › `button role="tab" aria-selected aria-controls` › `div role="tabpanel" aria-labelledby tabIndex={0}`. Arrow keys move between tabs (automatic activation). Sheet (≤767): wrapper `role="dialog" aria-modal="true" aria-label="Document panel"` with focus trap |

### 10.2 Review mode mapping (Brief only)
| `brief_status` | Status heading | Body | Controls |
|---|---|---|---|
| `null` | — | rail not rendered (production) | — |
| `pending_approval` | "Pending approval" (warning) | production copy; "Sent to {reviewer}" if present | checklist (4 production keys/labels) · Approve (primary, disabled until all checked; `approve.mutateAsync({checklist_confirmed:true})`) · Request changes → Textarea → Submit (`requestChanges.mutateAsync({comment})`) |
| `changes_requested` | "Changes requested" (error) | "by {reviewer}" + feedback quote | none in rail; "Revise" is on the notice |
| `approved` | "Approved" (success) | "by {reviewer} · {date}" + downstream-stale copy | none |

The production rail note ("Feedback anchors to sections today. Future: comment threads…") is **removed**. It's roadmap copy in the UI.

### 10.3 Future functional behavior (not UX-3A)
- **Coaching** mode: card list with strength/suggestion/gap/check tones and anchor links to `sec-{sectionId}`. Needs a coaching data source.
- **Comments** mode: threads anchored to sections or stable IDs, resolve/reply, `.secFlag` "Feedback" marker on flagged sections. Needs a comment model; production has only `brief_change_feedback`.
- **ID trace cards:** needs a trace/provenance endpoint.
- ContextRail's `modes` prop already accepts these ids, so adding them later is a data change, not a layout change.
- **`DDR-05`**: show Coaching/Comments as disabled tabs in UX-3A? **Recommended: no.** Empty or disabled tabs are placeholder UI.

---

## 11. Responsive
See `RESPONSIVE.md`.

---

## 12. Accessibility requirements

1. **Headings:** one `h1` (Masthead) per page. Sections are `h2`. Subsections are `h3`, and markdown `h2` inside a section renders as a run-in label (`blockProse h2`) so the outline doesn't break. The rail status is `h2` inside its tabpanel. Collapsible titles aren't headings.
2. **Landmarks:** `nav[aria-label=Main]` (SideNav), `nav[aria-label="Study lifecycle"]`, `main#main-content`, `header` (ArtifactHeader, inside main), `nav[aria-label=Breadcrumb]`, `nav[aria-label="Study artifacts"]`, `aside[aria-label="Document panel"]`.
3. **Keyboard:** everything is reachable in DOM order: SideNav → lifecycle → header → toolbar (when editing) → document → rail. Toolbar and rail tabs use roving focus. Locked lifecycle links stay focusable and announce their hint.
4. **Focus-visible:** `:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px }` on light surfaces, `--focus-ring-inverse` on dark. Never remove it without a replacement. Sticky header/toolbar must not obscure the focused element: `.canvas { scroll-padding-top: 64px }` while editing.
5. **Tablists:** only the rail uses the ARIA tab pattern. Artifact tabs are links with `aria-current` (PF-06).
6. **Drawer/dialog:** the nav drawer (≤980) and rail sheet (≤767) are modal dialogs with focus trap, Escape to close, and focus returned to the opener. `inert` is set on the rest of the workspace while open. The rail overlay (768–1180) is non-modal: no trap, Escape closes, focus returns.
7. **Escape order:** open user menu → rail overlay/sheet → nav drawer. One Escape closes one layer.
8. **Editor toolbar:** see §8.6.
9. **Contrast:** all text pairs ≥4.5:1 per TOKENS §3. `--color-text-quiet` and `--color-brand` on light surfaces never carry text or sole state.
10. **Reduced motion:** all durations become 0, the save pulse is static, canvas smooth scroll is off, and drawers appear without sliding.
11. **Screen-reader labels:** icon-only buttons have `aria-label`. SideNav labels are visually hidden, not removed (PF-17). Save state is `aria-live="polite"`. Error Alerts use `role="alert"`.
12. **Provenance:** §9. Never `aria-hidden`. Lock glyphs are `aria-hidden` because the adjacent provenance text carries the meaning.
13. **Target size:** ≥24×24 at all widths (WCAG 2.2 2.5.8). Header/rail controls are 32px, 40px ≤767.
14. **Automated:** `vitest-axe` on Brief (each of 4 statuses) and Plan (view + edit), zero violations, in CC-8.

---

## 13. Non-goals for UX-3A

Not implemented: full AI Research Coach behavior · comments persistence or threading backend · Coaching/Comments tabs (DDR-05) · ID/citation trace cards · evidence ingestion · new canonical research state · new artifact schemas · Plan approval · authorization or reviewer-role gating · lifecycle/archive backend · backend lifecycle nodes · GitHub-as-canonical behavior · editor replacement or new TipTap node types · fixing Brief editor hydration (PF-04, unless DDR-11 says otherwise) · routes for SideNav items without pages (PF-10) · new toolbar tools (DDR-08 default) · migrating non-workspace pages (Home, Projects, forms, StudyOverview) to the dark shell.

---

## 14. Design decisions required

Each has a recommended default. Claude Code must not implement a default marked **blocking** until the product owner confirms it.

| ID | Question | Recommended default | Blocking |
|---|---|---|---|
| DDR-00 | Which ref is canonical, and where is `artifact-contracts`? | **Resolved:** `dev` @ `7f0366d8`; primitives consume `BriefViewModel`/`PlanViewModel` | — |
| DDR-01 | TopBar on workspace routes | Not rendered; user menu → SideNav avatar; org name → lifecycle eyebrow | **CC-3** |
| DDR-02 | Context rail width | New `--layout-context-rail: 344px` | no |
| DDR-03 | Lifecycle node source for Brief/Plan | Reuse `computeLifecycleNodes` moved verbatim to `study/lifecycle.ts` | no |
| DDR-04 | Token rollout scope | Global (all pages get the new values) | **CC-1** |
| DDR-05 | Coaching/Comments tabs in UX-3A | Hidden | no |
| DDR-06 | Reviewer-only approval controls | None (matches production) | no |
| DDR-07 | Font hosting | Self-host if federal hosting requires it; else Google Fonts link | **CC-1** |
| DDR-08 | Add Quote/Link/Table toolbar tools | No | no |
| DDR-09 | Add TipTap `Focus` extension (decoration only) for per-section focus | Yes (requires `@tiptap/extensions` dependency) | CC-6 |
| DDR-10 | Send `brief.artifact_version` instead of `1` | Yes, one-line fix in CC-5 | CC-5 |
| DDR-11 | Fix Brief editor hydration (PF-04): hydrate the 5 `generated`/editable prose sections the contract declares | **Escalated.** Recommended: a separate ticket that lands before CC-5 ships, so view-mode EDITABLE labels match edit mode. If it can't land first, CC-5 ships anyway and the mismatch is listed in release notes | CC-5 (ship decision) |
| DDR-12 | Plan timeline footnote copy | "Timeline begins once fieldwork starts." (product to confirm) | CC-4 |
| DDR-13 | Reconcile the two approval checklists | Keep both until the approval model is revisited | no |
| DDR-14 | SideNav items without routes | Keep (production) | no |
| DDR-15 | New UI copy in this spec (collapsible summaries, editor context line, Approve hint) | Use as written; content design to review | no |
| DDR-16 | Brief Document information fallbacks (PF-12) | Adopt Plan's pattern: omit rows whose vm value is empty. No invented model/template | CC-5 |
| DDR-17 | Compound provenance copy for multi-field sections (§9.2) | Deduped labels joined with " + " | no |
