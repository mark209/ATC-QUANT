import type { AssetType, MarketDataPoint } from "@/types/asset";
import type { ValidationEvidenceState } from "@/types/quant";
import { fetchMarketDataWithFallback } from "@/lib/data/marketDataAdapter";
import { DEFAULT_QUANT_CONFIG } from "@/lib/quant/config";
import { simulatePaperPortfolio, type ReplayResultRow } from "@/lib/quant/historicalReplay";
import { analyzeMarketData } from "@/lib/quant/scoring";

type AssetSpec = { symbol: string; assetType: AssetType };
type VariantName =
  | "A Core Signal Only"
  | "B Core Signal + Vol Target"
  | "C Core Signal + Drawdown"
  | "D Core Signal + EV/Kelly"
  | "E Core Signal + Validation"
  | "F Full Production";

type AnalysisPoint = {
  index: number;
  candle: MarketDataPoint;
  availableCandles: number;
  dataQualityPassed: boolean;
  finalDecision: string;
  finalPositionSize: number;
  signalScore: number;
  riskScore: number;
  validationScore: number;
  validationEvidenceState: ValidationEvidenceState;
  liquidityScore: number;
  regimeLabel: string;
  evAfterCosts: number;
  evPassed: boolean;
  evWarnings: string[];
  kellyAllocation: number;
  volatilityTargetAllocation: number;
  drawdownAdjustedAllocation: number;
  drawdownLabel: string;
  validationRobustness: string;
  validationWarnings: string[];
  validationOosTrades: number;
  validationWalkForwardWindows: number;
  backtestTrades: number;
  finalBlockingReasons: string[];
  finalWarnings: string[];
};

const ASSETS: AssetSpec[] = [
  { symbol: "AAPL", assetType: "stock" },
  { symbol: "SPY", assetType: "etf" },
  { symbol: "QQQ", assetType: "etf" },
  { symbol: "BTCUSDT", assetType: "crypto" },
  { symbol: "ETHUSDT", assetType: "crypto" }
];
const ONLY_SYMBOLS = new Set(process.argv.slice(2).map((symbol) => symbol.trim().toUpperCase()).filter(Boolean));
const SELECTED_ASSETS = ONLY_SYMBOLS.size > 0 ? ASSETS.filter((asset) => ONLY_SYMBOLS.has(asset.symbol)) : ASSETS;
const REBALANCE_DAYS = [5, 21, 63];
const WARMUP_YEARS = [1, 3, 5];
const STARTING_CAPITAL = 100000;

function pct(value: number): string {
  return `${(value * 100).toFixed(4)}%`;
}

function num(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  return value.toFixed(4);
}

function ratio(value: number): string {
  if (!Number.isFinite(value) || Math.abs(value) >= 10) return "Not meaningful";
  return num(value);
}

