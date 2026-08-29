// M29_P4 (MAJ-03) — horizontal lifecycle stage stepper test coverage
// (AC-1, AC-2). Supersedes the M13_P1 tab-bar version's assertions on the
// old flat active-class string, which no longer applies to the numbered
// stepper design.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BatchStageTabs, type BatchStageTab } from '../src/components/BatchStageTabs';

const ALL_TABS: readonly BatchStageTab[] = ['planning', 'brewing', 'fermentation', 'packaging', 'completed'];

describe('AC-1: renders 5 numbered stage indicators in order', () => {
  it('each tab is present with its data-testid', () => {
    render(<BatchStageTabs activeTab="planning" currentStatus="Planning" onSelectTab={() => {}} />);
    for (const tab of ALL_TABS) {
      expect(screen.getByTestId(`batch-tab-${tab}`)).toBeInTheDocument();
    }
  });

  it('labels are Planning / Brewing / Fermentation / Packaging / Completed', () => {
    render(<BatchStageTabs activeTab="planning" currentStatus="Planning" onSelectTab={() => {}} />);
    expect(screen.getByTestId('batch-tab-planning')).toHaveTextContent('Planning');
    expect(screen.getByTestId('batch-tab-brewing')).toHaveTextContent('Brewing');
    expect(screen.getByTestId('batch-tab-fermentation')).toHaveTextContent('Fermentation');
    expect(screen.getByTestId('batch-tab-packaging')).toHaveTextContent('Packaging');
    expect(screen.getByTestId('batch-tab-completed')).toHaveTextContent('Completed');
  });

  it('tabs render in DOM order Planning, Brewing, Fermentation, Packaging, Completed', () => {
    render(<BatchStageTabs activeTab="planning" currentStatus="Planning" onSelectTab={() => {}} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.getAttribute('data-testid'))).toEqual(ALL_TABS.map((t) => `batch-tab-${t}`));
  });

  it('each step shows its 1-based numeral when not completed', () => {
    render(<BatchStageTabs activeTab="planning" currentStatus="Planning" onSelectTab={() => {}} />);
    ALL_TABS.forEach((tab, i) => {
      expect(screen.getByTestId(`batch-tab-${tab}`)).toHaveTextContent(String(i + 1));
    });
  });

  it('steps before the active tab render a check indicator instead of their numeral', () => {
    render(<BatchStageTabs activeTab="packaging" currentStatus="Conditioning" onSelectTab={() => {}} />);
    // planning(1), brewing(2), fermentation(3) are "completed" relative to
    // the selected "packaging" tab — their numeral text is replaced by an
    // svg check icon, so the numeral string should no longer appear as
    // this tab's own direct text content.
    expect(screen.getByTestId('batch-tab-planning').textContent).not.toContain('1');
    expect(screen.getByTestId('batch-tab-brewing').textContent).not.toContain('2');
    expect(screen.getByTestId('batch-tab-fermentation').textContent).not.toContain('3');
    // the active + future steps still show numerals
    expect(screen.getByTestId('batch-tab-packaging')).toHaveTextContent('4');
    expect(screen.getByTestId('batch-tab-completed')).toHaveTextContent('5');
  });
});

