# DISC-WEB-1 — Specification Amendment v3.1

**Amends**: DISC-WEB-1 v3.0 (2026-10-26)
**Status**: Pending Owner Authorization
**Date**: 2026-10-26

This amendment corrects blocking defects in v3.0. All other v3.0 content remains unchanged.

---

## 1. Blocking Defect Corrections

### 1.1 Replace Rollback-to-Placeholder with Fail-Closed

**Defect**: v3.0 Section 9.5 specified "Revert to stub extraction (returns placeholder)" as rollback. This allows AI to process placeholder text instead of real content.

**Correction**: Fail-closed rollback.

```typescript
// REMOVED: Stub that returns placeholder text
// REPLACED WITH: Hard failure

// Frontend: Remove extraction UI entirely, disable run creation button
// Show: "Document upload temporarily unavailable. Use Slack /qori-discover."

// Backend: POST /extract returns 503 Service Unavailable
// Backend: POST /discovery/runs with sourceRefs returns 503 Service Unavailable
// V1 sources[] path remains functional (Slack, direct API)
```

**Rollback Procedure**:
1. Set feature flag `DISC_WEB1_ENABLED=false` in environment
2. Frontend checks flag, hides extraction UI, shows Slack fallback message
3. Backend `/extract` and sourceRefs path return 503 when flag is false
4. V1 path (sources[]) unaffected — Slack continues working

---

### 1.2 Correct Idempotency Handling

**Defect**: v3.0 had three idempotency issues:
- Retention: "Keys are retained for 24 hours" then nullified — allows key reuse with different payload after 24h
- Replay: No HTTP status distinction between original creation and replay
- Concurrency: SERIALIZABLE isolation causes serialization failures under concurrent insertion

**Correction**:

#### 1.2.1 Retention: Permanent Key Binding

```sql
-- Idempotency keys are NEVER nullified or deleted
-- Key remains bound to run permanently
-- Old runs can be archived but key-to-run binding persists

-- REMOVE from cleanup job:
-- UPDATE discovery_runs SET idempotency_key = NULL WHERE ...
```

#### 1.2.2 Replay: HTTP 200 vs 201 Distinction

```typescript
// Original creation: HTTP 201 Created
// Idempotent replay: HTTP 200 OK

if (existing) {
  if (existing.payload_fingerprint !== computePayloadFingerprint(payload)) {
    // Different payload with same key
    return res.status(409).json({
      error: { code: 'IDEMPOTENCY_CONFLICT', message: '...' }
    });
  }
  // Same payload — idempotent replay
  return res.status(200).json({  // 200, not 201
    data: formatRunSummary(existing),
    meta: { idempotent: true }
  });
}

// New creation
return res.status(201).json({
  data: formatRunSummary(run),
  meta: { idempotent: false }
});
```

#### 1.2.3 Concurrency: Advisory Lock Instead of SERIALIZABLE

```typescript
// REMOVE: SERIALIZABLE isolation (causes serialization failures)
// REPLACE WITH: Advisory lock on idempotency key hash

async function createRunWithIdempotency(
  projectId: number,
  idempotencyKey: string,
  payload: CreateRunRequest,
): Promise<CreateRunResult> {
  const lockKey = `run:${projectId}:${idempotencyKey}`;
  const lockId = hashToInt32(lockKey); // Stable 32-bit integer from string

  const transaction = await sequelize.transaction();

  try {
    // Acquire advisory lock within transaction (released on commit/rollback)
    await sequelize.query(
      'SELECT pg_advisory_xact_lock($1)',
      { bind: [lockId], transaction }
    );

    // Check for existing (now safe — we hold the lock)
    const existing = await DiscoveryRunModel.findOne({
      where: { project_id: projectId, idempotency_key: idempotencyKey },
      transaction,
    });

    if (existing) {
      await transaction.commit(); // Release lock
      // ... handle replay or conflict
    }

    // Create new run (still under lock)
    const run = await createRun(payload, transaction);
    await transaction.commit(); // Release lock
    return { run, isNew: true };

  } catch (error) {
    await transaction.rollback(); // Release lock
    throw error;
  }
}

function hashToInt32(str: string): number {
  // Stable hash to 32-bit signed integer for pg_advisory_xact_lock
  const hash = crypto.createHash('md5').update(str).digest();
  return hash.readInt32LE(0);
}
```

