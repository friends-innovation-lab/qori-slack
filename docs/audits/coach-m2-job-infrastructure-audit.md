# Coach M2 Job Infrastructure Audit

**Date:** 2026-09-26
**Auditor:** Claude Code
**Scope:** Determine whether to reuse existing Bull/Redis queue infrastructure OR implement a Postgres-backed Coach queue using SKIP LOCKED
**Status:** AUDIT COMPLETE — RECOMMENDATION PROVIDED

---

## Executive Summary

**Recommendation: USE POSTGRES SKIP LOCKED** — Do not reuse Bull/Redis.

The existing Bull infrastructure is disabled, Redis is non-authoritative by design, and the coaching use case aligns perfectly with Postgres-native job processing. A Postgres SKIP LOCKED implementation:

1. Maintains the single-database architecture (no Redis dependency)
2. Provides transactional consistency between job state and coaching results
3. Works in government/enterprise environments that may restrict Redis
4. Requires no infrastructure changes to Railway deployment
5. Leverages the worker columns already in `coaching_runs` (M1 foundation)

---

## 1. Existing Bull Queue Infrastructure

### 1.1 Queue Files

| File | Status | Purpose |
|------|--------|---------|
| `backend/src/helpers/queue/indexRepoQueue.js` | DISABLED | RAG document indexing |
| `backend/src/helpers/queue/embededFile.queue.js` | DISABLED | RAG file embedding |

Both queues are part of the RAG pipeline, which is disabled for alpha. Workers are no-ops:

```javascript
// embededFile.queue.js:16
embedFileQueue.process(5, async (job) => {
  // RAG disabled — jobs silently complete
  console.log(`[embedFileQueue] RAG disabled — skipping embed for ${job.data.path}`);
});
```

### 1.2 Bull Configuration

```javascript
// Standard Bull queue instantiation
const indexRepoQueue = new Queue('indexRepoQueue', {
  redis: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
  defaultJobOptions: { attempts: 2, removeOnComplete: true },
});
```

**Pattern:** Connection via `REDIS_HOST`/`REDIS_PORT` env vars. Default retry of 2 attempts.

### 1.3 Bull Dependency

Package: `bull@4.16.5` (in package.json)

---

## 2. Redis Infrastructure State

### 2.1 Redis Client

**File:** `backend/src/libs/redis.js`
**Status:** FULLY COMMENTED OUT

```javascript
// // libs/redis.js
// const { createClient } = require("redis");
// ... entire module is commented
```

### 2.2 Redis Usage Points

| Location | Status | Purpose |
|----------|--------|---------|
| `libs/redis.js` | Commented out | Generic Redis client |
| `middleware/cache.js` | Exists but unused | HTTP response cache |
| `helpers/queue/*.js` | Disabled | RAG embedding queue |
| `helpers/survey/pendingCsvStore.ts` | Active, lazy-loaded | Survey CSV staging (2hr TTL) |
| `middleware/session.ts` | Active, optional | Express session store |

### 2.3 Redis Contract (from `docs/deployment/redis.md`)

> Redis is **non-authoritative** in Qori. No canonical state is stored in Redis.

> Redis is currently non-authoritative. All Redis-backed features (RAG embedding queue) are disabled. Qori starts and operates correctly without Redis.

### 2.4 Configuration Status

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `REDIS_HOST` | No | `localhost` | Only relevant if RAG re-enabled |
| `REDIS_PORT` | No | `6379` | Only relevant if RAG re-enabled |
| `REDIS_URI` | No | None | Alternative to host/port |

---

## 3. Current AI Generation Pattern

### 3.1 Synchronous Execution

All AI generation currently happens inline via `executeAiGenerationTasks()`:

```typescript
// backend/src/helpers/langchain.ts:142
export async function executeAiGenerationTasks(
  aiGenerationTasks: AiGenerationTask[],
  inputValues: Record<string, any>,
  piiContext?: PiiRedactionContext,
): Promise<AiResponses> {
  // ... synchronous execution, awaited inline
  const response = await taskLlm.invoke(finalPrompt);
}
```

### 3.2 Handler Pattern

Slack handlers `ack()` the request, then execute AI tasks inline:

```typescript
// Typical pattern in handlers
await ack();
const result = await executeBrief(ctx, briefInput);  // Contains LLM call
await client.chat.postMessage({ ... });
```

