# Qori Workspace Design System v1 — Tokens & Typography

**Status:** design handover for UX-3A · **Target files:** `frontend/src/styles/tokens.css`, `typography.css`, `reset.css`, `frontend/index.html`
**Drop-in source:** `reference/tokens.reference.css` is a **delta** that gets appended to production `tokens.css`. It is not a replacement. This document explains it; the CSS file wins if the two ever disagree.

> **DDR-04 — DECIDED: B, workspace-scoped first (2026-09-23).** Workspace v2 values apply only under `:root[data-qori-surface="workspace"]`. Home, Projects, forms and every page not yet migrated keep their current visual language. Promoting to app-wide is a separate, future decision outside UX-3A.

## 1. Migration rules

1. **No token is renamed, deleted or re-valued at `:root`.** Every existing production declaration stays byte-identical. Workspace v2 values for existing names live only in the workspace scope block.
2. **Eight undefined tokens become defined (PF-02):** `--font-serif`, `--font-sans`, `--color-text-secondary`, `--color-bg`, `--color-success-ink`, `--color-success-dark`, `--color-info-ink`, `--color-border-secondary`. At `:root` each one resolves to the value that renders today (the fallback literal `document.module.css` already passes), so nothing visibly changes. In the workspace scope they take v2 values. The `var(--x, fallback)` literals in `document.module.css` are removed in CC-2.
3. **`brief-document.css` local tokens are retired.** That file's `--ink`, `--ink-2…5`, `--border`, `--bg-*`, `--link`, `--gold`, `--success*`, `--error*`, `--info*`, `--warn*`, `--font`, `--serif` and `--mono` are scoped to `.brief-doc` and conflict with the system. The whole file is deleted at the end of CC-5. No new file may define local color tokens.
4. **Scope is workspace-only (DDR-04 = B).** The scope hook is the `data-qori-surface="workspace"` attribute on `<html>`:
   - **Setter:** AppShell sets it in a layout effect while the current route matches `WORKSPACE_ROUTE_PATTERNS` and removes it on unmount/route change (CC-3). It goes on `<html>`, not a wrapper, so portals, `body` background and the skip link inherit it.
   - **CC-1 visible change: none.** CC-1 adds tokens and fonts only; the attribute doesn't exist yet. Brief and Plan switch to v2 values when their patterns are added (CC-4, CC-5).
   - **Non-workspace surfaces** (Home, Projects, forms, StudyOverview, Login) must render pixel-identical to pre-CC-1 through all of UX-3A.
   - New token *names* (block 1) are global because no existing surface reads them.
5. **Spacing stays on the 4/8/12/16/24/32/48/64 scale.** Prototype in-between values are snapped: 13→12, 14→12/16, 15→16, 22→24, 26→24, 44→48, 52→48, 56→48. The one exception is `--space-hair: 2px`, used only for optical offsets. Layout dimensions (`--layout-*`) are named tokens and don't have to sit on the scale.
6. **Production minimums override prototype sizes.** Production `design-system.md` says no text below 12px and no mono metadata below 11px. The prototype's 8.5px and 9.5px mono caps are raised to **11px**, with tracking reduced to 0.14–0.2em to keep the same texture.

## 2. Token inventory

### Kept unchanged everywhere
`--space-1…8`, the legacy `--text-*` scale, `--border-width*`, `--layout-content-max`, `--layout-sidenav`, `--layout-sidenav-collapsed`, `--layout-topbar`, `--layout-drawer`, `--layout-trace-panel`, grid/gutter/page-pad tokens, `--motion-fast/base/slow/ease`, `--radius-sm`, `--radius-full`, `--color-surface`, `--focus-offset`, and the state/AI/dependency grammar names.

