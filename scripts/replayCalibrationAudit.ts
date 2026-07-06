import type { AssetType, MarketDataPoint } from "@/types/asset";
import type { QuantAnalysis } from "@/types/quant";
import { fetchMarketDataWithFallback } from "@/lib/data/marketDataAdapter";
import { DEFAULT_QUANT_CONFIG } from "@/lib/quant/config";
import { runHistoricalDecisionReplay, simulatePaperPortfolio, type ReplayResultRow } from "@/lib/quant/historicalReplay";
import { analyzeMarketData } from "@/lib/quant/scoring";

type AssetSpec = { symbol: string; assetType: AssetType };

type DiagnosticRow = ReplayResultRow & {
  rawAllocation: number;
  volatilityTargetAllocation: number;
  fractionalKellyAllocation: number;
  assetClassMaxAllocation: number;
  drawdownAdjustedAllocation: number;
  rawLimitingConstraint: string;
  validationRobustness: string;
  validationWarnings: string[];
  riskWarnings: string[];
  drawdownLabel: string;
  tradeCount: number;
  outOfSampleTrades: number;
  expectedValuePassed: boolean;
  hardFilterPassed: boolean;
};

const ASSETS: AssetSpec[] = [
  { symbol: "AAPL", assetType: "stock" },
  { symbol: "SPY", assetType: "etf" },
  { symbol: "QQQ", assetType: "etf" },
  { symbol: "BTCUSDT", assetType: "crypto" },
  { symbol: "ETHUSDT", assetType: "crypto" }
];

const REBALANCE_DAYS = [5, 21, 63, 126];
const ALLOCATION_FLOORS = [0, 0.0025, 0.005, 0.01];
const KELLY_FRACTIONS = [0.1, 0.15, 0.25, 0.5];
const STARTING_CAPITAL = 100000;

function pct(value: number): string {
  return `${(value * 100).toFixed(4)}%`;
}

