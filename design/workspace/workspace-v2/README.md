# Qori Workspace v2 (UX-3A): Production Handover

This handover explains how to implement the approved Workspace v2 design in the production frontend (`qori-slack@dev`). It's a presentation-layer migration: no contract, editor, persistence or approval-model changes.

| File | Purpose |
|---|---|
| `WORKSPACE_V2_SPEC.md` | Start here. Repo snapshot, locked architecture, production findings (PF-xx), shell, Brief/Plan convergence, TipTap, provenance, context rail, accessibility, non-goals, **design decisions required (DDR-xx)** |
| `COMPONENT_MAPPING.md` | Prototype concept → production file, the KEEP/RESTYLE/EXTEND/NEW matrix, and per-component specs |
| `TOKENS.md` | Design System v1: token migration, contrast, fonts, typography role table |
| `RESPONSIVE.md` | Exact layouts for ≥1181 / 981–1180 / 768–980 / ≤767 |
| `IMPLEMENTATION_PHASES.md` | CC-1 … CC-8: allowed/forbidden files, tasks, tests, acceptance, QA |
| `reference/tokens.reference.css` | Proposed `tokens.css`, drop-in |
| `reference/workspace-v2.reference.css` | All component CSS, bannered by target module file |
| `reference/sample-view-models.ts` | Typed `BriefViewModel` / `PlanViewModel` samples. Provenance values match what the projection emits |
| `reference/*.reference.tsx` | Production-shaped TSX for the shell, lifecycle nav, document canvas, sections, context rail and editor states |

**Everything in `reference/` is DESIGN REFERENCE — NOT PRODUCTION.** Nothing may import it. It sits outside `frontend/src` on purpose.

**Source:** `qori-slack@dev` `7f0366d8`. Display contract: `BriefViewModel` / `PlanViewModel` from `packages/artifact-contracts/src/workspace-projection.ts` (DDR-00 resolved). `reference/sample-view-models.ts` holds typed samples of both.

**Before CC-1:** answer DDR-04 and DDR-07. CC-3 is blocked on DDR-01. CC-5 also needs DDR-10, DDR-16 and the DDR-11 ship decision.

Design intent source: the Claude Design project "Qori" (`Qori Workspace v2.html`, `workspace2-*.jsx`, `workspace2.css`, `workspace2-states/`).
