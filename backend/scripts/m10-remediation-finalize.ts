/**
 * M10 One-Time Remediation Script
 *
 * Repairs the stuck dev run by invoking the deployed finalizeControlledExecution.
 *
 * Target:
 * - Session: 5794e980-b49e-4a90-86d6-6a895776df7a
 * - Run: 8054f70e-267a-4177-99ad-bb56982813b9
 *
 * Preconditions (fail-closed):
 * 1. Exact public IDs, project, binding, controlled flag, worker, status=processing
 * 2. Session exhausted, 4/4 requests, no cancellation
 * 3. Four reconciled reservations with expected purposes
 * 4. Current artifact with GitHub SHA
 * 5. Extracted variables exist
 * 6. No active execution
 *
 * Usage: npx ts-node scripts/m10-remediation-finalize.ts
 */

import sequelize from '../src/database';
import { finalizeControlledExecution } from '../src/application/discovery.app-service';

// ─── Target Identifiers ──────────────────────────────────────────────────────
const TARGET_RUN_PUBLIC_ID = '8054f70e-267a-4177-99ad-bb56982813b9';
const TARGET_SESSION_PUBLIC_ID = '5794e980-b49e-4a90-86d6-6a895776df7a';
const EXPECTED_WORKER_PREFIX = 'api:8677766d-d604-4531-b467-2cb8671cd86c';
const EXPECTED_PURPOSES = [
  'langchain-task-analysis_body',
  'langchain-task-appendix_observations',
  'extraction-sonnet',
  'extraction-haiku',
];

// ─── Precondition Check Results ──────────────────────────────────────────────
interface PreconditionResult {
  check: string;
  passed: boolean;
  details: string;
}

const results: PreconditionResult[] = [];

function recordCheck(check: string, passed: boolean, details: string): boolean {
  results.push({ check, passed, details });
  console.log(`[${passed ? '✓' : '✗'}] ${check}: ${details}`);
  return passed;
}

