/**
 * Document component tests — structured rendering, stable IDs, provenance tags.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { IdTag } from '../IdTag';
import { ProvenanceTag } from '../ProvenanceTag';
import { DocumentSection } from '../DocumentSection';
import { StructuredItemRow } from '../StructuredItemRow';
import { Masthead } from '../Masthead';
import { FactsGrid } from '../FactsGrid';
import { DocumentTable } from '../DocumentTable';
import { CollapsibleSection } from '../CollapsibleSection';
import { ArtifactTabs } from '../ArtifactTabs';
import { SaveStateIndicator } from '../SaveStateIndicator';

describe('IdTag', () => {
  it('renders stable ID with tooltip', () => {
    render(<IdTag id="OBJ-001" />);
    const tag = screen.getByText('OBJ-001');
    expect(tag).toBeInTheDocument();
    expect(tag).toHaveAttribute('data-stable-id', 'OBJ-001');
    expect(tag).toHaveAttribute('title', expect.stringContaining('stable canonical ID'));
  });

  it('renders different ID formats', () => {
    const { rerender } = render(<IdTag id="RQ-003" />);
    expect(screen.getByText('RQ-003')).toBeInTheDocument();
    rerender(<IdTag id="TB-012" />);
    expect(screen.getByText('TB-012')).toBeInTheDocument();
  });
});

describe('ProvenanceTag', () => {
  it('renders canonical tag', () => {
    render(<ProvenanceTag provenance="canonical" editable />);
    expect(screen.getByText(/Canonical/)).toBeInTheDocument();
    expect(screen.getByText(/editable/)).toBeInTheDocument();
  });

  it('renders system read-only tag', () => {
    render(<ProvenanceTag provenance="system" editable={false} />);
    expect(screen.getByText(/System/)).toBeInTheDocument();
    expect(screen.getByText(/read-only/)).toBeInTheDocument();
  });

  it('renders inherited tag', () => {
    render(<ProvenanceTag provenance="inherited" editable={false} />);
    expect(screen.getByText(/Inherited/)).toBeInTheDocument();
  });
});

describe('DocumentSection', () => {
  it('renders heading with provenance', () => {
    render(
      <DocumentSection sectionId="summary" title="Summary" provenance="generated" editable>
        <p>Test content</p>
      </DocumentSection>,
    );
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText(/Generated/)).toBeInTheDocument();
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('sets data-sec attribute', () => {
    const { container } = render(
      <DocumentSection sectionId="objectives" title="Objectives">
        <p>Content</p>
      </DocumentSection>,
    );
    expect(container.querySelector('[data-sec="objectives"]')).not.toBeNull();
  });
});

describe('StructuredItemRow', () => {
  it('renders objective with ID', () => {
    render(<StructuredItemRow id="OBJ-001" text="Understand scheduling" />);
    expect(screen.getByText('OBJ-001')).toBeInTheDocument();
    expect(screen.getByText('Understand scheduling')).toBeInTheDocument();
  });

  it('renders question with priority badge', () => {
    render(<StructuredItemRow id="RQ-001" text="How do users find?" priority="Primary" />);
    expect(screen.getByText('RQ-001')).toBeInTheDocument();
    expect(screen.getByText('Primary')).toBeInTheDocument();
  });

  it('renders barrier with source', () => {
    render(<StructuredItemRow id="TB-001" text="Complex nav" source="Desk research" />);
    expect(screen.getByText('TB-001')).toBeInTheDocument();
    expect(screen.getByText(/Desk research/)).toBeInTheDocument();
  });

  it('does not render raw JSON', () => {
    render(<StructuredItemRow id="OBJ-001" text="Test objective" />);
    expect(screen.queryByText('"id"')).not.toBeInTheDocument();
    expect(screen.queryByText('"objective"')).not.toBeInTheDocument();
  });
});

describe('Masthead', () => {
  it('renders study metadata', () => {
    render(<Masthead studyName="Claims Study" researcherName="Jane Doe" date="2026-09-01" />);
    expect(screen.getByText('Claims Study')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });
});

describe('FactsGrid', () => {
  it('renders fact items', () => {
    render(<FactsGrid facts={[
      { label: 'Method', value: 'Usability testing' },
      { label: 'Budget', value: '$800' },
    ]} />);
    expect(screen.getByText('Usability testing')).toBeInTheDocument();
    expect(screen.getByText('$800')).toBeInTheDocument();
  });

  it('renders nothing for empty facts', () => {
    const { container } = render(<FactsGrid facts={[]} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('DocumentTable', () => {
  it('renders table with rows', () => {
    render(<DocumentTable
      columns={[{ key: 'risk', label: 'Risk' }, { key: 'mitigation', label: 'Mitigation' }]}
      rows={[{ risk: 'Late recruitment', mitigation: 'Start early' }]}
    />);
    expect(screen.getByText('Late recruitment')).toBeInTheDocument();
    expect(screen.getByText('Start early')).toBeInTheDocument();
  });
});

describe('CollapsibleSection', () => {
  it('renders details with summary', () => {
    render(<CollapsibleSection title="Validity checklist"><p>Content</p></CollapsibleSection>);
    expect(screen.getByText('Validity checklist')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });
});

describe('ArtifactTabs', () => {
  it('renders Brief and Plan tabs', () => {
    render(
      <MemoryRouter>
        <ArtifactTabs active="brief" studyPublicId="s1" />
      </MemoryRouter>,
    );
    expect(screen.getByText('Brief')).toBeInTheDocument();
    expect(screen.getByText('Research Plan')).toBeInTheDocument();
  });

  it('marks active tab', () => {
    render(
      <MemoryRouter>
        <ArtifactTabs active="plan" studyPublicId="s1" />
      </MemoryRouter>,
    );
    const planTab = screen.getByText('Research Plan');
    expect(planTab).toHaveAttribute('aria-selected', 'true');
  });
});

describe('SaveStateIndicator', () => {
  it('renders saved state', () => {
    render(<SaveStateIndicator state="saved" />);
    expect(screen.getByText(/Saved/)).toBeInTheDocument();
  });

  it('renders dirty state', () => {
    render(<SaveStateIndicator state="dirty" />);
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(<SaveStateIndicator state="error" />);
    expect(screen.getByText(/Save failed/)).toBeInTheDocument();
  });
});
