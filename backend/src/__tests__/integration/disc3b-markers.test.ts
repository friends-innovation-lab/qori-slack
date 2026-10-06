/**
 * DISC-3B Integration Tests: Stable Markers
 *
 * Tests for marker allocation, concurrency protection, and API exposure.
 */

import { getTestDb, truncateAll, TEST_ORG_ID } from './setup/testDb';
import * as runService from '../../services/discovery-run.service';
import * as markerService from '../../services/discovery-marker.service';

const sequelize = getTestDb();

// Test fixtures
let testProjectId: number;
let testProjectId2: number;
let testActorId: number;

beforeEach(async () => {
  await truncateAll();

  const Project = sequelize.models.Project;
  const Actor = sequelize.models.Actor;

  // Create test actor
  const actor = await Actor.create({
    display_name: 'DISC-3B Test User',
    status: 'active',
    organization_id: TEST_ORG_ID,
  });
  testActorId = (actor as unknown as { id: number }).id;

  // Create test projects
  const project1 = await Project.create({
    organization_id: TEST_ORG_ID,
    name: 'Marker Test Project 1',
    slug: 'marker-test-project-1',
    problem_statement: 'Test problem',
    created_by: testActorId,
  });
  testProjectId = (project1 as unknown as { id: number }).id;

  const project2 = await Project.create({
    organization_id: TEST_ORG_ID,
    name: 'Marker Test Project 2',
    slug: 'marker-test-project-2',
    problem_statement: 'Test problem',
    created_by: testActorId,
  });
  testProjectId2 = (project2 as unknown as { id: number }).id;
});

