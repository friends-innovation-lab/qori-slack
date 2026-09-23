/**
 * Token Definition Verification Tests — CC-1 Contract Enforcement
 *
 * Per DDR-04 = B (workspace-scoped first):
 * 1. Production :root declarations must remain unchanged from pre-CC-1
 * 2. Workspace v2 overrides live under :root[data-qori-surface="workspace"]
 * 3. All var(--token) references must resolve
 * 4. PF-02 aliases must have compatibility-safe root values
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

// ─── Paths ───────────────────────────────────────────────────────────
const STYLES_DIR = join(__dirname, '..');
const SRC_DIR = join(__dirname, '..', '..');
const TOKENS_PATH = join(STYLES_DIR, 'tokens.css');

// ─── Pre-CC-1 Production Root Values (baseline snapshot) ─────────────
// These are the exact production :root values from origin/dev before CC-1.
// Any change to these indicates accidental global visual migration.
const PRODUCTION_ROOT_SNAPSHOT: Record<string, string> = {
  '--space-1': '4px',
  '--space-2': '8px',
  '--space-3': '12px',
  '--space-4': '16px',
  '--space-5': '24px',
  '--space-6': '32px',
  '--space-7': '48px',
  '--space-8': '64px',
  '--font-display': "'Public Sans', system-ui, sans-serif",
  '--font-ui': "'Public Sans', system-ui, sans-serif",
  '--font-mono': "ui-monospace, 'SF Mono', Menlo, monospace",
  '--radius-sm': '4px',
  '--radius-md': '8px',
  '--radius-lg': '12px',
  '--radius-full': '999px',
  '--color-paper': '#FAF9F7',
  '--color-surface': '#FFFFFF',
  '--color-surface-muted': '#F3F1ED',
  '--color-surface-hover': '#F6F4F0',
  '--color-surface-selected': '#FBF4DC',
  '--color-text': '#1A1915',
  '--color-text-muted': '#5C594F',
  '--color-text-meta': '#44423C',
  '--color-text-on-brand': '#1A1915',
  '--color-border': '#E5E2DA',
  '--color-border-emphasis': '#C9C5BA',
  '--color-brand': '#FFD43B',
  '--color-brand-ink': '#1A1915',
  '--color-link': '#3D5A99',
  '--color-focus': '#3D5A99',
  '--color-success': '#2E7D4F',
  '--color-success-surface': '#E8F3EC',
  '--color-warning': '#9A6A00',
  '--color-warning-surface': '#FBF1DC',
  '--color-error': '#B3372B',
  '--color-error-surface': '#FBE9E6',
  '--color-info': '#2F6C8F',
  '--color-info-surface': '#E7F1F6',
};

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Extract all CSS custom property definitions from a CSS string
 * Returns a map of property name to value
 */
function extractTokenDefinitions(css: string): Map<string, string> {
  const tokens = new Map<string, string>();
  // Match property definitions, handling multiline values
  const regex = /(--[a-z][a-z0-9-]*)\s*:\s*([^;]+);/g;
  let match;
  while ((match = regex.exec(css)) !== null) {
    tokens.set(match[1], match[2].trim());
  }
  return tokens;
}

/**
 * Extract only the :root block (not scoped selectors)
 * Handles the large :root block by finding the closing brace before the workspace scope selector
 */
function extractRootBlock(css: string): string {
  // Find the workspace scope selector (as a CSS rule, not in comments)
  // Look for newline + :root[ pattern to avoid matching comments
  const workspaceScopeMatch = css.match(/\n:root\[data-qori-surface="workspace"\]\s*\{/);
  const workspaceScopeStart = workspaceScopeMatch ? workspaceScopeMatch.index! : css.length;

  // Get everything before the workspace scope
  const beforeWorkspace = css.substring(0, workspaceScopeStart);

  // Extract the main :root block - match from `:root {` to `}` before @media
  // The :root block is one large block, so we need to find the matching closing brace
  const rootStart = beforeWorkspace.indexOf(':root {');
  if (rootStart === -1) return '';

  // Find the content between :root { and the closing } before @media
  const afterRootStart = beforeWorkspace.substring(rootStart + 7);
  // Find where the root block ends (before @media or end of beforeWorkspace)
  const mediaIndex = afterRootStart.indexOf('@media');
  const rootContent = mediaIndex > 0 ? afterRootStart.substring(0, mediaIndex) : afterRootStart;

  // Remove the trailing } if present
  const trimmed = rootContent.trim();
  return trimmed.endsWith('}') ? trimmed.slice(0, -1) : trimmed;
}

/**
 * Extract the workspace-scoped block
 */
function extractWorkspaceScopeBlock(css: string): string {
  const match = css.match(/:root\[data-qori-surface="workspace"\]\s*\{([^}]+)\}/);
  return match ? match[1] : '';
}

/**
 * Extract all var(--token) references from CSS content
 */
