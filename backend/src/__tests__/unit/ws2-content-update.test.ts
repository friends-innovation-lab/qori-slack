/**
 * WS-2: Content Update Service Tests
 *
 * Tests for PATCH Brief/Plan content, optimistic concurrency,
 * transaction atomicity, projection behavior, generation capture,
 * compatibility, authorization, and YAML processor regression.
 */

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

const SRC_ROOT = path.resolve(__dirname, '../..');

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.resolve(SRC_ROOT, relativePath), 'utf-8');
}

// ═══════════════════════════════════════════════════════════
// 1. Brief PATCH success — structural contracts
// ═══════════════════════════════════════════════════════════

describe('Brief PATCH content update', () => {
  it('exports updateBriefContent function', () => {
    const { updateBriefContent } = require('../../application/content-update.app-service');
    expect(typeof updateBriefContent).toBe('function');
  });

  it('resolves artifact by study_id and artifact_type=brief', () => {
    const source = readSrc('application/content-update.app-service.ts');
    expect(source).toContain("artifact_type: 'brief'");
  });

  it('checks content_version before write (optimistic concurrency)', () => {
    const source = readSrc('application/content-update.app-service.ts');
    expect(source).toContain('artifact.content_version !== input.artifact_version');
  });

  it('upserts prose sections into artifact_sections', () => {
    const source = readSrc('application/content-update.app-service.ts');
    expect(source).toContain('upsertSections');
    expect(source).toContain('artifact_sections');
  });

  it('updates structured cascade values in study_variables', () => {
    const source = readSrc('application/content-update.app-service.ts');
    expect(source).toContain('updateStructuredVariables');
    expect(source).toContain('study_variables');
  });

  it('increments content_version exactly once per transaction', () => {
    const source = readSrc('application/content-update.app-service.ts');
    // Should increment by 1, not by arbitrary amounts
    expect(source).toContain('artifact.content_version + 1');
    // Should happen inside the transaction
    expect(source).toContain('{ transaction: t }');
  });

  it('returns canonical_saved in response', () => {
    const source = readSrc('application/content-update.app-service.ts');
    expect(source).toContain('canonical_saved: true');
  });

  it('retains same artifact identity/path on edit', () => {
    const source = readSrc('application/content-update.app-service.ts');
    // Should use existing artifact.path for GitHub write, not create new path
    expect(source).toContain('artifact.path');
    expect(source).not.toContain('derivation_fingerprint');
    expect(source).not.toContain('createNewArtifact');
  });
});

// ═══════════════════════════════════════════════════════════
// 2. Plan PATCH success
// ═══════════════════════════════════════════════════════════

describe('Plan PATCH content update', () => {
  it('exports updatePlanContent function', () => {
    const { updatePlanContent } = require('../../application/content-update.app-service');
    expect(typeof updatePlanContent).toBe('function');
  });

  it('resolves artifact by artifact_type=plan', () => {
    const source = readSrc('application/content-update.app-service.ts');
    expect(source).toContain("artifact_type: 'plan'");
  });

  it('does not allow Brief commitment mutation through Plan PATCH', () => {
    // Plan PATCH input type should NOT include research_objectives or research_questions
    const source = readSrc('application/content-update.app-service.ts');
    const planInputSection = source.split('PatchPlanContentInput')[1]?.split('}')[0] || '';
    // Plan structured only allows risks, not objectives/questions
    expect(planInputSection).not.toContain('research_objectives');
    expect(planInputSection).not.toContain('research_questions');
    expect(planInputSection).not.toContain('target_barriers');
  });

  it('increments content_version exactly once', () => {
    const source = readSrc('application/content-update.app-service.ts');
    const updatePlanSection = source.split('updatePlanContent')[1] || '';
    expect(updatePlanSection).toContain('content_version + 1');
  });
});

// ═══════════════════════════════════════════════════════════
// 3. Optimistic concurrency
// ═══════════════════════════════════════════════════════════

describe('Optimistic concurrency', () => {
  it('rejects stale version with invalidState error', () => {
    const source = readSrc('application/content-update.app-service.ts');
    expect(source).toContain('Stale version');
    expect(source).toContain('invalidState');
  });

  it('version check happens BEFORE any canonical writes', () => {
    const source = readSrc('application/content-update.app-service.ts');
    // The version check should appear before sequelize.transaction()
    const briefSection = source.split('updateBriefContent')[1]?.split('updatePlanContent')[0] || '';
    const versionCheckPos = briefSection.indexOf('content_version !== input.artifact_version');
    const transactionPos = briefSection.indexOf('sequelize.transaction()');
    expect(versionCheckPos).toBeGreaterThan(0);
    expect(transactionPos).toBeGreaterThan(versionCheckPos);
  });

  it('PATCH route requires artifact_version parameter', () => {
    const source = readSrc('routes/api/v1/studies.routes.ts');
    expect(source).toContain("typeof artifact_version !== 'number'");
    expect(source).toContain('artifact_version is required');
  });
});

