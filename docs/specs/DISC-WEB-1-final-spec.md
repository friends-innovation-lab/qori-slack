# DISC-WEB-1 — Final Implementation Specification

**Version**: 3.0 (Contractor-Ready)
**Status**: Pending Owner Authorization
**Date**: 2026-10-26

---

## Table of Contents

1. [Blocking Issues Resolution](#1-blocking-issues-resolution)
2. [Database Schema](#2-database-schema)
3. [API Contracts](#3-api-contracts)
4. [Algorithms](#4-algorithms)
5. [Security Controls](#5-security-controls)
6. [Backward Compatibility](#6-backward-compatibility)
7. [Implementation Milestones](#7-implementation-milestones)
8. [Test Specifications](#8-test-specifications)
9. [Prerequisites](#9-prerequisites)

---

## 1. Blocking Issues Resolution

### 1.1 Idempotent Run Creation

**Problem**: Retry of run creation could duplicate Discovery runs.

**Solution**: Request-level idempotency key with payload fingerprint validation.

**Idempotency Key**:
```
X-Idempotency-Key: <client-generated-uuid>
```

**Uniqueness Constraint**:
```sql
-- Partial unique index on discovery_runs
CREATE UNIQUE INDEX idx_discovery_runs_idempotency_key
ON discovery_runs (project_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;
```

**Payload Fingerprint**:
```typescript
// SHA-256 of normalized payload (sorted keys, trimmed strings)
function computePayloadFingerprint(payload: CreateRunRequest): string {
  const normalized = {
    discoveryType: payload.discoveryType,
    topic: payload.topic.trim().toLowerCase(),
    sourceRefs: [...payload.sourceRefs].sort((a, b) => a.refToken.localeCompare(b.refToken)),
  };
  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}
```

**Transaction Boundaries**:
```typescript
// SELECT FOR UPDATE to prevent race conditions
const transaction = await sequelize.transaction({
  isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
});

try {
  // 1. Check for existing run with same idempotency key
  const existing = await DiscoveryRunModel.findOne({
    where: { project_id: projectId, idempotency_key: idempotencyKey },
    lock: transaction.LOCK.UPDATE,
    transaction,
  });

  if (existing) {
    // Validate payload fingerprint matches
    if (existing.payload_fingerprint !== computePayloadFingerprint(payload)) {
      throw new IdempotencyConflictError(
        'Idempotency key reused with different payload'
      );
    }
    // Return existing run (same response as original creation)
    await transaction.commit();
    return { data: formatRunSummary(existing), idempotent: true };
  }

  // 2. Validate and consume staging refs (with FOR UPDATE)
  const stagingRows = await ExtractionStagingModel.findAll({
    where: {
      ref_token: { [Op.in]: refTokens },
      project_id: projectId,
      status: 'ready',
      expires_at: { [Op.gt]: new Date() },
    },
    lock: transaction.LOCK.UPDATE,
    transaction,
  });

  // 3. Create evidence sources from staging
  // 4. Create discovery run
  // 5. Mark staging rows consumed
  // 6. Commit

  await transaction.commit();
  return { data: formatRunSummary(run), idempotent: false };
} catch (error) {
  await transaction.rollback();
  throw error;
}
```

**Same-Key Replay Behavior**:
- If `idempotency_key` exists AND `payload_fingerprint` matches → return existing run (HTTP 200, `idempotent: true`)
- If `idempotency_key` exists AND `payload_fingerprint` differs → HTTP 409 Conflict

**Idempotency Key Expiry**:
- Keys are retained for 24 hours after run creation
- Cleanup job nullifies `idempotency_key` after 24h (preserves run, allows key reuse)

---

### 1.2 Enforceable Parser Isolation

**Problem**: `Promise.race` and `AbortController` cannot terminate CPU-bound parsing.

**Solution**: Child process workers with hard kill.

**Architecture**:
```
Main Process                    Worker Pool (3 workers)
┌────────────────────┐          ┌────────────────────┐
│ Express /extract   │          │ Worker 1 (fork)    │
│ endpoint           │◀────────▶│ - pdf-parse        │
│                    │   IPC    │ - mammoth          │
│ Request queue      │          │ - timeout: 30s     │
│ Concurrency: 3     │          │ - memory: 256MB    │
└────────────────────┘          └────────────────────┘
                                ┌────────────────────┐
                                │ Worker 2 (fork)    │
                                └────────────────────┘
                                ┌────────────────────┐
                                │ Worker 3 (fork)    │
                                └────────────────────┘
```

**Worker Process**:
```typescript
// extraction-worker.ts (runs as child process)
import { parentPort, workerData } from 'worker_threads';
// OR use child_process.fork for true process isolation

process.on('message', async (message: ExtractRequest) => {
  try {
    const result = await extractFile(message.buffer, message.mimeType);
    process.send!({ success: true, ...result });
  } catch (error) {
    process.send!({ success: false, error: error.message });
  }
});

// Memory limit enforcement
const MEMORY_LIMIT = 256 * 1024 * 1024; // 256MB
setInterval(() => {
  if (process.memoryUsage().heapUsed > MEMORY_LIMIT) {
    process.exit(137); // OOM kill code
  }
}, 1000);
```

**Hard Kill Enforcement**:
```typescript
// extraction.service.ts
async function extractWithIsolation(
  buffer: Buffer,
  mimeType: string,
  timeoutMs: number = 30000,
): Promise<ExtractionResult> {
  const worker = fork(WORKER_PATH);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      worker.kill('SIGKILL'); // Hard kill
      reject(new ExtractionTimeoutError());
    }, timeoutMs);

    worker.on('message', (result: WorkerResult) => {
      clearTimeout(timeout);
      worker.kill();
      if (result.success) {
        resolve(result);
      } else {
        reject(new ExtractionError(result.error));
      }
    });

    worker.on('exit', (code) => {
      clearTimeout(timeout);
      if (code === 137) {
        reject(new ExtractionMemoryError());
      }
    });

    worker.send({ buffer, mimeType });
  });
}
```

**Concurrency Control**:
```typescript
// Semaphore for concurrent extractions per project
const projectSemaphores = new Map<number, Semaphore>();

function getProjectSemaphore(projectId: number): Semaphore {
  if (!projectSemaphores.has(projectId)) {
    projectSemaphores.set(projectId, new Semaphore(3)); // 3 concurrent per project
  }
  return projectSemaphores.get(projectId)!;
}

// Global extraction semaphore
const globalSemaphore = new Semaphore(10); // 10 concurrent total
```

**Multipart Size Enforcement** (multer):
```typescript
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,      // 10MB per file
    files: 10,                        // 10 files max
    fieldSize: 50 * 1024 * 1024,     // 50MB total
  },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new UnsupportedFileTypeError(file.mimetype));
    }
  },
});
```

**DOCX Decompression Limits**:
```typescript
// mammoth does not expose zip limits directly
// Enforce via:
// 1. Pre-extraction file size check (10MB)
// 2. Worker memory limit (256MB)
// 3. Worker timeout (30s)
// 4. Post-extraction text size check (2M chars)

async function extractDocx(buffer: Buffer): Promise<string> {
  // Pre-check
  if (buffer.length > 10 * 1024 * 1024) {
    throw new FileTooLargeError();
  }

  const result = await mammoth.extractRawText({ buffer });
  const text = result.value;

  // Post-check
  if (text.length > 2_000_000) {
    throw new ContentTooLargeError();
  }

  return text;
}
```

---

### 1.3 Evidence Lifecycle

**Problem**: Ensure provenance is preserved and extracted text isn't purged before worker finishes.

**Solution**: Explicit provenance fields + consumption-based purge.

**Evidence Source Provenance** (persisted in `artifact_ref`):
```typescript
interface ArtifactRef {
  filename: string;
  file_hash: string;        // SHA-256 of original file bytes (64 chars)
  content_hash: string;     // SHA-256 of extracted text (64 chars)
  mime_type: string;
  size_bytes: number;
  // Original file bytes are NOT stored - re-verification is NOT possible
}
```

**Extraction Staging to Evidence Source Flow**:
```
extraction_staging                    evidence_sources
┌─────────────────────┐              ┌─────────────────────────────┐
│ file_hash           │───────────▶  │ artifact_ref.file_hash      │
│ content_hash        │───────────▶  │ artifact_ref.content_hash   │
│ filename            │───────────▶  │ artifact_ref.filename       │
│ mime_type           │───────────▶  │ artifact_ref.mime_type      │
│ file_size_bytes     │───────────▶  │ artifact_ref.size_bytes     │
│ extracted_text      │───────────▶  │ metadata.extracted_text     │
│ ref_token           │───────────▶  │ metadata.extraction_ref     │
└─────────────────────┘              └─────────────────────────────┘
```

**Purge Timing** (existing behavior, unchanged):
```
Run Status     │ Extracted Text Status
───────────────┼───────────────────────
pending        │ RETAINED (in metadata)
processing     │ RETAINED (worker using)
completed      │ PURGED (purgePreparedSourceContent)
failed         │ PURGED (purgePreparedSourceContent)
cancelled      │ PURGED (purgePreparedSourceContent)
```

**Purge Safety** (existing `purgePreparedSourceContent`):
- Only purges if no other non-terminal run references the source
- Preserves all other metadata fields
- Idempotent

**Re-verification Statement**:
```
EXPLICIT LIMITATION: Original file bytes are discarded after extraction.
Re-verification of file_hash against original content is NOT possible.
file_hash serves as:
  1. Deduplication key (detect same file uploaded twice)
  2. Audit record (provenance of extraction)
  3. Correlation (link multiple runs to same source document)
```

---

### 1.4 Backward Compatibility

**Problem**: Must not break existing Slack and API ingestion paths.

**Solution**: Additive changes only. New endpoint, optional field on existing endpoint.

**Existing Paths (UNCHANGED)**:

| Path | Behavior | Change |
|------|----------|--------|
| Slack `/qori-discover` | Calls `executeDiscovery()` with documents | No change |
| `POST /discovery/runs` with `sources[]` | Creates run with pre-extracted text | No change |

**New Path (ADDITIVE)**:

| Path | Behavior |
|------|----------|
| `POST /projects/:id/extract` | Extract files, return refs |
| `POST /discovery/runs` with `sourceRefs[]` | Consume refs, create run |

**API Contract Changes**:

```typescript
// EXISTING (preserved, unchanged)
interface CreateRunRequestV1 {
  discoveryType: 'desk_research' | 'stakeholder_synthesis';
  topic: string;
  sourceIntent?: string;
  sources: PreparedDiscoverySource[];  // Direct text
}

// NEW (additive)
interface CreateRunRequestV2 {
  discoveryType: 'desk_research' | 'stakeholder_synthesis';
  topic: string;
  sourceIntent?: string;
  sourceRefs: Array<{ refToken: string }>;  // Server-bound refs
}

// Endpoint accepts EITHER sources OR sourceRefs, not both
// Validation: exactly one of sources/sourceRefs must be present
```

**Request Validation**:
```typescript
// In discovery.routes.ts POST /runs handler
const { sources, sourceRefs } = req.body;

const hasSources = Array.isArray(sources) && sources.length > 0;
const hasSourceRefs = Array.isArray(sourceRefs) && sourceRefs.length > 0;

if (hasSources && hasSourceRefs) {
  return res.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Cannot specify both sources and sourceRefs. Use one or the other.',
    },
  });
}

if (!hasSources && !hasSourceRefs) {
  return res.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Either sources or sourceRefs is required.',
    },
  });
}

if (hasSources) {
  // Existing V1 path (Slack, direct API)
  return handleDirectSourcesPath(req, res, sources);
}

// New V2 path (Workspace)
return handleSourceRefsPath(req, res, sourceRefs);
```

---

## 2. Database Schema

### 2.1 New Table: `extraction_staging`

**Migration**: `20261022000000-disc-web1-create-extraction-staging.js`

```javascript
'use strict';

/**
 * Migration: DISC-WEB-1 — Create extraction_staging table
 *
 * Server-bound extraction references for Workspace document upload.
 * Refs are project-scoped, actor-owned, single-use, and time-limited.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('extraction_staging', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      ref_token: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        comment: 'Single-use reference token for consumption by run creation',
      },

      // Scope (FK naming per repository convention)
      project_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'projects', key: 'id' },
        onDelete: 'CASCADE',
        comment: 'Project scope — ref only usable in this project',
      },
      actor_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'actors', key: 'id' },
        onDelete: 'CASCADE',
        comment: 'Actor ownership — only this actor can consume the ref',
      },

      // File metadata
      filename: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      mime_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      file_size_bytes: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      // Dual hashes (server-computed, immutable)
      file_hash: {
        type: Sequelize.CHAR(64),
        allowNull: false,
        comment: 'SHA-256 of original file bytes',
      },
      content_hash: {
        type: Sequelize.CHAR(64),
        allowNull: false,
        comment: 'SHA-256 of extracted text UTF-8 bytes',
      },

      // Extracted content
      extracted_text: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      char_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      // Lifecycle
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'ready',
        comment: 'ready | consumed | expired | failed',
      },
      consumed_by_run_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'discovery_runs', key: 'id' },
        onDelete: 'SET NULL',
        comment: 'FK to discovery run that consumed this ref',
      },

      // Timestamps
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP + INTERVAL '30 minutes'"),
      },
      consumed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // Domain value check for status
    await queryInterface.sequelize.query(`
      ALTER TABLE extraction_staging
      ADD CONSTRAINT chk_extraction_staging_status
      CHECK (status IN ('ready', 'consumed', 'expired', 'failed'))
    `);

    // Expiry constraint
    await queryInterface.sequelize.query(`
      ALTER TABLE extraction_staging
      ADD CONSTRAINT chk_extraction_staging_expiry
      CHECK (expires_at > created_at)
    `);

    // Indexes
    await queryInterface.addIndex('extraction_staging', ['project_id', 'status'], {
      name: 'idx_extraction_staging_project_status',
    });
    await queryInterface.addIndex('extraction_staging', ['actor_id'], {
      name: 'idx_extraction_staging_actor',
    });
    await queryInterface.addIndex('extraction_staging', ['expires_at'], {
      name: 'idx_extraction_staging_expires',
      where: { status: 'ready' },
    });
    await queryInterface.addIndex('extraction_staging', ['ref_token'], {
      name: 'idx_extraction_staging_ref_token',
      unique: true,
    });

    console.log('Created extraction_staging table for DISC-WEB-1');
  },

  async down(queryInterface) {
    await queryInterface.dropTable('extraction_staging');
    console.log('Dropped extraction_staging table');
  },
};
```

### 2.2 Alter Table: `discovery_runs`

**Migration**: `20261022000001-disc-web1-add-idempotency-columns.js`

```javascript
'use strict';

/**
 * Migration: DISC-WEB-1 — Add idempotency columns to discovery_runs
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('discovery_runs', 'idempotency_key', {
      type: Sequelize.UUID,
      allowNull: true,
      comment: 'Client-provided idempotency key (nullable for legacy runs)',
    });

    await queryInterface.addColumn('discovery_runs', 'payload_fingerprint', {
      type: Sequelize.CHAR(64),
      allowNull: true,
      comment: 'SHA-256 of normalized request payload for conflict detection',
    });

    // Partial unique index for idempotency
    await queryInterface.addIndex('discovery_runs', ['project_id', 'idempotency_key'], {
      name: 'idx_discovery_runs_idempotency',
      unique: true,
      where: { idempotency_key: { [Sequelize.Op.ne]: null } },
    });

    console.log('Added idempotency columns to discovery_runs for DISC-WEB-1');
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('discovery_runs', 'idx_discovery_runs_idempotency');
    await queryInterface.removeColumn('discovery_runs', 'payload_fingerprint');
    await queryInterface.removeColumn('discovery_runs', 'idempotency_key');
    console.log('Removed idempotency columns from discovery_runs');
  },
};
```

---

## 3. API Contracts

### 3.1 `POST /api/v1/projects/:projectId/extract`

**Authorization**: `requireAuth` + `assertProjectResearcherByActor`

**Rate Limit**: AI tier (20 req/min)

**Request**:
```http
POST /api/v1/projects/12/extract
Content-Type: multipart/form-data
X-CSRF-Token: abc123

--boundary
Content-Disposition: form-data; name="files"; filename="report.pdf"
Content-Type: application/pdf

<binary data>
--boundary
Content-Disposition: form-data; name="files"; filename="notes.txt"
Content-Type: text/plain

<text data>
--boundary--
```

**Response (200 OK)**:
```json
{
  "data": {
    "extractions": [
      {
        "refToken": "550e8400-e29b-41d4-a716-446655440000",
        "filename": "report.pdf",
        "mimeType": "application/pdf",
        "fileSizeBytes": 1048576,
        "fileHash": "a1b2c3d4e5f6...64 chars",
        "contentHash": "f6e5d4c3b2a1...64 chars",
        "charCount": 45000,
        "success": true,
        "expiresAt": "2026-10-26T15:30:00.000Z"
      },
      {
        "filename": "encrypted.pdf",
        "success": false,
        "errorCode": "ENCRYPTED_PDF",
        "errorMessage": "PDF is password-protected. Please provide an unencrypted version."
      }
    ],
    "successCount": 1,
    "failureCount": 1,
    "expiresAt": "2026-10-26T15:30:00.000Z"
  }
}
```

**Error Codes**:

| Code | HTTP | Description |
|------|------|-------------|
| `UNSUPPORTED_FILE_TYPE` | 200 (partial) | Not in allowlist |
| `FILE_TOO_LARGE` | 200 (partial) | >10MB |
| `ENCRYPTED_PDF` | 200 (partial) | Password-protected |
| `SCANNED_PDF` | 200 (partial) | No text layer |
| `EMPTY_CONTENT` | 200 (partial) | <50 chars extracted |
| `EXTRACTION_TIMEOUT` | 200 (partial) | >30s |
| `EXTRACTION_MEMORY` | 200 (partial) | >256MB worker memory |
| `EXTRACTION_FAILED` | 200 (partial) | Parser error |
| `PAYLOAD_TOO_LARGE` | 413 | >50MB total |
| `UNAUTHORIZED` | 401 | No session |
| `FORBIDDEN` | 403 | Not project researcher |

### 3.2 `POST /api/v1/projects/:projectId/discovery/runs` (V2 Path)

**Request with sourceRefs**:
```http
POST /api/v1/projects/12/discovery/runs
Content-Type: application/json
X-CSRF-Token: abc123
X-Idempotency-Key: 660e8400-e29b-41d4-a716-446655440001

{
  "discoveryType": "desk_research",
  "topic": "Veteran telehealth adoption barriers",
  "sourceIntent": "Understanding current barriers",
  "sourceRefs": [
    { "refToken": "550e8400-e29b-41d4-a716-446655440000" }
  ]
}
```

**Response (201 Created)**:
```json
{
  "data": {
    "publicId": "770e8400-e29b-41d4-a716-446655440002",
    "discoveryType": "desk_research",
    "topic": "Veteran telehealth adoption barriers",
    "status": "pending",
    "sourceCount": 1,
    "createdAt": "2026-10-26T15:00:00.000Z"
  },
  "meta": {
    "idempotent": false,
    "pollUrl": "/api/v1/projects/12/discovery/runs/770e8400-e29b-41d4-a716-446655440002",
    "recommendedPollInterval": "2000ms"
  }
}
```

**Error Codes** (sourceRefs path):

| Code | HTTP | Description |
|------|------|-------------|
| `INVALID_SOURCE_REFS` | 400 | One or more refs invalid/expired/consumed |
| `NO_VALID_SOURCES` | 400 | Zero valid refs provided |
| `IDEMPOTENCY_CONFLICT` | 409 | Key reused with different payload |

---

## 4. Algorithms

### 4.1 File Hash Algorithm

```typescript
function computeFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
// Returns 64-character lowercase hex string
```

### 4.2 Content Hash Algorithm

```typescript
function computeContentHash(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}
// Returns 64-character lowercase hex string
```

### 4.3 Payload Fingerprint Algorithm

```typescript
function computePayloadFingerprint(payload: CreateRunRequest): string {
  const normalized = {
    discoveryType: payload.discoveryType,
    topic: payload.topic.trim().toLowerCase(),
    sourceIntent: (payload.sourceIntent || '').trim().toLowerCase(),
    sourceRefs: payload.sourceRefs
      .map(r => r.refToken.toLowerCase())
      .sort(),
  };
  return crypto.createHash('sha256')
    .update(JSON.stringify(normalized))
    .digest('hex');
}
```

### 4.4 Empty/Scanned PDF Detection

```typescript
async function detectPdfContent(buffer: Buffer): Promise<PdfContentAnalysis> {
  const data = await pdfParse(buffer);
  const text = data.text.trim();

  if (data.numpages === 0) {
    return { type: 'empty', reason: 'PDF has zero pages' };
  }

  if (text.length === 0) {
    return { type: 'scanned', reason: 'PDF has images only, no text layer' };
  }

  if (text.length < 50) {
    return { type: 'insufficient', reason: 'PDF has insufficient text (<50 chars)' };
  }

  return { type: 'valid', text };
}
```

---

## 5. Security Controls

### 5.1 Authorization Matrix

| Endpoint | Auth | Project Role | CSRF |
|----------|------|--------------|------|
| `POST /extract` | requireAuth | Researcher+ | Yes |
| `POST /discovery/runs` (V1) | requireAuth | Researcher+ | Yes |
| `POST /discovery/runs` (V2) | requireAuth | Researcher+ | Yes |

### 5.2 Ref Validation Checklist

```typescript
async function validateSourceRef(
  refToken: string,
  projectId: number,
  actorId: number,
): Promise<ValidationResult> {
  const staging = await ExtractionStagingModel.findOne({
    where: { ref_token: refToken },
  });

  if (!staging) {
    return { valid: false, reason: 'not_found' };
  }

  if (staging.project_id !== projectId) {
    return { valid: false, reason: 'wrong_project' };
  }

  if (staging.actor_id !== actorId) {
    return { valid: false, reason: 'wrong_actor' };
  }

  if (staging.status !== 'ready') {
    return { valid: false, reason: staging.status === 'consumed' ? 'consumed' : 'expired' };
  }

  if (new Date() > staging.expires_at) {
    return { valid: false, reason: 'expired' };
  }

  return { valid: true, staging };
}
```

### 5.3 Cleanup Concurrency Safeguards

```typescript
// Cleanup job runs with advisory lock to prevent concurrent execution
async function runCleanupJob(): Promise<void> {
  const lockKey = 'extraction_staging_cleanup';

  // Try to acquire advisory lock (non-blocking)
  const [lockResult] = await sequelize.query(
    `SELECT pg_try_advisory_lock(hashtext(:lockKey)) as acquired`,
    { replacements: { lockKey }, type: QueryTypes.SELECT }
  );

  if (!lockResult.acquired) {
    console.log('[CLEANUP] Another cleanup job is running, skipping');
    return;
  }

  try {
    // 1. Mark expired refs
    await sequelize.query(`
      UPDATE extraction_staging
      SET status = 'expired'
      WHERE status = 'ready' AND expires_at < NOW()
    `);

    // 2. Delete old terminal refs (>24h)
    await sequelize.query(`
      DELETE FROM extraction_staging
      WHERE (status IN ('expired', 'failed') AND created_at < NOW() - INTERVAL '24 hours')
         OR (status = 'consumed' AND consumed_at < NOW() - INTERVAL '24 hours')
    `);

    // 3. Nullify old idempotency keys
    await sequelize.query(`
      UPDATE discovery_runs
      SET idempotency_key = NULL
      WHERE idempotency_key IS NOT NULL
        AND created_at < NOW() - INTERVAL '24 hours'
    `);
  } finally {
    // Release advisory lock
    await sequelize.query(
      `SELECT pg_advisory_unlock(hashtext(:lockKey))`,
      { replacements: { lockKey } }
    );
  }
}
```

---

## 6. Backward Compatibility

### 6.1 Existing Paths (No Changes)

| Path | Consumer | Status |
|------|----------|--------|
| Slack `/qori-discover` | Slack handler | Unchanged |
| `POST /runs` with `sources[]` | API clients | Unchanged |
| Poller `executeDiscoveryRun` | Worker | Unchanged |
| `purgePreparedSourceContent` | Claim service | Unchanged |

### 6.2 Version Detection

```typescript
// In discovery.routes.ts
function isV2Request(body: any): boolean {
  return Array.isArray(body.sourceRefs) && body.sourceRefs.length > 0;
}

function isV1Request(body: any): boolean {
  return Array.isArray(body.sources) && body.sources.length > 0;
}
```

### 6.3 Response Compatibility

Both V1 and V2 paths return the same `DiscoveryRunSummary` shape. The only addition is `meta.idempotent` for V2.

---

## 7. Implementation Milestones

### Milestone 1: Backend Infrastructure (Est. 2 days)

| Task | File | Description |
|------|------|-------------|
| 1.1 | `package.json` | Add `multer@2.5.0`, `mammoth@1.13.0` |
| 1.2 | `migrations/20261022000000-*.js` | Create `extraction_staging` table |
| 1.3 | `migrations/20261022000001-*.js` | Add idempotency columns to `discovery_runs` |
| 1.4 | `models/extraction_staging.ts` | Sequelize model |
| 1.5 | `services/extraction-staging.service.ts` | CRUD operations |
| 1.6 | `services/extraction-worker.ts` | Child process worker |
| 1.7 | `services/extraction.service.ts` | PDF/DOCX/TXT extractors |
| 1.8 | `__tests__/unit/extraction.service.test.ts` | Unit tests |

### Milestone 2: Backend Endpoint (Est. 2 days)

| Task | File | Description |
|------|------|-------------|
| 2.1 | `routes/api/v1/extract.routes.ts` | POST /extract endpoint |
| 2.2 | `routes/api/v1/index.ts` | Wire extract routes |
| 2.3 | `routes/api/v1/discovery.routes.ts` | Add V2 sourceRefs path |
| 2.4 | `services/discovery-run.service.ts` | Add idempotency logic |
| 2.5 | `__tests__/integration/extraction-staging.test.ts` | Integration tests |
| 2.6 | `__tests__/integration/discovery-idempotency.test.ts` | Idempotency tests |

### Milestone 3: Frontend Integration (Est. 2 days)

| Task | File | Description |
|------|------|-------------|
| 3.1 | `api/mutations/useExtractFiles.ts` | Extraction mutation hook |
| 3.2 | `pages/discovery/DeskIntake.tsx` | Replace stub with extraction |
| 3.3 | `pages/discovery/StakeholderIntake.tsx` | Replace stub with extraction |
| 3.4 | `components/discovery/PartialFailureModal.tsx` | Confirmation modal |
| 3.5 | `__tests__/DeskIntake.test.tsx` | Frontend tests |

### Milestone 4: E2E Verification (Est. 1 day)

| Task | File | Description |
|------|------|-------------|
| 4.1 | `__tests__/integration/disc-web1-e2e.test.ts` | PDF → insight test |
| 4.2 | `__tests__/integration/disc-web1-e2e.test.ts` | DOCX → insight test |
| 4.3 | `__tests__/integration/disc-web1-e2e.test.ts` | Encrypted PDF blocks AI |
| 4.4 | `__tests__/integration/disc-web1-e2e.test.ts` | Partial failure confirmation |
| 4.5 | Security review | Manual review |

---

## 8. Test Specifications

### 8.1 Unit Tests

```typescript
// extraction.service.test.ts

describe('PDF extraction', () => {
  it('extracts text from valid PDF', async () => {
    const buffer = fs.readFileSync('fixtures/valid.pdf');
    const result = await extractPdf(buffer);
    expect(result.success).toBe(true);
    expect(result.text.length).toBeGreaterThan(50);
  });

  it('rejects encrypted PDF with ENCRYPTED_PDF code', async () => {
    const buffer = fs.readFileSync('fixtures/encrypted.pdf');
    const result = await extractPdf(buffer);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('ENCRYPTED_PDF');
  });

  it('rejects scanned PDF with SCANNED_PDF code', async () => {
    const buffer = fs.readFileSync('fixtures/scanned.pdf');
    const result = await extractPdf(buffer);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('SCANNED_PDF');
  });

  it('rejects empty PDF with EMPTY_CONTENT code', async () => {
    const buffer = fs.readFileSync('fixtures/empty.pdf');
    const result = await extractPdf(buffer);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('EMPTY_CONTENT');
  });
});

describe('hash computation', () => {
  it('computes file hash as 64-char hex', () => {
    const buffer = Buffer.from('test content');
    const hash = computeFileHash(buffer);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('computes content hash as 64-char hex', () => {
    const text = 'extracted text content';
    const hash = computeContentHash(text);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces different hashes for file vs content', () => {
    const original = Buffer.from('binary content here');
    const extracted = 'extracted text only';
    expect(computeFileHash(original)).not.toBe(computeContentHash(extracted));
  });
});
```

### 8.2 Integration Tests

```typescript
// extraction-staging.test.ts

describe('extraction staging lifecycle', () => {
  it('creates staging row with correct scope', async () => {
    const staging = await createStagingRow({
      projectId: 1,
      actorId: 1,
      filename: 'test.pdf',
      // ...
    });

    expect(staging.project_id).toBe(1);
    expect(staging.actor_id).toBe(1);
    expect(staging.status).toBe('ready');
  });

  it('rejects ref from wrong project', async () => {
    const staging = await createStagingRow({ projectId: 1, actorId: 1 });

    const result = await validateSourceRef(staging.ref_token, 2, 1);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('wrong_project');
  });

  it('rejects ref from wrong actor', async () => {
    const staging = await createStagingRow({ projectId: 1, actorId: 1 });

    const result = await validateSourceRef(staging.ref_token, 1, 2);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('wrong_actor');
  });

  it('rejects expired ref', async () => {
    const staging = await createStagingRow({
      projectId: 1,
      actorId: 1,
      expiresAt: new Date(Date.now() - 1000), // Expired
    });

    const result = await validateSourceRef(staging.ref_token, 1, 1);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('expired');
  });

  it('rejects consumed ref', async () => {
    const staging = await createStagingRow({ projectId: 1, actorId: 1 });
    await consumeStagingRow(staging.id, runId);

    const result = await validateSourceRef(staging.ref_token, 1, 1);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('consumed');
  });
});

// discovery-idempotency.test.ts

describe('run creation idempotency', () => {
  it('returns existing run on same idempotency key + payload', async () => {
    const res1 = await createRun({ idempotencyKey: 'key1', topic: 'test' });
    const res2 = await createRun({ idempotencyKey: 'key1', topic: 'test' });

    expect(res1.body.data.publicId).toBe(res2.body.data.publicId);
    expect(res2.body.meta.idempotent).toBe(true);
  });

  it('returns 409 on same key + different payload', async () => {
    await createRun({ idempotencyKey: 'key2', topic: 'test1' });
    const res2 = await createRun({ idempotencyKey: 'key2', topic: 'test2' });

    expect(res2.status).toBe(409);
    expect(res2.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('never duplicates run on retry', async () => {
    const key = 'concurrent-key';

    // Simulate concurrent requests
    const [res1, res2] = await Promise.all([
      createRun({ idempotencyKey: key, topic: 'test' }),
      createRun({ idempotencyKey: key, topic: 'test' }),
    ]);

    // Both should succeed with same run ID
    expect(res1.body.data.publicId).toBe(res2.body.data.publicId);

    // Only one run should exist
    const runs = await countRunsWithKey(key);
    expect(runs).toBe(1);
  });
});
```

### 8.3 Security Tests

```typescript
// security.test.ts

describe('extraction endpoint security', () => {
  it('requires authentication', async () => {
    const res = await request(app)
      .post('/api/v1/projects/1/extract')
      .attach('files', 'fixtures/test.pdf');

    expect(res.status).toBe(401);
  });

  it('requires CSRF token', async () => {
    const res = await authenticatedRequest(app)
      .post('/api/v1/projects/1/extract')
      .attach('files', 'fixtures/test.pdf');
    // No X-CSRF-Token header

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_VALIDATION_FAILED');
  });

  it('requires researcher role', async () => {
    const res = await authenticatedRequest(app, { role: 'viewer' })
      .post('/api/v1/projects/1/extract')
      .set('X-CSRF-Token', csrfToken)
      .attach('files', 'fixtures/test.pdf');

    expect(res.status).toBe(403);
  });

  it('enforces rate limit', async () => {
    // Send 21 requests (limit is 20/min)
    for (let i = 0; i < 21; i++) {
      const res = await authenticatedRequest(app)
        .post('/api/v1/projects/1/extract')
        .set('X-CSRF-Token', csrfToken)
        .attach('files', 'fixtures/small.txt');

      if (i === 20) {
        expect(res.status).toBe(429);
      }
    }
  });

  it('rejects .doc files', async () => {
    const res = await authenticatedRequest(app)
      .post('/api/v1/projects/1/extract')
      .set('X-CSRF-Token', csrfToken)
      .attach('files', 'fixtures/legacy.doc');

    expect(res.body.data.extractions[0].success).toBe(false);
    expect(res.body.data.extractions[0].errorCode).toBe('UNSUPPORTED_FILE_TYPE');
  });
});
```

---

## 9. Prerequisites

### 9.1 Dependencies (Verified)

| Package | Version | Node Compat | Security |
|---------|---------|-------------|----------|
| `pdf-parse` | 1.1.1 (installed) | ≥6.8.1 | No CVEs |
| `multer` | 2.5.0 (to add) | ≥10.16.0 | No CVEs |
| `mammoth` | 1.13.0 (to add) | ≥12.0.0 | No CVEs |

### 9.2 Test Fixtures Required

| Fixture | Purpose |
|---------|---------|
| `fixtures/valid.pdf` | Multi-page PDF with text |
| `fixtures/encrypted.pdf` | Password-protected PDF |
| `fixtures/scanned.pdf` | Image-only PDF (no text layer) |
| `fixtures/empty.pdf` | Zero-content PDF |
| `fixtures/valid.docx` | DOCX with text content |
| `fixtures/small.txt` | Plain text file |
| `fixtures/legacy.doc` | Legacy .doc file (rejected) |

### 9.3 Environment Variables (No New Required)

The implementation uses existing environment variables only:
- `NODE_ENV`
- `DATABASE_URL`
- Standard Express/Sequelize config

### 9.4 Deployment Order

1. Deploy migration (creates table)
2. Deploy backend code
3. Deploy frontend code
4. Run smoke test in dev
5. Monitor for 24h before prod

### 9.5 Rollback Plan

If issues arise:
1. Frontend: Revert to stub extraction (returns placeholder)
2. Backend: `POST /discovery/runs` V1 path continues working
3. Migration: Not reversible (table created), but harmless if unused

---

## Summary

**Blocking Issues Resolved**:
1. Idempotent run creation via X-Idempotency-Key + payload fingerprint + SELECT FOR UPDATE
2. Enforceable parser isolation via child process workers with SIGKILL
3. Evidence lifecycle with explicit provenance fields and consumption-based purge
4. Backward compatibility via additive V2 path (V1 unchanged)

**Additional Resolutions**:
- Removed 10× compression-ratio rejection
- Confirmed FK names: `project_id`, `actor_id`, `consumed_by_run_id`
- Cleanup concurrency via pg_advisory_lock
- Complete schema, API, algorithms, tests specified

**No Changes To**:
- Research Brief
- Research Plan
- Canonical insight review
- Readout approval logic

---

**Status**: Awaiting owner authorization before implementation.
