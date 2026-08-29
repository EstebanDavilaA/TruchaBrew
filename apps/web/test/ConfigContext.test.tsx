import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { UserConfig } from '@truchabrew/shared-types';
import { DEFAULT_USER_CONFIG } from '@truchabrew/calculations';
import { ConfigProvider, useConfig } from '../src/context/ConfigContext';

const REMOTE_CONFIG: UserConfig = {
  id: 'default',
  unitSystem: 'metric',
  gravityUnit: 'plato',
  temperatureUnit: 'celsius',
  ibuFormula: 'tinseth',
  abvFormula: 'simple',
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response;
}

function Probe() {
  const { config, status, error } = useConfig();
  return (
    <div>
      <div data-testid="probe-status">{status}</div>
      <div data-testid="probe-gravity-unit">{config.gravityUnit}</div>
      <div data-testid="probe-error">{error ?? ''}</div>
    </div>
  );
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AC-14: ConfigProvider issues exactly one GET /api/config on mount', () => {
  it('a probe consumer reads the resolved UserConfig via useConfig()', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(REMOTE_CONFIG));

    render(
      <ConfigProvider>
        <Probe />
      </ConfigProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('probe-gravity-unit').textContent).toBe('plato'));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/api/config', expect.anything());
  });

  it('mounting multiple consumers under one provider still issues exactly one GET', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(REMOTE_CONFIG));

    render(
      <ConfigProvider>
        <Probe />
        <Probe />
        <Probe />
      </ConfigProvider>,
    );

    await waitFor(() => {
      const statuses = screen.getAllByTestId('probe-status');
      expect(statuses.every((s) => s.textContent === 'ready')).toBe(true);
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('AC-16: fallback rule', () => {
  it('(a) before GET resolves, status is "loading" and config === DEFAULT_USER_CONFIG; no PUT is issued', async () => {
    let resolveFetch: (r: Response) => void = () => {};
    vi.mocked(fetch).mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );

    render(
      <ConfigProvider>
        <Probe />
      </ConfigProvider>,
    );

    expect(screen.getByTestId('probe-status').textContent).toBe('loading');
    expect(screen.getByTestId('probe-gravity-unit').textContent).toBe(DEFAULT_USER_CONFIG.gravityUnit);
    const putCallsBeforeResolve = vi.mocked(fetch).mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'PUT');
    expect(putCallsBeforeResolve).toHaveLength(0);

    resolveFetch(jsonResponse(REMOTE_CONFIG));
    await waitFor(() => expect(screen.getByTestId('probe-status').textContent).toBe('ready'));
  });

  it('(b) with GET rejecting, status is "error", error is non-null, and no PUT is ever issued', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: { code: 'INTERNAL', message: 'boom' } }, 500));

    render(
      <ConfigProvider>
        <Probe />
      </ConfigProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('probe-status').textContent).toBe('error'));
    expect(screen.getByTestId('probe-error').textContent).toBe('boom');
    expect(screen.getByTestId('probe-gravity-unit').textContent).toBe(DEFAULT_USER_CONFIG.gravityUnit);

    const putCalls = vi.mocked(fetch).mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'PUT');
    expect(putCalls).toHaveLength(0);
  });
});

describe('applyConfig propagation', () => {
  it('applyConfig replaces the shared config and is observed by every consumer without a refetch', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(REMOTE_CONFIG));

    function Applier() {
      const { applyConfig } = useConfig();
      return (
        <button onClick={() => applyConfig({ ...REMOTE_CONFIG, gravityUnit: 'sg' })} data-testid="apply-btn">
          apply
        </button>
      );
    }

    render(
      <ConfigProvider>
        <Probe />
        <Applier />
      </ConfigProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('probe-gravity-unit').textContent).toBe('plato'));
    const callsBefore = vi.mocked(fetch).mock.calls.length;

    screen.getByTestId('apply-btn').click();

    await waitFor(() => expect(screen.getByTestId('probe-gravity-unit').textContent).toBe('sg'));
    expect(vi.mocked(fetch).mock.calls.length).toBe(callsBefore);
  });
});

describe('useConfig throws outside a provider', () => {
  it('throws the expected error message', () => {
    // Suppress the expected React error-boundary console noise for this
    // one deliberate throw, same convention as useCatalog()'s own test
    // pattern elsewhere in this suite.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Bare() {
      useConfig();
      return null;
    }
    expect(() => render(<Bare />)).toThrow('useConfig must be used within a ConfigProvider');
    spy.mockRestore();
  });
});