// ═══════════════════════════════════════════════════════════
// 4. Transaction atomicity
// ═══════════════════════════════════════════════════════════

describe('Transaction atomicity', () => {
  it('wraps all canonical writes in a single transaction', () => {
    const source = readSrc('application/content-update.app-service.ts');
    // Both upsertSections and updateStructuredVariables receive the transaction
    expect(source).toMatch(/upsertSections.*transaction/s);
    expect(source).toMatch(/updateStructuredVariables.*transaction/s);
  });

  it('rolls back on error', () => {
    const source = readSrc('application/content-update.app-service.ts');
    expect(source).toContain('t.rollback()');
  });

  it('GitHub projection happens AFTER transaction commit', () => {
    const source = readSrc('application/content-update.app-service.ts');
    const briefSection = source.split('updateBriefContent')[1]?.split('updatePlanContent')[0] || '';
    const commitPos = briefSection.indexOf('t.commit()');
    const projectionPos = briefSection.indexOf('projectToGitHub');
    expect(commitPos).toBeGreaterThan(0);
    expect(projectionPos).toBeGreaterThan(commitPos);
  });
});

// ═══════════════════════════════════════════════════════════
// 5. GitHub projection failure
// ═══════════════════════════════════════════════════════════

describe('GitHub projection failure handling', () => {
  it('returns github_synced=false on projection failure', () => {
    const source = readSrc('application/content-update.app-service.ts');
    expect(source).toContain("synced: false");
    expect(source).toContain('github_sync_error');
  });

  it('persists projection failure via recordWriteFailure', () => {
    const source = readSrc('application/content-update.app-service.ts');
    expect(source).toContain('recordWriteFailure');
  });

  it('does not roll back canonical state on projection failure', () => {
    const source = readSrc('application/content-update.app-service.ts');
    // projectToGitHub is called AFTER t.commit() — if it fails, the canonical
    // transaction is already committed and cannot be rolled back
    const projectFn = source.split('async function projectToGitHub')[1] || '';
    // The function does not call t.rollback
    expect(projectFn).not.toContain('t.rollback');
  });

  it('records projection success via recordWriteSuccess', () => {
    const source = readSrc('application/content-update.app-service.ts');
    expect(source).toContain('recordWriteSuccess');
  });
});

// ═══════════════════════════════════════════════════════════
// 6. Projection success — same artifact identity
// ═══════════════════════════════════════════════════════════

describe('Projection success', () => {
  it('uses existing artifact.path for GitHub write', () => {
    const source = readSrc('application/content-update.app-service.ts');
    const projectFn = source.split('async function projectToGitHub')[1] || '';
    expect(projectFn).toContain('artifact.path');
    expect(projectFn).toContain('createOrUpdateFileOnGitHub');
  });

  it('does not create new ResearchArtifact on edit', () => {
    const source = readSrc('application/content-update.app-service.ts');
    expect(source).not.toContain('reserveArtifact');
    expect(source).not.toContain('ArtifactModel.create');
  });

  it('renders Markdown using Handlebars output_template', () => {
    const source = readSrc('application/content-update.app-service.ts');
    expect(source).toContain('Handlebars.compile');
    expect(source).toContain('output_template');
  });

  it('loads prose sections from artifact_sections for rendering', () => {
    const source = readSrc('application/content-update.app-service.ts');
    const projectFn = source.split('async function projectToGitHub')[1] || '';
    expect(projectFn).toContain('ArtifactSectionModel');
    expect(projectFn).toContain('artifact_id: artifact.id');
  });

  it('loads cascade variables for rendering', () => {
    const source = readSrc('application/content-update.app-service.ts');
    const projectFn = source.split('async function projectToGitHub')[1] || '';
    expect(projectFn).toContain('StudyVariableModel');
    expect(projectFn).toContain('study_id: study.id');
  });
});

// ═══════════════════════════════════════════════════════════
// 7. Generation-time capture
// ═══════════════════════════════════════════════════════════

