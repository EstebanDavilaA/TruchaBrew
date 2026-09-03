import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { BatchList } from '../src/pages/BatchList';
import { ApiClientError } from '../src/api/client';
import { LOADING_STATE_CLASS, ERROR_STATE_CLASS } from '../src/components/designSystem';
import { baseBatch } from './helpers/fixtures';

vi.mock('../src/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/api/client')>();
  return {
    ...actual,
    listBatches: vi.fn(),
  };
});

import { listBatches } from '../src/api/client';

const mockedListBatches = vi.mocked(listBatches);

beforeEach(() => {
  mockedListBatches.mockReset();
});

describe('F-12: BatchList loads through the shared API client', () => {
  it('renders the loaded batches, not a blank screen', async () => {
    mockedListBatches.mockResolvedValue([baseBatch({ id: 'batch-1', name: 'Batch #1 - IPA' })]);
    render(<BatchList onViewBatch={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Batch #1 - IPA')).toBeInTheDocument();
    });
  });

  it('a failed load surfaces the client error message, not a generic string', async () => {
    mockedListBatches.mockRejectedValue(new ApiClientError('INTERNAL', 'Request failed with status 500.'));
    render(<BatchList onViewBatch={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Request failed with status 500\./)).toBeInTheDocument();
    });
  });

  it('clicking a batch calls onViewBatch with its id', async () => {
    mockedListBatches.mockResolvedValue([baseBatch({ id: 'batch-42', name: 'Batch #42' })]);
    const onViewBatch = vi.fn();
    render(<BatchList onViewBatch={onViewBatch} />);

    await waitFor(() => screen.getByText('Batch #42'));
    fireEvent.click(screen.getByText('Batch #42'));
    expect(onViewBatch).toHaveBeenCalledWith('batch-42');
  });
});

describe('AC-8: the empty-state copy is honest once Brew This exists', () => {
  it('shows the empty state pointing at the recipe library when there are no batches', async () => {
    mockedListBatches.mockResolvedValue([]);
    render(<BatchList onViewBatch={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('No batches yet')).toBeInTheDocument();
    });
    expect(screen.getByText(/Start a new batch from any recipe in your library/)).toBeInTheDocument();
  });
});

describe('AC-40: Fermenting renders distinctly in the batch list', () => {
  it('all three statuses render visually distinct badges; Fermenting is not the Brewing class, and no batch falls through to a default branch', async () => {
    mockedListBatches.mockResolvedValue([
      baseBatch({ id: 'batch-planning', name: 'Batch Planning', status: 'Planning' }),
      baseBatch({ id: 'batch-brewing', name: 'Batch Brewing', status: 'Brewing' }),
      baseBatch({ id: 'batch-fermenting', name: 'Batch Fermenting', status: 'Fermenting' }),
    ]);
    render(<BatchList onViewBatch={vi.fn()} />);

    await waitFor(() => screen.getByText('Batch Fermenting'));

    const planningBadge = screen.getByText('Planning');
    const brewingBadge = screen.getByText('Brewing');
    const fermentingBadge = screen.getByText('Fermenting');

    expect(fermentingBadge.className).not.toBe(brewingBadge.className);
    expect(fermentingBadge.className).not.toBe(planningBadge.className);
    expect(brewingBadge.className).not.toBe(planningBadge.className);
  });
});

describe('AC-45: all five statuses render distinctly in the batch list', () => {
  it('renders five badges whose class strings are pairwise distinct (all 10 pairs), and no batch falls through to a default branch', async () => {
    const statuses = ['Planning', 'Brewing', 'Fermenting', 'Conditioning', 'Completed'] as const;
    mockedListBatches.mockResolvedValue(
      statuses.map((status) => baseBatch({ id: `batch-${status}`, name: `Batch ${status}`, status })),
    );
    render(<BatchList onViewBatch={vi.fn()} />);

    await waitFor(() => screen.getByText('Batch Completed'));

    const classNames = statuses.map((status) => screen.getByText(status).className);
    for (let i = 0; i < classNames.length; i++) {
      for (let j = i + 1; j < classNames.length; j++) {
        expect(classNames[i]).not.toBe(classNames[j]);
      }
    }
  });
});

describe('M5.5_P3 AC-17: BatchList renders its own titled TopBar', () => {
  it('rendering standalone produces a TopBar whose <h1> accessible name is "Brewing Batches"', async () => {
    mockedListBatches.mockResolvedValue([]);
    render(<BatchList onViewBatch={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('Brewing Batches');
    });
  });
});

