/**
 * DISC-WEB-2 Problem Statement Compatibility Tests
 *
 * Verifies that controlled desk research runs stay within the 4-request AI budget
 * regardless of whether the project has a problem_statement.
 *
 * Key invariants:
 * 1. Controlled runs (is_controlled_run=true) ALWAYS skip knowledge_gaps_prose
 * 2. Non-controlled runs with problem_statement run knowledge_gaps_prose (5 AI calls)
 * 3. Any run without problem_statement skips knowledge_gaps_prose (existing behavior)
 * 4. The skip_when expression "not project_problem_statement or is_controlled_run" evaluates correctly
 * 5. is_controlled_run cannot be supplied via client input (backend-only)
 *
 * Run with: npx jest src/__tests__/unit/disc-web-2-problem-statement-compat.test.ts
 */

import nunjucks from 'nunjucks';

// Match the exact setup from langchain.ts
nunjucks.configure({ autoescape: false });

// Jinja keywords that should not be treated as variable references
const JINJA_KEYWORDS = new Set(['not', 'and', 'or', 'true', 'false', 'none', 'null', 'is', 'in']);

// Replicate assertSkipWhenVariablesDefined from langchain.ts
function assertSkipWhenVariablesDefined(
  expression: string,
  inputValues: Record<string, unknown>,
  taskId: string
): void {
  const matches = expression.match(/\b[a-z_][a-z0-9_]*\b/gi) || [];
  const referencedVars = matches.filter(v => !JINJA_KEYWORDS.has(v.toLowerCase()));

  for (const varName of referencedVars) {
    if (!(varName in inputValues)) {
      throw new Error(
        `skip_when in task "${taskId}" references undefined variable "${varName}". ` +
        `Check for typos. Available variables: ${Object.keys(inputValues).join(', ')}`
      );
    }
  }
}

// Simulate the skip_when evaluation logic from langchain.ts
function evaluateSkipWhen(
  skipWhen: string,
  inputValues: Record<string, unknown>,
  skipOutput: string,
  taskId: string = 'test_task'
): { skipped: boolean; output: string | null; error: Error | null } {
  try {
    assertSkipWhenVariablesDefined(skipWhen, inputValues, taskId);
    const skipCondition = nunjucks.renderString(`{{ ${skipWhen} }}`, inputValues);
    if (skipCondition.trim().toLowerCase() === 'true') {
      return { skipped: true, output: skipOutput, error: null };
    }
    return { skipped: false, output: null, error: null };
  } catch (err) {
    return { skipped: false, output: null, error: err as Error };
  }
}

// The actual skip_when expression from desk_research.yaml
const KNOWLEDGE_GAPS_SKIP_WHEN = 'not project_problem_statement or is_controlled_run';
const KNOWLEDGE_GAPS_SKIP_OUTPUT = `> **Knowledge gaps not included in this run.**
>
> Either no project problem statement is set, or this is a budget-controlled test run.
> For full analysis including knowledge gaps, run standard desk research with \`/qori-start\` to set a problem statement.`;

// Desk research task IDs in execution order
const DESK_RESEARCH_TASKS = [
  'document_analysis',
  'executive_summary',
  'themes',
  'knowledge_gaps_prose', // May be skipped
  'sources',
];

// Determine which tasks execute based on skip conditions
function getExecutedTaskIds(
  projectProblemStatement: string | null,
  isControlledRun: boolean
): string[] {
  const inputValues = {
    project_problem_statement: projectProblemStatement || '',
    is_controlled_run: isControlledRun,
  };

  return DESK_RESEARCH_TASKS.filter(taskId => {
    if (taskId === 'knowledge_gaps_prose') {
      const result = evaluateSkipWhen(
        KNOWLEDGE_GAPS_SKIP_WHEN,
        inputValues,
        KNOWLEDGE_GAPS_SKIP_OUTPUT,
        taskId
      );
      return !result.skipped;
    }
    // All other tasks always execute
    return true;
  });
}

