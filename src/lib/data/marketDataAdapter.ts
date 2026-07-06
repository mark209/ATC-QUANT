import type { AssetType, DataFetchResult, DataRange, MarketDataPoint, MarketDataset, RiskProfile } from "@/types/asset";
import type { QuantAnalysis } from "@/types/quant";
import { analyzeMarketData } from "@/lib/quant/scoring";
import { fetchBinanceMarketData } from "./binanceAdapter";
import { fetchEquityMarketData } from "./equityAdapter";
import { buildDataRangePolicy, evaluateCandleDensity } from "./dataRangePolicy";

export interface MarketAnalysisResponse {
  dataset: MarketDataset;
  analysis: QuantAnalysis;
}

export interface MarketDataFallbackInput {
  symbol: string;
  assetType: AssetType;
  chartRangeRequested?: DataRange;
}

function rangeLabel(range: string): string {
  return range === "max" ? "Max" : range;
}

function cryptoLookback(range: DataRange): number | "max" {
  if (range === "max") return "max";
  if (range === "10y") return 365 * 10;
  if (range === "5y") return 365 * 5;
  if (range === "3y") return 365 * 3;
  return 365;
}

async function fetchDatasetForRange(symbol: string, assetType: AssetType, range: DataRange): Promise<MarketDataset> {
  if (assetType === "crypto") return fetchBinanceMarketData(symbol, { lookbackDays: cryptoLookback(range) });
  return fetchEquityMarketData(symbol, assetType, { range: range === "max" ? "max" : range });
}

async function getFetchedRange(input: {
  fetched: Map<DataRange, MarketDataset>;
  symbol: string;
  assetType: AssetType;
  range: DataRange;
}): Promise<MarketDataset> {
  const existing = input.fetched.get(input.range);
  if (existing) return existing;
  const dataset = await fetchDatasetForRange(input.symbol, input.assetType, input.range);
  input.fetched.set(input.range, dataset);
  return dataset;
}

async function selectDenseRange(input: {
  fetched: Map<DataRange, MarketDataset>;
  symbol: string;
  assetType: AssetType;
  ranges: DataRange[];
  minCandles: number;
}): Promise<{ range: DataRange; candles: MarketDataPoint[]; density: ReturnType<typeof evaluateCandleDensity>; fallbackReason?: string }> {
  let lastCandidate: { range: DataRange; candles: MarketDataPoint[]; density: ReturnType<typeof evaluateCandleDensity> } | null = null;

  for (const range of input.ranges) {
    const dataset = await getFetchedRange({
      fetched: input.fetched,
      symbol: input.symbol,
      assetType: input.assetType,
      range
    });
    const density = evaluateCandleDensity(dataset.prices, input.assetType, range, input.minCandles);
    lastCandidate = { range, candles: dataset.prices, density };
    if (!density.isSparse) return lastCandidate;
  }

  if (lastCandidate) {
    return {
      ...lastCandidate,
      fallbackReason: `No dense data range satisfied the ${input.minCandles}-candle requirement.`
    };
  }

  return {
    range: input.ranges[0],
    candles: [],
    density: evaluateCandleDensity([], input.assetType, input.ranges[0], input.minCandles),
    fallbackReason: `No data range was available for ${input.ranges.join(", ")}.`
  };
}

export async function fetchMarketDataWithFallback(input: MarketDataFallbackInput): Promise<DataFetchResult> {
  const chartRangeRequested = input.chartRangeRequested ?? "max";
  const policy = buildDataRangePolicy(input.assetType, chartRangeRequested);
  const fetched = new Map<DataRange, MarketDataset>();
  const chartDataset = await getFetchedRange({
    fetched,
    symbol: input.symbol,
    assetType: input.assetType,
    range: chartRangeRequested
  });

  const chartDensity = evaluateCandleDensity(chartDataset.prices, input.assetType, chartRangeRequested, policy.minCandlesForSignal);
  const engine = await selectDenseRange({
    fetched,
    symbol: input.symbol,
    assetType: input.assetType,
    ranges: policy.enginePreferredRanges,
    minCandles: policy.minCandlesForSignal
  });
  const backtest = await selectDenseRange({
    fetched,
    symbol: input.symbol,
    assetType: input.assetType,
    ranges: policy.backtestPreferredRanges,
    minCandles: policy.minCandlesForBacktest
  });
  const validation = await selectDenseRange({
    fetched,
    symbol: input.symbol,
    assetType: input.assetType,
    ranges: policy.validationPreferredRanges,
    minCandles: policy.minCandlesForValidation
  });
  const fallbackUsed =
    engine.range !== chartRangeRequested || backtest.range !== chartRangeRequested || validation.range !== chartRangeRequested || chartDensity.isSparse;
  const fallbackReason = fallbackUsed
    ? chartDensity.isSparse
      ? `Chart range ${chartRangeRequested} was sparse; engine used ${engine.range} daily data.`
      : `Engine/backtest/validation ranges differ from requested chart range ${chartRangeRequested}.`
    : undefined;
  const warnings = [
    ...chartDensity.warnings,
    ...engine.density.warnings,
    ...backtest.density.warnings,
    ...validation.density.warnings,
    ...(fallbackReason ? [fallbackReason] : [])
  ];
  const issues = [...engine.density.issues, ...backtest.density.issues];

  return {
    symbol: chartDataset.overview.symbol,
    assetType: chartDataset.overview.assetType,
    overview: chartDataset.overview,
    chartRangeRequested,
    chartDataRangeUsed: chartRangeRequested,
    engineRangeUsed: engine.range,
    backtestRangeUsed: backtest.range,
    validationRangeUsed: validation.range,
    fallbackUsed,
    fallbackReason,
    chartCandles: chartDataset.prices,
    engineCandles: engine.candles,
    backtestCandles: backtest.candles,
    validationCandles: validation.candles,
    density: {
      chart: chartDensity,
      engine: engine.density,
      backtest: backtest.density,
      validation: validation.density
    },
    warnings: Array.from(new Set(warnings)),
    issues: Array.from(new Set(issues))
  };
}

export async function getLiveMarketAnalysis(input: {
  symbol: string;
  assetType: AssetType;
  riskProfile: RiskProfile;
}): Promise<MarketAnalysisResponse> {
  const dataRanges = await fetchMarketDataWithFallback({
    symbol: input.symbol,
    assetType: input.assetType,
    chartRangeRequested: "max"
  });
  const dataset: MarketDataset = {
    overview: dataRanges.overview,
    prices: dataRanges.chartCandles,
    dataRanges
  };

  if (dataRanges.engineCandles.length < 60) {
    throw new Error("Live provider returned fewer than 60 observations; quant analysis needs more history.");
  }

  return {
    dataset,
    analysis: analyzeMarketData(dataRanges.engineCandles, dataset.overview.assetType, dataset.overview.symbol, input.riskProfile, {
      chartCandles: dataRanges.chartCandles,
      engineCandles: dataRanges.engineCandles,
      backtestCandles: dataRanges.backtestCandles,
      validationCandles: dataRanges.validationCandles,
      rangeMetadata: {
        chartRangeRequested: rangeLabel(dataRanges.chartRangeRequested),
        chartDataRangeUsed: rangeLabel(dataRanges.chartDataRangeUsed),
        engineRangeUsed: dataRanges.engineRangeUsed,
        backtestRangeUsed: dataRanges.backtestRangeUsed,
        validationRangeUsed: dataRanges.validationRangeUsed,
        fallbackUsed: dataRanges.fallbackUsed,
        fallbackReason: dataRanges.fallbackReason
      },
      dataRangeResult: dataRanges
    })
  };
}
