/**
 * VC-4 Final Visual QA Script (TEMPORARY)
 *
 * Comprehensive QA at all required viewports:
 * 1440, 1280, 1100, 980, 768, 390
 */

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

const SCREENSHOT_DIR = '../design/workspace/workspace-v2/qa/vc4-screenshots';
const BASE_URL = 'http://localhost:5173';

// Mock data
const mockMe = {
  data: {
    actor: { display_name: 'Test User', public_id: 'a1' },
    organization: { name: 'Test Org', public_id: 'o1' },
    memberships: [],
  },
};

const mockSession = { data: { authenticated: true } };
const mockCsrf = { data: { token: 'test-csrf-token' } };

const mockBriefPending = {
  data: {
    study: {
      public_id: 'study-1',
      name: 'VA Appointment Scheduling Research',
      status: 'active',
      brief_status: 'pending_approval',
      project_public_id: 'p1',
      created_at: '2026-09-01',
    },
    brief_status: 'pending_approval',
    brief_approved_at: null,
    brief_approved_by: null,
    brief_change_feedback: null,
    brief_reviewer_display_name: null,
    brief_url: 'https://github.com/org/repo/blob/main/brief.md',
    cascade_fields: {
      research_objectives: JSON.stringify([
        { id: 'OBJ-001', objective: 'Understand how Veterans discover and use appointment scheduling tools' },
        { id: 'OBJ-002', objective: 'Identify pain points in the current scheduling workflow' },
      ]),
      research_questions: JSON.stringify([
        { id: 'RQ-001', question: 'How do Veterans currently find appointment scheduling options?', priority: 'Primary' },
        { id: 'RQ-002', question: 'What barriers prevent successful self-scheduling?', priority: 'Primary' },
      ]),
      target_barriers: JSON.stringify([
        { id: 'TB-001', barrier: 'Complex navigation to scheduling tools', source: 'Desk research' },
        { id: 'TB-002', barrier: 'Unclear availability windows', source: 'Stakeholder interview' },
      ]),
      methodology_selection: 'usability_testing',
      start_date: '2026-10-01',
      participant_approach: '8 Veterans across scheduling segments',
      budget: '$1,200',
      requestor_name: 'Dr. Sarah Chen',
    },
    prose_sections: {
      problem_statement: 'Veterans face significant challenges when attempting to schedule healthcare appointments through VA digital tools. Current research indicates that 40% of Veterans abandon online scheduling attempts.',
      summary: 'This research will evaluate the appointment scheduling experience for Veterans using VA digital tools. Through usability testing with 8 participants, we will identify specific friction points.',
    },
    structured_fields: {
      research_objectives: [
        { id: 'OBJ-001', objective: 'Understand how Veterans discover and use appointment scheduling tools' },
        { id: 'OBJ-002', objective: 'Identify pain points in the current scheduling workflow' },
      ],
      research_questions: [
        { id: 'RQ-001', question: 'How do Veterans currently find appointment scheduling options?', priority: 'Primary' },
        { id: 'RQ-002', question: 'What barriers prevent successful self-scheduling?', priority: 'Primary' },
      ],
      target_barriers: [
        { id: 'TB-001', barrier: 'Complex navigation to scheduling tools', source: 'Desk research' },
        { id: 'TB-002', barrier: 'Unclear availability windows', source: 'Stakeholder interview' },
      ],
      participant_segments: [],
      discovery_sources: [],
    },
  },
};

const mockBriefApproved = {
  data: {
    ...mockBriefPending.data,
    study: { ...mockBriefPending.data.study, brief_status: 'approved' },
    brief_status: 'approved',
    brief_approved_at: '2026-09-10T10:00:00Z',
    brief_reviewer_display_name: 'Jane Smith',
  },
};

