/**
 * VC-1 Geometry Contract Tests — Static CSS Regression
 *
 * STATIC CSS CONTRACT TEST
 *
 * These tests verify the CSS source contains the correct VC-1 geometry values.
 * They do NOT compute browser layout (jsdom cannot reliably compute flexbox).
 *
 * Purpose:
 * - Protect against accidental regression of VC-1 geometry changes
 * - Ensure document column uses 736px max-width (not legacy 840px)
 * - Ensure document is centered with margin auto
 * - Ensure responsive padding values are correct
 * - Ensure lifecycle inverse leak fix is in place
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const COMPONENTS_DIR = join(__dirname, '..');
const DOCUMENT_CSS = join(COMPONENTS_DIR, 'document', 'document.module.css');
const LIFECYCLE_CSS = join(COMPONENTS_DIR, 'LifecycleRail.module.css');
const HEADER_CSS = join(COMPONENTS_DIR, 'document', 'ArtifactHeader.module.css');
const EDITOR_CSS = join(COMPONENTS_DIR, 'editor', 'editor.module.css');

describe('VC-1: Document Geometry Contract', () => {
  const documentCss = readFileSync(DOCUMENT_CSS, 'utf-8');

  describe('.docCol geometry', () => {
    it('uses max-width: 736px (not legacy 840px)', () => {
      expect(documentCss).toContain('max-width: 736px');
      expect(documentCss).not.toMatch(/\.docCol\s*\{[^}]*max-width:\s*840px/);
    });

    it('is centered with margin-left: auto and margin-right: auto', () => {
      expect(documentCss).toContain('margin-left: auto');
      expect(documentCss).toContain('margin-right: auto');
    });

    it('has desktop padding: 48px 48px 128px', () => {
      expect(documentCss).toContain('padding: 48px 48px 128px');
    });
  });

  describe('.docCol responsive padding', () => {
    it('has tablet (≤980px) padding: 32px 24px 96px', () => {
      // Extract the @media (max-width: 980px) block
      const mdMatch = documentCss.match(/@media\s*\(max-width:\s*980px\)\s*\{([^}]+\.docCol[^}]+)\}/);
      expect(mdMatch).not.toBeNull();
      expect(mdMatch![1]).toContain('padding: 32px 24px 96px');
    });

    it('has mobile (≤767px) padding: 24px 16px 96px', () => {
      // Extract the @media (max-width: 767px) block
      const smMatch = documentCss.match(/@media\s*\(max-width:\s*767px\)\s*\{([^}]+\.docCol[^}]+)\}/);
      expect(smMatch).not.toBeNull();
      expect(smMatch![1]).toContain('padding: 24px 16px 96px');
    });
  });

  describe('.docWrap cleanup', () => {
    it('uses display: block (not legacy flex)', () => {
      const docWrapMatch = documentCss.match(/\.docWrap\s*\{([^}]+)\}/);
      expect(docWrapMatch).not.toBeNull();
      expect(docWrapMatch![1]).toContain('display: block');
      expect(docWrapMatch![1]).not.toContain('display: flex');
    });

    it('does not have legacy gap property', () => {
      const docWrapMatch = documentCss.match(/\.docWrap\s*\{([^}]+)\}/);
      expect(docWrapMatch).not.toBeNull();
      expect(docWrapMatch![1]).not.toContain('gap:');
    });
  });
});

describe('VC-1: Lifecycle Leak Fix', () => {
  const lifecycleCss = readFileSync(LIFECYCLE_CSS, 'utf-8');

  describe('legacy responsive scope', () => {
    it('scopes legacy @media (max-width: 1023px) rules to :not(.railInverse)', () => {
      // The leak fix requires all legacy responsive rules to be scoped
      expect(lifecycleCss).toContain('.rail:not(.railInverse)');
    });

    it('scopes .list horizontal behavior to non-inverse rail', () => {
      // The leak: legacy made .list horizontal at ≤1023px
      // The fix: scope to .rail:not(.railInverse) .list
      expect(lifecycleCss).toContain('.rail:not(.railInverse) .list');
    });

    it('does NOT have unscoped .list becoming horizontal in media query', () => {
      // This would be a regression: unscoped .list with flex-direction: row
      const mediaBlock = lifecycleCss.match(/@media\s*\(max-width:\s*1023px\)\s*\{([\s\S]*?)\n\}/);
      expect(mediaBlock).not.toBeNull();

      // Inside the media block, there should NOT be just ".list {" without the :not(.railInverse) scope
      // All .list rules should be scoped
      const mediaContent = mediaBlock![1];
      const unscopedList = mediaContent.match(/^\s*\.list\s*\{/m);
      expect(unscopedList).toBeNull();
    });
  });

  describe('.railInverse padding', () => {
    it('has explicit padding-top: 0 to prevent base rail leak', () => {
      expect(lifecycleCss).toContain('padding-top: 0');
    });
  });
});

describe('VC-1: Artifact Header', () => {
  const headerCss = readFileSync(HEADER_CSS, 'utf-8');

  it('uses paper background: var(--color-paper)', () => {
    expect(headerCss).toContain('background-color: var(--color-paper)');
  });

  it('hides .githubLink and .rule at ≤767px', () => {
    // CSS has multiple @media (max-width: 767px) blocks — collect all of them
    const mobileBlocks = [...headerCss.matchAll(/@media\s*\(max-width:\s*767px\)\s*\{([\s\S]*?)\n\}/g)];
    expect(mobileBlocks.length).toBeGreaterThan(0);

    // Concatenate all 767px media block contents
    const allMobileContent = mobileBlocks.map((m) => m[1]).join('\n');
    expect(allMobileContent).toContain('.githubLink');
    expect(allMobileContent).toContain('.rule');
    expect(allMobileContent).toContain('display: none');
  });
});

describe('VC-1: Artifact Tabs', () => {
  const documentCss = readFileSync(DOCUMENT_CSS, 'utf-8');

  it('.artifactTabs has align-self: stretch', () => {
    const tabsMatch = documentCss.match(/\.artifactTabs\s*\{([^}]+)\}/);
    expect(tabsMatch).not.toBeNull();
    expect(tabsMatch![1]).toContain('align-self: stretch');
  });

  it('.artifactTab has height: 100%', () => {
    const tabMatch = documentCss.match(/\.artifactTab\s*\{([^}]+)\}/);
    expect(tabMatch).not.toBeNull();
    expect(tabMatch![1]).toContain('height: 100%');
  });

  it('.artifactTab has inactive weight 400', () => {
    const tabMatch = documentCss.match(/\.artifactTab\s*\{([^}]+)\}/);
    expect(tabMatch).not.toBeNull();
    expect(tabMatch![1]).toContain('font-weight: 400');
  });

  it('.artifactTabActive has weight 600 and indicator underline', () => {
    const activeMatch = documentCss.match(/\.artifactTabActive\s*\{([^}]+)\}/);
    expect(activeMatch).not.toBeNull();
    expect(activeMatch![1]).toContain('font-weight: 600');
    expect(activeMatch![1]).toContain('border-bottom-color: var(--color-indicator)');
  });

  it('.artifactTab has margin-bottom: -1px for flush underline', () => {
    const tabMatch = documentCss.match(/\.artifactTab\s*\{([^}]+)\}/);
    expect(tabMatch).not.toBeNull();
    expect(tabMatch![1]).toContain('margin-bottom: -1px');
  });
});

describe('VC-1: Editor Toolbar', () => {
  const editorCss = readFileSync(EDITOR_CSS, 'utf-8');

  it('toolbar uses paper background: var(--color-paper)', () => {
    expect(editorCss).toContain('background-color: var(--color-paper)');
  });
});
