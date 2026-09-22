/**
 * Workspace Projection Tests — Phase 4
 *
 * Tests for the workspace projection adapters that transform
 * canonical artifact state into normalized view models for React.
 */

import {
  projectBriefToWorkspace,
  projectPlanToWorkspace,
  type BriefProjectionInput,
  type PlanProjectionInput,
} from '../workspace-projection';

// ─── Test Fixtures ─────────────────────────────────────────────────

const mockBriefInput: BriefProjectionInput = {
  study: {
    public_id: 'study-123',
    name: 'Mobile Navigation Study',
    created_at: '2026-01-15T10:00:00Z',
  },
  brief_status: 'pending_approval',
  brief_reviewer_display_name: 'Jane Approver',
  brief_url: 'https://github.com/org/repo/path/to/brief.md',
  prose_sections: {
    summary: 'This study investigates how Veterans navigate the VA mobile app.',
    problem_narrative: 'Veterans face challenges finding key services.',
    method_prose: 'We chose moderated interviews for deep exploration.',
    participants_prose: 'We will recruit 8 Veterans who regularly use the app.',
    out_of_scope: 'Desktop website experience is out of scope.',
    risks: JSON.stringify([
      { risk: 'Low recruitment', source: 'Historical data', mitigation: 'Start early' },
      { risk: 'Technical issues', source: 'Remote testing', mitigation: 'Backup plan' },
    ]),
  },
  cascade_fields: {
    methodology_selection: 'moderated_interviews',
    participant_approach: '8 Veterans who use the mobile app regularly',
    decision_deadline: 'February 28, 2026',
    budget: '$5,000',
    timeline_phases: JSON.stringify([
      { phase: 'Planning', dates: 'Jan 1 – Jan 7, 2026', duration: '1 week' },
      { phase: 'Recruitment', dates: 'Jan 8 – Jan 21, 2026', duration: '2 weeks' },
      { phase: 'Sessions', dates: 'Jan 22 – Feb 4, 2026', duration: '2 weeks' },
      { phase: 'Analysis', dates: 'Feb 5 – Feb 18, 2026', duration: '2 weeks' },
    ]),
    research_objectives: JSON.stringify([
      { id: 'OBJ-001', objective: 'Understand navigation patterns' },
      { id: 'OBJ-002', objective: 'Identify pain points' },
    ]),
    research_questions: JSON.stringify([
      { id: 'RQ-001', question: 'How do Veterans find health services?', priority: 'Primary' },
      { id: 'RQ-002', question: 'What navigation patterns are most common?', priority: 'Secondary' },
    ]),
    target_barriers: JSON.stringify([
      { id: 'TB-001', barrier: 'Complex menu structure', source: 'Stakeholder interviews' },
    ]),
    requestor_name: 'John Stakeholder',
  },
  structured_fields: {
    participant_segments: [
      { segment: 'Active users', count: 5, rationale: 'Regular app usage' },
      { segment: 'Occasional users', count: 3, rationale: 'Less frequent usage' },
    ],
  },
  artifact_metadata: {
    public_id: 'artifact-456',
    content_version: 2,
    template_id: 'research_brief',
    template_version: 'v7.1',
  },
};

const mockPlanInput: PlanProjectionInput = {
  study: {
    public_id: 'study-123',
    name: 'Mobile Navigation Study',
    created_at: '2026-01-15T10:00:00Z',
  },
  plan_url: 'https://github.com/org/repo/path/to/plan.md',
  plan_created_at: '2026-01-20T10:00:00Z',
  prose_sections: {
    plan_summary: 'This plan outlines the execution strategy.',
    plan_background: 'The VA mobile app has seen increased adoption.',
    plan_method_approach: 'We will conduct 60-minute moderated interviews.',
    plan_session_format: 'Each session includes warm-up and tasks.',
    plan_data_collection: 'Screen recording and notes.',
    plan_participants_prose: 'We need active VA mobile app users.',
    plan_deliverables: '- Session summaries\n- Research readout',
    plan_risks: JSON.stringify([
      { risk: 'Schedule delays', likelihood: 'Medium', mitigation: 'Buffer time' },
      { risk: 'No-shows', likelihood: 'Low', mitigation: 'Overrecruit' },
    ]),
    plan_commitments: JSON.stringify([
      { commitment: 'OBJ-001', address: 'Session questions address this' },
    ]),
  },
  inherited_context: {
    methodology_selection: 'moderated_interviews',
    participant_approach: '8 Veterans who use the app',
    timeline_phases: JSON.stringify([
      { phase: 'Planning', dates: 'Jan 1 – Jan 7, 2026', duration: '1 week' },
      { phase: 'Sessions', dates: 'Jan 22 – Feb 4, 2026', duration: '2 weeks' },
    ]),
    research_objectives: JSON.stringify([
      { id: 'OBJ-001', objective: 'Understand navigation patterns' },
    ]),
    research_questions: JSON.stringify([
      { id: 'RQ-001', question: 'How do Veterans find health services?', priority: 'Primary' },
    ]),
    budget: '$5,000',
  },
  study_metadata: {
    researcher_name: 'Jane Researcher',
    created_at: '2026-01-20T10:00:00Z',
  },
  artifact_metadata: {
    public_id: 'artifact-789',
    content_version: 1,
    template_id: 'research_plan',
    template_version: 'v7.2',
  },
};