const mockPlan = {
  data: {
    study: {
      public_id: 'study-1',
      name: 'VA Appointment Scheduling Research',
      status: 'active',
      brief_status: 'approved',
      plan_status: 'current',
      project_public_id: 'p1',
      created_at: '2026-09-01',
    },
    plan_status: 'current',
    plan_version: 2,
    plan_url: 'https://github.com/org/repo/blob/main/plan.md',
    inherited_context: {
      methodology_selection: 'usability_testing',
      participant_approach: '8 Veterans across scheduling segments',
      start_date: '2026-10-01',
    },
    cascade_fields: {
      methodology_selection: 'usability_testing',
      session_format: 'remote_moderated',
      session_duration: '60',
    },
    prose_sections: {
      methodology: 'Remote moderated usability testing with 8 Veterans. Each 60-minute session will include task-based scenarios.',
      deliverables: 'Research readout presentation with prioritized findings.',
    },
    structured_fields: {
      discussion_guide_sections: [],
      recruitment_criteria: [],
      risks: [],
      timeline_phases: [],
    },
  },
};

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  desktopNarrow: { width: 1280, height: 900 },
  tablet: { width: 1100, height: 900 },
  tabletNarrow: { width: 980, height: 900 },
  tabletSmall: { width: 768, height: 900 },
  mobile: { width: 390, height: 844 },
};

async function setupMocks(page, briefData = mockBriefPending) {
  await page.route('**/api/v1/auth/session', (route) => route.fulfill({ json: mockSession }));
  await page.route('**/api/v1/auth/csrf', (route) => route.fulfill({ json: mockCsrf }));
  await page.route('**/api/v1/me', (route) => route.fulfill({ json: mockMe }));
  await page.route('**/api/v1/studies/*/brief', (route) => route.fulfill({ json: briefData }));
  await page.route('**/api/v1/studies/*/plan', (route) => route.fulfill({ json: mockPlan }));
}

async function captureComputedStyles(page, selector, properties) {
  return await page.evaluate(
    ({ selector, properties }) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const styles = window.getComputedStyle(el);
      const result = {};
      for (const prop of properties) {
        result[prop] = styles.getPropertyValue(prop);
      }
      return result;
    },
    { selector, properties }
  );
}

async function measureGeometry(page) {
  return await page.evaluate(() => {
    const results = {};

    // App rail
    const appRail = document.querySelector('[class*="sideNav"], [class*="SideNav"]');
    if (appRail) results.appRailWidth = appRail.offsetWidth;

    // Lifecycle rail
    const lifecycle = document.querySelector('[class*="lifecycleRail"], [class*="LifecycleRail"]');
    if (lifecycle) results.lifecycleWidth = lifecycle.offsetWidth;

    // Context rail
    const contextRail = document.querySelector('[class*="rail"]:not([class*="lifecycle"]):not([class*="app"])');
    if (contextRail && contextRail.offsetWidth > 100) results.contextRailWidth = contextRail.offsetWidth;

    // Document column
    const docCol = document.querySelector('[class*="docCol"]');
    if (docCol) {
      results.documentOuterWidth = docCol.offsetWidth;
      const style = window.getComputedStyle(docCol);
      results.documentPaddingLeft = style.paddingLeft;
      results.documentPaddingRight = style.paddingRight;
      results.documentPaddingTop = style.paddingTop;
    }

    // Horizontal overflow
    results.hasHorizontalOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;

    return results;
  });
}

