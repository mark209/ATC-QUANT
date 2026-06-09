import type { MarketDataPoint } from "@/types/asset";

export interface ConfirmedPivot {
  pivotIndex: number;
  confirmationIndex: number;
  price: number;
  timestamp: number;
}

function isSwingLow(points: MarketDataPoint[], pivotIndex: number, left: number, right: number): boolean {
  const pivot = points[pivotIndex];
  if (!pivot) return false;
  for (let index = pivotIndex - left; index <= pivotIndex + right; index += 1) {
    if (index === pivotIndex) continue;
    const point = points[index];
    if (!point || pivot.low >= point.low) return false;
  }
  return true;
}

function isSwingHigh(points: MarketDataPoint[], pivotIndex: number, left: number, right: number): boolean {
  const pivot = points[pivotIndex];
  if (!pivot) return false;
  for (let index = pivotIndex - left; index <= pivotIndex + right; index += 1) {
    if (index === pivotIndex) continue;
    const point = points[index];
    if (!point || pivot.high <= point.high) return false;
  }
  return true;
}

export function findMostRecentConfirmedSwingLow(
  points: MarketDataPoint[],
  left: number,
  right: number,
  asOfIndex = points.length - 1
): ConfirmedPivot | null {
  for (let pivotIndex = asOfIndex - right; pivotIndex >= left; pivotIndex -= 1) {
    const confirmationIndex = pivotIndex + right;
    // In backtests, this prevents lookahead: a pivot is unavailable until the right-side candles have closed.
    if (confirmationIndex > asOfIndex) continue;
    if (isSwingLow(points, pivotIndex, left, right)) {
      const pivot = points[pivotIndex];
      return { pivotIndex, confirmationIndex, price: pivot.low, timestamp: pivot.timestamp };
    }
  }
  return null;
}

export function findMostRecentConfirmedSwingHigh(
  points: MarketDataPoint[],
  left: number,
  right: number,
  asOfIndex = points.length - 1
): ConfirmedPivot | null {
  for (let pivotIndex = asOfIndex - right; pivotIndex >= left; pivotIndex -= 1) {
    const confirmationIndex = pivotIndex + right;
    // In backtests, this prevents lookahead: a pivot is unavailable until the right-side candles have closed.
    if (confirmationIndex > asOfIndex) continue;
    if (isSwingHigh(points, pivotIndex, left, right)) {
      const pivot = points[pivotIndex];
      return { pivotIndex, confirmationIndex, price: pivot.high, timestamp: pivot.timestamp };
    }
  }
  return null;
}
