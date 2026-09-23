/**
 * YAML Integration Tests
 *
 * Validates contracts against actual YAML template files in the repository.
 * These tests ensure the contracts remain in sync with YAML definitions.
 *
 * CRITICAL: These tests would catch bugs like risks → risks_raw mismatch
 * at test time rather than runtime.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { load as parseYaml } from 'js-yaml';

import {
  BRIEF_CONTRACT,
  PLAN_CONTRACT,
  BRIEF_YAML_TASK_IDS,
  PLAN_YAML_TASK_IDS,
  validateContractAgainstYaml,
  validateTaskSectionMapping,
  buildTaskToSectionMap,
  type YamlTemplate,
} from '../index';

// ─── Path Resolution ───────────────────────────────────────────────
// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Find the config/prompts directory relative to various possible working directories.
 * Tests may run from:
 * - packages/artifact-contracts (npm test in package)
 * - repo root (npm test from root)
 * - packages/artifact-contracts/dist/__tests__ (compiled output)
 */
const getConfigPromptsPath = (): string => {
  // Try various relative paths from current working directory
  const cwdPaths = [
    join(process.cwd(), 'config', 'prompts'),
    join(process.cwd(), '..', '..', 'config', 'prompts'),
  ];

  // Try relative paths from this file's location
  // __dirname could be src/__tests__ or dist/__tests__
  const filePaths = [
    // From src/__tests__ or dist/__tests__: ../../../../config/prompts
    join(__dirname, '..', '..', '..', '..', 'config', 'prompts'),
    // Deeper if nested differently
    join(__dirname, '..', '..', '..', '..', '..', 'config', 'prompts'),
  ];

  const allPaths = [...cwdPaths, ...filePaths];

  for (const p of allPaths) {
    if (existsSync(join(p, 'research_brief.yaml'))) {
      return p;
    }
  }

  // Fallback: return first path (will fail with clear error)
  return cwdPaths[0];
};

// ─── YAML Loading ──────────────────────────────────────────────────

const configPath = getConfigPromptsPath();

function loadYamlTemplate(filename: string): YamlTemplate | null {
  const filepath = join(configPath, filename);
  if (!existsSync(filepath)) {
    console.log(`Looking for YAML at: ${filepath}`);
    return null;
  }
  const content = readFileSync(filepath, 'utf-8');
  const parsed = parseYaml(content) as Record<string, unknown>;

  return {
    id: parsed.id as string,
    version: parsed.version as string,
    ai_generation_tasks: (parsed.ai_generation_tasks as Array<{ task_id: string }>) ?? [],
    emits: (parsed.emits as Array<{ key: string }>) ?? [],
  };
}

// ─── Brief YAML Integration Tests ──────────────────────────────────

