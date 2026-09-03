import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SectionCard } from '../src/components/ui/SectionCard';
import {
  StickyJumpNav,
  resolveActiveIndex,
  type StickyJumpNavItem,
} from '../src/components/ui/StickyJumpNav';

// jsdom does not implement Element.prototype.scrollIntoView; stub it so the
// jump-nav click path can be exercised deterministically (spec §2 / AC-29).
const originalScrollIntoView = Element.prototype.scrollIntoView;
let scrollSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  scrollSpy = vi.fn();
  Element.prototype.scrollIntoView = scrollSpy as unknown as Element['scrollIntoView'];
});

afterEach(() => {
  Element.prototype.scrollIntoView = originalScrollIntoView;
});

const GENERAL: StickyJumpNavItem = { id: 'general', label: 'General' };
const LOSSES: StickyJumpNavItem = { id: 'losses', label: 'Losses' };
const THERMAL_MASS: StickyJumpNavItem = { id: 'thermal-mass', label: 'Thermal Mass' };

describe('StickyJumpNav — rendering (AC-21..AC-26)', () => {
  it('AC-21: empty items renders null', () => {
    const { container } = render(<StickyJumpNav items={[]} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('jump-nav')).not.toBeInTheDocument();
  });

  it('AC-22: renders a <nav> with every item button and its label', () => {
    render(<StickyJumpNav items={[GENERAL, LOSSES, THERMAL_MASS]} />);
    expect(screen.getByTestId('jump-nav')).toBeInTheDocument();
    expect(screen.getByTestId('jump-general')).toHaveTextContent('General');
    expect(screen.getByTestId('jump-losses')).toHaveTextContent('Losses');
    expect(screen.getByTestId('jump-thermal-mass')).toHaveTextContent('Thermal Mass');
  });

  it('AC-23: root is a <nav> with a non-empty section-navigation aria-label', () => {
    render(<StickyJumpNav items={[GENERAL]} />);
    const nav = screen.getByTestId('jump-nav');
    expect(nav.tagName).toBe('NAV');
    expect(nav.getAttribute('aria-label')).toBeTruthy();
  });

  it('AC-24: active item is highlighted via aria-current="true"', () => {
    render(<StickyJumpNav items={[GENERAL, LOSSES]} activeId="losses" />);
    expect(screen.getByTestId('jump-losses')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByTestId('jump-general')).not.toHaveAttribute('aria-current');
  });

  it('AC-25: unknown activeId highlights no item and does not crash', () => {
    render(<StickyJumpNav items={[GENERAL, LOSSES]} activeId="nope" />);
    expect(screen.getByTestId('jump-general')).not.toHaveAttribute('aria-current');
    expect(screen.getByTestId('jump-losses')).not.toHaveAttribute('aria-current');
  });

  it('AC-26: omitted or empty activeId highlights no item', () => {
    const { unmount } = render(<StickyJumpNav items={[GENERAL, LOSSES]} />);
    expect(screen.getByTestId('jump-general')).not.toHaveAttribute('aria-current');
    expect(screen.getByTestId('jump-losses')).not.toHaveAttribute('aria-current');
    unmount();

    render(<StickyJumpNav items={[GENERAL, LOSSES]} activeId="" />);
    expect(screen.getByTestId('jump-general')).not.toHaveAttribute('aria-current');
    expect(screen.getByTestId('jump-losses')).not.toHaveAttribute('aria-current');
  });
});

describe('resolveActiveIndex — pure helper (AC-27..AC-28)', () => {
  it('AC-27: deterministic contract across match/no-match/empty/undefined/empty-string', () => {
    const items: StickyJumpNavItem[] = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
    ];
    expect(resolveActiveIndex(items, 'b')).toBe(1);
    expect(resolveActiveIndex(items, 'nope')).toBe(-1);
    expect(resolveActiveIndex([], 'a')).toBe(-1);
    expect(resolveActiveIndex(items, '')).toBe(-1);
    expect(resolveActiveIndex(items, undefined)).toBe(-1);
  });

  it('AC-28: returns the first match on duplicate ids', () => {
    const dups: StickyJumpNavItem[] = [
      { id: 'x', label: 'X1' },
      { id: 'x', label: 'X2' },
      { id: 'y', label: 'Y' },
    ];
    expect(resolveActiveIndex(dups, 'x')).toBe(0);
  });
});

describe('StickyJumpNav — click & anchor coordination (AC-29..AC-34)', () => {
  it('AC-29: clicking a jump item smooth-scrolls to the matching SectionCard', () => {
    render(<SectionCard id="general" title="General" />);
    render(<StickyJumpNav items={[GENERAL]} onNavigate={vi.fn()} />);

    fireEvent.click(screen.getByTestId('jump-general'));

    expect(scrollSpy).toHaveBeenCalledTimes(1);
    expect(scrollSpy.mock.instances[0]).toBe(document.getElementById('general'));
  });

  it('AC-30: clicking a jump item calls onNavigate with its id', () => {
    const onNavigate = vi.fn();
    render(<SectionCard id="general" title="General" />);
    render(<SectionCard id="losses" title="Losses" />);
    render(
      <StickyJumpNav items={[GENERAL, LOSSES]} onNavigate={onNavigate} />,
    );

    fireEvent.click(screen.getByTestId('jump-general'));
    expect(onNavigate).toHaveBeenLastCalledWith('general');

    fireEvent.click(screen.getByTestId('jump-losses'));
    expect(onNavigate).toHaveBeenLastCalledWith('losses');
  });

  it('AC-31: clicking scrolls to a collapsed card without auto-expanding it', () => {
    render(<SectionCard id="general" title="General" collapsible open={false} />);
    render(<StickyJumpNav items={[GENERAL]} onNavigate={vi.fn()} />);

    fireEvent.click(screen.getByTestId('jump-general'));

    expect(scrollSpy).toHaveBeenCalledTimes(1);
    expect(scrollSpy.mock.instances[0]).toBe(document.getElementById('general'));
    expect(screen.queryByTestId('general-panel')).not.toBeInTheDocument();
  });

  it('AC-32: click with missing DOM target still calls onNavigate, no scroll, no throw', () => {
    const onNavigate = vi.fn();
    render(<StickyJumpNav items={[{ id: 'ghost', label: 'Ghost' }]} onNavigate={onNavigate} />);

    expect(() => fireEvent.click(screen.getByTestId('jump-ghost'))).not.toThrow();
    expect(onNavigate).toHaveBeenCalledWith('ghost');
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it('AC-33: coordination lockstep — SectionCard id equals the nav item id and nav scrolls to it', () => {
    render(<SectionCard id="general" title="General" />);
    render(<StickyJumpNav items={[GENERAL]} activeId="general" />);

    const section = document.getElementById('general')!;
    expect(section.tagName).toBe('SECTION');
    expect(section.id).toBe(GENERAL.id);
    expect(screen.getByTestId('jump-general')).toHaveAttribute('aria-current', 'true');

    fireEvent.click(screen.getByTestId('jump-general'));
    expect(scrollSpy.mock.instances[0]).toBe(section);
  });

  it('AC-34: jump never leaks into SectionCard open state (parent-driven open governs)', () => {
    render(<SectionCard id="general" title="General" collapsible open={false} />);
    render(<StickyJumpNav items={[GENERAL]} onNavigate={vi.fn()} />);

    fireEvent.click(screen.getByTestId('jump-general'));

    expect(screen.getByTestId('general-toggle')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('general-panel')).not.toBeInTheDocument();
  });
});
