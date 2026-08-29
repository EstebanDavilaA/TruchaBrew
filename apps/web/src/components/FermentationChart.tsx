import type { FermentationChartModel } from '@truchabrew/calculations';

// A dependency-free inline-SVG renderer over `FermentationChartModel` (M5_P1
// spec §4 deviation 2 / §2.4). This component is a THIN renderer — every
// domain/tick/point number it draws already comes out of the pure model;
// nothing here computes a domain, a tick or a degenerate-axis pad. No
// `recharts`, no `uplot`, no `d3`.

const WIDTH = 640;
const HEIGHT = 320;
const MARGIN = { top: 16, right: 56, bottom: 36, left: 56 };
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

function formatGravity(v: number): string {
  return v.toFixed(3);
}
function formatTemperature(v: number): string {
  return v.toFixed(1);
}
function formatHours(v: number): string {
  return v.toFixed(1);
}

/** Maps a value in [axis.min, axis.max] to a pixel position within the plot area, y-axes inverted (SVG y grows downward). */
function scaleX(value: number, min: number, max: number): number {
  return MARGIN.left + ((value - min) / (max - min)) * PLOT_WIDTH;
}
function scaleY(value: number, min: number, max: number): number {
  return MARGIN.top + PLOT_HEIGHT - ((value - min) / (max - min)) * PLOT_HEIGHT;
}

export function FermentationChart({ model }: { model: FermentationChartModel }) {
  if (!model.hasPoints) {
    return null;
  }

  const { points, targetTemperaturePoints, timeAxis, gravityAxis, temperatureAxis } = model;

  const gravityLinePoints = points
    .filter((p) => p.sg !== null)
    .map((p) => `${scaleX(p.elapsedHours, timeAxis.min, timeAxis.max)},${scaleY(p.sg as number, gravityAxis!.min, gravityAxis!.max)}`)
    .join(' ');

  const temperatureLinePoints = points
    .filter((p) => p.tempC !== null)
    .map((p) => `${scaleX(p.elapsedHours, timeAxis.min, timeAxis.max)},${scaleY(p.tempC as number, temperatureAxis!.min, temperatureAxis!.max)}`)
    .join(' ');

  const targetTemperatureLinePoints = (targetTemperaturePoints || [])
    .map((p) => `${scaleX(p.elapsedHours, timeAxis.min, timeAxis.max)},${scaleY(p.targetTempC, temperatureAxis!.min, temperatureAxis!.max)}`)
    .join(' ');

  const hasTargetTemp = targetTemperaturePoints && targetTemperaturePoints.length > 0 && temperatureAxis !== null;

  return (
    <svg
      role="img"
      aria-label="Fermentation chart: gravity and temperature over time"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full h-auto"
      data-testid="fermentation-chart"
    >
      {/* Plot area frame */}
      <rect x={MARGIN.left} y={MARGIN.top} width={PLOT_WIDTH} height={PLOT_HEIGHT} fill="none" stroke="currentColor" className="text-slate-800" />

      {/* Time axis ticks (x) */}
      {timeAxis.ticks.map((tick, i) => {
        const x = scaleX(tick, timeAxis.min, timeAxis.max);
        return (
          <g key={`time-tick-${i}`}>
            <line x1={x} y1={MARGIN.top} x2={x} y2={MARGIN.top + PLOT_HEIGHT} stroke="currentColor" className="text-slate-800" strokeDasharray="2,2" />
            <text x={x} y={HEIGHT - MARGIN.bottom + 16} textAnchor="middle" fontSize={10} fill="currentColor" className="text-slate-400">
              {formatHours(tick)}h
            </text>
          </g>
        );
      })}

      {/* Gravity axis (left) */}
      {gravityAxis && (
        <g data-testid="gravity-axis">
          {gravityAxis.ticks.map((tick, i) => {
            const y = scaleY(tick, gravityAxis.min, gravityAxis.max);
            return (
              <text key={`gravity-tick-${i}`} x={MARGIN.left - 8} y={y} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="currentColor" className="text-amber-500">
                {formatGravity(tick)}
              </text>
            );
          })}
          <polyline points={gravityLinePoints} fill="none" stroke="currentColor" strokeWidth={2} className="text-amber-500" data-testid="gravity-line" />
          {points
            .filter((p) => p.sg !== null)
            .map((p) => (
              <circle
                key={`gravity-point-${p.readingId}`}
                data-testid={`gravity-point-${p.readingId}`}
                data-reading-id={p.readingId}
                cx={scaleX(p.elapsedHours, timeAxis.min, timeAxis.max)}
                cy={scaleY(p.sg as number, gravityAxis.min, gravityAxis.max)}
                r={3}
                fill="currentColor"
                className="text-amber-500"
              />
            ))}
        </g>
      )}

      {/* Temperature axis (right) */}
      {temperatureAxis && (
        <g data-testid="temperature-axis">
          {temperatureAxis.ticks.map((tick, i) => {
            const y = scaleY(tick, temperatureAxis.min, temperatureAxis.max);
            return (
              <text key={`temp-tick-${i}`} x={MARGIN.left + PLOT_WIDTH + 8} y={y} textAnchor="start" dominantBaseline="middle" fontSize={10} fill="currentColor" className="text-sky-400">
                {formatTemperature(tick)}°
              </text>
            );
          })}

          {/* Target profile temperature line */}
          {hasTargetTemp && (
            <polyline
              points={targetTemperatureLinePoints}
              fill="none"
              stroke="#2dd4bf"
              strokeWidth={1.5}
              strokeDasharray="6,4"
              data-testid="target-temperature-line"
            />
          )}

          {/* Measured temperature line */}
          <polyline
            points={temperatureLinePoints}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeDasharray="4,3"
            className="text-sky-400"
            data-testid="temperature-line"
          />
          {points
            .filter((p) => p.tempC !== null)
            .map((p) => (
              <circle
                key={`temperature-point-${p.readingId}`}
                data-testid={`temperature-point-${p.readingId}`}
                data-reading-id={p.readingId}
                cx={scaleX(p.elapsedHours, timeAxis.min, timeAxis.max)}
                cy={scaleY(p.tempC as number, temperatureAxis.min, temperatureAxis.max)}
                r={3}
                fill="currentColor"
                className="text-sky-400"
              />
            ))}
        </g>
      )}

      {/* Legend — one entry per series that actually has an axis. */}
      <g transform={`translate(${MARGIN.left}, 8)`} fontSize={11}>
        {gravityAxis && (
          <g data-testid="legend-gravity">
            <rect width={10} height={10} fill="currentColor" className="text-amber-500" />
            <text x={14} y={9} fill="currentColor" className="text-amber-500">
              Gravity (SG)
            </text>
          </g>
        )}
        {temperatureAxis && (
          <g transform="translate(120, 0)" data-testid="legend-temperature">
            <rect width={10} height={10} fill="currentColor" className="text-sky-400" />
            <text x={14} y={9} fill="currentColor" className="text-sky-400">
              Temp (°C)
            </text>
          </g>
        )}
        {hasTargetTemp && (
          <g transform="translate(225, 0)" data-testid="legend-target-temperature">
            <line x1={0} y1={5} x2={12} y2={5} stroke="#2dd4bf" strokeWidth={2} strokeDasharray="3,2" />
            <text x={16} y={9} fill="#2dd4bf">
              Target Temp
            </text>
          </g>
        )}
      </g>
    </svg>
  );
}
