import React, { useEffect, useRef, useState } from 'react';
import type { EquipmentProfile, EquipmentUpdateInput } from '@truchabrew/shared-types';
import {
  calculateBoilingPoint,
  calculateStrikeTemperature,
} from '@truchabrew/calculations';
import { createEquipmentProfile, updateEquipmentProfile, ApiClientError } from '../api/client';
import { ArrowLeft, Save, Loader2, AlertTriangle, Trash2, Mountain, Flame, Gauge } from 'lucide-react';
import { TopBar } from './TopBar';
import { PageContainer } from './PageContainer';
import { ConfirmDialog } from './ConfirmDialog';
import { FormField, Input, NumberInput, Button, SectionCard } from './ui';
import {
  INPUT_CLASS,
  METADATA_TEXT_CLASS,
} from './designSystem';


const FORM_ID = 'equipment-profile-form';

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

type EquipmentFormProps =
  | { mode: 'create'; initialProfile?: undefined; onSaved: (profile: EquipmentProfile) => void; onCancel: () => void; onOpenMobileNav?: () => void }
  | {
      mode: 'edit';
      initialProfile: EquipmentProfile;
      onSaved: (profile: EquipmentProfile) => void;
      onCancel: () => void;
      deleteAction: DeleteAction;
      onOpenMobileNav?: () => void;
    };

type NumericFieldKey =
  | 'batchSizeL'
  | 'boilTimeMin'
  | 'brewhouseEfficiencyPct'
  | 'mashEfficiencyPct'
  | 'boilOffRateLPerHour'
  | 'trubChillerLossL'
  | 'hopUtilizationPct'
  | 'mashWaterRatioLPerKg'
  | 'grainAbsorptionLPerKg'
  | 'hopstandUtilizationFactor'
  | 'hopstandTemperatureC'
  | 'spargeTemperatureC'
  | 'mashTunHeatCapacityL'
  | 'grainTemperatureC'
  | 'altitudeMeters'
  | 'mashTunDeadSpaceL'
  | 'kettleLossL'
  | 'mashTunWeightKg'
  | 'mashTunHeatCapacity';

interface NumericFieldSpec {
  key: NumericFieldKey;
  label: string;
  unit: string;
  min: number | null;
  exclusiveMin?: boolean;
  max: number | null;
  step: string;
  hint?: string;
}

