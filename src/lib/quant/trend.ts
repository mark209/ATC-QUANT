import type { AssetType } from "@/types/asset";
import { momentum, movingAverage, zScore } from "./momentum";

export function calculateTrendScore(prices: number[], assetType: AssetType): number {
  const current = prices.at(-1) ?? 0;
  const ma20 = movingAverage(prices, 20);
  const ma50 = movingAverage(prices, 50);
  const ma100 = movingAverage(prices, 100);
  const ma200 = movingAverage(prices, 200);
  const checks =
    assetType === "crypto"
      ? [ma20 && current > ma20, ma50 && current > ma50, ma200 && current > ma200, ma20 && ma50 && ma20 > ma50, ma50 && ma200 && ma50 > ma200]
      : [ma50 && current > ma50, ma100 && current > ma100, ma200 && current > ma200, ma50 && ma200 && ma50 > ma200, momentum(prices, 252) > 0];

  const passed = checks.filter(Boolean).length;
  return (passed / checks.length) * 100;
}

export function calculateMomentumScore(prices: number[], assetType: AssetType): number {
  const windows = assetType === "crypto" ? [7, 14, 30, 90] : [20, 50, 100, 200];
  const raw = windows.reduce((sum, window) => sum + momentum(prices, window), 0) / windows.length;
  return Math.max(0, Math.min(100, 50 + raw * 250));
}

export function overextensionPenalty(prices: number[]): number {
  const absoluteZ = Math.abs(zScore(prices, 50));
  if (absoluteZ < 1.5) return 0;
  if (absoluteZ > 3) return 20;
  return (absoluteZ - 1.5) * 12;
}
