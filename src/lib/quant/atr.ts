import type { MarketDataPoint } from "@/types/asset";

export interface ATRResult {
  value: number | null;
  warnings: string[];
}

function trueRange(current: MarketDataPoint, previous?: MarketDataPoint): number {
  if (!previous) return current.high - current.low;
  return Math.max(current.high - current.low, Math.abs(current.high - previous.close), Math.abs(current.low - previous.close));
}

export function calculateATR(points: MarketDataPoint[], period: number, asOfIndex = points.length - 1): ATRResult {
  if (points.length === 0 || asOfIndex < 0) {
    return { value: null, warnings: ["ATR could not be calculated because no candles are available."] };
  }

  const start = Math.max(0, asOfIndex - period + 1);
  const ranges: number[] = [];
  for (let index = start; index <= asOfIndex; index += 1) {
    const current = points[index];
    if (!current) continue;
    ranges.push(trueRange(current, points[index - 1]));
  }

  if (ranges.length === 0) return { value: null, warnings: ["ATR could not be calculated because no true ranges are available."] };
  const warnings = ranges.length < period ? [`ATR used partial history because fewer than ${period} candles are available.`] : [];
  return {
    value: ranges.reduce((sum, range) => sum + range, 0) / ranges.length,
    warnings
  };
}