### Workspace-scoped overrides (same name; `:root` value unchanged)
| Token | `:root` (unchanged) | Workspace scope | Why |
|---|---|---|---|
| `--font-ui` | Public Sans | Instrument Sans stack | v2 UI face |
| `--font-display` | Public Sans | Cormorant Garamond stack | v2 masthead/section display |
| `--font-mono` | system mono | JetBrains Mono stack | v2 IDs/labels |
| `--color-paper` | #FAF9F7 | #FAFAF7 | v2 paper |
| `--color-surface-muted` | #F3F1ED | #F4F1EA | paper subtle |
| `--color-surface-hover` | #F6F4F0 | #F4F1EA | one hover tone |
| `--color-surface-selected` | #FBF4DC | rgba(184,150,90,.10) | brass tint |
| `--color-text` | #1A1915 | #1C1B19 | ink |
| `--color-text-meta` | #44423C | #3A3733 | ink-2 |
| `--color-text-muted` | #5C594F | #6B6460 | ink-3 (5.6:1) |
| `--color-text-on-brand` | #1A1915 | #161410 | |
| `--color-border` | #E5E2DA | #E8E3D8 | hairline |
| `--color-border-emphasis` | #C9C5BA | #D7D1C2 | hairline-2 |
| `--color-brand` | #FFD43B | #B8965A | brass (themable) |
| `--color-brand-ink` | #1A1915 | #161410 | |
| `--color-link` | #3D5A99 | #8A6B32 | brass text (themable) |
| `--color-focus` | #3D5A99 | #7C6130 | brass deep (themable) |
| `--color-success(-surface)` | #2E7D4F / #E8F3EC | #3F6B3A / #EDF2E9 | |
| `--color-warning(-surface)` | #9A6A00 / #FBF1DC | #8A6B32 / #EFE6CE | v2 uses brass for pending |
| `--color-error(-surface)` | #B3372B / #FBE9E6 | #9C2A1F / #F7ECEA | "critical" |
| `--color-info(-surface)` | #2F6C8F / #E7F1F6 | #2A4A6B / #EBF0F4 | |
| `--radius-md` | 8px | 6px | v2 buttons/controls |
| `--radius-lg` | 12px | 8px | v2 overlays |
| `--elevation-sm/md/lg` | cool | warm ink values | |
| reduced-motion overrides | 0/100/100 | 0/0/0 (scoped) | drawers must not slide |

> Warning and brand now share a hue. Pending/warning state must always carry text ("Awaiting approval") or an icon, never color alone. Production's rule "color never alone" already requires this.

### New (block 1, global names)
Type roles (`--type-*`, `--weight-*`), `--font-serif`, `--radius-xs`, `--radius-xl`, `--elevation-overlay-start/end`, `--color-scrim`, workspace layout (`--layout-app-rail`, `--layout-lifecycle`, `--layout-nav-drawer`, `--layout-artifact-header`, `--layout-context-rail`, `--layout-context-strip`, `--layout-rail-tabs`, `--layout-doc-measure`, `--layout-prose-measure`, `--layout-id-col`, `--layout-toolbar-h`), z-index layers (`--z-*`), inverse surfaces and text, `--color-text-quiet/disabled/strong`, `--color-border-control`, brand family (`-text`, `-deep`, `-tint`, `-wash`, `-soft`), `--color-indicator(-inverse)`, `--color-link-hover`, `--color-focus-inverse`, `--focus-ring-inverse`.

### Aliases
`--font-sans → --font-ui` · `--color-bg → --color-paper` · `--color-text-secondary → --color-text-meta` · `--color-border-secondary → --color-border-emphasis` · `--color-success-ink`, `--color-success-dark → --color-success` · `--color-info-ink → --color-info` · `--layout-app-rail → --layout-sidenav-collapsed` · `--color-indicator → --color-brand-deep` · `--color-indicator-inverse → --color-brand`.

## 3. Contrast (computed, WCAG 2.2)

| Pair | Ratio | Allowed use |
|---|---|---|
| text #1C1B19 / paper | 16.5 | all text |
| text-meta #3A3733 / paper | 11.4 | all text |
| text-muted #6B6460 / paper | 5.6 | all text incl. 11px mono labels |
| text-muted / surface-muted #F4F1EA | 5.0 | all text |
| text-quiet #9A9288 / paper | 2.9 | **non-text only**: list markers, chevrons with adjacent text, disabled |
| brand-text #8A6B32 / paper | 4.8 | links, text |
| brand-deep #7C6130 / paper | 5.5 | IDs, eyebrows, focus ring, active indicators |
| brand #B8965A / paper | 2.7 | **never on light surfaces** as text or as the sole indicator |
| brand #B8965A / inverse-2 | 6.2 | active markers on dark |
| success / error / info on paper | 5.9 / 7.4 / 8.7 | text |
| inverse text #F2EDE2 / #1C1B19 | 15.0 | |
| inverse-muted #A8A295 / #1C1B19 | 6.8 | nav item labels |
| inverse-quiet #8F8A80 / #1C1B19 | 5.0 | group labels, counts, back link |
| inverse-quiet / #0D0D0C | 5.7 | rail icons at rest |
| border-control #8F887E / paper | 3.3 | form control boundary (1.4.11) |

