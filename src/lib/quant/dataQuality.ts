import type { AssetType, MarketDataPoint } from "@/types/asset";
import type { DataQualityResult } from "@/types/quant";
import type { QuantConfig } from "./config";
import { averageDollarVolume, boundedScore } from "./config";

function hasInvalidPrice(point: MarketDataPoint): boolean {
  return point.open <= 0 || point.high <= 0 || point.low <= 0 || point.close <= 0 || point.high < point.low;
}

function hasOutlierCandle(point: MarketDataPoint): boolean {
  const range = point.high - point.low;
  return point.close > 0 && range / point.close > 0.5;
}

export function validateDataQuality(points: MarketDataPoint[], assetType: AssetType, config: QuantConfig): DataQualityResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  const dataPoints = points.length;
  const requiredDataPoints = assetType === "crypto" ? config.minDataPoints : Math.min(config.minDataPoints, 240);

  if (dataPoints < requiredDataPoints) issues.push("Insufficient historical data.");
  if (!["crypto", "stock", "etf", "index"].includes(assetType)) issues.push("Unsupported asset class.");

  const invalidPrices = points.filter(hasInvalidPrice).length;
  const invalidVolumes = points.filter((point) => point.volume <= 0 || !Number.isFinite(point.volume)).length;
  const missingValues = points.filter(
    (point) =>
      !Number.isFinite(point.open) ||
      !Number.isFinite(point.high) ||
      !Number.isFinite(point.low) ||
      !Number.isFinite(point.close) ||
      !Number.isFinite(point.volume)
  ).length;
  const outlierCandles = points.filter(hasOutlierCandle).length;
  const staleData =
    points.length > 1 && points.at(-1)?.timestamp === points.at(-2)?.timestamp
      ? 1
      : 0;
  const avgDollarVolume = averageDollarVolume(points);

  if (missingValues > 0) issues.push("Missing or non-finite market values.");
  if (invalidPrices > 0) issues.push("Invalid prices.");
  if (invalidVolumes > 0) issues.push("Invalid volume.");
  if (staleData > 0) warnings.push("Latest data timestamp appears stale.");
  if (outlierCandles > Math.max(2, dataPoints * 0.02)) warnings.push("Extreme outlier candles detected.");
  if (avgDollarVolume < config.liquidityMinimums[assetType]) warnings.push("Liquidity is below the preferred minimum.");
  if (dataPoints < config.limitedSampleTradeCount) warnings.push("Backtest sample size is limited.");

  const issuePenalty = issues.length * 30;
  const warningPenalty = warnings.length * 10;
  const historyPenalty = dataPoints >= requiredDataPoints ? 0 : ((requiredDataPoints - dataPoints) / requiredDataPoints) * 35;

  return {
    passed: issues.length === 0,
    score: boundedScore(100 - issuePenalty - warningPenalty - historyPenalty),
    issues,
    warnings,
    dataPoints,
    requiredDataPoints
  };
}
