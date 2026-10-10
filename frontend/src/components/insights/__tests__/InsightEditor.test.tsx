/**
 * InsightEditor tests — editing and validation.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InsightEditor, type AvailableSource, type EditorReference } from '../InsightEditor';

const mockSources: AvailableSource[] = [
  { id: 1, label: 'Report.pdf', publicId: 'src-001' },
  { id: 2, label: 'Study.docx', publicId: 'src-002' },
];

describe('InsightEditor', () => {
  it('renders editor with display ID', () => {
    render(
      <InsightEditor
        insightDisplayId="IN-0001"
        availableSources={mockSources}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/New Insight/)).toBeInTheDocument();
  });

  it('shows edit title when initial wording provided', () => {
    render(
      <InsightEditor
        insightDisplayId="IN-0001"
        initialWording="Existing wording"
        availableSources={mockSources}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('Edit IN-0001')).toBeInTheDocument();
  });

  it('renders textarea for wording', () => {
    render(
      <InsightEditor
        insightDisplayId="IN-0001"
        availableSources={mockSources}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/Insight wording/)).toBeInTheDocument();
  });

  it('populates initial wording', () => {
    render(
      <InsightEditor
        insightDisplayId="IN-0001"
        initialWording="Test wording"
        availableSources={mockSources}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue('Test wording')).toBeInTheDocument();
  });

  it('renders source selector', () => {
    render(
      <InsightEditor
        insightDisplayId="IN-0001"
        availableSources={mockSources}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/Add evidence from source/)).toBeInTheDocument();
  });

  it('adds reference when source selected', async () => {
    render(
      <InsightEditor
        insightDisplayId="IN-0001"
        availableSources={mockSources}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const select = screen.getByLabelText(/Add evidence from source/);
    await userEvent.selectOptions(select, '1');

    expect(screen.getByText('Report.pdf')).toBeInTheDocument();
  });

  it('removes reference when remove clicked', async () => {
    const initialRefs: EditorReference[] = [
      { key: 'ref-1', evidenceSourceId: 1, sourceLabel: 'Report.pdf', locator: {} },
    ];
    render(
      <InsightEditor
        insightDisplayId="IN-0001"
        initialReferences={initialRefs}
        availableSources={mockSources}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // Reference row exists with remove button
    const removeButton = screen.getByLabelText(/Remove reference to Report.pdf/);
    expect(removeButton).toBeInTheDocument();

    await userEvent.click(removeButton);

    // Remove button should disappear (source moves to dropdown)
    await waitFor(() => {
      expect(screen.queryByLabelText(/Remove reference to Report.pdf/)).not.toBeInTheDocument();
    });
  });

  it('shows source-level checkbox for each reference', async () => {
    const initialRefs: EditorReference[] = [
      { key: 'ref-1', evidenceSourceId: 1, sourceLabel: 'Report.pdf', locator: {} },
    ];
    render(
      <InsightEditor
        insightDisplayId="IN-0001"
        initialReferences={initialRefs}
        availableSources={mockSources}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText(/Link to source as a whole/)).toBeInTheDocument();
  });

  it('hides locator fields when source-level checked', async () => {
    const initialRefs: EditorReference[] = [
      { key: 'ref-1', evidenceSourceId: 1, sourceLabel: 'Report.pdf', locator: {} },
    ];
    render(
      <InsightEditor
        insightDisplayId="IN-0001"
        initialReferences={initialRefs}
        availableSources={mockSources}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // Initially locator fields should be visible
    expect(screen.getByLabelText('Page')).toBeInTheDocument();

    // Check source-level
    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);

    // Locator fields should be hidden
    expect(screen.queryByLabelText('Page')).not.toBeInTheDocument();
  });

  it('validates wording is required by disabling submit', () => {
    const initialRefs: EditorReference[] = [
      { key: 'ref-1', evidenceSourceId: 1, sourceLabel: 'Report.pdf', locator: {} },
    ];
    render(
      <InsightEditor
        insightDisplayId="IN-0001"
        initialReferences={initialRefs}
        availableSources={mockSources}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // Button should be disabled without wording
    const createButton = screen.getByRole('button', { name: /Create Insight/ });
    expect(createButton).toBeDisabled();
  });

  it('validates at least one reference required', async () => {
    render(
      <InsightEditor
        insightDisplayId="IN-0001"
        availableSources={mockSources}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // Enter wording but no references
    const textarea = screen.getByLabelText(/Insight wording/);
    await userEvent.type(textarea, 'Test wording');

    // The button should be disabled
    const createButton = screen.getByRole('button', { name: /Create Insight/ });
    expect(createButton).toBeDisabled();
  });

  it('calls onSave with valid data', async () => {
    const onSave = vi.fn();
    const initialRefs: EditorReference[] = [
      { key: 'ref-1', evidenceSourceId: 1, sourceLabel: 'Report.pdf', locator: {} },
    ];
    render(
      <InsightEditor
        insightDisplayId="IN-0001"
        initialReferences={initialRefs}
        availableSources={mockSources}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    // Enter wording
    const textarea = screen.getByLabelText(/Insight wording/);
    await userEvent.type(textarea, 'Test wording');

    // Click create
    const createButton = screen.getByRole('button', { name: /Create Insight/ });
    await userEvent.click(createButton);

    expect(onSave).toHaveBeenCalledWith('Test wording', initialRefs);
  });

  it('calls onCancel when cancel clicked', async () => {
    const onCancel = vi.fn();
    render(
      <InsightEditor
        insightDisplayId="IN-0001"
        availableSources={mockSources}
        onSave={vi.fn()}
        onCancel={onCancel}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables inputs when saving', () => {
    const initialRefs: EditorReference[] = [
      { key: 'ref-1', evidenceSourceId: 1, sourceLabel: 'Report.pdf', locator: {} },
    ];
    render(
      <InsightEditor
        insightDisplayId="IN-0001"
        initialReferences={initialRefs}
        availableSources={mockSources}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        saving={true}
      />,
    );

    expect(screen.getByLabelText(/Insight wording/)).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('shows "Propose Revision" for editing existing', () => {
    const initialRefs: EditorReference[] = [
      { key: 'ref-1', evidenceSourceId: 1, sourceLabel: 'Report.pdf', locator: {} },
    ];
    render(
      <InsightEditor
        insightDisplayId="IN-0001"
        initialWording="Existing wording"
        initialReferences={initialRefs}
        availableSources={mockSources}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Propose Revision' })).toBeInTheDocument();
  });

  it('shows note about save not accepting (D3)', () => {
    render(
      <InsightEditor
        insightDisplayId="IN-0001"
        availableSources={mockSources}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText(/does not automatically accept/)).toBeInTheDocument();
  });

  it('shows empty state when no sources available', () => {
    render(
      <InsightEditor
        insightDisplayId="IN-0001"
        availableSources={[]}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText(/No sources available/)).toBeInTheDocument();
  });
});
