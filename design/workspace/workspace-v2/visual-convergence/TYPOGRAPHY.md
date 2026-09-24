# Typography: exact role mapping

All workspace document roles **must** set `font-family` explicitly. No role may rely on inheritance from `body` (which is `--font-ui`). That inheritance is why the production document currently reads as sans.

The legacy `--text-h1/h2/h3-*` tokens are **forbidden** in `document.module.css`, `ReviewRail.module.css`, `ContextRail.module.css`, `ArtifactHeader.module.css`, `LifecycleRail.module.css` (inverse) and `editor.module.css`. VC-2 adds a test for this (IMPLEMENTATION_PHASES).

Families (workspace scope):
- **UI sans:** `--font-ui` Instrument Sans
- **Document serif:** `--font-serif` Source Serif 4
- **Display/title serif:** `--font-display` Cormorant Garamond
- **Mono/ID:** `--font-mono` JetBrains Mono

| Role | Class(es) | Family | Size / line | Weight | Track | Case | Color |
|---|---|---|---|---|---|---|---|
| Masthead eyebrow | `.mastEyebrow` | mono | 11 / 16 | 600 | 0.2em | upper | `--color-brand-deep` |
| H1 (masthead title) | `.mastName` (in `.mastTitle`) | display | 44 / 46 · md 36/40 · sm 32/36 | 500 | −0.015em | none | `--color-text` |
| Metadata key | `.mastheadKey`, `.factKey`, `.periodLabel` | mono | 11 / 16 | 600 | 0.14em | upper | `--color-text-muted` |
| Metadata value | `.mastheadValue` | UI | 13 / 20 | 400 | 0 | none | `--color-text-muted` |
| Fact value | `.factValue`, `.periodValue` | serif | 15.5 / 20 (period 15/24) | 600 | 0 | none | `--color-text` |
| Fact sub / caption | `.factSub`, `.periodDuration`, `.secSource` | UI | 12 / 16 | 400 | 0 | none | `--color-text-muted` |
| H2 (section) | `.secHeading` | display | 27 / 31 · sm 24/28 | 500 | −0.005em | none | `--color-text` |
| H3 (subsection) | `.secSubheading`, `.blockProse h3` | mono | 11 / 16 | 600 | 0.16em | upper | `--color-text-muted` |
| Markdown H2 inside section | `.blockProse h2` | UI | 13 / 20 | 600 | 0 | none | `--color-text` |
| Body | `.blockProse`, `.block`, `.kvParagraph` | serif | 16 / 28 | 400 (b 600) | 0 | none | `--color-text` |
| List item | `.blockProse li` | serif | 15.5 / 26 | 400 | 0 | none | text; marker `--color-text-quiet` |
| kv key | `.kvParagraph b` | UI | 13 / 20 | 600 | 0 | none | `--color-text-meta` |
| Structured ID | `.idTag` | mono | 11 / 24 | 600 | 0.05em | none | `--color-brand-deep` |
| Structured text | `.itemText` | serif | 15 / 24 | 400 | 0 | none | `--color-text` |
| Item source | `.itemSource` | serif italic | 13.5 / 24 | 400 | 0 | none | `--color-text-muted` |
| Priority tag | `.priorityBadge` | mono | 11 / 16 | 600 | 0.14em | upper | Primary `--color-brand-deep`, else muted |
| Table header | `.docTable th` | mono | 11 / 16 | 600 | 0.14em | upper | `--color-text-muted` |
| Table cell | `.docTable td` | serif | 14 / 22 | 400 (b/emphasis 600 `--color-text`) | 0 | none | `--color-text-meta` |
| Table cell (centered/numeric) | `.cellCenter` | UI | 13 / 22 | 400 | 0 | none | `--color-text-meta` |
| Caption / footnote | `.docFootnote`, `.approvalNote`, `.collapsibleInner p` | serif | 13.5 / 22 | 400 | 0 | none | `--color-text-muted` |
| Provenance | `.provTag` | mono | 11 / 16 | 600 | 0.14em | upper | `--color-text-muted` |
| Collapsible title | `.collapsibleTitle` | UI | 13 / 20 | 600 | 0 | none | `--color-text-meta` (hover text) |
| Collapsible summary | `.collapsibleSummary` | UI | 12 / 16 | 400 | 0 | none | `--color-text-muted` |
| Notice | `.notice` (Alert rule) | UI | 13 / 20 | 400 (b 600) | 0 | none | muted; b per tone |
| Approval checklist item | `.approvalChecklistItem` | serif | 14 / 22 | 400 | 0 | none | `--color-text` |
| Header tab | `.artifactTab` | UI | 13 / 20 | 400 (active 600) | 0 | none | muted (active text) |
| Crumb / GitHub / save | `.crumb a`, `.githubLink`, `.saveState` | UI | 12 / 16 | 400 | 0 | none | `--color-text-muted` |
| Buttons | `Button` | UI | 13 / 16 | 600 | 0 | none | per variant |
| Rail tab | `.railTab` | UI | 13 / 20 | 400 (active 600) | 0 | none | muted (active text) |
| Rail eyebrow | `.reviewEyebrow` | mono | 11 / 16 | 600 | 0.14em | upper | `--color-text-muted` |
| Rail status | `.reviewStatus` | display | 21 / 25 | 500 | 0 | none | per state |
| Rail copy | `.reviewBody`, `.reviewFeedback` | serif | 13.5 / 22 | 400 (quote italic) | 0 | none | `--color-text-meta` |
| Rail control label | `.checklistItem` | UI | 13 / 20 | 400 | 0 | none | `--color-text` |
| Rail hint | `.reviewHint` | UI | 12 / 18 | 400 | 0 | none | `--color-text-muted` |
| Lifecycle study name | `.studyName` | display | 19 / 24 | 500 | 0 | none | `--color-text-inverse` |
| Lifecycle row | `.railInverse .node` | UI | 13 / 18 | 400 (active 600) | 0 | none | inverse-muted (active inverse) |
| Lifecycle eyebrow / count | `.studyEyebrow`, `.count` | mono | 11 / 16 | 600 / 500 | 0.2em / 0.06em | upper / none | `--color-text-inverse-quiet` |

**Size floor:** nothing below 11px. The prototype's 8.5 and 9.5px mono caps are rendered at 11px. That's an intentional deviation, locked in TOKENS.md §1.6.

**Acceptance check (computed styles, Brief at 1440):**
- `h1 .mastName` → Cormorant Garamond, 44px, 500
- `section h2` → Cormorant Garamond, 27px, 500
- `.blockProse p` → Source Serif 4, 16px / 28px
- `.docTable td` → Source Serif 4, 14px
- `.idTag` → JetBrains Mono, 11px, rgb(124, 97, 48)
- `.provTag` → JetBrains Mono, 11px, opacity 0 at rest