const NUMERIC_FIELDS: NumericFieldSpec[] = [
  { key: 'batchSizeL', label: 'Batch Size', unit: 'L', min: 0, exclusiveMin: true, max: null, step: '0.1', hint: 'Volume of beer you plan to package; drives the whole water & gravity pipeline.' },
  { key: 'boilTimeMin', label: 'Boil Time', unit: 'min', min: 0, max: 600, step: '1', hint: 'Standard 60 min; longer drives more bitterness and boil-off.' },
  { key: 'brewhouseEfficiencyPct', label: 'Brewhouse Efficiency', unit: '%', min: 0, exclusiveMin: true, max: 100, step: '0.1', hint: 'Share of extract you actually get into the fermenter (65–80 typical).' },
  { key: 'mashEfficiencyPct', label: 'Mash Efficiency', unit: '%', min: 0, exclusiveMin: true, max: 100, step: '0.1' },
  { key: 'boilOffRateLPerHour', label: 'Boil-Off Rate', unit: 'L/hr', min: null, max: null, step: '0.1', hint: 'Volume lost to steam per hour (typical 8–12% of pre-boil per 60 min).' },
  { key: 'trubChillerLossL', label: 'Trub / Chiller Loss', unit: 'L', min: null, max: null, step: '0.1', hint: 'Volume left behind with trub/hops after chilling.' },
  { key: 'hopUtilizationPct', label: 'Hop Utilisation', unit: '%', min: 0, max: 200, step: '1', hint: '100 = textbook Tinseth' },
  { key: 'mashWaterRatioLPerKg', label: 'Mash Water Ratio', unit: 'L/kg', min: 0, exclusiveMin: true, max: 10, step: '0.01' },
  { key: 'grainAbsorptionLPerKg', label: 'Grain Absorption', unit: 'L/kg', min: 0, max: 5, step: '0.01', hint: 'Water retained by spent grain after mashing (0.85–1.0 L/kg).' },
  {
    key: 'hopstandUtilizationFactor',
    label: 'Hopstand Utilisation Factor',
    unit: '',
    min: 0,
    max: 1,
    step: '0.01',
    hint: 'Applied to Aroma / Whirlpool additions only',
  },
  {
    key: 'hopstandTemperatureC',
    label: 'Hopstand Temperature',
    unit: '°C',
    min: 0,
    max: 100,
    step: '1',
    hint: 'Recorded brew-day paperwork',
  },
  { key: 'spargeTemperatureC', label: 'Sparge Temperature', unit: '°C', min: 0, max: 100, step: '1', hint: 'Keep near mash-out to avoid tannin extraction (75–78°C).' },
  {
    key: 'mashTunHeatCapacityL',
    label: 'Mash Tun Heat Capacity',
    unit: 'L water-equiv.',
    min: 0,
    max: 50,
    step: '0.1',
    hint: 'Raises strike temperature to compensate for a cold mash tun',
  },
  {
    key: 'grainTemperatureC',
    label: 'Grain Temperature',
    unit: '°C',
    min: -20,
    max: 50,
    step: '1',
    hint: 'Colder grain raises the strike temperature needed to hit your mash rest',
  },
  {
    key: 'altitudeMeters',
    label: 'Altitude',
    unit: 'm',
    min: -500,
    max: 9000,
    step: '10',
    hint: 'Elevation lowers the boil point and scales hop utilization (see live panel).',
  },
  {
    key: 'mashTunDeadSpaceL',
    label: 'Mash Tun Dead Space',
    unit: 'L',
    min: 0,
    max: 500,
    step: '0.1',
    hint: 'Unrecoverable liquid under false bottom added to mash water requirement',
  },
  {
    key: 'kettleLossL',
    label: 'Kettle Loss',
    unit: 'L',
    min: 0,
    max: 500,
    step: '0.1',
    hint: 'Residual liquid in kettle & hoses post-knockout',
  },
  {
    key: 'mashTunWeightKg',
    label: 'Mash Tun Vessel Weight',
    unit: 'kg',
    min: 0,
    max: 500,
    step: '0.5',
    hint: 'Dry metal weight of the mash tun for thermal mass strike calculation',
  },
  {
    key: 'mashTunHeatCapacity',
    label: 'Mash Tun Specific Heat (c_t)',
    unit: 'cal/g·°C',
    min: 0,
    max: 5,
    step: '0.01',
    hint: '0.12 for stainless steel, 0.22 for aluminium',
  },
];

const DEFAULT_NEW_PROFILE: EquipmentUpdateInput = {
  name: '',
  batchSizeL: 20,
  boilTimeMin: 60,
  brewhouseEfficiencyPct: 75,
  mashEfficiencyPct: 80,
  boilOffRateLPerHour: 3.5,
  trubChillerLossL: 2.0,
  hopUtilizationPct: 87,
  mashWaterRatioLPerKg: 3.0,
  grainAbsorptionLPerKg: 0.96,
  hopstandUtilizationFactor: 0.26,
  hopstandTemperatureC: 79.0,
  spargeTemperatureC: 76.0,
  mashTunHeatCapacityL: 0.0,
  grainTemperatureC: 20.0,
  notes: '',
  altitudeMeters: 0,
  calcStrikeWithThermalMass: false,
  mashTunDeadSpaceL: 0.0,
  kettleLossL: 0.0,
  mashTunWeightKg: 0.0,
  mashTunHeatCapacity: 0.12,
};

