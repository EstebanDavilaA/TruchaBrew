import React, { useState, useRef } from 'react';
import type { UserConfig, UserConfigInput, RecipeWriteInput, EquipmentProfile, DatabaseBackup } from '@truchabrew/shared-types';
import { TopBar } from './TopBar';
import { PageContainer } from './PageContainer';
import { useConfig, putConfig, ConfigApiError } from '../context/ConfigContext';
import {
  CARD_CLASS,
  SECTION_HEADING_CLASS,
  METADATA_TEXT_CLASS,
  LOADING_STATE_CLASS,
  ERROR_STATE_CLASS,
  BODY_TEXT_CLASS,
  SETTINGS_ROW_CLASS,
} from './designSystem';
import { Button, Select } from './ui';
import {
  AlertTriangle,
  RotateCw,
  Settings as SettingsIcon,
  Sliders,
  Calculator,
  FileDown,
  UploadCloud,
  CheckCircle2,
  Database,
  Download,
} from 'lucide-react';
import { parseBrewfatherRecipe, parseBeerXml } from '@truchabrew/calculations';
import { listEquipmentProfiles, listRecipes, downloadDatabaseBackup } from '../api/client';
import { RecipeImportModal } from './RecipeImportModal';
import { BackupRestoreModal } from './BackupRestoreModal';

// GET/PUT /api/config helpers MOVED into ConfigContext.tsx (not duplicated)
// per the M7_P1 amendment §1.4 — imported above rather than redefined here.

// ---------------------------------------------------------------------------
// Select field definitions
// ---------------------------------------------------------------------------

interface SelectFieldSpec<K extends keyof UserConfigInput> {
  key: K;
  label: string;
  description: string;
  options: { value: NonNullable<UserConfig[K]>; label: string }[];
}

const UNIT_SYSTEM_FIELD: SelectFieldSpec<'unitSystem'> = {
  key: 'unitSystem',
  label: 'Unit System',
  description: 'Default measurement system for recipes and inventory',
  options: [
    { value: 'metric', label: 'Metric (kg, g, L, °C)' },
    { value: 'us', label: 'US Customary (lb, oz, gal, °F)' },
    { value: 'imperial', label: 'Imperial (lb, oz, Imp gal, °F)' },
  ],
};

const GRAVITY_UNIT_FIELD: SelectFieldSpec<'gravityUnit'> = {
  key: 'gravityUnit',
  label: 'Gravity Display',
  description: 'Specific Gravity (1.050) vs Degrees Plato (°P)',
  options: [
    { value: 'sg', label: 'Specific Gravity (1.050)' },
    { value: 'plato', label: 'Degrees Plato (12.4 °P)' },
  ],
};

const TEMPERATURE_UNIT_FIELD: SelectFieldSpec<'temperatureUnit'> = {
  key: 'temperatureUnit',
  label: 'Temperature',
  description: 'Temperature scale used across mash and fermentation',
  options: [
    { value: 'celsius', label: 'Celsius (°C)' },
    { value: 'fahrenheit', label: 'Fahrenheit (°F)' },
  ],
};

const IBU_FORMULA_FIELD: SelectFieldSpec<'ibuFormula'> = {
  key: 'ibuFormula',
  label: 'IBU Formula',
  description: 'Hop bitterness calculation model',
  options: [
    { value: 'tinseth', label: 'Tinseth' },
    { value: 'rager', label: 'Rager' },
    { value: 'garetz', label: 'Garetz (approximate)' },
  ],
};

