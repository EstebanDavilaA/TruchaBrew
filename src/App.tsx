import { useState, useMemo } from 'react';
import type { Recipe } from './types/brewing';
import { INITIAL_SAMPLE_RECIPE, SEED_EQUIPMENT_PROFILES } from './data/seedData';
import { calculateRecipeStats } from './calculations/brewingMath';
import { StatsHeader } from './components/StatsHeader';
import { FermentableSection } from './components/FermentableSection';
import { HopSection } from './components/HopSection';
import { YeastSection } from './components/YeastSection';
import { Beer, Settings, RotateCcw, Scale, Bookmark } from 'lucide-react';

export function App() {
  const [recipe, setRecipe] = useState<Recipe>(INITIAL_SAMPLE_RECIPE);
  const [targetScaleL, setTargetScaleL] = useState<number>(20);
  const [showScaleModal, setShowScaleModal] = useState<boolean>(false);

  // Re-calculate statistics on every change to recipe or equipment
  const stats = useMemo(() => {
    return calculateRecipeStats(recipe);
  }, [recipe]);

  const handleEquipmentChange = (eqId: string) => {
    const selected = SEED_EQUIPMENT_PROFILES.find((e) => e.id === eqId);
    if (!selected) return;
    setRecipe((prev) => ({ ...prev, equipment: selected }));
  };

  const handleScaleRecipe = () => {
    if (targetScaleL <= 0 || targetScaleL === recipe.equipment.batchSizeL) {
      setShowScaleModal(false);
      return;
    }
    const ratio = targetScaleL / recipe.equipment.batchSizeL;

    setRecipe((prev) => ({
      ...prev,
      equipment: {
        ...prev.equipment,
        batchSizeL: targetScaleL
      },
      fermentables: prev.fermentables.map((f) => ({
        ...f,
        amountKg: parseFloat((f.amountKg * ratio).toFixed(2))
      })),
      hops: prev.hops.map((h) => ({
        ...h,
        amountG: Math.round(h.amountG * ratio)
      }))
    }));

    setShowScaleModal(false);
  };

  const handleResetRecipe = () => {
    setRecipe(INITIAL_SAMPLE_RECIPE);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* Header Bar */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
              <Beer className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-white tracking-wide flex items-center gap-2">
                TruchaBrew <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">Prototype</span>
              </h1>
              <p className="text-xs text-slate-400">Self-Hosted Brewing Recipe Designer</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setTargetScaleL(recipe.equipment.batchSizeL);
                setShowScaleModal(true);
              }}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Scale className="w-4 h-4 text-amber-400" /> Scale Batch
            </button>

            <button
              onClick={handleResetRecipe}
              className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-medium px-3 py-2 rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Reset to sample recipe"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Top Info Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1 min-w-[280px]">
            <input
              type="text"
              value={recipe.name}
              onChange={(e) => setRecipe({ ...recipe, name: e.target.value })}
              className="text-2xl font-bold bg-transparent border-b border-transparent hover:border-slate-700 focus:border-amber-500 text-white focus:outline-none w-full py-0.5"
              placeholder="Recipe Name"
            />
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
              <span className="flex items-center gap-1 text-slate-300">
                <Bookmark className="w-3.5 h-3.5 text-amber-500" />
                <input
                  type="text"
                  value={recipe.styleName}
                  onChange={(e) => setRecipe({ ...recipe, styleName: e.target.value })}
                  className="bg-transparent border-b border-transparent hover:border-slate-700 focus:border-amber-500 text-slate-300 focus:outline-none"
                  placeholder="Style Name"
                />
              </span>
              <span>•</span>
              <span>Brewer: <strong className="text-slate-200">{recipe.author}</strong></span>
            </div>
          </div>

          {/* Equipment Profile Picker */}
          <div className="flex items-center gap-3 bg-slate-800/60 p-3 rounded-lg border border-slate-800">
            <Settings className="w-4 h-4 text-slate-400" />
            <div className="text-xs">
              <div className="text-slate-400 font-medium mb-0.5">Equipment Profile</div>
              <select
                value={recipe.equipment.id}
                onChange={(e) => handleEquipmentChange(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
              >
                {SEED_EQUIPMENT_PROFILES.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.name} ({eq.batchSizeL}L)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Live Calculation Header Component */}
        <StatsHeader stats={stats} batchSizeL={recipe.equipment.batchSizeL} />

        {/* Ingredient Sections */}
        <FermentableSection
          fermentables={recipe.fermentables}
          totalGrainKg={stats.totalGrainKg}
          onUpdate={(updated) => setRecipe({ ...recipe, fermentables: updated })}
        />

        <HopSection
          hops={recipe.hops}
          preBoilGravity={stats.preBoilGravity}
          batchSizeL={recipe.equipment.batchSizeL}
          totalHopG={stats.totalHopG}
          totalIbu={stats.ibu}
          onUpdate={(updated) => setRecipe({ ...recipe, hops: updated })}
        />

        <YeastSection
          yeasts={recipe.yeasts}
          onUpdate={(updated) => setRecipe({ ...recipe, yeasts: updated })}
        />
      </main>

      {/* Scale Recipe Modal */}
      {showScaleModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Scale className="w-5 h-5 text-amber-500" /> Scale Recipe Batch Size
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter a new target batch size. All fermentables and hop amounts will automatically rescale proportionally while maintaining original gravity and IBU balance.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Current Batch Size: <strong className="text-amber-400">{recipe.equipment.batchSizeL} L</strong>
              </label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={targetScaleL}
                  onChange={(e) => setTargetScaleL(parseFloat(e.target.value) || 1)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500 font-semibold"
                />
                <span className="text-sm text-slate-400">Liters</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowScaleModal(false)}
                className="text-xs text-slate-400 hover:text-slate-200 px-3 py-2 font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleScaleRecipe}
                className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer"
              >
                Scale Recipe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