type RawValues = Record<NumericFieldKey, string> & {
  name: string;
  notes: string;
  calcStrikeWithThermalMass: boolean;
};

function toRawValues(profile: EquipmentUpdateInput): RawValues {
  return {
    name: profile.name,
    batchSizeL: String(profile.batchSizeL),
    boilTimeMin: String(profile.boilTimeMin),
    brewhouseEfficiencyPct: String(profile.brewhouseEfficiencyPct),
    mashEfficiencyPct: String(profile.mashEfficiencyPct),
    boilOffRateLPerHour: String(profile.boilOffRateLPerHour),
    trubChillerLossL: String(profile.trubChillerLossL),
    hopUtilizationPct: String(profile.hopUtilizationPct),
    mashWaterRatioLPerKg: String(profile.mashWaterRatioLPerKg),
    grainAbsorptionLPerKg: String(profile.grainAbsorptionLPerKg),
    hopstandUtilizationFactor: String(profile.hopstandUtilizationFactor),
    hopstandTemperatureC: String(profile.hopstandTemperatureC),
    spargeTemperatureC: String(profile.spargeTemperatureC),
    mashTunHeatCapacityL: String(profile.mashTunHeatCapacityL),
    grainTemperatureC: String(profile.grainTemperatureC),
    notes: profile.notes,
    altitudeMeters: String(profile.altitudeMeters ?? 0),
    calcStrikeWithThermalMass: Boolean(profile.calcStrikeWithThermalMass),
    mashTunDeadSpaceL: String(profile.mashTunDeadSpaceL ?? 0),
    kettleLossL: String(profile.kettleLossL ?? 0),
    mashTunWeightKg: String(profile.mashTunWeightKg ?? 0),
    mashTunHeatCapacity: String(profile.mashTunHeatCapacity ?? 0.12),
  };
}

function validateName(name: string): string | null {
  return name.trim().length < 1 ? 'Name is required' : null;
}

function validateNumericField(spec: NumericFieldSpec, value: number): string | null {
  if (Number.isNaN(value)) return 'Required';
  if (spec.min !== null) {
    if (spec.exclusiveMin ? value <= spec.min : value < spec.min) {
      return spec.exclusiveMin ? `Must be greater than ${spec.min}` : `Must be ${spec.min} or greater`;
    }
  }
  if (spec.max !== null && value > spec.max) {
    return `Must be ${spec.max} or less`;
  }
  return null;
}

