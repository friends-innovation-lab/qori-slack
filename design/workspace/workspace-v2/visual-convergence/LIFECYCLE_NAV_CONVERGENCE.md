# Lifecycle Navigation Convergence (VC-2A)

> **MATCH THE APPROVED CD COMPOSITION. DO NOT MATCH THE CURRENT PRODUCTION COMPOSITION.**
> **KEEP means visually equivalent already, not merely architecturally reusable.**

Source of truth: `workspace2-chrome.jsx` (`W2_LIFECYCLE`, `W2Nav`) and `workspace2.css` lines 35–52 in the Claude Design project "Qori".

## 1. Approved CD composition (exact)

```
┌ 224px · --color-surface-inverse-2 ───────────────┐
│ STUDY                          ← eyebrow, mono  │
│ Permit Application Status      ← display serif  │
│ Experience                                      │
│ ← All studies                  ← back link      │
├──────────────────────────────── hairline ───────┤
│ DISCOVERY                      ← group heading  │
│   Desk Research          5  ✓                   │
│   Stakeholders           2  ✓                   │
│   Surveys                                       │
│ PLANNING                                        │
│ ▌ Research Brief               ← active         │
│   Research Plan                                 │
│   Discussion Guide          🔒                  │
│ FIELDWORK                                       │
│   Outreach                     ← dim (future)   │
│   Participants                                  │
│   Sessions                                      │
│   Observers                                     │
│ ANALYSIS                                        │
│   Session Analysis                              │
│   Affinity & Themes                             │
│ OUTPUTS                                         │
│   Design Opportunities                          │
│   Readouts                                      │
│   Tickets                                       │
│ (flex spacer, min 20)                           │
└─────────────────────────────────────────────────┘
```

**Order, groups and labels (verbatim):**
- **Discovery:** Desk Research · Stakeholders · Surveys
- **Planning:** Research Brief · Research Plan · Discussion Guide
- **Fieldwork:** Outreach · Participants · Sessions · Observers
- **Analysis:** Session Analysis · Affinity & Themes
- **Outputs:** Design Opportunities · Readouts · Tickets

**Item states in CD:** `doc` (routable: Brief, Plan) · `done` (check glyph + count) · `avail` (normal, no glyph) · `locked` (lock glyph, tooltip "Unlocks after brief approval") · `future` (dimmed, tooltip "Later in the study").
**There is no Overview item** and no Sources/Evidence/Findings/Outputs stage list.

### Geometry and typography (production values; CD value → production)
| Element | CD source | Production target |
|---|---|---|
| Panel | 224px, `--sidebar-2`, `overflow-y:auto`, thin scrollbar, flex column | `.railInverse` 224px, `padding: 0` (no top/bottom padding), `display:flex; flex-direction:column` |
| Study head | padding 20/20/16, bottom rule, margin-bottom 8 | padding `var(--space-5) var(--space-5) var(--space-4)` (24/24/16; range 20–24), 1px `--color-rule-inverse`, `margin-bottom: var(--space-2)` |
| Study eyebrow "Study" | mono 8.5px, 0.2em, caps, rgba(255,255,255,.32), mb 7 | mono 11/16 600, 0.2em, caps, `--color-text-inverse-quiet`, mb 8. Text stays "Study" (org name → DDR-01 unchanged) |
| Study name | display 18.5/1.25, #EDE8DC, 500 | display 19/24 500, `--color-text-inverse` |
| Back link | 11px, rgba .4, mt 8 | UI 12/16, `--color-text-inverse-quiet`, mt 8, hover `--color-text-inverse` + underline |
| Group heading | padding 14 20 4; mono 8.5px; 0.22em; caps; rgba .3 | `div.grp` / `h2` (see a11y): padding `var(--space-3) var(--space-5) var(--space-1)` (12/24/4; range 12–14), mono 11/16 600, 0.2em, caps, `--color-text-inverse-quiet` |
| Item row | flex, gap 9, padding 7 20 7 18, 13px/1.35, #A8A295, 2px transparent left border | flex, gap 8, padding `var(--space-2) var(--space-5) var(--space-2) calc(var(--space-5) - 2px)`, UI 13/18 400, `--color-text-inverse-muted`, 2px left border. Row height 34 (range 32–34) |
| Item hover | #E8E3D6, bg rgba(255,255,255,.03) | `--color-text-inverse`, bg `--color-hover-inverse` |
| Active | #F2EDE2, brass left border, `linear-gradient(90deg, rgba(184,150,90,.15), transparent 75%)`, label 600 | `--color-text-inverse`, `border-left-color: --color-indicator-inverse`, `background: linear-gradient(90deg, var(--color-brand-tint), transparent 75%)` (tint ≈ .10 vs .15, accepted), label 600 |
| Count | mono 9.5px, 0.06em, rgba .34, right | mono 11/16 500, 0.06em, `--color-text-inverse-quiet`, after label |
| Status glyph | 11px lock / check, line-height 0, rgba .34; done #93AE89 | lucide `Lock` / `Check` 12px, `--color-text-inverse-quiet`; check uses `--color-success-inverse` **(new token, see §5)** |
| Dim (future) | rgba(255,255,255,.3), no hover, cursor default | `--color-text-inverse-quiet` (5.0:1; the CD 0.3 alpha is 2.6:1 and fails for non-control text), no hover background, `cursor: default` |
| Spacer | flex 1, min 20 | `.spacer{flex:1;min-height:var(--space-5)}` |
| Focus | — | `--focus-ring-inverse`, offset −2px, on focusable rows and the back link only |

