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
| **Architecture approved** | YES | 2026-11-02 | M1-M4 authorized, later milestones pending |
| **Implementation authorized** | M1-M4 | 2026-11-02 | M5-M8 require separate authorization |
| **Implementation completed** | M1-M4 | 2026-11-02 | Database + service + model factory + budgeted invoke + context |

**M1 Implementation Details** (completed 2026-11-02):

| File | Type | Purpose |
|------|------|---------|
| `src/database/migrations/20261102000000-disc-web-1d-create-controlled-test-sessions.js` | Migration | Creates `controlled_test_sessions` table with CHECK constraints and partial unique indexes |
| `src/database/models/controlled_test_session.ts` | Model | Sequelize model with InferAttributes pattern |
| `src/services/controlled-test-budget.service.ts` | Service | Budget reservation, reconciliation, session lifecycle |
| `src/__tests__/integration/controlled-test-budget.service.test.ts` | Tests | 46 integration tests covering all invariants (expanded for F1-F3) |
| `src/__tests__/integration/setup/testDb.ts` | Test setup | Added ControlledTestSession to model registry |
| `src/database/index.ts` | Model registry | Added ControlledTestSession registration |

**Service API**:
- `createSession(input)` — Create session with budget limits (max requests, input/output tokens)
- `getActiveSession()` — Get current active session (at most one)
- `getSessionById(id)` / `getSessionByPublicId(publicId)` — Lookup by ID
- `getSessionByRunId(runId)` — Lookup by bound run ID (critical for budget enforcement)
- `bindRunToSession(sessionId, runId)` — Bind discovery run to session (immutable once set)
- `reserveBudget(input)` — Atomic budget reservation with preconditions
- `reconcileUsage(input)` — Update actual token usage after AI call
- `cancelSession(sessionId, reason?)` — Transition to cancelled state
- `completeSession(sessionId)` — Transition to completed state

**Test Coverage**:
- Single active session constraint
- Atomic budget reservation under concurrency (5 concurrent requests)
- Budget enforcement on terminal sessions (cancelled, exhausted, completed)
- Run binding immutability
- Session lookup by run ID regardless of status

**M2 Implementation Details** (completed 2026-11-02, corrected for explicit model selection):

| File | Type | Purpose |
|------|------|---------|
| `src/helpers/modelProvider.ts` | Modified | Added `createControlledTestModel()` factory with explicit model allowlist |
| `src/__tests__/unit/modelProviderBoundary.test.ts` | Modified | Added 16 unit tests for controlled model factory |

**Factory Function** (post-correction):
```typescript
export function createControlledTestModel(
  config: ControlledTestModelConfig = {},
): ChatAnthropic {
  // Explicit model selection — NO env override inheritance
  const requestedModel = config.model ?? CONTROLLED_TEST_DEFAULT_MODEL;

  // Fail closed: reject models not in allowlist
  if (!CONTROLLED_TEST_MODEL_ALLOWLIST.includes(requestedModel)) {
    throw new Error(`... not in the approved allowlist ...`);
  }

  return new ChatAnthropic({
    anthropicApiKey: apiKey,
    modelName: requestedModel, // From allowlist only
    temperature,               // 0 by default (deterministic)
    maxTokens: 4096,           // CONTROLLED_TEST_MAX_TOKENS
    clientOptions: {
      maxRetries: 0,           // CRITICAL: Disable SDK retries
    },
  });
}
```

**Exported Constants**:
- `CONTROLLED_TEST_MAX_TOKENS = 4096` — Hard output cap (API-enforced)
- `CONTROLLED_TEST_TIER = 'sonnet'` — Model tier for controlled tests
- `CONTROLLED_TEST_MODEL_ALLOWLIST = ['claude-sonnet-4-6', 'claude-sonnet-4-5-20241022']` — Explicit allowlist
- `CONTROLLED_TEST_DEFAULT_MODEL = 'claude-sonnet-4-6'` — Default model (must be in allowlist)

