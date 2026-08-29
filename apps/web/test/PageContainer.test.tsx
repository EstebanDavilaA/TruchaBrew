import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageContainer, PAGE_CONTAINER_CLASS } from '../src/components/PageContainer';

describe('AC-1: PAGE_CONTAINER_CLASS has the exact frozen value', () => {
  // M13_P1 §3.1 (forced, narrow exception — not in the M13_P1 modified-files
  // list, but AC-3 requires PageContainer to become the app shell's sole
  // scroll owner, `flex-1 overflow-y-auto min-w-0`, which necessarily
  // changes this frozen string; `pb-16` also migrated in from App.tsx's
  // per-view wrapper, which is no longer the scrolling ancestor. Flagged for
  // critic attention, same class of forced fallout as Sidebar.tsx's
  // M7_P1 precedent.
  it('is exactly the specified string', () => {
    expect(PAGE_CONTAINER_CLASS).toBe('flex-1 overflow-y-auto min-w-0 w-full px-4 sm:px-6 lg:px-8 py-6 pb-16');
  });
});

describe('AC-2 (container): max-w/mx-auto pillar removed, padding preserved', () => {
  it('does not contain max-w- or mx-auto', () => {
    expect(PAGE_CONTAINER_CLASS).not.toMatch(/max-w-/);
    expect(PAGE_CONTAINER_CLASS).not.toMatch(/\bmx-auto\b/);
  });

  it('preserves the four padding tokens byte-identical to P3', () => {
    for (const token of ['px-4', 'sm:px-6', 'lg:px-8', 'py-6']) {
      expect(PAGE_CONTAINER_CLASS.split(' ')).toContain(token);
    }
  });
});

describe('AC-2: PageContainer renders a single <main> carrying that class and the testid', () => {
  it('renders MAIN with the exact class, the testid, and children inside it', () => {
    render(
      <PageContainer>
        <p>hello</p>
      </PageContainer>,
    );
    const main = screen.getByTestId('page-container');
    expect(main.tagName).toBe('MAIN');
    expect(main.className).toBe(PAGE_CONTAINER_CLASS);
    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(main).toContainElement(screen.getByText('hello'));
  });
});

describe('AC-3: PageContainer has no geometry escape hatch', () => {
  it('accepts only children — a className/variant probe fails tsc (compile-time probes below; runtime sanity here)', () => {
    const keys: (keyof import('../src/components/PageContainer').PageContainerProps)[] = ['children'];
    expect(keys).toEqual(['children']);
    // @ts-expect-error className is not a valid PageContainerProps key (TS2322/TS2353)
    const _classNameProbe = <PageContainer className="max-w-4xl">{null}</PageContainer>;
    // @ts-expect-error variant is not a valid PageContainerProps key (TS2322/TS2353)
    const _variantProbe = <PageContainer variant="narrow">{null}</PageContainer>;
    void _classNameProbe;
    void _variantProbe;
  });

  it('<PageContainer>{null}</PageContainer> still renders the <main> with the same class', () => {
    render(<PageContainer>{null}</PageContainer>);
    const main = screen.getByTestId('page-container');
    expect(main.tagName).toBe('MAIN');
    expect(main.className).toBe(PAGE_CONTAINER_CLASS);
  });
});