async function captureState(browser, viewport, state, path, briefData = mockBriefPending, extraAction = null) {
  console.log(`Capturing ${state} @ ${viewport.width}...`);
  const page = await browser.newPage({ viewport });
  await setupMocks(page, briefData);

  const url = state.includes('plan')
    ? `${BASE_URL}/studies/study-1/plan${state.includes('edit') ? '?mode=edit' : ''}`
    : `${BASE_URL}/studies/study-1/brief${state.includes('edit') ? '?mode=edit' : ''}`;

  await page.goto(url);
  await page.waitForSelector('[class*="masthead"]', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(500);

  if (extraAction) {
    await extraAction(page);
    await page.waitForTimeout(300);
  }

  await page.screenshot({ path: join(SCREENSHOT_DIR, path), fullPage: true });

  const result = { viewport: viewport.width, state, path };
  await page.close();
  return result;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = {
    screenshots: [],
    geometry: {},
    typography: {},
    audit: []
  };

  try {
    await mkdir(SCREENSHOT_DIR, { recursive: true });

    // ===== 1440 STATES =====
    results.screenshots.push(await captureState(browser, VIEWPORTS.desktop, 'brief-view', 'brief-view-1440.png', mockBriefPending));
    results.screenshots.push(await captureState(browser, VIEWPORTS.desktop, 'brief-edit', 'brief-edit-1440.png', mockBriefPending));

    // Brief Review pending
    results.screenshots.push(await captureState(browser, VIEWPORTS.desktop, 'brief-review-pending', 'brief-review-pending-1440.png', mockBriefPending, async (page) => {
      const toggle = await page.$('[aria-label="Review panel"], [aria-label*="Review"]');
      if (toggle) await toggle.click({ force: true, timeout: 5000 }).catch(() => {});
    }));

    // Brief Review checklist interaction
    results.screenshots.push(await captureState(browser, VIEWPORTS.desktop, 'brief-review-checklist', 'brief-review-checklist-1440.png', mockBriefPending, async (page) => {
      const toggle = await page.$('[aria-label="Review panel"], [aria-label*="Review"]');
      if (toggle) await toggle.click({ force: true, timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(200);
      const checkbox = await page.$('[class*="checklistItem"] input[type="checkbox"]');
      if (checkbox) await checkbox.click();
    }));

    // Brief Review approved
    results.screenshots.push(await captureState(browser, VIEWPORTS.desktop, 'brief-review-approved', 'brief-review-approved-1440.png', mockBriefApproved, async (page) => {
      const toggle = await page.$('[aria-label="Review panel"], [aria-label*="Review"]');
      if (toggle) await toggle.click({ force: true, timeout: 5000 }).catch(() => {});
    }));

    results.screenshots.push(await captureState(browser, VIEWPORTS.desktop, 'plan-view', 'plan-view-1440.png'));
    results.screenshots.push(await captureState(browser, VIEWPORTS.desktop, 'plan-edit', 'plan-edit-1440.png'));

    // Capture geometry and typography at 1440
    let page = await browser.newPage({ viewport: VIEWPORTS.desktop });
    await setupMocks(page, mockBriefPending);
    await page.goto(`${BASE_URL}/studies/study-1/brief`);
    await page.waitForSelector('[class*="masthead"]', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);

    results.geometry.desktop = await measureGeometry(page);
    results.typography.h1 = await captureComputedStyles(page, '[class*="mastName"]', ['font-family', 'font-size', 'font-weight', 'line-height']);
    results.typography.h2 = await captureComputedStyles(page, '[class*="secHeading"]', ['font-family', 'font-size', 'font-weight', 'line-height']);
    results.typography.prose = await captureComputedStyles(page, '[class*="blockProse"] p', ['font-family', 'font-size', 'line-height']);
    results.typography.id = await captureComputedStyles(page, '[class*="idTag"]', ['font-family', 'font-size']);
    await page.close();

    // ===== 1280 STATES =====
    results.screenshots.push(await captureState(browser, VIEWPORTS.desktopNarrow, 'brief-view', 'brief-view-1280.png', mockBriefPending));
    results.screenshots.push(await captureState(browser, VIEWPORTS.desktopNarrow, 'plan-view', 'plan-view-1280.png'));
    results.screenshots.push(await captureState(browser, VIEWPORTS.desktopNarrow, 'brief-review', 'brief-review-1280.png', mockBriefPending, async (page) => {
      const toggle = await page.$('[aria-label="Review panel"], [aria-label*="Review"]');
      if (toggle) await toggle.click({ force: true, timeout: 5000 }).catch(() => {});
    }));

    // ===== 1100 STATES =====
    results.screenshots.push(await captureState(browser, VIEWPORTS.tablet, 'brief-view', 'brief-view-1100.png', mockBriefPending));
    results.screenshots.push(await captureState(browser, VIEWPORTS.tablet, 'plan-view', 'plan-view-1100.png'));
    results.screenshots.push(await captureState(browser, VIEWPORTS.tablet, 'brief-review', 'brief-review-1100.png', mockBriefPending, async (page) => {
      const toggle = await page.$('[aria-label="Review panel"], [aria-label*="Review"]');
      if (toggle) await toggle.click({ force: true, timeout: 5000 }).catch(() => {});
    }));

    // ===== 980 STATES =====
    results.screenshots.push(await captureState(browser, VIEWPORTS.tabletNarrow, 'brief-view', 'brief-view-980.png', mockBriefPending));
    results.screenshots.push(await captureState(browser, VIEWPORTS.tabletNarrow, 'brief-nav', 'brief-nav-980.png', mockBriefPending, async (page) => {
      const hamburger = await page.$('[aria-label*="menu"], [aria-label*="Menu"], button:has(svg)');
      if (hamburger) await hamburger.click({ force: true, timeout: 5000 }).catch(() => {});
    }));
    results.screenshots.push(await captureState(browser, VIEWPORTS.tabletNarrow, 'brief-review', 'brief-review-980.png', mockBriefPending, async (page) => {
      const toggle = await page.$('[aria-label="Review panel"], [aria-label*="Review"]');
      if (toggle) await toggle.click({ force: true, timeout: 5000 }).catch(() => {});
    }));

    // ===== 768 STATES =====
    results.screenshots.push(await captureState(browser, VIEWPORTS.tabletSmall, 'brief-view', 'brief-view-768.png', mockBriefPending));
    results.screenshots.push(await captureState(browser, VIEWPORTS.tabletSmall, 'brief-nav', 'brief-nav-768.png', mockBriefPending, async (page) => {
      const hamburger = await page.$('[aria-label*="menu"], [aria-label*="Menu"], button:has(svg)');
      if (hamburger) await hamburger.click({ force: true, timeout: 5000 }).catch(() => {});
    }));
    results.screenshots.push(await captureState(browser, VIEWPORTS.tabletSmall, 'brief-review', 'brief-review-768.png', mockBriefPending, async (page) => {
      const toggle = await page.$('[aria-label="Review panel"], [aria-label*="Review"]');
      if (toggle) await toggle.click({ force: true, timeout: 5000 }).catch(() => {});
    }));

    // Capture geometry at 768
    page = await browser.newPage({ viewport: VIEWPORTS.tabletSmall });
    await setupMocks(page, mockBriefPending);
    await page.goto(`${BASE_URL}/studies/study-1/brief`);
    await page.waitForSelector('[class*="masthead"]', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);
    results.geometry.tablet = await measureGeometry(page);
    await page.close();

    // ===== 390 STATES =====
    results.screenshots.push(await captureState(browser, VIEWPORTS.mobile, 'brief-view', 'brief-view-390.png', mockBriefPending));
    results.screenshots.push(await captureState(browser, VIEWPORTS.mobile, 'brief-edit', 'brief-edit-390.png', mockBriefPending));
    results.screenshots.push(await captureState(browser, VIEWPORTS.mobile, 'plan-view', 'plan-view-390.png'));
    results.screenshots.push(await captureState(browser, VIEWPORTS.mobile, 'plan-edit', 'plan-edit-390.png'));
    results.screenshots.push(await captureState(browser, VIEWPORTS.mobile, 'brief-nav', 'brief-nav-390.png', mockBriefPending, async (page) => {
      const hamburger = await page.$('[aria-label*="menu"], [aria-label*="Menu"], button:has(svg)');
      if (hamburger) await hamburger.click({ force: true, timeout: 5000 }).catch(() => {});
    }));
    results.screenshots.push(await captureState(browser, VIEWPORTS.mobile, 'brief-review', 'brief-review-390.png', mockBriefPending, async (page) => {
      const toggle = await page.$('[aria-label="Review panel"], [aria-label*="Review"]');
      if (toggle) await toggle.click({ force: true, timeout: 5000 }).catch(() => {});
    }));

    // Capture geometry and typography at 390
    page = await browser.newPage({ viewport: VIEWPORTS.mobile });
    await setupMocks(page, mockBriefPending);
    await page.goto(`${BASE_URL}/studies/study-1/brief`);
    await page.waitForSelector('[class*="masthead"]', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);
    results.geometry.mobile = await measureGeometry(page);
    results.typography.h1Mobile = await captureComputedStyles(page, '[class*="mastName"]', ['font-size', 'line-height']);
    await page.close();

    // Plan safety check
    page = await browser.newPage({ viewport: VIEWPORTS.desktop });
    await setupMocks(page);
    await page.goto(`${BASE_URL}/studies/study-1/plan`);
    await page.waitForSelector('[class*="masthead"]', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);
    const planReviewToggle = await page.$('[aria-label="Review panel"]');
    results.planSafety = { noReviewToggle: !planReviewToggle };
    await page.close();

    // Write results
    await writeFile(join(SCREENSHOT_DIR, 'vc4-results.json'), JSON.stringify(results, null, 2));

    console.log('\n=== VC-4 Final QA Results ===\n');
    console.log('Screenshots captured:', results.screenshots.length);
    console.log('\nGeometry:');
    console.log(JSON.stringify(results.geometry, null, 2));
    console.log('\nTypography:');
    console.log(JSON.stringify(results.typography, null, 2));
    console.log('\nPlan Safety:', results.planSafety);

  } catch (error) {
    console.error('Error during VC-4 QA:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