**Implication:** No background processing infrastructure exists. Handlers block during AI generation.

---

## 4. Coaching Run Model (M1 Foundation)

The M1 implementation already includes worker/queue support columns:

| Column | Type | Purpose |
|--------|------|---------|
| `status` | ENUM | pending → running → completed/failed |
| `claimed_at` | TIMESTAMP | When worker claimed the run |
| `heartbeat_at` | TIMESTAMP | Last heartbeat (stale detection) |
| `worker_id` | VARCHAR(100) | Claiming worker identifier |
| `attempt_count` | INTEGER | Operational retry count |
| `last_attempt_at` | TIMESTAMP | Last execution attempt |

**Partial unique index** enforces single active run:
```sql
CREATE UNIQUE INDEX coach_active_run_unique
ON coaching_runs (artifact_id, content_version, review_scope, selected_section_key, requested_by)
WHERE status IN ('pending', 'running');
```

---

## 5. Deployment Topology

### 5.1 Railway Configuration

- **Single container** per environment (dev, prod)
- No separate worker process
- Dockerfile CMD: `scripts/start.sh` → migrations → `node ./dist/app.js`

### 5.2 Docker Compose (Local Dev)

```yaml
services:
  qori-backend:
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_started }
  redis:
    image: redis:7-alpine
```

**Note:** Redis is in docker-compose but not required for app functionality.

---

## 6. Bull vs Postgres SKIP LOCKED Comparison

### 6.1 Bull (Redis) Advantages

| Capability | Bull Provides |
|------------|---------------|
| Job queue semantics | Purpose-built, battle-tested |
| Retry with backoff | Built-in exponential backoff |
| Priority queues | Built-in job priority |
| Rate limiting | Built-in rate limiting |
| Monitoring | Bull Board UI |
| Horizontal scaling | Multiple workers trivial |
| Job deduplication | Via `jobId` |
| Real-time dispatch | Redis pub/sub |

### 6.2 Bull (Redis) Disadvantages

| Issue | Impact |
|-------|--------|
| Requires Redis | Additional infrastructure |
| Two data stores | Postgres + Redis complexity |
| Redis failure mode | Queue unavailable |
| Currently disabled | Need to re-enable infrastructure |
| Government restrictions | Some agencies prohibit Redis |
| Session dependency | Would couple session and queue Redis |

### 6.3 Postgres SKIP LOCKED Advantages

| Capability | Impact |
|------------|--------|
| Single data store | Postgres-only, already required |
| Transactional consistency | Job state + coaching results atomic |
| No infrastructure change | Works in current Railway setup |
| Government-friendly | Standard Postgres feature |
| Model columns exist | M1 foundation has worker columns |
| Simpler mental model | Database IS the queue |

### 6.4 Postgres SKIP LOCKED Disadvantages

| Issue | Mitigation |
|-------|------------|
| Implement polling | Simple `setInterval` + SKIP LOCKED |
| Implement retry logic | Use `attempt_count`, `last_attempt_at` |
| Implement heartbeat | Use `heartbeat_at`, check for stale |
| Less real-time | Acceptable for coaching use case |
| No monitoring UI | Database queries sufficient |

---

## 7. Coaching Use Case Characteristics

| Characteristic | Value | Implication |
|----------------|-------|-------------|
| Expected volume | Low (research team) | Don't need Redis throughput |
| Latency tolerance | High (async feedback) | Polling delay acceptable |
| Job duration | ~10-30s (single LLM call) | Short-lived, fits inline |
| Result persistence | Required (coaching_runs) | Postgres state mandatory |
| Failure recovery | Researcher retry | New run, not queue replay |

---

## 8. SKIP LOCKED Implementation Sketch

### 8.1 Claim Pattern

```sql
-- Claim next pending run
UPDATE coaching_runs
SET status = 'running',
    claimed_at = NOW(),
    worker_id = $1
WHERE id = (
  SELECT id FROM coaching_runs
  WHERE status = 'pending'
  ORDER BY requested_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
RETURNING *;
```

### 8.2 Heartbeat Pattern

```sql
-- Update heartbeat for running jobs
UPDATE coaching_runs
SET heartbeat_at = NOW()
WHERE id = $1 AND status = 'running' AND worker_id = $2;
```

