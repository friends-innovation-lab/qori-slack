# Geometry

Values come from the approved reference (`workspace2.css`), snapped to the production space scale where the difference is under 4px. Ranges are optical tolerances for QA: implement the **first** value, accept anything inside the range.

## 1. Shell
| Element | Value | Range | Token |
|---|---|---|---|
| App rail (SideNav inverse) | 64px | exact | `--layout-app-rail` |
| App rail tile | 40×40, radius 10 | 38–40, r 9–10 | `--radius-xl` |
| App rail active marker | 2px, 12px outside tile, inset 8 top/bottom | 12–13 / 8–9 | — |
| Lifecycle panel | 224px | exact | `--layout-lifecycle` |
| Lifecycle panel padding | 0 (no top/bottom padding; flex column + bottom spacer min 24) | — | — |
| Lifecycle study head padding | 24 / 24 / 16 (top / x / bottom), margin-bottom 8 | 20–24 / 20–24 / 16 | — |
| Lifecycle group heading | padding 12 / 24 / 4 (top / x / bottom) | top 12–14 | — |
| Lifecycle row | height 34, padding 8 24 8 22, gap 8, 2px left rule, no leading icon | height 32–34 | — |
| Lifecycle total (15 items + 5 groups + head) | ≈ 800px; panel scrolls when viewport height < content | — | — |
| App rail items | 4 top (Home, Projects, Studies, Ask Qori) · spacer · Admin · avatar 32 | avatar 30–32 | — |
| Nav drawer (≤980) | min(288px, 88vw) | exact | `--layout-nav-drawer` |
| Artifact header | 52px, x-pad 24 (≤767: 12), gap 12 (≤767: 8) | x 20–24, gap 12–14 | `--layout-artifact-header` |
| Context rail (open) | 344px | exact | `--layout-context-rail` |
| Context rail strip | 48px | 46–48 | `--layout-context-strip` |
| Rail tab row | 48px | 46–48 | `--layout-rail-tabs` |
| Rail body padding | 24 / 24 / 48 | 20–24 / 20–24 / 48 | — |

## 2. Document column
| Property | Value | Range |
|---|---|---|
| Content measure | 640px | 636–640 |
| Horizontal padding ≥981 | 48px | 44–48 |
| Horizontal padding 768–980 | 24px | exact |
| Horizontal padding ≤767 | 16px | exact |
| Top padding ≥981 | 48px | 48–56 |
| Top padding ≤980 | 32px (≤767: 24) | — |
| Bottom padding | 128px (≤980: 96) | 128–140 |
| Outer max-width | `calc(640px + 2 × 48px)` = 736px | 724–736 |
| Centering | `margin: 0 auto` inside `.canvas` | ±1px |
| Prose measure | 66ch (≈ 600–620px at 16px Source Serif) | 64–68ch |

At 1440 with the rail open: canvas = 1440 − 64 − 224 − 344 = **808px**, so the column is 736 with 36px of paper each side. With the rail closed (strip): canvas = 1104, so 184px each side.

## 3. Vertical rhythm (px)
| From → to | Value | Range |
|---|---|---|
| Canvas top → notice / eyebrow | 48 | 48–56 |
| Notice → eyebrow | 32 | 32–34 |
| Notice internal padding | 12 / 0 | 10–12 |
| Eyebrow → title | 12 | 12–14 |
| Title → meta row | 16 | exact |
| Meta row padding (vertical) | 12 | 12–13 |
| Meta row → first section / facts | 24 (facts) · 48 (section) | — |
| Facts padding (vertical) | 24 | 20–24 |
| Facts row gap / column gap | 16 / 32 | 16–18 / 28–32 |
| Section → section | 48 (≤767: 32) | 48–52 |
| Section head row → content | 16 | 14–16 |
| Paragraph → paragraph | 16 | exact |
| h3 subheading: above / below | 24 / 12 | — |
| List item gap | 8 | exact |
| Structured row padding | 12 / 2 | 12–13 |
| Table header bottom padding | 8 | — |
| Table cell vertical padding | 12 | 12–13 |
| Block (rows/table) → next block | 16 | — |
| Content → first collapsible | 48 | exact |
| Collapsible summary padding | 16 / 2 | 14–16 |
| Collapsible inner bottom | 24 | 20–24 |
| Source note / inherited line → content | 16 (sits 8 below head row) | — |

## 4. Horizontal gaps
| Element | Value |
|---|---|
| Masthead meta items | row 4 · column 24 (range 24–26) |
| Meta key → value | 8 (range 7–8) |
| Section head row | gap 12 (h2 · lock · provenance; provenance `margin-left:auto`) |
| Structured row | ID col 56 · gap 16 |
| Collapsible summary | gap 12 |
| Header items | gap 12 |
| Review action row | gap 8 |

## 5. Rules, radius, weight
| Item | Value |
|---|---|
| Hairline | 1px `--color-border` #E8E3D8 |
| Emphasis rule | 1px `--color-border-emphasis` #D7D1C2 (table header, collapsible group top, secondary button) |
| Indicator | 2px (`--color-indicator` on light, `--color-indicator-inverse` on dark) |
| Quote / feedback rule | 2px |
| Editor focus rule | 2px `--color-brand` |
| Radius: ID chip | 3 |
| Radius: tags, tools, inputs | 4 |
| Radius: buttons, icon buttons | 6 |
| Radius: popovers | 8 |
| Radius: toolbar, app-rail tiles | 10 |
| Radius: document surfaces (facts, collapsibles, sections, tables) | **0**. No rounded containers in the document |

## 6. Breakpoints (workspace routes only)
`xl` ≥1181 · `lg` 981–1180 (`max-width:1180px`) · `md` 768–980 (`max-width:980px`) · `sm` ≤767 (`max-width:767px`).
Legacy `1023`/`1240` breakpoints must not affect any workspace element (fixes lifecycle leak; `.reviewRail` 1240 block is removed with the dead classes).