**M2 Test Coverage** (16 tests total):
- Exports `CONTROLLED_TEST_MAX_TOKENS` as 4096
- Exports `CONTROLLED_TEST_TIER` as sonnet
- Exports `CONTROLLED_TEST_MODEL_ALLOWLIST` as non-empty array
- Exports `CONTROLLED_TEST_DEFAULT_MODEL` in allowlist
- Throws without `ANTHROPIC_API_KEY`
- Creates model with API key
- Sets maxTokens to 4096
- Sets temperature to 0 by default
- Accepts custom temperature
- Uses default model from allowlist
- Configures SDK with `maxRetries: 0`
- Is isolated from `createModel`
- **IGNORES `ANTHROPIC_MODEL_NAME` env override** (independence verified)
- Accepts explicit model from allowlist
- Rejects model not in allowlist (fail closed)
- Rejects unknown model (fail closed)

**No execution path changes**: `langchain.ts`, `variableExtractor.ts`, and `routes/` were NOT modified. M2 adds a new factory function only — no existing code calls it yet.

**M3 Implementation Details** (completed 2026-11-02, corrected 2026-11-02):

| File | Type | Purpose |
|------|------|---------|
| `src/helpers/budgetedInvoke.ts` | New | Fail-closed invocation wrapper with atomic budget enforcement |
| `src/__tests__/unit/budgetedInvoke.test.ts` | New | 41 unit tests with mocks (no network requests) |
| `src/services/controlled-test-budget.service.ts` | Modified | Extended for F1-F3 corrections (atomic output reservation, validation, conservative reconciliation) |
| `src/__tests__/integration/controlled-test-budget.service.test.ts` | Modified | Extended from 29 to 46 tests for F1-F3 coverage |

**M3 Architecture Review Findings (corrected 2026-11-02)**:

| # | Priority | Finding | Resolution |
|---|----------|---------|------------|
| F1 | **Medium** | Output tokens not pre-reserved in atomic UPDATE — only request+input reserved; output tracked post-hoc | **CORRECTED**: Extended `reserveBudget()` to atomically reserve request count + input tokens + output tokens in single SQL UPDATE |
| F2 | **Low** | No validation for positive token count before reservation — could pass zero/negative/NaN/Infinity | **CORRECTED**: Added `validateTokenCount()` helper; wrapper validates before service call; service validates at boundary |
| F3 | **N/A** | Conservative reconciliation needed to release unused output allocation | **IMPLEMENTED**: `reconcileUsage()` releases `max(0, reserved - actual)` output tokens; never releases more than reserved; never allows negative counters |

**Revised Service Contract**:

```typescript
// BEFORE (M3 initial)
reserveBudget({ sessionId, estimatedInputTokens })
reconcileUsage({ sessionId, actualInputTokens, actualOutputTokens })

// AFTER (F1-F3 corrected + idempotent reconciliation)
reserveBudget({ sessionId, estimatedInputTokens, reservedOutputTokens })
  // Returns { ok, reservationId, ... } — reservationId required for reconciliation
reconcileUsage({ reservationId, actualInputTokens, actualOutputTokens })
  // Uses reservationId to ensure idempotent reconciliation and session ownership
```

**F1 Atomic Reservation SQL**:
```sql
UPDATE controlled_test_sessions
SET
  used_requests = used_requests + 1,
  used_input_tokens = used_input_tokens + :estimatedInputTokens,
  used_output_tokens = used_output_tokens + :reservedOutputTokens,
  updated_at = CURRENT_TIMESTAMP
WHERE
  id = :sessionId
  AND status = 'active'
  AND used_requests < max_requests
  AND used_input_tokens + :estimatedInputTokens <= max_input_tokens
  AND used_output_tokens + :reservedOutputTokens <= max_output_tokens
RETURNING id
```

**F2 Token Validation**:
- Rejects: zero, negative, fractional, NaN, Infinity, -Infinity
- `InvalidBudgetInputError` thrown at service boundary
- `invalid_token_estimate` error code returned from wrapper

