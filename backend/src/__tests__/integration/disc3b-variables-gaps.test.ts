/**
 * DISC-3B Integration Tests: Variables and Knowledge Gaps
 *
 * Tests for artifact variables and knowledge gaps service functions.
 */

import { getTestDb, truncateAll, TEST_ORG_ID } from './setup/testDb';
import type { ApplicationContext } from '../../types/application-context';
import * as discoveryAppService from '../../application/discovery.app-service';

const sequelize = getTestDb();

// Test fixtures
let testProjectId: number;
let testActorId: number;
let run1: any;
let artifact1: any;
let run2: any;
let artifact2: any;

function createTestContext(actorId: number): ApplicationContext {
  return {
    actor: {
      id: actorId,
      publicId: `actor-${actorId}`,
      organizationId: TEST_ORG_ID,
      displayName: `Test Actor ${actorId}`,
    },
    organization: {
      id: TEST_ORG_ID,
      publicId: 'test-org',
      slug: 'test-org',
      name: 'Test Organization',
    },
    authenticationProvider: 'local_test',
    correlationId: `test-${Date.now()}`,
  };
}

beforeEach(async () => {
  await truncateAll();

  const Project = sequelize.models.Project;
  const Actor = sequelize.models.Actor;
  const ProjectMembership = sequelize.models.ProjectMembership;
  const DiscoveryRunModel = sequelize.models.DiscoveryRun;
  const DiscoveryArtifactModel = sequelize.models.DiscoveryArtifact;
  const StudyVariableModel = sequelize.models.StudyVariable;

  // Create test actor
  const actor = await Actor.create({
    display_name: 'DISC-3B Variables Test User',
    status: 'active',
    organization_id: TEST_ORG_ID,
  });
  testActorId = (actor as unknown as { id: number }).id;

  // Create test project
  const project = await Project.create({
    organization_id: TEST_ORG_ID,
    name: 'Variables Test Project',
    slug: 'variables-test-project',
    problem_statement: 'Test problem',
    created_by: testActorId,
  });
  testProjectId = (project as unknown as { id: number }).id;

  // Add project membership for authorization
  await ProjectMembership.create({
    project_id: testProjectId,
    actor_id: testActorId,
    role: 'owner',
  });

  // Create discovery run 1 with artifact
  run1 = await DiscoveryRunModel.create({
    project_id: testProjectId,
    discovery_type: 'desk_research',
    topic: 'Test Topic 1',
    topic_slug: 'test-topic-1',
    source_intent: 'Test intent',
    status: 'completed',
    actor_id: testActorId,
    created_by_identity: 'test:vars-test',
    attempt_count: 1,
    marker_index: 1,
  });

  artifact1 = await DiscoveryArtifactModel.create({
    project_id: testProjectId,
    discovery_run_id: run1.id,
    artifact_type: 'desk_research',
    title: 'Test Artifact 1',
    topic_slug: 'test-topic-1',
    version: 1,
    status: 'current',
    canonical_content: '# Test Content 1',
    template_name: 'desk_research',
    actor_id: testActorId,
    generated_by_identity: 'test:vars-test',
  });

  // Create variables for artifact 1
  await StudyVariableModel.bulkCreate([
    {
      project_id: testProjectId,
      variable_key: 'knowledge_gaps',
      value: [
        { id: 'KG-001', gap: 'Need more user research on accessibility' },
        { id: 'KG-002', gap: 'Unclear mobile usage patterns' },
      ],
      source_template: 'desk_research',
      scope: 'discovery',
      discovery_artifact_fk_id: artifact1.id,
    },
    {
      project_id: testProjectId,
      variable_key: 'discovered_barriers',
      value: [
        { id: 'TB-001', barrier: 'Complex navigation', severity: 'high' },
      ],
      source_template: 'desk_research',
      scope: 'discovery',
      discovery_artifact_fk_id: artifact1.id,
    },
  ]);

  // Create discovery run 2 (stakeholder) with artifact
  run2 = await DiscoveryRunModel.create({
    project_id: testProjectId,
    discovery_type: 'stakeholder_synthesis',
    topic: 'Stakeholder Topic',
    topic_slug: 'stakeholder-topic',
    source_intent: 'Stakeholder intent',
    status: 'completed',
    actor_id: testActorId,
    created_by_identity: 'test:vars-test',
    attempt_count: 1,
    marker_index: 1,
  });

  artifact2 = await DiscoveryArtifactModel.create({
    project_id: testProjectId,
    discovery_run_id: run2.id,
    artifact_type: 'stakeholder_synthesis',
    title: 'Stakeholder Artifact',
    topic_slug: 'stakeholder-topic',
    version: 1,
    status: 'current',
    canonical_content: '# Stakeholder Content',
    template_name: 'stakeholder_synthesis',
    actor_id: testActorId,
    generated_by_identity: 'test:vars-test',
  });

  // Create variables for artifact 2 (including knowledge gaps)
  await StudyVariableModel.bulkCreate([
    {
      project_id: testProjectId,
      variable_key: 'knowledge_gaps',
      value: [
        { id: 'SG-001', gap: 'Budget constraints not fully mapped' },
      ],
      source_template: 'stakeholder_synthesis',
      scope: 'discovery',
      discovery_artifact_fk_id: artifact2.id,
    },
    {
      project_id: testProjectId,
      variable_key: 'stakeholder_constraints',
      value: [
        { constraint: 'Limited timeline', source: 'PM interview' },
      ],
      source_template: 'stakeholder_synthesis',
      scope: 'discovery',
      discovery_artifact_fk_id: artifact2.id,
    },
  ]);
});

