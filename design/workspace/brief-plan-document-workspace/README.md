# Qori Brief + Plan Document-Workspace Redesign — Review Package

**Status: review-only. Not committed to any repo, no PR opened, `main` untouched. This package is NOT yet authoritative repo content.**

## Purpose
Standalone package for architecture/design review of the redesign that evolves the Workspace Research Brief and Research Plan from card-summary views into document-first, TipTap-ready reading/editing surfaces. It captures the approved CD design output as separate, directly-openable HTML state screens plus written specs.

## What's included
- `brief/` — Brief in four states: view (approved), edit, review pending, changes requested
- `plan/` — Plan in view and edit states (no approval gate)
- `responsive/` — Brief and Plan rendered in a mobile-width frame
- `assets/css/qori-workspace.css` — shared stylesheet (single source; no duplicated inline CSS)
- `assets/js/prototype.js` — local-only prototype interactions (dirty-state, simulated save pipeline, review-rail overlay)
- `interaction-model.md`, `implementation-handoff.md`, `state-matrix.md`, `accessibility-notes.md`
- `handoff-summary.txt`

## Intentionally out of scope
- Search, Evidence, Findings, Admin, UX-3B surfaces
- Backend behavior, real persistence, real GitHub sync (all interactions are local-only simulations)
- Inline section-level comments (rail reserves the space; concept documented, not implemented)
- Full traceability graph (ID hover/click affordances are anticipated, not built)
- Regenerate-AI-prose affordance

## How to review locally
Open any HTML file directly in a browser — no server or build step needed. Each page carries a gray "REVIEW PACKAGE" strip at the top linking every state (that strip is a review aid, not product UI). Start with `brief/brief-review-pending.html` and follow the approval flow.

## Source design references
- Section contracts: `config/prompts/research_brief.yaml` (v7.1) and `config/prompts/research_plan.yaml` (v7.2) on `friends-innovation-lab/qori-slack@main` — Workspace documents mirror these `output_template`s section-for-section, in order
- Reference artifacts: `docs/design-references/research_brief_reference.md`, `research_plan_reference.md`
- Visual/interaction source: latest approved CD design output (interactive prototype "Qori Artifact Workspace"), itself grounded in the current shipped Workspace shell (topbar search, left sidebar with gold active state, USWDS-compatible components, Public Sans)

## Relationship to existing Workspace / Design 2
The AppShell (topbar, sidebar, breadcrumb) is preserved from the current Workspace unchanged. This redesign only replaces the Brief/Plan page body: card-field summaries become a continuous research document with structured intelligence (stable IDs, provenance-classed blocks, approval machinery). Known gap: `design/workspace/` and `frontend/src/` were not visible on `qori-slack@main` during design; component naming should be reconciled against the implementation branch at build time.

## Study content
Realistic content from the current example study `permit-application-status-experience` (permit status message interpretation). Names are placeholders (John Doe, researcher; Jane Doe, reviewer).
