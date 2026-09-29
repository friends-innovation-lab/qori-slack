/**
 * Coach Section Identity Tests — M3B Merge Gate
 *
 * CANONICAL SECTION IDENTITY RULE:
 * Coach section identity MUST use the exact canonical artifact_sections.section_key.
 * Do NOT use UI presentation IDs, heading labels, or invented Coach aliases.
 *
 * This test suite verifies:
 * 1. ALL coachable Brief sections can be reviewed (positive matrix)
 * 2. ALL coachable Plan sections can be reviewed (positive matrix)
 * 3. Non-coachable/rendered-only sections are rejected (negative matrix)
 * 4. Section identity alignment across all Coach subsystems
 *
 * M3B MERGE GATE: All tests must pass before merge.
 */

import request from 'supertest';
import { getTestApp } from './setup/testApp';
import { getTestDb, truncateAll } from './setup/testDb';
import type { Sequelize } from 'sequelize';
import type { Express } from 'express';

// Models
import type { Organization } from '../../database/models/organization';
import type { Project } from '../../database/models/project';
import type { ResearchStudy } from '../../database/models/research_study';
import type { ResearchArtifact } from '../../database/models/research_artifact';
import type { Actor } from '../../database/models/actor';
import type { ArtifactSection } from '../../database/models/artifact_section';
import type { CoachingRun } from '../../database/models/coaching_run';
import type { CoachingRunSnapshot } from '../../database/models/coaching_run_snapshot';

// ─── Canonical Section Keys ──────────────────────────────────────────────────
// These are the AUTHORITATIVE section keys from artifact_sections.section_key
// They match packages/artifact-contracts/src/*.contract.ts

const BRIEF_COACHABLE_SECTIONS: Array<{ key: string; label: string }> = [
  { key: 'summary', label: 'Summary' },
  { key: 'problem_narrative', label: 'Problem' },
  { key: 'method_prose', label: 'Method' },
  { key: 'participants_prose', label: 'Participants' },
  { key: 'out_of_scope', label: 'Out of scope' },
  { key: 'risks', label: 'Risks' },
];

const PLAN_COACHABLE_SECTIONS: Array<{ key: string; label: string }> = [
  { key: 'plan_summary', label: 'Summary' },
  { key: 'plan_background', label: 'Background' },
  { key: 'plan_method_approach', label: 'Method' },
  { key: 'plan_participants_prose', label: 'Participants' },
  { key: 'plan_deliverables', label: 'Deliverables' },
  { key: 'plan_risks', label: 'Risks and mitigations' },
  { key: 'plan_commitments', label: 'Brief commitments' },
];

// Non-coachable sections that should be rejected
const BRIEF_NON_COACHABLE_SECTIONS = [
  'descriptive_title',       // System-generated title
  'approval_items',          // System section
  'research_objectives',     // Cascade/computed
  'research_questions',      // Cascade/computed
  'target_barriers',         // Cascade/computed
  'timeline_phases',         // Computed
  'learning_objectives',     // Invented alias (doesn't exist)
  'methodology',             // Invented alias (should be method_prose)
  'problem_statement',       // Invented alias (should be problem_narrative)
];

const PLAN_NON_COACHABLE_SECTIONS = [
  'research_summary',        // Invented alias (should be plan_summary)
  'objectives_questions',    // Invented alias (doesn't exist)
  'methodology_approach',    // Invented alias (should be plan_method_approach)
  'participant_criteria',    // Invented alias (should be plan_participants_prose)
  'session_structure',       // Invented alias (doesn't exist)
  'analysis_approach',       // Invented alias (doesn't exist)
  'timeline_milestones',     // Invented alias (doesn't exist)
  'deliverables',            // Invented alias (should be plan_deliverables)
  'plan_session_format',     // Sub-section, not independently coachable
  'plan_data_collection',    // Sub-section, not independently coachable
  'plan_participant_glance', // Quick facts, not coachable
];