const ABV_FORMULA_FIELD: SelectFieldSpec<'abvFormula'> = {
  key: 'abvFormula',
  label: 'ABV Formula',
  description: 'Alcohol by volume estimation formula',
  options: [
    { value: 'simple', label: 'Simple' },
    { value: 'balling', label: 'Balling' },
  ],
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SettingsManagerProps {
  /** Optional callback to open the mobile off-canvas navigation drawer (M26_P1 Amendment 1). */
  onOpenMobileNav?: () => void;
}

export function SettingsManager({ onOpenMobileNav }: SettingsManagerProps = {}) {
  const { config, status, error: loadError, applyConfig, reload } = useConfig();
  const [savingField, setSavingField] = useState<keyof UserConfigInput | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Ingestion & Import State
  const [equipmentList, setEquipmentList] = useState<EquipmentProfile[]>([]);
  const [existingRecipes, setExistingRecipes] = useState<Array<{ id: string; name: string }>>([]);
  const [parsedRecipes, setParsedRecipes] = useState<RecipeWriteInput[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFileError, setImportFileError] = useState<string | null>(null);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Database Backup & Export (M36_P1)
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [backupExportError, setBackupExportError] = useState<string | null>(null);

  // Database Restore (M36_P2) — the dropzone parses/validates a dropped or
  // selected .json file client-side (AC-14) and, once it looks like a real
  // TruchaBrew backup, hands it to BackupRestoreModal, which owns the
  // mode-selection/confirm/execute flow (RA-2/RA-3) from there.
  const [restoreBackupFile, setRestoreBackupFile] = useState<DatabaseBackup | null>(null);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [restoreDropError, setRestoreDropError] = useState<string | null>(null);
  const restoreFileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = async <K extends keyof UserConfigInput>(key: K, value: NonNullable<UserConfig[K]>) => {
    const previous = config;
    const optimistic: UserConfig = { ...config, [key]: value };
    applyConfig(optimistic);
    setSavingField(key);
    setSaveError(null);

    try {
      const persisted = await putConfig({ [key]: value });
      applyConfig(persisted);
    } catch (err: unknown) {
      applyConfig(previous);
      if (err instanceof ConfigApiError) {
        setSaveError(err.message);
      } else if (err instanceof Error) {
        setSaveError(err.message);
      } else {
        setSaveError('An unexpected error occurred while saving.');
      }
    } finally {
      setSavingField(null);
    }
  };

  const handleExportBackup = async () => {
    setIsExportingBackup(true);
    setBackupExportError(null);
    try {
      await downloadDatabaseBackup();
    } catch (err: unknown) {
      setBackupExportError(err instanceof Error ? err.message : 'An unexpected error occurred while exporting the backup.');
    } finally {
      setIsExportingBackup(false);
    }
  };

  /**
   * Client-side pre-flight (AC-14): a shallow shape check only — the same
   * "type/schemaVersion here, real referential-integrity checks left to the
   * server's own DB constraints" split routes/backup.ts's restore route
   * schema already uses. A payload that passes this still goes through the
   * server's own AC-11 validation on submit.
   */
  function parseAndOpenRestoreFile(content: string) {
    setRestoreDropError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      setRestoreDropError('That file is not valid JSON.');
      return;
    }

    const candidate = parsed as Partial<DatabaseBackup> | null;
    if (!candidate || typeof candidate !== 'object' || candidate.schemaVersion !== 1 || !candidate.data || typeof candidate.data !== 'object') {
      setRestoreDropError('That file is not a recognized TruchaBrew database backup.');
      return;
    }

    setRestoreBackupFile(candidate as DatabaseBackup);
    setIsRestoreModalOpen(true);
  }

  const handleRestoreFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      parseAndOpenRestoreFile(event.target?.result as string);
      if (restoreFileInputRef.current) restoreFileInputRef.current.value = '';
    };
    reader.onerror = () => {
      setRestoreDropError('Error reading the selected file.');
      if (restoreFileInputRef.current) restoreFileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleRestoreDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      parseAndOpenRestoreFile(event.target?.result as string);
    };
    reader.onerror = () => setRestoreDropError('Error reading the dropped file.');
    reader.readAsText(file);
  };

  const processFileContent = async (filename: string, content: string) => {
    setImportFileError(null);
    setImportSuccessMessage(null);

    let currentEqList = equipmentList;
    try {
      const eqs = await listEquipmentProfiles();
      if (Array.isArray(eqs)) {
        setEquipmentList(eqs);
        currentEqList = eqs;
      }
    } catch {}

    try {
      const recs = await listRecipes();
      if (Array.isArray(recs)) {
        setExistingRecipes(recs.map((r) => ({ id: r.id, name: r.name })));
      }
    } catch {}

    const defaultEqId = currentEqList.length > 0 ? currentEqList[0].id : 'eq-default';

    try {
      let results: RecipeWriteInput[] = [];
      const trimmed = content.trim();

      if (trimmed.startsWith('<') || filename.toLowerCase().endsWith('.xml')) {
        results = parseBeerXml(content, { defaultEquipmentId: defaultEqId });
      } else {
        const json = JSON.parse(content);
        results = parseBrewfatherRecipe(json, { defaultEquipmentId: defaultEqId });
      }

      if (results.length === 0) {
        setImportFileError('No valid recipes could be extracted from the file. Ensure it is a valid Brewfather JSON or BeerXML file.');
        return;
      }

      setParsedRecipes(results);
      setIsImportModalOpen(true);
    } catch (err: unknown) {
      setImportFileError(`Failed to parse file: ${err instanceof Error ? err.message : 'Invalid format'}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      processFileContent(file.name, content);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.onerror = () => {
      setImportFileError('Error reading the selected file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      processFileContent(file.name, content);
    };
    reader.readAsText(file);
  };

  const renderRow = <K extends keyof UserConfigInput>(spec: SelectFieldSpec<K>) => {
    const currentValue = config[spec.key];
    const isSaving = savingField === spec.key;

    return (
      <div key={spec.key} className={SETTINGS_ROW_CLASS}>
        <div className="flex-1 pr-4">
          <label htmlFor={`setting-${spec.key}`} className="font-semibold text-slate-100 text-sm block">
            {spec.label}
          </label>
          <span className={METADATA_TEXT_CLASS}>{spec.description}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Select
            id={`setting-${spec.key}`}
            data-testid={`settings-select-${spec.key}`}
            aria-label={spec.label}
            value={currentValue ?? ''}
            disabled={isSaving}
            onChange={(e) => handleChange(spec.key, e.target.value as NonNullable<UserConfig[K]>)}
            size="md"
          >
            {spec.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          {isSaving && <RotateCw className="w-4 h-4 text-amber-500 animate-spin flex-shrink-0" />}
        </div>
      </div>
    );
  };

  return (
    <>
      <TopBar title="Settings" onOpenMobileNav={onOpenMobileNav} />
      <PageContainer>
        {status === 'error' && (
          <div className={`${ERROR_STATE_CLASS} flex items-center justify-between gap-4 mb-6`}>
            <div>
              <div className="font-semibold text-rose-300">Couldn't load your settings</div>
              <div className="text-rose-200/90">{loadError}</div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={reload}
            >
              <RotateCw className="w-3.5 h-3.5" /> Retry
            </Button>
          </div>
        )}

        {saveError && (
          <div className={`${ERROR_STATE_CLASS} flex items-center gap-3 mb-6`}>
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            Couldn't save that change: {saveError}
          </div>
        )}

        {status === 'loading' && (
          <div className={LOADING_STATE_CLASS}>
            <SettingsIcon className="w-8 h-8 mx-auto mb-3 text-slate-600 animate-pulse" />
            Loading settings…
          </div>
        )}

        {status === 'ready' && (
          <div className="flex flex-col gap-6 w-full">
            <div className={CARD_CLASS} data-testid="settings-section-units">
              <div className="flex items-center gap-2 mb-4">
                <Sliders className="w-5 h-5 text-amber-500" />
                <h2 className={SECTION_HEADING_CLASS}>Units &amp; Display</h2>
              </div>
              <div className="divide-y divide-slate-800">
                {renderRow(UNIT_SYSTEM_FIELD)}
                {renderRow(GRAVITY_UNIT_FIELD)}
                {renderRow(TEMPERATURE_UNIT_FIELD)}
              </div>
            </div>

            {/* Section 2: Formulas & Calculations */}
            <div className={CARD_CLASS} data-testid="settings-section-formulas">
              <div className="flex items-center gap-2 mb-4">
                <Calculator className="w-5 h-5 text-amber-500" />
                <h2 className={SECTION_HEADING_CLASS}>Formulas &amp; Calculations</h2>
              </div>
              <div className="divide-y divide-slate-800">
                {renderRow(IBU_FORMULA_FIELD)}
                {renderRow(ABV_FORMULA_FIELD)}
              </div>

              {config.ibuFormula === 'garetz' && (
                <div
                  data-testid="garetz-approximation-note"
                  className="mt-4 text-xs text-amber-300 bg-amber-950/30 border border-amber-900 rounded-lg px-4 py-3 flex items-start gap-2"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <span>
                    Garetz IBU is approximate — this app does not yet implement the full published Garetz method (it has no
                    elevation input), so treat these numbers as illustrative only.
                  </span>
                </div>
              )}
            </div>

            {/* Section 3: Data & Recipe Ingestion */}
            <div className={CARD_CLASS} data-testid="settings-import-section">
              <div className="flex items-center gap-2 mb-3">
                <FileDown className="w-5 h-5 text-amber-500" />
                <h2 className={SECTION_HEADING_CLASS}>Data &amp; Recipe Ingestion</h2>
              </div>
              <p className={`${BODY_TEXT_CLASS} mb-4`}>
                Import recipes directly from external brewing software. Supports Brewfather (.json) single/batch exports and BeerXML (.xml).
              </p>

              {importSuccessMessage && (
                <div
                  data-testid="import-success-toast"
                  className="mb-4 p-3 bg-emerald-950/80 border border-emerald-700/80 rounded-xl text-emerald-300 text-xs flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{importSuccessMessage}</span>
                </div>
              )}

              {importFileError && (
                <div
                  data-testid="import-file-error"
                  className="mb-4 p-3 bg-rose-950/80 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{importFileError}</span>
                </div>
              )}

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-amber-500/80 bg-slate-950/50 hover:bg-slate-950/80 rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
              >
                <div className="p-3 rounded-full bg-slate-800 group-hover:bg-amber-500/20 text-slate-400 group-hover:text-amber-400 transition-colors">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div className="text-xs font-semibold text-slate-200">
                  Click to browse or drag and drop recipe files
                </div>
                <div className="text-[11px] text-slate-400">
                  Accepts .json (Brewfather) or .xml (BeerXML)
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.xml,text/xml,application/json"
                  onChange={handleFileUpload}
                  data-testid="recipe-file-input"
                  className="hidden"
                />
              </div>
            </div>

            {/* Section 4: Database Backup & Export */}
            <div className={CARD_CLASS} data-testid="settings-backup-section">
              <div className="flex items-center gap-2 mb-3">
                <Database className="w-5 h-5 text-amber-500" />
                <h2 className={SECTION_HEADING_CLASS}>Database Backup &amp; Export</h2>
              </div>
              <p className={`${BODY_TEXT_CLASS} mb-4`}>
                Download a complete JSON snapshot of your recipes, batches, equipment, mash &amp; fermentation profiles, water
                profiles, inventory, and settings — everything needed to restore or migrate your TruchaBrew data.
              </p>

              {backupExportError && (
                <div className={`${ERROR_STATE_CLASS} flex items-center gap-3 mb-4`} data-testid="settings-backup-export-error">
                  <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  Couldn't export your backup: {backupExportError}
                </div>
              )}

              <Button
                variant="primary"
                size="sm"
                type="button"
                data-testid="settings-export-backup-btn"
                disabled={isExportingBackup}
                onClick={handleExportBackup}
              >
                {isExportingBackup ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                {isExportingBackup ? 'Exporting…' : 'Export Database Backup'}
              </Button>

              {/* M36_P2 — restore dropzone (AC-13/AC-14), alongside the export card. */}
              <div className="mt-5 pt-4 border-t border-slate-800">
                <h3 className="text-xs font-semibold text-slate-300 mb-2">Restore from Backup</h3>

                {restoreDropError && (
                  <div className={`${ERROR_STATE_CLASS} flex items-center gap-3 mb-3`} data-testid="settings-restore-error">
                    <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>{restoreDropError}</span>
                  </div>
                )}

                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleRestoreDrop}
                  onClick={() => restoreFileInputRef.current?.click()}
                  data-testid="settings-restore-dropzone"
                  className="border-2 border-dashed border-slate-700 hover:border-amber-500/80 bg-slate-950/50 hover:bg-slate-950/80 rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
                >
                  <div className="p-3 rounded-full bg-slate-800 group-hover:bg-amber-500/20 text-slate-400 group-hover:text-amber-400 transition-colors">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-semibold text-slate-200">Browse for or drop a TruchaBrew backup file here</div>
                  <div className="text-[11px] text-slate-400">Accepts a TruchaBrew database backup .json file</div>
                  <input
                    ref={restoreFileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleRestoreFileSelect}
                    data-testid="settings-restore-file-input"
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </PageContainer>

      {/* Recipe Import Pre-flight Modal */}
      {isImportModalOpen && (
        <RecipeImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          parsedRecipes={parsedRecipes}
          existingRecipes={existingRecipes}
          equipmentProfiles={equipmentList}
          defaultEquipmentId={equipmentList.length > 0 ? equipmentList[0].id : 'eq-default'}
          onImportComplete={(count) => {
            setImportSuccessMessage(`Successfully imported ${count} ${count === 1 ? 'recipe' : 'recipes'} into your library.`);
            // Refresh existing recipes
            listRecipes().then((recs) => {
              if (Array.isArray(recs)) setExistingRecipes(recs.map((r) => ({ id: r.id, name: r.name })));
            });
          }}
        />
      )}

      {/* Database Restore Modal (M36_P2) */}
      <BackupRestoreModal
        isOpen={isRestoreModalOpen}
        backup={restoreBackupFile}
        onClose={() => setIsRestoreModalOpen(false)}
      />
    </>
  );
}