// ─── Main Remediation Logic ──────────────────────────────────────────────────
async function runRemediation(): Promise<void> {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('M10 ONE-TIME REMEDIATION — PRECONDITION CHECKS');
  console.log('═══════════════════════════════════════════════════════════\n');

  let runId: number | null = null;
  let sessionId: number | null = null;

  try {
    // ─── Check 1: Run identity, status, controlled flag, worker ────────────
    const [runRows] = await sequelize.query(`
      SELECT id, public_id, status, is_controlled, worker_id, project_id,
             started_at, completed_at, failure_code
      FROM discovery_runs
      WHERE public_id = :publicId
    `, { replacements: { publicId: TARGET_RUN_PUBLIC_ID }, raw: true }) as [any[], unknown];

    if (runRows.length === 0) {
      recordCheck('1. Run exists', false, `No run found with public_id ${TARGET_RUN_PUBLIC_ID}`);
      return failClosed();
    }

    const run = runRows[0];
    runId = run.id;

    const check1a = run.status === 'processing';
    recordCheck('1a. Run status', check1a, `status=${run.status}, expected=processing`);
    if (!check1a) return failClosed();

    const check1b = run.is_controlled === true;
    recordCheck('1b. Run is_controlled', check1b, `is_controlled=${run.is_controlled}`);
    if (!check1b) return failClosed();

    const check1c = run.worker_id?.startsWith(EXPECTED_WORKER_PREFIX);
    recordCheck('1c. Worker ID prefix', check1c, `worker_id=${run.worker_id?.slice(0, 50)}...`);
    if (!check1c) return failClosed();

    const check1d = run.completed_at === null;
    recordCheck('1d. Not completed', check1d, `completed_at=${run.completed_at}`);
    if (!check1d) return failClosed();

    const check1e = run.failure_code === null;
    recordCheck('1e. No failure', check1e, `failure_code=${run.failure_code}`);
    if (!check1e) return failClosed();

    // ─── Check 2: Session status, binding, budget ──────────────────────────
    const [sessionRows] = await sequelize.query(`
      SELECT id, public_id, status, discovery_run_id, project_id,
             used_requests, max_requests, cancelled_at, exhausted_at
      FROM controlled_test_sessions
      WHERE public_id = :publicId
    `, { replacements: { publicId: TARGET_SESSION_PUBLIC_ID }, raw: true }) as [any[], unknown];

    if (sessionRows.length === 0) {
      recordCheck('2. Session exists', false, `No session found with public_id ${TARGET_SESSION_PUBLIC_ID}`);
      return failClosed();
    }

    const session = sessionRows[0];
    sessionId = session.id;

    const check2a = session.status === 'exhausted';
    recordCheck('2a. Session exhausted', check2a, `status=${session.status}`);
    if (!check2a) return failClosed();

    const check2b = session.discovery_run_id === runId;
    recordCheck('2b. Session bound to run', check2b, `discovery_run_id=${session.discovery_run_id}, runId=${runId}`);
    if (!check2b) return failClosed();

    const check2c = session.used_requests === 4 && session.max_requests === 4;
    recordCheck('2c. Budget 4/4', check2c, `used=${session.used_requests}, max=${session.max_requests}`);
    if (!check2c) return failClosed();

    const check2d = session.cancelled_at === null;
    recordCheck('2d. Not cancelled', check2d, `cancelled_at=${session.cancelled_at}`);
    if (!check2d) return failClosed();

    const check2e = session.project_id === run.project_id;
    recordCheck('2e. Project match', check2e, `session.project_id=${session.project_id}, run.project_id=${run.project_id}`);
    if (!check2e) return failClosed();

    // ─── Check 3: Four reconciled reservations ─────────────────────────────
    const [reservationRows] = await sequelize.query(`
      SELECT id, purpose, state, actual_input_tokens, actual_output_tokens
      FROM controlled_test_reservations
      WHERE session_id = :sessionId
      ORDER BY created_at
    `, { replacements: { sessionId }, raw: true }) as [any[], unknown];

    const check3a = reservationRows.length === 4;
    recordCheck('3a. Exactly 4 reservations', check3a, `count=${reservationRows.length}`);
    if (!check3a) return failClosed();

    const allReconciled = reservationRows.every((r: any) => r.state === 'reconciled');
    recordCheck('3b. All reconciled', allReconciled,
      reservationRows.map((r: any) => `${r.purpose}:${r.state}`).join(', '));
    if (!allReconciled) return failClosed();

    const purposes = reservationRows.map((r: any) => r.purpose).sort();
    const expectedSorted = [...EXPECTED_PURPOSES].sort();
    const purposesMatch = JSON.stringify(purposes) === JSON.stringify(expectedSorted);
    recordCheck('3c. Expected purposes', purposesMatch, purposes.join(', '));
    if (!purposesMatch) return failClosed();

    const validTokens = reservationRows.every((r: any) =>
      r.actual_input_tokens > 0 && r.actual_output_tokens > 0);
    recordCheck('3d. Valid token counts', validTokens,
      reservationRows.map((r: any) => `in:${r.actual_input_tokens}/out:${r.actual_output_tokens}`).join(', '));
    if (!validTokens) return failClosed();

    // ─── Check 4: Current artifact with GitHub SHA ─────────────────────────
    const [artifactRows] = await sequelize.query(`
      SELECT id, public_id, artifact_type, title, status, github_path, github_sha
      FROM discovery_artifacts
      WHERE discovery_run_id = :runId AND status = 'current'
    `, { replacements: { runId }, raw: true }) as [any[], unknown];

    const check4a = artifactRows.length === 1;
    recordCheck('4a. One current artifact', check4a, `count=${artifactRows.length}`);
    if (!check4a) return failClosed();

    const artifact = artifactRows[0];
    const check4b = artifact.github_sha && artifact.github_sha.length === 40;
    recordCheck('4b. Valid GitHub SHA', check4b, `sha=${artifact.github_sha}`);
    if (!check4b) return failClosed();

    const check4c = artifact.github_path && artifact.github_path.includes('stakeholder-synthesis');
    recordCheck('4c. Valid GitHub path', check4c, `path=${artifact.github_path}`);
    if (!check4c) return failClosed();

    // ─── Check 5: Extracted variables exist ────────────────────────────────
    const [variableRows] = await sequelize.query(`
      SELECT COUNT(*) as count, COUNT(DISTINCT variable_key) as unique_keys
      FROM study_variables
      WHERE source_template = 'stakeholder_synthesis'
        AND created_at >= (SELECT exhausted_at FROM controlled_test_sessions WHERE id = :sessionId)
        AND created_at <= (SELECT exhausted_at FROM controlled_test_sessions WHERE id = :sessionId) + INTERVAL '1 second'
    `, { replacements: { sessionId }, raw: true }) as [any[], unknown];

    const varCount = parseInt(variableRows[0].count, 10);
    const uniqueKeys = parseInt(variableRows[0].unique_keys, 10);
    const check5a = varCount >= 20;
    recordCheck('5a. Variables extracted', check5a, `count=${varCount}, unique_keys=${uniqueKeys}`);
    if (!check5a) return failClosed();

    // ─── Check 6: No active execution ──────────────────────────────────────
    const [pendingReservations] = await sequelize.query(`
      SELECT COUNT(*) as count
      FROM controlled_test_reservations
      WHERE session_id = :sessionId AND state = 'reserved'
    `, { replacements: { sessionId }, raw: true }) as [any[], unknown];

    const check6a = parseInt(pendingReservations[0].count, 10) === 0;
    recordCheck('6a. No pending reservations', check6a, `pending=${pendingReservations[0].count}`);
    if (!check6a) return failClosed();

    // ─── All Preconditions Passed ──────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('ALL PRECONDITIONS PASSED — INVOKING FINALIZER');
    console.log('═══════════════════════════════════════════════════════════\n');

    // ─── Capture Before State ──────────────────────────────────────────────
    console.log('BEFORE STATE:');
    console.log(`  Run: id=${runId}, status=${run.status}, completed_at=${run.completed_at}`);
    console.log(`  Session: id=${sessionId}, status=${session.status}`);
    console.log(`  Artifact: id=${artifact.id}, status=${artifact.status}`);
    console.log(`  Reservations: ${reservationRows.length} reconciled`);
    console.log(`  Variables: ${varCount} extracted\n`);

    // ─── Invoke Application Finalizer ──────────────────────────────────────
    console.log('Calling finalizeControlledExecution(runId, sessionId, "completed")...\n');

    // TypeScript: runId and sessionId are guaranteed non-null here due to precondition checks
    const result = await finalizeControlledExecution(runId!, sessionId!, 'completed');

    console.log('FINALIZER RESULT:');
    console.log(JSON.stringify(result, null, 2));

    if (!result.success) {
      console.error('\n❌ FINALIZATION FAILED:', result.error);
      return;
    }

    // ─── Verify Post-Conditions ────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('POST-CONDITION VERIFICATION');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Reload run
    const [runAfter] = await sequelize.query(`
      SELECT id, status, completed_at FROM discovery_runs WHERE id = :runId
    `, { replacements: { runId }, raw: true }) as [any[], unknown];

    const postRun = runAfter[0];
    const post1 = postRun.status === 'completed' && postRun.completed_at !== null;
    recordCheck('POST-1. Run completed', post1, `status=${postRun.status}, completed_at=${postRun.completed_at}`);

    // Reload session
    const [sessionAfter] = await sequelize.query(`
      SELECT id, status FROM controlled_test_sessions WHERE id = :sessionId
    `, { replacements: { sessionId }, raw: true }) as [any[], unknown];

    const postSession = sessionAfter[0];
    const post2 = postSession.status === 'exhausted';
    recordCheck('POST-2. Session still exhausted', post2, `status=${postSession.status}`);

    // Verify artifact unchanged
    const [artifactAfter] = await sequelize.query(`
      SELECT id, status, github_sha FROM discovery_artifacts WHERE id = :artifactId
    `, { replacements: { artifactId: artifact.id }, raw: true }) as [any[], unknown];

    const postArtifact = artifactAfter[0];
    const post3 = postArtifact.status === 'current' && postArtifact.github_sha === artifact.github_sha;
    recordCheck('POST-3. Artifact unchanged', post3, `status=${postArtifact.status}, sha=${postArtifact.github_sha}`);

    // Verify no new reservations
    const [reservationsAfter] = await sequelize.query(`
      SELECT COUNT(*) as count FROM controlled_test_reservations WHERE session_id = :sessionId
    `, { replacements: { sessionId }, raw: true }) as [any[], unknown];

    const post4 = parseInt(reservationsAfter[0].count, 10) === 4;
    recordCheck('POST-4. No new reservations', post4, `count=${reservationsAfter[0].count}`);

    // Verify variables unchanged
    const [variablesAfter] = await sequelize.query(`
      SELECT COUNT(*) as count FROM study_variables
      WHERE source_template = 'stakeholder_synthesis'
        AND created_at >= (SELECT exhausted_at FROM controlled_test_sessions WHERE id = :sessionId)
        AND created_at <= (SELECT exhausted_at FROM controlled_test_sessions WHERE id = :sessionId) + INTERVAL '1 second'
    `, { replacements: { sessionId }, raw: true }) as [any[], unknown];

    const post5 = parseInt(variablesAfter[0].count, 10) === varCount;
    recordCheck('POST-5. Variables unchanged', post5, `count=${variablesAfter[0].count}`);

    // ─── Final Summary ─────────────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('M10 REMEDIATION COMPLETE');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('AFTER STATE:');
    console.log(`  Run: id=${runId}, status=${postRun.status}, completed_at=${postRun.completed_at}`);
    console.log(`  Session: id=${sessionId}, status=${postSession.status}`);
    console.log(`  Artifact: id=${artifact.id}, status=${postArtifact.status}, sha=${postArtifact.github_sha}`);
    console.log(`  Reservations: ${reservationsAfter[0].count} (unchanged)`);
    console.log(`  Variables: ${variablesAfter[0].count} (unchanged)`);

    const allPostPassed = post1 && post2 && post3 && post4 && post5;
    console.log(`\n${allPostPassed ? '✓' : '✗'} All post-conditions ${allPostPassed ? 'PASSED' : 'FAILED'}`);

  } catch (error) {
    console.error('\n❌ REMEDIATION ERROR:', error);
  } finally {
    await sequelize.close();
  }
}

function failClosed(): void {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('❌ FAIL-CLOSED: Precondition failed — no mutation performed');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('Check results:');
  results.forEach(r => console.log(`  [${r.passed ? '✓' : '✗'}] ${r.check}`));
}

// ─── Entry Point ─────────────────────────────────────────────────────────────
runRemediation()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
