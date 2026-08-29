import { useState, useEffect, useCallback } from 'react';
import type { EquipmentProfile, MashProfile, FermentationProfile, WaterProfile } from '@truchabrew/shared-types';
import { canScale, deriveScaledEquipment, scaleRecipe, formatVolume } from '@truchabrew/calculations';
import { CatalogProvider } from './context/CatalogContext';
import { ConfigProvider, useConfig } from './context/ConfigContext';
import {
  listEquipmentProfiles,
  createEquipmentProfile,
  listMashProfiles,
  listFermentationProfiles,
  listWaterProfiles,
  createBatch,
  deleteRecipe,
  ApiClientError,
} from './api/client';
import { useRecipeEditor } from './hooks/useRecipeEditor';
import { StatsHeader } from './components/StatsHeader';
import { FermentableSection } from './components/FermentableSection';
import { HopSection } from './components/HopSection';
import { YeastSection } from './components/YeastSection';
import { MiscSection } from './components/MiscSection';
import { RecipeLibrary } from './components/RecipeLibrary';
import { EquipmentManager } from './components/EquipmentManager';
import { MashProfileManager } from './components/MashProfileManager';
import { FermentationProfileManager } from './components/FermentationProfileManager';
import { WaterProfileManager } from './components/WaterProfileManager';
import { WaterSection } from './components/WaterSection';
import { InventoryManager } from './components/InventoryManager';
import { SettingsManager } from './components/SettingsManager';
import { BatchList } from './pages/BatchList';
import { BatchDetail } from './pages/BatchDetail';
import { MashSection } from './components/MashSection';
import { SaveBar } from './components/SaveBar';
import { Sidebar, type NavDestination } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { TopBar } from './components/TopBar';
import { PageContainer } from './components/PageContainer';
import { Modal } from './components/Modal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Calculators } from './pages/Calculators';
import { CARD_CLASS, MONO_VALUE_CLASS } from './components/designSystem';
import { Button, NumberInput } from './components/ui';
import { Beer, Settings, Scale, Bookmark, ArrowLeft, AlertTriangle, Trash2 } from 'lucide-react';



type View =
  | 'list'
  | 'editor'
  | 'equipment'
  | 'mashProfiles'
  | 'fermentationProfiles'
  | 'waterProfiles'
  | 'batches'
  | 'batchDetail'
  | 'inventory'
  | 'settings'
  | 'calculators';

