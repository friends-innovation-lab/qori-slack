/**
 * NAV-1c: studyStatus derivation tests.
 *
 * Tests status derivation logic for Study Overview:
 * - deriveAttentionItems: study-level attention items (neutral, no user assignment)
 * - deriveLifecycleGroupStatuses: lifecycle group status lines
 */

import { describe, it, expect } from 'vitest';
import {
  deriveAttentionItems,
  deriveLifecycleGroupStatuses,
} from '../studyStatus';
import type { DiscoveryCounts } from '../LifecycleRail';

const studyPublicId = 'study-123';

describe('deriveAttentionItems', () => {
  describe('brief approval (neutral wording)', () => {
    it('returns brief approval item when status is pending_approval', () => {
      const items = deriveAttentionItems(studyPublicId, 'pending_approval', undefined);

      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        id: 'brief-approval',
        label: 'Research brief awaiting approval', // Neutral - not "needs your approval"
        action: 'View', // Neutral - not "Review" which implies authority
        href: '/studies/study-123/brief',
      });
    });

    it('returns brief changes item when status is changes_requested', () => {
      const items = deriveAttentionItems(studyPublicId, 'changes_requested', undefined);

      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        id: 'brief-changes',
        label: 'Research brief has requested changes',
        action: 'View', // Neutral - not "Edit" which assumes authorship
      });
    });

    it('returns empty when brief is approved', () => {
      const items = deriveAttentionItems(studyPublicId, 'approved', undefined);
      expect(items).toHaveLength(0);
    });

    it('returns empty when no brief exists', () => {
      const items = deriveAttentionItems(studyPublicId, null, undefined);
      expect(items).toHaveLength(0);
    });
  });

  describe('discovery review queue (neutral wording)', () => {
    it('returns desk review item when desk needs review', () => {
      const counts: DiscoveryCounts = {
        desk: 5,
        stakeholder: 2,
        survey: 0,
        needsReview: { desk: true, stakeholder: false, survey: false },
      };

      const items = deriveAttentionItems(studyPublicId, null, counts);

      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        id: 'discovery-review-desk',
        label: 'Desk research has failed analysis', // Neutral - states fact
        sublabel: 'May need retry or different files',
        action: 'View',
        href: '/studies/study-123/discovery/desk',
      });
    });

    it('returns multiple review items when multiple types need review', () => {
      const counts: DiscoveryCounts = {
        desk: 5,
        stakeholder: 2,
        survey: 1,
        needsReview: { desk: true, stakeholder: true, survey: false },
      };

      const items = deriveAttentionItems(studyPublicId, null, counts);

      expect(items).toHaveLength(2);
      expect(items.map((i) => i.id)).toContain('discovery-review-desk');
      expect(items.map((i) => i.id)).toContain('discovery-review-stakeholder');
    });
  });

  describe('priority and limits', () => {
    it('prioritizes brief approval over discovery review', () => {
      const counts: DiscoveryCounts = {
        desk: 5,
        stakeholder: null,
        survey: null,
        needsReview: { desk: true, stakeholder: false, survey: false },
      };

      const items = deriveAttentionItems(studyPublicId, 'pending_approval', counts);

      expect(items[0].id).toBe('brief-approval');
      expect(items[1].id).toBe('discovery-review-desk');
    });

    it('limits to top 3 items', () => {
      const counts: DiscoveryCounts = {
        desk: 5,
        stakeholder: 2,
        survey: 1,
        needsReview: { desk: true, stakeholder: true, survey: true },
      };

      const items = deriveAttentionItems(studyPublicId, 'pending_approval', counts);

      expect(items).toHaveLength(3);
      // First should be brief (priority 1), then first 2 discovery reviews (priority 2)
      expect(items[0].id).toBe('brief-approval');
    });
  });
});

