import type { AssetType, MarketDataPoint } from "@/types/asset";
import type { DataQualityResult } from "@/types/quant";
import type { QuantConfig } from "./config";
import { averageDollarVolume, boundedScore } from "./config";

interface DataQualityOptions {
  asOfTimestamp?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function hasInvalidPrice(point: MarketDataPoint): boolean {
  return point.open <= 0 || point.high <= 0 || point.low <= 0 || point.close <= 0 || point.high < point.low;
}

function hasOutlierCandle(point: MarketDataPoint, maxRangePct: number): boolean {
  const range = point.high - point.low;
  return point.close > 0 && range / point.close > maxRangePct;
}

function isSupportedAssetType(assetType: AssetType, config: QuantConfig): boolean {
  return config.dataQuality.supportedAssetTypes.includes(assetType);
}

function movingAverage(values: number[], endIndex: number, window: number): number | null {
  if (endIndex + 1 < window) return null;
  const slice = values.slice(endIndex + 1 - window, endIndex + 1);
  return slice.reduce((sum, value) => sum + value, 0) / window;
}

function estimateTrendTrades(points: MarketDataPoint[], fastWindow = 50, slowWindow = 200): number {
  const closes = points.map((point) => point.close);
  let priorSignal = false;
  let entries = 0;

  for (let index = 0; index < closes.length; index += 1) {
    const fastMa = movingAverage(closes, index, fastWindow);
    const slowMa = movingAverage(closes, index, slowWindow);
    const signal = fastMa !== null && slowMa !== null && closes[index] >= fastMa && fastMa >= slowMa;
    if (signal && !priorSignal) entries += 1;
    priorSignal = signal;
  }

  return entries;
}

function estimateWalkForwardTrades(points: MarketDataPoint[], config: QuantConfig): number[] {
  if (points.length < config.minDataPoints * 2) return [];
  const windowSize = Math.floor(points.length / 4);
  const tradesPerWindow: number[] = [];

  for (let start = 0; start + windowSize * 2 <= points.length; start += Math.max(60, Math.floor(windowSize / 2))) {
    const test = points.slice(start + windowSize, start + windowSize * 2);
    tradesPerWindow.push(estimateTrendTrades(test));
  }

  return tradesPerWindow;
}

export function validateDataQuality(
  points: MarketDataPoint[],
  assetType: AssetType,
  config: QuantConfig,
  options: DataQualityOptions = {}
): DataQualityResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  const dataPoints = points.length;
  const supportedAssetType = isSupportedAssetType(assetType, config);
  const requiredDataPoints = !supportedAssetType
    ? config.minDataPoints
    : assetType === "crypto"
      ? config.minDataPoints
      : Math.min(config.minDataPoints, config.dataQuality.equityMinDataPoints);

  if (dataPoints < requiredDataPoints) issues.push("Insufficient historical data.");
  if (!supportedAssetType) issues.push("Unsupported asset class.");

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
  const outlierCandles = points.filter((point) => hasOutlierCandle(point, config.dataQuality.maxOutlierCandleRangePct)).length;
  let unsortedCandles = 0;
  let gapCount = 0;
  const timestamps = new Set<number>();

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    timestamps.add(point.timestamp);
    const previous = points[index - 1];
    if (!previous) continue;
    if (point.timestamp < previous.timestamp) unsortedCandles += 1;
    const gap = point.timestamp - previous.timestamp;
    const maxExpectedGap = assetType === "crypto" ? DAY_MS * 1.5 : DAY_MS * 5;
    if (gap > maxExpectedGap) gapCount += 1;
  }

  const duplicateCandles = points.length - timestamps.size;
  const latestTimestamp = points.at(-1)?.timestamp;
  const asOfTimestamp = options.asOfTimestamp ?? Date.now();
  const staleThreshold = assetType === "crypto" ? DAY_MS * 2 : DAY_MS * 7;
  const staleData =
    typeof latestTimestamp === "number" && asOfTimestamp - latestTimestamp > staleThreshold
      ? 1
      : points.length > 1 && points.at(-1)?.timestamp === points.at(-2)?.timestamp
        ? 1
        : 0;
  const avgDollarVolume = averageDollarVolume(points);
  const unadjustedEquityPrices =
    assetType !== "crypto" &&
    points.some((point) => point.closeAdjustmentSource === "unadjusted" || point.ohlcAdjustmentSource === "unadjusted");
  const totalCandles = dataPoints;
  const usableCandlesAfterWarmup = Math.max(0, totalCandles - config.dataQuality.indicatorWarmupCandles);
  const outOfSamplePoints = points.slice(Math.floor(points.length * 0.7));
  const estimatedTrades = estimateTrendTrades(points);
  const outOfSampleTrades = estimateTrendTrades(outOfSamplePoints);
  const walkForwardTradesPerWindow = estimateWalkForwardTrades(points, config);

  if (missingValues > 0) issues.push("Missing or non-finite market values.");
  if (invalidPrices > 0) issues.push("Invalid prices.");
  if (invalidVolumes > 0) issues.push("Invalid volume.");
  if (unsortedCandles > 0) issues.push("Candles are not sorted chronologically.");
  if (duplicateCandles > 0) issues.push("Duplicate candles detected.");
  if (gapCount > 0) warnings.push("Missing or gapped candles detected.");
  if (staleData > 0) {
    warnings.push("Latest data timestamp appears stale.");
    warnings.push("Latest candle is stale for the selected asset class.");
  }
  if (outlierCandles > Math.max(config.dataQuality.maxOutlierCandles, dataPoints * config.dataQuality.maxOutlierCandleRate)) {
    warnings.push("Extreme outlier candles detected.");
  }
  if (supportedAssetType && avgDollarVolume < config.liquidityMinimums[assetType]) warnings.push("Liquidity is below the preferred minimum.");
  if (unadjustedEquityPrices) {
    warnings.push("Equity adjusted OHLC data is unavailable; returns/backtests may be affected by splits or corporate actions.");
    if (dataPoints >= 252 * 3) {
      issues.push("Long-range equity data is unadjusted.");
    }
  }
  if (dataPoints < config.limitedSampleTradeCount) warnings.push("Backtest sample size is limited.");
  if (assetType === "crypto" && dataPoints < config.dataQuality.cryptoMinimumTargetCandles) {
    warnings.push("Crypto history is below the preferred 5-year validation target.");
  }

  const issuePenalty = issues.length * 30;
  const warningPenalty = warnings.length * 10;
  const historyPenalty = dataPoints >= requiredDataPoints ? 0 : ((requiredDataPoints - dataPoints) / requiredDataPoints) * 35;

  return {
    passed: issues.length === 0,
    score: boundedScore(100 - issuePenalty - warningPenalty - historyPenalty),
    issues,
    warnings,
    dataPoints,
    requiredDataPoints,
    totalCandles,
    usableCandlesAfterWarmup,
    estimatedTrades,
    outOfSampleTrades,
    walkForwardTradesPerWindow,
    dataStartDate: points[0]?.date,
    dataEndDate: points.at(-1)?.date
  };
}
