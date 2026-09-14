/**
 * Content Update Application Service — WS-2
 *
 * Handles PATCH updates to Brief and Plan editable content.
 *
 * Architecture:
 * - Workspace editor → canonical artifact/domain state → deterministic Markdown → GitHub projection
 * - artifact_sections stores editable prose (Markdown, not editor HTML)
 * - study_variables stores structured cascade values (bounded legacy exception for objectives/questions/barriers)
 * - content_version on ResearchArtifact provides artifact-level optimistic concurrency
 * - GitHub projection happens AFTER canonical DB transaction commits
 * - Projection failure does not roll back canonical state
 */

import type { ApplicationContext } from '../types/application-context';
import { invalidState, resourceNotFound } from '../types/api-errors';
import { assertStudyAccessByActor } from '../services/authorization.service';
import { getConfigRepo, YAML_TEMPLATE_PATH, fetchFileFromRepo, createOrUpdateFileOnGitHub } from '../helpers/github';
import sequelize from '../database';
import Handlebars from 'handlebars';
import { readUpstreamVariablesByContext, type VariableContext } from '../helpers/studyVariables';

// ─── Input Types ──────────────────────────────────────────────────

export interface PatchBriefContentInput {
  artifact_version: number;
  sections?: {
    summary?: string;
    problem_narrative?: string;
    method_prose?: string;
    participants_prose?: string;
    out_of_scope?: string;
  };
  structured?: {
    research_objectives?: Array<{ id: string; objective: string }>;
    research_questions?: Array<{ id: string; question: string; priority: string }>;
    target_barriers?: Array<{ id: string; barrier: string; source: string }>;
    risks?: Array<{ risk: string; source: string; mitigation: string }>;
  };
}

export interface PatchPlanContentInput {
  artifact_version: number;
  sections?: {
    plan_summary?: string;
    plan_background?: string;
    plan_method_approach?: string;
    plan_session_format?: string;
    plan_data_collection?: string;
    plan_participants_prose?: string;
    plan_deliverables?: string;
    plan_commitments?: string;
  };
  structured?: {
    risks?: Array<{ risk: string; likelihood: string; mitigation: string }>;
  };
}

export interface PatchContentResponse {
  canonical_saved: boolean;
  artifact_version: number;
  github_synced: boolean;
  github_sync_error?: string;
  github_url?: string;
  updated_at: string;
}

// ─── Brief Content Update ─────────────────────────────────────────

export async function updateBriefContent(
  ctx: ApplicationContext,
  studyPublicId: string,
  input: PatchBriefContentInput,
): Promise<PatchContentResponse> {
  const study = await resolveStudyForUpdate(studyPublicId, ctx);

  // Find the Brief artifact
  const ArtifactModel = sequelize.models.ResearchArtifact;
  const artifact = await ArtifactModel.findOne({
    where: { study_id: study.id, artifact_type: 'brief' },
    order: [['created_at', 'DESC']],
  }) as any;

  if (!artifact) throw resourceNotFound('Brief artifact');

  // Optimistic concurrency check
  if (artifact.content_version !== input.artifact_version) {
    throw invalidState(
      `Stale version: you have version ${input.artifact_version}, current is ${artifact.content_version}. Refresh and re-edit.`,
    );
  }

  const t = await sequelize.transaction();
  try {
    // 1. Update prose sections in artifact_sections
    if (input.sections) {
      await upsertSections(artifact.id, input.sections, ctx.actor.publicId, t);
    }

    // 2. Update structured cascade values in study_variables
    if (input.structured) {
      await updateStructuredVariables(study.id, study.project_id, input.structured, t);
    }

    // 3. Increment content_version atomically
    await artifact.update(
      { content_version: artifact.content_version + 1, updated_at: new Date() },
      { transaction: t },
    );

    await t.commit();
  } catch (err) {
    await t.rollback();
    throw err;
  }

  // 4. GitHub projection AFTER canonical commit
  const projectionResult = await projectToGitHub(artifact, study, 'brief');

  return {
    canonical_saved: true,
    artifact_version: artifact.content_version,
    github_synced: projectionResult.synced,
    github_sync_error: projectionResult.error,
    github_url: projectionResult.url,
    updated_at: new Date().toISOString(),
  };
}

