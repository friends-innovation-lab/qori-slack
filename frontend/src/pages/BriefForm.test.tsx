/**
 * BriefForm tests — verifies submission targets the correct study-scoped API route.
 */

import { describe, it, expect, vi } from 'vitest';

describe('useSubmitBrief route contract', () => {
  it('posts to studies/:studyPublicId/brief, not projects/:id/briefs', () => {
    // Structural test: verify the mutation hook source uses the canonical study-scoped route
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../api/mutations/useSubmitBrief.ts'),
      'utf8',
    );
    // Canonical: studies/${studyPublicId}/brief
    expect(source).toContain('studies/${studyPublicId}/brief');
    // Must NOT use project-scoped briefs route
    expect(source).not.toContain('projects/');
    expect(source).not.toContain('/briefs');
  });

  it('hook parameter is named studyPublicId, not projectPublicId', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../api/mutations/useSubmitBrief.ts'),
      'utf8',
    );
    expect(source).toContain('studyPublicId: string');
    expect(source).not.toContain('projectPublicId');
  });
});

describe('BriefForm wiring', () => {
  it('passes studyPublicId (not project) to useSubmitBrief', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, './BriefForm.tsx'),
      'utf8',
    );
    // Must use studyPublicId from URL params
    expect(source).toMatch(/useSubmitBrief\(\s*studyPublicId/);
    // Must NOT use project_public_id
    expect(source).not.toMatch(/useSubmitBrief\(\s*study\?\.project_public_id/);
  });
});
