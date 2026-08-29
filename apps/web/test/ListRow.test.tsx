import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ListRow, LIST_ROW_CLASS, LIST_CONTAINER_CLASS } from '../src/components/ListRow';

describe('ListRow', () => {
  it('calls onOpen exactly once on click (AC-7)', () => {
    const onOpen = vi.fn();
    render(<ListRow testId="row-1" label="Open row" primary="Row" onOpen={onOpen} />);
    fireEvent.click(screen.getByTestId('row-1'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('calls onOpen exactly once on Enter (AC-8)', () => {
    const onOpen = vi.fn();
    render(<ListRow testId="row-1" label="Open row" primary="Row" onOpen={onOpen} />);
    fireEvent.keyDown(screen.getByTestId('row-1'), { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('calls onOpen exactly once on Space and prevents default (AC-9)', () => {
    const onOpen = vi.fn();
    render(<ListRow testId="row-1" label="Open row" primary="Row" onOpen={onOpen} />);
    const root = screen.getByTestId('row-1');
    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    root.dispatchEvent(event);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('does not activate on other keys (AC-10)', () => {
    const onOpen = vi.fn();
    render(<ListRow testId="row-1" label="Open row" primary="Row" onOpen={onOpen} />);
    const root = screen.getByTestId('row-1');
    for (const key of ['a', 'Tab', 'Escape', 'ArrowDown']) {
      fireEvent.keyDown(root, { key });
    }
    expect(onOpen).toHaveBeenCalledTimes(0);
  });

  it('isolates nested interactive controls via stopPropagation (AC-11)', () => {
    const onOpen = vi.fn();
    const onTrailingClick = vi.fn((e: React.MouseEvent) => e.stopPropagation());
    render(
      <ListRow
        testId="row-1"
        label="Open row"
        primary="Row"
        onOpen={onOpen}
        trailing={
          <button onClick={onTrailingClick} data-testid="trailing-btn">
            Act
          </button>
        }
      />,
    );
    fireEvent.click(screen.getByTestId('trailing-btn'));
    expect(onTrailingClick).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledTimes(0);
  });

  it('handles degenerate props: no meta/trailing container, onOpen still fires (AC-12)', () => {
    const onOpen = vi.fn();
    const { container } = render(<ListRow testId="row-1" label="Open row" primary="Row" onOpen={onOpen} />);
    // No meta or trailing wrapper divs beyond the primary block.
    expect(container.querySelectorAll('[data-testid="row-1"] > div').length).toBe(1);
    fireEvent.click(screen.getByTestId('row-1'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('root is a div with role=button and tabIndex 0, not a real button (AC-13)', () => {
    render(<ListRow testId="row-1" label="Open row" primary="Row" onOpen={() => {}} />);
    const root = screen.getByTestId('row-1');
    expect(root.tagName).toBe('DIV');
    expect(root.getAttribute('role')).toBe('button');
    expect(root.getAttribute('tabIndex')).toBe('0');
  });

  it('row/container classes carry required tokens and omit forbidden ones (AC-14)', () => {
    expect(LIST_ROW_CLASS).toContain('w-full');
    expect(LIST_ROW_CLASS).toContain('py-3');
    expect(LIST_ROW_CLASS).toContain('cursor-pointer');
    expect(LIST_ROW_CLASS).not.toMatch(/rounded/);
    expect(LIST_ROW_CLASS).not.toMatch(/shadow/);
    expect(LIST_ROW_CLASS).not.toMatch(/max-w-/);
    expect(LIST_ROW_CLASS).not.toMatch(/mx-auto/);

    expect(LIST_CONTAINER_CLASS).toContain('w-full');
    expect(LIST_CONTAINER_CLASS).toContain('divide-y');
    expect(LIST_CONTAINER_CLASS).not.toMatch(/grid-cols-/);
    expect(LIST_CONTAINER_CLASS).not.toMatch(/gap-/);
    expect(LIST_CONTAINER_CLASS).not.toMatch(/max-w-/);
    expect(LIST_CONTAINER_CLASS).not.toMatch(/mx-auto/);
  });
});