// ─── Brief Projection Tests ────────────────────────────────────────

describe('projectBriefToWorkspace', () => {
  describe('Quick Facts', () => {
    it('derives Method fact from methodology_selection', () => {
      const vm = projectBriefToWorkspace(mockBriefInput);

      expect(vm.quickFacts.method.label).toBe('Method');
      expect(vm.quickFacts.method.value).toBe('moderated interviews');
      expect(vm.quickFacts.method.exists).toBe(true);
    });

    it('derives Participants fact from participant_segments count', () => {
      const vm = projectBriefToWorkspace(mockBriefInput);

      // 5 + 3 = 8 participants from segments
      expect(vm.quickFacts.participants.label).toBe('Participants');
      expect(vm.quickFacts.participants.value).toBe('8 participants');
      expect(vm.quickFacts.participants.sub).toBe('2 segments');
      expect(vm.quickFacts.participants.exists).toBe(true);
    });

    it('derives Participants fact from participant_approach when no segments', () => {
      const input = { ...mockBriefInput, structured_fields: {} };
      const vm = projectBriefToWorkspace(input);

      expect(vm.quickFacts.participants.value).toBe('8 participants');
    });

    it('derives Timeline fact from phases', () => {
      const vm = projectBriefToWorkspace(mockBriefInput);

      expect(vm.quickFacts.timeline.label).toBe('Timeline');
      expect(vm.quickFacts.timeline.value).toBe('7 weeks');
      expect(vm.quickFacts.timeline.sub).toBe('Jan 1 – Feb 18, 2026');
      expect(vm.quickFacts.timeline.exists).toBe(true);
    });

    it('includes Decision deadline when present', () => {
      const vm = projectBriefToWorkspace(mockBriefInput);

      expect(vm.quickFacts.decisionDeadline.label).toBe('Decision deadline');
      expect(vm.quickFacts.decisionDeadline.value).toBe('February 28, 2026');
      expect(vm.quickFacts.decisionDeadline.exists).toBe(true);
    });

    it('includes Budget when present', () => {
      const vm = projectBriefToWorkspace(mockBriefInput);

      expect(vm.quickFacts.budget.label).toBe('Budget');
      expect(vm.quickFacts.budget.value).toBe('$5,000');
      expect(vm.quickFacts.budget.exists).toBe(true);
    });

    it('marks Budget as not existing when absent', () => {
      const input = {
        ...mockBriefInput,
        cascade_fields: { ...mockBriefInput.cascade_fields, budget: null },
      };
      const vm = projectBriefToWorkspace(input);

      expect(vm.quickFacts.budget.exists).toBe(false);
    });
  });

  describe('Prose Sections', () => {
    it('includes summary prose with correct provenance', () => {
      const vm = projectBriefToWorkspace(mockBriefInput);

      expect(vm.sections.summary.content).toContain('Veterans navigate');
      expect(vm.sections.summary.provenance.authority).toBe('generated');
      expect(vm.sections.summary.provenance.editable).toBe(true);
      expect(vm.sections.summary.exists).toBe(true);
    });

    it('marks out_of_scope as editable', () => {
      const vm = projectBriefToWorkspace(mockBriefInput);

      expect(vm.sections.outOfScope.provenance.editable).toBe(true);
    });
  });

  describe('Structured Data', () => {
    it('parses research_objectives with stable IDs', () => {
      const vm = projectBriefToWorkspace(mockBriefInput);

      expect(vm.objectives.items).toHaveLength(2);
      expect(vm.objectives.items[0].id).toBe('OBJ-001');
      expect(vm.objectives.items[0].objective).toBe('Understand navigation patterns');
      expect(vm.objectives.count).toBe(2);
    });

    it('parses research_questions with priority', () => {
      const vm = projectBriefToWorkspace(mockBriefInput);

      expect(vm.questions.items).toHaveLength(2);
      expect(vm.questions.items[0].priority).toBe('Primary');
    });

    it('parses target_barriers with source', () => {
      const vm = projectBriefToWorkspace(mockBriefInput);

      expect(vm.barriers.items).toHaveLength(1);
      expect(vm.barriers.items[0].source).toBe('Stakeholder interviews');
    });

    it('parses risks table', () => {
      const vm = projectBriefToWorkspace(mockBriefInput);

      expect(vm.risks.items).toHaveLength(2);
      expect(vm.risks.items[0].risk).toBe('Low recruitment');
      expect(vm.risks.items[0].mitigation).toBe('Start early');
    });
  });

  describe('Approval State', () => {
    it('derives isPendingApproval from brief_status', () => {
      const vm = projectBriefToWorkspace(mockBriefInput);

      expect(vm.approval.isPendingApproval).toBe(true);
      expect(vm.approval.isApproved).toBe(false);
      expect(vm.approval.isChangesRequested).toBe(false);
    });

    it('derives isApproved when status is approved', () => {
      const input = { ...mockBriefInput, brief_status: 'approved' as const };
      const vm = projectBriefToWorkspace(input);

      expect(vm.approval.isApproved).toBe(true);
      expect(vm.masthead.statusDisplay).toBe('Approved');
    });
  });

  describe('Optional Sections', () => {
    it('omits discoverySources when empty', () => {
      const vm = projectBriefToWorkspace(mockBriefInput);

      expect(vm.discoverySources).toBeUndefined();
    });

    it('includes discoverySources when present', () => {
      const input = {
        ...mockBriefInput,
        structured_fields: {
          ...mockBriefInput.structured_fields,
          discovery_sources: [
            { prefix: 'D1', source: 'Survey', type: 'quantitative', findings: 'Key finding' },
          ],
        },
      };
      const vm = projectBriefToWorkspace(input);

      expect(vm.discoverySources).toBeDefined();
      expect(vm.discoverySources?.items).toHaveLength(1);
    });
  });

  describe('Authority/Editability', () => {
    it('marks objectives as cascade authority', () => {
      const vm = projectBriefToWorkspace(mockBriefInput);

      expect(vm.objectives.provenance.authority).toBe('canonical');
      expect(vm.objectives.provenance.editable).toBe(false);
    });

    it('marks risks as generated and non-editable', () => {
      const vm = projectBriefToWorkspace(mockBriefInput);

      expect(vm.risks.provenance.authority).toBe('generated');
      expect(vm.risks.provenance.editable).toBe(false);
    });

    it('marks timeline as computed and non-editable', () => {
      const vm = projectBriefToWorkspace(mockBriefInput);

      expect(vm.timeline.provenance.authority).toBe('computed');
      expect(vm.timeline.provenance.editable).toBe(false);
    });
  });

  describe('Artifact Metadata', () => {
    it('includes artifact public_id and version', () => {
      const vm = projectBriefToWorkspace(mockBriefInput);

      expect(vm.artifact.publicId).toBe('artifact-456');
      expect(vm.artifact.contentVersion).toBe(2);
      expect(vm.artifact.templateId).toBe('research_brief');
    });
  });
});