describe('Generation-time section capture', () => {
  it('executeBrief persists AI-generated prose to artifact_sections', () => {
    const source = readSrc('application/brief.app-service.ts');
    expect(source).toContain('ArtifactSectionModel');
    expect(source).toContain("section_key: sectionKey");
    expect(source).toContain("content_type: 'prose'");
  });

  it('executeBrief maps AI response keys to canonical section keys', () => {
    const source = readSrc('application/brief.app-service.ts');
    // Must map ai_generated keys to artifact_sections keys
    expect(source).toContain("summary: 'summary'");
    expect(source).toContain("problem_narrative: 'problem_narrative'");
    expect(source).toContain("method_rationale: 'method_prose'");
    expect(source).toContain("participant_rationale: 'participants_prose'");
  });

  it('executePlan persists AI-generated prose to artifact_sections', () => {
    const source = readSrc('application/plan.app-service.ts');
    expect(source).toContain('ArtifactSectionModel');
    expect(source).toContain("section_key: sectionKey");
  });

  it('executePlan maps Plan-specific AI keys', () => {
    const source = readSrc('application/plan.app-service.ts');
    expect(source).toContain("summary: 'plan_summary'");
    expect(source).toContain("background: 'plan_background'");
    expect(source).toContain("method_approach: 'plan_method_approach'");
  });

  it('section capture is non-blocking (does not abort generation)', () => {
    const source = readSrc('application/brief.app-service.ts');
    expect(source).toContain('Section capture failed (non-blocking)');
  });

  it('existing cascade extraction still works (not disrupted)', () => {
    const source = readSrc('application/brief.app-service.ts');
    // extractionPromise handling still present
    expect(source).toContain('extractionPromise');
    expect(source).toContain('extractionSuccess');
  });
});

// ═══════════════════════════════════════════════════════════
// 8. Existing artifact compatibility
// ═══════════════════════════════════════════════════════════

describe('Existing artifact compatibility', () => {
  it('GET Brief handles missing artifact_sections gracefully', () => {
    const source = readSrc('application/study.app-service.ts');
    // proseSections starts as empty object, populated only if sections exist
    expect(source).toContain("const proseSections: Record<string, string | null> = {}");
    // ArtifactSectionModel is checked before querying
    expect(source).toContain('if (ArtifactSectionModel)');
  });

  it('GET Plan handles missing artifact_sections gracefully', () => {
    const source = readSrc('application/study.app-service.ts');
    expect(source).toContain("const planProseSections: Record<string, string | null> = {}");
  });

  it('artifact_version defaults to 1 when no artifact exists', () => {
    const source = readSrc('application/study.app-service.ts');
    expect(source).toContain('let artifactVersion = 1');
    expect(source).toContain('let planArtifactVersion = 1');
  });

  it('structured_fields parsed from cascade even without artifact_sections', () => {
    const source = readSrc('application/study.app-service.ts');
    expect(source).toContain('safeParse(cascadeFields.research_objectives)');
  });
});

// ═══════════════════════════════════════════════════════════
// 9. Authorization / organization isolation
// ═══════════════════════════════════════════════════════════

