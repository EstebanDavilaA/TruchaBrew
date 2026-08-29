import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileNav } from '../src/components/MobileNav';
import { NAV_ITEMS } from '../src/components/Sidebar';

describe('MobileNav (M26_P1 / M28_P1)', () => {
  describe('AC-11: open rendering, category headers & 9 destinations', () => {
    it('renders category headers "Brew" and "Library" with visible text', () => {
      render(<MobileNav isOpen activeView="list" onClose={vi.fn()} onNavigate={vi.fn()} />);
      expect(screen.getByText('Brew')).toBeInTheDocument();
      expect(screen.getByText('Library')).toBeInTheDocument();
    });

    it('renders all 9 destinations in order with visible labels and accessible button roles', () => {
      render(<MobileNav isOpen activeView="list" onClose={vi.fn()} onNavigate={vi.fn()} />);
      const buttons = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-label') !== 'Close navigation');
      expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(NAV_ITEMS.map((i) => i.label));
      for (const item of NAV_ITEMS) {
        expect(screen.getByText(item.label)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: item.label })).toBeInTheDocument();
      }
    });

    it('renders as a dialog with the expected aria contract', () => {
      render(<MobileNav isOpen activeView="list" onClose={vi.fn()} onNavigate={vi.fn()} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAccessibleName('Mobile navigation');
    });
  });

  describe('AC-2: active destination marker', () => {
    it('marks "Mash Profiles" with aria-current="page" and amber styling when activeView="mashProfiles"', () => {
      render(<MobileNav isOpen activeView="mashProfiles" onClose={vi.fn()} onNavigate={vi.fn()} />);
      const btn = screen.getByRole('button', { name: 'Mash Profiles' });
      expect(btn).toHaveAttribute('aria-current', 'page');
      expect(btn.className).toContain('bg-amber-500/10');
      expect(btn.className).toContain('text-amber-400');
      expect(btn.className).toContain('border-amber-500/30');

      const others = NAV_ITEMS.filter((i) => i.destination !== 'mashProfiles');
      for (const item of others) {
        expect(screen.getByRole('button', { name: item.label })).not.toHaveAttribute('aria-current');
      }
    });
  });

  describe('AC-3: closed state', () => {
    it('renders nothing when isOpen={false}', () => {
      const { container } = render(<MobileNav isOpen={false} activeView="list" onClose={vi.fn()} onNavigate={vi.fn()} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('AC-4: focus trapping', () => {
    it('Tab on the last focusable element loops to the first (close button); Shift+Tab on the first loops to the last', () => {
      render(<MobileNav isOpen activeView="list" onClose={vi.fn()} onNavigate={vi.fn()} />);
      const closeBtn = screen.getByRole('button', { name: 'Close navigation' });
      const lastItem = screen.getByRole('button', { name: NAV_ITEMS[NAV_ITEMS.length - 1].label });

      lastItem.focus();
      expect(document.activeElement).toBe(lastItem);
      fireEvent.keyDown(document, { key: 'Tab' });
      expect(document.activeElement).toBe(closeBtn);

      closeBtn.focus();
      expect(document.activeElement).toBe(closeBtn);
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(lastItem);
    });
  });

  describe('AC-5: Escape key dismissal', () => {
    it('pressing Escape while open invokes onClose', () => {
      const onClose = vi.fn();
      render(<MobileNav isOpen activeView="list" onClose={onClose} onNavigate={vi.fn()} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('AC-6: focus restoration', () => {
    it('restores focus to the trigger button that opened it, after closing', () => {
      function Harness() {
        const [open, setOpen] = useState(false);
        return (
          <div>
            <button type="button" onClick={() => setOpen(true)}>
              Open menu
            </button>
            <MobileNav isOpen={open} activeView="list" onClose={() => setOpen(false)} onNavigate={vi.fn()} />
          </div>
        );
      }

      render(<Harness />);
      const opener = screen.getByText('Open menu');
      opener.focus();
      expect(document.activeElement).toBe(opener);

      fireEvent.click(opener);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(document.activeElement).not.toBe(opener);

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(document.activeElement).toBe(opener);
    });
  });

  describe('AC-7: backdrop click dismissal', () => {
    it('clicking the backdrop calls onClose; clicking inside the drawer container does not', () => {
      const onClose = vi.fn();
      const { container } = render(<MobileNav isOpen activeView="list" onClose={onClose} onNavigate={vi.fn()} />);

      const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
      fireEvent.click(dialog);
      expect(onClose).not.toHaveBeenCalled();

      const backdrop = dialog.parentElement as HTMLElement;
      fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('AC-8: close button', () => {
    it('clicking the close button calls onClose', () => {
      const onClose = vi.fn();
      render(<MobileNav isOpen activeView="list" onClose={onClose} onNavigate={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Close navigation' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('AC-9: item selection & auto-dismiss', () => {
    it('clicking a nav item calls onNavigate with the destination id and calls onClose', () => {
      const onNavigate = vi.fn();
      const onClose = vi.fn();
      render(<MobileNav isOpen activeView="list" onClose={onClose} onNavigate={onNavigate} />);

      fireEvent.click(screen.getByRole('button', { name: 'Mash Profiles' }));
      expect(onNavigate).toHaveBeenCalledWith('mashProfiles');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onNavigate before onClose, for every destination', () => {
      for (const item of NAV_ITEMS) {
        const calls: string[] = [];
        const onNavigate = vi.fn(() => calls.push('navigate'));
        const onClose = vi.fn(() => calls.push('close'));
        const { unmount } = render(<MobileNav isOpen activeView="list" onClose={onClose} onNavigate={onNavigate} />);
        fireEvent.click(screen.getByRole('button', { name: item.label }));
        expect(onNavigate).toHaveBeenCalledWith(item.destination);
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(calls).toEqual(['navigate', 'close']);
        unmount();
      }
    });
  });
});