describe('M3B Coach Section Identity', () => {
  let app: Express;
  let sequelize: Sequelize;

  // Test fixtures
  let testOrg: Organization;
  let testProject: Project;
  let testStudy: ResearchStudy;
  let briefArtifact: ResearchArtifact;
  let planArtifact: ResearchArtifact;
  let testActor: Actor;

  // Public IDs for API calls
  let briefArtifactPublicId: string;
  let planArtifactPublicId: string;
  let actorPublicId: string;

  beforeAll(() => {
    app = getTestApp();
    sequelize = getTestDb();
  });

  beforeEach(async () => {
    await truncateAll();

    const OrganizationModel = sequelize.models.Organization as typeof Organization;
    const ProjectModel = sequelize.models.Project as typeof Project;
    const StudyModel = sequelize.models.ResearchStudy as typeof ResearchStudy;
    const ArtifactModel = sequelize.models.ResearchArtifact as typeof ResearchArtifact;
    const ActorModel = sequelize.models.Actor as typeof Actor;
    const ArtifactSectionModel = sequelize.models.ArtifactSection as typeof ArtifactSection;
    const ProjectMembershipModel = sequelize.models.ProjectMembership;
    const CoachingRunModel = sequelize.models.CoachingRun as typeof CoachingRun;

    // Get test organization (created by truncateAll)
    testOrg = await OrganizationModel.findOne({ where: { slug: 'test-org' } }) as Organization;

    // Create test actor
    testActor = await ActorModel.create({
      display_name: 'Section Identity Tester',
      organization_id: testOrg.id,
    });
    actorPublicId = testActor.public_id;

    // Create test project
    testProject = await ProjectModel.create({
      name: 'Section Identity Test Project',
      slug: 'section-identity-project',
      created_by: actorPublicId,
      organization_id: testOrg.id,
    });

    // Add actor as project member
    await ProjectMembershipModel.create({
      project_id: testProject.id,
      actor_id: testActor.id,
      role: 'researcher',
    });

    // Create test study
    testStudy = await StudyModel.create({
      name: 'Coach Section Identity Test Study',
      slug: 'section-identity-study',
      channel_name: 'section-identity-channel',
      created_by: actorPublicId,
      researcher_name: 'Section Identity Tester',
      researcher_email: 'section-identity@test.local',
      path: 'test-studies/section-identity',
      project_id: testProject.id,
    });

    // Create Brief artifact with ALL coachable sections
    briefArtifact = await ArtifactModel.create({
      study_id: testStudy.id,
      project_id: testProject.id,
      artifact_type: 'brief',
      template_id: 'research_brief',
      template_version: '1.0.0',
      repo: 'test-repo',
      semantic_key: `${testStudy.path}:brief:v1`,
      created_by: actorPublicId,
      content_version: 1,
    });
    briefArtifactPublicId = briefArtifact.public_id;

    // Create all Brief coachable sections
    for (const section of BRIEF_COACHABLE_SECTIONS) {
      await ArtifactSectionModel.create({
        artifact_id: briefArtifact.id,
        section_key: section.key,
        content_type: 'prose',
        content: `Test content for ${section.label}`,
      });
    }

    // Create Plan artifact with ALL coachable sections
    planArtifact = await ArtifactModel.create({
      study_id: testStudy.id,
      project_id: testProject.id,
      artifact_type: 'plan',
      template_id: 'research_plan',
      template_version: '1.0.0',
      repo: 'test-repo',
      semantic_key: `${testStudy.path}:plan:v1`,
      created_by: actorPublicId,
      content_version: 1,
    });
    planArtifactPublicId = planArtifact.public_id;

    // Create all Plan coachable sections
    for (const section of PLAN_COACHABLE_SECTIONS) {
      await ArtifactSectionModel.create({
        artifact_id: planArtifact.id,
        section_key: section.key,
        content_type: 'prose',
        content: `Test content for ${section.label}`,
      });
    }
  });

  // ─── Positive Matrix: Brief Coachable Sections ───────────────────────────────

  describe('ALL-SECTION MATRIX: Brief Coachable Sections', () => {
    it.each(BRIEF_COACHABLE_SECTIONS)(
      'Brief section "$key" ($label) — creates run, snapshot contains key, context resolves',
      async ({ key, label }) => {
        const SnapshotModel = sequelize.models.CoachingRunSnapshot as typeof CoachingRunSnapshot;
        const CoachingRunModel = sequelize.models.CoachingRun as typeof CoachingRun;

        // 1. Create section-scoped Coach run with exact contract key
        const createRes = await request(app)
          .post(`/api/v1/artifacts/${briefArtifactPublicId}/coaching`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .send({
            review_scope: 'section',
            section_key: key,
          })
          .expect(201);

        const runId = createRes.body.data.run.id;
        expect(runId).toBeDefined();
        expect(createRes.body.data.run.review_scope).toBe('section');
        expect(createRes.body.data.run.selected_section_key).toBe(key);

        // 2. Verify immutable snapshot contains the key
        const snapshot = await SnapshotModel.findOne({ where: { run_id: runId } });
        expect(snapshot).not.toBeNull();

        const snapshotContent = snapshot!.canonical_snapshot_json as {
          sections: Record<string, { content: string; content_type: string }>;
        };
        expect(snapshotContent.sections).toHaveProperty(key);
        expect(snapshotContent.sections[key].content).toContain(`Test content for ${label}`);

        // 3. Verify run is valid (no SECTION_NOT_FOUND during context resolution)
        const run = await CoachingRunModel.findByPk(runId);
        expect(run).not.toBeNull();
        // If context resolution failed, failure_code would be set
        expect(run!.failure_code).toBeNull();

        // 4. Verify capabilities include this section
        const historyRes = await request(app)
          .get(`/api/v1/artifacts/${briefArtifactPublicId}/coaching`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .expect(200);

        const capabilities = historyRes.body.data.capabilities;
        expect(capabilities.coachable_sections).toBeDefined();
        const sectionCapability = capabilities.coachable_sections.find(
          (s: { section_key: string }) => s.section_key === key
        );
        expect(sectionCapability).toBeDefined();
        expect(sectionCapability.label).toBe(label);
      }
    );
  });

  // ─── Positive Matrix: Plan Coachable Sections ────────────────────────────────

  describe('ALL-SECTION MATRIX: Plan Coachable Sections', () => {
    it.each(PLAN_COACHABLE_SECTIONS)(
      'Plan section "$key" ($label) — creates run, snapshot contains key, context resolves',
      async ({ key, label }) => {
        const SnapshotModel = sequelize.models.CoachingRunSnapshot as typeof CoachingRunSnapshot;
        const CoachingRunModel = sequelize.models.CoachingRun as typeof CoachingRun;

        // 1. Create section-scoped Coach run with exact contract key
        const createRes = await request(app)
          .post(`/api/v1/artifacts/${planArtifactPublicId}/coaching`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .send({
            review_scope: 'section',
            section_key: key,
          })
          .expect(201);

        const runId = createRes.body.data.run.id;
        expect(runId).toBeDefined();
        expect(createRes.body.data.run.review_scope).toBe('section');
        expect(createRes.body.data.run.selected_section_key).toBe(key);

        // 2. Verify immutable snapshot contains the key
        const snapshot = await SnapshotModel.findOne({ where: { run_id: runId } });
        expect(snapshot).not.toBeNull();

        const snapshotContent = snapshot!.canonical_snapshot_json as {
          sections: Record<string, { content: string; content_type: string }>;
        };
        expect(snapshotContent.sections).toHaveProperty(key);
        expect(snapshotContent.sections[key].content).toContain(`Test content for ${label}`);

        // 3. Verify run is valid (no SECTION_NOT_FOUND during context resolution)
        const run = await CoachingRunModel.findByPk(runId);
        expect(run).not.toBeNull();
        expect(run!.failure_code).toBeNull();

        // 4. Verify capabilities include this section
        const historyRes = await request(app)
          .get(`/api/v1/artifacts/${planArtifactPublicId}/coaching`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .expect(200);

        const capabilities = historyRes.body.data.capabilities;
        expect(capabilities.coachable_sections).toBeDefined();
        const sectionCapability = capabilities.coachable_sections.find(
          (s: { section_key: string }) => s.section_key === key
        );
        expect(sectionCapability).toBeDefined();
        expect(sectionCapability.label).toBe(label);
      }
    );
  });

  // ─── Negative Matrix: Brief Non-Coachable Sections ───────────────────────────

  describe('NEGATIVE MATRIX: Brief Non-Coachable Sections Rejected', () => {
    it.each(BRIEF_NON_COACHABLE_SECTIONS)(
      'Brief section "%s" — backend rejects section-scoped request',
      async (sectionKey) => {
        const res = await request(app)
          .post(`/api/v1/artifacts/${briefArtifactPublicId}/coaching`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .send({
            review_scope: 'section',
            section_key: sectionKey,
          })
          .expect(400);

        expect(res.body.error).toBeDefined();
        // Error code may be INVALID_SECTION_KEY or VALIDATION_ERROR depending on validation layer
        expect(['INVALID_SECTION_KEY', 'VALIDATION_ERROR']).toContain(res.body.error.code);
      }
    );
  });

  // ─── Negative Matrix: Plan Non-Coachable Sections ────────────────────────────

  describe('NEGATIVE MATRIX: Plan Non-Coachable Sections Rejected', () => {
    it.each(PLAN_NON_COACHABLE_SECTIONS)(
      'Plan section "%s" — backend rejects section-scoped request',
      async (sectionKey) => {
        const res = await request(app)
          .post(`/api/v1/artifacts/${planArtifactPublicId}/coaching`)
          .set('X-Test-Actor-PublicId', actorPublicId)
          .send({
            review_scope: 'section',
            section_key: sectionKey,
          })
          .expect(400);

        expect(res.body.error).toBeDefined();
        // Error code may be INVALID_SECTION_KEY or VALIDATION_ERROR depending on validation layer
        expect(['INVALID_SECTION_KEY', 'VALIDATION_ERROR']).toContain(res.body.error.code);
      }
    );
  });

  // ─── Artifact-Level Regression ───────────────────────────────────────────────

  describe('ARTIFACT REGRESSION: Artifact-level Coach unchanged', () => {
    it('Research Brief artifact review creates run successfully', async () => {
      const res = await request(app)
        .post(`/api/v1/artifacts/${briefArtifactPublicId}/coaching`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ review_scope: 'artifact' })
        .expect(201);

      expect(res.body.data.run.artifact_type).toBe('brief');
      expect(res.body.data.run.review_scope).toBe('artifact');
      expect(res.body.data.run.selected_section_key).toBeNull();
    });

    it('Research Plan artifact review creates run successfully', async () => {
      const res = await request(app)
        .post(`/api/v1/artifacts/${planArtifactPublicId}/coaching`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ review_scope: 'artifact' })
        .expect(201);

      expect(res.body.data.run.artifact_type).toBe('plan');
      expect(res.body.data.run.review_scope).toBe('artifact');
      expect(res.body.data.run.selected_section_key).toBeNull();
    });
  });

  // ─── Single Source of Truth Alignment ────────────────────────────────────────

  describe('SINGLE SOURCE: Section identity alignment', () => {
    it('capabilities.coachable_sections matches contract sections exactly', async () => {
      // Brief
      const briefRes = await request(app)
        .get(`/api/v1/artifacts/${briefArtifactPublicId}/coaching`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      const briefCapabilities = briefRes.body.data.capabilities.coachable_sections;
      const briefKeys = briefCapabilities.map((s: { section_key: string }) => s.section_key).sort();
      const expectedBriefKeys = BRIEF_COACHABLE_SECTIONS.map(s => s.key).sort();
      expect(briefKeys).toEqual(expectedBriefKeys);

      // Plan
      const planRes = await request(app)
        .get(`/api/v1/artifacts/${planArtifactPublicId}/coaching`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      const planCapabilities = planRes.body.data.capabilities.coachable_sections;
      const planKeys = planCapabilities.map((s: { section_key: string }) => s.section_key).sort();
      const expectedPlanKeys = PLAN_COACHABLE_SECTIONS.map(s => s.key).sort();
      expect(planKeys).toEqual(expectedPlanKeys);
    });

    it('snapshot section keys match artifact_sections table exactly', async () => {
      const SnapshotModel = sequelize.models.CoachingRunSnapshot as typeof CoachingRunSnapshot;
      const ArtifactSectionModel = sequelize.models.ArtifactSection as typeof ArtifactSection;

      // Create a run to generate snapshot
      const res = await request(app)
        .post(`/api/v1/artifacts/${planArtifactPublicId}/coaching`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({ review_scope: 'artifact' })
        .expect(201);

      const runId = res.body.data.run.id;
      const snapshot = await SnapshotModel.findOne({ where: { run_id: runId } });
      const snapshotContent = snapshot!.canonical_snapshot_json as {
        sections: Record<string, unknown>;
      };

      // Get actual artifact sections
      const artifactSections = await ArtifactSectionModel.findAll({
        where: { artifact_id: planArtifact.id },
      });
      const artifactSectionKeys = artifactSections.map(s => s.section_key).sort();

      // Snapshot keys should match artifact section keys
      const snapshotKeys = Object.keys(snapshotContent.sections).sort();
      expect(snapshotKeys).toEqual(artifactSectionKeys);
    });
  });

  // ─── Section Restoration ─────────────────────────────────────────────────────

  describe('SECTION RESTORATION: Completed result persists', () => {
    it('completed section run persists and can be retrieved', async () => {
      // Create a section run
      const createRes = await request(app)
        .post(`/api/v1/artifacts/${briefArtifactPublicId}/coaching`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({
          review_scope: 'section',
          section_key: 'summary',
        })
        .expect(201);

      const runId = createRes.body.data.run.id;

      // Verify run appears in history filtered by section
      const historyRes = await request(app)
        .get(`/api/v1/artifacts/${briefArtifactPublicId}/coaching`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      const runs = historyRes.body.data.runs;
      const sectionRun = runs.find((r: { id: string }) => r.id === runId);
      expect(sectionRun).toBeDefined();
      expect(sectionRun.review_scope).toBe('section');
      expect(sectionRun.selected_section_key).toBe('summary');
    });

    it('reopening section context does NOT create new run automatically', async () => {
      // Create a section run first
      await request(app)
        .post(`/api/v1/artifacts/${briefArtifactPublicId}/coaching`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .send({
          review_scope: 'section',
          section_key: 'problem_narrative',
        })
        .expect(201);

      // Get history (simulates reopening section context)
      const historyRes1 = await request(app)
        .get(`/api/v1/artifacts/${briefArtifactPublicId}/coaching`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      const runCount1 = historyRes1.body.data.runs.length;

      // Get history again (simulates navigating away and back)
      const historyRes2 = await request(app)
        .get(`/api/v1/artifacts/${briefArtifactPublicId}/coaching`)
        .set('X-Test-Actor-PublicId', actorPublicId)
        .expect(200);

      const runCount2 = historyRes2.body.data.runs.length;

      // Run count should be unchanged (no automatic creation)
      expect(runCount2).toBe(runCount1);
    });
  });
});
