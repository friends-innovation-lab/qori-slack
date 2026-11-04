/**
 * M7b Variable Containment Tests — DISC-WEB-1D-2
 *
 * Tests that Discovery variables linked to non-current artifacts
 * are excluded from downstream consumption.
 *
 * D1 Gap: Variables from failed/generating/superseded artifacts
 * were previously returned by readDiscoveryVariablesByProject.
 *
 * Test Matrix:
 * - Current-artifact variable: INCLUDED
 * - Failed-artifact variable: EXCLUDED
 * - Generating-artifact variable: EXCLUDED
 * - Superseded-artifact variable: EXCLUDED
 * - NULL-FK variable (legacy): INCLUDED (existing behavior)
 * - Other-project variable: EXCLUDED
 * - Other-source-template variable: EXCLUDED
 */

import { getTestDb, truncateAll, TEST_ORG_ID } from './setup/testDb';
import type { Sequelize } from 'sequelize';
import type { CreationAttributes } from 'sequelize';

import type { Organization } from '../../database/models/organization';
import type { Project } from '../../database/models/project';
import type { Actor } from '../../database/models/actor';
import type { DiscoveryRun } from '../../database/models/discovery_run';
import type { DiscoveryArtifact } from '../../database/models/discovery_artifact';
import type { StudyVariable } from '../../database/models/study_variable';

import {
  readDiscoveryVariablesByProject,
  readUpstreamDiscoveryVariables,
  injectSequelizeForTest,
  type ConsumeSpec,
} from '../../helpers/studyVariables';

