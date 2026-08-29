import { useState } from 'react';
import { strikeTemperatureC, strikeTempExceedsEnzymeLimit, formatTemperature } from '@truchabrew/calculations';
import { useConfig } from '../../context/ConfigContext';
import { CalculatorCard, NumericField, ResultRow } from './CalculatorCard';
import { AlertTriangle } from 'lucide-react';

/**
 * StrikeWaterCalculator (M11_P2 FEAT-006 / AC-15):
 * Updated with vessel thermal mass energy balance toggle and enzyme denaturing safety alert.
 */
export function StrikeWaterCalculator() {
  const { config } = useConfig();
  const [targetMashTempC, setTargetMashTempC] = useState('67');
  const [grainTemperatureC, setGrainTemperatureC] = useState('20');
  const [waterVolumeL, setWaterVolumeL] = useState('15');
  const [grainWeightKg, setGrainWeightKg] = useState('5');
  const [mashTunHeatCapacityL, setMashTunHeatCapacityL] = useState('1.5');
  const [calcStrikeWithThermalMass, setCalcStrikeWithThermalMass] = useState(false);
  const [mashTunWeightKg, setMashTunWeightKg] = useState('10');
  const [mashTunHeatCapacity, setMashTunHeatCapacity] = useState('0.12');

  const targetMashTempCNum = Number.parseFloat(targetMashTempC);
  const grainTemperatureCNum = Number.parseFloat(grainTemperatureC);
  const waterVolumeLNum = Number.parseFloat(waterVolumeL);
  const grainWeightKgNum = Number.parseFloat(grainWeightKg);
  const mashTunHeatCapacityLNum = Number.parseFloat(mashTunHeatCapacityL);
  const mashTunWeightKgNum = Number.parseFloat(mashTunWeightKg);
  const mashTunHeatCapacityNum = Number.parseFloat(mashTunHeatCapacity);

  const isDegenerate =
    targetMashTempC.trim() === '' ||
    Number.isNaN(targetMashTempCNum) ||
    grainTemperatureC.trim() === '' ||
    Number.isNaN(grainTemperatureCNum) ||
    waterVolumeL.trim() === '' ||
    Number.isNaN(waterVolumeLNum) ||
    grainWeightKg.trim() === '' ||
    Number.isNaN(grainWeightKgNum) ||
    (!calcStrikeWithThermalMass &&
      (mashTunHeatCapacityL.trim() === '' || Number.isNaN(mashTunHeatCapacityLNum))) ||
    (calcStrikeWithThermalMass &&
      (mashTunWeightKg.trim() === '' ||
        Number.isNaN(mashTunWeightKgNum) ||
        mashTunHeatCapacity.trim() === '' ||
        Number.isNaN(mashTunHeatCapacityNum)));

  const result = isDegenerate
    ? null
    : strikeTemperatureC({
        targetMashTempC: targetMashTempCNum,
        grainTemperatureC: grainTemperatureCNum,
        waterVolumeL: waterVolumeLNum,
        grainWeightKg: grainWeightKgNum,
        calcStrikeWithThermalMass,
        mashTunHeatCapacityL: mashTunHeatCapacityLNum,
        mashTunWeightKg: mashTunWeightKgNum,
        mashTunHeatCapacity: mashTunHeatCapacityNum,
      });

  const exceedsLimit = result !== null && strikeTempExceedsEnzymeLimit(result);

  return (
    <CalculatorCard
      title="Strike Water Temperature"
      description="Calculates the temperature your strike (mash-in) water must be to bring the grain bed up to your target mash temperature, including the thermal mass of your mash tun if enabled."
      formula="Strike temp balances the heat the water gives up against the heat the grain (and optional vessel) absorbs to reach the target mash temperature."
    >
      <NumericField label="Target mash temperature (°C)" value={targetMashTempC} onChange={setTargetMashTempC} />
      <NumericField label="Grain temperature (°C)" value={grainTemperatureC} onChange={setGrainTemperatureC} />
      <NumericField label="Water volume (L)" value={waterVolumeL} onChange={setWaterVolumeL} />
      <NumericField label="Grain weight (kg)" value={grainWeightKg} onChange={setGrainWeightKg} />

      <label className="flex items-center gap-2 py-2 text-xs font-semibold text-amber-400 cursor-pointer">
        <input
          id="strike-calc-thermal-mass-toggle"
          type="checkbox"
          checked={calcStrikeWithThermalMass}
          onChange={(e) => setCalcStrikeWithThermalMass(e.target.checked)}
          className="w-4 h-4 accent-amber-500 cursor-pointer"
        />
        {'Calculate with vessel thermal mass (ratio)'}
      </label>

      {calcStrikeWithThermalMass ? (
        <>
          <NumericField label="Mash tun weight (kg)" value={mashTunWeightKg} onChange={setMashTunWeightKg} />
          <NumericField
            label="Mash tun specific heat (ratio)"
            value={mashTunHeatCapacity}
            onChange={setMashTunHeatCapacity}
          />
        </>
      ) : (
        <NumericField
          label="Mash tun heat capacity (L)"
          value={mashTunHeatCapacityL}
          onChange={setMashTunHeatCapacityL}
        />
      )}

      <ResultRow
        label="Strike water temperature"
        value={result === null ? '—' : formatTemperature(result, config.temperatureUnit)}
      />

      {exceedsLimit && (
        <div
          className="bg-amber-950/50 border border-amber-800/80 rounded-lg p-3 text-xs text-amber-300 flex items-start gap-2 mt-2"
          data-testid="strike-temp-enzyme-warning"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <strong>{'Enzyme Safety Warning:'}</strong>
            {' Calculated strike temperature ('}
            {formatTemperature(result, config.temperatureUnit)}
            {') exceeds 78.0°C — risk of denaturing starch conversion enzymes during dough-in.'}
          </div>
        </div>
      )}
    </CalculatorCard>
  );
}