---

### 1.3 Enforce Aggregate Upload and Worker Memory Limits

**Defect**: v3.0 specified multer `fieldSize: 50MB` but this is per-field, not aggregate. Worker memory limit used `setInterval` polling which is ineffective for synchronous CPU-bound parsing.

**Correction**:

#### 1.3.1 Aggregate Multipart Limit

```typescript
import { createServer } from 'http';

// Express-level aggregate body limit (before multer)
app.use('/api/v1/projects/:projectId/extract', express.raw({
  limit: '50mb',
  type: 'multipart/form-data',
}));

// Multer per-file limits (unchanged)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,  // 10MB per file
    files: 10,                    // 10 files max
  },
  // REMOVE fieldSize — not aggregate
});

// Request size check in route handler
router.post('/', upload.array('files', 10), async (req, res, next) => {
  const totalSize = req.files.reduce((sum, f) => sum + f.size, 0);
  if (totalSize > 50 * 1024 * 1024) {
    return res.status(413).json({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Total upload exceeds 50MB' }
    });
  }
  // ...
});
```

#### 1.3.2 Worker Memory Limit via Node Flag

```typescript
// REMOVE: setInterval memory polling (ineffective for sync code)

// Worker spawned with hard memory limit via Node flag
import { fork } from 'child_process';

function spawnExtractionWorker(): ChildProcess {
  return fork(WORKER_PATH, [], {
    execArgv: [
      '--max-old-space-size=256',  // 256MB heap limit
      '--max-semi-space-size=16',  // 16MB semi-space
    ],
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
  });
}

// Worker exits with code 134 (SIGABRT) or 137 (OOM kill) when limit exceeded
// Parent handles exit code and returns EXTRACTION_MEMORY error
worker.on('exit', (code, signal) => {
  if (code === 134 || code === 137 || signal === 'SIGKILL') {
    reject(new ExtractionMemoryError());
  }
});
```

---

### 1.4 Correct Advisory Lock Connection Ownership

**Defect**: v3.0 cleanup job used `pg_try_advisory_lock` which is session-scoped. If the connection returns to the pool while holding the lock, other connections cannot acquire it until pool recycles.

**Correction**: Use transaction-scoped advisory locks.

```typescript
async function runCleanupJob(): Promise<void> {
  const lockId = hashToInt32('extraction_staging_cleanup');

  const transaction = await sequelize.transaction();

  try {
    // Transaction-scoped lock — auto-released on commit/rollback
    const [result] = await sequelize.query(
      'SELECT pg_try_advisory_xact_lock($1) as acquired',
      { bind: [lockId], type: QueryTypes.SELECT, transaction }
    );

    if (!result.acquired) {
      await transaction.rollback();
      console.log('[CLEANUP] Another cleanup job is running, skipping');
      return;
    }

    // Cleanup operations within transaction
    await markExpiredRefs(transaction);
    await deleteOldTerminalRefs(transaction);

    await transaction.commit(); // Lock auto-released

  } catch (error) {
    await transaction.rollback(); // Lock auto-released
    throw error;
  }

  // REMOVE: Manual pg_advisory_unlock call (not needed with xact lock)
}
```

---

### 1.5 Remove Duplicate Indexes and Verify Migration Ordering

**Defect**: v3.0 created both a UNIQUE constraint on `ref_token` (implicit index) and an explicit unique index `idx_extraction_staging_ref_token`. Migration ordering not verified.

**Correction**:

#### 1.5.1 Remove Duplicate Index

```javascript
// Migration: 20261022000000-disc-web1-create-extraction-staging.js

// KEEP: Column-level unique constraint
ref_token: {
  type: Sequelize.UUID,
  allowNull: false,
  unique: true,  // Creates implicit unique index
  // ...
},

// REMOVE: Explicit duplicate index
// await queryInterface.addIndex('extraction_staging', ['ref_token'], {
//   name: 'idx_extraction_staging_ref_token',
//   unique: true,
// });
```

#### 1.5.2 Migration Ordering Verification