describe('deriveLifecycleGroupStatuses', () => {
  describe('discovery group', () => {
    it('shows "No evidence yet" when no counts', () => {
      const groups = deriveLifecycleGroupStatuses(studyPublicId, null, undefined);
      const discovery = groups.find((g) => g.group === 'Discovery');

      expect(discovery?.status).toBe('No evidence yet');
      expect(discovery?.action?.label).toBe('Add evidence');
    });

    it('shows artifact count when evidence exists', () => {
      const counts: DiscoveryCounts = {
        desk: 3,
        stakeholder: 2,
        survey: 0,
        needsReview: { desk: false, stakeholder: false, survey: false },
      };

      const groups = deriveLifecycleGroupStatuses(studyPublicId, null, counts);
      const discovery = groups.find((g) => g.group === 'Discovery');

      expect(discovery?.status).toBe('5 artifacts');
      expect(discovery?.statusMuted).toBe('3 desk, 2 stakeholder');
      expect(discovery?.action?.label).toBe('View evidence');
    });

    it('shows review count in muted text when items need review', () => {
      const counts: DiscoveryCounts = {
        desk: 3,
        stakeholder: 2,
        survey: 0,
        needsReview: { desk: true, stakeholder: false, survey: false },
      };

      const groups = deriveLifecycleGroupStatuses(studyPublicId, null, counts);
      const discovery = groups.find((g) => g.group === 'Discovery');

      expect(discovery?.statusMuted).toBe('1 needs review');
    });

    it('pluralizes correctly for single artifact', () => {
      const counts: DiscoveryCounts = {
        desk: 1,
        stakeholder: 0,
        survey: 0,
        needsReview: { desk: false, stakeholder: false, survey: false },
      };

      const groups = deriveLifecycleGroupStatuses(studyPublicId, null, counts);
      const discovery = groups.find((g) => g.group === 'Discovery');

      expect(discovery?.status).toBe('1 artifact');
    });
  });

  describe('planning group', () => {
    it('shows "Brief not started" with create action when no brief', () => {
      const groups = deriveLifecycleGroupStatuses(studyPublicId, null, undefined);
      const planning = groups.find((g) => g.group === 'Planning');

      expect(planning?.status).toBe('Brief not started');
      expect(planning?.action?.label).toBe('Create brief');
      expect(planning?.action?.href).toBe('/studies/study-123/brief/new');
    });

    it('shows "Brief pending approval" with view action', () => {
      const groups = deriveLifecycleGroupStatuses(studyPublicId, 'pending_approval', undefined);
      const planning = groups.find((g) => g.group === 'Planning');

      expect(planning?.status).toBe('Brief pending approval');
      expect(planning?.action?.label).toBe('View brief');
    });

    it('shows "Brief has changes requested" with view action', () => {
      const groups = deriveLifecycleGroupStatuses(studyPublicId, 'changes_requested', undefined);
      const planning = groups.find((g) => g.group === 'Planning');

      expect(planning?.status).toBe('Brief has changes requested');
      expect(planning?.action?.label).toBe('View brief');
    });

    it('shows "Brief approved" with create plan action when approved', () => {
      const groups = deriveLifecycleGroupStatuses(studyPublicId, 'approved', undefined);
      const planning = groups.find((g) => g.group === 'Planning');

      expect(planning?.status).toBe('Brief approved');
      expect(planning?.statusMuted).toBe('Plan not started');
      expect(planning?.action?.label).toBe('Create plan');
      expect(planning?.action?.href).toBe('/studies/study-123/plan/new');
    });
  });

  describe('unqueried groups (truthful - no false claims)', () => {
    const unqueriedGroups = ['Fieldwork', 'Analysis', 'Outputs'];

    it.each(unqueriedGroups)('%s shows neutral status (no query available)', (groupName) => {
      const groups = deriveLifecycleGroupStatuses(studyPublicId, null, undefined);
      const group = groups.find((g) => g.group === groupName);

      // Shows "—" not "Not started" since we have no query to verify
      expect(group?.status).toBe('—');
      expect(group?.action).toBeUndefined();
    });
  });

  describe('returns all 5 groups', () => {
    it('returns Discovery, Planning, Fieldwork, Analysis, Outputs', () => {
      const groups = deriveLifecycleGroupStatuses(studyPublicId, null, undefined);

      expect(groups).toHaveLength(5);
      expect(groups.map((g) => g.group)).toEqual([
        'Discovery',
        'Planning',
        'Fieldwork',
        'Analysis',
        'Outputs',
      ]);
    });
  });
});
