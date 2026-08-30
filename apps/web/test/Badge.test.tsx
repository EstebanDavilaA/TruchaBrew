import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../src/components/ui';
import {
  STATUS_BADGE_CLASS,
  SEMANTIC_BADGE_CLASS,
  type SemanticBadgeVariant,
} from '../src/components/designSystem';
import type { BatchStatus } from '@truchabrew/shared-types';

describe('M35_P3: Badge UI Primitive (AC-1..AC-5, AC-19)', () => {
  it('AC-1: exports Badge and renders as a semantic span', () => {
    render(<Badge data-testid="test-badge">Active</Badge>);
    const el = screen.getByTestId('test-badge');
    expect(el.tagName).toBe('SPAN');
    expect(el).toHaveTextContent('Active');
  });

  const BATCH_STATUSES: BatchStatus[] = [
    'Planning',
    'Brewing',
    'Fermenting',
    'Conditioning',
    'Completed',
  ];

  it.each(BATCH_STATUSES)(
    'AC-2: BatchStatus variant="%s" maps to exact STATUS_BADGE_CLASS',
    (status) => {
      render(
        <Badge variant={status} data-testid={`badge-${status}`}>
          {status}
        </Badge>,
      );
      const el = screen.getByTestId(`badge-${status}`);
      const expectedClasses = STATUS_BADGE_CLASS[status].split(' ');
      for (const cls of expectedClasses) {
        expect(el).toHaveClass(cls);
      }
    },
  );

  it.each(BATCH_STATUSES)(
    'AC-2: status="%s" prop maps to exact STATUS_BADGE_CLASS',
    (status) => {
      render(
        <Badge status={status} data-testid={`badge-status-${status}`}>
          {status}
        </Badge>,
      );
      const el = screen.getByTestId(`badge-status-${status}`);
      const expectedClasses = STATUS_BADGE_CLASS[status].split(' ');
      for (const cls of expectedClasses) {
        expect(el).toHaveClass(cls);
      }
    },
  );

  const SEMANTIC_VARIANTS: SemanticBadgeVariant[] = [
    'neutral',
    'success',
    'warning',
    'danger',
    'info',
    'amber',
    'emerald',
    'rose',
    'sky',
    'slate',
  ];

  it.each(SEMANTIC_VARIANTS)(
    'AC-3: Semantic variant="%s" applies correct SEMANTIC_BADGE_CLASS',
    (variant) => {
      render(
        <Badge variant={variant} data-testid={`badge-semantic-${variant}`}>
          {variant}
        </Badge>,
      );
      const el = screen.getByTestId(`badge-semantic-${variant}`);
      const expectedClasses = SEMANTIC_BADGE_CLASS[variant].split(' ');
      for (const cls of expectedClasses) {
        expect(el).toHaveClass(cls);
      }
    },
  );

  it('AC-4: size="sm" renders compact text-[11px] and px-2', () => {
    render(
      <Badge size="sm" data-testid="badge-sm">
        Small
      </Badge>,
    );
    const el = screen.getByTestId('badge-sm');
    expect(el).toHaveClass('px-2', 'py-0.5', 'text-[11px]');
  });

  it('AC-4: size="md" (default) renders standard text-xs and px-2.5', () => {
    render(<Badge data-testid="badge-md">Medium</Badge>);
    const el = screen.getByTestId('badge-md');
    expect(el).toHaveClass('px-2.5', 'py-0.5', 'text-xs');
  });

  it('renders pulse animation when pulse=true', () => {
    render(
      <Badge pulse data-testid="badge-pulse">
        Live
      </Badge>,
    );
    const el = screen.getByTestId('badge-pulse');
    expect(el).toHaveClass('animate-pulse');
  });

  it('renders indicator dot when dot=true', () => {
    render(
      <Badge dot data-testid="badge-dot">
        Dot
      </Badge>,
    );
    const el = screen.getByTestId('badge-dot');
    expect(el.querySelector('span')).toBeInTheDocument();
  });

  it('AC-19: supports custom aria-label and role attributes', () => {
    render(
      <Badge
        role="status"
        aria-label="Current batch state is fermenting"
        data-testid="badge-a11y"
      >
        Fermenting
      </Badge>,
    );
    const el = screen.getByRole('status');
    expect(el).toHaveAttribute('aria-label', 'Current batch state is fermenting');
    expect(el).toHaveTextContent('Fermenting');
  });
});
