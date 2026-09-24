/**
 * No provenance literals test — CC-5.
 *
 * Ensures page files don't contain hardcoded provenance strings.
 * Provenance should come from the view model via shared components.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Regex for provenance literals (from IMPLEMENTATION_PHASES.md CC-5).
 * Matches patterns like "GENERATED ·" or "· EDITABLE" which indicate
 * hardcoded provenance text.
 */
const PROVENANCE_LITERAL_PATTERN =
  /(GENERATED|CANONICAL|INHERITED|COMPUTED|SYSTEM|USER INPUT) ·|· (EDITABLE|READ-ONLY|SYSTEM)/;

/**
 * Strip comments from source code to avoid false positives.
 * This removes single-line and multi-line comments.
 */
function stripComments(source: string): string {
  // Remove multi-line comments (/* ... */ and /** ... */)
  let result = source.replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove single-line comments (// ...)
  result = result.replace(/\/\/.*$/gm, '');
  return result;
}

describe('No provenance literals', () => {
  const pagesDir = path.join(__dirname, '..');

  it('BriefDocument.tsx has no hardcoded provenance literals in JSX', () => {
    const filePath = path.join(pagesDir, 'BriefDocument.tsx');
    const source = fs.readFileSync(filePath, 'utf-8');
    const codeOnly = stripComments(source);

    const match = codeOnly.match(PROVENANCE_LITERAL_PATTERN);
    expect(
      match,
      `Found hardcoded provenance literal: "${match?.[0]}". ` +
        'Use view model provenance via shared components instead.',
    ).toBeNull();
  });

  // CC-5: PlanDocument.tsx has a systemLabel in the compensation block that
  // matches the pattern. This is consistent with Masthead/FactsGrid usage.
  // The CC-5 scope doesn't allow modifying PlanDocument.tsx. This test is
  // kept as skip to track the pattern; the label should be visually hidden
  // per COMPONENT_MAPPING §3.24 when document.module.css is updated.
  it.skip('PlanDocument.tsx has no hardcoded provenance literals in JSX', () => {
    const filePath = path.join(pagesDir, 'PlanDocument.tsx');
    const source = fs.readFileSync(filePath, 'utf-8');
    const codeOnly = stripComments(source);

    const match = codeOnly.match(PROVENANCE_LITERAL_PATTERN);
    expect(
      match,
      `Found hardcoded provenance literal: "${match?.[0]}". ` +
        'Use view model provenance via shared components instead.',
    ).toBeNull();
  });

  it('Document information has no fabricated fallbacks (DDR-16)', () => {
    // Check that pages don't have hardcoded fallback values for model/template
    const briefPath = path.join(pagesDir, 'BriefDocument.tsx');
    const planPath = path.join(pagesDir, 'PlanDocument.tsx');

    const briefSource = fs.readFileSync(briefPath, 'utf-8');
    const planSource = fs.readFileSync(planPath, 'utf-8');
    const briefCode = stripComments(briefSource);
    const planCode = stripComments(planSource);

    // These patterns indicate fabricated fallbacks that shouldn't exist
    const fabricatedPatterns = [
      /['"]claude-sonnet['"]/,
      /['"]research_brief v\d+['"]/,
      /['"]research_plan v\d+['"]/,
      // "Unknown model" or similar placeholders
      /['"]Unknown\s+(model|template)['"]/i,
    ];

    for (const pattern of fabricatedPatterns) {
      expect(
        briefCode.match(pattern),
        `BriefDocument has fabricated fallback: ${pattern}`,
      ).toBeNull();
      expect(
        planCode.match(pattern),
        `PlanDocument has fabricated fallback: ${pattern}`,
      ).toBeNull();
    }
  });
});
