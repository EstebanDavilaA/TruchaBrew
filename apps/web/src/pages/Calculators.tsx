import { useState } from 'react';
import { Droplets, Gauge, Dna, Wine } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { PageContainer } from '../components/PageContainer';
import { Button } from '../components/ui';
import { StrikeWaterCalculator } from '../components/calculators/StrikeWaterCalculator';
import { InfusionVolumeCalculator } from '../components/calculators/InfusionVolumeCalculator';
import { HydrometerCalculator } from '../components/calculators/HydrometerCalculator';
import { RefractometerCalculator } from '../components/calculators/RefractometerCalculator';
import { UnitConverterCalculator } from '../components/calculators/UnitConverterCalculator';
import { PitchRateCalculator } from '../components/calculators/PitchRateCalculator';
import { StarterGrowthCalculator } from '../components/calculators/StarterGrowthCalculator';
import { HopDecayCalculator } from '../components/calculators/HopDecayCalculator';
import { GravityCorrectionCalculator } from '../components/calculators/GravityCorrectionCalculator';
import { CarbonationCalculator } from '../components/calculators/CarbonationCalculator';

/**
 * M8_P1 spec §1.3/§2.5, extended by M8_P2 §1.3/Key Behavior 1, and now by
 * M29_P5 §1.2/§2 with a category filter bar and four domain section
 * blocks. Ten cards remain explicit JSX children, never a CALCULATORS
 * registry array (M8_P1 §2.5 binding, reaffirmed by M29_P5 §2 point 2 —
 * calculatorImportGraph.test.ts's static analysis bans a dynamic registry).
 *
 * Judgment call, disclosed: M29_P5 AC-7 requires an input value modified in
 * one category to survive switching to a different category pill and back.
 * Every calculator holds its result-computing state as its OWN internal
 * useState (M8_P1/M8_P2 §2.4, Untouched by this phase's scope guardrail —
 * see §4.2), so unmounting a calculator on category switch would reset that
 * state on remount, which is incompatible with AC-7. To satisfy both AC-7
 * and AC-3..AC-6 ("hiding all cards from other categories") simultaneously
 * without touching any calculator component, every one of the 10 calculator
 * instances stays mounted at all times; each of the 4 category blocks below
 * is instead hidden via the native HTML `hidden` attribute (not a CSS-only
 * visual hide) when its category is not the active filter. The `hidden`
 * attribute removes the subtree from the accessibility tree, so
 * `getByRole`/`queryByRole` (which exclude inaccessible elements by
 * default) correctly report a hidden section's heading and cards as absent,
 * satisfying AC-3..AC-6's DOM-level "hiding" assertions, while the
 * component instances themselves never unmount, satisfying AC-7.
 */
export type CalculatorCategory = 'All' | 'Water & Mash' | 'Gravity & Refractometry' | 'Yeast & Pitching' | 'Hops & Carbonation';

export interface CalculatorsProps {
  /** Optional callback to open the mobile off-canvas navigation drawer (M26_P1 Amendment 1). */
  onOpenMobileNav?: () => void;
}

const ACTIVE_PILL = 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20';
const INACTIVE_PILL = 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 font-medium';
const PILL_BASE = 'px-4 py-2 rounded-full text-sm transition-colors';
const SECTION_HEADING = 'text-base md:text-lg font-bold text-slate-100 flex items-center gap-2.5 tracking-tight mb-4';

export function Calculators({ onOpenMobileNav }: CalculatorsProps = {}) {
  const [activeCategory, setActiveCategory] = useState<CalculatorCategory>('All');

  const showWaterMash = activeCategory === 'All' || activeCategory === 'Water & Mash';
  const showGravity = activeCategory === 'All' || activeCategory === 'Gravity & Refractometry';
  const showYeast = activeCategory === 'All' || activeCategory === 'Yeast & Pitching';
  const showHops = activeCategory === 'All' || activeCategory === 'Hops & Carbonation';

  return (
    <>
      <TopBar title="Calculators" onOpenMobileNav={onOpenMobileNav} />
      <PageContainer>
        <div role="group" aria-label="Calculator Categories" className="flex flex-wrap gap-2 mb-8">
          <Button
            aria-pressed={activeCategory === 'All'}
            className={`${PILL_BASE} ${activeCategory === 'All' ? ACTIVE_PILL : INACTIVE_PILL}`}
            onClick={() => setActiveCategory('All')}
          >
            All
          </Button>
          <Button
            aria-pressed={activeCategory === 'Water & Mash'}
            className={`${PILL_BASE} ${activeCategory === 'Water & Mash' ? ACTIVE_PILL : INACTIVE_PILL}`}
            onClick={() => setActiveCategory('Water & Mash')}
          >
            Water &amp; Mash
          </Button>
          <Button
            aria-pressed={activeCategory === 'Gravity & Refractometry'}
            className={`${PILL_BASE} ${activeCategory === 'Gravity & Refractometry' ? ACTIVE_PILL : INACTIVE_PILL}`}
            onClick={() => setActiveCategory('Gravity & Refractometry')}
          >
            Gravity &amp; Refractometry
          </Button>
          <Button
            aria-pressed={activeCategory === 'Yeast & Pitching'}
            className={`${PILL_BASE} ${activeCategory === 'Yeast & Pitching' ? ACTIVE_PILL : INACTIVE_PILL}`}
            onClick={() => setActiveCategory('Yeast & Pitching')}
          >
            Yeast &amp; Pitching
          </Button>
          <Button
            aria-pressed={activeCategory === 'Hops & Carbonation'}
            className={`${PILL_BASE} ${activeCategory === 'Hops & Carbonation' ? ACTIVE_PILL : INACTIVE_PILL}`}
            onClick={() => setActiveCategory('Hops & Carbonation')}
          >
            Hops &amp; Carbonation
          </Button>
        </div>

        <div className="space-y-10">
          <div hidden={!showWaterMash}>
            <h3 className={SECTION_HEADING}>
              <Droplets className="w-5 h-5 text-amber-500" />
              Water &amp; Mash
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <StrikeWaterCalculator />
              <InfusionVolumeCalculator />
            </div>
          </div>

          <div hidden={!showGravity}>
            <h3 className={SECTION_HEADING}>
              <Gauge className="w-5 h-5 text-amber-500" />
              Gravity &amp; Refractometry
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <HydrometerCalculator />
              <RefractometerCalculator />
              <GravityCorrectionCalculator />
            </div>
          </div>

          <div hidden={!showYeast}>
            <h3 className={SECTION_HEADING}>
              <Dna className="w-5 h-5 text-amber-500" />
              Yeast &amp; Pitching
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PitchRateCalculator />
              <StarterGrowthCalculator />
            </div>
          </div>

          <div hidden={!showHops}>
            <h3 className={SECTION_HEADING}>
              <Wine className="w-5 h-5 text-amber-500" />
              Hops &amp; Carbonation
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CarbonationCalculator />
              <HopDecayCalculator />
              <UnitConverterCalculator />
            </div>
          </div>
        </div>
      </PageContainer>
    </>
  );
}

