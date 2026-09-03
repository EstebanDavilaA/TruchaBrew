import React, { useEffect, useRef, useState } from 'react';
import type { WaterProfile, WaterProfileInput, WaterProfileType } from '@truchabrew/shared-types';
import { createWaterProfile, updateWaterProfile, ApiClientError } from '../api/client';
import { ArrowLeft, Save, Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import { TopBar } from './TopBar';
import { PageContainer } from './PageContainer';
import { ConfirmDialog } from './ConfirmDialog';
import { FormField, Input, Select, Button, NumberInput, SectionCard } from './ui';
import { INPUT_CLASS } from './designSystem';
import { applyBalanceStrategy, type BalanceStrategy } from '@truchabrew/calculations';


const FORM_ID = 'water-profile-form';

interface DeleteAction {
  onConfirm: () => void | Promise<void>;
  blockedReason: string | null;
  busy: boolean;
  error: string | null;
}

type WaterProfileFormProps =
  | { mode: 'create'; initialProfile?: undefined; onSaved: (profile: WaterProfile) => void; onCancel: () => void; onOpenMobileNav?: () => void }
  | {
      mode: 'edit';
      initialProfile: WaterProfile;
      onSaved: (profile: WaterProfile) => void;
      onCancel: () => void;
      deleteAction: DeleteAction;
      onOpenMobileNav?: () => void;
    };

export const WaterProfileForm: React.FC<WaterProfileFormProps> = (props) => {
  const isEdit = props.mode === 'edit';
  const initial = props.initialProfile;

  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<WaterProfileType>(initial?.type ?? 'source');
  const [calcium, setCalcium] = useState(initial ? String(initial.calcium) : '0');
  const [magnesium, setMagnesium] = useState(initial ? String(initial.magnesium) : '0');
  const [sodium, setSodium] = useState(initial ? String(initial.sodium) : '0');
  const [chloride, setChloride] = useState(initial ? String(initial.chloride) : '0');
  const [sulfate, setSulfate] = useState(initial ? String(initial.sulfate) : '0');
  const [bicarbonate, setBicarbonate] = useState(initial ? String(initial.bicarbonate) : '0');
  const [ph, setPh] = useState(initial?.ph !== null && initial?.ph !== undefined ? String(initial.ph) : '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [balanceStrategy, setBalanceStrategy] = useState<BalanceStrategy>('Balanced');

  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const deleteAction = isEdit ? props.deleteAction : undefined;
  const prevDeleteBusy = useRef(deleteAction?.busy ?? false);

  useEffect(() => {
    if (prevDeleteBusy.current && !deleteAction?.busy && deleteAction?.error) {
      setConfirmDeleteOpen(false);
    }
    prevDeleteBusy.current = deleteAction?.busy ?? false;
  }, [deleteAction?.busy, deleteAction?.error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    const parsedCa = parseFloat(calcium);
    const parsedMg = parseFloat(magnesium);
    const parsedNa = parseFloat(sodium);
    const parsedCl = parseFloat(chloride);
    const parsedSo4 = parseFloat(sulfate);
    const parsedHco3 = parseFloat(bicarbonate);
    const parsedPh = ph.trim() === '' ? null : parseFloat(ph);

    if (!name.trim()) {
      setSaveError('Name is required');
      return;
    }

    if (
      isNaN(parsedCa) || parsedCa < 0 ||
      isNaN(parsedMg) || parsedMg < 0 ||
      isNaN(parsedNa) || parsedNa < 0 ||
      isNaN(parsedCl) || parsedCl < 0 ||
      isNaN(parsedSo4) || parsedSo4 < 0 ||
      isNaN(parsedHco3) || parsedHco3 < 0
    ) {
      setSaveError('All ion concentrations must be non-negative numbers');
      return;
    }

    if (parsedPh !== null && (isNaN(parsedPh) || parsedPh < 0 || parsedPh > 14)) {
      setSaveError('pH must be between 0 and 14');
      return;
    }

    const payload: WaterProfileInput = {
      name: name.trim(),
      type,
      calcium: parsedCa,
      magnesium: parsedMg,
      sodium: parsedNa,
      chloride: parsedCl,
      sulfate: parsedSo4,
      bicarbonate: parsedHco3,
      ph: parsedPh,
      description: description.trim() || null,
    };

    setBusy(true);
    try {
      if (isEdit && initial) {
        const updated = await updateWaterProfile(initial.id, payload);
        props.onSaved(updated);
      } else {
        const created = await createWaterProfile(payload);
        props.onSaved(created);
      }
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Failed to save water profile.';
      setSaveError(message);
    } finally {
      setBusy(false);
    }
  };

  // M37_P2 Amendment 2 (FEAT-044): a transient authoring aid — applying a
  // balance strategy computes the target Cl/SO4 preset into the form's ion
  // fields. Only the resulting ion values are persisted; the strategy itself
  // is not stored on the profile (no schema change).
  const handleApplyBalanceStrategy = () => {
    const result = applyBalanceStrategy(
      {
        calcium: parseFloat(calcium) || 0,
        magnesium: parseFloat(magnesium) || 0,
        sodium: parseFloat(sodium) || 0,
        chloride: parseFloat(chloride) || 0,
        sulfate: parseFloat(sulfate) || 0,
        bicarbonate: parseFloat(bicarbonate) || 0,
      },
      balanceStrategy,
    );
    setChloride(String(result.chloride));
    setSulfate(String(result.sulfate));
  };

  const titleText = isEdit && initial ? `Edit ${initial.name}` : 'New Water Profile';

  return (
    <>
      <TopBar
        title={titleText}
        onOpenMobileNav={props.onOpenMobileNav}
        leading={
          <button
            type="button"
            onClick={props.onCancel}
            disabled={busy}
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
            data-testid="water-delete"
            onClick={() => setConfirmDeleteOpen(true)}
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
          onClick={props.onCancel}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form={FORM_ID}
          size="sm"
          disabled={busy}
          className="flex items-center gap-2"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {busy ? 'Saving…' : 'Save Profile'}
        </Button>
      </TopBar>
      <PageContainer>
        <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-6">
          {saveError && (
            <div className="bg-rose-950/60 border border-rose-800 rounded-lg p-4 flex items-start gap-3 text-sm text-rose-200">
              <AlertTriangle className="w-5 h-5 text-rose-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-semibold text-rose-300">Couldn't save water profile</div>
                <div>{saveError}</div>
              </div>
            </div>
          )}

          <SectionCard
            id="water-profile-information"
            title="Profile Information"
            headingLevel={2}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FormField label="Profile Name *" htmlFor="water-form-name">
                    <Input
                      id="water-form-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Balanced Tap Water"
                      data-testid="water-form-name"
                    />
                  </FormField>
                </div>

                <div>
                  <FormField label="Profile Type *" htmlFor="water-form-type">
                    <Select
                      id="water-form-type"
                      value={type}
                      onChange={(e) => setType(e.target.value as WaterProfileType)}
                      data-testid="water-form-type"
                    >
                      <option value="source">Source Water (Tap, Well, RO)</option>
                      <option value="target">Target Profile (Style Target)</option>
                    </Select>
                  </FormField>
                </div>
              </div>

              <div>
                <FormField label="Description" htmlFor="water-form-description">
                  <textarea
                    id="water-form-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional notes about this water profile..."
                    rows={2}
                    className={`${INPUT_CLASS} text-xs`}
                  />
                </FormField>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="water-ion-concentrations"
            title="Ion Concentrations & pH"
            headingLevel={2}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <FormField
                    label="Calcium (Ca²⁺) ppm *"
                    htmlFor="water-form-ca"
                    hint="Calcium supports yeast health and mash enzyme activity — typical target 40–120 ppm."
                  >
                    <NumberInput
                      id="water-form-ca"
                      type="number"
                      step="any"
                      min="0"
                      value={calcium}
                      onChange={(e) => setCalcium(e.target.value)}
                      data-testid="water-form-ca"
                    />
                  </FormField>
                </div>
                <div>
                  <FormField label="Magnesium (Mg²⁺) ppm *" htmlFor="water-form-mg">
                    <NumberInput
                      id="water-form-mg"
                      type="number"
                      step="any"
                      min="0"
                      value={magnesium}
                      onChange={(e) => setMagnesium(e.target.value)}
                      data-testid="water-form-mg"
                    />
                  </FormField>
                </div>
                <div>
                  <FormField label="Sodium (Na⁺) ppm *" htmlFor="water-form-na">
                    <NumberInput
                      id="water-form-na"
                      type="number"
                      step="any"
                      min="0"
                      value={sodium}
                      onChange={(e) => setSodium(e.target.value)}
                      data-testid="water-form-na"
                    />
                  </FormField>
                </div>
                <div>
                  <FormField
                    label="Chloride (Cl⁻) ppm *"
                    htmlFor="water-form-cl"
                    hint="Chloride rounds the body and enhances malt sweetness; a higher Cl:SO₄ ratio softens hop bite."
                  >
                    <NumberInput
                      id="water-form-cl"
                      type="number"
                      step="any"
                      min="0"
                      value={chloride}
                      onChange={(e) => setChloride(e.target.value)}
                      data-testid="water-form-cl"
                    />
                  </FormField>
                </div>
                <div>
                  <FormField
                    label="Sulfate (SO₄²⁻) ppm *"
                    htmlFor="water-form-so4"
                    hint="Sulfate dries the finish and accentuates hop bitterness; a higher SO₄:Cl ratio sharpens hops."
                  >
                    <NumberInput
                      id="water-form-so4"
                      type="number"
                      step="any"
                      min="0"
                      value={sulfate}
                      onChange={(e) => setSulfate(e.target.value)}
                      data-testid="water-form-so4"
                    />
                  </FormField>
                </div>
                <div>
                  <FormField label="Bicarbonate (HCO₃⁻) ppm *" htmlFor="water-form-hco3">
                    <NumberInput
                      id="water-form-hco3"
                      type="number"
                      step="any"
                      min="0"
                      value={bicarbonate}
                      onChange={(e) => setBicarbonate(e.target.value)}
                      data-testid="water-form-hco3"
                    />
                  </FormField>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex flex-wrap items-end gap-3">
                <div className="min-w-0 max-w-sm flex-1">
                  <FormField label="Balance Strategy (flavor target)" htmlFor="water-form-strategy">
                    <Select
                      id="water-form-strategy"
                      value={balanceStrategy}
                      onChange={(e) => setBalanceStrategy(e.target.value as BalanceStrategy)}
                      data-testid="water-form-strategy"
                    >
                      <option value="Balanced">Balanced (SO₄:Cl ≈ 1:1)</option>
                      <option value="Crisp Hop-Forward">Crisp Hop-Forward (SO₄:Cl ≈ 2:1)</option>
                      <option value="Malty/Full">Malty/Full (Cl:SO₄ ≈ 2:1)</option>
                    </Select>
                  </FormField>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleApplyBalanceStrategy}
                  data-testid="water-form-apply-strategy"
                >
                  Apply to Ion Targets
                </Button>
              </div>

              <div className="pt-2 border-t border-slate-800 max-w-xs">
                <FormField
                  label="pH (Optional)"
                  htmlFor="water-form-ph"
                  hint="Leave blank to inherit; for a balanced mash aim near pH 5.2–5.6."
                >
                  <NumberInput
                    id="water-form-ph"
                    type="number"
                    step="0.1"
                    min="0"
                    max="14"
                    value={ph}
                    onChange={(e) => setPh(e.target.value)}
                    placeholder="e.g. 7.4"
                    data-testid="water-form-ph"
                  />
                </FormField>
              </div>
            </div>
          </SectionCard>
        </form>
      </PageContainer>

      {isEdit && initial && deleteAction && (
        <ConfirmDialog
          open={confirmDeleteOpen}
          title={`Delete "${initial.name}"?`}
          message="Are you sure you want to delete this water profile? This action cannot be undone."
          confirmLabel="Delete Water Profile"
          busy={deleteAction.busy}
          onConfirm={() => deleteAction.onConfirm()}
          onCancel={() => setConfirmDeleteOpen(false)}
        />
      )}
    </>
  );
};