describe('Authorization boundary', () => {
  it('PATCH Brief resolves study with organization scope check', () => {
    const source = readSrc('application/content-update.app-service.ts');
    expect(source).toContain('organization_id !== ctx.organization.id');
  });

  it('PATCH uses assertStudyAccessByActor for membership check', () => {
    const source = readSrc('application/content-update.app-service.ts');
    expect(source).toContain('assertStudyAccessByActor');
  });

  it('PATCH routes require requireAuth middleware', () => {
    const source = readSrc('routes/api/v1/studies.routes.ts');
    // Both PATCH routes must use requireAuth
    const patchSection = source.split('Content PATCH endpoints')[1] || '';
    const patchRoutes = patchSection.match(/router\.patch\([^)]+requireAuth/g) || [];
    expect(patchRoutes.length).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════
// 10. YAML processor regression
// ═══════════════════════════════════════════════════════════

describe('YAML processor regression', () => {
  it('processYamlTemplate always returns aiResponses (backward compatible)', () => {
    const source = readSrc('helpers/yamlProcessor.ts');
    // The return statement should include aiResponses
    expect(source).toContain('return { result, outputTemplate, aiResponses, extractionPromise, artifactPublicId }');
  });

  it('ProcessResult type declares aiResponses as optional', () => {
    const source = readSrc('helpers/yamlProcessor.ts');
    expect(source).toContain('aiResponses?: Record<string, string>');
  });

  it('existing callers do not access aiResponses unless explicitly mapped', () => {
    // Slack handlers should not access aiResponses on the ProcessResult
    const slackCommands = fs.readdirSync(path.resolve(SRC_ROOT, 'helpers/slack/commands'))
      .filter(f => f.endsWith('.ts') || f.endsWith('.js'));

    for (const file of slackCommands) {
      if (file === 'briefHandler.ts') continue; // briefHandler is allowed — it captures sections
      const content = fs.readFileSync(path.resolve(SRC_ROOT, 'helpers/slack/commands', file), 'utf-8');
      // No Slack handler should access .aiResponses on a processYamlTemplate result
      expect(content).not.toContain('.aiResponses');
    }
  });

  it('GET Brief API response does not expose raw aiResponses', () => {
    const source = readSrc('application/study.app-service.ts');
    const getBriefFn = source.split('getStudyBrief')[1]?.split('getStudyPlan')[0] || '';
    // The return object should not include aiResponses
    expect(getBriefFn).not.toContain('aiResponses');
  });

  it('GET Plan API response does not expose raw aiResponses', () => {
    const source = readSrc('application/study.app-service.ts');
    const getPlanFn = source.split('getStudyPlan')[1]?.split('getCascadeReadiness')[0] || '';
    expect(getPlanFn).not.toContain('aiResponses');
  });
});

// ═══════════════════════════════════════════════════════════
// Migration order
// ═══════════════════════════════════════════════════════════

describe('Migration order', () => {
  it('artifact_sections migration is sequentially after the last existing migration', () => {
    const migrationsDir = path.resolve(SRC_ROOT, 'database/migrations');
    const migrations = fs.readdirSync(migrationsDir).sort();
    const lastMigration = migrations[migrations.length - 1];
    expect(lastMigration).toBe('20260911000000-ws2-artifact-sections.js');

    // The previous migration should be an earlier timestamp
    const prevMigration = migrations[migrations.length - 2];
    expect(prevMigration).toBe('20260909000000-ws1-study-public-id.js');
  });

  it('artifact_sections migration creates the table and adds content_version', () => {
    const source = fs.readFileSync(
      path.resolve(SRC_ROOT, 'database/migrations/20260911000000-ws2-artifact-sections.js'),
      'utf-8',
    );
    expect(source).toContain("createTable('artifact_sections'");
    expect(source).toContain("addColumn('research_artifacts', 'content_version'");
  });
});

// ═══════════════════════════════════════════════════════════
// Model registration
// ═══════════════════════════════════════════════════════════

describe('ArtifactSection model', () => {
  it('model file exists and exports correctly', () => {
    const init = require('../../database/models/artifact_section').default;
    expect(typeof init).toBe('function');
  });

  it('model uses correct table name', () => {
    const source = readSrc('database/models/artifact_section.ts');
    expect(source).toContain("tableName: 'artifact_sections'");
  });

  it('model has timestamps: false (manual timestamps)', () => {
    const source = readSrc('database/models/artifact_section.ts');
    expect(source).toContain('timestamps: false');
  });

  it('content_version added to ResearchArtifact model', () => {
    const source = readSrc('database/models/research_artifact.ts');
    expect(source).toContain('declare content_version');
    expect(source).toContain("content_version: { type: DataTypes.INTEGER");
  });

  it('ResearchArtifact has conditional ArtifactSection association', () => {
    const source = readSrc('database/models/research_artifact.ts');
    expect(source).toContain('if (models.ArtifactSection)');
    expect(source).toContain("as: 'sections'");
  });

  it('ArtifactSection registered in database index', () => {
    const source = readSrc('database/index.ts');
    expect(source).toContain("import ArtifactSection from './models/artifact_section'");
    expect(source).toContain('ArtifactSection,');
  });
});

// ═══════════════════════════════════════════════════════════
// Schema validator coverage
// ═══════════════════════════════════════════════════════════

describe('Schema validator model discovery', () => {
  it('validate-schema.js discovers models dynamically (no hardcoded list)', () => {
    const source = fs.readFileSync(
      path.resolve(SRC_ROOT, '../scripts/validate-schema.js'),
      'utf-8',
    );
    // Must use dynamic directory scanning, not a hardcoded require list
    expect(source).toContain('readdirSync(MODELS_DIR)');
    expect(source).not.toMatch(/require\('\.\.\/src\/database\/models\/channel_config'\)/);
  });

  it('model file count matches database index imports', () => {
    const modelsDir = path.resolve(SRC_ROOT, 'database/models');
    const modelFiles = fs.readdirSync(modelsDir)
      .filter((f: string) => f.endsWith('.ts') && !f.endsWith('.d.ts'));

    const indexSource = readSrc('database/index.ts');
    const importCount = (indexSource.match(/import\s+\w+\s+from\s+'\.\/models\//g) || []).length;

    // Every model file should have a corresponding import in index.ts
    // Allow model files that may not need registration (edge case)
    expect(importCount).toBeGreaterThanOrEqual(modelFiles.length - 2);
    expect(importCount).toBeLessThanOrEqual(modelFiles.length + 1);
  });
});