// ─── Plan Projection Tests ─────────────────────────────────────────

describe('projectPlanToWorkspace', () => {
  describe('Quick Facts', () => {
    it('derives Method fact from inherited methodology_selection', () => {
      const vm = projectPlanToWorkspace(mockPlanInput);

      expect(vm.quickFacts.method.value).toBe('moderated interviews');
    });

    it('derives concise Participants fact from participant_approach', () => {
      const vm = projectPlanToWorkspace(mockPlanInput);

      expect(vm.quickFacts.participants.value).toBe('8 participants');
    });

    it('omits Sessions Quick Fact when no canonical data (#377)', () => {
      const vm = projectPlanToWorkspace(mockPlanInput);

      // session_format and session_duration are unsupported
      expect(vm.quickFacts.sessions.exists).toBe(false);
    });

    it('includes Sessions when canonical data exists', () => {
      const input = {
        ...mockPlanInput,
        inherited_context: {
          ...mockPlanInput.inherited_context,
          session_duration: '60 minutes',
          session_format: 'Remote moderated',
        },
      };
      const vm = projectPlanToWorkspace(input);

      expect(vm.quickFacts.sessions.exists).toBe(true);
      expect(vm.quickFacts.sessions.value).toBe('60 minutes');
      expect(vm.quickFacts.sessions.sub).toBe('Remote moderated');
    });

    it('derives Timeline fact from phases', () => {
      const vm = projectPlanToWorkspace(mockPlanInput);

      expect(vm.quickFacts.timeline.value).toBe('3 weeks');
    });
  });

  describe('Inherited Fields (read-only)', () => {
    it('marks objectives as inherited and non-editable', () => {
      const vm = projectPlanToWorkspace(mockPlanInput);

      expect(vm.objectives.provenance.authority).toBe('inherited');
      expect(vm.objectives.provenance.editable).toBe(false);
      expect(vm.objectives.provenance.label).toContain('READ-ONLY');
    });

    it('marks questions as inherited and non-editable', () => {
      const vm = projectPlanToWorkspace(mockPlanInput);

      expect(vm.questions.provenance.authority).toBe('inherited');
      expect(vm.questions.provenance.editable).toBe(false);
    });

    it('marks timeline as inherited and non-editable', () => {
      const vm = projectPlanToWorkspace(mockPlanInput);

      expect(vm.timeline.provenance.authority).toBe('inherited');
      expect(vm.timeline.provenance.editable).toBe(false);
    });
  });

  describe('Plan-specific Structured Data', () => {
    it('parses risks with likelihood column (Plan schema)', () => {
      const vm = projectPlanToWorkspace(mockPlanInput);

      expect(vm.risks.items).toHaveLength(2);
      expect(vm.risks.items[0].likelihood).toBe('Medium');
    });

    it('parses brief_commitments table', () => {
      const vm = projectPlanToWorkspace(mockPlanInput);

      expect(vm.commitments.items).toHaveLength(1);
      expect(vm.commitments.items[0].commitment).toBe('OBJ-001');
      expect(vm.commitments.provenance.authority).toBe('system');
    });
  });

  describe('Artifact Metadata', () => {
    it('derives version display from content_version', () => {
      const vm = projectPlanToWorkspace(mockPlanInput);

      expect(vm.masthead.versionDisplay).toBe('Current · v1');
    });
  });

  describe('Unsupported Fields (#377)', () => {
    it('omits compensation when not present', () => {
      const vm = projectPlanToWorkspace(mockPlanInput);

      expect(vm.compensation).toBeNull();
    });

    it('includes compensation only when canonical value exists', () => {
      const input = {
        ...mockPlanInput,
        inherited_context: {
          ...mockPlanInput.inherited_context,
          compensation: '$75 per participant',
        },
      };
      const vm = projectPlanToWorkspace(input);

      expect(vm.compensation).toBe('$75 per participant');
    });
  });
});