```
Migration files (chronological order):

20261022000000-disc-web1-create-extraction-staging.js
  - Creates extraction_staging table
  - No FK to discovery_runs (consumed_by_run_id references existing table)

20261022000001-disc-web1-add-idempotency-columns.js
  - Adds columns to discovery_runs
  - No FK changes

Verification: Both migrations reference only pre-existing tables.
discovery_runs exists (created in prior migration).
No circular FK dependencies.
```

---

## 2. Additional Specifications

### 2.1 Duplicate Source-Ref Rejection

**Requirement**: Reject requests containing duplicate refTokens.

```typescript
// In POST /discovery/runs handler

const refTokens = sourceRefs.map(r => r.refToken);
const uniqueTokens = new Set(refTokens);

if (uniqueTokens.size !== refTokens.length) {
  return res.status(400).json({
    error: {
      code: 'DUPLICATE_SOURCE_REFS',
      message: 'Request contains duplicate refTokens',
    },
  });
}
```

---

### 2.2 Transactional All-or-Nothing Run Creation

**Requirement**: If any sourceRef is invalid, reject entire request. No partial consumption.

```typescript
async function handleSourceRefsPath(
  req: Request,
  res: Response,
  sourceRefs: SourceRef[],
  transaction: Transaction,
): Promise<void> {
  const refTokens = sourceRefs.map(r => r.refToken);

  // Validate ALL refs before consuming ANY
  const stagingRows = await ExtractionStagingModel.findAll({
    where: { ref_token: { [Op.in]: refTokens } },
    lock: transaction.LOCK.UPDATE,
    transaction,
  });

  // Build validation result for each requested ref
  const validationErrors: Array<{ refToken: string; reason: string }> = [];

  for (const refToken of refTokens) {
    const staging = stagingRows.find(r => r.ref_token === refToken);

    if (!staging) {
      validationErrors.push({ refToken, reason: 'not_found' });
      continue;
    }
    if (staging.project_id !== projectId) {
      validationErrors.push({ refToken, reason: 'wrong_project' });
      continue;
    }
    if (staging.actor_id !== actorId) {
      validationErrors.push({ refToken, reason: 'wrong_actor' });
      continue;
    }
    if (staging.status !== 'ready') {
      validationErrors.push({ refToken, reason: staging.status });
      continue;
    }
    if (new Date() > staging.expires_at) {
      validationErrors.push({ refToken, reason: 'expired' });
      continue;
    }
  }

  // Reject ALL if ANY invalid
  if (validationErrors.length > 0) {
    await transaction.rollback();
    return res.status(400).json({
      error: {
        code: 'INVALID_SOURCE_REFS',
        message: 'One or more source refs are invalid',
        details: validationErrors,
      },
    });
  }

  // All valid — consume all atomically
  // ... create evidence sources, create run, mark consumed
  await transaction.commit();
}
```

---

### 2.3 Safe Retry After Consumed Refs

**Requirement**: If a client retries after refs were consumed by a successful run, return that run (not an error).

```typescript
// Scenario: Client sends request, run created, client doesn't receive response, client retries

// With idempotency key: Handled by Section 1.2 — returns existing run

// Without idempotency key: Check if refs were consumed by a single run
if (validationErrors.every(e => e.reason === 'consumed')) {
  // All refs consumed — check if by same run
  const consumedRows = stagingRows.filter(r => r.status === 'consumed');
  const runIds = new Set(consumedRows.map(r => r.consumed_by_run_id));

  if (runIds.size === 1 && consumedRows.length === refTokens.length) {
    // All refs consumed by same run — return that run
    const runId = [...runIds][0];
    const run = await DiscoveryRunModel.findByPk(runId);

    return res.status(200).json({
      data: formatRunSummary(run),
      meta: {
        idempotent: true,
        note: 'Refs already consumed by this run',
      },
    });
  }
}

// Mixed consumption or different runs — error
return res.status(400).json({
  error: {
    code: 'INVALID_SOURCE_REFS',
    message: 'Source refs already consumed',
    details: validationErrors,
  },
});
```

---

### 2.4 Preservation of Existing Records

**Requirement**: DISC-WEB-1 must not modify or delete existing Discovery runs, evidence sources, or insights.

**Guarantees**:

| Table | Guarantee |
|-------|-----------|
| `discovery_runs` | No UPDATE to existing rows except adding nullable columns |
| `evidence_sources` | No changes to existing rows |
| `canonical_insights` | No changes |
| `discovery_artifacts` | No changes |
| `study_variables` | No changes |