describe('AC-2: accessible tab/button semantics and keyboard navigation', () => {
  it('every step carries role="tab", aria-selected reflecting the active tab', () => {
    render(<BatchStageTabs activeTab="fermentation" currentStatus="Fermenting" onSelectTab={() => {}} />);
    expect(screen.getByTestId('batch-tab-fermentation')).toHaveAttribute('role', 'tab');
    expect(screen.getByTestId('batch-tab-fermentation')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('batch-tab-planning')).toHaveAttribute('aria-selected', 'false');
  });

  it('only the active step carries aria-current="step"', () => {
    render(<BatchStageTabs activeTab="brewing" currentStatus="Brewing" onSelectTab={() => {}} />);
    expect(screen.getByTestId('batch-tab-brewing')).toHaveAttribute('aria-current', 'step');
    for (const tab of ALL_TABS.filter((t) => t !== 'brewing')) {
      expect(screen.getByTestId(`batch-tab-${tab}`)).not.toHaveAttribute('aria-current');
    }
  });

  it('uses a roving tabIndex: only the active step is in the tab order', () => {
    render(<BatchStageTabs activeTab="fermentation" currentStatus="Fermenting" onSelectTab={() => {}} />);
    expect(screen.getByTestId('batch-tab-fermentation')).toHaveAttribute('tabIndex', '0');
    for (const tab of ALL_TABS.filter((t) => t !== 'fermentation')) {
      expect(screen.getByTestId(`batch-tab-${tab}`)).toHaveAttribute('tabIndex', '-1');
    }
  });

  it('ArrowRight/ArrowLeft move selection to the next/previous step and wrap at the ends', () => {
    const onSelectTab = vi.fn();
    render(<BatchStageTabs activeTab="planning" currentStatus="Planning" onSelectTab={onSelectTab} />);

    fireEvent.keyDown(screen.getByTestId('batch-tab-planning'), { key: 'ArrowRight' });
    expect(onSelectTab).toHaveBeenLastCalledWith('brewing');

    fireEvent.keyDown(screen.getByTestId('batch-tab-planning'), { key: 'ArrowLeft' });
    expect(onSelectTab).toHaveBeenLastCalledWith('completed');
  });

  it('Home/End jump to the first/last step', () => {
    const onSelectTab = vi.fn();
    render(<BatchStageTabs activeTab="fermentation" currentStatus="Fermenting" onSelectTab={onSelectTab} />);

    fireEvent.keyDown(screen.getByTestId('batch-tab-fermentation'), { key: 'Home' });
    expect(onSelectTab).toHaveBeenLastCalledWith('planning');

    fireEvent.keyDown(screen.getByTestId('batch-tab-fermentation'), { key: 'End' });
    expect(onSelectTab).toHaveBeenLastCalledWith('completed');
  });
});

describe('AC-24: stage tabs are pure view state (L3)', () => {
  it('clicking every tab fires only onSelectTab, once, with that tab', () => {
    const onSelectTab = vi.fn();
    render(<BatchStageTabs activeTab="planning" currentStatus="Planning" onSelectTab={onSelectTab} />);

    for (const tab of ALL_TABS) {
      fireEvent.click(screen.getByTestId(`batch-tab-${tab}`));
    }

    expect(onSelectTab).toHaveBeenCalledTimes(5);
    expect(onSelectTab.mock.calls.map((c) => c[0])).toEqual(ALL_TABS);
  });

  it('issues zero network calls (no global fetch stubbed, none invoked)', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(<BatchStageTabs activeTab="planning" currentStatus="Planning" onSelectTab={() => {}} />);
    fireEvent.click(screen.getByTestId('batch-tab-brewing'));
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('never mutates or implies status — currentStatus is accepted but never rendered as a status value', () => {
    render(<BatchStageTabs activeTab="planning" currentStatus="Fermenting" onSelectTab={() => {}} />);
    // None of the tab labels contain the status string, and clicking never
    // calls anything status-shaped — asserted structurally: the component's
    // only callback prop is onSelectTab (AC-9 reinforcement).
    expect(screen.queryByText('Fermenting')).not.toBeInTheDocument();
  });
});

describe('Active/completed/future visual state', () => {
  it('the active step carries the amber accent classes', () => {
    render(<BatchStageTabs activeTab="brewing" currentStatus="Brewing" onSelectTab={() => {}} />);
    const active = screen.getByTestId('batch-tab-brewing');
    expect(active.className).toContain('text-amber-400');
  });

  it('a completed step (before the active one) carries emerald styling, not amber', () => {
    render(<BatchStageTabs activeTab="fermentation" currentStatus="Fermenting" onSelectTab={() => {}} />);
    const completed = screen.getByTestId('batch-tab-brewing');
    expect(completed.className).toContain('text-emerald-400');
    expect(completed.className).not.toContain('text-amber-400');
  });

  it('a future step (after the active one) carries neutral slate styling', () => {
    render(<BatchStageTabs activeTab="brewing" currentStatus="Brewing" onSelectTab={() => {}} />);
    const future = screen.getByTestId('batch-tab-completed');
    expect(future.className).toContain('text-slate-400');
    expect(future.className).not.toContain('text-amber-400');
    expect(future.className).not.toContain('text-emerald-400');
  });
});
