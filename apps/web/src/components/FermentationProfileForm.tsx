import React, { useEffect, useRef, useState } from 'react';
import type { FermentationProfile, FermentationProfileWriteInput, FermentationStepType } from '@truchabrew/shared-types';
import { createFermentationProfile, updateFermentationProfile, ApiClientError } from '../api/client';
import { ArrowLeft, Save, Loader2, AlertTriangle, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { TopBar } from './TopBar';
import { PageContainer } from './PageContainer';
import { ConfirmDialog } from './ConfirmDialog';
import { FormField, Input, Select, Button, NumberInput } from './ui';
import {
  CARD_CLASS,
  METADATA_TEXT_CLASS,
  SUBPANEL_CLASS,
} from './designSystem';


const FORM_ID = 'fermentation-profile-form';

interface DeleteAction {
  /** Invoked only after the user confirms. Owns the API call. */
  onConfirm: () => void | Promise<void>;
  /** Non-null disables Delete and is used as its title. Null = deletable. */
  blockedReason: string | null;
  /** True while the delete request is in flight. */
  busy: boolean;
  /** Last delete failure message, or null. */
  error: string | null;
}

type FermentationProfileFormProps =
  | { mode: 'create'; initialProfile?: undefined; onSaved: (profile: FermentationProfile) => void; onCancel: () => void; onOpenMobileNav?: () => void }
  | {
      mode: 'edit';
      initialProfile: FermentationProfile;
      onSaved: (profile: FermentationProfile) => void;
      onCancel: () => void;
      deleteAction: DeleteAction;
      onOpenMobileNav?: () => void;
    };

const FERMENTATION_STEP_TYPES: FermentationStepType[] = ['Primary', 'Secondary', 'Tertiary', 'ColdCrash', 'Carbonation', 'Conditioning'];

interface RawFermentationStepRow {
  id?: string;
  name: string;
  type: FermentationStepType;
  stepTempC: string;
  stepTimeDays: string;
  rampDays: string;
  pressurePsi: string; // '' means null
}

function blankStepRow(): RawFermentationStepRow {
  return { name: '', type: 'Primary', stepTempC: '19', stepTimeDays: '14', rampDays: '0', pressurePsi: '' };
}

function toRawSteps(profile: FermentationProfile): RawFermentationStepRow[] {
  return profile.steps.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    stepTempC: String(s.stepTempC),
    stepTimeDays: String(s.stepTimeDays),
    rampDays: String(s.rampDays),
    pressurePsi: s.pressurePsi === null ? '' : String(s.pressurePsi),
  }));
}

function validateName(name: string): string | null {
  return name.trim().length < 1 ? 'Name is required' : null;
}

function validateBounded(value: number, min: number, max: number): string | null {
  if (Number.isNaN(value)) return 'Required';
  if (value < min) return `Must be ${min} or greater`;
  if (value > max) return `Must be ${max} or less`;
  return null;
}

function validateNullableBounded(raw: string, min: number, max: number): string | null {
  if (raw === '') return null;
  const value = parseFloat(raw);
  if (Number.isNaN(value)) return 'Must be a number or blank';
  if (value < min || value > max) return `Must be blank, or between ${min} and ${max}`;
  return null;
}

function validateStep(step: RawFermentationStepRow): { name?: string; stepTempC?: string; stepTimeDays?: string; rampDays?: string; pressurePsi?: string } {
  const errors: ReturnType<typeof validateStep> = {};
  const nameErr = validateName(step.name);
  if (nameErr) errors.name = nameErr;
  const stepTempCErr = validateBounded(parseFloat(step.stepTempC), -10, 40);
  if (stepTempCErr) errors.stepTempC = stepTempCErr;
  const stepTimeDaysErr = validateBounded(parseFloat(step.stepTimeDays), 0, 365);
  if (stepTimeDaysErr) errors.stepTimeDays = stepTimeDaysErr;
  const rampDaysErr = validateBounded(parseFloat(step.rampDays), 0, 60);
  if (rampDaysErr) errors.rampDays = rampDaysErr;
  const pressurePsiErr = validateNullableBounded(step.pressurePsi, 0, 60);
  if (pressurePsiErr) errors.pressurePsi = pressurePsiErr;
  return errors;
}