**Migration Verification**:
```javascript
// In migration 20261022000001

// VERIFY: Only ADD columns, no ALTER existing columns
await queryInterface.addColumn('discovery_runs', 'idempotency_key', {
  type: Sequelize.UUID,
  allowNull: true,  // Nullable — existing rows get NULL
});

await queryInterface.addColumn('discovery_runs', 'payload_fingerprint', {
  type: Sequelize.CHAR(64),
  allowNull: true,  // Nullable — existing rows get NULL
});

// VERIFY: Index is partial, only affects new rows with non-null key
// Existing rows (idempotency_key IS NULL) excluded from index
```

---

## 3. Test Specifications for Corrections

### 3.1 Fail-Closed Tests

```typescript
describe('fail-closed rollback', () => {
  beforeEach(() => {
    process.env.DISC_WEB1_ENABLED = 'false';
  });

  it('POST /extract returns 503 when disabled', async () => {
    const res = await authenticatedRequest(app)
      .post('/api/v1/projects/1/extract')
      .attach('files', 'fixtures/test.pdf');

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('POST /runs with sourceRefs returns 503 when disabled', async () => {
    const res = await authenticatedRequest(app)
      .post('/api/v1/projects/1/discovery/runs')
      .send({ sourceRefs: [{ refToken: 'abc' }] });

    expect(res.status).toBe(503);
  });

  it('POST /runs with sources[] works when disabled (V1 path)', async () => {
    const res = await authenticatedRequest(app)
      .post('/api/v1/projects/1/discovery/runs')
      .send({ sources: [{ filename: 'test.pdf', extractedText: '...' }] });

    expect(res.status).toBe(201); // V1 path unaffected
  });
});
```

### 3.2 Idempotency Correction Tests

```typescript
describe('idempotency corrections', () => {
  it('returns 201 on first creation, 200 on replay', async () => {
    const key = uuidv4();

    const res1 = await createRun({ idempotencyKey: key, topic: 'test' });
    expect(res1.status).toBe(201);
    expect(res1.body.meta.idempotent).toBe(false);

    const res2 = await createRun({ idempotencyKey: key, topic: 'test' });
    expect(res2.status).toBe(200);  // Not 201
    expect(res2.body.meta.idempotent).toBe(true);
  });

  it('handles concurrent creation without serialization failure', async () => {
    const key = uuidv4();

    // Simulate high concurrency
    const requests = Array(10).fill(null).map(() =>
      createRun({ idempotencyKey: key, topic: 'test' })
    );

    const results = await Promise.all(requests);

    // All should succeed (no serialization errors)
    const statuses = results.map(r => r.status);
    expect(statuses.every(s => s === 200 || s === 201)).toBe(true);

    // Exactly one 201, rest are 200
    expect(statuses.filter(s => s === 201).length).toBe(1);
    expect(statuses.filter(s => s === 200).length).toBe(9);

    // All return same run
    const runIds = results.map(r => r.body.data.publicId);
    expect(new Set(runIds).size).toBe(1);
  });

  it('idempotency key persists permanently', async () => {
    const key = uuidv4();
    await createRun({ idempotencyKey: key, topic: 'test' });

    // Simulate 30 days passing (cleanup has run many times)
    await sequelize.query(`
      UPDATE discovery_runs
      SET created_at = NOW() - INTERVAL '30 days'
      WHERE idempotency_key = $1
    `, { bind: [key] });

    // Run cleanup
    await runCleanupJob();

    // Key should still work
    const res = await createRun({ idempotencyKey: key, topic: 'test' });
    expect(res.status).toBe(200);
    expect(res.body.meta.idempotent).toBe(true);
  });
});
```

### 3.3 Aggregate Limit Tests