// ─── Shared Behavior Tests ─────────────────────────────────────────

describe('Projection shared behavior', () => {
  it('never fabricates unsupported data', () => {
    // Empty input should not invent values
    const minimalInput: BriefProjectionInput = {
      study: { name: 'Test Study' },
      cascade_fields: {},
    };
    const vm = projectBriefToWorkspace(minimalInput);

    expect(vm.quickFacts.method.exists).toBe(false);
    expect(vm.quickFacts.method.value).toBe('');
    expect(vm.quickFacts.budget.exists).toBe(false);
    expect(vm.objectives.items).toHaveLength(0);
    expect(vm.risks.items).toHaveLength(0);
  });

  it('long prose never becomes Quick Fact', () => {
    const input: BriefProjectionInput = {
      study: { name: 'Test Study' },
      cascade_fields: {
        participant_approach: 'This is a very long prose description that contains much more than just a number and a population segment, it goes on and on with detailed requirements and criteria that should never be shown in a Quick Fact card because it would be too long and confusing for users.',
      },
    };
    const vm = projectBriefToWorkspace(input);

    // Should not use the full prose as Quick Fact value
    // Should either extract a count or omit
    const factValue = vm.quickFacts.participants.value;
    expect(factValue.length).toBeLessThan(50);
  });

  it('preserves stable IDs in structured items', () => {
    const vm = projectBriefToWorkspace(mockBriefInput);

    // IDs should be exactly as provided
    expect(vm.objectives.items[0].id).toBe('OBJ-001');
    expect(vm.objectives.items[1].id).toBe('OBJ-002');
    expect(vm.questions.items[0].id).toBe('RQ-001');
    expect(vm.barriers.items[0].id).toBe('TB-001');
  });

  it('handles malformed JSON gracefully', () => {
    const input: BriefProjectionInput = {
      study: { name: 'Test Study' },
      cascade_fields: {
        research_objectives: 'not valid json',
        timeline_phases: '{ broken',
      },
    };
    const vm = projectBriefToWorkspace(input);

    // Should return empty arrays, not crash
    expect(vm.objectives.items).toEqual([]);
    expect(vm.timeline.phases).toEqual([]);
  });
});
