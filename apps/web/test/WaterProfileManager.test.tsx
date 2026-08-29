import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { WaterProfile } from '@truchabrew/shared-types';
import { WaterProfileManager } from '../src/components/WaterProfileManager';

const sampleProfile: WaterProfile = {
  id: 'wp-1',
  name: 'Balanced Tap Water',
  type: 'source',
  calcium: 50,
  magnesium: 10,
  sodium: 20,
  chloride: 30,
  sulfate: 40,
  bicarbonate: 120,
  ph: 7.4,
  description: 'Tap water notes',
};

describe('WaterProfileManager (AC-14)', () => {
  it('renders profile list with title and New Profile button', () => {
    render(
      <WaterProfileManager
        profiles={[sampleProfile]}
        loadError={null}
        onReload={vi.fn()}
        activeRecipeSourceId={null}
        activeRecipeTargetId={null}
        onCreated={vi.fn()}
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
      />
    );

    expect(screen.getByText('Water Profiles')).toBeInTheDocument();
    expect(screen.getByTestId('water-new-profile')).toBeInTheDocument();
    expect(screen.getByText('Balanced Tap Water')).toBeInTheDocument();
  });

  it('renders empty state message when profiles array is empty', () => {
    render(
      <WaterProfileManager
        profiles={[]}
        loadError={null}
        onReload={vi.fn()}
        activeRecipeSourceId={null}
        activeRecipeTargetId={null}
        onCreated={vi.fn()}
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
      />
    );

    expect(screen.getByText(/No water profiles yet/i)).toBeInTheDocument();
  });
});

describe('AC-16 (M26_P1 Amendment 1): WaterProfileManager forwards onOpenMobileNav to its TopBar', () => {
  it('passing onOpenMobileNav renders the hamburger and clicking it calls the callback', () => {
    const onOpenMobileNav = vi.fn();
    render(
      <WaterProfileManager
        profiles={[]}
        loadError={null}
        onReload={vi.fn()}
        activeRecipeSourceId={null}
        activeRecipeTargetId={null}
        onCreated={vi.fn()}
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
        onOpenMobileNav={onOpenMobileNav}
      />,
    );
    const btn = screen.getByRole('button', { name: 'Open navigation menu' });
    fireEvent.click(btn);
    expect(onOpenMobileNav).toHaveBeenCalledTimes(1);
  });

  it('omitting onOpenMobileNav renders no hamburger button', () => {
    render(
      <WaterProfileManager
        profiles={[]}
        loadError={null}
        onReload={vi.fn()}
        activeRecipeSourceId={null}
        activeRecipeTargetId={null}
        onCreated={vi.fn()}
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Open navigation menu' })).toBeNull();
  });

  it('forwards onOpenMobileNav into WaterProfileForm when opened in create mode', () => {
    const onOpenMobileNav = vi.fn();
    render(
      <WaterProfileManager
        profiles={[]}
        loadError={null}
        onReload={vi.fn()}
        activeRecipeSourceId={null}
        activeRecipeTargetId={null}
        onCreated={vi.fn()}
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
        onOpenMobileNav={onOpenMobileNav}
      />,
    );
    fireEvent.click(screen.getByTestId('water-new-profile'));
    const btn = screen.getByRole('button', { name: 'Open navigation menu' });
    fireEvent.click(btn);
    expect(onOpenMobileNav).toHaveBeenCalledTimes(1);
  });
});