Prototype fixes applied: dark-nav group labels at `rgba(255,255,255,.3)` (≈2.6:1) become `--color-text-inverse-quiet`. The active tab underline on light surfaces uses `--color-indicator` (brand-deep), not brass. Weight 600 on the active item is still required, so state is never carried by color alone.

## 4. Fonts

Add this second `<link>` to `frontend/index.html`. Keep the existing Public Sans link:

```html
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@500;600&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap" rel="stylesheet" />
```

Weights loaded: Instrument Sans 400/500/600 · Source Serif 4 400/600 + italic 400 · Cormorant Garamond 500 · JetBrains Mono 500/600. **Weight 700 is not loaded.** Any `font-weight: 700` in workspace CSS maps to 600. Non-workspace headings stay in Public Sans (still loaded), so no synthetic bold appears. **Keep the existing Public Sans `<link>`** and add the new families in a second `<link>`.

`DESIGN DECISION REQUIRED — DDR-07`: Google Fonts vs self-hosted (`/public/fonts`, `@font-face` in `typography.css`). Federal deployments often forbid third-party font CDNs. The stacks above fall back cleanly either way.

## 5. Typography roles

All sizes in px. "Track" = `letter-spacing`. "Case" = `text-transform`.

| Role | Family | Size / line | Weight | Track | Case | Color token |
|---|---|---|---|---|---|---|
| Application UI (default) | `--font-ui` | 13 / 20 | 400 | 0 | none | `--color-text` |
| Navigation item (dark) | `--font-ui` | 13 / 18 | 400 (active 600) | 0 | none | `--color-text-inverse-muted` (active `--color-text-inverse`) |
| Nav group label (dark) | `--font-mono` | 11 / 16 | 600 | 0.2em | uppercase | `--color-text-inverse-quiet` |
| Nav count (dark) | `--font-mono` | 11 / 16 | 500 | 0.06em | none | `--color-text-inverse-quiet` |
| Lifecycle study name | `--font-display` | 19 / 24 | 500 | 0 | none | `--color-text-inverse` |
| Artifact header tab | `--font-ui` | 13 / 20 | 400 (active 600) | 0 | none | `--color-text-muted` (active `--color-text`) |
| Breadcrumb (header) | `--font-ui` | 12 / 16 | 400 | 0 | none | `--color-text-muted` |
| Button | `--font-ui` | 13 / 16 | 600 | 0 | none | per variant |
| Eyebrow (masthead) | `--font-mono` | 11 / 16 | 600 | 0.2em | uppercase | `--color-brand-deep` |
| Document H1 (masthead) | `--font-display` | 44 / 46 (md 36/40, sm 32/36) | 500 | −0.015em | none | `--color-text` |
| Document H2 (section) | `--font-display` | 27 / 31 (sm 24/28) | 500 | −0.005em | none | `--color-text` |
| Document H3 (subsection) | `--font-mono` | 11 / 16 | 600 | 0.16em | uppercase | `--color-text-muted` |
| Document body | `--font-serif` | 16 / 28 | 400 (b 600) | 0 | none | `--color-text` |
| Document list item | `--font-serif` | 15.5 / 26 | 400 | 0 | none | `--color-text`; marker `--color-text-quiet` |
| Inline key in kv paragraph | `--font-ui` | 13 / 20 | 600 | 0 | none | `--color-text-meta` |
| Metadata key (masthead, facts) | `--font-mono` | 11 / 16 | 600 | 0.14em | uppercase | `--color-text-muted` |
| Metadata value (masthead) | `--font-ui` | 13 / 20 | 400 | 0 | none | `--color-text-muted` |
| Fact value | `--font-serif` | 15.5 / 20 | 600 | 0 | none | `--color-text` |
| Fact sub | `--font-ui` | 12 / 16 | 400 | 0 | none | `--color-text-muted` |
| Field label | `--font-ui` | 13 / 20 | 600 | 0 | none | `--color-text-meta` |
| Structured ID | `--font-mono` | 11 / 24 (row baseline) | 600 | 0.05em | none | `--color-brand-deep` |
| Structured row text | `--font-serif` | 15 / 24 | 400 | 0 | none | `--color-text`; source `em` 13.5 `--color-text-muted` |
| Priority tag | `--font-mono` | 11 / 16 | 600 | 0.14em | uppercase | Primary `--color-brand-deep`, else `--color-text-muted` |
| Provenance label | `--font-mono` | 11 / 16 | 600 | 0.14em | uppercase | `--color-text-muted` |
| Table header | `--font-mono` | 11 / 16 | 600 | 0.14em | uppercase | `--color-text-muted` |
| Table cell | `--font-serif` | 14 / 22 | 400 (b 600 `--color-text`) | 0 | none | `--color-text-meta` |
| Table cell, numeric/centered | `--font-ui` | 13 / 22 | 400 | 0 | none | `--color-text-meta` |
| Collapsible summary title | `--font-ui` | 13 / 20 | 600 | 0 | none | `--color-text-meta` (hover `--color-text`) |
| Collapsible summary meta | `--font-ui` | 12 / 16 | 400 | 0 | none | `--color-text-muted` |
| System note (inside collapsible) | `--font-serif` | 13.5 / 22 | 400 | 0 | none | `--color-text-muted` |
| Document notice | `--font-ui` | 13 / 20 | 400 (b 600) | 0 | none | `--color-text-muted`; b per tone |
| Save state | `--font-ui` | 12 / 16 | 400 | 0 | none | `--color-text-muted` |
| Rail tab | `--font-ui` | 13 / 20 | 400 (active 600) | 0 | none | `--color-text-muted` (active `--color-text`) |
| Rail status (Review) | `--font-display` | 21 / 25 | 500 | 0 | none | per state |
| Rail body | `--font-serif` | 13.5 / 22 | 400 | 0 | none | `--color-text-meta` |
| Rail note / hint | `--font-ui` | 12 / 18 | 400 | 0 | none | `--color-text-muted` |
| Toolbar tool | `--font-ui` | 13 / 16 | 400 (active 600) | 0 | none | `--color-text-meta` (active `--color-brand-deep`) |
| Toolbar hint | `--font-ui` | 12 / 16 | 400 | 0 | none | `--color-text-muted` |
| Citation superscript | `--font-mono` | 11 / 0 | 600 | 0 | none | `--color-brand-deep` |