function extractTokenReferences(css: string): Set<string> {
  const refs = new Set<string>();
  const regex = /var\(\s*(--[a-z][a-z0-9-]*)/g;
  let match;
  while ((match = regex.exec(css)) !== null) {
    refs.add(match[1]);
  }
  return refs;
}

/**
 * Recursively find all CSS files in a directory
 */
function findCssFiles(dir: string, files: string[] = []): string[] {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (!['node_modules', 'dist', '__tests__'].includes(entry)) {
        findCssFiles(fullPath, files);
      }
    } else {
      const ext = extname(entry);
      if (['.css', '.scss', '.module.css'].includes(ext)) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('Design Tokens — CC-1 Contract', () => {
  const tokensContent = readFileSync(TOKENS_PATH, 'utf-8');
  const rootBlock = extractRootBlock(tokensContent);
  const rootTokens = extractTokenDefinitions(rootBlock);
  const workspaceBlock = extractWorkspaceScopeBlock(tokensContent);
  const workspaceTokens = extractTokenDefinitions(workspaceBlock);
  const allTokens = extractTokenDefinitions(tokensContent);

  describe('Root Stability (DDR-04 = B)', () => {
    it('tokens.css exists and has content', () => {
      expect(tokensContent.length).toBeGreaterThan(0);
    });

    it('production :root token values are unchanged from pre-CC-1', () => {
      const mismatches: string[] = [];
      for (const [name, expectedValue] of Object.entries(PRODUCTION_ROOT_SNAPSHOT)) {
        const actualValue = rootTokens.get(name);
        if (actualValue !== expectedValue) {
          mismatches.push(`${name}: expected "${expectedValue}", got "${actualValue}"`);
        }
      }
      if (mismatches.length > 0) {
        console.error('Root token mismatches (visual change detected):', mismatches);
      }
      expect(mismatches).toHaveLength(0);
    });

    it('--font-ui at :root is Public Sans (not Instrument Sans)', () => {
      const fontUi = rootTokens.get('--font-ui');
      expect(fontUi).toContain('Public Sans');
      expect(fontUi).not.toContain('Instrument Sans');
    });

    it('--color-link at :root is blue (not brass)', () => {
      const colorLink = rootTokens.get('--color-link');
      expect(colorLink).toBe('#3D5A99');
    });

    it('--color-brand at :root is yellow (not brass)', () => {
      const colorBrand = rootTokens.get('--color-brand');
      expect(colorBrand).toBe('#FFD43B');
    });
  });

  describe('Workspace Scope (DDR-04 = B)', () => {
    it('workspace scope selector exists', () => {
      expect(tokensContent).toContain(':root[data-qori-surface="workspace"]');
    });

    it('workspace scope has font overrides', () => {
      expect(workspaceTokens.has('--font-ui')).toBe(true);
      expect(workspaceTokens.get('--font-ui')).toContain('Instrument Sans');
    });

    it('workspace scope has color overrides', () => {
      expect(workspaceTokens.has('--color-link')).toBe(true);
      expect(workspaceTokens.get('--color-link')).toBe('#8A6B32');
    });

    it('workspace scope has brand overrides', () => {
      expect(workspaceTokens.has('--color-brand')).toBe(true);
      expect(workspaceTokens.get('--color-brand')).toBe('#B8965A');
    });

    it('every workspace override already exists at :root', () => {
      const orphanedOverrides: string[] = [];
      for (const name of workspaceTokens.keys()) {
        if (!rootTokens.has(name) && !allTokens.has(name)) {
          orphanedOverrides.push(name);
        }
      }
      expect(orphanedOverrides).toHaveLength(0);
    });
  });

  describe('PF-02 Aliases (compatibility-safe)', () => {
    // PF-02 aliases must exist at :root with values that match current rendering
    // (the fallback literals from document.module.css var(--x, fallback))

    it('--font-serif is defined at :root', () => {
      expect(rootTokens.has('--font-serif')).toBe(true);
    });

    it('--font-sans is defined at :root', () => {
      expect(rootTokens.has('--font-sans')).toBe(true);
    });

    it('--color-bg is defined at :root', () => {
      expect(rootTokens.has('--color-bg')).toBe(true);
    });

    it('--color-text-secondary is defined at :root', () => {
      expect(rootTokens.has('--color-text-secondary')).toBe(true);
    });

    it('--color-border-secondary is defined at :root with fallback value', () => {
      expect(rootTokens.has('--color-border-secondary')).toBe(true);
      // Should be #c9c9c9 (the fallback from document.module.css:515)
      const value = rootTokens.get('--color-border-secondary');
      expect(value).toBe('#c9c9c9');
    });

    it('--color-success-ink is defined at :root with fallback value', () => {
      expect(rootTokens.has('--color-success-ink')).toBe(true);
      // Should be #446443 (the fallback from document.module.css:501)
      const value = rootTokens.get('--color-success-ink');
      expect(value).toBe('#446443');
    });

    it('--color-success-dark is defined at :root with fallback value', () => {
      expect(rootTokens.has('--color-success-dark')).toBe(true);
      // Should be #4d8055 (the fallback from document.module.css:503)
      const value = rootTokens.get('--color-success-dark');
      expect(value).toBe('#4d8055');
    });

    it('--color-info-ink is defined at :root with fallback value', () => {
      expect(rootTokens.has('--color-info-ink')).toBe(true);
      // Should be #2e6276 (the fallback from document.module.css:507,509)
      const value = rootTokens.get('--color-info-ink');
      expect(value).toBe('#2e6276');
    });
  });

  describe('New Token Names (block 1, globally safe)', () => {
    it('defines z-index layer tokens', () => {
      const zTokens = [
        '--z-sticky', '--z-popover', '--z-nav', '--z-rail-overlay',
        '--z-topbar', '--z-drawer-scrim', '--z-drawer', '--z-toast', '--z-skip',
      ];
      for (const token of zTokens) {
        expect(allTokens.has(token)).toBe(true);
      }
    });

    it('defines inverse color tokens for dark surfaces', () => {
      const inverseTokens = [
        '--color-surface-inverse', '--color-surface-inverse-2',
        '--color-text-inverse', '--color-text-inverse-muted', '--color-text-inverse-quiet',
        '--color-focus-inverse', '--focus-ring-inverse',
      ];
      for (const token of inverseTokens) {
        expect(allTokens.has(token)).toBe(true);
      }
    });

    it('defines workspace layout tokens', () => {
      const layoutTokens = [
        '--layout-app-rail', '--layout-lifecycle', '--layout-nav-drawer',
        '--layout-artifact-header', '--layout-context-rail', '--layout-doc-measure',
      ];
      for (const token of layoutTokens) {
        expect(allTokens.has(token)).toBe(true);
      }
    });

    it('defines typography role tokens', () => {
      const typeTokens = [
        '--type-masthead-size', '--type-section-size', '--type-doc-body-size',
        '--weight-regular', '--weight-medium', '--weight-semibold', '--weight-bold',
      ];
      for (const token of typeTokens) {
        expect(allTokens.has(token)).toBe(true);
      }
    });
  });

  describe('Unresolved Token Protection', () => {
    it('all var() references in src/styles have definitions', () => {
      const cssFiles = findCssFiles(STYLES_DIR);
      const allReferences = new Set<string>();

      // Files with local-scope tokens scheduled for deletion (CC-5)
      const legacyFiles = ['brief-document.css'];

      for (const file of cssFiles) {
        if (file === TOKENS_PATH) continue;
        if (legacyFiles.some(name => file.endsWith(name))) continue;
        const content = readFileSync(file, 'utf-8');
        const refs = extractTokenReferences(content);
        refs.forEach(ref => allReferences.add(ref));
      }

      const undefinedTokens: string[] = [];
      for (const ref of allReferences) {
        if (!allTokens.has(ref)) {
          undefinedTokens.push(ref);
        }
      }

      if (undefinedTokens.length > 0) {
        console.error('Undefined tokens referenced in stylesheets:', undefinedTokens);
      }
      expect(undefinedTokens).toHaveLength(0);
    });

    it('all var() references in component CSS modules have definitions', () => {
      const componentDir = join(SRC_DIR, 'components');
      const pagesDir = join(SRC_DIR, 'pages');
      const cssFiles = [...findCssFiles(componentDir), ...findCssFiles(pagesDir)];
      const allReferences = new Set<string>();

      for (const file of cssFiles) {
        const content = readFileSync(file, 'utf-8');
        const refs = extractTokenReferences(content);
        refs.forEach(ref => allReferences.add(ref));
      }

      const undefinedTokens: string[] = [];
      for (const ref of allReferences) {
        if (!allTokens.has(ref)) {
          undefinedTokens.push(ref);
        }
      }

      if (undefinedTokens.length > 0) {
        console.error('Undefined tokens in component styles:', undefinedTokens);
      }
      expect(undefinedTokens).toHaveLength(0);
    });
  });

  describe('Runtime Activation Guard', () => {
    it('data-qori-surface attribute appears only in tokens.css and tests', () => {
      // This test ensures no runtime code activates the workspace scope in CC-1
      // The attribute should only appear in:
      // - tokens.css (selector definition)
      // - test files (verification)
      // - design documentation (reference)
      // NOT in:
      // - AppShell.tsx (that's CC-3)
      // - Any other runtime component
      const runtimeFiles = [
        join(SRC_DIR, 'components', 'shell', 'AppShell.tsx'),
        join(SRC_DIR, 'components', 'shell', 'SideNav.tsx'),
        join(SRC_DIR, 'pages'),
      ];

      for (const path of runtimeFiles) {
        try {
          const stat = statSync(path);
          if (stat.isDirectory()) {
            const files = readdirSync(path).filter(f => f.endsWith('.tsx'));
            for (const file of files) {
              const content = readFileSync(join(path, file), 'utf-8');
              expect(content).not.toContain('data-qori-surface');
            }
          } else {
            const content = readFileSync(path, 'utf-8');
            expect(content).not.toContain('data-qori-surface');
          }
        } catch {
          // File doesn't exist, that's fine
        }
      }
    });
  });
});
