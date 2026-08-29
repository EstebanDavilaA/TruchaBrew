import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SensoryEvaluationPanel } from '../src/components/SensoryEvaluationPanel';

describe('M17_P1 AC-12 & AC-13: SensoryEvaluationPanel', () => {
  it('renders BJCP categories and calculates score and tier dynamically (AC-12)', () => {
    render(<SensoryEvaluationPanel initialRating={4} initialNotes="Good beer" />);

    expect(screen.getByTestId('sensory-evaluation-panel')).toBeInTheDocument();
    expect(screen.getByTestId('bjcp-tier-badge')).toBeInTheDocument();

    // Change aroma slider
    const aromaInput = screen.getByLabelText(/aroma score/i);
    fireEvent.change(aromaInput, { target: { value: '12' } });

    // Change flavor slider
    const flavorInput = screen.getByLabelText(/flavor score/i);
    fireEvent.change(flavorInput, { target: { value: '20' } });

    // Total: 12 + 3 + 20 + 4 + 8 = 47 -> Outstanding (47/50)
    expect(screen.getByTestId('bjcp-tier-badge')).toHaveTextContent('Outstanding (47/50)');
  });

  it('calls onSaveEvaluation with full breakdown and score details on click (AC-13)', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<SensoryEvaluationPanel onSaveEvaluation={handleSave} />);

    const notesInput = screen.getByLabelText(/tasting notes description/i);
    fireEvent.change(notesInput, { target: { value: 'Tropical citrus notes and smooth bitterness.' } });

    const saveBtn = screen.getByTestId('save-sensory-evaluation-btn');
    fireEvent.click(saveBtn);

    expect(handleSave).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: 'Tropical citrus notes and smooth bitterness.',
        totalScore: expect.any(Number),
        tier: expect.any(String),
        starRating: expect.any(Number),
        scoreBreakdown: expect.any(Object),
      })
    );
  });
});