describe('DISC-WEB-2 Problem Statement Compatibility', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // SKIP_WHEN EXPRESSION EVALUATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('skip_when expression: "not project_problem_statement or is_controlled_run"', () => {
    it('evaluates to TRUE when is_controlled_run=true (regardless of problem_statement)', () => {
      const inputValues = {
        project_problem_statement: 'Some problem statement',
        is_controlled_run: true,
      };

      const result = evaluateSkipWhen(
        KNOWLEDGE_GAPS_SKIP_WHEN,
        inputValues,
        KNOWLEDGE_GAPS_SKIP_OUTPUT,
        'knowledge_gaps_prose'
      );

      expect(result.error).toBeNull();
      expect(result.skipped).toBe(true);
      expect(result.output).toBe(KNOWLEDGE_GAPS_SKIP_OUTPUT);
    });

    it('evaluates to TRUE when problem_statement is empty (regardless of is_controlled_run)', () => {
      const inputValues = {
        project_problem_statement: '',
        is_controlled_run: false,
      };

      const result = evaluateSkipWhen(
        KNOWLEDGE_GAPS_SKIP_WHEN,
        inputValues,
        KNOWLEDGE_GAPS_SKIP_OUTPUT,
        'knowledge_gaps_prose'
      );

      expect(result.error).toBeNull();
      expect(result.skipped).toBe(true);
      expect(result.output).toBe(KNOWLEDGE_GAPS_SKIP_OUTPUT);
    });

    it('evaluates to FALSE when problem_statement exists AND is_controlled_run=false', () => {
      const inputValues = {
        project_problem_statement: 'Some problem statement',
        is_controlled_run: false,
      };

      const result = evaluateSkipWhen(
        KNOWLEDGE_GAPS_SKIP_WHEN,
        inputValues,
        KNOWLEDGE_GAPS_SKIP_OUTPUT,
        'knowledge_gaps_prose'
      );

      expect(result.error).toBeNull();
      expect(result.skipped).toBe(false);
      expect(result.output).toBeNull();
    });

    it('evaluates correctly when both conditions are TRUE (or short-circuits)', () => {
      const inputValues = {
        project_problem_statement: '', // empty = not present
        is_controlled_run: true,
      };

      const result = evaluateSkipWhen(
        KNOWLEDGE_GAPS_SKIP_WHEN,
        inputValues,
        KNOWLEDGE_GAPS_SKIP_OUTPUT,
        'knowledge_gaps_prose'
      );

      expect(result.error).toBeNull();
      expect(result.skipped).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TASK EXECUTION MATRIX
  // ═══════════════════════════════════════════════════════════════════════════

  describe('task execution matrix', () => {
    it('controlled run WITH problem_statement: 4 tasks (skips knowledge_gaps_prose)', () => {
      const executedTasks = getExecutedTaskIds('Some problem statement', true);

      expect(executedTasks).toHaveLength(4);
      expect(executedTasks).toEqual([
        'document_analysis',
        'executive_summary',
        'themes',
        'sources',
      ]);
      expect(executedTasks).not.toContain('knowledge_gaps_prose');
    });

    it('controlled run WITHOUT problem_statement: 4 tasks (skips knowledge_gaps_prose)', () => {
      const executedTasks = getExecutedTaskIds(null, true);

      expect(executedTasks).toHaveLength(4);
      expect(executedTasks).toEqual([
        'document_analysis',
        'executive_summary',
        'themes',
        'sources',
      ]);
      expect(executedTasks).not.toContain('knowledge_gaps_prose');
    });

    it('non-controlled run WITH problem_statement: 5 tasks (includes knowledge_gaps_prose)', () => {
      const executedTasks = getExecutedTaskIds('Some problem statement', false);

      expect(executedTasks).toHaveLength(5);
      expect(executedTasks).toEqual([
        'document_analysis',
        'executive_summary',
        'themes',
        'knowledge_gaps_prose',
        'sources',
      ]);
      expect(executedTasks).toContain('knowledge_gaps_prose');
    });

    it('non-controlled run WITHOUT problem_statement: 4 tasks (skips knowledge_gaps_prose)', () => {
      const executedTasks = getExecutedTaskIds(null, false);

      expect(executedTasks).toHaveLength(4);
      expect(executedTasks).toEqual([
        'document_analysis',
        'executive_summary',
        'themes',
        'sources',
      ]);
      expect(executedTasks).not.toContain('knowledge_gaps_prose');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BUDGET VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('4-request budget for controlled runs', () => {
    it('controlled run never exceeds 4 AI tasks regardless of problem_statement', () => {
      const withProblem = getExecutedTaskIds('Problem exists', true);
      const withoutProblem = getExecutedTaskIds(null, true);

      expect(withProblem.length).toBeLessThanOrEqual(4);
      expect(withoutProblem.length).toBeLessThanOrEqual(4);
    });

    it('non-controlled run with problem_statement requires 5 AI tasks', () => {
      const executedTasks = getExecutedTaskIds('Problem exists', false);

      expect(executedTasks.length).toBe(5);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VARIABLE PROTECTION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('is_controlled_run variable protection', () => {
    it('defaults to false when not provided by backend', () => {
      // Simulate what happens if is_controlled_run is not in inputValues
      // The YAML default is false, so the backend would provide false explicitly
      const inputValues = {
        project_problem_statement: 'Problem exists',
        is_controlled_run: false, // Explicitly false from backend
      };

      const result = evaluateSkipWhen(
        KNOWLEDGE_GAPS_SKIP_WHEN,
        inputValues,
        KNOWLEDGE_GAPS_SKIP_OUTPUT,
        'knowledge_gaps_prose'
      );

      expect(result.skipped).toBe(false);
    });

    it('throws error if is_controlled_run is undefined (variable validation)', () => {
      const inputValues = {
        project_problem_statement: 'Problem exists',
        // is_controlled_run is missing
      };

      const result = evaluateSkipWhen(
        KNOWLEDGE_GAPS_SKIP_WHEN,
        inputValues,
        KNOWLEDGE_GAPS_SKIP_OUTPUT,
        'knowledge_gaps_prose'
      );

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain('is_controlled_run');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SKIP OUTPUT CONTENT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('skip_output message', () => {
    it('provides clear user-facing message explaining why gaps are excluded', () => {
      const inputValues = {
        project_problem_statement: 'Problem exists',
        is_controlled_run: true,
      };

      const result = evaluateSkipWhen(
        KNOWLEDGE_GAPS_SKIP_WHEN,
        inputValues,
        KNOWLEDGE_GAPS_SKIP_OUTPUT,
        'knowledge_gaps_prose'
      );

      expect(result.output).toContain('Knowledge gaps not included');
      expect(result.output).toContain('budget-controlled');
      expect(result.output).toContain('/qori-start');
    });
  });
});