### 8.3 Stale Detection

```sql
-- Find stale runs (no heartbeat in 2 minutes)
UPDATE coaching_runs
SET status = 'pending',
    claimed_at = NULL,
    worker_id = NULL,
    attempt_count = attempt_count + 1
WHERE status = 'running'
  AND heartbeat_at < NOW() - INTERVAL '2 minutes';
```

### 8.4 Polling Loop

```typescript
// In-process polling (no separate worker)
setInterval(async () => {
  const run = await claimNextRun(workerId);
  if (run) {
    await processCoachRun(run);
  }
}, 1000); // 1 second poll interval
```

---

## 9. Risk Assessment

### 9.1 Bull/Redis Risks

| Risk | Severity | Likelihood |
|------|----------|------------|
| Redis infrastructure provisioning | Medium | High (currently non-existent) |
| Redis configuration errors | Medium | Medium (multiple env vars) |
| Redis downtime = queue downtime | High | Low (Railway managed) |
| Government deployment rejection | High | Medium (depends on agency) |
| Operational complexity increase | Medium | Certain |

### 9.2 Postgres SKIP LOCKED Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Polling latency | Low | Certain | 1s interval acceptable |
| Stale detection gaps | Medium | Low | 2-minute heartbeat timeout |
| Implementation bugs | Medium | Medium | Comprehensive tests |
| Lock contention | Low | Low | Low volume use case |

---

## 10. Decision Rationale

### 10.1 Why NOT Bull/Redis

1. **Infrastructure not ready:** Redis is non-authoritative, Bull queues disabled
2. **Adds dependency:** Would require Redis provisioning in Railway
3. **Two data stores:** coaching_runs in Postgres, queue in Redis = complexity
4. **Government risk:** VA deployments may restrict Redis
5. **Overkill:** Bull's capabilities exceed coaching needs

### 10.2 Why Postgres SKIP LOCKED

1. **Already there:** Postgres is 100% required, already operational
2. **Model ready:** coaching_runs has all worker columns from M1
3. **Transactional:** Job claim + result write in same transaction
4. **Simple:** No infrastructure changes needed
5. **Portable:** Works in any Postgres deployment
6. **Appropriate:** Matches low-volume, latency-tolerant use case

---

## 11. Recommendation

**USE POSTGRES SKIP LOCKED for Coach M2 job execution.**

### 11.1 Implementation Approach

1. Add polling service that runs in-process (no separate worker)
2. Use `SKIP LOCKED` for concurrent-safe job claiming
3. Use `heartbeat_at` for stale run detection
4. Use `attempt_count` + `last_attempt_at` for retry logic
5. Keep max 3 attempts before permanent failure

### 11.2 Do NOT

- Re-enable Bull/Redis infrastructure
- Add Redis as a required dependency
- Create separate worker process (keep single-process model)
- Over-engineer with job priority or rate limiting (not needed)

### 11.3 Future Considerations

If Qori scales to high-volume use cases requiring:
- Sub-second job dispatch latency
- Distributed workers across multiple processes
- Complex job orchestration (DAGs, dependencies)

Then revisit Bull/Redis. For Coach M2, Postgres SKIP LOCKED is the right choice.

---

## Appendix A: Files Audited

- `backend/src/helpers/queue/indexRepo.queue.js`
- `backend/src/helpers/queue/embededFile.queue.js`
- `backend/src/libs/redis.js`
- `backend/src/middleware/cache.js`
- `backend/src/middleware/session.ts`
- `backend/src/helpers/survey/pendingCsvStore.ts`
- `backend/src/helpers/langchain.ts`
- `backend/src/database/models/coaching_run.ts`
- `backend/src/application/coaching.app-service.ts`
- `backend/docker-compose.yml`
- `backend/Dockerfile`
- `backend/scripts/start.sh`
- `backend/package.json`
- `docs/deployment/redis.md`
- `docs/deployment/configuration.md`

## Appendix B: Verification Queries

```sql
-- Verify SKIP LOCKED support (Postgres 9.5+)
SELECT version();

-- Test SKIP LOCKED syntax
BEGIN;
SELECT id FROM coaching_runs WHERE status = 'pending' FOR UPDATE SKIP LOCKED LIMIT 1;
ROLLBACK;
```
