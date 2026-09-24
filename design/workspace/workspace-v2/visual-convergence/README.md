# UX-3A.1: Workspace Visual Convergence

The approved Workspace v2 screenshots and reference are the **visual** source of truth. Production (`qori-slack@dev`) is the **functional** source of truth. This package tells Claude Code exactly how to make production Brief and Plan look like the approved design, without touching data, contracts, the editor schema, save or approval.

| File | Contents |
|---|---|
| `VISUAL_CONVERGENCE_SPEC.md` | Diagnosis, top-10 mismatches, area audit A–U, Brief/Plan rule, protected architecture |
| `COMPONENT_DELTAS.md` | KEEP/RESTYLE/REPOSITION/RECOMPOSE/REPLACE/REMOVE matrix, per-file deltas, Review rail target CSS, dead classes |
| `GEOMETRY.md` | Exact widths, padding, rhythm, gaps, rules, radii, breakpoints |
| `TYPOGRAPHY.md` | Role → family / size / weight / track / case / color, plus computed-style acceptance checks |
| `RESPONSIVE_CONVERGENCE.md` | 1440 / 1280 / 1100 / 900 / 768 / 390 behavior |
| `IMPLEMENTATION_PHASES.md` | VC-1 … VC-4 |
| `reference/document.module.target.css` | Drop-in replacement for `document.module.css` |

**Visual references:** the Claude Design project "Qori", `workspace2-states/01–08` (one per state) and `workspace2.css`. Compare at the same width and state.

**Single root cause:** `document.module.css` still holds pre-v2 rules, so replacing that one file (VC-2) closes most of the gap.