function num(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  return value.toFixed(4);
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

function rawAllocation(analysis: QuantAnalysis): number {
  const sizing = analysis.pipeline.positionSizing;
  return Math.min(
    sizing.volatilityTargetAllocation,
    sizing.fractionalKellyAllocation,
    sizing.assetClassMaxAllocation,
    sizing.drawdownAdjustedAllocation
  );
}

function rawLimiter(analysis: QuantAnalysis): string {
  const sizing = analysis.pipeline.positionSizing;
  const candidates = [
    ["VolatilityTargetAllocation", sizing.volatilityTargetAllocation],
    ["FractionalKellyAllocation", sizing.fractionalKellyAllocation],
    ["AssetClassMaxAllocation", sizing.assetClassMaxAllocation],
    ["DrawdownAdjustedAllocation", sizing.drawdownAdjustedAllocation]
  ] as const;
  return candidates.reduce((lowest, candidate) => (candidate[1] < lowest[1] ? candidate : lowest))[0];
}

function runDiagnosticReplay(asset: AssetSpec, candles: MarketDataPoint[], rebalanceEveryDays: number): DiagnosticRow[] {
  const sorted = sortedCandles(candles);
  const rows: DiagnosticRow[] = [];

  for (let index = 0; index < sorted.length; index += Math.max(1, rebalanceEveryDays)) {
    const candle = sorted[index];
    if (!candle) continue;
    const available = sorted.slice(0, index + 1);
    const analysis = analyzeMarketData(available, asset.assetType, asset.symbol, "balanced");
    const decision = analysis.pipeline.finalDecision;
    const ev = analysis.pipeline.expectedValue;
    const sizing = analysis.pipeline.positionSizing;
    const row: DiagnosticRow = {
      date: candle.date,
      symbol: asset.symbol,
      assetType: asset.assetType,
      finalDecision: decision.decisionLabel,
      activeAllocation: decision.finalPositionSize,
      signalScore: decision.signalScore,
      riskScore: decision.riskScore,
      validationScore: decision.validationScore,
      validationEvidenceState: analysis.pipeline.validation.validationEvidenceState,
      evStatus: ev.expectedValueAfterCosts <= 0 ? "EV failed" : ev.passed ? "EV passed" : "EV limited",
      evAfterCosts: ev.expectedValueAfterCosts,
      kellyAllocation: sizing.fractionalKellyAllocation,
      dataQualityStatus: analysis.pipeline.dataQuality.passed ? "passed" : "failed",
      regimeLabel: analysis.pipeline.signal.regimeLabel,
      blockingReasons: decision.blockingReasons,
      warnings: Array.from(new Set([...decision.warnings, ...ev.warnings])),
      rawAllocation: rawAllocation(analysis),
      volatilityTargetAllocation: sizing.volatilityTargetAllocation,
      fractionalKellyAllocation: sizing.fractionalKellyAllocation,
      assetClassMaxAllocation: sizing.assetClassMaxAllocation,
      drawdownAdjustedAllocation: sizing.drawdownAdjustedAllocation,
      rawLimitingConstraint: rawLimiter(analysis),
      validationRobustness: analysis.pipeline.validation.robustnessLabel,
      validationWarnings: analysis.pipeline.validation.warnings,
      riskWarnings: analysis.pipeline.risk.warnings,
      drawdownLabel: analysis.pipeline.risk.drawdownLabel,
      tradeCount: analysis.backtest.totalTrades,
      outOfSampleTrades: analysis.pipeline.validation.outOfSample.totalTrades,
      expectedValuePassed: ev.passed,
      hardFilterPassed: analysis.pipeline.hardFilters.passed
    };
    rows.push(row);
  }

  return rows;
}

function withKellyFraction<T>(fraction: number, run: () => T): T {
  const previousEquity = DEFAULT_QUANT_CONFIG.kellyFraction;
  const previousCrypto = DEFAULT_QUANT_CONFIG.cryptoKellyFraction;
  DEFAULT_QUANT_CONFIG.kellyFraction = fraction;
  DEFAULT_QUANT_CONFIG.cryptoKellyFraction = fraction;
  try {
    return run();
  } finally {
    DEFAULT_QUANT_CONFIG.kellyFraction = previousEquity;
    DEFAULT_QUANT_CONFIG.cryptoKellyFraction = previousCrypto;
  }
}

function decisionDistribution(rows: ReplayResultRow[]): string {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.finalDecision, (counts.get(row.finalDecision) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => `${label}:${count}`)
    .join("; ");
}

function portfolioForRows(asset: AssetSpec, candles: MarketDataPoint[], rows: ReplayResultRow[]) {
  return simulatePaperPortfolio({
    symbol: asset.symbol,
    assetType: asset.assetType,
    candles,
    replayRows: rows,
    startingCapital: STARTING_CAPITAL
  });
}

function benchmarkReturn(candles: MarketDataPoint[]): number {
  const first = candles[0]?.open ?? candles[0]?.close ?? 0;
  const last = candles.at(-1)?.close ?? first;
  return first === 0 ? 0 : last / first - 1;
}

function zeroedBelowFloor(rows: ReplayResultRow[], floor: number): ReplayResultRow[] {
  return rows.map((row) =>
    row.activeAllocation > 0 && row.activeAllocation < floor
      ? {
          ...row,
          activeAllocation: 0
        }
      : row
  );
}

function isValidationBlocked(row: DiagnosticRow): boolean {
  return (
    row.validationRobustness === "Insufficient Data" ||
    row.validationScore < DEFAULT_QUANT_CONFIG.decisionThresholds.positionAllowedValidationScore ||
    row.validationWarnings.some((warning) => /insufficient|unstable|oos|out-of-sample/i.test(warning)) ||
    row.finalDecision === "Watchlist only"
  );
}

function printTable(title: string, rows: Array<Record<string, string | number>>) {
  console.log(`\n## ${title}`);
  console.table(rows);
}

async function main() {
  const datasets = new Map<string, { asset: AssetSpec; candles: MarketDataPoint[] }>();
  for (const asset of ASSETS) {
    const data = await fetchMarketDataWithFallback({
      symbol: asset.symbol,
      assetType: asset.assetType,
      chartRangeRequested: "max"
    });
    datasets.set(asset.symbol, { asset, candles: sortedCandles(data.backtestCandles) });
  }

  const baseline63 = new Map<string, DiagnosticRow[]>();
  for (const { asset, candles } of datasets.values()) {
    baseline63.set(asset.symbol, runDiagnosticReplay(asset, candles, 63));
  }

  printTable(
    "Allocation bottleneck table - 63 day replay",
    Array.from(baseline63.entries()).map(([symbol, rows]) => {
      const active = rows.map((row) => row.activeAllocation);
      const forcedZero = rows.filter((row) => row.activeAllocation === 0).length;
      return {
        symbol,
        rows: rows.length,
        kellyLimited: pct(rows.filter((row) => row.rawLimitingConstraint === "FractionalKellyAllocation").length / rows.length),
        volatilityLimited: pct(rows.filter((row) => row.rawLimitingConstraint === "VolatilityTargetAllocation").length / rows.length),
        drawdownLimited: pct(rows.filter((row) => row.rawLimitingConstraint === "DrawdownAdjustedAllocation").length / rows.length),
        forcedZero: pct(forcedZero / rows.length),
        validationBlocked: pct(rows.filter(isValidationBlocked).length / rows.length),
        avgRawAllocation: pct(avg(rows.map((row) => row.rawAllocation))),
        avgActiveAllocation: pct(avg(active)),
        medianActiveAllocation: pct(median(active)),
        maxActiveAllocation: pct(Math.max(...active))
      };
    })
  );

  const rebalanceRows: Array<Record<string, string | number>> = [];
  for (const days of REBALANCE_DAYS) {
    for (const { asset, candles } of datasets.values()) {
      const rows = runHistoricalDecisionReplay({
        symbol: asset.symbol,
        assetType: asset.assetType,
        candles,
        rebalanceEveryDays: days
      });
      const portfolio = portfolioForRows(asset, candles, rows);
      rebalanceRows.push({
        symbol: asset.symbol,
        rebalanceDays: days,
        replayRows: rows.length,
        totalTrades: portfolio.totalTrades,
        totalReturn: pct(portfolio.totalReturn),
        maxDrawdown: pct(portfolio.maxDrawdown),
        sharpe: num(portfolio.sharpeRatio),
        sortino: num(portfolio.sortinoRatio),
        calmar: num(portfolio.calmarRatio),
        averageAllocation: pct(portfolio.averageAllocation),
        averageExposure: pct(portfolio.averageAllocation),
        percentTimeInvested: pct(portfolio.exposurePercentage),
        winRate: pct(portfolio.winRate),
        expectancy: pct(portfolio.expectancyAfterCosts),
        benchmarkReturn: pct(benchmarkReturn(candles))
      });
    }
  }
  printTable("Rebalance frequency comparison", rebalanceRows);

  const floorRows: Array<Record<string, string | number>> = [];
  for (const floor of ALLOCATION_FLOORS) {
    for (const { asset, candles } of datasets.values()) {
      const rows = baseline63.get(asset.symbol) ?? [];
      const adjustedRows = zeroedBelowFloor(rows, floor);
      const portfolio = portfolioForRows(asset, candles, adjustedRows);
      floorRows.push({
        symbol: asset.symbol,
        floor: floor === 0 ? "current" : pct(floor),
        activeTradesRemoved: rows.filter((row) => row.activeAllocation > 0 && row.activeAllocation < floor).length,
        averageAllocation: pct(portfolio.averageAllocation),
        totalReturn: pct(portfolio.totalReturn),
        maxDrawdown: pct(portfolio.maxDrawdown),
        tradeCount: portfolio.totalTrades,
        meaningfulChangeVsCurrent: floor === 0 ? "baseline" : Math.abs(portfolio.totalReturn - portfolioForRows(asset, candles, rows).totalReturn) > 0.001 ? "yes" : "no"
      });
    }
  }
  printTable("Allocation floor diagnostic - 63 day replay", floorRows);

  const kellyRows: Array<Record<string, string | number>> = [];
  for (const fraction of KELLY_FRACTIONS) {
    for (const { asset, candles } of datasets.values()) {
      const rows = withKellyFraction(fraction, () =>
        runHistoricalDecisionReplay({
          symbol: asset.symbol,
          assetType: asset.assetType,
          candles,
          rebalanceEveryDays: 63
        })
      );
      const portfolio = portfolioForRows(asset, candles, rows);
      kellyRows.push({
        symbol: asset.symbol,
        kellyFraction: `${fraction.toFixed(2)}x${fraction === 0.5 ? " diagnostic" : ""}`,
        averageAllocation: pct(portfolio.averageAllocation),
        totalReturn: pct(portfolio.totalReturn),
        maxDrawdown: pct(portfolio.maxDrawdown),
        worstDrawdown: pct(portfolio.maxDrawdown),
        zeroAllocationDates: rows.filter((row) => row.activeAllocation === 0).length,
        decisionDistribution: decisionDistribution(rows)
      });
    }
  }
  printTable("Fractional Kelly sensitivity diagnostic - 63 day replay", kellyRows);

  printTable(
    "Validation strictness table - 63 day replay",
    Array.from(baseline63.entries()).map(([symbol, rows]) => ({
      symbol,
      rows: rows.length,
      insufficientValidation: rows.filter((row) => row.validationRobustness === "Insufficient Data").length,
      unstableValidation: rows.filter((row) => row.validationRobustness === "Unstable").length,
      negativeEV: rows.filter((row) => row.evAfterCosts <= 0 || !row.expectedValuePassed).length,
      lowTradeCount: rows.filter((row) => row.tradeCount < DEFAULT_QUANT_CONFIG.validation.minTotalTrades).length,
      riskOffRegime: rows.filter((row) => row.regimeLabel === "Risk-Off" || row.finalDecision === "Risk-off / no trade").length,
      drawdownStress: rows.filter((row) => row.drawdownLabel === "Severe" || row.drawdownLabel === "Risk-Off").length
    }))
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