Headings `h1–h4` in `typography.css` keep their current global rules for non-workspace pages. Workspace heading styles come from the component classes (`.mastTitle`, `.secHeading`, `.secSubheading`) and must set `margin: 0` explicitly so they don't inherit the global `margin-bottom`.

## 6. Radii, borders, elevation, focus, motion

| Use | Token |
|---|---|
| ID / citation hover chip | `--radius-xs` 3 |
| Tags, inputs, tool buttons | `--radius-sm` 4 |
| Buttons, icon buttons, nav icons | `--radius-md` 6 |
| Popovers, rail overlay corners (none when full-height), dialogs | `--radius-lg` 8 |
| Floating editor toolbar, app-rail icon tiles | `--radius-xl` 10 |
| Separators | 1px `--color-border` |
| Table header rule, secondary button, collapsible group top | 1px `--color-border-emphasis` |
| Form control boundary | 1px `--color-border-control` |
| Active left marker (nav) | 2px `--color-indicator-inverse` |
| Active tab underline | 2px `--color-indicator` |
| Editor focused section | 2px left `--color-brand` + `--color-brand-wash` fill (rule is decorative; focus ring carries focus) |
| Editor toolbar | `--elevation-md` |
| Trace/tooltip popover (dark) | `--elevation-lg` |
| Context rail overlay | `--elevation-overlay-end` |
| Nav drawer | `--elevation-overlay-start` + `--color-scrim` |
| Focus (light) | `outline: var(--focus-ring); outline-offset: var(--focus-offset)` |
| Focus (dark nav) | `outline: var(--focus-ring-inverse)` |
| Hover/state change | `--motion-fast` `--motion-ease` |
| Drawer / overlay enter | `transform` over `--motion-base` |
| Full-screen sheet | `--motion-slow` |

Motion is limited to opacity, transform and background-color. Nothing animates layout properties. With reduced motion, every duration is 0.