The `.hint` line under locked items (production "Brief must be approved first") is **REMOVED** visually. The unlock condition moves to the accessible name and `title` (CD uses a tooltip, not a line).

## 2. Current production composition (dev)

`LifecycleRail variant="inverse"` renders `computeLifecycleNodes(brief_status)` as a flat, ungrouped list:

| # | Label | Route | State logic | Visual |
|---|---|---|---|---|
| 1 | Overview | `/studies/:id` | always `current` | brass icon, `aria-current="step"` |
| 2 | Brief | `/brief` | `suggested` / `free` | icon + count "1" |
| 3 | Plan | `/plan` | `locked` until brief approved, else `suggested` | lock icon + hint line |
| 4 | Sources | `/sources` (**no route**) | always `locked` | lock + hint |
| 5 | Evidence | `/evidence` (**no route**) | always `locked` | lock + hint |
| 6 | Findings | `/findings` (**no route**) | always `locked` | lock + hint |
| 7 | Outputs | `/outputs` (**no route**) | always `locked` | lock + hint |

Rows have a leading state icon (Circle/ArrowRight/Lock/AlertTriangle), no group headings, and an italic hint line under each locked row. The study head matches CD. Below 1023px the list goes horizontal (the VC-1 leak fix covers this).

**Verdict: MISMATCH.** Grouping, labels, count, ordering, leading icons, hint lines and the absence of an Overview item all differ. Only width, color and study head match.

## 3. Functional mapping (verified against `App.tsx`, `lifecycle.ts`, `api-contracts` on dev)

Implemented routes on dev are `/studies/:id` (StudyOverview), `/studies/:id/brief`, `/studies/:id/plan` (plus the `/new` forms). No other study route exists. No API contract exposes desk research, stakeholder inputs, surveys, discussion guides, outreach, sessions, observers, analysis, opportunities, readouts or tickets. (`enums.ts` has `'survey'` only as a source-type literal.)

| CD item | Production capability / route | Implemented now? | Display in UX-3A.1? | Interaction | Future owner |
|---|---|---|---|---|---|
| *(study name, head)* | StudyOverview `/studies/:id` | yes | yes | study **name** becomes a link to `/studies/:id` (replaces the "Overview" row; see Q1) | — |
| ← All studies | `/projects` or `/` | yes | yes | link (keep the current target) | — |
| Desk Research | none (Brief `vm.discoverySources` lists sources but no route) | no | yes, placeholder | non-interactive (option B); no count, no check (see Q2) | Discovery capability |
| Stakeholders | none | no | yes, placeholder | non-interactive (B) | Discovery |
| Surveys | none | no | yes, placeholder | non-interactive (B) | Discovery |
| Research Brief | `/brief` | yes | yes | NavLink; active on `/brief` | — |
| Research Plan | `/plan` | yes | yes | NavLink. When `computeLifecycleNodes` returns plan `locked` (brief not approved): lock glyph + `aria-disabled` + click prevented (**existing production rule**) | — |
| Discussion Guide | none | no | yes, placeholder | non-interactive (B). **No lock glyph**: production has no unlock rule for it | Planning / guide capability |
| Outreach | none | no | yes, placeholder | B | Fieldwork |
| Participants | none | no | yes, placeholder | B | Fieldwork |
| Sessions | none | no | yes, placeholder | B | Fieldwork |
| Observers | none | no | yes, placeholder | B | Fieldwork |
| Session Analysis | none | no | yes, placeholder | B | Analysis |
| Affinity & Themes | none | no | yes, placeholder | B | Analysis |
| Design Opportunities | none | no | yes, placeholder | B | Outputs |
| Readouts | none | no | yes, placeholder | B | Outputs |
| Tickets | none | no | yes, placeholder | B | Outputs |
| *(prod)* Overview row | StudyOverview | yes | **removed as a row** | reached via study name | — |
| *(prod)* Sources / Evidence / Findings / Outputs rows | no routes | no | **removed** | — | superseded by CD groups |

### Option chosen: **B, non-interactive lifecycle placeholder**, for all 13 unimplemented items
- **A (locked) is rejected.** A lock glyph asserts a production unlock rule ("unlocks after X") that doesn't exist. That would fabricate locking semantics. The only lock in UX-3A.1 is Research Plan, whose rule is real.
- **C (omit) is rejected.** Omitting items destroys the grouped five-phase composition that is the primary visual identity of the panel. Planning would be the only group left.
- **B keeps the full CD composition** (groups, labels, order, density) and renders every unimplemented item in the CD `future` (dim) treatment, as plain text with no link, no button and no tab stop. That claims nothing beyond "this phase exists in the research lifecycle."

