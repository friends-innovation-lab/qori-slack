# Workspace v2: Responsive Specification

Applies to workspace routes only (`/studies/:id/brief`, `/studies/:id/plan`). Non-workspace routes keep the production 767/1023 breakpoints until they migrate.

**Media queries (exact):**
- `xl` = default (no query), ≥1181px
- `lg` = `@media (max-width: 1180px)`
- `md` = `@media (max-width: 980px)`
- `sm` = `@media (max-width: 767px)`

Rules cascade downward: anything set at `lg` still applies at `md` and `sm` unless overridden.

## 1. ≥1181px: full desktop

| Region | Behavior |
|---|---|
| App rail (SideNav inverse) | Docked 64px |
| Lifecycle panel | Docked 224px |
| Document column | `max-width: 640px + 2×48px = 736px`, centered in the canvas. Padding 48 / 48 / 128 (top / x / bottom) |
| Context rail | Brief: docked 344px, open on Review by default when `brief_status` ≠ null. Collapsed → 48px strip. Plan: none |
| Header | 52px. Crumb (≤220px) · tabs · grow · save · GitHub · rule · rail toggle · actions |
| Toolbar | Floating pill, sticky `top:12px` in canvas |
| Masthead | h1 44/46 |
| Section h2 | 27/31, section gap 48 |
| Tables | Full width; `.tableScroll` scrolls horizontally only if content overflows |
| Structured rows | ID column 56px \| text \| tag |

Minimum canvas width at 1181 with the rail open: 1181 − 64 − 224 − 344 = 549px, so the document content is 453px. That's accepted, matching the prototype.

## 2. 981–1180px: context rail becomes an overlay

| Region | Behavior |
|---|---|
| App rail, lifecycle | Docked (unchanged) |
| Document column | Same as xl (48 / 48 / 128) |
| Context rail | Closed by default (strip docked 48px). Opening renders it `position:fixed; top:0; right:0; bottom:0; width:min(344px,92vw)`, `--elevation-overlay-end`, `--z-rail-overlay`, over the canvas. Non-modal, no scrim. Escape or close returns focus to the opener |
| Header | Unchanged |
| Toolbar | Unchanged |
| Masthead / sections | Unchanged |
| Tables | Horizontal scroll inside `.tableScroll` when needed |
| Structured rows | Unchanged |

## 3. 768–980px: lifecycle navigation becomes a drawer

| Region | Behavior |
|---|---|
| App rail + lifecycle | Both leave the layout. A single drawer `#workspace-nav` (`width:min(288px,88vw)`) holds the 64px app rail and 224px lifecycle panel side by side. It slides in from the left over `--motion-base` (instant with reduced motion), with `--elevation-overlay-start` and a `--color-scrim` scrim at `--z-drawer-scrim`. It's a modal dialog: focus moves to the first lifecycle link, focus is trapped, and Escape, scrim click or any link click closes it. Focus returns to the header nav toggle |
| Header | Nav toggle (lucide `Menu` 20, 32px) appears first. The crumb is hidden (the study name is in the drawer). The rest is unchanged |
| Document column | Padding 32 / 24 / 96 |
| Context rail | Overlay as in §2; strip stays docked |
| Toolbar | Unchanged pill; if wider than the column it wraps to `max-width:100%` with horizontal scroll |
| Masthead | h1 36/40 |
| Section h2 | 27/31 |
| Tables | Horizontal scroll inside `.tableScroll` |
| Structured rows | Unchanged |

## 4. ≤767px: narrow / mobile

| Region | Behavior |
|---|---|
| App rail + lifecycle | Drawer as in §3 |
| Header | 52px, `padding: 0 12px`, `gap: 8px`. Order: nav toggle · ArtifactTabs · grow · save state (dot and label; the label truncates with ellipsis at 96px) · rail toggle · actions. GitHub link and rule are hidden (GitHub remains in Document information). Buttons and icon buttons are 40px tall |
| Document column | Padding 24 / 16 / 96 |
| Context rail | Full-screen sheet (`inset:0`, `--z-drawer`, modal dialog, focus trap). No strip. Opened only from the header toggle. The close button in the tab row returns focus to the toggle |
| Toolbar | Full-bleed bar: `position:sticky; top:0`, square corners, no side borders, `overflow-x:auto`, hint hidden, 40px tools |
| Masthead | h1 32/36; meta `<dl>` stacks one item per line with 4px gap |
| Section h2 | 24/28, section gap 32 |
| Provenance labels | Visually hidden (SR-readable); lock glyph and inherited source line still visible |
| Facts | 2 equal columns, gap 16 |
| Tables | `stackOnNarrow` (default): each row becomes a block with a bottom hairline; each cell is a 2-column grid (label from `data-label` in mono caps, then value). `thead` is visually hidden. Tables with `stackOnNarrow={false}` scroll horizontally |
| Structured rows | ID above text (column, gap 4). Tag inline after text |
| Alerts (rule) | Wrap. The action button drops to its own line, left-aligned |
| Collapsibles | Summary text wraps under the title |

## 5. Transitions between ranges

- Crossing 1180 while the rail is open as an overlay: at ≥1181 it docks (same `activeMode`). Crossing below 1181 while docked-open: the rail closes to the strip. It doesn't auto-convert into an overlay covering the document.
- Crossing 980 while the drawer is open: at ≥981 the drawer state resets to closed and the panels dock.
- Crossing 767 while the sheet is open: the sheet stays open as an overlay (same `activeMode`).
- Implement with a single `useMediaQuery` per boundary in `WorkspaceLayout` and `ContextRail`. Never read `window.innerWidth` during render.
