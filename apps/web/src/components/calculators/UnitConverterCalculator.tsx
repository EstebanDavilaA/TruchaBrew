import { useState } from 'react';
import {
  sgToBrix,
  srmToEbc,
  srmToLovibond,
  psiToKpa,
  psiToBar,
  formatGravity,
  formatVolume,
  formatMass,
  formatHopMass,
  formatTemperature,
} from '@truchabrew/calculations';
import { CalculatorCard, NumericField, ResultRow } from './CalculatorCard';

/**
 * One card, six rows (§2.2). Each row's canonical input feeds N read-only
 * converted outputs. No calculator state is lifted to Calculators.tsx — this
 * component owns its own six field values. Plato/volume/mass/temperature
 * outputs go through the approved M7 format* helpers (which call
 * sgToPlato/convertVolume/convertMass/convertHopMass/celsiusToFahrenheit
 * internally); Brix and pressure have no M7 helper and render via the raw
 * ResultRow number path (§2.5). The only arithmetic here is the kg->g
 * scale-prefix step on the weight row (§2.2, explicitly permitted).
 */
export function UnitConverterCalculator() {
  const [sg, setSg] = useState('1.05');
  const [srm, setSrm] = useState('10');
  const [litres, setLitres] = useState('20');
  const [kg, setKg] = useState('5');
  const [celsius, setCelsius] = useState('20');
  const [psi, setPsi] = useState('14.5');

  const sgValue = Number.parseFloat(sg);
  const srmValue = Number.parseFloat(srm);
  const litresValue = Number.parseFloat(litres);
  const kgValue = Number.parseFloat(kg);
  const celsiusValue = Number.parseFloat(celsius);
  const psiValue = Number.parseFloat(psi);

  return (
    <CalculatorCard
      title="Unit Converters"
      description="Converts between the brewing units you'll see on different scales and references: gravity, colour, volume, weight, temperature, and pressure."
      formula="Each family converts through a single canonical metric value: SG↔Plato↔Brix, SRM↔EBC↔Lovibond, litres↔gallons, kg↔lb↔oz, °C↔°F, and psi↔kPa↔bar."
    >
      <div className="flex flex-col gap-2">
        <NumericField label="Gravity (SG)" value={sg} onChange={setSg} />
        <ResultRow label="Plato" value={formatGravity(sgValue, 'plato')} />
        <ResultRow label="Brix" value={sgToBrix(sgValue)} unit="°Bx" fractionDigits={2} />
      </div>

      <div className="flex flex-col gap-2">
        <NumericField label="Colour (SRM)" value={srm} onChange={setSrm} />
        <ResultRow label="EBC" value={srmToEbc(srmValue)} unit="EBC" fractionDigits={2} />
        <ResultRow label="Lovibond" value={srmToLovibond(srmValue)} unit="°L" fractionDigits={2} />
      </div>

      <div className="flex flex-col gap-2">
        <NumericField label="Volume (L)" value={litres} onChange={setLitres} />
        <ResultRow label="US gallons" value={formatVolume(litresValue, 'us')} />
        <ResultRow label="Imperial gallons" value={formatVolume(litresValue, 'imperial')} />
      </div>

      <div className="flex flex-col gap-2">
        <NumericField label="Weight (kg)" value={kg} onChange={setKg} />
        <ResultRow label="Pounds" value={formatMass(kgValue, 'us')} />
        <ResultRow label="Ounces" value={formatHopMass(kgValue * 1000, 'us')} />
      </div>

      <div className="flex flex-col gap-2">
        <NumericField label="Temperature (°C)" value={celsius} onChange={setCelsius} />
        <ResultRow label="Fahrenheit" value={formatTemperature(celsiusValue, 'fahrenheit')} />
      </div>

      <div className="flex flex-col gap-2">
        <NumericField label="Pressure (psi)" value={psi} onChange={setPsi} />
        <ResultRow label="kPa" value={psiToKpa(psiValue)} unit="kPa" fractionDigits={2} />
        <ResultRow label="Bar" value={psiToBar(psiValue)} unit="bar" fractionDigits={2} />
      </div>
    </CalculatorCard>
  );
}
