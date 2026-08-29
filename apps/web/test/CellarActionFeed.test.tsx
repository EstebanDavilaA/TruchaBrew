import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CellarActionFeed } from '../src/components/CellarActionFeed';
import type { CellarScheduleEvent } from '@truchabrew/calculations';

describe('CellarActionFeed component (AC-8 & AC-9)', () => {
  const mockEvents: CellarScheduleEvent[] = [
    {
      id: 'dry-hop-add-1',
      type: 'dry_hop_add',
      title: 'Add 50g Citra (Dry Hop)',
      description: 'Dry hop addition (Pellet, 12.5% AA)',
      dayOffset: 3,
      durationDays: 4,
      targetTimestamp: '2026-08-04T12:00:00.000Z',
      amount: 50,
      unit: 'g',
      isCompleted: false,
      completedAt: null,
    },
    {
      id: 'ferm-step-1',
      type: 'temperature_step',
      title: 'Diacetyl Rest: 22.0°C (3 days)',
      description: 'Maintain 22.0°C for 3 days',
      dayOffset: 4,
      durationDays: 3,
      targetTempC: 22.0,
      targetTimestamp: '2026-08-05T12:00:00.000Z',
      isCompleted: true,
      completedAt: '2026-08-05T14:00:00.000Z',
    },
  ];

  it('renders empty state message when no events exist', () => {
    render(
      <CellarActionFeed
        events={[]}
        onMarkDone={vi.fn()}
        fermentationStartDate="2026-08-01T12:00:00.000Z"
      />
    );
    expect(screen.getByText(/No scheduled cellar actions for this recipe/i)).toBeDefined();
  });

  it('renders action cards, day badges, and status summaries (AC-8)', () => {
    render(
      <CellarActionFeed
        events={mockEvents}
        onMarkDone={vi.fn()}
        fermentationStartDate="2026-08-01T12:00:00.000Z"
      />
    );

    expect(screen.getByText('Cellar Schedule & Actions')).toBeDefined();
    expect(screen.getByText('1 Pending')).toBeDefined();
    expect(screen.getByText('1 Completed')).toBeDefined();

    // Event 1 (Pending dry hop)
    expect(screen.getByText('Add 50g Citra (Dry Hop)')).toBeDefined();
    expect(screen.getByText('Day 3')).toBeDefined();
    expect(screen.getByTestId('mark-done-btn-dry-hop-add-1')).toBeDefined();

    // Event 2 (Completed temp step)
    expect(screen.getByText('Diacetyl Rest: 22.0°C (3 days)')).toBeDefined();
    expect(screen.getByText('Day 4–7')).toBeDefined();
    expect(screen.getByText('Completed')).toBeDefined();
  });

  it('clicking "Mark Done" triggers onMarkDone callback with event (AC-9)', async () => {
    const handleMarkDone = vi.fn().mockResolvedValue(undefined);
    render(
      <CellarActionFeed
        events={mockEvents}
        onMarkDone={handleMarkDone}
        fermentationStartDate="2026-08-01T12:00:00.000Z"
      />
    );

    const markBtn = screen.getByTestId('mark-done-btn-dry-hop-add-1');
    fireEvent.click(markBtn);

    expect(handleMarkDone).toHaveBeenCalledTimes(1);
    expect(handleMarkDone).toHaveBeenCalledWith(mockEvents[0]);
  });
});
