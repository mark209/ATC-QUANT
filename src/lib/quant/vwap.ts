import type { MarketDataPoint } from "@/types/asset";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface VWAPResult {
  value: number | null;
  warnings: string[];
}

export interface VWAPBandResult {
  vwap: number | null;
  weightedStdDev: number | null;
  vwapZScore: number | null;
  upperBand1: number | null;
  lowerBand1: number | null;
  upperBand2: number | null;
  lowerBand2: number | null;
  warnings: string[];
}

export function typicalPrice(point: MarketDataPoint): number {
  return (point.high + point.low + point.close) / 3;
}

function usableVolume(point: MarketDataPoint): number {
  return Number.isFinite(point.volume) && point.volume > 0 ? point.volume : 0;
}

export function calculateVWAP(points: MarketDataPoint[]): VWAPResult {
  let weightedPrice = 0;
  let totalVolume = 0;

  for (const point of points) {
    const volume = usableVolume(point);
    if (volume === 0) continue;
    weightedPrice += typicalPrice(point) * volume;
    totalVolume += volume;
  }

  if (totalVolume === 0) {
    return {
      value: null,
      warnings: ["VWAP could not be calculated because usable volume is zero."]
    };
  }

  return { value: weightedPrice / totalVolume, warnings: [] };
}

export function calculateSessionVWAP(points: MarketDataPoint[], asOfIndex = points.length - 1): VWAPResult {
  const current = points[asOfIndex];
  if (!current) return { value: null, warnings: ["Session VWAP could not be calculated because no current candle exists."] };
  const currentDate = new Date(current.timestamp).toISOString().slice(0, 10);
  const sessionPoints = points.slice(0, asOfIndex + 1).filter((point) => new Date(point.timestamp).toISOString().slice(0, 10) === currentDate);
  return calculateVWAP(sessionPoints);
}

export function calculateRollingVWAP(points: MarketDataPoint[], asOfIndex: number, windowDays: number): VWAPResult {
  const current = points[asOfIndex];
  if (!current) return { value: null, warnings: [`Rolling VWAP ${windowDays}D could not be calculated because no current candle exists.`] };

  const startTimestamp = current.timestamp - windowDays * DAY_MS;
  const windowPoints = points.slice(0, asOfIndex + 1).filter((point) => point.timestamp >= startTimestamp && point.timestamp <= current.timestamp);
  const result = calculateVWAP(windowPoints);
  const warnings = [...result.warnings];
  const first = windowPoints[0];
  if (!first || current.timestamp - first.timestamp < windowDays * DAY_MS) {
    warnings.push(`Rolling VWAP used partial history because less than ${windowDays} days of data are available.`);
  }

  return { value: result.value, warnings };
}

export function calculateVWAPBands(points: MarketDataPoint[], close = points.at(-1)?.close ?? null): VWAPBandResult {
  const base = calculateVWAP(points);
  const warnings = [...base.warnings];
  if (base.value === null) {
    return {
      vwap: null,
      weightedStdDev: null,
      vwapZScore: null,
      upperBand1: null,
      lowerBand1: null,
      upperBand2: null,
      lowerBand2: null,
      warnings
    };
  }

  let weightedVariance = 0;
  let totalVolume = 0;
  for (const point of points) {
    const volume = usableVolume(point);
    if (volume === 0) continue;
    const distance = typicalPrice(point) - base.value;
    weightedVariance += volume * distance * distance;
    totalVolume += volume;
  }

  const weightedStdDev = totalVolume === 0 ? null : Math.sqrt(weightedVariance / totalVolume);
  if (!weightedStdDev || weightedStdDev === 0) {
    warnings.push("VWAP z-score could not be calculated because weighted standard deviation is zero.");
  }

  const zScore = close === null || !weightedStdDev ? null : (close - base.value) / weightedStdDev;
  return {
    vwap: base.value,
    weightedStdDev: weightedStdDev ?? null,
    vwapZScore: zScore,
    upperBand1: weightedStdDev === null ? null : base.value + weightedStdDev,
    lowerBand1: weightedStdDev === null ? null : base.value - weightedStdDev,
    upperBand2: weightedStdDev === null ? null : base.value + weightedStdDev * 2,
    lowerBand2: weightedStdDev === null ? null : base.value - weightedStdDev * 2,
    warnings
  };
}
