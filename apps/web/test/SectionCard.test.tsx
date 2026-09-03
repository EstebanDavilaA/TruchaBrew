import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SectionCard } from '../src/components/ui/SectionCard';
import {
  SectionCard as BarrelSectionCard,
  StickyJumpNav,
  resolveActiveIndex,
} from '../src/components/ui';
import type {
  SectionCardHeadingLevel,
  StickyJumpNavProps,
  StickyJumpNavItem,
} from '../src/components/ui';
import { CARD_CLASS } from '../src/components/designSystem';

describe('SectionCard — non-collapsible shell (AC-1..AC-8)', () => {
  it('AC-1: renders a root <section> with DOM id equal to the id prop', () => {
    render(<SectionCard id="general" title="Fermentables" />);
    const section = document.getElementById('general');
    expect(section).not.toBeNull();
    expect(section!.tagName).toBe('SECTION');
    expect(screen.getByTestId('general-section')).toBeInTheDocument();
  });

  it('AC-2: renders title text and a plain-header data-testid', () => {
    render(<SectionCard id="general" title="Fermentables" />);
    expect(screen.getByText('Fermentables')).toBeInTheDocument();
    expect(screen.getByTestId('general-title')).toBeInTheDocument();
  });

  it('AC-3: headingLevel defaults to h2', () => {
    render(<SectionCard id="general" title="Fermentables" />);
    expect(screen.getByTestId('general-title').tagName).toBe('H2');
  });

  it('AC-4: headingLevel={4} renders an h4', () => {
    render(<SectionCard id="general" title="Fermentables" headingLevel={4} />);
    expect(screen.getByTestId('general-title').tagName).toBe('H4');
  });

  it('AC-5: non-collapsible renders children always, with no toggle button', () => {
    render(
      <SectionCard id="general" title="Fermentables">
        <span>body content</span>
      </SectionCard>,
    );
    const panel = screen.getByTestId('general-panel');
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveTextContent('body content');
    expect(screen.queryByTestId('general-toggle')).not.toBeInTheDocument();
  });

  it('AC-6: icon is decorative (aria-hidden span, excluded from accessible name)', () => {
    render(
      <SectionCard id="general" title="Fermentables" icon={<span>deco-icon</span>} />,
    );
    expect(screen.getByRole('heading', { name: 'Fermentables' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /deco-icon/ })).not.toBeInTheDocument();
    const iconText = within(screen.getByTestId('general-title')).getByText('deco-icon');
    expect(iconText.closest('span[aria-hidden="true"]')).not.toBeNull();
  });

  it('AC-7: badge slot renders at the header, after the title span', () => {
    render(<SectionCard id="general" title="Fermentables" badge={<span>12 items</span>} />);
    const header = screen.getByTestId('general-title');
    const titleEl = within(header).getByText('Fermentables');
    const badgeEl = within(header).getByText('12 items');
    expect(badgeEl).toBeInTheDocument();
    expect(titleEl.compareDocumentPosition(badgeEl)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('AC-8: className passthrough lands on the root <section> alongside CARD_CLASS', () => {
    render(<SectionCard id="general" title="Fermentables" className="custom-shell" />);
    const section = document.getElementById('general')!;
    expect(section.className).toContain(CARD_CLASS);
    expect(section.className).toContain('custom-shell');
  });
});

describe('SectionCard — collapsible disclosure (AC-9..AC-20)', () => {
  it('AC-9: collapsible renders a real toggle button', () => {
    render(<SectionCard id="general" title="Fermentables" collapsible />);
    const toggle = screen.getByTestId('general-toggle');
    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle).toHaveAttribute('type', 'button');
  });

  it('AC-10: collapsible is open by default', () => {
    render(<SectionCard id="general" title="Fermentables" collapsible />);
    expect(screen.getByTestId('general-toggle')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('general-panel')).toBeInTheDocument();
  });

  it('AC-11: collapsible defaultOpen={false} starts collapsed', () => {
    render(<SectionCard id="general" title="Fermentables" collapsible defaultOpen={false} />);
    expect(screen.getByTestId('general-toggle')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('general-panel')).not.toBeInTheDocument();
  });

  it('AC-12: uncontrolled click toggles open -> closed', () => {
    render(<SectionCard id="general" title="Fermentables" collapsible />);
    fireEvent.click(screen.getByTestId('general-toggle'));
    expect(screen.getByTestId('general-toggle')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('general-panel')).not.toBeInTheDocument();
  });

  it('AC-13: uncontrolled click toggles closed -> open', () => {
    render(<SectionCard id="general" title="Fermentables" collapsible defaultOpen={false} />);
    fireEvent.click(screen.getByTestId('general-toggle'));
    expect(screen.getByTestId('general-toggle')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('general-panel')).toBeInTheDocument();
  });

  it('AC-14: uncontrolled onToggle observes the flip (false then true)', () => {
    const onToggle = vi.fn();
    render(<SectionCard id="general" title="Fermentables" collapsible onToggle={onToggle} />);
    fireEvent.click(screen.getByTestId('general-toggle'));
    expect(onToggle).toHaveBeenNthCalledWith(1, false);
    fireEvent.click(screen.getByTestId('general-toggle'));
    expect(onToggle).toHaveBeenNthCalledWith(2, true);
  });

  it('AC-15: controlled open={true} stays open regardless of click', () => {
    const onToggle = vi.fn();
    render(
      <SectionCard id="general" title="Fermentables" collapsible open onToggle={onToggle} />,
    );
    fireEvent.click(screen.getByTestId('general-toggle'));
    expect(screen.getByTestId('general-toggle')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('general-panel')).toBeInTheDocument();
  });

  it('AC-16: controlled open={false} stays closed regardless of click', () => {
    render(<SectionCard id="general" title="Fermentables" collapsible open={false} />);
    expect(screen.queryByTestId('general-panel')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('general-toggle'));
    expect(screen.queryByTestId('general-panel')).not.toBeInTheDocument();
  });

  it('AC-17: controlled click fires onToggle with the negation of open', () => {
    const onToggle = vi.fn();
    render(
      <SectionCard id="general" title="Fermentables" collapsible open onToggle={onToggle} />,
    );
    fireEvent.click(screen.getByTestId('general-toggle'));
    expect(onToggle).toHaveBeenLastCalledWith(false);
  });

  it('AC-18: defaultOpen is ignored in controlled mode', () => {
    render(
      <SectionCard id="general" title="Fermentables" collapsible open={false} defaultOpen />,
    );
    expect(screen.getByTestId('general-toggle')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('general-panel')).not.toBeInTheDocument();
  });

  it('AC-19: toggle carries aria-controls = panel id, and the panel has that DOM id', () => {
    render(<SectionCard id="general" title="Fermentables" collapsible />);
    expect(screen.getByTestId('general-toggle')).toHaveAttribute(
      'aria-controls',
      'general-panel',
    );
    expect(screen.getByTestId('general-panel')).toHaveAttribute('id', 'general-panel');
    expect(document.getElementById('general-panel')).toBe(screen.getByTestId('general-panel'));
  });

  it('AC-20: toggling one card never changes another (independent disclosures)', () => {
    render(
      <>
        <SectionCard id="a" title="Card A" collapsible />
        <SectionCard id="b" title="Card B" collapsible />
      </>,
    );
    fireEvent.click(screen.getByTestId('a-toggle'));
    expect(screen.getByTestId('a-toggle')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('b-toggle')).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('AC-38: ui barrel exports the new primitives + helper', () => {
  it('resolves values and types from the barrel', () => {
    const level: SectionCardHeadingLevel = 3;
    const item: StickyJumpNavItem = { id: 'x', label: 'X' };
    const navProps: StickyJumpNavProps = { items: [item], activeId: 'x' };

    render(<BarrelSectionCard id="barrel" title="Barrel" headingLevel={level} />);
    render(<StickyJumpNav {...navProps} />);

    expect(screen.getByTestId('barrel-title').tagName).toBe('H3');
    expect(screen.getByTestId('jump-x')).toHaveTextContent('X');
    expect(resolveActiveIndex([item], 'x')).toBe(0);
  });
});
