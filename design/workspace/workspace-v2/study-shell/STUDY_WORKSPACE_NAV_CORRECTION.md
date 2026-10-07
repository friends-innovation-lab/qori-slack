# Study Workspace Navigation Correction

**ID:** NAV-1 · **Status:** READY FOR ARCHITECTURE REVIEW
**Scope:** The shell architecture, navigation hierarchy, route model and Discovery landing semantics. Discovery page *content* keeps its approved design (DISCOVERY_WORKSPACE_DESIGN_SPEC rev 2, DISCOVERY_REDLINES). Where this document conflicts with those on shell, rail rows or Hub naming, this document wins.
**Source read:** `friends-innovation-lab/qori-slack@dev` (tree 5fc705e0a7ad), 2026-10-07. `App.tsx`, `components/shell/AppShell.tsx`, `SideNav.tsx`, `components/study/LifecycleRail.tsx`, `workspaceLifecycle.ts`, `lifecycle.ts`, `workspace/WorkspaceLayout.tsx` (+ .module.css), `pages/StudyOverview.tsx`, `pages/discovery/DiscoveryHub.tsx`.
**Screens:** `screens/00 Index.html` → S01–S09.

---

## Current Problem

All study routes are flat children of one `<AppShell>` in `App.tsx`. AppShell picks a shell per route with `WORKSPACE_ROUTE_PATTERNS = ['/studies/:studyPublicId/plan', '/studies/:studyPublicId/brief']`. Each page then decides for itself whether to render a lifecycle rail.