function AppInner() {
  const [view, setView] = useState<View>('list');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [equipmentProfiles, setEquipmentProfiles] = useState<EquipmentProfile[]>([]);
  const [equipmentError, setEquipmentError] = useState<string | null>(null);
  const [mashProfiles, setMashProfiles] = useState<MashProfile[]>([]);
  const [mashProfilesError, setMashProfilesError] = useState<string | null>(null);
  const [fermentationProfiles, setFermentationProfiles] = useState<FermentationProfile[]>([]);
  const [fermentationProfilesError, setFermentationProfilesError] = useState<string | null>(null);
  const [waterProfiles, setWaterProfiles] = useState<WaterProfile[]>([]);
  const [waterProfilesError, setWaterProfilesError] = useState<string | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [targetScaleL, setTargetScaleL] = useState<number>(20);
  const [showScaleModal, setShowScaleModal] = useState(false);
  const [scaleBusy, setScaleBusy] = useState(false);
  const [scaleError, setScaleError] = useState<string | null>(null);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [brewThisBusy, setBrewThisBusy] = useState(false);
  const [brewThisError, setBrewThisError] = useState<string | null>(null);
  const [recipeDeleteOpen, setRecipeDeleteOpen] = useState(false);
  const [recipeDeleteBusy, setRecipeDeleteBusy] = useState(false);
  const [recipeDeleteError, setRecipeDeleteError] = useState<string | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<View | null>(null);

  const { config } = useConfig();
  const editor = useRecipeEditor(config);

  const loadEquipmentProfiles = useCallback(() => {
    listEquipmentProfiles()
      .then((profiles) => {
        setEquipmentProfiles(profiles);
        setEquipmentError(null);
      })
      .catch((err) => {
        setEquipmentError(err instanceof ApiClientError ? err.message : 'Failed to load equipment profiles.');
      });
  }, []);

  const loadMashProfiles = useCallback(() => {
    listMashProfiles()
      .then((profiles) => {
        setMashProfiles(profiles);
        setMashProfilesError(null);
      })
      .catch((err) => {
        setMashProfilesError(err instanceof ApiClientError ? err.message : 'Failed to load mash profiles.');
      });
  }, []);

  const loadFermentationProfiles = useCallback(() => {
    listFermentationProfiles()
      .then((profiles) => {
        setFermentationProfiles(profiles);
        setFermentationProfilesError(null);
      })
      .catch((err) => {
        setFermentationProfilesError(err instanceof ApiClientError ? err.message : 'Failed to load fermentation profiles.');
      });
  }, []);

  const loadWaterProfiles = useCallback(() => {
    listWaterProfiles()
      .then((profiles) => {
        setWaterProfiles(profiles);
        setWaterProfilesError(null);
      })
      .catch((err) => {
        setWaterProfilesError(err instanceof ApiClientError ? err.message : 'Failed to load water profiles.');
      });
  }, []);

  useEffect(() => {
    loadEquipmentProfiles();
    loadMashProfiles();
    loadFermentationProfiles();
    loadWaterProfiles();
  }, [loadEquipmentProfiles, loadMashProfiles, loadFermentationProfiles, loadWaterProfiles]);

  // The editor view is only ever entered with a recipe set (handleNew /
  // handleOpen both set one before switching view). If it's ever missing —
  // e.g. closeEditor() fired while still on 'editor' — redirect via an
  // effect rather than writing state during render.
  useEffect(() => {
    if (view === 'editor' && editor.recipe === null) {
      setView('list');
    }
  }, [view, editor.recipe]);

  const navigateGuarded = (target: View) => {
    if (view === 'editor' && editor.isDirty) {
      setPendingNavigation(target);
      return;
    }
    if (view === 'editor') {
      editor.closeEditor();
    }
    setView(target);
  };

  const handleConfirmDiscard = () => {
    if (pendingNavigation) {
      const target = pendingNavigation;
      setPendingNavigation(null);
      editor.closeEditor();
      setView(target);
    }
  };

  const handleCancelDiscard = () => {
    setPendingNavigation(null);
  };

  const goToLibrary = () => navigateGuarded('list');
  const goToEquipment = () => navigateGuarded('equipment');
  const goToMashProfiles = () => navigateGuarded('mashProfiles');
  const goToFermentationProfiles = () => navigateGuarded('fermentationProfiles');
  const goToBatches = () => navigateGuarded('batches');
  const goToWaterProfiles = () => navigateGuarded('waterProfiles');
  // InventoryManager is self-contained (BatchList precedent) — it owns its
  // own fetch/filter/CRUD state, so there is no loader here to wire beyond
  // the view switch itself.
  const goToInventory = () => navigateGuarded('inventory');
  const goToSettings = () => navigateGuarded('settings');
  const goToCalculators = () => navigateGuarded('calculators');

  const handleNavigate = (destination: NavDestination) => {
    if (destination === 'list') {
      goToLibrary();
    } else if (destination === 'equipment') {
      goToEquipment();
    } else if (destination === 'mashProfiles') {
      goToMashProfiles();
    } else if (destination === 'fermentationProfiles') {
      goToFermentationProfiles();
    } else if (destination === 'waterProfiles') {
      goToWaterProfiles();
    } else if (destination === 'inventory') {
      goToInventory();
    } else if (destination === 'settings') {
      goToSettings();
    } else if (destination === 'calculators') {
      goToCalculators();
    } else {
      goToBatches();
    }
  };

  const handleViewBatch = (id: string) => {
    setActiveBatchId(id);
    setView('batchDetail');
  };

  // AC-8: gated on the open recipe being saved (storedId !== null) and clean
  // (isDirty === false) — the batch snapshot freezes what the SERVER holds,
  // so brewing a never-saved or dirty recipe would freeze a state the user
  // never actually saved. Issues exactly one POST /api/batches, routed
  // through api/client.ts (createBatch), not a bare fetch here.
  const canBrewThis = editor.storedId !== null && !editor.isDirty;

  const handleBrewThis = async () => {
    if (!canBrewThis || editor.storedId === null) return;
    setBrewThisBusy(true);
    setBrewThisError(null);
    try {
      const created = await createBatch(editor.storedId);
      // Navigate using the id from the response body — not a refetch-and-guess.
      setActiveBatchId(created.id);
      setView('batchDetail');
    } catch (err) {
      // Does NOT navigate on failure; the server's message is surfaced above.
      setBrewThisError(err instanceof ApiClientError ? err.message : 'Failed to create batch.');
    } finally {
      setBrewThisBusy(false);
    }
  };

  const handleNew = () => {
    // No fabricated placeholder profile is ever constructed. With zero
    // equipment profiles, "New Recipe" is a no-op — the inline note in the
    // list view (below) links to the equipment manager, which is where the
    // "no profiles exist" state is actually recoverable now (§2.4, §2.6).
    if (equipmentProfiles.length === 0) return;
    editor.startNewRecipe(equipmentProfiles[0]);
    setLibraryError(null);
    setView('editor');
  };

  const handleOpen = async (id: string) => {
    await editor.loadRecipe(id);
    setView('editor');
  };

  // Retained per M5.5_P4 spec §2.9.6 even though RecipeLibrary no longer
  // calls it (its onDeleted prop was removed) — App.tsx-local and harmless;
  // not to be deleted as apparent dead code without a spec amendment.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleRecipeDeleted = (id: string) => {
    if (editor.storedId === id) {
      editor.closeEditor();
    }
  };
  void handleRecipeDeleted;

  const handleDeleteRecipe = async () => {
    if (editor.storedId === null) return;
    setRecipeDeleteBusy(true);
    setRecipeDeleteError(null);
    try {
      await deleteRecipe(editor.storedId);
      setRecipeDeleteOpen(false);
      editor.closeEditor();
      setView('list');
    } catch (err) {
      setRecipeDeleteOpen(false);
      setRecipeDeleteError(err instanceof ApiClientError ? err.message : 'Failed to delete recipe.');
    } finally {
      setRecipeDeleteBusy(false);
    }
  };

  const handleEquipmentChange = (eqId: string) => {
    const selected = equipmentProfiles.find((e) => e.id === eqId);
    if (!selected) return;
    editor.setRecipe((prev) => ({ ...prev, equipment: selected }));
  };

  const handleEquipmentCreated = () => {
    loadEquipmentProfiles();
  };

  const handleEquipmentUpdated = (updated: EquipmentProfile) => {
    loadEquipmentProfiles();
    editor.applyEquipmentUpdate(updated);
  };

  const handleEquipmentDeleted = () => {
    loadEquipmentProfiles();
  };

  const handleMashProfileCreated = () => {
    loadMashProfiles();
  };
  const handleMashProfileUpdated = (updated: MashProfile) => {
    loadMashProfiles();
    editor.applyMashProfileUpdate(updated);
  };
  const handleMashProfileDeleted = () => {
    loadMashProfiles();
  };

  const handleFermentationProfileCreated = () => {
    loadFermentationProfiles();
  };
  const handleFermentationProfileUpdated = (updated: FermentationProfile) => {
    loadFermentationProfiles();
    editor.applyFermentationProfileUpdate(updated);
  };
  const handleFermentationProfileDeleted = () => {
    loadFermentationProfiles();
  };

  const handleWaterProfileCreated = () => {
    loadWaterProfiles();
  };
  const handleWaterProfileUpdated = () => {
    loadWaterProfiles();
  };
  const handleWaterProfileDeleted = () => {
    loadWaterProfiles();
  };

  const handleSelectMashProfile = (id: string | null) => {
    const selected = id === null ? null : (mashProfiles.find((p) => p.id === id) ?? null);
    editor.setRecipe((prev) => ({ ...prev, mashProfile: selected }));
  };

  const handleSelectFermentationProfile = (id: string | null) => {
    const selected = id === null ? null : (fermentationProfiles.find((p) => p.id === id) ?? null);
    editor.setRecipe((prev) => ({ ...prev, fermentationProfile: selected }));
  };

  const openScaleModal = () => {
    if (!editor.recipe) return;
    setTargetScaleL(editor.recipe.equipment.batchSizeL);
    setScaleError(null);
    setShowScaleModal(true);
  };

  const handleScaleRecipe = async () => {
    if (!editor.recipe) return;
    const currentBatchSizeL = editor.recipe.equipment.batchSizeL;
    if (!canScale(currentBatchSizeL, targetScaleL)) {
      setShowScaleModal(false);
      return;
    }

    setScaleBusy(true);
    setScaleError(null);
    try {
      // deriveScaledEquipment is pure and deterministic; the server assigns
      // the real id (and reuses an existing derived profile for the same
      // source + target batch size instead of accumulating duplicates).
      const derivedLocally = deriveScaledEquipment(editor.recipe.equipment, targetScaleL, 'pending-server-id');
      const { id: _placeholderId, ...equipmentCreateInput } = derivedLocally;
      const persistedEquipment = await createEquipmentProfile(equipmentCreateInput);

      const scaled = scaleRecipe(editor.recipe, targetScaleL, persistedEquipment);
      editor.setRecipe(scaled);
      loadEquipmentProfiles();
      setShowScaleModal(false);
    } catch (err) {
      setScaleError(err instanceof ApiClientError ? err.message : 'Failed to scale recipe.');
    } finally {
      setScaleBusy(false);
    }
  };

  if (view === 'list') {
    return (
      <div className="h-screen overflow-hidden flex bg-slate-950 text-slate-100 font-sans">
        <Sidebar activeView={view} collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed((c) => !c)} onNavigate={handleNavigate} />
        <MobileNav isOpen={mobileNavOpen} activeView={view} onClose={() => setMobileNavOpen(false)} onNavigate={handleNavigate} />
        <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
          <RecipeLibrary
            onOpen={handleOpen}
            onOpenError={setLibraryError}
            onNew={handleNew}
            canCreate={equipmentProfiles.length > 0}
            onOpenMobileNav={() => setMobileNavOpen(true)}
            notices={
              <>
                {libraryError && (
                  <div className="bg-rose-950/60 border border-rose-800 rounded-lg px-4 py-3 flex items-center gap-3 text-sm text-rose-200">
                    <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    {libraryError}
                  </div>
                )}
                {equipmentError && (
                  <div className="bg-rose-950/60 border border-rose-800 rounded-lg px-4 py-3 flex items-center gap-3 text-sm text-rose-200">
                    <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    Couldn't load equipment profiles: {equipmentError}
                  </div>
                )}
                {!equipmentError && equipmentProfiles.length === 0 && (
                  <div className="bg-amber-950/40 border border-amber-800 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-sm text-amber-200">
                    <span>No equipment profiles yet — create one before starting a new recipe.</span>
                    <button
                      onClick={goToEquipment}
                      className="text-xs font-semibold bg-amber-900/60 hover:bg-amber-900 border border-amber-700 rounded px-3 py-1.5 transition-colors cursor-pointer flex-shrink-0"
                    >
                      Go to Equipment Profiles
                    </button>
                  </div>
                )}
              </>
            }
          />
        </div>
      </div>
    );
  }

  if (view === 'equipment') {
    return (
      <div className="h-screen overflow-hidden flex bg-slate-950 text-slate-100 font-sans">
        <Sidebar activeView={view} collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed((c) => !c)} onNavigate={handleNavigate} />
        <MobileNav isOpen={mobileNavOpen} activeView={view} onClose={() => setMobileNavOpen(false)} onNavigate={handleNavigate} />
        <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
          <EquipmentManager
            profiles={equipmentProfiles}
            loadError={equipmentError}
            onReload={loadEquipmentProfiles}
            activeRecipeEquipmentId={editor.recipe?.equipment.id ?? null}
            onCreated={handleEquipmentCreated}
            onUpdated={handleEquipmentUpdated}
            onDeleted={handleEquipmentDeleted}
            onOpenMobileNav={() => setMobileNavOpen(true)}
          />
        </div>
      </div>
    );
  }

  if (view === 'mashProfiles') {
    return (
      <div className="h-screen overflow-hidden flex bg-slate-950 text-slate-100 font-sans">
        <Sidebar activeView={view} collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed((c) => !c)} onNavigate={handleNavigate} />
        <MobileNav isOpen={mobileNavOpen} activeView={view} onClose={() => setMobileNavOpen(false)} onNavigate={handleNavigate} />
        <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
          <MashProfileManager
            profiles={mashProfiles}
            loadError={mashProfilesError}
            onReload={loadMashProfiles}
            activeRecipeProfileId={editor.recipe?.mashProfile?.id ?? null}
            onCreated={handleMashProfileCreated}
            onUpdated={handleMashProfileUpdated}
            onDeleted={handleMashProfileDeleted}
            onOpenMobileNav={() => setMobileNavOpen(true)}
          />
        </div>
      </div>
    );
  }

  if (view === 'fermentationProfiles') {
    return (
      <div className="h-screen overflow-hidden flex bg-slate-950 text-slate-100 font-sans">
        <Sidebar activeView={view} collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed((c) => !c)} onNavigate={handleNavigate} />
        <MobileNav isOpen={mobileNavOpen} activeView={view} onClose={() => setMobileNavOpen(false)} onNavigate={handleNavigate} />
        <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
          <FermentationProfileManager
            profiles={fermentationProfiles}
            loadError={fermentationProfilesError}
            onReload={loadFermentationProfiles}
            activeRecipeProfileId={editor.recipe?.fermentationProfile?.id ?? null}
            onCreated={handleFermentationProfileCreated}
            onUpdated={handleFermentationProfileUpdated}
            onDeleted={handleFermentationProfileDeleted}
            onOpenMobileNav={() => setMobileNavOpen(true)}
          />
        </div>
      </div>
    );
  }
  if (view === 'waterProfiles') {
    return (
      <div className="h-screen overflow-hidden flex bg-slate-950 text-slate-100 font-sans">
        <Sidebar activeView={view} collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed((c) => !c)} onNavigate={handleNavigate} />
        <MobileNav isOpen={mobileNavOpen} activeView={view} onClose={() => setMobileNavOpen(false)} onNavigate={handleNavigate} />
        <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
          <WaterProfileManager
            profiles={waterProfiles}
            loadError={waterProfilesError}
            onReload={loadWaterProfiles}
            activeRecipeSourceId={editor.recipe?.waterSourceId ?? null}
            activeRecipeTargetId={editor.recipe?.waterTargetId ?? null}
            onCreated={handleWaterProfileCreated}
            onUpdated={handleWaterProfileUpdated}
            onDeleted={handleWaterProfileDeleted}
            onOpenMobileNav={() => setMobileNavOpen(true)}
          />
        </div>
      </div>
    );
  }

  if (view === 'inventory') {
    return (
      <div className="h-screen overflow-hidden flex bg-slate-950 text-slate-100 font-sans">
        <Sidebar activeView={view} collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed((c) => !c)} onNavigate={handleNavigate} />
        <MobileNav isOpen={mobileNavOpen} activeView={view} onClose={() => setMobileNavOpen(false)} onNavigate={handleNavigate} />
        <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
          <InventoryManager onOpenMobileNav={() => setMobileNavOpen(true)} />
        </div>
      </div>
    );
  }

  if (view === 'settings') {
    return (
      <div className="h-screen overflow-hidden flex bg-slate-950 text-slate-100 font-sans">
        <Sidebar activeView={view} collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed((c) => !c)} onNavigate={handleNavigate} />
        <MobileNav isOpen={mobileNavOpen} activeView={view} onClose={() => setMobileNavOpen(false)} onNavigate={handleNavigate} />
        <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
          <SettingsManager onOpenMobileNav={() => setMobileNavOpen(true)} />
        </div>
      </div>
    );
  }

  if (view === 'calculators') {
    return (
      <div className="h-screen overflow-hidden flex bg-slate-950 text-slate-100 font-sans">
        <Sidebar activeView={view} collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed((c) => !c)} onNavigate={handleNavigate} />
        <MobileNav isOpen={mobileNavOpen} activeView={view} onClose={() => setMobileNavOpen(false)} onNavigate={handleNavigate} />
        <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
          <Calculators onOpenMobileNav={() => setMobileNavOpen(true)} />
        </div>
      </div>
    );
  }

  if (view === 'batches') {
    return (
      <div className="h-screen overflow-hidden flex bg-slate-950 text-slate-100 font-sans">
        <Sidebar activeView={view} collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed((c) => !c)} onNavigate={handleNavigate} />
        <MobileNav isOpen={mobileNavOpen} activeView={view} onClose={() => setMobileNavOpen(false)} onNavigate={handleNavigate} />
        <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
          <BatchList onViewBatch={handleViewBatch} onOpenMobileNav={() => setMobileNavOpen(true)} />
        </div>
      </div>
    );
  }

  if (view === 'batchDetail' && activeBatchId) {
    return (
      <div className="h-screen overflow-hidden flex bg-slate-950 text-slate-100 font-sans">
        <Sidebar activeView={view} collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed((c) => !c)} onNavigate={handleNavigate} />
        <MobileNav isOpen={mobileNavOpen} activeView={view} onClose={() => setMobileNavOpen(false)} onNavigate={handleNavigate} />
        <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
          <BatchDetail
            batchId={activeBatchId}
            onBack={goToBatches}
            onDeleted={goToBatches}
            onRebrewed={handleViewBatch}
            onOpenMobileNav={() => setMobileNavOpen(true)}
          />
        </div>
      </div>
    );
  }

  const recipe = editor.recipe;
  if (!recipe) {
    // Unreachable in practice — the effect above redirects to 'list' the
    // moment editor.recipe is null while view === 'editor'. Early return,
    // never a state write during render.
    return null;
  }

  return (
    <div className="h-screen overflow-hidden flex bg-slate-950 text-slate-100 font-sans">
      <Sidebar activeView={view} collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed((c) => !c)} onNavigate={handleNavigate} />
      <MobileNav isOpen={mobileNavOpen} activeView={view} onClose={() => setMobileNavOpen(false)} onNavigate={handleNavigate} />
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        <TopBar
          title="Recipe Editor"
          onOpenMobileNav={() => setMobileNavOpen(true)}
          leading={
            <button
              onClick={goToLibrary}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-lg border border-slate-700 transition-colors cursor-pointer"
              title="Back to library"
              aria-label="Back to recipe library"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          }
        >
          {editor.storedId !== null && (

            <button
              type="button"
              data-testid="recipe-delete"
              disabled={recipeDeleteBusy}
              onClick={() => {
                setRecipeDeleteError(null);
                setRecipeDeleteOpen(true);
              }}
              className="text-rose-400 hover:text-rose-300 text-xs font-semibold px-3 py-2 rounded-lg border border-rose-900/60 hover:border-rose-700 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-rose-400 disabled:hover:border-rose-900/60"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
          <button
            onClick={openScaleModal}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Scale className="w-4 h-4 text-amber-400" /> Scale Batch
          </button>
          <button
            onClick={handleBrewThis}
            disabled={!canBrewThis || brewThisBusy}
            title={
              editor.storedId === null
                ? 'Save this recipe before brewing it'
                : editor.isDirty
                  ? 'Save your changes before brewing this recipe'
                  : undefined
            }
            className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Beer className="w-4 h-4" /> {brewThisBusy ? 'Brewing…' : 'Brew This'}
          </button>
          <SaveBar
            saveState={editor.saveState}
            saveError={editor.saveError}
            isDirty={editor.isDirty}
            onSave={editor.save}
            onDismissError={editor.dismissError}
          />
        </TopBar>

      <ConfirmDialog
        open={pendingNavigation !== null}
        title="Discard unsaved changes?"
        message="You have unsaved changes. Leave without saving?"
        confirmLabel="Discard"
        onConfirm={handleConfirmDiscard}
        onCancel={handleCancelDiscard}
      />

      <ConfirmDialog
        open={recipeDeleteOpen}
        busy={recipeDeleteBusy}
        title={`Delete "${recipe.name}"?`}
        message={`This will permanently delete "${recipe.name}" and all its fermentables, hops, yeast, and miscs. This cannot be undone.`}
        onConfirm={handleDeleteRecipe}
        onCancel={() => setRecipeDeleteOpen(false)}
      />


      <PageContainer>
      {recipeDeleteError && (
        <div className="bg-rose-950/60 border border-rose-800 rounded-lg px-4 py-3 flex items-center gap-3 text-sm text-rose-200">
          <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          Couldn't delete this recipe: {recipeDeleteError}
        </div>
      )}
      {brewThisError && (
        <div className="bg-rose-950/60 border border-rose-800 rounded-lg px-4 py-3 flex items-center gap-3 text-sm text-rose-200">
          <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          Couldn't brew this recipe: {brewThisError}
        </div>
      )}

        <div className={`${CARD_CLASS} flex flex-wrap items-center justify-between gap-4`}>
          <div className="flex-1 min-w-[280px]">
            <input
              type="text"
              aria-label="Recipe name"
              value={recipe.name}
              onChange={(e) => editor.setRecipe((prev) => ({ ...prev, name: e.target.value }))}
              className="text-2xl font-bold bg-transparent border-b border-transparent hover:border-slate-700 focus:border-amber-500 text-white focus:outline-none w-full py-0.5"
              placeholder="Recipe Name"
            />
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
              <span className="flex items-center gap-1 text-slate-300">
                <Bookmark className="w-3.5 h-3.5 text-amber-500" />
                <input
                  type="text"
                  aria-label="Style name"
                  value={recipe.styleName}
                  onChange={(e) => editor.setRecipe((prev) => ({ ...prev, styleName: e.target.value }))}
                  className="bg-transparent border-b border-transparent hover:border-slate-700 focus:border-amber-500 text-slate-300 focus:outline-none"
                  placeholder="Style Name"
                />
              </span>
              <span>•</span>
              <span>
                Brewer:{' '}
                <input
                  type="text"
                  aria-label="Brewer"
                  value={recipe.author}
                  onChange={(e) => editor.setRecipe((prev) => ({ ...prev, author: e.target.value }))}
                  className="bg-transparent border-b border-transparent hover:border-slate-700 focus:border-amber-500 text-slate-200 focus:outline-none"
                  placeholder="Brewer"
                />
              </span>
            </div>
          </div>


          <div className="flex items-center gap-3 bg-slate-800/60 p-3 rounded-lg border border-slate-800">
            <Settings className="w-4 h-4 text-slate-400" />
            <div className="text-xs">
              <div className="text-slate-400 font-medium mb-0.5">Equipment Profile</div>
              <select
                value={recipe.equipment.id}
                onChange={(e) => handleEquipmentChange(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
              >
                {!equipmentProfiles.some((eq) => eq.id === recipe.equipment.id) && (
                  <option value={recipe.equipment.id}>
                    {recipe.equipment.name} ({formatVolume(recipe.equipment.batchSizeL, config.unitSystem)})
                  </option>
                )}
                {equipmentProfiles.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.name} ({formatVolume(eq.batchSizeL, config.unitSystem)})
                  </option>
                ))}
              </select>
              {equipmentError && <div className="text-rose-400 mt-1">{equipmentError}</div>}
            </div>
          </div>
        </div>

        <StatsHeader stats={editor.stats} equipment={recipe.equipment} config={config} />

        <MashSection
          recipe={recipe}
          mashPlan={editor.mashPlan}
          mashProfiles={mashProfiles}
          fermentationProfiles={fermentationProfiles}
          onSelectMashProfile={handleSelectMashProfile}
          onSelectFermentationProfile={handleSelectFermentationProfile}
          config={config}
        />

        <WaterSection
          waterProfiles={waterProfiles}
          waterSourceId={recipe.waterSourceId ?? null}
          waterTargetId={recipe.waterTargetId ?? null}
          waterVolumeL={editor.stats.totalWaterL}
          mashWaterL={editor.stats.mashWaterL}
          spargeWaterL={editor.stats.spargeWaterL}
          spargeTempC={recipe.mashProfile?.spargeTempC ?? recipe.equipment.spargeTemperatureC ?? 76}
          totalGrainKg={editor.stats.totalGrainKg}
          fermentables={recipe.fermentables}
          miscs={recipe.miscs}
          initialTargetPh={recipe.mashProfile?.targetPh ?? 5.3}
          onSourceChange={(id) => editor.setRecipe((prev) => ({ ...prev, waterSourceId: id }))}
          onTargetChange={(id) => editor.setRecipe((prev) => ({ ...prev, waterTargetId: id }))}
          onMiscsUpdate={(miscs) => editor.setRecipe((prev) => ({ ...prev, miscs }))}
        />

        <FermentableSection
          fermentables={recipe.fermentables}
          totalGrainKg={editor.stats.totalGrainKg}
          onUpdate={(updated) => editor.setRecipe((prev) => ({ ...prev, fermentables: updated }))}
        />

        <HopSection
          hops={recipe.hops}
          wortGravity={editor.stats.og}
          batchSizeL={recipe.equipment.batchSizeL}
          hopUtilizationPct={recipe.equipment.hopUtilizationPct}
          hopstandUtilizationFactor={recipe.equipment.hopstandUtilizationFactor}
          hopstandTemperatureC={recipe.equipment.hopstandTemperatureC}
          altitudeMeters={recipe.equipment.altitudeMeters}
          totalHopG={editor.stats.totalHopG}
          totalIbu={editor.stats.ibu}
          onUpdate={(updated) => editor.setRecipe((prev) => ({ ...prev, hops: updated }))}
        />

        <YeastSection
          yeasts={recipe.yeasts}
          onUpdate={(updated) => editor.setRecipe((prev) => ({ ...prev, yeasts: updated }))}
        />

        <MiscSection
          miscs={recipe.miscs}
          onUpdate={(updated) => editor.setRecipe((prev) => ({ ...prev, miscs: updated }))}
        />
      </PageContainer>

      <Modal
        isOpen={showScaleModal}
        onClose={() => setShowScaleModal(false)}
        titleId="scale-modal-title"
        maxWidthClass="max-w-md"
        containerClassName="p-6"
      >
        <h3 id="scale-modal-title" className="text-lg font-bold text-white mb-2 flex items-center gap-2">
          <Scale className="w-5 h-5 text-amber-500" /> Scale Recipe Batch Size
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Enter a new target batch size. A new derived equipment profile is created (or reused) for the target size, and every
          fermentable, hop and misc amount is rescaled so gravity and IBU stay the same.
        </p>

        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Current Batch Size: <strong className={`text-amber-400 ${MONO_VALUE_CLASS}`}>{recipe.equipment.batchSizeL} L</strong>
          </label>
          <label className="block text-xs font-medium text-slate-300 mt-2 mb-1">
            Target Batch Size (L)
          </label>
          <NumberInput
            type="number"
            aria-label="Target batch size in liters"
            step="1"
            min="1"
            value={targetScaleL}
            onChange={(e) => setTargetScaleL(parseFloat(e.target.value) || 1)}
            width="full"
            addonRight="Liters"
          />
        </div>

        {scaleError && <div className="text-xs text-rose-400 mb-3">{scaleError}</div>}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => setShowScaleModal(false)}
            disabled={scaleBusy}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="button"
            onClick={handleScaleRecipe}
            disabled={scaleBusy}
          >
            {scaleBusy ? 'Scaling…' : 'Scale Recipe'}
          </Button>
        </div>
      </Modal>

      </div>
    </div>
  );
}

export function App() {
  return (
    <ConfigProvider>
      <CatalogProvider>
        <AppInner />
      </CatalogProvider>
    </ConfigProvider>
  );
}

export default App;