## 4. Target markup (presentation config + existing component)

**Implementation reuse:** `LifecycleRail.tsx` stays the component (RECOMPOSE its inverse render). `computeLifecycleNodes` stays unchanged: StudyOverview still uses it, and the Plan lock reads it. Add **presentation-only config** `frontend/src/components/study/workspaceLifecycle.ts`:

```ts
// Presentation config for the Workspace v2 lifecycle panel. Not domain state.
export type WorkspaceNavItem =
  | { label: string; kind: 'route'; stage: 'brief' | 'plan' }   // real routes only
  | { label: string; kind: 'placeholder' };                      // non-interactive
export const WORKSPACE_LIFECYCLE: { group: string; items: WorkspaceNavItem[] }[] = [
  { group: 'Discovery', items: [{ label: 'Desk Research', kind: 'placeholder' }, { label: 'Stakeholders', kind: 'placeholder' }, { label: 'Surveys', kind: 'placeholder' }] },
  { group: 'Planning', items: [{ label: 'Research Brief', kind: 'route', stage: 'brief' }, { label: 'Research Plan', kind: 'route', stage: 'plan' }, { label: 'Discussion Guide', kind: 'placeholder' }] },
  { group: 'Fieldwork', items: [{ label: 'Outreach', kind: 'placeholder' }, { label: 'Participants', kind: 'placeholder' }, { label: 'Sessions', kind: 'placeholder' }, { label: 'Observers', kind: 'placeholder' }] },
  { group: 'Analysis', items: [{ label: 'Session Analysis', kind: 'placeholder' }, { label: 'Affinity & Themes', kind: 'placeholder' }] },
  { group: 'Outputs', items: [{ label: 'Design Opportunities', kind: 'placeholder' }, { label: 'Readouts', kind: 'placeholder' }, { label: 'Tickets', kind: 'placeholder' }] },
];
```

**Inverse render (replaces the flat list):**
```tsx
<nav className={`${styles.rail} ${styles.railInverse}`} aria-label="Study lifecycle">
  <div className={styles.studyHead}>
    <p className={styles.studyEyebrow}>Study</p>
    <Link to={`/studies/${id}`} className={styles.studyName}>{study.name}</Link>
    <a className={styles.studyBack} href={study.backTo}>← {study.backLabel}</a>
  </div>
  {WORKSPACE_LIFECYCLE.map(({ group, items }) => (
    <section key={group} aria-labelledby={`lc-${group}`}>
      <h2 id={`lc-${group}`} className={styles.grp}>{group}</h2>
      <ul className={styles.list}>
        {items.map((it) => it.kind === 'route'
          ? <li key={it.label}><NavLink to={`/studies/${id}${stageRoutes[it.stage]}`} className={({isActive}) => cx(styles.nv, isActive && styles.nvOn, planLocked(it) && styles.nvLocked)}
                aria-disabled={planLocked(it) || undefined} title={planLocked(it) ? planNode.unlock_hint ?? undefined : undefined}
                onClick={(e) => planLocked(it) && e.preventDefault()}>
                <span className={styles.t}>{it.label}</span>{planLocked(it) && <Lock size={12} className={styles.st} aria-hidden="true" />}
                {planLocked(it) && <span className="srOnly">, locked: {planNode.unlock_hint}</span>}
              </NavLink></li>
          : <li key={it.label} className={cx(styles.nv, styles.nvDim)}>
              <span className={styles.t}>{it.label}</span><span className="srOnly">, not yet available</span>
            </li>)}
      </ul>
    </section>
  ))}
  <div className={styles.spacer} aria-hidden="true" />
</nav>
```
`planNode` = the `plan` entry of `computeLifecycleNodes(briefStatus)`, and `planLocked(it)` = `it.stage === 'plan' && planNode.state === 'locked'`. That's the same rule as today.

**A11y:**
- Group headings are `h2` inside the `nav`, so screen-reader users can jump between phases. (The page `h1` is the masthead; these are landmark-scoped.)
- The active route keeps `aria-current="page"`.
- `aria-current="step"` is dropped: there's no longer an Overview/`is_current` row, and CD shows no current-stage marker beyond the active route.
- Placeholders are not focusable.
- The tab order through the panel is: study name, back link, Research Brief, Research Plan.

## 5. Tokens
Add one global-name token (block 1, globally safe):
- `--color-success-inverse: #93AE89;` (7.0:1 on `--color-surface-inverse-2`), used only for a future `done` check.

Nothing renders `done` in UX-3A.1 (Q2), so the token may be deferred to that phase.

## 6. Acceptance (screenshot-level)
At 1440, place production Brief next to `workspace2-states/01` and check that the lifecycle panel shows:
1. The study head.
2. Exactly five mono-caps group headings in CD order.
3. Exactly 15 items with CD labels in CD order.
4. Research Brief active, with the brass rule and gradient.
5. Research Plan normal, or locked with a lock glyph when the brief isn't approved.
6. 13 dimmed placeholders.
7. No Overview, Sources, Evidence, Findings or Outputs rows.
8. No leading state icons and no hint lines.
9. The panel reads as the same composition before any document detail is evaluated.