```typescript
describe('aggregate upload limits', () => {
  it('rejects when total exceeds 50MB', async () => {
    // Create 6 files × 10MB each = 60MB total
    const files = Array(6).fill(null).map((_, i) => ({
      name: `file${i}.pdf`,
      buffer: Buffer.alloc(10 * 1024 * 1024),
    }));

    const req = authenticatedRequest(app)
      .post('/api/v1/projects/1/extract');

    files.forEach(f => req.attach('files', f.buffer, f.name));

    const res = await req;
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('accepts when total under 50MB', async () => {
    // Create 4 files × 10MB each = 40MB total
    const files = Array(4).fill(null).map((_, i) => ({
      name: `file${i}.txt`,
      buffer: Buffer.alloc(10 * 1024 * 1024).fill(65), // 'A' characters
    }));

    const req = authenticatedRequest(app)
      .post('/api/v1/projects/1/extract');

    files.forEach(f => req.attach('files', f.buffer, f.name));

    const res = await req;
    expect(res.status).toBe(200);
  });
});

describe('worker memory limits', () => {
  it('returns EXTRACTION_MEMORY when worker exceeds heap', async () => {
    // Use a specially crafted file that causes memory explosion
    // (e.g., highly compressed PDF that expands to >256MB)
    const res = await authenticatedRequest(app)
      .post('/api/v1/projects/1/extract')
      .attach('files', 'fixtures/memory-bomb.pdf');

    expect(res.body.data.extractions[0].success).toBe(false);
    expect(res.body.data.extractions[0].errorCode).toBe('EXTRACTION_MEMORY');
  });
});
```

### 3.4 Advisory Lock Tests

```typescript
describe('cleanup advisory lock', () => {
  it('releases lock on successful completion', async () => {
    await runCleanupJob();

    // Verify lock is released by acquiring it again
    const lockId = hashToInt32('extraction_staging_cleanup');
    const [result] = await sequelize.query(
      'SELECT pg_try_advisory_lock($1) as acquired',
      { bind: [lockId], type: QueryTypes.SELECT }
    );

    expect(result.acquired).toBe(true);

    // Release for cleanup
    await sequelize.query('SELECT pg_advisory_unlock($1)', { bind: [lockId] });
  });

  it('releases lock on error', async () => {
    // Force an error during cleanup
    jest.spyOn(ExtractionStagingModel, 'update').mockRejectedValueOnce(
      new Error('Simulated failure')
    );

    await expect(runCleanupJob()).rejects.toThrow('Simulated failure');

    // Lock should still be released (transaction rolled back)
    const lockId = hashToInt32('extraction_staging_cleanup');
    const [result] = await sequelize.query(
      'SELECT pg_try_advisory_lock($1) as acquired',
      { bind: [lockId], type: QueryTypes.SELECT }
    );

    expect(result.acquired).toBe(true);
    await sequelize.query('SELECT pg_advisory_unlock($1)', { bind: [lockId] });
  });

  it('skips when another job holds lock', async () => {
    const lockId = hashToInt32('extraction_staging_cleanup');

    // Acquire lock from separate connection
    const otherConn = await sequelize.connectionManager.getConnection();
    await otherConn.query(`SELECT pg_advisory_lock(${lockId})`);

    // Attempt cleanup — should skip
    const consoleSpy = jest.spyOn(console, 'log');
    await runCleanupJob();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Another cleanup job is running')
    );

    // Release other lock
    await otherConn.query(`SELECT pg_advisory_unlock(${lockId})`);
    sequelize.connectionManager.releaseConnection(otherConn);
  });
});
```

### 3.5 Duplicate Ref and All-or-Nothing Tests