describe('M7b Variable Containment — DISC-WEB-1D-2', () => {
  let sequelize: Sequelize;

  // Models
  let ProjectModel: typeof Project;
  let ActorModel: typeof Actor;
  let DiscoveryRunModel: typeof DiscoveryRun;
  let DiscoveryArtifactModel: typeof DiscoveryArtifact;
  let StudyVariableModel: typeof StudyVariable;

  // Fixtures
  let testOrg: Organization;
  let testProject: Project;
  let testProject2: Project;
  let testActor: Actor;

  beforeAll(async () => {
    sequelize = getTestDb();
    await sequelize.authenticate();

    // Inject sequelize for studyVariables helper
    injectSequelizeForTest(sequelize);

    ProjectModel = sequelize.models.Project as typeof Project;
    ActorModel = sequelize.models.Actor as typeof Actor;
    DiscoveryRunModel = sequelize.models.DiscoveryRun as typeof DiscoveryRun;
    DiscoveryArtifactModel = sequelize.models.DiscoveryArtifact as typeof DiscoveryArtifact;
    StudyVariableModel = sequelize.models.StudyVariable as typeof StudyVariable;
  });

  beforeEach(async () => {
    await truncateAll();

    const OrganizationModel = sequelize.models.Organization as typeof Organization;
    testOrg = await OrganizationModel.findOne({ where: { slug: 'test-org' } }) as Organization;

    testActor = await ActorModel.create({
      display_name: 'M7b Test Actor',
      organization_id: testOrg.id,
      status: 'active',
    }) as Actor;

    testProject = await ProjectModel.create({
      name: 'M7b Test Project',
      slug: `m7b-test-${Date.now()}`,
      created_by: testActor.public_id,
      organization_id: testOrg.id,
      status: 'active',
    }) as Project;

    testProject2 = await ProjectModel.create({
      name: 'M7b Test Project 2',
      slug: `m7b-test-2-${Date.now()}`,
      created_by: testActor.public_id,
      organization_id: testOrg.id,
      status: 'active',
    }) as Project;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  // Helper to create run and artifact
  async function createRunAndArtifact(
    projectId: number,
    actorId: number,
    artifactStatus: 'generating' | 'current' | 'superseded' | 'failed',
    topicSlug: string = 'm7b-topic',
  ): Promise<{ run: DiscoveryRun; artifact: DiscoveryArtifact }> {
    const run = await DiscoveryRunModel.create({
      project_id: projectId,
      actor_id: actorId,
      discovery_type: 'desk_research',
      topic: `M7b Test ${topicSlug}`,
      topic_slug: topicSlug,
      source_intent: null,
      status: 'completed',
      is_controlled: false,
      created_by_identity: 'test:m7b',
    } as CreationAttributes<DiscoveryRun>) as DiscoveryRun;

    const artifact = await DiscoveryArtifactModel.create({
      project_id: projectId,
      discovery_run_id: run.id,
      artifact_type: 'desk_research',
      title: `M7b Test Artifact ${artifactStatus}`,
      topic_slug: topicSlug,
      version: 1,
      status: artifactStatus,
      template_name: 'desk_research',
      template_version: '1.0',
      generated_by_identity: 'test:m7b',
    } as CreationAttributes<DiscoveryArtifact>) as DiscoveryArtifact;

    return { run, artifact };
  }

  // Helper to create variable linked to artifact
  async function createVariableWithArtifact(
    projectId: number,
    artifactId: number | null,
    variableKey: string,
    value: unknown,
    sourceTemplate: string = 'desk_research',
  ): Promise<StudyVariable> {
    const variable = await StudyVariableModel.create({
      project_id: projectId,
      study_id: null,
      variable_key: variableKey,
      variable_type: 'pool',
      item_key: null,
      value,
      participant_id: null,
      source_template: sourceTemplate,
      source_version: '1.0',
      source_date: new Date(),
      is_pool: true,
      scope: 'discovery',
      discovery_artifact_id: artifactId ? `artifact-${artifactId}` : null,
      discovery_artifact_fk_id: artifactId,
      stale: false,
    } as CreationAttributes<StudyVariable>);
    return variable as StudyVariable;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // D1 REPRODUCTION: Demonstrate the gap before fix
  // ═══════════════════════════════════════════════════════════════════════════

  describe('D1 Reproduction: readDiscoveryVariablesByProject', () => {
    it('returns variables from current artifact', async () => {
      const { artifact } = await createRunAndArtifact(testProject.id, testActor.id, 'current');
      await createVariableWithArtifact(testProject.id, artifact.id, 'knowledge_gaps', [
        { id: 'kg-1', title: 'Current Gap', summary: 'From current artifact' },
      ]);

      const result = await readDiscoveryVariablesByProject(testProject.id, 'desk-research');

      const artifactVars = result.artifacts[`artifact-${artifact.id}`];
      expect(artifactVars).toBeDefined();
      expect(artifactVars.knowledge_gaps).toBeDefined();
      // Pool variable values are arrays; each row adds one element
      const values = artifactVars.knowledge_gaps.value as unknown[];
      expect(values.length).toBeGreaterThan(0);
      // The stored value is the array itself, so first element is the array
      const firstValue = Array.isArray(values[0]) ? values[0][0] : values[0];
      expect(firstValue).toMatchObject({ id: 'kg-1' });
    });

    it('excludes variables from failed artifact', async () => {
      const { artifact } = await createRunAndArtifact(testProject.id, testActor.id, 'failed');
      await createVariableWithArtifact(testProject.id, artifact.id, 'knowledge_gaps', [
        { id: 'kg-failed', title: 'Failed Gap', summary: 'From failed artifact' },
      ]);

      const result = await readDiscoveryVariablesByProject(testProject.id, 'desk-research');

      // Variables from failed artifact should NOT be present
      const artifactVars = result.artifacts[`artifact-${artifact.id}`];
      expect(artifactVars).toBeUndefined();
    });

    it('excludes variables from generating artifact', async () => {
      const { artifact } = await createRunAndArtifact(testProject.id, testActor.id, 'generating');
      await createVariableWithArtifact(testProject.id, artifact.id, 'knowledge_gaps', [
        { id: 'kg-generating', title: 'Generating Gap', summary: 'From generating artifact' },
      ]);

      const result = await readDiscoveryVariablesByProject(testProject.id, 'desk-research');

      const artifactVars = result.artifacts[`artifact-${artifact.id}`];
      expect(artifactVars).toBeUndefined();
    });

    it('excludes variables from superseded artifact', async () => {
      const { artifact } = await createRunAndArtifact(testProject.id, testActor.id, 'superseded');
      await createVariableWithArtifact(testProject.id, artifact.id, 'knowledge_gaps', [
        { id: 'kg-superseded', title: 'Superseded Gap', summary: 'From superseded artifact' },
      ]);

      const result = await readDiscoveryVariablesByProject(testProject.id, 'desk-research');

      const artifactVars = result.artifacts[`artifact-${artifact.id}`];
      expect(artifactVars).toBeUndefined();
    });

    it('includes legacy variables with NULL artifact FK', async () => {
      // Legacy variable without artifact FK
      await createVariableWithArtifact(testProject.id, null, 'knowledge_gaps', [
        { id: 'kg-legacy', title: 'Legacy Gap', summary: 'No artifact FK' },
      ]);

      const result = await readDiscoveryVariablesByProject(testProject.id, 'desk-research');

      // Legacy variables grouped under 'default' artifact ID
      const artifactVars = result.artifacts['default'];
      expect(artifactVars).toBeDefined();
      expect(artifactVars.knowledge_gaps).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ISOLATION: Project and source-template scoping
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Isolation: Project and source-template scoping', () => {
    it('excludes variables from other projects', async () => {
      // Create variable in project 2
      const { artifact } = await createRunAndArtifact(testProject2.id, testActor.id, 'current');
      await createVariableWithArtifact(testProject2.id, artifact.id, 'knowledge_gaps', [
        { id: 'kg-other', title: 'Other Project Gap' },
      ]);

      // Read from project 1
      const result = await readDiscoveryVariablesByProject(testProject.id, 'desk-research');

      expect(Object.keys(result.artifacts)).toHaveLength(0);
    });

    it('excludes variables from other source templates', async () => {
      const { artifact } = await createRunAndArtifact(testProject.id, testActor.id, 'current');
      // Create variable with stakeholder_synthesis source
      await createVariableWithArtifact(testProject.id, artifact.id, 'stakeholder_themes', [
        { id: 'st-1', title: 'Stakeholder Theme' },
      ], 'stakeholder_synthesis');

      // Read desk-research (should not include stakeholder_synthesis)
      const result = await readDiscoveryVariablesByProject(testProject.id, 'desk-research');

      const artifactVars = result.artifacts[`artifact-${artifact.id}`];
      expect(artifactVars).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DOWNSTREAM: readUpstreamDiscoveryVariables
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Downstream: readUpstreamDiscoveryVariables consumption', () => {
    it('consumes variables from current artifact', async () => {
      const { artifact } = await createRunAndArtifact(testProject.id, testActor.id, 'current');
      await createVariableWithArtifact(testProject.id, artifact.id, 'knowledge_gaps', [
        { id: 'kg-current', title: 'Current Gap', summary: 'Consumable' },
      ]);

      const consumesSpec: ConsumeSpec[] = [
        { key: 'knowledge_gaps', required: true, source: 'desk_research' },
      ];

      const upstream = await readUpstreamDiscoveryVariables(
        testProject.id,
        'desk-research',
        'm7b-topic',
        consumesSpec,
      );

      expect(upstream.knowledge_gaps).toBeDefined();
      expect(Array.isArray(upstream.knowledge_gaps.value)).toBe(true);
      // Aggregated pool values may be nested arrays
      const values = upstream.knowledge_gaps.value as unknown[];
      expect(values.length).toBeGreaterThan(0);
      const firstValue = Array.isArray(values[0]) ? values[0][0] : values[0];
      expect(firstValue).toMatchObject({ id: 'kg-current' });
    });

    it('cannot consume variables from failed artifact', async () => {
      const { artifact } = await createRunAndArtifact(testProject.id, testActor.id, 'failed');
      await createVariableWithArtifact(testProject.id, artifact.id, 'knowledge_gaps', [
        { id: 'kg-failed', title: 'Failed Gap', summary: 'Not consumable' },
      ]);

      const consumesSpec: ConsumeSpec[] = [
        { key: 'knowledge_gaps', required: false, source: 'desk_research' },
      ];

      const upstream = await readUpstreamDiscoveryVariables(
        testProject.id,
        'desk-research',
        'm7b-topic',
        consumesSpec,
      );

      // Should not find variables from failed artifact
      expect(upstream.knowledge_gaps).toBeUndefined();
    });

    it('aggregates only from current artifacts', async () => {
      // Create current artifact with variables
      const { artifact: current } = await createRunAndArtifact(
        testProject.id, testActor.id, 'current', 'm7b-current',
      );
      await createVariableWithArtifact(testProject.id, current.id, 'knowledge_gaps', [
        { id: 'kg-c1', title: 'Current Gap 1' },
      ]);

      // Create failed artifact with variables
      const { artifact: failed } = await createRunAndArtifact(
        testProject.id, testActor.id, 'failed', 'm7b-failed',
      );
      await createVariableWithArtifact(testProject.id, failed.id, 'knowledge_gaps', [
        { id: 'kg-f1', title: 'Failed Gap 1' },
      ]);

      const consumesSpec: ConsumeSpec[] = [
        { key: 'knowledge_gaps', required: true, source: 'desk_research' },
      ];

      const upstream = await readUpstreamDiscoveryVariables(
        testProject.id,
        'desk-research',
        'm7b-topic',
        consumesSpec,
      );

      // Should only include current artifact's variable
      expect(upstream.knowledge_gaps).toBeDefined();
      const values = upstream.knowledge_gaps.value as unknown[];
      expect(values).toHaveLength(1);
      // Pool aggregation may nest values
      const firstValue = Array.isArray(values[0]) ? values[0][0] : values[0];
      expect(firstValue).toMatchObject({ id: 'kg-c1' });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CROSS-PROJECT: Defensive project ownership check
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Cross-project: Defensive artifact ownership', () => {
    it('excludes variables linked to artifacts in different projects', async () => {
      // Create artifact in project 2 (current status)
      const { artifact: otherProjectArtifact } = await createRunAndArtifact(
        testProject2.id, testActor.id, 'current', 'm7b-other-project',
      );

      // Manually create variable in project 1 pointing to project 2's artifact
      // This simulates a bug or data corruption scenario
      await StudyVariableModel.create({
        project_id: testProject.id, // Variable in project 1
        study_id: null,
        variable_key: 'cross_project_test',
        variable_type: 'pool',
        item_key: null,
        value: [{ id: 'cross-1', title: 'Cross-project variable' }],
        participant_id: null,
        source_template: 'desk_research',
        source_version: '1.0',
        source_date: new Date(),
        is_pool: true,
        scope: 'discovery',
        discovery_artifact_id: `artifact-${otherProjectArtifact.id}`,
        discovery_artifact_fk_id: otherProjectArtifact.id, // Points to OTHER project's artifact
        stale: false,
      } as CreationAttributes<StudyVariable>);

      // Read from project 1 - should NOT include the cross-project variable
      const result = await readDiscoveryVariablesByProject(testProject.id, 'desk-research');

      // The variable should be excluded because artifact belongs to different project
      expect(result.artifacts[`artifact-${otherProjectArtifact.id}`]).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MIXED: Current + Legacy + Failed artifacts
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Mixed: Current, legacy, and failed artifacts', () => {
    it('includes both current and legacy variables, excludes failed', async () => {
      // Current artifact variable
      const { artifact: current } = await createRunAndArtifact(
        testProject.id, testActor.id, 'current', 'm7b-current',
      );
      await createVariableWithArtifact(testProject.id, current.id, 'knowledge_gaps', [
        { id: 'kg-current', title: 'Current' },
      ]);

      // Legacy variable (NULL FK)
      await createVariableWithArtifact(testProject.id, null, 'knowledge_gaps', [
        { id: 'kg-legacy', title: 'Legacy' },
      ]);

      // Failed artifact variable
      const { artifact: failed } = await createRunAndArtifact(
        testProject.id, testActor.id, 'failed', 'm7b-failed',
      );
      await createVariableWithArtifact(testProject.id, failed.id, 'knowledge_gaps', [
        { id: 'kg-failed', title: 'Failed' },
      ]);

      const result = await readDiscoveryVariablesByProject(testProject.id, 'desk-research');

      // Should have current artifact and default (legacy)
      expect(result.artifacts[`artifact-${current.id}`]).toBeDefined();
      expect(result.artifacts['default']).toBeDefined();

      // Should NOT have failed artifact
      expect(result.artifacts[`artifact-${failed.id}`]).toBeUndefined();
    });
  });
});