function avg(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function sortedCandles(candles: MarketDataPoint[]): MarketDataPoint[] {
  return [...candles].sort((a, b) => a.timestamp - b.timestamp);
}

function benchmarkReturn(candles: MarketDataPoint[]): number {
  const first = candles[0]?.open ?? candles[0]?.close ?? 0;
  const last = candles.at(-1)?.close ?? first;
  return first === 0 ? 0 : last / first - 1;
}

function printTable(title: string, rows: Array<Record<string, string | number>>) {
  console.log(`\n## ${title}`);
  console.table(rows);
}

function uniqueReplayIndices(length: number): number[] {
  const indices = new Set<number>();
  for (const days of REBALANCE_DAYS) {
    for (let index = 0; index < length; index += days) indices.add(index);
  }
  return Array.from(indices).sort((a, b) => a - b);
}

function summarizeAnalysis(index: number, candle: MarketDataPoint, analysis: ReturnType<typeof analyzeMarketData>): AnalysisPoint {
  return {
    index,
    candle,
    availableCandles: index + 1,
    dataQualityPassed: analysis.pipeline.dataQuality.passed,
    finalDecision: analysis.pipeline.finalDecision.decisionLabel,
    finalPositionSize: analysis.pipeline.finalDecision.finalPositionSize,
    signalScore: analysis.pipeline.signal.combinedSignalScore,
    riskScore: analysis.pipeline.risk.combinedRiskScore,
    validationScore: analysis.pipeline.validation.validationScore,
    validationEvidenceState: analysis.pipeline.validation.validationEvidenceState,
    liquidityScore: analysis.pipeline.risk.liquidityScore,
    regimeLabel: analysis.pipeline.signal.regimeLabel,
    evAfterCosts: analysis.pipeline.expectedValue.expectedValueAfterCosts,
    evPassed: analysis.pipeline.expectedValue.passed,
    evWarnings: analysis.pipeline.expectedValue.warnings,
    kellyAllocation: analysis.pipeline.positionSizing.fractionalKellyAllocation,
    volatilityTargetAllocation: analysis.pipeline.positionSizing.volatilityTargetAllocation,
    drawdownAdjustedAllocation: analysis.pipeline.positionSizing.drawdownAdjustedAllocation,
    drawdownLabel: analysis.pipeline.risk.drawdownLabel,
    validationRobustness: analysis.pipeline.validation.robustnessLabel,
    validationWarnings: analysis.pipeline.validation.warnings,
    validationOosTrades: analysis.pipeline.validation.outOfSample.totalTrades,
    validationWalkForwardWindows: analysis.pipeline.validation.walkForward.windowsTested,
    backtestTrades: analysis.backtest.totalTrades,
    finalBlockingReasons: analysis.pipeline.finalDecision.blockingReasons,
    finalWarnings: analysis.pipeline.finalDecision.warnings
  };
}

function isCoreSignalActive(point: AnalysisPoint): boolean {
  return point.dataQualityPassed && point.regimeLabel === "Trend Up";
}

function validationPasses(point: AnalysisPoint): boolean {
  return point.validationRobustness !== "Insufficient Data" && point.validationScore >= DEFAULT_QUANT_CONFIG.decisionThresholds.positionAllowedValidationScore;
}

function allocationForVariant(variant: VariantName, point: AnalysisPoint): number {
  if (!point.dataQualityPassed) return 0;
  if (variant === "F Full Production") return point.finalPositionSize;
  if (!isCoreSignalActive(point)) return 0;

  if (variant === "A Core Signal Only") return 0.1;
  if (variant === "B Core Signal + Vol Target") {
    return point.drawdownLabel === "Risk-Off" ? 0 : Math.max(0, point.volatilityTargetAllocation);
  }
  if (variant === "C Core Signal + Drawdown") {
    return Math.max(0, Math.min(point.volatilityTargetAllocation, point.drawdownAdjustedAllocation));
  }
  if (variant === "D Core Signal + EV/Kelly") {
    return point.evPassed ? Math.max(0, point.kellyAllocation) : 0;
  }
  if (variant === "E Core Signal + Validation") {
    return validationPasses(point) ? 0.1 : 0;
  }
  return 0;
}

function rowForVariant(asset: AssetSpec, point: AnalysisPoint, variant: VariantName): ReplayResultRow {
  const allocation = allocationForVariant(variant, point);
  const finalDecision =
    allocation > 0
      ? variant === "A Core Signal Only"
        ? "Position allowed"
        : "Small allocation only"
      : point.dataQualityPassed
        ? "Avoid for now"
        : "No Data / Avoid";

  return {
    date: point.candle.date,
    symbol: asset.symbol,
    assetType: asset.assetType,
    finalDecision,
    activeAllocation: allocation,
    signalScore: point.signalScore,
    riskScore: point.riskScore,
    validationScore: point.validationScore,
    validationEvidenceState: point.validationEvidenceState,
    evStatus: point.evAfterCosts <= 0 ? "EV failed" : point.evPassed
          ? "EV passed"
          : "EV limited",
    evAfterCosts: point.evAfterCosts,
    kellyAllocation: point.kellyAllocation,
    dataQualityStatus: point.dataQualityPassed ? "passed" : "failed",
    regimeLabel: point.regimeLabel,
    blockingReasons: allocation > 0 ? [] : point.finalBlockingReasons,
    warnings: Array.from(new Set([...point.finalWarnings, ...point.evWarnings]))
  };
}

function rowsForDays(asset: AssetSpec, points: AnalysisPoint[], days: number, variant: VariantName): ReplayResultRow[] {
  return points
    .filter((point) => point.index % days === 0)
    .map((point) => rowForVariant(asset, point, variant));
}

function productionRowsForDays(asset: AssetSpec, points: AnalysisPoint[], days: number): ReplayResultRow[] {
  return points
    .filter((point) => point.index % days === 0)
    .map((point) => {
      return {
        date: point.candle.date,
        symbol: asset.symbol,
        assetType: asset.assetType,
        finalDecision: point.finalDecision,
        activeAllocation: point.finalPositionSize,
        signalScore: point.signalScore,
        riskScore: point.riskScore,
        validationScore: point.validationScore,
        validationEvidenceState: point.validationEvidenceState,
        evStatus: point.evAfterCosts <= 0 ? "EV failed" : point.evPassed ? "EV passed" : "EV limited",
        evAfterCosts: point.evAfterCosts,
        kellyAllocation: point.kellyAllocation,
        dataQualityStatus: point.dataQualityPassed ? "passed" : "failed",
        regimeLabel: point.regimeLabel,
        blockingReasons: point.finalBlockingReasons,
        warnings: Array.from(new Set([...point.finalWarnings, ...point.evWarnings]))
      };
    });
}

function bucketRows(rows: ReplayResultRow[]): Record<string, number> {
  return {
    zero: rows.filter((row) => row.activeAllocation === 0).length,
    gt0To025: rows.filter((row) => row.activeAllocation > 0 && row.activeAllocation <= 0.0025).length,
    gt025To050: rows.filter((row) => row.activeAllocation > 0.0025 && row.activeAllocation <= 0.005).length,
    gt050To100: rows.filter((row) => row.activeAllocation > 0.005 && row.activeAllocation <= 0.01).length,
    gt100To500: rows.filter((row) => row.activeAllocation > 0.01 && row.activeAllocation <= 0.05).length,
    gt500: rows.filter((row) => row.activeAllocation > 0.05).length
  };
}

function validationReason(point: AnalysisPoint): string {
  if (point.validationWarnings.length > 0) return point.validationWarnings.join(" | ");
  if (point.validationRobustness === "Insufficient Data") return "Validation robustness label is Insufficient Data.";
  return "No explicit validation warning.";
}

function yearIndex(candles: MarketDataPoint[], years: number): number {
  const start = candles[0]?.timestamp ?? 0;
  const target = start + years * 365.25 * 24 * 60 * 60 * 1000;
  const found = candles.findIndex((candle) => candle.timestamp >= target);
  return found < 0 ? candles.length : found;
}

async function main() {
  const datasets = new Map<string, { asset: AssetSpec; candles: MarketDataPoint[]; points: AnalysisPoint[] }>();
  for (const asset of SELECTED_ASSETS) {
    const data = await fetchMarketDataWithFallback({
      symbol: asset.symbol,
      assetType: asset.assetType,
      chartRangeRequested: "max"
    });
    const candles = sortedCandles(data.backtestCandles);
    const points = uniqueReplayIndices(candles.length).map((index) =>
      summarizeAnalysis(index, candles[index], analyzeMarketData(candles.slice(0, index + 1), asset.assetType, asset.symbol, "balanced"))
    );
    datasets.set(asset.symbol, { asset, candles, points });
  }

  const variants: VariantName[] = [
    "A Core Signal Only",
    "B Core Signal + Vol Target",
    "C Core Signal + Drawdown",
    "D Core Signal + EV/Kelly",
    "E Core Signal + Validation",
    "F Full Production"
  ];
  const ablationRows: Array<Record<string, string | number>> = [];
  for (const { asset, candles, points } of datasets.values()) {
    for (const days of REBALANCE_DAYS) {
      for (const variant of variants) {
        const rows = variant === "F Full Production" ? productionRowsForDays(asset, points, days) : rowsForDays(asset, points, days, variant);
        const portfolio = simulatePaperPortfolio({ symbol: asset.symbol, assetType: asset.assetType, candles, replayRows: rows, startingCapital: STARTING_CAPITAL });
        const allocations = rows.map((row) => row.activeAllocation);
        ablationRows.push({
          symbol: asset.symbol,
          days,
          variant,
          totalReturn: pct(portfolio.totalReturn),
          annualizedReturn: pct(portfolio.annualizedReturn),
          maxDrawdown: pct(portfolio.maxDrawdown),
          volatility: pct(portfolio.annualizedVolatility),
          sharpe: ratio(portfolio.sharpeRatio),
          sortino: ratio(portfolio.sortinoRatio),
          calmar: ratio(portfolio.calmarRatio),
          tradeCount: portfolio.totalTrades,
          winRate: pct(portfolio.winRate),
          expectancy: pct(portfolio.expectancyAfterCosts),
          avgAllocation: pct(avg(allocations)),
          medianAllocation: pct(median(allocations)),
          maxAllocation: pct(Math.max(...allocations)),
          timeInvested: pct(portfolio.exposurePercentage),
          zeroAllocation: pct(rows.filter((row) => row.activeAllocation === 0).length / Math.max(1, rows.length)),
          benchmarkReturn: pct(benchmarkReturn(candles))
        });
      }
    }
  }
  printTable("Constraint ablation table", ablationRows);

  const validationRows: Array<Record<string, string | number>> = [];
  for (const { asset, points } of datasets.values()) {
    const sampled = [points[0], points[Math.floor(points.length / 2)], points.at(-1)].filter((point): point is AnalysisPoint => Boolean(point));
    for (const point of sampled) {
      validationRows.push({
        symbol: asset.symbol,
        date: point.candle.date,
        candlesAvailable: point.availableCandles,
        backtestTrades: point.backtestTrades,
        oosTrades: point.validationOosTrades,
        walkForwardWindows: point.validationWalkForwardWindows,
        validationScore: point.validationScore,
        robustness: point.validationRobustness,
        reason: validationReason(point)
      });
    }
  }
  printTable("Validation compatibility sample", validationRows);

  const warmupRows: Array<Record<string, string | number>> = [];
  for (const { asset, candles, points } of datasets.values()) {
    for (const years of WARMUP_YEARS) {
      const startIndex = yearIndex(candles, years);
      const rows = productionRowsForDays(asset, points.filter((point) => point.index >= startIndex), 63);
      const portfolio = simulatePaperPortfolio({ symbol: asset.symbol, assetType: asset.assetType, candles, replayRows: rows, startingCapital: STARTING_CAPITAL });
      const validationScores = points.filter((point) => point.index >= startIndex && point.index % 63 === 0).map((point) => point.validationScore);
      const insufficient = points.filter(
        (point) => point.index >= startIndex && point.index % 63 === 0 && point.validationRobustness === "Insufficient Data"
      ).length;
      warmupRows.push({
        symbol: asset.symbol,
        warmupYears: years,
        replayRows: rows.length,
        insufficientValidation: pct(insufficient / Math.max(1, rows.length)),
        averageAllocation: pct(avg(rows.map((row) => row.activeAllocation))),
        totalReturn: pct(portfolio.totalReturn),
        tradeCount: portfolio.totalTrades,
        validationScoreMin: num(Math.min(...validationScores)),
        validationScoreMedian: num(median(validationScores)),
        validationScoreMax: num(Math.max(...validationScores))
      });
    }
  }
  printTable("Warm-up analysis - 63 day production replay", warmupRows);

  const bucketTable: Array<Record<string, string | number>> = [];
  for (const { asset, points } of datasets.values()) {
    for (const days of REBALANCE_DAYS) {
      const rows = productionRowsForDays(asset, points, days);
      const buckets = bucketRows(rows);
      bucketTable.push({
        symbol: asset.symbol,
        days,
        rows: rows.length,
        "0%": buckets.zero,
        ">0-0.25%": buckets.gt0To025,
        "0.25-0.50%": buckets.gt025To050,
        "0.50-1.00%": buckets.gt050To100,
        "1.00-5.00%": buckets.gt100To500,
        ">5.00%": buckets.gt500
      });
    }
  }
  printTable("Allocation practicality buckets - full production", bucketTable);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
