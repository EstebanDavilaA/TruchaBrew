import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Sidebar, NAV_SECTIONS, NAV_ITEMS, type NavDestination } from '../src/components/Sidebar';

const ALL_VIEWS = [
  'list',
  'editor',
  'equipment',
  'mashProfiles',
  'fermentationProfiles',
  'waterProfiles',
  'batches',
  'batchDetail',
  'inventory',
  'settings',
  'calculators',
] as const;

describe('AC-1: NAV_SECTIONS shape', () => {
  it('exports NAV_SECTIONS with exactly 2 sections: Brew (4 items) and Library (5 items)', () => {
    expect(NAV_SECTIONS).toHaveLength(2);
    expect(NAV_SECTIONS[0].title).toBe('Brew');
    expect(NAV_SECTIONS[0].items.map((i) => i.destination)).toEqual(['list', 'batches', 'inventory', 'calculators']);
    expect(NAV_SECTIONS[0].items.map((i) => i.label)).toEqual(['Recipes', 'Batches', 'Inventory', 'Calculators']);

    expect(NAV_SECTIONS[1].title).toBe('Library');
    expect(NAV_SECTIONS[1].items.map((i) => i.destination)).toEqual(['equipment', 'mashProfiles', 'fermentationProfiles', 'waterProfiles', 'settings']);
    expect(NAV_SECTIONS[1].items.map((i) => i.label)).toEqual(['Equipment Profiles', 'Mash Profiles', 'Fermentation Profiles', 'Water Profiles', 'Settings']);
  });
});

describe('AC-2: NAV_ITEMS shape', () => {
  it('exports NAV_ITEMS as flat array of all 9 items in canonical sequential order matching NAV_SECTIONS', () => {
    expect(NAV_ITEMS).toHaveLength(9);
    expect(NAV_ITEMS.map((i) => i.destination)).toEqual([
      'list',
      'batches',
      'inventory',
      'calculators',
      'equipment',
      'mashProfiles',
      'fermentationProfiles',
      'waterProfiles',
      'settings',
    ]);
    expect(NAV_ITEMS.map((i) => i.label)).toEqual([
      'Recipes',
      'Batches',
      'Inventory',
      'Calculators',
      'Equipment Profiles',
      'Mash Profiles',
      'Fermentation Profiles',
      'Water Profiles',
      'Settings',
    ]);
  });
});

describe('AC-3 & AC-4: expanded sidebar renders section headers and all 9 items', () => {
  it('renders section headers "Brew" and "Library" with visible text', () => {
    render(<Sidebar activeView="list" collapsed={false} onToggleCollapsed={vi.fn()} onNavigate={vi.fn()} />);
    expect(screen.getByText('Brew')).toBeInTheDocument();
    expect(screen.getByText('Library')).toBeInTheDocument();
  });

  it('getByText and getByRole button both resolve for each label', () => {
    render(<Sidebar activeView="list" collapsed={false} onToggleCollapsed={vi.fn()} onNavigate={vi.fn()} />);
    for (const item of NAV_ITEMS) {
      expect(screen.getByText(item.label)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: item.label })).toBeInTheDocument();
    }
  });

  it('renders no separator element when expanded', () => {
    render(<Sidebar activeView="list" collapsed={false} onToggleCollapsed={vi.fn()} onNavigate={vi.fn()} />);
    expect(screen.queryByRole('separator')).toBeNull();
  });
});

describe('AC-5: clicking navigation buttons', () => {
  it('calls onNavigate with the correct NavDestination for each button', () => {
    const onNavigate = vi.fn();
    render(<Sidebar activeView="list" collapsed={false} onToggleCollapsed={vi.fn()} onNavigate={onNavigate} />);
    for (const item of NAV_ITEMS) {
      const btn = screen.getByRole('button', { name: item.label });
      btn.click();
      expect(onNavigate).toHaveBeenCalledWith(item.destination);
    }
    expect(onNavigate).toHaveBeenCalledTimes(NAV_ITEMS.length);
  });
});