// ─── Plan Content Update ──────────────────────────────────────────

export async function updatePlanContent(
  ctx: ApplicationContext,
  studyPublicId: string,
  input: PatchPlanContentInput,
): Promise<PatchContentResponse> {
  const study = await resolveStudyForUpdate(studyPublicId, ctx);

  const ArtifactModel = sequelize.models.ResearchArtifact;
  const artifact = await ArtifactModel.findOne({
    where: { study_id: study.id, artifact_type: 'plan' },
    order: [['created_at', 'DESC']],
  }) as any;

  if (!artifact) throw resourceNotFound('Plan artifact');

  if (artifact.content_version !== input.artifact_version) {
    throw invalidState(
      `Stale version: you have version ${input.artifact_version}, current is ${artifact.content_version}. Refresh and re-edit.`,
    );
  }

  const t = await sequelize.transaction();
  try {
    if (input.sections) {
      await upsertSections(artifact.id, input.sections, ctx.actor.publicId, t);
    }

    if (input.structured) {
      await updateStructuredVariables(study.id, study.project_id, input.structured, t);
    }

    await artifact.update(
      { content_version: artifact.content_version + 1, updated_at: new Date() },
      { transaction: t },
    );

    await t.commit();
  } catch (err) {
    await t.rollback();
    throw err;
  }

  const projectionResult = await projectToGitHub(artifact, study, 'plan');

  return {
    canonical_saved: true,
    artifact_version: artifact.content_version,
    github_synced: projectionResult.synced,
    github_sync_error: projectionResult.error,
    github_url: projectionResult.url,
    updated_at: new Date().toISOString(),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────

async function resolveStudyForUpdate(studyPublicId: string, ctx: ApplicationContext) {
  const StudyModel = sequelize.models.ResearchStudy;
  const ProjectModel = sequelize.models.Project;

  const study = await StudyModel.findOne({
    where: { public_id: studyPublicId },
    include: [{ model: ProjectModel, as: 'project', attributes: ['id', 'slug', 'organization_id'] }],
  }) as any;

  if (!study || !study.project) throw resourceNotFound('Study');
  if (study.project.organization_id !== ctx.organization.id) throw resourceNotFound('Study');

  await assertStudyAccessByActor(ctx.actor.id, study.id, ctx.organization.id);

  return study;
}

async function upsertSections(
  artifactId: number,
  sections: Record<string, string | undefined>,
  actorPublicId: string,
  transaction: any,
) {
  const ArtifactSectionModel = sequelize.models.ArtifactSection;
  if (!ArtifactSectionModel) return;

  for (const [sectionKey, content] of Object.entries(sections)) {
    if (content === undefined) continue;

    const existing = await ArtifactSectionModel.findOne({
      where: { artifact_id: artifactId, section_key: sectionKey },
      transaction,
    });

    if (existing) {
      await (existing as any).update(
        { content, content_type: 'prose', updated_at: new Date(), updated_by: actorPublicId },
        { transaction },
      );
    } else {
      await ArtifactSectionModel.create({
        artifact_id: artifactId,
        section_key: sectionKey,
        content_type: 'prose',
        content,
        updated_by: actorPublicId,
      } as any, { transaction });
    }
  }
}

async function updateStructuredVariables(
  studyId: number,
  projectId: number,
  structured: Record<string, unknown[] | undefined>,
  transaction: any,
) {
  const StudyVariableModel = sequelize.models.StudyVariable;
  if (!StudyVariableModel) return;

  for (const [variableKey, value] of Object.entries(structured)) {
    if (value === undefined) continue;

    const existing = await StudyVariableModel.findOne({
      where: { study_id: studyId, variable_key: variableKey },
      transaction,
    });

    if (existing) {
      await (existing as any).update(
        { value, updated_at: new Date() },
        { transaction },
      );
    } else {
      await StudyVariableModel.create({
        project_id: projectId,
        study_id: studyId,
        variable_key: variableKey,
        variable_type: 'structured',
        value,
        source_template: 'workspace_edit',
        source_version: '1.0',
        extracted_at: new Date(),
      } as any, { transaction });
    }
  }
}

async function projectToGitHub(
  artifact: any,
  study: any,
  artifactType: 'brief' | 'plan',
): Promise<{ synced: boolean; error?: string; url?: string }> {
  try {
    // Load all canonical state for deterministic rendering
    const variableContext: VariableContext = {
      projectId: study.project_id,
      studyId: study.id,
    };

    const ArtifactSectionModel = sequelize.models.ArtifactSection;
    const sections: Record<string, string> = {};
    if (ArtifactSectionModel) {
      const sectionRows = await ArtifactSectionModel.findAll({
        where: { artifact_id: artifact.id },
      }) as any[];
      for (const s of sectionRows) {
        if (s.content) sections[s.section_key] = s.content;
      }
    }

    // Load cascade variables
    const StudyVariableModel = sequelize.models.StudyVariable;
    const cascadeVars: Record<string, unknown> = {};
    if (StudyVariableModel) {
      const vars = await StudyVariableModel.findAll({
        where: { study_id: study.id },
      }) as any[];
      for (const v of vars) {
        cascadeVars[v.variable_key] = v.value;
      }
    }

    // Load YAML template
    const templateName = artifactType === 'brief' ? 'research_brief.yaml' : 'research_plan.yaml';
    const file = await fetchFileFromRepo(getConfigRepo(), YAML_TEMPLATE_PATH, templateName);

    // Extract output_template from YAML
    const yaml = require('js-yaml');
    const yamlConfig = yaml.load(file.content) as any;
    const outputTemplate = yamlConfig?.output_template;
    if (!outputTemplate) {
      throw new Error(`No output_template in ${templateName}`);
    }

    // Build template data from canonical state
    const data: Record<string, unknown> = {
      ...cascadeVars,
      selected_study: study.name,
      lead_researcher: study.researcher_name || 'Researcher',
      project_title: study.name,
      current_date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      display_date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    };

    // Map prose sections to ai_generated.* slots used by the template
    const aiGenerated: Record<string, string> = {};
    const briefProseMap: Record<string, string> = {
      summary: 'summary',
      problem_narrative: 'problem_narrative',
      method_prose: 'method_rationale',
      participants_prose: 'participant_rationale',
      out_of_scope: 'out_of_scope_rationale',
      approval_items: 'approval_items',
      descriptive_title: 'descriptive_title',
    };
    const planProseMap: Record<string, string> = {
      plan_summary: 'summary',
      plan_background: 'background',
      plan_method_approach: 'method_approach',
      plan_session_format: 'session_format_detail',
      plan_data_collection: 'data_collection_methods',
      plan_participants_prose: 'participant_composition_prose',
      plan_participant_glance: 'participant_glance',
      plan_deliverables: 'deliverables_narrative',
    };

    const proseMap = artifactType === 'brief' ? briefProseMap : planProseMap;
    for (const [sectionKey, aiKey] of Object.entries(proseMap)) {
      if (sections[sectionKey]) {
        aiGenerated[aiKey] = sections[sectionKey];
      }
    }

    data.ai_generated = aiGenerated;

    // Render Markdown deterministically
    const template = Handlebars.compile(outputTemplate, { noEscape: true });
    const markdown = template(data);

    // Push to the SAME GitHub path (stable artifact identity)
    if (!artifact.path) {
      return { synced: false, error: 'No artifact path — cannot project to GitHub' };
    }

    const writeResult = await createOrUpdateFileOnGitHub(artifact.path, markdown);

    // Update artifact projection state
    try {
      const { recordWriteSuccess } = require('../services/artifact.service');
      await recordWriteSuccess(artifact.id, {
        path: writeResult.path,
        commitSha: writeResult.sha,
        url: writeResult.url,
      });
    } catch (err) {
      console.warn('[CONTENT-UPDATE] recordWriteSuccess failed:', err instanceof Error ? err.message : err);
    }

    return { synced: true, url: writeResult.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[CONTENT-UPDATE] GitHub projection failed:', message);

    // Persist projection failure on artifact
    try {
      const { recordWriteFailure } = require('../services/artifact.service');
      await recordWriteFailure(artifact.id, message);
    } catch (recErr) {
      console.warn('[CONTENT-UPDATE] recordWriteFailure failed:', recErr instanceof Error ? recErr.message : recErr);
    }

    return { synced: false, error: message };
  }
}