**F3 Conservative Reconciliation**:
```typescript
// Calculate unused output tokens to release
const toRelease = Math.max(0, reservedOutput - actualOutput);
// Never go negative
const newUsedOutputTokens = Math.max(0, session.used_output_tokens - toRelease);
// NOTE: Input tokens are NOT reconciled (see ReconcileUsageInput docs)
```

**Exported Functions**:
- `budgetedInvoke(input)` — Single invocation with reservation → dispatch → reconcile cycle
- `budgetedInvokeWithRetry(input, maxAttempts)` — Retry helper requiring fresh reservation per attempt

**Fail-Closed Invariants**:
1. Never dispatch if session is terminal (cancelled, exhausted, completed)
2. Never dispatch if any budget would be exceeded (request, input, OR output)
3. Never dispatch if token measurement fails
4. Never dispatch if token estimate is invalid (zero, negative, fractional, NaN, Infinity)
5. Never dispatch if reservation fails
6. Never assume an unsuccessful request was free — retain conservative reservation
7. No automatic SDK retries (M2 factory disables them)
8. Explicit retry must repeat full reservation process

**Input Token Measurement**:
- Uses `model.getNumTokens(prompt)` from LangChain base model
- NOTE: This is an ESTIMATE, not guaranteed to match provider billing
- Validated before reservation (must be finite positive integer)
- Input tokens are NOT reconciled — estimate retained for conservative accounting

**Output Token Handling**:
- Reserved at full max allocation (`CONTROLLED_TEST_MAX_TOKENS = 4096`) before dispatch
- Reconciled after successful response — unused allocation released
- On failure/timeout/missing metadata — full reservation retained

**M3 Test Coverage** (41 unit tests + 46 integration tests):

*Unit tests (budgetedInvoke.test.ts)*:
- Successful reservation → invoke → reconcile cycle
- Session not found / terminal / exhausted
- Budget exceeded (request, input, output limits)
- Token measurement failure
- Invalid token estimate (zero, negative, fractional, NaN, Infinity)
- Service-level InvalidBudgetInputError handling
- Provider error and timeout detection
- Missing/malformed usage metadata
- Successful output reconciliation with reservedOutputTokens
- Retry requiring fresh reservation per attempt
- Non-retryable error types (invalid_token_estimate included)
- Concurrent attempts respecting shared budget
- No unguarded fallback to production model

*Integration tests (controlled-test-budget.service.test.ts)*:
- Atomic reservation of request + input + output budgets
- Concurrent requests competing for limited OUTPUT budget
- Output budget exhaustion preventing reservation
- Invalid tokenizer values (zero, negative, fractional, NaN, Infinity)
- validateTokenCount helper function
- Conservative reconciliation releasing unused output
- Input tokens NOT reconciled (conservative estimate retained)
- Terminal sessions blocking subsequent attempts

**No execution path changes**: `langchain.ts`, `variableExtractor.ts`, `routes/`, Discovery poller, and Slack handlers were NOT modified. M3 adds a new helper function only — no existing code calls it yet.

**Purpose**: Enable safe execution of exactly ONE controlled Discovery AI run in the dev environment with hard budget enforcement.

**Architecture Summary**:
- Disable LangChain/Anthropic SDK retries (`clientOptions: { maxRetries: 0 }`) — M2
- Atomic budget reservation before each AI invoke — M3
- Token measurement via LangChain `getNumTokens()` before dispatch — M3
- Model output capped at 4,096 tokens (API-enforced) — M2
- Run-scoped guard via AsyncLocalStorage context — **M4 implemented**
- Serial task execution for controlled run only — M5+ (not yet implemented)

**Mandatory Implementation Safeguards**:

1. **Budget enforcement invariant**: A cancelled, exhausted, or completed controlled session must NEVER cause its bound run to execute without budget enforcement. The run queries its bound session by run ID, not by environment variable. Session status is checked atomically in every budget reservation.