describe('DISC-3B Markers', () => {
  describe('Marker Allocation', () => {
    it('allocates D1 for first desk run in project', async () => {
      const run = await runService.createDiscoveryRun({
        projectId: testProjectId,
        discoveryType: 'desk_research',
        topic: 'Test Topic',
        topicSlug: 'test-topic-d1',
        sourceIntent: null,
        actorId: testActorId,
        createdByIdentity: 'test:marker-test',
      });

      expect(run.marker_index).toBe(1);
      expect(markerService.formatMarker('desk_research', run.marker_index)).toBe('D1');
    });

    it('allocates D2 for second desk run in same project', async () => {
      // Create first run
      await runService.createDiscoveryRun({
        projectId: testProjectId,
        discoveryType: 'desk_research',
        topic: 'Test Topic 1',
        topicSlug: 'test-topic-d1',
        sourceIntent: null,
        actorId: testActorId,
        createdByIdentity: 'test:marker-test',
      });

      // Create second run
      const run = await runService.createDiscoveryRun({
        projectId: testProjectId,
        discoveryType: 'desk_research',
        topic: 'Test Topic 2',
        topicSlug: 'test-topic-d2',
        sourceIntent: null,
        actorId: testActorId,
        createdByIdentity: 'test:marker-test',
      });

      expect(run.marker_index).toBe(2);
      expect(markerService.formatMarker('desk_research', run.marker_index)).toBe('D2');
    });

    it('allocates S1 for first stakeholder run (different type counter)', async () => {
      // Create desk run first
      await runService.createDiscoveryRun({
        projectId: testProjectId,
        discoveryType: 'desk_research',
        topic: 'Desk Topic',
        topicSlug: 'desk-topic',
        sourceIntent: null,
        actorId: testActorId,
        createdByIdentity: 'test:marker-test',
      });

      // Create stakeholder run
      const run = await runService.createDiscoveryRun({
        projectId: testProjectId,
        discoveryType: 'stakeholder_synthesis',
        topic: 'Stakeholder Topic',
        topicSlug: 'stakeholder-topic-s1',
        sourceIntent: null,
        actorId: testActorId,
        createdByIdentity: 'test:marker-test',
      });

      expect(run.marker_index).toBe(1);
      expect(markerService.formatMarker('stakeholder_synthesis', run.marker_index)).toBe('S1');
    });

    it('allocates V1 for first survey run (different type counter)', async () => {
      const run = await runService.createDiscoveryRun({
        projectId: testProjectId,
        discoveryType: 'survey_synthesis',
        topic: 'Survey Topic',
        topicSlug: 'survey-topic-v1',
        sourceIntent: null,
        actorId: testActorId,
        createdByIdentity: 'test:marker-test',
      });

      expect(run.marker_index).toBe(1);
      expect(markerService.formatMarker('survey_synthesis', run.marker_index)).toBe('V1');
    });

    it('allocates D1 independently in different project', async () => {
      // Create D1 in project 1
      await runService.createDiscoveryRun({
        projectId: testProjectId,
        discoveryType: 'desk_research',
        topic: 'Project 1 Topic',
        topicSlug: 'project1-topic',
        sourceIntent: null,
        actorId: testActorId,
        createdByIdentity: 'test:marker-test',
      });

      // Create D1 in project 2 (should also be D1)
      const run = await runService.createDiscoveryRun({
        projectId: testProjectId2,
        discoveryType: 'desk_research',
        topic: 'Project 2 Topic',
        topicSlug: 'project2-topic-d1',
        sourceIntent: null,
        actorId: testActorId,
        createdByIdentity: 'test:marker-test',
      });

      expect(run.marker_index).toBe(1);
      expect(markerService.formatMarker('desk_research', run.marker_index)).toBe('D1');
    });
  });

  describe('Marker Formatting', () => {
    it('formats desk research as D prefix', () => {
      expect(markerService.formatMarker('desk_research', 1)).toBe('D1');
      expect(markerService.formatMarker('desk_research', 42)).toBe('D42');
    });

    it('formats stakeholder synthesis as S prefix', () => {
      expect(markerService.formatMarker('stakeholder_synthesis', 1)).toBe('S1');
      expect(markerService.formatMarker('stakeholder_synthesis', 5)).toBe('S5');
    });

    it('formats survey synthesis as V prefix', () => {
      expect(markerService.formatMarker('survey_synthesis', 1)).toBe('V1');
      expect(markerService.formatMarker('survey_synthesis', 10)).toBe('V10');
    });

    it('returns null for null marker_index', () => {
      expect(markerService.formatMarker('desk_research', null)).toBeNull();
    });
  });

  describe('Concurrency Protection', () => {
    it('allocates unique markers under concurrent allocation', async () => {
      // Simulate 5 concurrent run creations
      const promises = Array.from({ length: 5 }, (_, i) =>
        runService.createDiscoveryRun({
          projectId: testProjectId,
          discoveryType: 'desk_research',
          topic: `Concurrent Topic ${i}`,
          topicSlug: `concurrent-topic-${i}`,
          sourceIntent: null,
          actorId: testActorId,
          createdByIdentity: 'test:concurrency-test',
        }),
      );

      const runs = await Promise.all(promises);

      // All markers should be unique
      const markers = runs.map(r => r.marker_index).filter(m => m !== null) as number[];
      const uniqueMarkers = new Set(markers);

      expect(uniqueMarkers.size).toBe(5);
      expect(markers.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('DB Uniqueness Constraint', () => {
    it('enforces unique (project_id, discovery_type, marker_index)', async () => {
      const DiscoveryRunModel = sequelize.models.DiscoveryRun;

      // Create a run
      const firstRun = await runService.createDiscoveryRun({
        projectId: testProjectId,
        discoveryType: 'desk_research',
        topic: 'First Topic',
        topicSlug: 'first-topic',
        sourceIntent: null,
        actorId: testActorId,
        createdByIdentity: 'test:uniqueness-test',
      });

      // Attempt to manually create a run with the same marker_index
      await expect(
        DiscoveryRunModel.create({
          project_id: testProjectId,
          discovery_type: 'desk_research',
          topic: 'Duplicate Marker Test',
          topic_slug: 'duplicate-marker-test',
          source_intent: null,
          status: 'pending',
          actor_id: testActorId,
          created_by_identity: 'test:duplicate-test',
          attempt_count: 1,
          marker_index: firstRun.marker_index, // Duplicate!
        }),
      ).rejects.toThrow();
    });
  });

  describe('Run Marker Helper', () => {
    it('getRunMarker returns formatted marker', async () => {
      const run = await runService.createDiscoveryRun({
        projectId: testProjectId,
        discoveryType: 'desk_research',
        topic: 'Helper Test Topic',
        topicSlug: 'helper-test-topic',
        sourceIntent: null,
        actorId: testActorId,
        createdByIdentity: 'test:helper-test',
      });

      expect(runService.getRunMarker(run)).toBe('D1');
    });
  });

  describe('Sorting Independence', () => {
    it('markers are independent of sorting order', async () => {
      // Create runs in order
      const run1 = await runService.createDiscoveryRun({
        projectId: testProjectId,
        discoveryType: 'desk_research',
        topic: 'Zebra Topic', // Would sort last alphabetically
        topicSlug: 'zebra-topic',
        sourceIntent: null,
        actorId: testActorId,
        createdByIdentity: 'test:sort-test',
      });

      const run2 = await runService.createDiscoveryRun({
        projectId: testProjectId,
        discoveryType: 'desk_research',
        topic: 'Alpha Topic', // Would sort first alphabetically
        topicSlug: 'alpha-topic',
        sourceIntent: null,
        actorId: testActorId,
        createdByIdentity: 'test:sort-test',
      });

      // Markers should be based on creation order, not alphabetical
      expect(run1.marker_index).toBe(1); // D1 - created first
      expect(run2.marker_index).toBe(2); // D2 - created second
    });
  });
});