export const EquipmentForm: React.FC<EquipmentFormProps> = (props) => {
  const { mode, initialProfile, onSaved, onCancel, onOpenMobileNav } = props;
  const deleteAction = mode === 'edit' ? props.deleteAction : undefined;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const prevDeleteBusy = useRef(false);

  useEffect(() => {
    if (deleteAction && prevDeleteBusy.current && !deleteAction.busy && deleteAction.error !== null) {
      setConfirmOpen(false);
    }
    if (deleteAction) prevDeleteBusy.current = deleteAction.busy;
  }, [deleteAction, deleteAction?.busy, deleteAction?.error]);

  const seed: EquipmentUpdateInput = initialProfile
    ? {
        name: initialProfile.name,
        batchSizeL: initialProfile.batchSizeL,
        boilTimeMin: initialProfile.boilTimeMin,
        brewhouseEfficiencyPct: initialProfile.brewhouseEfficiencyPct,
        mashEfficiencyPct: initialProfile.mashEfficiencyPct,
        boilOffRateLPerHour: initialProfile.boilOffRateLPerHour,
        trubChillerLossL: initialProfile.trubChillerLossL,
        hopUtilizationPct: initialProfile.hopUtilizationPct,
        mashWaterRatioLPerKg: initialProfile.mashWaterRatioLPerKg,
        grainAbsorptionLPerKg: initialProfile.grainAbsorptionLPerKg,
        hopstandUtilizationFactor: initialProfile.hopstandUtilizationFactor,
        hopstandTemperatureC: initialProfile.hopstandTemperatureC,
        spargeTemperatureC: initialProfile.spargeTemperatureC,
        mashTunHeatCapacityL: initialProfile.mashTunHeatCapacityL,
        grainTemperatureC: initialProfile.grainTemperatureC,
        notes: initialProfile.notes,
        altitudeMeters: initialProfile.altitudeMeters ?? 0,
        calcStrikeWithThermalMass: initialProfile.calcStrikeWithThermalMass ?? false,
        mashTunDeadSpaceL: initialProfile.mashTunDeadSpaceL ?? 0,
        kettleLossL: initialProfile.kettleLossL ?? 0,
        mashTunWeightKg: initialProfile.mashTunWeightKg ?? 0,
        mashTunHeatCapacity: initialProfile.mashTunHeatCapacity ?? 0.12,
      }
    : DEFAULT_NEW_PROFILE;

  const [raw, setRaw] = useState<RawValues>(() => toRawValues(seed));
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  const setField = (key: keyof RawValues, value: string | boolean) =>
    setRaw((prev) => ({ ...prev, [key]: value }));

  const nameError = validateName(raw.name);
  const fieldErrors: Partial<Record<NumericFieldKey, string | null>> = {};
  for (const spec of NUMERIC_FIELDS) {
    fieldErrors[spec.key] = validateNumericField(spec, parseFloat(raw[spec.key]));
  }
  const hasErrors = !!nameError || Object.values(fieldErrors).some((e) => !!e);

  // Live atmospheric physics preview
  const altitude = parseFloat(raw.altitudeMeters) || 0;
  const boilingPoint = calculateBoilingPoint(altitude);
  const hopFactor = Math.max(0.5, 1.0 - 0.008 * (100.0 - boilingPoint));

  // Live thermal mass strike temperature preview (5 kg grain, 15 L strike water, 67°C rest)
  const sampleGrainKg = 5.0;
  const sampleTargetTempC = 67.0;
  const sampleGrainTempC = parseFloat(raw.grainTemperatureC) || 20.0;
  const sampleWaterRatio = parseFloat(raw.mashWaterRatioLPerKg) || 3.0;
  const sampleDeadSpace = parseFloat(raw.mashTunDeadSpaceL) || 0;
  const sampleStrikeWaterL = sampleGrainKg * sampleWaterRatio + sampleDeadSpace;
  const sampleTunWeightKg = parseFloat(raw.mashTunWeightKg) || 0;
  const sampleTunHeatCap = parseFloat(raw.mashTunHeatCapacity) || 0.12;
  const sampleLegacyCapL = parseFloat(raw.mashTunHeatCapacityL) || 0;

  const liveStrikeResult = calculateStrikeTemperature({
    targetMashTempC: sampleTargetTempC,
    grainTemperatureC: sampleGrainTempC,
    waterVolumeL: sampleStrikeWaterL,
    grainWeightKg: sampleGrainKg,
    mashTunHeatCapacityL: sampleLegacyCapL,
    calcStrikeWithThermalMass: raw.calcStrikeWithThermalMass,
    mashTunWeightKg: sampleTunWeightKg,
    mashTunHeatCapacity: sampleTunHeatCap,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasErrors || saveState === 'saving') return;

    const payload: EquipmentUpdateInput = {
      name: raw.name,
      batchSizeL: parseFloat(raw.batchSizeL),
      boilTimeMin: parseFloat(raw.boilTimeMin),
      brewhouseEfficiencyPct: parseFloat(raw.brewhouseEfficiencyPct),
      mashEfficiencyPct: parseFloat(raw.mashEfficiencyPct),
      boilOffRateLPerHour: parseFloat(raw.boilOffRateLPerHour),
      trubChillerLossL: parseFloat(raw.trubChillerLossL),
      hopUtilizationPct: parseFloat(raw.hopUtilizationPct),
      mashWaterRatioLPerKg: parseFloat(raw.mashWaterRatioLPerKg),
      grainAbsorptionLPerKg: parseFloat(raw.grainAbsorptionLPerKg),
      hopstandUtilizationFactor: parseFloat(raw.hopstandUtilizationFactor),
      hopstandTemperatureC: parseFloat(raw.hopstandTemperatureC),
      spargeTemperatureC: parseFloat(raw.spargeTemperatureC),
      mashTunHeatCapacityL: parseFloat(raw.mashTunHeatCapacityL),
      grainTemperatureC: parseFloat(raw.grainTemperatureC),
      notes: raw.notes,
      altitudeMeters: parseFloat(raw.altitudeMeters) || 0,
      calcStrikeWithThermalMass: raw.calcStrikeWithThermalMass,
      mashTunDeadSpaceL: parseFloat(raw.mashTunDeadSpaceL) || 0,
      kettleLossL: parseFloat(raw.kettleLossL) || 0,
      mashTunWeightKg: parseFloat(raw.mashTunWeightKg) || 0,
      mashTunHeatCapacity: parseFloat(raw.mashTunHeatCapacity) || 0.12,
    };

    setSaveState('saving');
    setSaveError(null);
    try {
      const result =
        mode === 'create'
          ? await createEquipmentProfile({ ...payload, derivedFromEquipmentId: null })
          : await updateEquipmentProfile(initialProfile.id, payload);
      setSaveState('idle');
      onSaved(result);
    } catch (err) {
      setSaveState('error');
      setSaveError(err instanceof ApiClientError ? err.message : 'Failed to save equipment profile.');
    }
  };

  const renderField = (key: NumericFieldKey) => {
    const spec = NUMERIC_FIELDS.find((s) => s.key === key);
    if (!spec) return null;
    const label = `${spec.label}${spec.unit ? ` (${spec.unit})` : ''}`;
    return (
      <FormField
        key={spec.key}
        label={label}
        htmlFor={`equipment-field-${spec.key}`}
        hint={!fieldErrors[spec.key] ? spec.hint : undefined}
        error={fieldErrors[spec.key] ? `${spec.label}: ${fieldErrors[spec.key]}` : undefined}
      >
        <NumberInput
          id={`equipment-field-${spec.key}`}
          data-testid={`equipment-field-${spec.key}`}
          type="number"
          step={spec.step}
          value={raw[spec.key]}
          onChange={(e) => setField(spec.key, e.target.value)}
        />
      </FormField>
    );
  };

  return (
    <>
      <TopBar
        title={mode === 'create' ? 'New Equipment Profile' : `Edit ${initialProfile.name}`}
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
            data-testid="equipment-delete"
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
        <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-6">
          {/* General */}
          <SectionCard id="equipment-general" title="General" headingLevel={4}>
            <FormField
              label="Profile Name"
              htmlFor="equipment-field-name"
              error={nameError || undefined}
              className="mb-4"
            >
              <Input
                id="equipment-field-name"
                data-testid="equipment-field-name"
                type="text"
                value={raw.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="e.g. All-Grain 20L System"
              />
            </FormField>


            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {renderField('batchSizeL')}
              {renderField('boilTimeMin')}
              {renderField('brewhouseEfficiencyPct')}
              {renderField('mashEfficiencyPct')}
              {renderField('boilOffRateLPerHour')}
              {renderField('trubChillerLossL')}
              {renderField('hopUtilizationPct')}
            </div>
          </SectionCard>

          {/* Altitude & Atmospheric Physics */}
          <SectionCard
            id="equipment-altitude"
            title="Altitude & Atmospheric Physics"
            headingLevel={4}
            icon={<Mountain className="w-4 h-4 text-sky-400" />}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
              {renderField('altitudeMeters')}
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs" data-testid="altitude-physics-preview">
                <div className="text-slate-400 font-medium mb-1">Atmospheric Derivations:</div>
                <div className="text-sky-300 font-semibold mb-0.5">
                  Boiling Point: {boilingPoint.toFixed(1)}°C
                </div>
                <div className="text-amber-300/90 font-medium">
                  Hop Utilization Factor: ({Math.round(hopFactor * 100)}%)
                </div>
                <div className={`${METADATA_TEXT_CLASS} mt-1`}>
                  At higher elevations, water boils below 100°C, reducing isomerisation efficiency.
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Thermal Mass & Mash Physics */}
          <SectionCard
            id="equipment-thermal-mass"
            title="Thermal Mass & Mash Strike Energy Balance"
            headingLevel={4}
            icon={<Flame className="w-4 h-4 text-amber-500" />}
            badge={
              <label htmlFor="equipment-calc-strike-thermal-mass" className="flex items-center gap-2 text-xs font-semibold text-amber-400 cursor-pointer">
                <input
                  type="checkbox"
                  id="equipment-calc-strike-thermal-mass"
                  data-testid="equipment-field-calcStrikeWithThermalMass"
                  checked={raw.calcStrikeWithThermalMass}
                  onChange={(e) => setField('calcStrikeWithThermalMass', e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-amber-400 focus:ring-offset-slate-900"
                />
                Calculate Strike with Vessel Thermal Mass
              </label>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {renderField('mashWaterRatioLPerKg')}
              {renderField('grainAbsorptionLPerKg')}
              {renderField('grainTemperatureC')}
              {renderField('spargeTemperatureC')}
              {raw.calcStrikeWithThermalMass ? (
                <>
                  {renderField('mashTunWeightKg')}
                  {renderField('mashTunHeatCapacity')}
                </>
              ) : (
                renderField('mashTunHeatCapacityL')
              )}
            </div>

            {/* Live Strike Preview & Enzyme Limit Warning Banner */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs" data-testid="strike-temp-live-preview">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">
                  Sample Strike Temp (5kg grain @ {sampleGrainTempC}°C into {sampleTargetTempC}°C rest):
                </span>
                <span className="font-extrabold text-amber-400 text-sm font-mono tabular-nums" data-testid="strike-temp-preview-value">
                  {liveStrikeResult.strikeTemperatureC.toFixed(1)}°C
                </span>
              </div>
              {liveStrikeResult.strikeTempExceedsEnzymeLimit && (
                <div
                  className="bg-amber-950/50 border border-amber-800 rounded-lg p-2.5 mt-2 flex items-start gap-2 text-amber-300"
                  data-testid="equipment-strike-enzyme-warning"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Warning:</strong> Calculated strike temperature (
                    {liveStrikeResult.strikeTemperatureC.toFixed(1)}°C) exceeds 78.0°C — risk of denaturing starch conversion enzymes during dough-in.
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Losses & Dead Space */}
          <SectionCard
            id="equipment-losses"
            title="Vessel Losses & Dead Space"
            headingLevel={4}
            icon={<Gauge className="w-4 h-4 text-emerald-400" />}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {renderField('mashTunDeadSpaceL')}
              {renderField('kettleLossL')}
            </div>
          </SectionCard>

          {/* Hopstand & Whirlpool Schedule */}
          <SectionCard id="equipment-hopstand" title="Hopstand & Whirlpool Parameters" headingLevel={4}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {renderField('hopstandUtilizationFactor')}
              {renderField('hopstandTemperatureC')}
            </div>
          </SectionCard>

          {/* Notes */}
          <SectionCard id="equipment-notes" title="Notes" headingLevel={4}>
            <FormField label="Notes" htmlFor="equipment-field-notes">
              <textarea
                id="equipment-field-notes"
                data-testid="equipment-field-notes"
                value={raw.notes}
                onChange={(e) => setField('notes', e.target.value)}
                rows={2}
                className={`${INPUT_CLASS} text-sm`}
                placeholder="Optional brew-day notes about this kit"
              />
            </FormField>
          </SectionCard>


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