2. **Transaction rollback ownership**: Implementation MUST use a single rollback owner—prefer Sequelize managed transaction (`sequelize.transaction()`)—without double rollback. The v2.2 design specifies the algorithm but the sample code does NOT yet demonstrate correct Sequelize rollback handling; implementation must verify this.

**M4 Implementation Details** (completed 2026-11-02):

| File | Type | Purpose |
|------|------|---------|
| `src/context/controlledExecutionContext.ts` | New | AsyncLocalStorage-based controlled execution context |
| `src/__tests__/unit/controlledExecutionContext.test.ts` | New | 48 unit tests covering all context invariants |

**Context API**:
- `runInControlledContext(input, callback)` — Run async callback in controlled context
- `runInControlledContextSync(input, callback)` — Run sync callback in controlled context
- `getControlledContext()` — Get current context (undefined if not controlled)
- `isInControlledContext()` — Fast path check for controlled execution
- `getControlledSessionId()` — Get current session ID (convenience)
- `getControlledRunId()` — Get current run ID if bound
- `runWithBoundRun(runId, callback)` — Update context with bound run ID

**Context Structure**:
```typescript
interface ControlledExecutionContext {
  readonly sessionId: number;       // Controlled test session ID
  readonly discoveryRunId: number | null; // Run ID when bound
  readonly isControlled: true;      // Explicit marker
  readonly createdAt: string;       // ISO 8601 timestamp
  readonly purpose?: string;        // Human-readable purpose
}
```

**Key Invariants**:
1. Context is immutable (Object.freeze)
2. Context is isolated across concurrent async tasks
3. Context never leaks into normal Slack/REST execution
4. Errors do not leave context active (AsyncLocalStorage handles cleanup)
5. Nested context entry is explicitly rejected (NestedControlledContextError)
6. Invalid session/run IDs are rejected (InvalidContextParameterError)

**Provider Invocation Points Identified** (for M5 routing):

| File | Line(s) | Invocation |
|------|---------|------------|
| `langchain.ts` | 153, 196 | `createModel()` for YAML task generation |
| `langchain.ts` | 198, 212 | `taskLlm.invoke()` main call + claim guard retry |
| `variableExtractor.ts` | 616, 628 | `createModel()` + `llm.invoke()` per extraction tier |
| `codebookGenerator.ts` | 76, 83 | Survey codebook generation |
| `assignmentGenerator.ts` | 90, 97 | Survey assignment generation |
| `readout-generation-executor.service.ts` | 467, 474 | Readout generation |
| `askHandler.ts` | 54, 94 | Ask command (haiku + sonnet) |
| `anthropic-adapter.ts` | 56 | Coaching provider |

**Future Provider Routing Contract** (M5+):
```typescript
// At each invocation point:
const ctx = getControlledContext();
if (ctx) {
  // Controlled execution → route to budgetedInvoke()
  return await budgetedInvoke({ sessionId: ctx.sessionId, prompt, model });
} else {
  // Normal execution → existing createModel().invoke() path
  return await llm.invoke(prompt);
}
```

**M4 Test Coverage** (48 unit tests):
- Context available inside sync/async callbacks
- Context preserved across awaited promises (single, multiple, Promise.all, nested)
- Context isolated across concurrent controlled sessions
- Normal execution sees no controlled context
- Context does not leak after callback completion
- Nested context entry rejected with error
- Errors do not leave context active
- Invalid session/run identifiers rejected
- Context immutability (frozen, no modification)
- runWithBoundRun updates context correctly
- Return value passthrough

**No execution path changes**: M4 adds context infrastructure only. No production invocation paths were modified. The routing contract is documented but NOT yet implemented.

**Outstanding Blockers**:
- M5-M8 require explicit authorization before implementation
- No AI invocation paths wired in M1-M4 (context + budgetedInvoke exist but are not called)

**Next Step**: Await M5 authorization (run binding in `createPendingDiscoveryRunFromRefs()`)

**M1 Follow-up Findings** (from architecture review):

