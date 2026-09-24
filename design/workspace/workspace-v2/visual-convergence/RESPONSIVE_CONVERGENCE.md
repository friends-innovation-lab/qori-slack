# Responsive Convergence

Canvas width = viewport − docked regions. Column = `min(736px, canvas)` centered, with the padding shown.

| Viewport | App rail | Lifecycle | Canvas (rail open / strip) | Document column | Context rail (Brief) | Header | Editor |
|---|---|---|---|---|---|---|---|
| **1440** | docked 64 | docked 224 | 808 / 1104 | 736 outer, 640 measure, pad 48, centered | docked open 344 (default when status ≠ null) | crumb · tabs · save · GitHub · rule · rail toggle · actions | floating pill, sticky top 12, centered |
| **1280** | docked 64 | docked 224 | 648 / 944 | open: 648 outer → 552 measure at pad 48. Strip: 736 / 640 | docked open 344 | same as 1440 | same |
| **1100** | docked 64 | docked 224 | 764 (strip docked) | 736 / 640, pad 48 | **closed to strip by default**; opens as fixed overlay min(344, 92vw) over canvas, no scrim, Esc closes | same | same |
| **900** | in drawer | in drawer (288 total: 64 + 224, vertical list) | 852 (strip) | 736 outer, **pad 24** → 688 measure capped at 640 | strip; overlay on open | nav toggle first; crumb hidden | same |
| **768** | in drawer | in drawer | 720 (strip) | 720 outer, pad 24 → 640 measure (content fills) | strip; overlay on open | nav toggle; crumb hidden | same |
| **390** | in drawer | in drawer (min(288, 88vw) = 288) | 390 | full width, pad 16 → 358 content | no strip; header toggle opens **full-screen sheet** (modal) | pad 12, gap 8; GitHub + rule hidden; buttons/icons 40px | full-bleed sticky bar top 0, 40px tools, hint hidden |

## Per-range document composition

| Element | ≥1181 | 981–1180 | 768–980 | ≤767 |
|---|---|---|---|---|
| Column padding (top / x / bottom) | 48 / 48 / 128 | 48 / 48 / 128 | 32 / 24 / 96 | 24 / 16 / 96 |
| Masthead title | 44/46 | 44/46 | 36/40 | 32/36 |
| Meta row | inline wrap | inline wrap | inline wrap | stacked, gap 4 |
| Section h2 / gap | 27/31, 48 | 27/31, 48 | 27/31, 48 | 24/28, 32 |
| Facts | auto-fit ≥132 | auto-fit | auto-fit | 2 equal columns, gap 16 |
| Structured rows | ID col 56 · text · tag | same | same | ID above text, gap 4 |
| Tables | full width; `.tableScroll` x-scroll on overflow | same | same | stacked label/value (`.stackedTable`), thead visually hidden |
| Provenance | hover/focus reveal | same | same | visually hidden (SR-readable) |
| Collapsibles | ruled rows | same | same | summary text wraps under title |
| Notice action | right-aligned | same | same | own line, left-aligned |

## Rules
- The 1280 rail-open case is the tightest desktop layout. The measure shrinks to 552px with 48px padding kept. Don't reduce padding at `xl`.
- The lifecycle list is vertical at every width (fix the leak, COMPONENT_DELTAS §2).
- Crossing 1180 downward closes a docked-open rail to the strip. Crossing upward docks the current mode. Crossing 980 downward closes the drawer. Crossing 767 keeps the sheet open (same mode). This is already implemented and stays as-is.
- Reduced motion: the drawer and overlay appear without transform transitions (already implemented).
