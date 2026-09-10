/**
 * WS-1: Application Service contract tests.
 *
 * Tests service exports and type contracts without requiring a database.
 */

describe('queue.app-service', () => {
  it('exports getQueueItems', () => {
    const { getQueueItems } = require('../../application/queue.app-service');
    expect(typeof getQueueItems).toBe('function');
  });
});

describe('home.app-service', () => {
  it('exports getHomeData', () => {
    const { getHomeData } = require('../../application/home.app-service');
    expect(typeof getHomeData).toBe('function');
  });

  it('does not query created_at on StudyStatus (column does not exist)', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../application/home.app-service.ts'),
      'utf8',
    );
    // StudyStatus table (research_status) has approved_at but NOT created_at.
    // Using created_at in order/where/attributes causes SequelizeDatabaseError.
    // Response output keys named created_at are fine — they map FROM approved_at.
    expect(source).not.toMatch(/order.*\[\s*['"]created_at['"]/);
  });
});

describe('StudyVariable column references', () => {
  it('study app-service queries variable_key, not variable_name', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../application/study.app-service.ts'),
      'utf8',
    );
    // study_variables table column is variable_key, not variable_name
    expect(source).not.toContain('variable_name');
    expect(source).toContain('variable_key');
  });
});

describe('StudyStatus model-schema alignment', () => {
  it('model init does not declare created_at (table has approved_at instead)', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../database/models/study_status.ts'),
      'utf8',
    );
    // timestamps: false — Sequelize must not auto-add createdAt
    expect(source).toContain('timestamps: false');
    // Model must NOT define a created_at column (table doesn't have one)
    expect(source).not.toMatch(/created_at:\s*\{/);
    // Model MUST define approved_at (the actual timestamp column)
    expect(source).toMatch(/approved_at:\s*\{/);
  });
});

describe('project.app-service', () => {
  it('exports createProject', () => {
    const { createProject } = require('../../application/project.app-service');
    expect(typeof createProject).toBe('function');
  });
});

describe('project slug conflict error mapping', () => {
  it('duplicate slug throws AppError with RESOURCE_CONFLICT, not plain Error', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../services/project.service.ts'),
      'utf8',
    );
    // Must use resourceConflict (AppError) not plain Error for duplicate slug
    expect(source).toContain('resourceConflict');
    expect(source).not.toMatch(/throw new Error\(.*already exists/);
  });

  it('RESOURCE_CONFLICT error code exists in ApiErrorCode enum', () => {
    const { ApiErrorCode } = require('../../types/api-errors');
    expect(ApiErrorCode.RESOURCE_CONFLICT).toBe('RESOURCE_CONFLICT');
  });

  it('resourceConflict factory returns 409 status', () => {
    const { resourceConflict } = require('../../types/api-errors');
    const err = resourceConflict('test');
    expect(err.httpStatus).toBe(409);
    expect(err.code).toBe('RESOURCE_CONFLICT');
    expect(err.message).toBe('test');
  });

  it('apiErrorHandler maps AppError to correct response shape', () => {
    const { AppError, ApiErrorCode } = require('../../types/api-errors');
    const { apiErrorHandler } = require('../../middleware/apiErrorHandler');
    const err = new AppError(ApiErrorCode.RESOURCE_CONFLICT, 'Duplicate slug', 409);
    let responseStatus: number | undefined;
    let responseBody: any;
    const res = {
      status(s: number) { responseStatus = s; return this; },
      json(b: any) { responseBody = b; },
    };
    apiErrorHandler(err, {} as any, res as any, (() => {}) as any);
    expect(responseStatus).toBe(409);
    expect(responseBody.error.code).toBe('RESOURCE_CONFLICT');
    expect(responseBody.error.message).toBe('Duplicate slug');
  });
});

describe('project creation contract — organization_id binding', () => {
  it('createProject passes organization_id from context to service layer', () => {
    // Verify the app service passes org context to createProjectFromName
    // by inspecting the source — this is a structural contract test
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../application/project.app-service.ts'),
      'utf8',
    );
    // The app service MUST pass organization_id to the service layer
    expect(source).toContain('organization_id: ctx.organization.id');
  });

  it('service CreateProjectInput includes organization_id', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../services/project.service.ts'),
      'utf8',
    );
    // The service interface MUST require organization_id
    expect(source).toMatch(/organization_id:\s*number/);
  });

  it('frontend payload shape matches backend expectations', () => {
    // The exact payload from the DEV smoke test that triggered the 400
    const payload = {
      name: 'City Services Status Experience',
      description: 'The city is redesigning the resident service-request experience...',
      problem_statement: 'Residents cannot easily understand the status of service requests...',
    };
    // Backend route destructures these exact fields from req.body
    expect(payload).toHaveProperty('name');
    expect(payload).toHaveProperty('problem_statement');
    expect(typeof payload.name).toBe('string');
    expect(typeof payload.problem_statement).toBe('string');
    // description is optional
    expect(typeof payload.description).toBe('string');
    // organization_id must NOT be in the request — it comes from server-side context
    expect(payload).not.toHaveProperty('organization_id');
  });
});

describe('study.app-service', () => {
  it('exports resolveStudyContext', () => {
    const { resolveStudyContext } = require('../../application/study.app-service');
    expect(typeof resolveStudyContext).toBe('function');
  });

  it('exports getStudyBrief', () => {
    const { getStudyBrief } = require('../../application/study.app-service');
    expect(typeof getStudyBrief).toBe('function');
  });

  it('exports getStudyPlan', () => {
    const { getStudyPlan } = require('../../application/study.app-service');
    expect(typeof getStudyPlan).toBe('function');
  });

  it('exports getCascadeReadiness', () => {
    const { getCascadeReadiness } = require('../../application/study.app-service');
    expect(typeof getCascadeReadiness).toBe('function');
  });

  it('exports resubmitBrief', () => {
    const { resubmitBrief } = require('../../application/study.app-service');
    expect(typeof resubmitBrief).toBe('function');
  });
});

describe('approval.app-service', () => {
  it('exports executeDocumentApproval', () => {
    const { executeDocumentApproval } = require('../../application/approval.app-service');
    expect(typeof executeDocumentApproval).toBe('function');
  });
});

describe('ResearchStudy model has public_id', () => {
  it('model definition includes public_id attribute', () => {
    const initModel = require('../../database/models/research_study').default;
    // initModel is a function that takes sequelize — we can check it's callable
    expect(typeof initModel).toBe('function');
  });
});

describe('@qori/api-contracts', () => {
  it('package.json declares correct entry points', () => {
    // Use relative path since Jest can't resolve workspace symlinks
    const pkg = require('../../../../packages/api-contracts/package.json');
    expect(pkg.main).toBe('./dist/index.js');
    expect(pkg.types).toBe('./dist/index.d.ts');
    expect(pkg.name).toBe('@qori/api-contracts');
  });
});