| # | Priority | Finding | Resolution Milestone |
|---|----------|---------|---------------------|
| 1 | Medium | `ON DELETE SET NULL` on `discovery_run_id` could orphan session from run if run deleted before session completion | **M5a migration** (ON DELETE RESTRICT) |
| 2 | Low | `actualInputTokens` param in `reconcileUsage` is accepted but unused | **Reviewed M3**: Input tokens reserved at request time; actual input only for logging. No change needed. |
| 3 | Low | Test database uses separate Sequelize instance from service; connection pool cleanup at scale | Technical debt backlog |

**M2 Follow-up Findings** (from architecture review):

| # | Priority | Finding | Resolution Milestone |
|---|----------|---------|---------------------|
| 4 | High | Verify `CONTROLLED_TEST_MODEL_ALLOWLIST` entries against Anthropic provider documentation before live testing | **Required before M8** (live test execution) |

**M3 Follow-up Findings** (from architecture review, 2026-11-02):

| # | Priority | Finding | Status |
|---|----------|---------|--------|
| F1 | Medium | Output tokens not pre-reserved in atomic UPDATE | **RESOLVED** — Extended `reserveBudget()` to include `reservedOutputTokens` |
| F2 | Low | No validation for positive token count before reservation | **RESOLVED** — Added `validateTokenCount()` and wrapper-level validation |
| F3 | N/A | Conservative reconciliation needed for output allocation | **RESOLVED** — `reconcileUsage()` releases unused output; guards against negative |
| 5 | Info | `model.getNumTokens()` returns an ESTIMATE; actual provider billing may differ slightly | Documented in code; acceptable for budget enforcement |
| 6 | Medium | `budgetedInvoke` is not yet wired into any workflow; requires M4 (AsyncLocalStorage) and M5 (run binding) | Resolve during M4-M5 integration |
| 7 | Info | `ReservationSessionMismatchError` class defined but unused | **Technical debt** — Reservation-based design enforces session ownership implicitly; explicit validation unnecessary in current design. Do not remove. |

**M4 Follow-up Findings** (from architecture review, 2026-11-02):

| # | Priority | Finding | Status |
|---|----------|---------|--------|
| F1 | **Medium** | Detached async descendants (setTimeout, setImmediate created inside `runInControlledContext`) can still read context after callback returns | **M5 INTEGRATION REQUIREMENT** — Add lifecycle marker validation before provider routing |

**M5 Mandatory Design Corrections** (from F5-F8 review, 2026-11-02):

These corrections are REQUIRED before M5 implementation:

1. **Transactional replay must close its transaction before returning**. The transaction pattern must have a single rollback owner (Sequelize managed transaction). The v2.2 design's `needsRollback` flag pattern is incorrect — Sequelize throws on double rollback. Implementation must commit or rollback the managed transaction before returning, never both.

2. **Authorization contract distinguishes new run from idempotent replay**:

   - **New run**: Authenticated actor owns an active, unbound session (`discovery_run_id IS NULL`). The session is bound atomically to the newly created run within the same transaction.

   - **Idempotent replay**: Authenticated actor owns the session, AND the session's immutable binding (`discovery_run_id`) matches the existing run returned by the replay. Verification must occur after transaction acquisition.

   A replay request for run A CANNOT execute under a session bound to run B.

3. **Controlled execution must have a dedicated default-off backend capability gate** (`DISC_WEB1D_ENABLED` or similar). This gate must be checked before any controlled execution path is entered, ensuring the feature remains disabled until explicit production enablement.

**M5 Integration Requirements** (from M4 audit):

1. **Detached-descendant mitigation**: Add `_lifecycleId` counter to context; track active lifecycles in module-level `Set`; validate lifecycle is still active before routing to `budgetedInvoke()`. This prevents detached callbacks from executing budgeted invocations after their parent context has exited.