describe('M5.5_P3 AC-24: BatchList no longer accepts onBack', () => {
  it('a probe passing onBack fails tsc (compile-time; TS2322/TS2353)', () => {
    // @ts-expect-error onBack is not a valid BatchList prop any more
    const _probe = <BatchList onViewBatch={() => {}} onBack={() => {}} />;
    void _probe;
    expect(true).toBe(true);
  });
});

describe('M5.5_P3 AC-30: BatchList\'s error state keeps the shell', () => {
  it('the render contains the Brewing Batches <h1>, one page-container, and the existing error text', async () => {
    mockedListBatches.mockRejectedValue(new ApiClientError('INTERNAL', 'Request failed with status 500.'));
    render(<BatchList onViewBatch={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('Brewing Batches');
    });
    expect(screen.getAllByTestId('page-container')).toHaveLength(1);
    expect(screen.getByText(/Request failed with status 500\./)).toBeInTheDocument();
  });
});

describe('AC-22: BatchList loading state (M23_P1)', () => {
  it('shows batch-list-loading with LOADING_STATE_CLASS, an svg icon, and the ellipsis copy; no bare "Loading..." text', async () => {
    let resolveList: (batches: ReturnType<typeof baseBatch>[]) => void = () => {};
    mockedListBatches.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    );
    render(<BatchList onViewBatch={vi.fn()} />);

    const loading = screen.getByTestId('batch-list-loading');
    expect(loading.className).toBe(LOADING_STATE_CLASS);
    expect(loading.querySelector('svg')).not.toBeNull();
    expect(loading.textContent).toMatch(/Loading batches…/);
    expect(screen.queryByText('Loading...')).toBeNull();

    await act(async () => {
      resolveList([baseBatch()]);
    });
  });
});

describe('AC-23: BatchList error state matches the sibling pattern (M23_P1)', () => {
  it('renders the icon + message + Retry treatment, and the old bare error div is gone', async () => {
    mockedListBatches.mockRejectedValue(new ApiClientError('INTERNAL', 'Request failed with status 500.'));
    const { container } = render(<BatchList onViewBatch={vi.fn()} />);

    const errorEl = await screen.findByTestId('batch-list-error');
    expect(errorEl.className.startsWith(ERROR_STATE_CLASS)).toBe(true);
    expect(errorEl.querySelector('svg')).not.toBeNull();
    expect(screen.getByText("Couldn't load your batches")).toBeInTheDocument();
    expect(screen.getByText('Request failed with status 500.')).toBeInTheDocument();

    const retry = screen.getByTestId('batch-list-retry');
    expect(retry).toHaveAccessibleName('Retry');
    expect(container.querySelector('.text-rose-500')).toBeNull();
  });
});

describe('AC-24: BatchList Retry re-issues the load and recovers (RA-15, M23_P1)', () => {
  it('clicking Retry after a failure calls listBatches again and, on success, renders the batch and drops the error', async () => {
    mockedListBatches
      .mockRejectedValueOnce(new ApiClientError('INTERNAL', 'Request failed with status 500.'))
      .mockResolvedValueOnce([baseBatch({ id: 'batch-1', name: 'Batch #1 - IPA' })]);

    render(<BatchList onViewBatch={vi.fn()} />);

    await screen.findByTestId('batch-list-error');
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('Brewing Batches');
    expect(screen.getAllByTestId('page-container')).toHaveLength(1);

    fireEvent.click(screen.getByTestId('batch-list-retry'));

    expect(mockedListBatches).toHaveBeenCalledTimes(2);

    await waitFor(() => {
      expect(screen.queryByTestId('batch-list-error')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('batch-row-batch-1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('Brewing Batches');
    expect(screen.getAllByTestId('page-container')).toHaveLength(1);
  });
});

describe('AC-16 (M26_P1 Amendment 1): BatchList forwards onOpenMobileNav to its TopBar', () => {
  it('passing onOpenMobileNav renders the hamburger and clicking it calls the callback', async () => {
    mockedListBatches.mockResolvedValue([]);
    const onOpenMobileNav = vi.fn();
    render(<BatchList onViewBatch={vi.fn()} onOpenMobileNav={onOpenMobileNav} />);
    await waitFor(() => screen.getByRole('heading', { level: 1 }));
    const btn = screen.getByRole('button', { name: 'Open navigation menu' });
    fireEvent.click(btn);
    expect(onOpenMobileNav).toHaveBeenCalledTimes(1);
  });

  it('omitting onOpenMobileNav renders no hamburger button', async () => {
    mockedListBatches.mockResolvedValue([]);
    render(<BatchList onViewBatch={vi.fn()} />);
    await waitFor(() => screen.getByRole('heading', { level: 1 }));
    expect(screen.queryByRole('button', { name: 'Open navigation menu' })).toBeNull();
  });
});
