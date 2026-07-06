import type { AssetType, CandleDensityResult, DataRange, MarketDataPoint } from "@/types/asset";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DataRangePolicy {
  assetType: AssetType;
  chartRangeRequested: DataRange;
  enginePreferredRanges: DataRange[];
  backtestPreferredRanges: DataRange[];
  validationPreferredRanges: DataRange[];
  minCandlesForSignal: number;
  minCandlesForBacktest: number;
  minCandlesForValidation: number;
  expectedCandlesByRange: Record<DataRange, number>;
  maxGapDays: number;
  staleDays: number;
  densityThreshold: number;
}

export function buildDataRangePolicy(assetType: AssetType, chartRangeRequested: DataRange = "max"): DataRangePolicy {
  const equityLike = assetType === "stock" || assetType === "etf" || assetType === "index";
  return {
    assetType,
    chartRangeRequested,
    enginePreferredRanges: equityLike ? ["10y", "5y", "3y", "1y"] : ["max", "5y", "3y", "1y"],
    backtestPreferredRanges: equityLike ? ["10y", "5y", "3y"] : ["max", "5y", "3y"],
    validationPreferredRanges: equityLike ? ["10y", "5y", "3y"] : ["max", "5y", "3y"],
    minCandlesForSignal: equityLike ? 240 : 240,
    minCandlesForBacktest: equityLike ? 240 : 240,
    minCandlesForValidation: equityLike ? 500 : 500,
    expectedCandlesByRange: equityLike
      ? { "1y": 252, "3y": 756, "5y": 1260, "10y": 2520, max: 2520 }
      : { "1y": 365, "3y": 1095, "5y": 1825, "10y": 3650, max: 1825 },
    maxGapDays: equityLike ? 5 : 1.5,
    staleDays: equityLike ? 7 : 2,
    densityThreshold: equityLike ? 0.65 : 0.9
  };
}

function rangeFloor(range: string, policy: DataRangePolicy): number {
  const typedRange = range as DataRange;
  return policy.expectedCandlesByRange[typedRange] ?? policy.minCandlesForSignal;
}

export function evaluateCandleDensity(
  points: MarketDataPoint[],
  assetType: AssetType,
  requestedRange: string,
  expectedMinCandles: number,
  asOfTimestamp = Date.now()
): CandleDensityResult {
  const policy = buildDataRangePolicy(assetType, (requestedRange as DataRange) || "max");
  const issues: string[] = [];
  const warnings: string[] = [];
  const actualCandleCount = points.length;
  const firstTimestamp = points[0]?.timestamp ?? null;
  const lastTimestamp = points.at(-1)?.timestamp ?? null;
  const actualSpanDays =
    firstTimestamp !== null && lastTimestamp !== null ? Math.max(0, (lastTimestamp - firstTimestamp) / DAY_MS) : 0;
  const expectedBySpan =
    actualSpanDays > 0 ? Math.floor(actualSpanDays * (assetType === "crypto" ? 1 : 252 / 365)) : rangeFloor(requestedRange, policy);
  const rangeExpected = rangeFloor(requestedRange, policy);
  const expectedCandles = Math.max(expectedMinCandles, Math.min(rangeExpected, Math.max(expectedBySpan, expectedMinCandles)));
  const densityRatio = expectedCandles === 0 ? 0 : actualCandleCount / expectedCandles;
  const seen = new Set<number>();
  let duplicateCount = 0;
  let isSorted = true;
  let gapCount = 0;
  let largestGapDays = 0;
  let invalidOhlc = 0;
  let invalidVolume = 0;
  let unadjustedEquityRows = 0;

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (seen.has(point.timestamp)) duplicateCount += 1;
    seen.add(point.timestamp);
    if (point.open <= 0 || point.high <= 0 || point.low <= 0 || point.close <= 0 || point.high < point.low) invalidOhlc += 1;
    if (!Number.isFinite(point.volume) || point.volume <= 0) invalidVolume += 1;
    if (assetType !== "crypto" && (point.closeAdjustmentSource === "unadjusted" || point.ohlcAdjustmentSource === "unadjusted")) {
      unadjustedEquityRows += 1;
    }
    const previous = points[index - 1];
    if (!previous) continue;
    if (point.timestamp < previous.timestamp) isSorted = false;
    const gapDays = (point.timestamp - previous.timestamp) / DAY_MS;
    largestGapDays = Math.max(largestGapDays, gapDays);
    if (gapDays > policy.maxGapDays) gapCount += 1;
  }

  const isStale = lastTimestamp !== null ? asOfTimestamp - lastTimestamp > policy.staleDays * DAY_MS : true;
  const isSparse = actualCandleCount < expectedMinCandles || densityRatio < policy.densityThreshold || !isSorted || duplicateCount > 0;

  if (actualCandleCount < expectedMinCandles) issues.push(`Insufficient candles for ${requestedRange}: ${actualCandleCount} < ${expectedMinCandles}.`);
  if (densityRatio < policy.densityThreshold) issues.push(`Sparse candle density for ${requestedRange}.`);
  if (!isSorted) issues.push("Candles are not sorted chronologically.");
  if (duplicateCount > 0) issues.push("Duplicate candle timestamps detected.");
  if (invalidOhlc > 0) issues.push("Invalid OHLC values detected.");
  if (invalidVolume > 0) issues.push("Invalid volume values detected.");
  if (isStale) warnings.push("Latest candle appears stale.");
  if (gapCount > 0) warnings.push("Missing or gapped candles detected.");
  if (unadjustedEquityRows > 0) warnings.push("Equity adjusted OHLC data is unavailable for at least one candle.");

  return {
    requestedRange,
    actualCandleCount,
    firstTimestamp,
    lastTimestamp,
    actualSpanDays,
    expectedMinCandles,
    densityRatio,
    isSparse,
    gapCount,
    largestGapDays,
    duplicateCount,
    isSorted,
    isStale,
    issues,
    warnings
  };
}