2. **Provider routing boundaries**: The following Discovery invocations must be intercepted when context is active:

   | Location | Function | Model | Retry | Adapter |
   |----------|----------|-------|-------|---------|
   | `langchain.ts:198` | `taskLlm.invoke(prompt)` | sonnet | None | Extract `result.content` |
   | `langchain.ts:212` | `taskLlm.invoke(retryPrompt)` | sonnet | Claim-guard | Use `budgetedInvokeWithRetry` |
   | `variableExtractor.ts:628` | `llm.invoke(prompt)` | haiku/sonnet | 2 attempts | Use `budgetedInvokeWithRetry` |

3. **Paths that MUST remain unchanged** (not controlled execution):

   | Path | Entry Point | Reason |
   |------|-------------|--------|
   | Slack `/qori-brief` | `briefHandler.ts` | Production workflow |
   | Slack `/qori-plan` | `planHandler.ts` | Production workflow |
   | Slack `/qori-discover` | `discoverHandler.ts` | Legacy path, not sourceRefs |
   | Survey synthesis | `surveySubmissionHandler.ts` | Production workflow |
   | Codebook generation | `codebookGenerator.ts` | Survey workflow |
   | Coaching | `anthropic-adapter.ts` | Coaching workflow |
   | Ask command | `askHandler.ts` | Slack command |
   | Readout generation | `readout-generation-executor.service.ts` | Production workflow |

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

**Backend Unit Tests** (as of 2026-11-02, post-M3):
```
Test Suites: 59 passed, 59 total
Tests:       1152 passed, 1152 total
```

**Backend Integration Tests** (M1 only):
```
Test Suites: 1 passed, 1 total
Tests:       29 passed, 29 total (controlled-test-budget.service.test.ts)
```

**Frontend Unit Tests** (as of 2026-10-31, unchanged):
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
**Backend Tests**: 1200 passing (verified post-M4: 1152 base + 48 M4 context tests)
**Frontend Tests**: 1466 passing, 2 failing (reported; identities unknown—requires baseline run)

**Active Work**: DISC-WEB-1D-2 M1-M4 complete, M5 pending architecture review.

**Safety Gates**: The Web UI submission path is gated off (`ENABLE_LIVE_RUN_CREATION=false`, `DISC_WEB1_ENABLED` unset). Legacy REST `sources[]` and Slack `/qori-discover` paths remain operational and are NOT gated.

### 10.2 Next Task

**DISC-WEB-1D-2 M5** — Pending architecture review and authorization.

Completed milestones:
- ✅ M1: Database migration + service (49 integration tests)
- ✅ M2: `createControlledTestModel()` with `maxRetries: 0` (16 unit tests)
- ✅ M3: `budgetedInvoke()` with atomic reservation (41 unit tests)
- ✅ M4: AsyncLocalStorage context propagation (48 unit tests)

Remaining milestones (require separate authorization):
1. M5: Run binding in `createPendingDiscoveryRunFromRefs()`
2. M6: Admin API endpoints
3. M7: Unit tests
4. M8: Integration + Slack regression tests

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
| 2026-11-02 | 1.2 | Claude Code | M1 implementation: migration, model, service, 29 integration tests; decision states updated |
| 2026-11-02 | 1.3 | Claude Code | M2 implementation: `createControlledTestModel()` with `clientOptions: { maxRetries: 0 }`, 11 unit tests |
| 2026-11-02 | 1.4 | Claude Code | M2 correction: Explicit model allowlist, independence from production env overrides, fail-closed validation, 16 unit tests |
| 2026-11-02 | 1.5 | Claude Code | M3 implementation: `budgetedInvoke()` with atomic reservation, token measurement, usage reconciliation, 34 unit tests |
| 2026-11-02 | 1.6 | Claude Code | M3 commit: Corrected service contract docs (reservationId-based reconciliation); added unused ReservationSessionMismatchError as tech debt; 41 unit + 46 integration tests |
| 2026-11-02 | 1.7 | Claude Code | M4 implementation: AsyncLocalStorage context for controlled execution; identified provider invocation points for M5 routing; 48 unit tests |
