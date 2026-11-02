# QORI — Living Project Roadmap

**Canonical Location**: `docs/roadmap/QORI-ROADMAP.md`
**Last Updated**: 2026-11-02
**Current Branch**: `dev`

**Application Baseline**: `314994df` (feat(DISC-WEB-1C-2b): Start Analysis confirmation UI with safety gate)
**Roadmap Document**: This file is new and uncommitted. Commit after review.

---

## Mandatory Milestone Rule

> **Every implementation milestone must update this roadmap with its actual results, tests, PR/commit references, remaining issues, and next steps before it is considered closed.**
>
> For UI milestones, include links to the relevant Claude Design specification and note any design-to-implementation discrepancies.

---

## Table of Contents

1. [Product Vision and Architecture](#1-product-vision-and-architecture)
2. [Implementation Status](#2-implementation-status)
3. [Completed Milestones](#3-completed-milestones)
4. [Current Work and Blockers](#4-current-work-and-blockers)
5. [Upcoming Milestones](#5-upcoming-milestones)
6. [Claude Design Ownership](#6-claude-design-ownership)
7. [Architecture Decisions](#7-architecture-decisions)
8. [Safety Gates and Restrictions](#8-safety-gates-and-restrictions)
9. [Test Baseline](#9-test-baseline)
10. [Handoff Section](#10-handoff-section)

---

## 1. Product Vision and Architecture

### 1.1 Vision

Qori is a deployable, channel-independent research operating system for public-sector and government research teams.

**Core Principles**:
- Canonical research state lives in Qori's governed backend/database
- GitHub is a durable artifact and implementation projection
- Slack is a supported conversational adapter
- The Qori Research Workspace is the visual adapter
- Future adapters may include Microsoft Teams or agency-specific interfaces
- No interface becomes the source of truth
- Agencies can deploy Qori into infrastructure they control

**UX Principle**:
> "Qori should make research structured for the system without making research feel structured to the researcher."

**Architectural Rule**:
> New business capabilities must be implemented in Qori Core first and exposed through adapters second. No capability should exist only inside Slack or only inside the Workspace.

### 1.2 Architecture Overview

**Four Cooperating Planes**:

1. **Research Evidence Plane** — Authoritative research state: sources, observations, constructs, findings, recommendations, evidence relationships, derivation metadata, review/adjudication state, provenance
2. **Contextual Cascade Plane (GET/CCA)** — Contextual propagation: consumes, asks, commits, emits, destination-specific transformation, artifact generation
3. **Participant Operations Plane** — Operational participant state: outreach, recruitment, participant tracker, scheduling, participation status, participant codes
4. **Governance / Control Plane** — PII review, approval/disposition, authorization, admin center, audit, deletion/DSAR, lifecycle controls

**Technology Stack**:

| Layer | Technology |
|-------|------------|
| Backend Runtime | Node.js 20.x |
| Backend Framework | Express + Slack Bolt |
| Database | PostgreSQL 16 (Railway) |
| ORM | Sequelize 6.x |
| Queue | Bull + Redis |
| AI Orchestration | LangChain 1.2.11 |
| AI Provider | Anthropic Claude (claude-sonnet-4-6 default) |
| Frontend Framework | React 19.0 |
| Frontend Build | Vite 6.0 |
| UI Components | USWDS 3.14 |
| Testing | Jest (backend), Vitest + Playwright (frontend) |

**Deployment Topology**:

| Environment | Branch | Services | Slack App |
|-------------|--------|----------|-----------|
| Production | `main` | Backend + Postgres + Redis | `Qori` (A08U0FLM4AG) |
| Development | `dev` | Backend + Postgres + Redis | `Qori-dev` (A0BM9PN95LM) |

---

## 2. Implementation Status

### 2.1 Status Legend

| Status | Meaning |
|--------|---------|
| **Designed** | Architecture/spec complete, not yet implemented |
| **Implemented** | Code written, not fully tested |
| **Tested** | Unit/integration tests passing |
| **Merged** | PR merged to `dev` |
| **Deployed** | Running in Railway dev environment |
| **Verified** | Manually verified in dev environment |
| **Production** | Deployed to `main` and Railway production |

### 2.2 Feature Status Matrix

#### Slack Surface (Production)

| Feature | Status | Reference |
|---------|--------|-----------|
| `/qori-start` project creation | Production | - |
| `/qori-brief` research brief | Production | v6.0 cascade-aware |
| `/qori-plan` research plan | Production | v4.7 lean rewrite |
| `/qori-guide` discussion guide | Production | - |
| `/qori-session` session capture | Production | - |
| `/qori-analyze` session analysis | Production | - |
| `/qori-discover` desk research | Production | Slack path |
| `/qori-discover` stakeholder synthesis | Production | - |
| `/qori-discover` survey synthesis | Production | - |
| `/qori-readout` research readout | Production | - |
| `/qori-track` participant tracking | Production | - |
| Admin center | Production | - |

#### Web Workspace (In Development)

| Feature | Status | Reference |
|---------|--------|-----------|
| OIDC Authentication | Merged/Deployed | ADR 0043 |
| Project/Study navigation | Merged/Deployed | NAV series |
| Desk Research Readouts (DR-6b) | Merged/Deployed | PRs #452-472 |
| Insight browser (DR-4) | Merged/Deployed | PRs #443-451 |
| Discovery intake (DISC-WEB-1A-C) | Merged/Deployed | PRs #473-484 |
| Discovery AI execution | **Designed only** | DISC-WEB-1D-2 v2.2 |

#### Governance (Production)

| Feature | Status | Reference |
|---------|--------|-----------|
| Project-level authorization | Production | ADR 0024 |
| DSAR compliance | Production | GOV-2 |
| Records lifecycle | Production | ADR 0040 |
| Disaster recovery | Production | ADR 0039 |
| PII privacy gate | Production | ADR 0035 |

---

## 3. Completed Milestones

### 3.1 DISC-WEB-1 Series (Web Document Extraction)

| Milestone | PR | Commit | Status | Date |
|-----------|-----|--------|--------|------|
| DISC-WEB-1A: Backend infrastructure | #473 | `d5e894d4` | Merged | 2026-10 |
| DISC-WEB-1B-1: REST API foundation | #474 | `b0b7d4d3` | Merged | 2026-10 |
| DISC-WEB-1B-2a: HTTP endpoint | #475 | `27896b1c` | Merged | 2026-10 |
| DISC-WEB-1B-2b: Atomic source refs | #476 | `fd1246df` | Merged | 2026-10 |
| DISC-WEB-1B-2c: Worker verification | #477 | `4bfbff09` | Merged | 2026-10 |
| DISC-WEB-1B-2d: Upload admission control | #480 | `0e3ad088` | Merged | 2026-10 |
| DISC-WEB-1C-1: Upload-only frontend | #481 | `ae9e621f` | Merged | 2026-10 |
| DISC-WEB-1C-2a: sourceRefs API contracts | #482 | `e233303c` | Merged | 2026-10 |
| DISC-WEB-1C-2b: Start Analysis UI | #483 | `314994df` | Merged | 2026-10-31 |

### 3.2 DR-6b Series (Desk Research Readouts)

| Milestone | PR | Commit | Status |
|-----------|-----|--------|--------|
| DR-6b-1: Database foundation | #453 | `dff50098` | Merged |
| DR-6b-2: Service layer | #454 | `d299f24a` | Merged |
| DR-6b-3: HTTP API | #455 | `c50a4449` | Merged |
| DR-6b-4a-f: Frontend pages | #456-461 | - | Merged |
| DR-6b-5a-e: Generation workflow | #462-471 | - | Merged |
| DR-6b-5f-a: E2E test coverage | #472 | `1bb52a1a` | Merged |

### 3.3 Governance Foundation (Production)

| Milestone | Status | Reference |
|-----------|--------|-----------|
| GOV-1: Project authorization | Production | ADR 0024 |
| GOV-2: DSAR compliance | Production | DSAR service |
| GOV-3: Database integrity | Production | ADR 0022 |
| GOV-4: Observability | Production | Sentry |
| GOV-5: Disaster recovery | Production | ADR 0039, PR #330 |
| GOV-6: Records lifecycle | Production | ADR 0040, PR #331 |

---

## 4. Current Work and Blockers

### 4.1 DISC-WEB-1D-2 — Controlled Discovery AI Execution Guard

**Decision States**:

| State | Status | Date | Notes |
|-------|--------|------|-------|
| **Architecture approved** | NO | — | v2.2 conditionally accepted pending corrections |
| **Implementation authorized** | NO | — | Requires architecture approval first |
| **Implementation completed** | NO | — | — |

**Purpose**: Enable safe execution of exactly ONE controlled Discovery AI run in the dev environment with hard budget enforcement.

**Architecture Summary**:
- Disable LangChain/Anthropic SDK retries (`clientOptions: { maxRetries: 0 }`)
- Atomic budget reservation before each AI invoke
- Token measurement via LangChain `getNumTokens()` before dispatch
- Model output capped at 4,096 tokens (API-enforced)
- Run-scoped guard via AsyncLocalStorage context
- Serial task execution for controlled run only

**Mandatory Implementation Safeguards**:

1. **Budget enforcement invariant**: A cancelled, exhausted, or completed controlled session must NEVER cause its bound run to execute without budget enforcement. The run queries its bound session by run ID, not by environment variable. Session status is checked atomically in every budget reservation.

2. **Transaction rollback ownership**: Implementation MUST use a single rollback owner—prefer Sequelize managed transaction (`sequelize.transaction()`)—without double rollback. The v2.2 design specifies the algorithm but the sample code does NOT yet demonstrate correct Sequelize rollback handling; implementation must verify this.

**Outstanding Blockers**:
- Architecture approval required before implementation
- No implementation work authorized

**Next Step**: Await explicit architecture approval for v2.2

### 4.2 Safety Gates (Currently Active)

| Gate | Location | Current Value | Purpose |
|------|----------|---------------|---------|
| `ENABLE_LIVE_RUN_CREATION` | DeskIntake.tsx:55 | `false` (hardcoded) | Blocks frontend run submission |
| `DISC_WEB1_ENABLED` | extraction.routes.ts:80 | unset (disabled) | Blocks backend sourceRefs consumption |
| `DISCOVERY_POLLER_ENABLED` | poller.ts:32 | unset (enabled) | Controls worker polling |
| `CONTROLLED_TEST_MODE` | Not yet implemented | N/A | Proposed in DISC-WEB-1D-2 |

---

## 5. Upcoming Milestones

### 5.1 Immediate (Pending Approval)

| Milestone | Description | Blocker | Priority |
|-----------|-------------|---------|----------|
| **DISC-WEB-1D-2** | Controlled AI Execution Guard implementation | Architecture approval | P0 |
| **DISC-WEB-1D-3** | Controlled AI test execution | DISC-WEB-1D-2 | P0 |
| **DISC-WEB-1E** | Production enablement decision | Successful controlled test | P1 |

### 5.2 Release Readiness (From Consolidated Roadmap)

| Milestone | Description | Status |
|-----------|-------------|--------|
| **RR-1** | Slack modal/template contract audit | NOT STARTED |
| **RR-2** | Integrated DEV end-to-end test | NOT STARTED |
| **RR-3** | dev → main release gate | NOT STARTED |

### 5.3 Platform (From Consolidated Roadmap)

| Milestone | Description | Status |
|-----------|-------------|--------|
| **WS-0** | Workspace Enablement Foundation | DEV (PR pending) |
| **PH-7** | Structured Claim Contract | NOT STARTED |
| **PH-8** | Artifact Standard vNext | NOT STARTED |
| **PH-9** | Qori Ask (canonical retrieval) | NOT STARTED |

---

## 6. Claude Design Ownership

### 6.1 Design Directory

**Location**: `design/workspace/`

**Ownership Rule**: Claude Code must NOT modify files in the `design/` directory. These are Claude Design-owned specifications.

### 6.2 Approved Designs

| Design | Location | Implementation Status |
|--------|----------|----------------------|
| Workspace navigation | `design/workspace/` | Partial (NAV series) |
| Desk Research Readouts | DR-6b spec | Implemented (DR-6b series) |
| Discovery intake | DISC-WEB-1 spec | Implemented (DISC-WEB-1A-C) |
| Controlled AI execution | DISC-WEB-1D-2 v2.2 | Designed only |

### 6.3 Design-to-Implementation Alignment

| Area | Design Reference | Implementation | Discrepancies |
|------|------------------|----------------|---------------|
| DeskIntake UI | DISC-WEB-1 spec | DeskIntake.tsx | Safety gate hardcoded (intentional) |
| Readout editor | DR-6b design | ReadoutEditor.tsx | None noted |

---

## 7. Architecture Decisions

### 7.1 ADR Index

**Location**: `docs/architecture-decisions/`

**Total ADRs**: 45 (0001-0045) + 7 Lessons (L001-L007)

**Key ADRs for Current Work**:

| ADR | Title | Relevance |
|-----|-------|-----------|
| 0034 | Model provider boundary | AI invocation architecture |
| 0035 | Unstructured content privacy gate | Pre-AI privacy check |
| 0036 | External side-effect idempotency | Run creation idempotency |
| 0043 | Adapter-neutral authentication | Workspace auth |
| 0044 | Channel-independent application boundary | Shared execution path |

### 7.2 Technical Debt

**Documented in ADR README**:

| ID | Issue | Severity |
|----|-------|----------|
| CMT-1 | Actor FK cascade vs audit retention | Low |
| - | ChromaDB dead dependency | Low |
| - | Sam agent unfinished | Low |
| - | 285 console.log instances | Medium |
| - | No rate limiting | Medium |

---

## 8. Safety Gates and Restrictions

### 8.1 Deployment Restrictions

**Token Isolation Rule** (incident 2026-07-28):
> All Slack credentials must match the environment's own Slack app. Cross-environment credential sharing caused a 3-day outage.

| Credential | Scope |
|------------|-------|
| `SLACK_APP_TOKEN` | Per-environment Slack app |
| `SLACK_BOT_TOKEN` | Per-environment Slack app |
| `SLACK_SIGNING_SECRET` | Per-environment Slack app |
| `QORI_ALERTS_CHANNEL_ID` | Per-environment workspace |

### 8.2 Protected Stashes

**DO NOT DROP these stashes**:

| Stash | Content | Rule |
|-------|---------|------|
| stash@{0} | dr-6b-2-readout-services WIP | Do not drop |
| stash@{1} | nav-1c-study-overview WIP | Do not drop |
| stash@{2} | PRE-NAV-1a: 103 design changes | **PROTECTED - DO NOT DROP** |
| stash@{3} | DISC-1 Discovery Foundation WIP | Do not drop |
| stash@{4} | Coach M3B blocker fix WIP | Do not drop |
| stash@{5} | Brief study identity mismatch WIP | Do not drop |

### 8.3 Known Regression Risks

| Risk | Mitigation |
|------|------------|
| Slack Discovery blocked during controlled test | v2.2 design scopes guard to bound run only |
| Legacy `sources[]` path unprotected | v2.2 design documents behavior |
| SDK retry behavior | v2.2 disables SDK retries for controlled run |

---

## 9. Test Baseline

### 9.1 Current Test Status

**Backend Unit Tests** (as of 2026-10-31):
```
Test Suites: 58 passed, 58 total
Tests:       1102 passed, 1102 total
```

**Frontend Unit Tests** (as of 2026-10-31):
```
Test Suites: 78 passed, 2 failed, 81 total
Tests:       1466 passed, 2 failed, 1468 total
```

### 9.2 Known Test Failures

| Test Suite | Failure | Status |
|------------|---------|--------|
| Frontend (2 suites) | **Identity unknown** | No local test report found |

> **Required before implementation**: Run `npm test` in `frontend/` to identify failing tests and update this section with verified results. The counts above (1466 passed, 2 failed) are **reported** from a prior session, not **verified** in the current environment.

### 9.3 Verification Evidence

| Feature | Verification Method | Last Verified |
|---------|---------------------|---------------|
| DISC-WEB-1C-2b UI | Manual in dev | 2026-10-31 |
| DR-6b readout editor | E2E tests (PR #472) | 2026-10 |
| Backend unit tests | CI on every PR | 2026-10-31 |

---

## 10. Handoff Section

### 10.1 Current State

**Branch**: `dev`
**Application Baseline**: `314994df` (DISC-WEB-1C-2b)
**Backend Tests**: 1102 passing (verified)
**Frontend Tests**: 1466 passing, 2 failing (reported; identities unknown—requires baseline run)

**Active Work**: DISC-WEB-1D-2 architecture design complete (v2.2), awaiting approval.

**Safety Gates**: The Web UI submission path is gated off (`ENABLE_LIVE_RUN_CREATION=false`, `DISC_WEB1_ENABLED` unset). Legacy REST `sources[]` and Slack `/qori-discover` paths remain operational and are NOT gated.

### 10.2 Next Task

**DISC-WEB-1D-2 Implementation** — Pending architecture approval.

When approved, implementation proceeds in this order:
1. M1: Database migration + service (2h)
2. M2: `createControlledTestModel()` with `maxRetries: 0` (1h)
3. M3: `budgetedInvoke()` with atomic reservation (3h)
4. M4: AsyncLocalStorage context propagation (2h)
5. M5: Run binding in `createPendingDiscoveryRunFromRefs()` (2h)
6. M6: Admin API endpoints (1h)
7. M7: Unit tests (3h)
8. M8: Integration + Slack regression tests (2h)

### 10.3 Prohibited Changes

**Until explicit authorization**:
- Do NOT implement DISC-WEB-1D-2
- Do NOT modify application code, migrations, or tests
- Do NOT change environment variables or Railway settings
- Do NOT run Discovery or invoke AI
- Do NOT modify Claude Design-owned files
- Do NOT apply, drop, or modify protected stashes
- Do NOT merge to `main` or deploy

---

## Related Documents

| Document | Location | Purpose |
|----------|----------|---------|
| Consolidated Roadmap | `docs/roadmaps/qori-consolidated-roadmap.md` | Historical roadmap (superseded by this document for tracking) |
| ADR Index | `docs/architecture-decisions/README.md` | Architecture decisions |
| DISC-WEB-1 Spec | `docs/specs/DISC-WEB-1-final-spec.md` | Discovery implementation spec |
| Federal Readiness | `docs/federal-readiness-matrix.md` | Gap analysis |
| Platform Audit | `docs/audits/platform-completeness-audit-2026-08-19.md` | Pre-launch gaps |

---

## Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-10-31 | 1.0 | Claude Code | Initial canonical roadmap established |
| 2026-11-02 | 1.1 | Claude Code | Corrections: separated baseline from roadmap commit; fixed transaction safeguard wording; clarified Discovery path gating; marked failing tests as unverified; added decision states |