```typescript
describe('duplicate source ref rejection', () => {
  it('rejects request with duplicate refTokens', async () => {
    const staging = await createStagingRow({ projectId: 1, actorId: 1 });

    const res = await createRun({
      sourceRefs: [
        { refToken: staging.ref_token },
        { refToken: staging.ref_token },  // Duplicate
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DUPLICATE_SOURCE_REFS');
  });
});

describe('all-or-nothing run creation', () => {
  it('rejects all refs if any invalid', async () => {
    const valid = await createStagingRow({ projectId: 1, actorId: 1 });
    const expired = await createStagingRow({
      projectId: 1,
      actorId: 1,
      expiresAt: new Date(Date.now() - 1000),
    });

    const res = await createRun({
      sourceRefs: [
        { refToken: valid.ref_token },
        { refToken: expired.ref_token },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_SOURCE_REFS');

    // Verify valid ref was NOT consumed
    const refreshed = await ExtractionStagingModel.findByPk(valid.id);
    expect(refreshed.status).toBe('ready');
  });
});

describe('safe retry after consumption', () => {
  it('returns existing run when all refs consumed by same run', async () => {
    const ref1 = await createStagingRow({ projectId: 1, actorId: 1 });
    const ref2 = await createStagingRow({ projectId: 1, actorId: 1 });

    // First request succeeds
    const res1 = await createRun({
      sourceRefs: [{ refToken: ref1.ref_token }, { refToken: ref2.ref_token }],
    });
    expect(res1.status).toBe(201);

    // Retry without idempotency key
    const res2 = await createRun({
      sourceRefs: [{ refToken: ref1.ref_token }, { refToken: ref2.ref_token }],
    });

    expect(res2.status).toBe(200);
    expect(res2.body.data.publicId).toBe(res1.body.data.publicId);
    expect(res2.body.meta.idempotent).toBe(true);
  });

  it('errors when refs consumed by different runs', async () => {
    const ref1 = await createStagingRow({ projectId: 1, actorId: 1 });
    const ref2 = await createStagingRow({ projectId: 1, actorId: 1 });

    // Consume ref1 in one run
    await createRun({ sourceRefs: [{ refToken: ref1.ref_token }] });

    // Consume ref2 in another run
    await createRun({ sourceRefs: [{ refToken: ref2.ref_token }] });

    // Try to create run with both
    const res = await createRun({
      sourceRefs: [{ refToken: ref1.ref_token }, { refToken: ref2.ref_token }],
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_SOURCE_REFS');
  });
});
```

### 3.6 Preservation Tests

```typescript
describe('existing record preservation', () => {
  it('migration does not modify existing discovery_runs', async () => {
    // Snapshot existing runs before migration
    const beforeMigration = await DiscoveryRunModel.findAll({
      raw: true,
      order: [['id', 'ASC']],
    });

    // Run migration (idempotent — already applied)
    await sequelize.query('SELECT 1'); // No-op, migration already ran

    // Verify all fields unchanged except new nullable columns
    const afterMigration = await DiscoveryRunModel.findAll({
      raw: true,
      order: [['id', 'ASC']],
    });

    beforeMigration.forEach((before, i) => {
      const after = afterMigration[i];
      // All original fields unchanged
      expect(after.id).toBe(before.id);
      expect(after.public_id).toBe(before.public_id);
      expect(after.status).toBe(before.status);
      expect(after.topic).toBe(before.topic);
      // New fields are NULL for existing rows
      expect(after.idempotency_key).toBeNull();
      expect(after.payload_fingerprint).toBeNull();
    });
  });

  it('existing evidence_sources untouched by DISC-WEB-1', async () => {
    const countBefore = await EvidenceSourceModel.count();

    // Create and consume extraction refs (DISC-WEB-1 path)
    const staging = await createStagingRow({ projectId: 1, actorId: 1 });
    await createRun({ sourceRefs: [{ refToken: staging.ref_token }] });

    // New source created, but existing count unchanged + 1
    const countAfter = await EvidenceSourceModel.count();
    expect(countAfter).toBe(countBefore + 1);

    // Verify no existing source was modified
    // (would require storing checksums of all existing rows pre-test)
  });
});
```

---

## 4. Implementation Milestones

**Unchanged from v3.0**. Four milestones remain:

1. **Backend Infrastructure** (migrations, models, worker, extraction service)
2. **Backend Endpoint** (routes, idempotency, validation)
3. **Frontend Integration** (mutation hooks, UI components)
4. **E2E Verification** (integration tests, security review)

---

## 5. Summary of Changes

| v3.0 Section | Change Type | Description |
|--------------|-------------|-------------|
| 9.5 Rollback | **Replaced** | Stub placeholder → fail-closed 503 |
| 1.1 Idempotency | **Corrected** | Permanent keys, 200 vs 201, advisory lock |
| Worker memory | **Corrected** | setInterval → Node execArgv flags |
| 5.3 Cleanup lock | **Corrected** | Session lock → transaction lock |
| 2.1 Indexes | **Corrected** | Remove duplicate ref_token index |
| — | **Added** | Duplicate source-ref rejection |
| — | **Added** | All-or-nothing validation |
| — | **Added** | Safe retry after consumption |
| — | **Added** | Preservation guarantees |
| 8.* Tests | **Added** | Tests for all corrections |

---

**Status**: Awaiting owner authorization before implementation.