describe('Brief Contract vs YAML Integration', () => {
  const yaml = loadYamlTemplate('research_brief.yaml');

  beforeAll(() => {
    if (!yaml) {
      console.warn('Skipping Brief YAML tests: research_brief.yaml not found');
    }
  });

  it('YAML file exists', () => {
    expect(yaml).not.toBeNull();
  });

  it('contract template_id matches YAML id', () => {
    if (!yaml) return;
    expect(BRIEF_CONTRACT.template_id).toBe(yaml.id);
  });

  it('contract template_version matches YAML version', () => {
    if (!yaml) return;
    expect(BRIEF_CONTRACT.template_version).toBe(yaml.version);
  });

  it('all BRIEF_YAML_TASK_IDS exist in YAML', () => {
    if (!yaml) return;
    const yamlTaskIds = yaml.ai_generation_tasks?.map(t => t.task_id) ?? [];
    for (const taskId of BRIEF_YAML_TASK_IDS) {
      expect(yamlTaskIds).toContain(taskId);
    }
  });

  it('all YAML task IDs are covered by contract', () => {
    if (!yaml) return;
    const yamlTaskIds = yaml.ai_generation_tasks?.map(t => t.task_id) ?? [];
    const contractTaskIds = [...BRIEF_YAML_TASK_IDS];
    for (const taskId of yamlTaskIds) {
      expect(contractTaskIds).toContain(taskId);
    }
  });

  it('validates successfully against YAML', () => {
    if (!yaml) return;
    const result = validateContractAgainstYaml(BRIEF_CONTRACT, yaml);
    if (!result.valid) {
      console.error('Brief validation errors:', result.errors);
    }
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('task → section mappings are correct', () => {
    if (!yaml) return;
    const taskToSection = buildTaskToSectionMap(BRIEF_CONTRACT);

    // These are the expected mappings based on the contract
    const expectedMappings = new Map([
      ['descriptive_title', 'descriptive_title'],
      ['summary', 'summary'],
      ['problem_narrative', 'problem_narrative'],
      ['method_rationale', 'method_prose'],
      ['participant_rationale', 'participants_prose'],
      ['out_of_scope_rationale', 'out_of_scope'],
      ['risks', 'risks'],
      ['approval_items', 'approval_items'],
    ]);

    const errors = validateTaskSectionMapping(BRIEF_CONTRACT, expectedMappings);
    if (errors.length > 0) {
      console.error('Brief mapping errors:', errors);
    }
    expect(errors).toHaveLength(0);
  });
});

// ─── Plan YAML Integration Tests ───────────────────────────────────

describe('Plan Contract vs YAML Integration', () => {
  const yaml = loadYamlTemplate('research_plan.yaml');

  beforeAll(() => {
    if (!yaml) {
      console.warn('Skipping Plan YAML tests: research_plan.yaml not found');
    }
  });

  it('YAML file exists', () => {
    expect(yaml).not.toBeNull();
  });

  it('contract template_id matches YAML id', () => {
    if (!yaml) return;
    expect(PLAN_CONTRACT.template_id).toBe(yaml.id);
  });

  it('contract template_version matches YAML version', () => {
    if (!yaml) return;
    expect(PLAN_CONTRACT.template_version).toBe(yaml.version);
  });

  it('all PLAN_YAML_TASK_IDS exist in YAML', () => {
    if (!yaml) return;
    const yamlTaskIds = yaml.ai_generation_tasks?.map(t => t.task_id) ?? [];
    for (const taskId of PLAN_YAML_TASK_IDS) {
      expect(yamlTaskIds).toContain(taskId);
    }
  });

  it('all YAML task IDs are covered by contract', () => {
    if (!yaml) return;
    const yamlTaskIds = yaml.ai_generation_tasks?.map(t => t.task_id) ?? [];
    const contractTaskIds = [...PLAN_YAML_TASK_IDS];
    for (const taskId of yamlTaskIds) {
      expect(contractTaskIds).toContain(taskId);
    }
  });

  it('validates successfully against YAML', () => {
    if (!yaml) return;
    const result = validateContractAgainstYaml(PLAN_CONTRACT, yaml);
    if (!result.valid) {
      console.error('Plan validation errors:', result.errors);
    }
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('task → section mappings are correct', () => {
    if (!yaml) return;

    // CRITICAL: This test would have caught the risks → risks_raw bug
    const expectedMappings = new Map([
      ['summary', 'plan_summary'],
      ['background', 'plan_background'],
      ['method_approach', 'plan_method_approach'],
      ['session_format_detail', 'plan_session_format'],
      ['data_collection_methods', 'plan_data_collection'],
      ['participant_glance', 'plan_participant_glance'],
      ['participant_composition_prose', 'plan_participants_prose'],
      ['deliverables_narrative', 'plan_deliverables'],
      ['risks', 'plan_risks'],  // NOT risks_raw!
      ['brief_operationalization', 'plan_commitments'],
    ]);

    const errors = validateTaskSectionMapping(PLAN_CONTRACT, expectedMappings);
    if (errors.length > 0) {
      console.error('Plan mapping errors:', errors);
    }
    expect(errors).toHaveLength(0);
  });

  it('risks task maps to plan_risks (NOT risks_raw)', () => {
    const taskToSection = buildTaskToSectionMap(PLAN_CONTRACT);
    const risksSection = taskToSection.get('risks');

    // This is the exact regression test for the bug fixed in commit 2c5ea0b8
    expect(risksSection).toBe('plan_risks');
    expect(risksSection).not.toBe('risks_raw');
    expect(risksSection).not.toBe('risks');  // Brief uses 'risks', Plan uses 'plan_risks'
  });
});

// ─── Cross-Contract Validation ─────────────────────────────────────

describe('Cross-Contract Validation', () => {
  it('Brief and Plan have different artifact_types', () => {
    expect(BRIEF_CONTRACT.artifact_type).toBe('brief');
    expect(PLAN_CONTRACT.artifact_type).toBe('plan');
  });

  it('Brief and Plan have different template_ids', () => {
    expect(BRIEF_CONTRACT.template_id).toBe('research_brief');
    expect(PLAN_CONTRACT.template_id).toBe('research_plan');
  });

  it('Plan section keys are prefixed with plan_', () => {
    const planTaskToSection = buildTaskToSectionMap(PLAN_CONTRACT);
    for (const [_, sectionKey] of planTaskToSection) {
      expect(sectionKey).toMatch(/^plan_/);
    }
  });

  it('Brief section keys are NOT prefixed with brief_', () => {
    const briefTaskToSection = buildTaskToSectionMap(BRIEF_CONTRACT);
    for (const [_, sectionKey] of briefTaskToSection) {
      expect(sectionKey).not.toMatch(/^brief_/);
    }
  });
});
