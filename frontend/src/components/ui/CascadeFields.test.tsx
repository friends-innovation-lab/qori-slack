/**
 * CascadeFields tests — structured rendering of cascade variable arrays.
 */

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '@testing-library/react';
import { ObjectivesList, QuestionsList, BarriersList, ScalarField } from './CascadeFields';

describe('ObjectivesList', () => {
  it('renders parsed objectives with IDs', () => {
    const raw = JSON.stringify([
      { id: 'OBJ-001', objective: 'Understand scheduling pain points' },
      { id: 'OBJ-002', objective: 'Identify navigation barriers' },
    ]);
    render(<ObjectivesList raw={raw} />);
    expect(screen.getByText('OBJ-001')).toBeInTheDocument();
    expect(screen.getByText('Understand scheduling pain points')).toBeInTheDocument();
    expect(screen.getByText('OBJ-002')).toBeInTheDocument();
  });

  it('renders plain string fallback for non-JSON', () => {
    render(<ObjectivesList raw="Simple text objective" />);
    expect(screen.getByText('Simple text objective')).toBeInTheDocument();
  });

  it('renders nothing for null', () => {
    const { container } = render(<ObjectivesList raw={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('does not render raw JSON string', () => {
    const raw = JSON.stringify([{ id: 'OBJ-001', objective: 'Test' }]);
    render(<ObjectivesList raw={raw} />);
    expect(screen.queryByText(raw)).not.toBeInTheDocument();
  });
});

describe('QuestionsList', () => {
  it('renders questions with priority badges', () => {
    const raw = JSON.stringify([
      { id: 'RQ-001', question: 'How do users find appointments?', priority: 'Primary' },
      { id: 'RQ-002', question: 'What confuses them?', priority: 'Secondary' },
    ]);
    render(<QuestionsList raw={raw} />);
    expect(screen.getByText('RQ-001')).toBeInTheDocument();
    expect(screen.getByText('How do users find appointments?')).toBeInTheDocument();
    expect(screen.getByText('Primary')).toBeInTheDocument();
    expect(screen.getByText('Secondary')).toBeInTheDocument();
  });

  it('handles null priority gracefully', () => {
    const raw = JSON.stringify([{ id: 'RQ-001', question: 'Test?', priority: null }]);
    render(<QuestionsList raw={raw} />);
    expect(screen.getByText('RQ-001')).toBeInTheDocument();
    expect(screen.getByText('Test?')).toBeInTheDocument();
  });
});

describe('BarriersList', () => {
  it('renders barriers with sources', () => {
    const raw = JSON.stringify([
      { id: 'TB-001', barrier: 'Complex navigation', source: 'Desk research' },
      { id: 'TB-002', barrier: 'Missing context', source: null },
    ]);
    render(<BarriersList raw={raw} />);
    expect(screen.getByText('TB-001')).toBeInTheDocument();
    expect(screen.getByText(/Complex navigation/)).toBeInTheDocument();
    expect(screen.getByText(/Desk research/)).toBeInTheDocument();
    expect(screen.getByText('TB-002')).toBeInTheDocument();
  });
});

describe('ScalarField', () => {
  it('renders label and value', () => {
    render(<dl><ScalarField label="Methodology" value="usability testing" /></dl>);
    expect(screen.getByText('Methodology')).toBeInTheDocument();
    expect(screen.getByText('usability testing')).toBeInTheDocument();
  });

  it('renders nothing for null value', () => {
    const { container } = render(<dl><ScalarField label="Budget" value={null} /></dl>);
    expect(screen.queryByText('Budget')).not.toBeInTheDocument();
    expect(container.querySelector('dt')).toBeNull();
  });
});
