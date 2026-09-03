import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { TopBar } from '../src/components/TopBar';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PAGE_TITLE_CLASS } from '../src/components/designSystem';

describe('AC-10: TopBar heading behavior, both prop states', () => {
  it('(a) with a title passed, the sole level-1 heading has that accessible name and carries PAGE_TITLE_CLASS', () => {
    render(<TopBar title="Recipe Library" />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveAccessibleName('Recipe Library');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const expectedTokens = PAGE_TITLE_CLASS.split(/\s+/);
    for (const token of expectedTokens) {
      expect(heading.className).toContain(token);
    }
  });

  it('(b) with title omitted, no heading of any level and no role="heading"/aria-level element', () => {
    const { container } = render(
      <TopBar leading={<button>Back</button>}>
        <button>Contextual</button>
      </TopBar>,
    );
    expect(within(container).queryAllByRole('heading')).toHaveLength(0);
    expect(container.querySelector('[role="heading"]')).toBeNull();
    expect(container.querySelector('[aria-level]')).toBeNull();
  });
});

describe('AC-11: TopBar renders contextual actions and nothing else', () => {
  it('a named children button renders; with no children, only the leading control (if any) renders as a button', () => {
    render(
      <TopBar title="Recipe Library">
        <button>X</button>
      </TopBar>,
    );
    expect(screen.getByRole('button', { name: 'X' })).toBeInTheDocument();
  });

  it('with no children and no leading, no button renders inside TopBar', () => {
    const { container } = render(<TopBar title="Recipe Library" />);
    expect(within(container).queryAllByRole('button')).toHaveLength(0);
  });

  it('with no children but a leading control, only the leading button renders', () => {
    const { container } = render(<TopBar title="Recipe Library" leading={<button>Back</button>} />);
    expect(within(container).getAllByRole('button')).toHaveLength(1);
    expect(within(container).getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });
});

describe('AC-12: TopBar carries no destination links', () => {
  it('no rendered element has an accessible name equal to any NAV_ITEMS label, given a non-colliding title', () => {
    render(
      <TopBar title="Recipe Library">
        <button>Contextual</button>
      </TopBar>,
    );
    const navLabels = ['Recipes', 'Equipment Profiles', 'Mash Profiles', 'Fermentation Profiles', 'Batches'];
    for (const label of navLabels) {
      expect(screen.queryByRole('button', { name: label })).toBeNull();
      expect(screen.queryByRole('link', { name: label })).toBeNull();
    }
  });

  it('TopBar.tsx contains no import from ./Sidebar', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/TopBar.tsx'), 'utf8');
    expect(source).not.toMatch(/from\s+['"]\.\/Sidebar['"]/);
  });
});

// --- M5.5_P3 additions: the new `search` slot (AC-8..AC-12 of that spec) ---

describe('M5.5_P3 AC-8: search is optional and additive', () => {
  it('<TopBar />, <TopBar title="x" />, <TopBar leading={…} /> and <TopBar>{…}</TopBar> all render with no search', () => {
    render(<TopBar />);
    render(<TopBar title="x" />);
    render(<TopBar leading={<button>Back</button>} />);
    render(<TopBar><button>Action</button></TopBar>);
    // Compiles + renders without a search prop at every pre-existing call shape.
    expect(screen.queryAllByTestId('topbar-search')).toHaveLength(0);
  });
});

describe('M5.5_P3 AC-9: the search slot renders between lead and actions', () => {
  it('with title, search and children all supplied, DOM order is lead, search, actions; the search node is a descendant of the search slot only', () => {
    render(
      <TopBar title="Recipe Library" search={<input placeholder="search-probe" />}>
        <button>Action</button>
      </TopBar>,
    );
    const row = screen.getByTestId('topbar-row');
    const children = Array.from(row.children);
    const testids = children.map((c) => c.getAttribute('data-testid'));
    expect(testids).toEqual(['topbar-lead', 'topbar-search', 'topbar-actions']);

    const searchSlot = screen.getByTestId('topbar-search');
    const actionsSlot = screen.getByTestId('topbar-actions');
    const input = screen.getByPlaceholderText('search-probe');
    expect(searchSlot).toContainElement(input);
    expect(actionsSlot).not.toContainElement(input);
  });
});

describe('M5.5_P3 AC-10: the three testids exist and are unique', () => {
  it('each of topbar-lead, topbar-search, topbar-actions matches at most one element; topbar-lead always renders', () => {
    render(
      <TopBar title="x" search={<input placeholder="s" />}>
        <button>a</button>
      </TopBar>,
    );
    expect(screen.getAllByTestId('topbar-lead')).toHaveLength(1);
    expect(screen.getAllByTestId('topbar-search')).toHaveLength(1);
    expect(screen.getAllByTestId('topbar-actions')).toHaveLength(1);
  });

  it('topbar-lead always renders even with no props at all', () => {
    render(<TopBar />);
    expect(screen.getAllByTestId('topbar-lead')).toHaveLength(1);
  });
});

describe('M5.5_P3 AC-11: falsy search (and children) render no slot at all', () => {
  it.each([
    ['omitted', undefined],
    ['null', null],
    ['false', false],
  ] as const)('search %s -> no topbar-search element (not an empty div)', (_label, value) => {
    const { unmount } = render(<TopBar title="x" search={value} />);
    expect(screen.queryByTestId('topbar-search')).toBeNull();
    unmount();
  });

  it.each([
    ['omitted', undefined],
    ['null', null],
    ['false', false],
  ] as const)('children %s -> no topbar-actions element, proving the pre-existing guard was not regressed', (_label, value) => {
    const { unmount } = render(<TopBar title="x">{value}</TopBar>);
    expect(screen.queryByTestId('topbar-actions')).toBeNull();
    unmount();
  });
});

describe('AC-10 (M26_P1): TopBar hamburger button on onOpenMobileNav', () => {
  it('passing onOpenMobileNav renders a button with aria-label="Open navigation menu"; clicking it calls the callback', () => {
    const onOpenMobileNav = vi.fn();
    render(<TopBar title="Recipe Library" onOpenMobileNav={onOpenMobileNav} />);
    const btn = screen.getByRole('button', { name: 'Open navigation menu' });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onOpenMobileNav).toHaveBeenCalledTimes(1);
  });

  it('the hamburger button carries md:hidden so it is mobile-only', () => {
    const onOpenMobileNav = vi.fn();
    render(<TopBar title="Recipe Library" onOpenMobileNav={onOpenMobileNav} />);
    const btn = screen.getByRole('button', { name: 'Open navigation menu' });
    expect(btn.className).toContain('md:hidden');
  });

  it('renders the hamburger inside the topbar-lead slot, ahead of any leading control', () => {
    const onOpenMobileNav = vi.fn();
    render(
      <TopBar title="Recipe Library" onOpenMobileNav={onOpenMobileNav} leading={<button>Back</button>} />,
    );
    const lead = screen.getByTestId('topbar-lead');
    const children = Array.from(lead.children);
    const hamburgerIndex = children.findIndex((c) => c.getAttribute('aria-label') === 'Open navigation menu');
    const backIndex = children.findIndex((c) => c.textContent === 'Back');
    expect(hamburgerIndex).toBeGreaterThanOrEqual(0);
    expect(hamburgerIndex).toBeLessThan(backIndex);
  });
});

describe('AC-11 (M26_P1): TopBar omitting onOpenMobileNav preserves backward compatibility', () => {
  it('omitting onOpenMobileNav renders no hamburger button', () => {
    render(<TopBar title="Recipe Library" />);
    expect(screen.queryByRole('button', { name: 'Open navigation menu' })).toBeNull();
  });

  it('with no children, no leading, and no onOpenMobileNav, no button renders at all (pre-existing AC-11 contract preserved)', () => {
    const { container } = render(<TopBar title="Recipe Library" />);
    expect(within(container).queryAllByRole('button')).toHaveLength(0);
  });

  it('with a leading control but no onOpenMobileNav, only the leading button renders (exactly 1)', () => {
    const { container } = render(<TopBar title="Recipe Library" leading={<button>Back</button>} />);
    expect(within(container).getAllByRole('button')).toHaveLength(1);
  });
});

describe('M5.5_P3 AC-12: TopBar chrome is unchanged', () => {
  it('the header carries sticky/top-0/z-30/h-16/border-b, and title renders exactly one <h1> or none', () => {
    const { container, rerender } = render(<TopBar title="x" />);
    const header = container.querySelector('header')!;
    expect(header.className).toContain('sticky');
    expect(header.className).toContain('top-0');
    expect(header.className).toContain('z-30');
    expect(header.className).toContain('md:h-16');
    expect(header.className).toContain('h-auto');
    expect(header.className).toContain('border-b');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);

    rerender(<TopBar />);
    expect(screen.queryAllByRole('heading')).toHaveLength(0);
  });
});

describe('AC-17 (Amendment 2): TopBar responsive row contract', () => {
  it('header className contains h-auto and md:h-16, and NOT the standalone token h-16', () => {
    const { container } = render(<TopBar title="x" />);
    const header = container.querySelector('header')!;
    const headerTokens = header.className.split(/\s+/);
    expect(headerTokens).toContain('h-auto');
    expect(headerTokens).toContain('md:h-16');
    expect(headerTokens).not.toContain('h-16');
  });

  it('topbar-row is the header\'s only element child and carries the full responsive token set', () => {
    const { container } = render(<TopBar title="x" />);
    const header = container.querySelector('header')!;
    const row = screen.getByTestId('topbar-row');
    expect(header.children).toHaveLength(1);
    expect(header.children[0]).toBe(row);

    const rowTokens = row.className.split(/\s+/);
    for (const token of [
      'min-h-16',
      'md:h-16',
      'flex',
      'flex-wrap',
      'md:flex-nowrap',
      'items-center',
      'justify-between',
      'gap-x-4',
      'gap-y-2',
      'py-2',
      'md:py-0',
    ]) {
      expect(rowTokens).toContain(token);
    }
  });
});

describe('AC-18 (Amendment 2): TopBar slot classes and preserved DOM order', () => {
  it('topbar-search, topbar-actions and topbar-lead carry the binding responsive class strings', () => {
    render(
      <TopBar title="x" search={<input placeholder="s" />}>
        <button>a</button>
      </TopBar>,
    );

    const searchTokens = screen.getByTestId('topbar-search').className.split(/\s+/);
    for (const token of ['w-full', 'order-last', 'md:order-none', 'md:flex-1', 'min-w-0', 'md:max-w-md']) {
      expect(searchTokens).toContain(token);
    }

    const actionsTokens = screen.getByTestId('topbar-actions').className.split(/\s+/);
    for (const token of ['flex', 'flex-wrap', 'items-center', 'justify-end', 'gap-2', 'md:gap-3']) {
      expect(actionsTokens).toContain(token);
    }

    expect(screen.getByTestId('topbar-lead').className).toBe('flex items-center gap-3 min-w-0');
  });

  it('the topbar-row DOM order remains lead, search, actions (search moves only via CSS order)', () => {
    render(
      <TopBar title="x" search={<input placeholder="s" />}>
        <button>a</button>
      </TopBar>,
    );
    const row = screen.getByTestId('topbar-row');
    const testids = Array.from(row.children).map((c) => c.getAttribute('data-testid'));
    expect(testids).toEqual(['topbar-lead', 'topbar-search', 'topbar-actions']);
  });
});