describe('AC-6: active mapping is total and unique across all 11 views', () => {
  it.each(ALL_VIEWS)('view=%s marks exactly one item active with the right accessible name', (view) => {
    render(<Sidebar activeView={view} collapsed={false} onToggleCollapsed={vi.fn()} onNavigate={vi.fn()} />);
    const current = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);

    const expectedLabel =
      view === 'list' || view === 'editor'
        ? 'Recipes'
        : view === 'batches' || view === 'batchDetail'
          ? 'Batches'
          : NAV_ITEMS.find((i) => i.destination === (view as NavDestination))!.label;
    expect(current[0]).toHaveAccessibleName(expectedLabel);
  });
});

describe('AC-7 & AC-8: collapsed sidebar suppresses text nodes while retaining buttons', () => {
  it('queryByText returns null for section headers and all labels when collapsed', () => {
    render(<Sidebar activeView="list" collapsed={true} onToggleCollapsed={vi.fn()} onNavigate={vi.fn()} />);
    expect(screen.queryByText('Brew')).toBeNull();
    expect(screen.queryByText('Library')).toBeNull();
    for (const item of NAV_ITEMS) {
      expect(screen.queryByText(item.label)).toBeNull();
    }
  });

  it('each button resolves via role, is not disabled, has title, and clicking calls onNavigate', () => {
    const onNavigate = vi.fn();
    render(<Sidebar activeView="list" collapsed={true} onToggleCollapsed={vi.fn()} onNavigate={onNavigate} />);
    for (const item of NAV_ITEMS) {
      const btn = screen.getByRole('button', { name: item.label });
      expect(btn).not.toBeDisabled();
      expect(btn).toHaveAttribute('title', item.label);
      btn.click();
      expect(onNavigate).toHaveBeenCalledWith(item.destination);
    }
    expect(onNavigate).toHaveBeenCalledTimes(NAV_ITEMS.length);
  });
});

describe('AC-9: collapsed sidebar renders separator between clusters', () => {
  it('renders exactly one separator element between Brew and Library in collapsed mode', () => {
    render(<Sidebar activeView="list" collapsed={true} onToggleCollapsed={vi.fn()} onNavigate={vi.fn()} />);
    const separator = screen.getByRole('separator', { hidden: true });
    expect(separator).toBeInTheDocument();
  });
});

describe('AC-10: toggle button and controlled state', () => {
  it('collapsed=false -> "Collapse navigation"; collapsed=true -> "Expand navigation"', () => {
    const { rerender } = render(<Sidebar activeView="list" collapsed={false} onToggleCollapsed={vi.fn()} onNavigate={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Collapse navigation' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Expand navigation' })).toBeNull();

    rerender(<Sidebar activeView="list" collapsed={true} onToggleCollapsed={vi.fn()} onNavigate={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Expand navigation' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Collapse navigation' })).toBeNull();
  });

  it('aria-expanded tracks collapse state', () => {
    const { rerender } = render(<Sidebar activeView="list" collapsed={false} onToggleCollapsed={vi.fn()} onNavigate={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Collapse navigation' })).toHaveAttribute('aria-expanded', 'true');

    rerender(<Sidebar activeView="list" collapsed={true} onToggleCollapsed={vi.fn()} onNavigate={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Expand navigation' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('clicking calls onToggleCollapsed exactly once; re-rendering with same prop leaves state unchanged', () => {
    const onToggleCollapsed = vi.fn();
    const { rerender } = render(<Sidebar activeView="list" collapsed={false} onToggleCollapsed={onToggleCollapsed} onNavigate={vi.fn()} />);
    screen.getByRole('button', { name: 'Collapse navigation' }).click();
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);

    rerender(<Sidebar activeView="list" collapsed={false} onToggleCollapsed={onToggleCollapsed} onNavigate={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Collapse navigation' })).toBeInTheDocument();
  });
});

describe('Sidebar renders no page-title heading', () => {
  it('no heading role element matches any route title', () => {
    const { container } = render(<Sidebar activeView="list" collapsed={false} onToggleCollapsed={vi.fn()} onNavigate={vi.fn()} />);
    const headings = within(container).queryAllByRole('heading');
    const routeTitles = ['Recipe Library', 'Recipe Editor', 'Equipment Profiles', 'Mash Profiles', 'Fermentation Profiles'];
    for (const h of headings) {
      expect(routeTitles).not.toContain(h.textContent);
    }
  });
});