| Route | AppShell variant | Page-level nav | What the researcher sees |
|---|---|---|---|
| `/studies/:id` → `StudyOverview` | **Default**: TopBar + light SideNav (Home · Projects · Studies · Search · Ask Qori · Work Queue) | `LifecycleRail variant="default"`: the light 200px **legacy 7-node list** (Overview · Brief · Plan · Sources · Evidence · Findings · Outputs) placed beside Card content | **Shell A.** An org page, plus a second study-progress model that matches neither the dark rail nor Discovery. |
| `/studies/:id/brief`, `/plan` → `BriefDocument`, `PlanDocument` | **Workspace**: no TopBar, `SideNav variant="inverse"` (64px) | `WorkspaceLayout nav={<LifecycleRail variant="inverse">}`: the dark grouped lifecycle (224px) | **Shell B**, the intended Study Workspace. |
| `/studies/:id/discovery`, `/discovery/new/*`, `/discovery/runs/:runId(/…)` → `DiscoveryHub`, `DeskIntake`, `StakeholderIntake`, `DiscoveryRunPage` | **Default** (these routes aren't in the patterns) | `WorkspaceLayout nav={<LifecycleRail variant="inverse">}` | **Shell C, nested.** The org TopBar and light SideNav, *and* the dark lifecycle panel rendered as page content. |
| `/studies/:id/brief/new`, `/plan/new` → `BriefForm`, `PlanForm` | **Default**: `matchPath` is exact, so the patterns don't match `/new` | none | Shell A without any study nav, mid-flow between Discovery and Brief. |

Root causes:
1. **Shell selection is a route allow-list**, not a route *tree*. Each new study route has to be remembered in two places, and Discovery wasn't added.
2. **Each page mounts its own lifecycle rail** through `WorkspaceLayout`'s `nav` prop. Each page fetches study data and computes lifecycle state again. `DiscoveryHub` hardcodes `briefStatus = null`, so Research Plan shows locked on every Discovery page even after the brief is approved.
3. **Two lifecycle models are live**: `computeLifecycleNodes` (7 legacy stages, used by the light rail and for the Plan lock) and `WORKSPACE_LIFECYCLE` (5 groups / 16 items, the approved model).
4. **"All evidence" means "the Hub with no `?type=` filter."** The Discovery type rows are query-string filters of one page, not destinations. So the landing has no name, and the H1 on that landing is the *project* name.

---

## Target Shell Architecture

**Principle (locked):** Opening a study enters one persistent Study Workspace shell. Every `/studies/:id/*` route renders inside it. The lifecycle rail is mounted once, by the shell, and never by a page.

```
AppShell (workspace variant for /studies/:id/*)
└─ StudyWorkspace                       ← NEW layout route; owns study fetch, lifecycle state, nav drawer
   ├─ [A] SideNav inverse (64px)        ← org navigation, unchanged
   ├─ [C] LifecycleRail inverse (224px) ← study navigation, ONE instance
   └─ <Outlet/> → page
       ├─ [D] ArtifactHeader             ← breadcrumb + artifact tabs + page actions
       ├─ canvas                          ← page content
       └─ [E] ContextRail (optional)     ← per-page
```

That makes two navigation layers, org and study, at all times. Page-level navigation is horizontal in the header (breadcrumb, tabs) and never a third rail.

| Layer | Component | Lives | Contains |
|---|---|---|---|
| **A. Organization** | `SideNav variant="inverse"` | Shell, left edge, 64px | Home · Projects · **Studies** (current on every study route) · Ask Qori · Admin · avatar. This is the existing VC-2A set (Search and Work Queue were removed in the workspace by an earlier decision. See Open questions.) |
| **B. Study entry** | `StudyWorkspace` layout route | Router | Entered by any link to `/studies/:id/*`. No interstitial. |
| **C. Study lifecycle** | `LifecycleRail variant="inverse"` | Shell, 224px | Study block (project eyebrow · study name · ← All studies), **Study overview** row, then the groups Discovery / Planning / Fieldwork / Analysis / Outputs. |
| **D. Artifact / page** | `ArtifactHeader` (52px) | Page | Breadcrumb that starts at the lifecycle group; artifact tabs (Run: Report · Sources · Extracted; Brief/Plan: existing); status; page actions. |
| **E. Context** | `ContextRail` (344px) | Page | Brief/Plan: Review · Comments · Coaching (unchanged). Discovery run: Evidence rail (DISC-6) and Comments. Overviews and type pages: none. |

---

## Organization → Study Transition (S01 → S02)

- `/studies` (the list), `/projects/*` and Home stay in the **org shell** (TopBar + 232px light SideNav).
- Every study link goes to `/studies/:id`. The org shell is replaced by the workspace shell: TopBar and light SideNav unmount, SideNav inverse and the lifecycle panel mount, and the Studies icon stays current so the researcher keeps their org bearing.
- Deep links (Slack, Work Queue, search) to any child route enter the same shell directly.
- **Leaving:** "← All studies" in the study block, or any org icon. Both return to the org shell.
- ≤980px: the existing 288px drawer holds both layers (org rail + study panel). It is owned by StudyWorkspace, so it is identical on every study route.

---

## Study Workspace Landing (S02)

`/studies/:id` → **Study overview**, the first rail row. It sits above the groups and is ungrouped, because it belongs to the whole study.

Content (two sections, no filler):
1. **Needs you**: the top 3 items across the study (artifact approvals and comments, the Discovery review queue), using the Discovery sort. Rendered only when ≥1. More than 3 gets a link to "See all in Discovery →".
2. **Where this study is**: one row per lifecycle group, in rail order: group · status line · the single most useful action. Not-started groups show no action.

The masthead meta row holds Project · Lead · Now in. This replaces "At a glance". The light 7-node `LifecycleRail` and the Card stack are removed.

---

## Discovery IA

### Answers

| Question | Answer |
|---|---|
| What is the Discovery landing? | **Discovery › Overview** at `/studies/:id/discovery`. It is a real page with its own name. Its H1 is "Discovery", not the project name. |
| Is "All evidence" the right name? | **No. Retire it.** It named a filter state rather than a place, and researchers read it as "a list", not "the home of Discovery". |
| Page, filter, or default state? | **A page.** The type views stop being `?type=` filters and become routes. |
| Where do the types sit? | They are **siblings under the Discovery group**, after Overview: Desk research · Stakeholders · Surveys · Synthesis. Overview summarizes them, and each type page owns its full ledger. Run pages sit **under their type**: the type row stays current, and the run appears only in the breadcrumb and H1. |
| How does the researcher know "I am in Discovery"? | Four redundant signals: (1) the DISCOVERY group heading turns text-inverse when it contains the current row (NEW N3); (2) the current row indicator; (3) the breadcrumb starts with "Discovery"; (4) the masthead eyebrow says DISCOVERY. At ≤980 the crumb hides, and the eyebrow and drawer carry the signal. |

### Rail rows (Discovery group)

| Row | Route | Count | Dot / ring | Notes |
|---|---|---|---|---|
| **Overview** (replaces All evidence) | `/discovery` | **none** (a sum duplicates the type rows) | brass dot if any type needs review | |
| Desk research | `/discovery/desk` | Ready desk artifacts | dot if any needs review | Label is sentence case (was "Desk Research") |
| Stakeholders | `/discovery/stakeholders` | Ready | dot | |
| Surveys | `/discovery/surveys` | Ready | dot | DISC-3 lists Ready only (unchanged) |
| Synthesis | `/discovery/synthesis` | — | ring when out of date, check when current | placeholder until DISC-5 (unchanged) |

### Discovery Overview content (S03)

The approved Hub content is kept. Only the H1 changes, and §2 changes:
1. Needs your review (unchanged B5)
2. **Evidence by type** (NEW N5, replaces the cross-type run ledger): one row per type. Each row has a name, its markers, a status line with the same counts as the rail, and Open →. A type with 0 runs reads "No runs yet · Add…". The Synthesis row appears from DISC-5.
3. Across sources (DISC-5, unchanged)
4. What we don't know yet (unchanged)
5. Into the brief (unchanged)

Header: eyebrow DISCOVERY · H1 "Discovery" · meta "Scope: shared by all studies in {project}". Discovery data is project-scoped, so this line is required. Then the status line and the Add evidence menu (unchanged).

### Type pages (S04, S05)

Eyebrow DISCOVERY · H1 = type name · one-line description · status line for this type · a **single** add action for this type (no menu). Then: Needs your review (this type only, rendered if ≥1), and Runs (`RunLedgerTable grouped=false`). The empty state is one B27 explainer row for this type. Section numbers count rendered sections only.

---

## Route Model

All routes are children of `studies/:studyPublicId` with `element={<StudyWorkspace/>}`.

| Path (relative) | Page | Rail current | Breadcrumb |
|---|---|---|---|
| *(index)* | StudyOverview (rewritten) | Study overview | Study overview |
| `discovery` | DiscoveryOverview (was DiscoveryHub) | Discovery › Overview | Discovery › Overview |
| `discovery/desk` | DiscoveryTypePage `type=desk` | Desk research | Discovery › Desk research |
| `discovery/stakeholders` | DiscoveryTypePage `type=stakeholder` | Stakeholders | Discovery › Stakeholders |
| `discovery/surveys` | DiscoveryTypePage `type=survey` | Surveys | Discovery › Surveys |
| `discovery/synthesis` | (DISC-5) | Synthesis | Discovery › Synthesis |
| `discovery/new/desk` | DeskIntake | Desk research | Discovery › Desk research › Add documents |
| `discovery/new/stakeholder` | StakeholderIntake | Stakeholders | Discovery › Stakeholders › Add material |
| `discovery/runs/:runId` · `/sources` · `/extracted` | DiscoveryRunPage | from `run.artifactType` (none while loading; group still current) | Discovery › {Type} › {Run} |
| `brief` · `brief/new` | BriefDocument · BriefForm | Research brief | Planning › Research brief (› New brief) |
| `plan` · `plan/new` | PlanDocument · PlanForm | Research plan | Planning › Research plan (› New plan) |

Redirects: `discovery?type=desk|stakeholder|survey` → `discovery/desk|stakeholders|surveys` (`replace`). Run URLs are **unchanged**, so existing Slack and app links keep working.

AppShell: `WORKSPACE_ROUTE_PATTERNS = ['/studies/:studyPublicId/*']`. `matchPath` with `/*` matches the base as well, and `/studies` (the list) stays org.

---

## Navigation Hierarchy

```
Organization (SideNav inverse · 64px)            Home · Projects · [Studies] · Ask Qori · Admin
└─ Study (LifecycleRail · 224px)                 {Project} / {Study name} / ← All studies
   ├─ Study overview
   ├─ DISCOVERY      Overview · Desk research · Stakeholders · Surveys · Synthesis
   ├─ PLANNING       Research brief · Research plan · Discussion guide
   ├─ FIELDWORK      Outreach · Participants · Sessions · Observers
   ├─ ANALYSIS       Session analysis · Affinity & themes
   └─ OUTPUTS        Design opportunities · Readouts · Tickets
      └─ Page (ArtifactHeader)                   Breadcrumb · artifact tabs · actions
         └─ Context (ContextRail)                Review · Comments · Coaching · Evidence
```

Rules:
- The rail lists **destinations only**. Runs, versions, and sub-steps (survey stages) never become rail rows.
- Group headings are labels, not links.
- The study name is text, not a link. The Study overview row is the single target for the study landing.
- Rail labels use sentence case to match the existing rail ("Research brief", "Desk research").

---

## Updated Screens / Redlines

`design/workspace/workspace-v2/study-shell/screens/`

| # | Screen | Shows |
|---|---|---|
| S01 | Studies → enter a study | Org shell, entry rule, what unmounts and mounts |
| S02 | Study overview | Landing: Needs you, Where this study is |
| S03 | Discovery → Overview | Renamed landing, N5 Evidence by type, the four "in Discovery" signals |
| S04 | Discovery → Desk research | Type page; ledger and queue filtered |
| S05 | Discovery → Stakeholders | Type page; section numbering rule |
| S06 | Discovery → completed run | Run under type; tabs; breadcrumb depth 3 |
| S07 | Research brief | Same shell; ContextRail Review |
| S08 | Research plan | Same shell; ContextRail Comments |
| S09 | Shell redlines | Rail anatomy (two states), active-row table, ≤980 drawer |

New visual rules (everything else is an existing token or rule):

| ID | Rule |
|---|---|
| N1 | Study name in the study block is plain text (display 19/24), not a link. Eyebrow = project name (existing `orgName` prop). |
| N2 | `Study overview` row: standard `.nv` row in an ungrouped list above DISCOVERY, followed by an 8px gap and a 1px `--color-rule-inverse` divider. |
| N3 | Group heading `.cur`: `--color-text-inverse` (from `--color-text-inverse-quiet`) when the group contains the current row. |
| N4 | Breadcrumb starts at the lifecycle group. Last crumb `--color-text` 600 with `aria-current="page"`. Max-width 420px. |
| N5 | Evidence-by-type row: B27 `.erow` geometry. Serif 17/24 600 title + markers; 13/20 muted status; "Open →" 13 600 link; whole row is one link; hover `--color-surface-hover`. |
| N6 | Study overview lifecycle row: grid `128px / 1fr / auto`. Group in mono 11 caps (`--color-text-meta`); status 14/20 with 12/16 muted sub-line; action 13 600 link. Not started = muted, no action. |

No new tokens and no new colors.

---

## What Existing DISC-3 UI Can Be Reused

- **Unchanged:** `LifecycleRail` inverse styling (rows, counts, brass dot, ring, lock); `SideNav` inverse; `ArtifactHeader`; `ContextRail`; `WorkspaceLayout`'s drawer, scrim, inert and focus logic (it moves up into StudyWorkspace).
- **Unchanged content components:** `ReviewQueue`, `RunLedgerTable` (with `grouped=false` on type pages), `KnowledgeGapsSection`, `HubEmptyExplainer` (per-type rows), Add-evidence menu, all of `DiscoveryRunPage` (Report / Sources / Extracted), `DeskIntake`, `StakeholderIntake`, every B-redline in DISCOVERY_REDLINES.
- **Unchanged data:** `useDiscoveryCounts`, `useDiscoveryRuns({type})`, `useDiscoveryArtifacts`, `useKnowledgeGaps`. They are now called **once** in StudyWorkspace for the rail counts. Pages still call what they display, and React Query dedupes.
- Brief and Plan pages: content, editor, review, ReferenceNavigation all unchanged.

## What Must Change

1. **Router:** make study routes nested under a `StudyWorkspace` layout route.
2. **AppShell:** the workspace pattern becomes `/studies/:studyPublicId/*`.
3. **StudyWorkspace (new):** owns the study query, real brief status, `computePlanLock`, Discovery counts, `navOpen` state and the drawer, and renders the rail once plus `<Outlet/>`.
4. **WorkspaceLayout:** drop the `nav` prop and the drawer from page use. Split it into `StudyWorkspaceFrame` (nav region + drawer, used by StudyWorkspace) and the page body (header + canvas + rail). The header's menu button calls `useStudyWorkspace().openNav()`.
5. **Six pages** stop rendering `LifecycleRail` and stop computing lifecycle nodes: BriefDocument, PlanDocument (both branches), DiscoveryHub, DeskIntake, StakeholderIntake, DiscoveryRunPage. BriefForm and PlanForm gain the shell for free.
6. **StudyOverview:** rewrite as S02. Remove `LifecycleRail variant="default"`.
7. **`workspaceLifecycle.ts`:** add a `study-overview` top item. Discovery items become `Overview` (`''`) · `Desk research` (`/desk`) · `Stakeholders` (`/stakeholders`) · `Surveys` (`/surveys`) · `Synthesis`. Remove `filterType: null` summing for the Overview count (dot only).
8. **LifecycleRail:** active state is computed from pathname segments, not `?type`. Run routes take `activeDiscoveryType` from StudyWorkspace context, which the run page sets once its run loads. Add group `.cur`. Make the study name plain text.
9. **DiscoveryHub → DiscoveryOverview:** H1 "Discovery"; §2 becomes Evidence by type (N5); drop the `?type` branch. **New `DiscoveryTypePage`**: header + filtered ReviewQueue + ungrouped RunLedgerTable + per-type empty state.
10. **Breadcrumbs** start at the group on every study page (N4).
11. **Retire** `computeLifecycleNodes` for UI and keep only the plan-lock derivation; delete the light LifecycleRail variant once StudyOverview no longer uses it.
12. Redirect the legacy `?type=` URLs.

---

## Claude Code Handoff

**Goal:** One persistent Study Workspace shell for all `/studies/:id/*` routes. Do not restyle anything. Visual changes are limited to N1–N6.

**Order (each step leaves the app working):**

1. **NAV-1a: shell.** Add `StudyWorkspace` (layout route + context `{study, briefStatus, planLocked, discoveryCounts, activeDiscoveryType, setActiveDiscoveryType, navOpen, openNav, closeNav}`). Nest all study routes under it in `App.tsx`. Set `WORKSPACE_ROUTE_PATTERNS = ['/studies/:studyPublicId/*']`. Move the nav region and drawer out of `WorkspaceLayout` into StudyWorkspace. Remove the `nav` prop and the `LifecycleRail` render from the six pages. Wire the header menu buttons to `openNav`.
   *Accept:* every study route, including `/brief/new` and `/plan/new`, renders SideNav inverse + one LifecycleRail and no TopBar. Brief ↔ Plan ↔ Discovery navigation does not remount the rail (assert with a test on the same DOM node). The Plan lock reflects the real brief status on Discovery pages.
2. **NAV-1b: Discovery routes.** Add `discovery/desk|stakeholders|surveys` → `DiscoveryTypePage`. Redirect `?type=`. Update `workspaceLifecycle.ts` labels and paths. Make the active state path-based. The run page sets `activeDiscoveryType`.
   *Accept:* exactly one rail row is `aria-current="page"` on every route in the Route Model table (none on a run page while it loads). The DISCOVERY heading has `.cur` on every Discovery route.
3. **NAV-1c: landings.** Rename DiscoveryHub → DiscoveryOverview (H1 "Discovery", §2 Evidence by type). Rewrite StudyOverview to S02. Add the Study overview rail row, the plain-text study name, group `.cur`, and breadcrumbs (N1–N6).
   *Accept:* screens S02–S08 match. The light LifecycleRail variant has no remaining callers.
4. **NAV-1d: cleanup.** Delete the light LifecycleRail variant and the UI use of `computeLifecycleNodes`. Update tests (`AppShell.test`, `LifecycleRail.test`, `WorkspaceLayout.test`, `App.test` route list).

**Do not:** add a Discovery sub-rail or tabs row; make group headings links; show the run in the rail; change Discovery content redlines; change run URLs.

**Accessibility:** rail `nav aria-label="Study"`, org `nav aria-label="Main"`, breadcrumb `nav aria-label="Breadcrumb"`. Group `section aria-labelledby` (rows are announced as "Discovery, Overview"). Drawer behavior is unchanged (dialog, focus trap, Escape, inert).

### Open questions for architecture review
1. **Search and Work Queue inside a study.** VC-2A removed both from the workspace org rail. With every study route now in the workspace, researchers lose one-click Work Queue for the whole time they're in a study. Recommend restoring **Work Queue** (badge) in SideNav inverse. That needs a decision, because it reverses COMPONENT_DELTAS §1.
2. **Discovery is project-scoped.** Two studies in one project show the same Discovery. NAV-1 keeps it under each study and labels the scope. Confirm that product doesn't want a project-level Discovery route.
3. **Study overview "Needs you"** needs one study-level query (artifact approvals + comments + Discovery queue), or the client composes it from existing queries. Confirm which.

STUDY WORKSPACE NAVIGATION CORRECTION COMPLETE — READY FOR ARCHITECTURE REVIEW