describe('DISC-3B Variables and Knowledge Gaps', () => {
  describe('getArtifactVariables', () => {
    it('returns variables for artifact with provenance', async () => {
      const ctx = createTestContext(testActorId);
      const result = await discoveryAppService.getArtifactVariables(
        ctx,
        testProjectId,
        artifact1.public_id,
      );

      expect(result).not.toBeNull();
      expect(result!.artifactPublicId).toBe(artifact1.public_id);
      expect(result!.marker).toBe('D1');
      expect(result!.artifactType).toBe('desk_research');
      expect(result!.typeLabel).toBe('Desk Research');
      expect(result!.variables).toBeInstanceOf(Array);
      expect(result!.variables.length).toBe(2);
    });

    it('applies correct labels to variables', async () => {
      const ctx = createTestContext(testActorId);
      const result = await discoveryAppService.getArtifactVariables(
        ctx,
        testProjectId,
        artifact1.public_id,
      );

      const knowledgeGapsVar = result!.variables.find(v => v.key === 'knowledge_gaps');
      expect(knowledgeGapsVar).toBeDefined();
      expect(knowledgeGapsVar!.label).toBe('Knowledge Gaps');

      const barriersVar = result!.variables.find(v => v.key === 'discovered_barriers');
      expect(barriersVar).toBeDefined();
      expect(barriersVar!.label).toBe('Discovered Barriers');
    });

    it('returns null for unknown artifact', async () => {
      const ctx = createTestContext(testActorId);
      const result = await discoveryAppService.getArtifactVariables(
        ctx,
        testProjectId,
        '00000000-0000-0000-0000-000000000000',
      );

      expect(result).toBeNull();
    });

    it('preserves structured values', async () => {
      const ctx = createTestContext(testActorId);
      const result = await discoveryAppService.getArtifactVariables(
        ctx,
        testProjectId,
        artifact1.public_id,
      );

      const barriersVar = result!.variables.find(v => v.key === 'discovered_barriers');
      expect(barriersVar!.value).toBeInstanceOf(Array);
      expect((barriersVar!.value as any[])[0]).toHaveProperty('barrier');
      expect((barriersVar!.value as any[])[0]).toHaveProperty('severity');
    });
  });

  describe('getKnowledgeGaps', () => {
    it('aggregates gaps across all current artifacts', async () => {
      const ctx = createTestContext(testActorId);
      const result = await discoveryAppService.getKnowledgeGaps(ctx, testProjectId);

      expect(result.projectId).toBe(testProjectId);
      expect(result.count).toBe(3); // 2 from desk + 1 from stakeholder
      expect(result.gaps).toBeInstanceOf(Array);
      expect(result.gaps.length).toBe(3);
    });

    it('preserves provenance for each gap', async () => {
      const ctx = createTestContext(testActorId);
      const result = await discoveryAppService.getKnowledgeGaps(ctx, testProjectId);

      // Find a gap from desk research
      const deskGap = result.gaps.find(g => g.gap.includes('accessibility'));
      expect(deskGap).toBeDefined();
      expect(deskGap!.sourceMarker).toBe('D1');
      expect(deskGap!.sourceArtifactPublicId).toBe(artifact1.public_id);
      expect(deskGap!.discoveryType).toBe('desk_research');

      // Find a gap from stakeholder
      const stakeholderGap = result.gaps.find(g => g.gap.includes('Budget'));
      expect(stakeholderGap).toBeDefined();
      expect(stakeholderGap!.sourceMarker).toBe('S1');
      expect(stakeholderGap!.sourceArtifactPublicId).toBe(artifact2.public_id);
      expect(stakeholderGap!.discoveryType).toBe('stakeholder_synthesis');
    });

    it('excludes superseded artifacts', async () => {
      const DiscoveryArtifactModel = sequelize.models.DiscoveryArtifact;

      // First mark old artifact as superseded (before creating new current)
      // This is required because of unique partial index: one current per run
      await artifact1.update({
        status: 'superseded',
        superseded_at: new Date(),
      });

      // Create a superseding artifact (now valid since artifact1 is not current)
      const artifact1v2 = await DiscoveryArtifactModel.create({
        project_id: testProjectId,
        discovery_run_id: run1.id,
        artifact_type: 'desk_research',
        title: 'Test Artifact 1 v2',
        topic_slug: 'test-topic-1',
        version: 2,
        status: 'current',
        canonical_content: '# Test Content 1 v2',
        template_name: 'desk_research',
        actor_id: testActorId,
        generated_by_identity: 'test:vars-test',
      });

      // Update superseded_by_id reference
      await artifact1.update({
        superseded_by_id: (artifact1v2 as any).id,
      });

      const ctx = createTestContext(testActorId);
      const result = await discoveryAppService.getKnowledgeGaps(ctx, testProjectId);

      // Should only have gaps from artifact2 (1)
      // The superseded artifact1's gaps should be excluded
      // artifact1v2 has no variables
      expect(result.count).toBe(1);
      expect(result.gaps.every(g => g.sourceArtifactPublicId === artifact2.public_id)).toBe(true);
    });

    it('returns empty for project with no current artifacts', async () => {
      const Project = sequelize.models.Project;
      const ProjectMembership = sequelize.models.ProjectMembership;

      // Create an empty project
      const emptyProject = await Project.create({
        organization_id: TEST_ORG_ID,
        name: 'Empty Project',
        slug: 'empty-project',
        problem_statement: 'Test',
        created_by: testActorId,
      });
      const emptyProjectId = (emptyProject as any).id;

      // Add membership
      await ProjectMembership.create({
        project_id: emptyProjectId,
        actor_id: testActorId,
        role: 'owner',
      });

      const ctx = createTestContext(testActorId);
      const result = await discoveryAppService.getKnowledgeGaps(ctx, emptyProjectId);

      expect(result.count).toBe(0);
      expect(result.gaps).toEqual([]);
    });
  });

  describe('Marker in API responses', () => {
    it('includes marker in artifact detail', async () => {
      const ctx = createTestContext(testActorId);
      const result = await discoveryAppService.getDiscoveryArtifactByPublicId(
        ctx,
        testProjectId,
        artifact1.public_id,
      );

      expect(result).not.toBeNull();
      expect(result!.marker).toBe('D1');
    });

    it('includes marker in artifact list', async () => {
      const ctx = createTestContext(testActorId);
      const result = await discoveryAppService.listCanonicalDiscoveryArtifacts(
        ctx,
        testProjectId,
      );

      const deskArtifact = result.find(a => a.artifactType === 'desk_research');
      expect(deskArtifact).toBeDefined();
      expect(deskArtifact!.marker).toBe('D1');

      const stakeholderArtifact = result.find(a => a.artifactType === 'stakeholder_synthesis');
      expect(stakeholderArtifact).toBeDefined();
      expect(stakeholderArtifact!.marker).toBe('S1');
    });

    it('includes marker in run list', async () => {
      const ctx = createTestContext(testActorId);
      const result = await discoveryAppService.listDiscoveryRuns(ctx, testProjectId);

      const deskRun = result.find(r => r.discoveryType === 'desk_research');
      expect(deskRun).toBeDefined();
      expect(deskRun!.marker).toBe('D1');

      const stakeholderRun = result.find(r => r.discoveryType === 'stakeholder_synthesis');
      expect(stakeholderRun).toBeDefined();
      expect(stakeholderRun!.marker).toBe('S1');
    });

    it('includes marker in run detail', async () => {
      const ctx = createTestContext(testActorId);
      const result = await discoveryAppService.getDiscoveryRunByPublicId(
        ctx,
        testProjectId,
        run1.public_id,
      );

      expect(result).not.toBeNull();
      expect(result!.marker).toBe('D1');
    });
  });
});