export const FermentationProfileForm: React.FC<FermentationProfileFormProps> = (props) => {
  const { mode, initialProfile, onSaved, onCancel, onOpenMobileNav } = props;
  const deleteAction = mode === 'edit' ? props.deleteAction : undefined;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const prevDeleteBusy = useRef(false);
  useEffect(() => {
    if (deleteAction && prevDeleteBusy.current && !deleteAction.busy && deleteAction.error !== null) {
      // A rejected delete closes the dialog and leaves the form open with the error shown (Ambiguity 11).
      setConfirmOpen(false);
    }
    if (deleteAction) prevDeleteBusy.current = deleteAction.busy;
  }, [deleteAction, deleteAction?.busy, deleteAction?.error]);
  const [name, setName] = useState(initialProfile?.name ?? '');
  const [steps, setSteps] = useState<RawFermentationStepRow[]>(initialProfile ? toRawSteps(initialProfile) : []);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  const nameError = validateName(name);
  const stepErrors = steps.map(validateStep);
  const tooManySteps = steps.length > 20;
  const hasErrors = !!nameError || tooManySteps || stepErrors.some((e) => Object.keys(e).length > 0);

  const updateStep = (index: number, patch: Partial<RawFermentationStepRow>) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const addStep = () => setSteps((prev) => [...prev, blankStepRow()]);
  const removeStep = (index: number) => setSteps((prev) => prev.filter((_, i) => i !== index));
  const moveStep = (index: number, direction: -1 | 1) => {
    setSteps((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasErrors || saveState === 'saving') return;

    const payload: FermentationProfileWriteInput = {
      name,
      steps: steps.map((s) => ({
        ...(s.id ? { id: s.id } : {}),
        name: s.name,
        type: s.type,
        stepTempC: parseFloat(s.stepTempC),
        stepTimeDays: parseFloat(s.stepTimeDays),
        rampDays: parseFloat(s.rampDays),
        pressurePsi: s.pressurePsi === '' ? null : parseFloat(s.pressurePsi),
      })),
    };

    setSaveState('saving');
    setSaveError(null);
    try {
      const result = mode === 'create' ? await createFermentationProfile(payload) : await updateFermentationProfile(initialProfile.id, payload);
      setSaveState('idle');
      onSaved(result);
    } catch (err) {
      setSaveState('error');
      setSaveError(err instanceof ApiClientError ? err.message : 'Failed to save fermentation profile.');
    }
  };

  return (
    <>
      <TopBar
        title={mode === 'create' ? 'New Fermentation Profile' : `Edit ${initialProfile.name}`}
        onOpenMobileNav={onOpenMobileNav}
        leading={
          <button
            type="button"
            onClick={onCancel}
            disabled={saveState === 'saving'}
            title="Cancel"
            aria-label="Cancel"
            className="text-slate-400 hover:text-slate-300 transition-colors cursor-pointer disabled:opacity-50"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        }
      >
        {deleteAction && (
          <Button
            variant="danger"
            size="sm"
            data-testid="fermentation-delete"
            onClick={() => setConfirmOpen(true)}
            disabled={deleteAction.blockedReason !== null || deleteAction.busy}
            title={deleteAction.blockedReason ?? 'Delete'}
            className="flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </Button>
        )}

        <Button
          variant="secondary"
          size="sm"
          onClick={onCancel}
          disabled={saveState === 'saving'}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form={FORM_ID}
          size="sm"
          disabled={saveState === 'saving' || hasErrors}
          className="flex items-center gap-2"
        >
          {saveState === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saveState === 'saving' ? 'Saving…' : 'Save Profile'}
        </Button>
      </TopBar>
      {deleteAction && (
        <ConfirmDialog
          open={confirmOpen}
          busy={deleteAction.busy}
          title={`Delete "${mode === 'edit' ? initialProfile.name : ''}"?`}
          message="This cannot be undone."
          onConfirm={() => {
            void deleteAction.onConfirm();
          }}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
      <PageContainer>
        {deleteAction?.error && (
          <div className="bg-rose-950/60 border border-rose-800 rounded-lg px-4 py-3 flex items-start gap-3 text-sm text-rose-200 mb-5">
            <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-semibold text-rose-300">Delete failed</div>
              <div className="text-rose-200/90">{deleteAction.error}</div>
            </div>
          </div>
        )}
        <form id={FORM_ID} onSubmit={handleSubmit}>
          <div className={CARD_CLASS}>
            <FormField
              label="Profile Name"
              htmlFor="ferm-field-name"
              error={nameError || undefined}
              className="mb-5"
            >
              <Input
                id="ferm-field-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Standard Ale Fermentation"
              />
            </FormField>

            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-200">Steps ({steps.length})</h4>
              <Button
                variant="secondary"
                size="sm"
                onClick={addStep}
                disabled={steps.length >= 20}
                className="flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add Step
              </Button>
            </div>
            {tooManySteps && <div className="text-xs text-rose-400 mb-2">A profile may have at most 20 steps.</div>}

            <div className="flex flex-col gap-3">
              {steps.length === 0 && (
                <div className={`${METADATA_TEXT_CLASS} italic bg-slate-950/40 border border-slate-800 rounded-lg p-4 text-center`}>
                  No steps yet — a saved profile with no steps is fine.
                </div>
              )}
              {steps.map((step, index) => {
                const errors = stepErrors[index];
                return (
                  <div key={index} data-testid={`ferm-step-row-${index}`} className={SUBPANEL_CLASS}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-amber-400">Step {index + 1}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveStep(index, -1)}
                          disabled={index === 0}
                          title="Move up"
                          className="text-slate-400 hover:text-amber-400 disabled:opacity-30 disabled:cursor-not-allowed p-1 cursor-pointer"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveStep(index, 1)}
                          disabled={index === steps.length - 1}
                          title="Move down"
                          className="text-slate-400 hover:text-amber-400 disabled:opacity-30 disabled:cursor-not-allowed p-1 cursor-pointer"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => removeStep(index)} title="Remove step" className="text-slate-400 hover:text-rose-400 p-1 cursor-pointer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                      <div className="col-span-2">
                        <FormField label="Name" htmlFor={`ferm-step-name-${index}`} error={errors.name}>
                          <Input
                            id={`ferm-step-name-${index}`}
                            type="text"
                            value={step.name}
                            onChange={(e) => updateStep(index, { name: e.target.value })}
                          />
                        </FormField>
                      </div>
                      <div>
                        <FormField label="Type" htmlFor={`ferm-step-type-${index}`}>
                          <Select
                            id={`ferm-step-type-${index}`}
                            value={step.type}
                            onChange={(e) => updateStep(index, { type: e.target.value as FermentationStepType })}
                          >
                            {FERMENTATION_STEP_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </Select>
                        </FormField>
                      </div>
                      <div>
                        <FormField label="Temp (°C)" htmlFor={`ferm-step-temp-${index}`} error={errors.stepTempC}>
                          <NumberInput
                            id={`ferm-step-temp-${index}`}
                            type="number"
                            step="1"
                            value={step.stepTempC}
                            onChange={(e) => updateStep(index, { stepTempC: e.target.value })}
                          />
                        </FormField>
                      </div>
                      <div>
                        <FormField label="Duration (days)" htmlFor={`ferm-step-duration-${index}`} error={errors.stepTimeDays}>
                          <NumberInput
                            id={`ferm-step-duration-${index}`}
                            type="number"
                            step="1"
                            value={step.stepTimeDays}
                            onChange={(e) => updateStep(index, { stepTimeDays: e.target.value })}
                          />
                        </FormField>
                      </div>
                      <div>
                        <FormField label="Ramp (days)" htmlFor={`ferm-step-ramp-${index}`} error={errors.rampDays}>
                          <NumberInput
                            id={`ferm-step-ramp-${index}`}
                            type="number"
                            step="1"
                            value={step.rampDays}
                            onChange={(e) => updateStep(index, { rampDays: e.target.value })}
                          />
                        </FormField>
                      </div>
                      <div>
                        <FormField
                          label="Pressure (PSI)"
                          htmlFor={`ferm-step-pressure-${index}`}
                          hint={!errors.pressurePsi ? 'Blank = not pressurised' : undefined}
                          error={errors.pressurePsi}
                        >
                          <NumberInput
                            id={`ferm-step-pressure-${index}`}
                            type="number"
                            step="1"
                            value={step.pressurePsi}
                            onChange={(e) => updateStep(index, { pressurePsi: e.target.value })}
                            placeholder="none"
                          />
                        </FormField>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {saveState === 'error' && saveError && (
            <div className="bg-rose-950/60 border border-rose-800 rounded-lg px-4 py-3 flex items-start gap-3 text-sm text-rose-200 mb-5">
              <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-semibold text-rose-300">Save failed</div>
                <div className="text-rose-200/90">{saveError}</div>
                <div className="text-rose-300/70 text-xs mt-1">Your edits are still here. Fix the issue and try again.</div>
              </div>
            </div>
          )}
        </form>
      </PageContainer>
    </>
  );
};
