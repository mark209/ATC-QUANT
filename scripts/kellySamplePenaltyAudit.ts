import { writeFileSync } from "node:fs";
import type { AssetType, MarketDataPoint } from "../src/types/asset";
import type { DecisionLabel, QuantAnalysis, SampleQuality } from "../src/types/quant";
import { fetchMarketDataWithFallback } from "../src/lib/data/marketDataAdapter";
import { DEFAULT_QUANT_CONFIG } from "../src/lib/quant/config";
import { simulatePaperPortfolio, type ReplayResultRow } from "../src/lib/quant/historicalReplay";
import { calculatePositionSizing } from "../src/lib/quant/positionSizing";
import { analyzeMarketData } from "../src/lib/quant/scoring";
import { buildFinalDecision } from "../src/lib/quant/decisionEngine";

type AssetSpec = { symbol: string; assetType: AssetType };
type VariantKey = "production" | "softBelow30" | "curve";

interface KellyStages {
  rawKelly: number;
  afterKellyFraction: number;
  tradeCountMultiplier: number;
  afterTradeCountMultiplier: number;
  sampleQualityMultiplier: number;
  afterSampleQualityMultiplier: number;
  assetCap: number;
  afterAssetCap: number;
  finalFractionalKellyAllocation: number;
}

interface AuditRow extends ReplayResultRow {
  analysis: QuantAnalysis;
  finalPositionSize: number;
  volatilityTargetAllocation: number;
  fractionalKellyAllocation: number;
  assetClassMaxAllocation: number;
  drawdownAdjustedAllocation: number;
  winRate: number;
  payoffRatio: number;
  tradeCount: number;
  sampleQuality: SampleQuality;
  evAverageTradeCost: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  productionStages: KellyStages;
}

interface VariantRow extends ReplayResultRow {
  finalPositionSize: number;
  fractionalKellyAllocation: number;
}

const ASSETS: AssetSpec[] = [
  { symbol: "AAPL", assetType: "stock" },
  { symbol: "SPY", assetType: "etf" },
  { symbol: "QQQ", assetType: "etf" },
  { symbol: "BTCUSDT", assetType: "crypto" },
  { symbol: "ETHUSDT", assetType: "crypto" }
];

const REBALANCE_DAYS = 63;
const STARTING_CAPITAL = 100000;
const ACTIVE_LABELS = new Set<DecisionLabel>(["Strong candidate", "Position allowed", "Small allocation only"]);
const VARIANTS: Array<{ key: VariantKey; label: string }> = [
  { key: "production", label: "Current production Kelly" },
  { key: "softBelow30", label: "Diagnostic soft penalty below 30 trades only" },
  { key: "curve", label: "Diagnostic full trade-count curve" }
];

function pct(value: number): string {
  return `${(value * 100).toFixed(4)}%`;
}

function pct2(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function num(value: number, digits = 4): string {
  if (!Number.isFinite(value)) return "Not meaningful";
  return value.toFixed(digits);
}

function average(values: number[]): number {
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

function sampleMultiplier(sampleQuality?: SampleQuality): number {
  if (sampleQuality === "Poor") return 0;
  if (sampleQuality === "Limited") return 0.25;
  if (sampleQuality === "Acceptable") return 0.75;
  return 1;
}

function productionTradeCountMultiplier(tradeCount?: number): number {
  if (typeof tradeCount !== "number") return 1;
  if (tradeCount < DEFAULT_QUANT_CONFIG.validation.minTotalTrades) return 0;
  if (tradeCount < DEFAULT_QUANT_CONFIG.limitedSampleTradeCount) return 0.35;
  return 1;
}

function diagnosticSoftBelow30Multiplier(tradeCount?: number): number {
  if (typeof tradeCount !== "number") return 1;
  if (tradeCount < 10) return 0;
  if (tradeCount < 20) return 0.1;
  if (tradeCount < 30) return 0.2;
  return productionTradeCountMultiplier(tradeCount);
}

function diagnosticCurveMultiplier(tradeCount?: number): number {
  if (typeof tradeCount !== "number") return 1;
  if (tradeCount < 10) return 0;
  if (tradeCount < 20) return 0.1;
  if (tradeCount < 30) return 0.2;
  if (tradeCount < 50) return 0.35;
  if (tradeCount < 100) return 0.6;
  if (tradeCount < 200) return 0.8;
  return 1;
}

function tradeCountMultiplierForVariant(variant: VariantKey, tradeCount?: number): number {
  if (variant === "softBelow30") return diagnosticSoftBelow30Multiplier(tradeCount);
  if (variant === "curve") return diagnosticCurveMultiplier(tradeCount);
  return productionTradeCountMultiplier(tradeCount);
}

function rawKelly(winRate: number, payoffRatio: number, expectedValueAfterCosts: number): number {
  if (expectedValueAfterCosts <= 0) return 0;
  if (payoffRatio <= 0) return 0;
  return winRate - (1 - winRate) / payoffRatio;
}

function assetClassCap(assetType: AssetType, symbol: string): number {
  const normalized = symbol.toUpperCase();
  if (assetType === "crypto") {
    if (normalized.includes("BTC") || normalized.includes("ETH")) return DEFAULT_QUANT_CONFIG.maxBTCEthAllocation;
    return DEFAULT_QUANT_CONFIG.maxAltcoinAllocation;
  }
  if (assetType === "etf") return DEFAULT_QUANT_CONFIG.maxETFAllocation;
  if (assetType === "index") return DEFAULT_QUANT_CONFIG.maxIndexAllocation;
  return DEFAULT_QUANT_CONFIG.maxEquityAllocation;
}

function kellyStages(input: {
  assetType: AssetType;
  symbol: string;
  winRate: number;
  payoffRatio: number;
  expectedValueAfterCosts: number;
  sampleQuality: SampleQuality;
  tradeCount: number;
  variant: VariantKey;
}): KellyStages {
  const raw = Math.max(0, rawKelly(input.winRate, input.payoffRatio, input.expectedValueAfterCosts));
  const fraction = input.assetType === "crypto" ? DEFAULT_QUANT_CONFIG.cryptoKellyFraction : DEFAULT_QUANT_CONFIG.kellyFraction;
  const afterKellyFraction = raw * fraction;
  const tradeMultiplier = tradeCountMultiplierForVariant(input.variant, input.tradeCount);
  const afterTrade = afterKellyFraction * tradeMultiplier;
  const sampleQualityMultiplier = sampleMultiplier(input.sampleQuality);
  const afterSample = afterTrade * sampleQualityMultiplier;
  const cap = assetClassCap(input.assetType, input.symbol);
  return {
    rawKelly: raw,
    afterKellyFraction,
    tradeCountMultiplier: tradeMultiplier,
    afterTradeCountMultiplier: afterTrade,
    sampleQualityMultiplier,
    afterSampleQualityMultiplier: afterSample,
    assetCap: cap,
    afterAssetCap: Math.min(afterSample, cap),
    finalFractionalKellyAllocation: Math.max(0, afterSample)
  };
}

function activeAllocation(decision: string, finalPositionSize: number): number {
  return ACTIVE_LABELS.has(decision as DecisionLabel) ? finalPositionSize : 0;
}

function rowFromAnalysis(asset: AssetSpec, candle: MarketDataPoint, analysis: QuantAnalysis): AuditRow {
  const ev = analysis.pipeline.expectedValue;
  const sizing = analysis.pipeline.positionSizing;
  const decision = analysis.pipeline.finalDecision;
  const productionStages = kellyStages({
    assetType: asset.assetType,
    symbol: asset.symbol,
    winRate: ev.winRate,
    payoffRatio: ev.payoffRatio,
    expectedValueAfterCosts: ev.expectedValueAfterCosts,
    sampleQuality: ev.sampleQuality,
    tradeCount: ev.tradeCount,
    variant: "production"
  });

  return {
    date: candle.date,
    symbol: asset.symbol,
    assetType: asset.assetType,
    finalDecision: decision.decisionLabel,
    activeAllocation: activeAllocation(decision.decisionLabel, decision.finalPositionSize),
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
    analysis,
    finalPositionSize: decision.finalPositionSize,
    volatilityTargetAllocation: sizing.volatilityTargetAllocation,
    fractionalKellyAllocation: sizing.fractionalKellyAllocation,
    assetClassMaxAllocation: sizing.assetClassMaxAllocation,
    drawdownAdjustedAllocation: sizing.drawdownAdjustedAllocation,
    winRate: ev.winRate,
    payoffRatio: ev.payoffRatio,
    tradeCount: ev.tradeCount,
    sampleQuality: ev.sampleQuality,
    evAverageTradeCost: ev.costs.averageTradeCost,
    averageWin: ev.averageWin,
    averageLoss: ev.averageLoss,
    profitFactor: ev.profitFactor,
    productionStages
  };
}

function runReplay(asset: AssetSpec, candles: MarketDataPoint[]): AuditRow[] {
  const rows: AuditRow[] = [];
  for (let index = 0; index < candles.length; index += REBALANCE_DAYS) {
    const candle = candles[index];
    if (!candle) continue;
    const available = candles.slice(0, index + 1);
    const analysis = analyzeMarketData(available, asset.assetType, asset.symbol, "balanced");
    rows.push(rowFromAnalysis(asset, candle, analysis));
  }
  return rows;
}

function variantRow(row: AuditRow, variant: VariantKey): VariantRow {
  const analysis = row.analysis;
  const stages = kellyStages({
    assetType: row.assetType,
    symbol: row.symbol,
    winRate: row.winRate,
    payoffRatio: row.payoffRatio,
    expectedValueAfterCosts: row.evAfterCosts,
    sampleQuality: row.sampleQuality,
    tradeCount: row.tradeCount,
    variant
  });
  const sizing = calculatePositionSizing({
    assetType: row.assetType,
    symbol: row.symbol,
    realizedVolatility: analysis.riskMetrics.annualizedVolatility,
    currentDrawdown: analysis.riskMetrics.currentDrawdown,
    winRate: row.winRate,
    payoffRatio: row.payoffRatio,
    expectedValueAfterCosts: row.evAfterCosts,
    tradeCount: row.tradeCount,
    outOfSampleTrades: analysis.pipeline.validation.outOfSample.totalTrades,
    sampleQuality: row.sampleQuality,
    riskProfile: "balanced"
  });
  const finalBeforeDecision = Math.max(
    0,
    Math.min(
      sizing.volatilityTargetAllocation,
      stages.finalFractionalKellyAllocation,
      sizing.assetClassMaxAllocation,
      sizing.drawdownAdjustedAllocation
    )
  );
  const decision = buildFinalDecision({
    dataQualityPassed: analysis.pipeline.dataQuality.passed,
    hardFiltersPassed: analysis.pipeline.hardFilters.passed,
    hardFilterBlockingReason: analysis.pipeline.hardFilters.blockingReason,
    regimeLabel: analysis.pipeline.signal.regimeLabel,
    expectedValuePassed: analysis.pipeline.expectedValue.passed,
    signalScore: analysis.pipeline.signal.combinedSignalScore,
    riskScore: analysis.pipeline.risk.combinedRiskScore,
    validationScore: analysis.pipeline.validation.validationScore,
    validationEvidenceState: analysis.pipeline.validation.validationEvidenceState,
    liquidityScore: analysis.pipeline.risk.liquidityScore,
    finalPositionSize: finalBeforeDecision,
    riskWarnings: analysis.pipeline.risk.warnings,
    validationWarnings: analysis.pipeline.validation.warnings,
    portfolioWarnings: [
      ...analysis.pipeline.portfolioRisk.warnings,
      ...analysis.pipeline.portfolioRisk.correlatedExposureWarnings
    ],
    primaryReasons: analysis.pipeline.signal.reasons,
    blockingReasons: analysis.pipeline.hardFilters.failedFilters
  });

  return {
    date: row.date,
    symbol: row.symbol,
    assetType: row.assetType,
    finalDecision: decision.decisionLabel,
    activeAllocation: activeAllocation(decision.decisionLabel, decision.finalPositionSize),
    signalScore: decision.signalScore,
    riskScore: decision.riskScore,
    validationScore: decision.validationScore,
    validationEvidenceState: row.validationEvidenceState,
    evStatus: row.evStatus,
    evAfterCosts: row.evAfterCosts,
    kellyAllocation: stages.finalFractionalKellyAllocation,
    dataQualityStatus: row.dataQualityStatus,
    regimeLabel: row.regimeLabel,
    blockingReasons: decision.blockingReasons,
    warnings: decision.warnings,
    finalPositionSize: decision.finalPositionSize,
    fractionalKellyAllocation: stages.finalFractionalKellyAllocation
  };
}

function countWhere(rows: AuditRow[], predicate: (row: AuditRow) => boolean): number {
  return rows.filter(predicate).length;
}

function bucketTradeCount(tradeCount: number): string {
  if (tradeCount < 10) return "0-9";
  if (tradeCount < 20) return "10-19";
  if (tradeCount < 30) return "20-29";
  if (tradeCount < 50) return "30-49";
  if (tradeCount < 100) return "50-99";
  if (tradeCount < 200) return "100-199";
  return "200+";
}

function bucketAllocation(value: number): string {
  if (value === 0) return "0%";
  if (value < 0.0025) return ">0% to 0.25%";
  if (value < 0.005) return "0.25% to 0.50%";
  if (value < 0.01) return "0.50% to 1.00%";
  if (value < 0.02) return "1.00% to 2.00%";
  if (value <= 0.05) return "2.00% to 5.00%";
  return ">5.00%";
}

function countLabels<T extends string>(values: T[], labels: T[]): Record<T, number> {
  const counts = Object.fromEntries(labels.map((label) => [label, 0])) as Record<T, number>;
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function distribution(counts: Record<string, number>, total: number): string {
  return Object.entries(counts)
    .map(([label, count]) => `${label}: ${count} (${pct(count / Math.max(1, total))})`)
    .join("<br>");
}

function table(headers: string[], rows: Array<Array<string | number>>): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`)
  ].join("\n");
}

function primaryZeroReason(row: AuditRow): string {
  if (row.fractionalKellyAllocation !== 0) return "Nonzero Kelly";
  const raw = row.productionStages.rawKelly;
  if (row.evAfterCosts <= 0) return "EV after costs <= 0";
  if (row.payoffRatio <= 0) return "payoffRatio <= 0";
  if (raw <= 0) return "raw Kelly <= 0";
  if (row.tradeCount < DEFAULT_QUANT_CONFIG.validation.minTotalTrades) return "tradeCount < minTotalTrades";
  if (row.sampleQuality === "Poor") return "sampleQuality === Poor";
  if (row.assetClassMaxAllocation <= 0) return "asset-specific cap";
  return "other reason";
}

function recklessAssessment(rows: VariantRow[], portfolio: ReturnType<typeof simulatePaperPortfolio>): string {
  const maxAllocation = Math.max(0, ...rows.map((row) => row.activeAllocation));
  const averageAllocation = average(rows.map((row) => row.activeAllocation));
  if (maxAllocation > 0.05 || averageAllocation > 0.02 || portfolio.maxDrawdown <= -0.1) return "Potentially reckless";
  return "No, exposure stayed small";
}

async function main() {
  const datasets = new Map<string, { asset: AssetSpec; candles: MarketDataPoint[] }>();
  for (const asset of ASSETS) {
    console.log(`Fetching ${asset.symbol}`);
    const data = await fetchMarketDataWithFallback({
      symbol: asset.symbol,
      assetType: asset.assetType,
      chartRangeRequested: "max"
    });
    datasets.set(asset.symbol, { asset, candles: sortedCandles(data.backtestCandles) });
  }

  const rowsByAsset = new Map<string, AuditRow[]>();
  for (const { asset, candles } of datasets.values()) {
    console.log(`Running ${asset.symbol} ${REBALANCE_DAYS}-day Kelly audit over ${candles.length} candles`);
    rowsByAsset.set(asset.symbol, runReplay(asset, candles));
  }

  const zeroRows: Array<Array<string | number>> = [];
  const shrinkRows: Array<Array<string | number>> = [];
  const tradeRows: Array<Array<string | number>> = [];
  const sampleRows: Array<Array<string | number>> = [];
  const allocationRows: Array<Array<string | number>> = [];
  const evRows: Array<Array<string | number>> = [];
  const rawRows: Array<Array<string | number>> = [];
  const counterfactualRows: Array<Array<string | number>> = [];
  const inspectedRows: Array<Array<string | number>> = [
    ["src/lib/quant/positionSizing.ts", "fractionalKelly, calculatePositionSizing, sampleMultiplier, tradeCountMultiplier"],
    ["src/lib/quant/config.ts", "minTotalTrades, limitedSampleTradeCount, Kelly fractions, asset caps, decision thresholds"],
    ["src/lib/quant/scoring.ts", "analyzeMarketData data flow from backtest trades to EV to sizing to final decision"],
    ["src/lib/quant/expectedValue.ts", "sampleQuality, confidenceMultiplier, calculateExpectedValueFromTrades"],
    ["src/lib/quant/backtest.ts", "runTrendBacktest closed-trade generation and net returns"],
    ["src/lib/quant/historicalReplay.ts", "simulatePaperPortfolio and active allocation replay"],
    ["tests/quant/positionSizing.test.ts", "Kelly hard-zero and sizing constraints tests"],
    ["tests/quant/expectedValue.test.ts", "EV/sample quality/payoff tests"],
    ["tests/quant/scoring.test.ts", "trade-derived EV and allocation-adjusted backtest tests"]
  ];

  for (const asset of ASSETS) {
    const rows = rowsByAsset.get(asset.symbol) ?? [];
    const zeroKellyRows = rows.filter((row) => row.fractionalKellyAllocation === 0);
    const primaryCounts = countLabels(
      zeroKellyRows.map((row) => primaryZeroReason(row)),
      [
        "EV after costs <= 0",
        "payoffRatio <= 0",
        "raw Kelly <= 0",
        "tradeCount < minTotalTrades",
        "sampleQuality === Poor",
        "asset-specific cap",
        "other reason"
      ]
    );
    zeroRows.push([
      asset.symbol,
      rows.length,
      `${zeroKellyRows.length} (${pct(zeroKellyRows.length / Math.max(1, rows.length))})`,
      distribution(primaryCounts, rows.length)
    ]);

    const positiveRawRows = rows.filter((row) => row.productionStages.rawKelly > 0);
    shrinkRows.push([
      asset.symbol,
      positiveRawRows.length,
      pct(average(positiveRawRows.map((row) => row.productionStages.rawKelly))),
      pct(median(positiveRawRows.map((row) => row.productionStages.rawKelly))),
      pct(average(positiveRawRows.map((row) => row.productionStages.afterKellyFraction))),
      pct(average(positiveRawRows.map((row) => row.productionStages.afterTradeCountMultiplier))),
      pct(average(positiveRawRows.map((row) => row.productionStages.afterSampleQualityMultiplier))),
      pct(average(positiveRawRows.map((row) => row.productionStages.afterAssetCap))),
      pct(average(positiveRawRows.map((row) => row.fractionalKellyAllocation)))
    ]);

    const tradeCounts = countLabels(rows.map((row) => bucketTradeCount(row.tradeCount)), [
      "0-9",
      "10-19",
      "20-29",
      "30-49",
      "50-99",
      "100-199",
      "200+"
    ]);
    tradeRows.push([asset.symbol, rows.length, distribution(tradeCounts, rows.length), num(average(rows.map((row) => row.tradeCount)), 2)]);

    const sampleCounts = countLabels(rows.map((row) => row.sampleQuality), ["Poor", "Limited", "Acceptable", "Strong"]);
    sampleRows.push([asset.symbol, rows.length, distribution(sampleCounts, rows.length)]);

    const allocationCounts = countLabels(rows.map((row) => bucketAllocation(row.activeAllocation)), [
      "0%",
      ">0% to 0.25%",
      "0.25% to 0.50%",
      "0.50% to 1.00%",
      "1.00% to 2.00%",
      "2.00% to 5.00%",
      ">5.00%"
    ]);
    allocationRows.push([asset.symbol, rows.length, distribution(allocationCounts, rows.length)]);

    evRows.push([
      asset.symbol,
      `${countWhere(rows, (row) => row.evAfterCosts <= 0)} (${pct(countWhere(rows, (row) => row.evAfterCosts <= 0) / Math.max(1, rows.length))})`,
      pct(average(rows.map((row) => row.evAfterCosts))),
      pct(median(rows.map((row) => row.evAfterCosts))),
      pct(average(rows.map((row) => row.averageWin))),
      pct(average(rows.map((row) => row.averageLoss))),
      num(average(rows.map((row) => row.payoffRatio)), 4),
      num(average(rows.map((row) => row.profitFactor)), 4),
      pct(average(rows.map((row) => row.evAverageTradeCost)))
    ]);

    rawRows.push([
      asset.symbol,
      `${countWhere(rows, (row) => row.payoffRatio <= 0)} (${pct(countWhere(rows, (row) => row.payoffRatio <= 0) / Math.max(1, rows.length))})`,
      `${countWhere(rows, (row) => row.productionStages.rawKelly <= 0)} (${pct(countWhere(rows, (row) => row.productionStages.rawKelly <= 0) / Math.max(1, rows.length))})`,
      `${countWhere(rows, (row) => row.productionStages.rawKelly > 0 && row.fractionalKellyAllocation === 0)} (${pct(countWhere(rows, (row) => row.productionStages.rawKelly > 0 && row.fractionalKellyAllocation === 0) / Math.max(1, rows.length))})`,
      pct(Math.max(0, ...rows.map((row) => row.productionStages.rawKelly))),
      pct(Math.max(0, ...rows.map((row) => row.fractionalKellyAllocation)))
    ]);

    const dataset = datasets.get(asset.symbol);
    if (!dataset) continue;
    for (const variant of VARIANTS) {
      const variantRows = rows.map((row) => variantRow(row, variant.key));
      const portfolio = simulatePaperPortfolio({
        symbol: asset.symbol,
        assetType: asset.assetType,
        candles: dataset.candles,
        replayRows: variantRows,
        startingCapital: STARTING_CAPITAL
      });
      counterfactualRows.push([
        asset.symbol,
        variant.label,
        pct(average(variantRows.map((row) => row.fractionalKellyAllocation))),
        pct(average(variantRows.map((row) => row.finalPositionSize))),
        pct(average(variantRows.map((row) => row.activeAllocation))),
        pct(variantRows.filter((row) => row.activeAllocation > 0).length / Math.max(1, variantRows.length)),
        pct(variantRows.filter((row) => row.activeAllocation >= 0.0025).length / Math.max(1, variantRows.length)),
        pct(variantRows.filter((row) => row.activeAllocation >= 0.005).length / Math.max(1, variantRows.length)),
        pct(variantRows.filter((row) => row.activeAllocation >= 0.01).length / Math.max(1, variantRows.length)),
        pct(portfolio.totalReturn),
        pct(portfolio.maxDrawdown),
        portfolio.totalTrades,
        recklessAssessment(variantRows, portfolio)
      ]);
    }
  }

  const allRows = ASSETS.flatMap((asset) => rowsByAsset.get(asset.symbol) ?? []);
  const allZeroKellyRows = allRows.filter((row) => row.fractionalKellyAllocation === 0);
  const rawPositiveCrushed = allRows.filter((row) => row.productionStages.rawKelly > 0 && row.fractionalKellyAllocation === 0);
  const below30 = allRows.filter((row) => row.tradeCount < DEFAULT_QUANT_CONFIG.validation.minTotalTrades);
  const limited = allRows.filter(
    (row) =>
      row.tradeCount >= DEFAULT_QUANT_CONFIG.validation.minTotalTrades &&
      row.tradeCount < DEFAULT_QUANT_CONFIG.limitedSampleTradeCount
  );

  const markdown = `# Kelly Sample Penalty Audit

## 1. Executive Summary

This is a diagnostic-only audit. Production strategy behavior was not changed.

- The current Kelly path can hard-zero allocation at multiple layers: non-positive EV after costs, non-positive payoff ratio, non-positive raw Kelly, production trade count below ${DEFAULT_QUANT_CONFIG.validation.minTotalTrades}, and sampleQuality === "Poor".
- The trade-count hard-zero and Poor sample-quality hard-zero are effectively duplicative because sampleQuality is assigned from the same 30-trade boundary.
- Across the inspected ${allRows.length} replay rows, ${allZeroKellyRows.length} rows (${pct(allZeroKellyRows.length / Math.max(1, allRows.length))}) had zero production fractional Kelly.
- ${rawPositiveCrushed.length} rows (${pct(rawPositiveCrushed.length / Math.max(1, allRows.length))}) had positive raw Kelly before penalties but were crushed to zero by the production penalty stack.
- ${below30.length} rows (${pct(below30.length / Math.max(1, allRows.length))}) were below 30 trades. ${limited.length} rows (${pct(limited.length / Math.max(1, allRows.length))}) were in the 30-99 limited-sample band.
- Counterfactuals are diagnostic only. They keep EV-negative hard-zero, payoffRatio <= 0 hard-zero, crypto's stricter Kelly fraction, crypto caps, hard filters, validation evidence, and final decision gating.

## 2. Files and Functions Inspected

${table(["File", "Relevant functions/config"], inspectedRows)}

## 3. Exact Kelly Formula Path

\`analyzeMarketData\` runs \`runTrendBacktest(backtestCandles, assetType, feeRate, slippageRate)\`. The backtest creates closed net trades. \`calculateExpectedValueFromTrades(fullBacktest.trades)\` derives win rate, payoff ratio, EV after costs, trade count, and sampleQuality from those closed net trades. \`calculatePositionSizing\` then calls \`fractionalKelly\`.

Production formula:

\`\`\`text
if expectedValueAfterCosts <= 0: Kelly = 0
if payoffRatio <= 0: Kelly = 0
rawKelly = winRate - ((1 - winRate) / payoffRatio)
if rawKelly <= 0: Kelly = 0
fraction = crypto ? cryptoKellyFraction(0.10) : kellyFraction(0.20)
fractionalKellyAllocation =
  rawKelly
  * fraction
  * sampleMultiplier(sampleQuality)
  * tradeCountMultiplier(tradeCount)

finalPositionSizeBeforeDecision = min(
  volatilityTargetAllocation,
  fractionalKellyAllocation,
  assetClassMaxAllocation,
  drawdownAdjustedAllocation
)

final active allocation is then gated by buildFinalDecision.
\`\`\`

## 4. Kelly Hard-Zero Conditions

- \`expectedValueAfterCosts <= 0\` in \`fractionalKelly\`.
- \`payoffRatio <= 0\` in \`fractionalKelly\`.
- \`rawKelly <= 0\` in \`fractionalKelly\`.
- \`tradeCount < DEFAULT_QUANT_CONFIG.validation.minTotalTrades\`, currently ${DEFAULT_QUANT_CONFIG.validation.minTotalTrades}, through \`tradeCountMultiplier(...)=0\`.
- \`sampleQuality === "Poor"\` through \`sampleMultiplier(...)=0\`.
- Asset-specific caps do not currently hard-zero Kelly for the audited assets because their caps are nonzero. Caps can limit final position size after Kelly.

## 5. Kelly Shrink Multipliers

- Equity/ETF/index Kelly fraction: ${DEFAULT_QUANT_CONFIG.kellyFraction}.
- Crypto Kelly fraction: ${DEFAULT_QUANT_CONFIG.cryptoKellyFraction}.
- sampleQuality Poor: 0x.
- sampleQuality Limited: 0.25x.
- sampleQuality Acceptable: 0.75x.
- sampleQuality Strong: 1.00x.
- tradeCount < ${DEFAULT_QUANT_CONFIG.validation.minTotalTrades}: 0x.
- tradeCount ${DEFAULT_QUANT_CONFIG.validation.minTotalTrades}-${DEFAULT_QUANT_CONFIG.limitedSampleTradeCount - 1}: 0.35x.
- tradeCount >= ${DEFAULT_QUANT_CONFIG.limitedSampleTradeCount}: 1.00x.

## 6. Asset-by-Asset Kelly Zero Attribution

The table uses a mutually exclusive primary attribution order: EV <= 0, payoffRatio <= 0, raw Kelly <= 0, tradeCount < minTotalTrades, sampleQuality Poor, asset cap, other. Conditions can overlap, especially tradeCount < 30 and sampleQuality Poor.

${table(["Symbol", "Rows", "Zero Kelly Rows", "Primary Zero Attribution"], zeroRows)}

## 7. Asset-by-Asset Kelly Shrink Attribution

Rows here are limited to replay rows where raw Kelly was positive before penalties.

${table(
  [
    "Symbol",
    "Raw Kelly > 0 Rows",
    "Avg Raw Kelly",
    "Median Raw Kelly",
    "Avg After Asset Kelly Fraction",
    "Avg After Trade-Count Multiplier",
    "Avg After Sample-Quality Multiplier",
    "Avg After Asset Cap",
    "Final FractionalKellyAllocation"
  ],
  shrinkRows
)}

## 8. Trade Count Distribution

${table(["Symbol", "Rows", "Trade Count Distribution", "Average Trade Count"], tradeRows)}

## 9. Sample Quality Distribution

${table(["Symbol", "Rows", "Sample Quality Distribution"], sampleRows)}

## 10. EV After Costs Diagnostics

EV is still correctly trade-derived from closed net backtest trades through \`calculateExpectedValueFromTrades(fullBacktest.trades)\`. In this path, trade fees and slippage have already been reflected in each trade's \`netReturnPct\`; \`expectedValue.costs.averageTradeCost\` is reported from the realized closed trades for audit visibility.

${table(
  [
    "Symbol",
    "EV After Costs <= 0",
    "Avg EV After Costs",
    "Median EV After Costs",
    "Avg Win",
    "Avg Loss",
    "Avg Payoff Ratio",
    "Avg Profit Factor",
    "Avg Trade Cost"
  ],
  evRows
)}

## 11. Payoff Ratio and Raw Kelly Diagnostics

${table(
  [
    "Symbol",
    "Payoff Ratio <= 0",
    "Raw Kelly <= 0",
    "Raw Kelly > 0 But Final Kelly = 0",
    "Max Raw Kelly",
    "Max Final Kelly"
  ],
  rawRows
)}

## 12. Allocation Impact

Buckets use active allocation after final decision gating.

${table(["Symbol", "Rows", "Active Allocation Bucket Distribution"], allocationRows)}

## 13. Counterfactual Replay Results

Counterfactual variants:

1. Current production Kelly.
2. Remove only the tradeCount < 30 hard-zero and replace that trade-count portion with a diagnostic soft penalty: <10 = 0, 10-19 = 0.10, 20-29 = 0.20, then production multipliers above 30.
3. Replace the trade-count cliff with the diagnostic curve: <10 = 0, 10-19 = 0.10, 20-29 = 0.20, 30-49 = 0.35, 50-99 = 0.60, 100-199 = 0.80, 200+ = 1.00.

All variants keep EV-negative hard-zero, payoffRatio <= 0 hard-zero, sampleQuality production multipliers, crypto's stricter Kelly fraction, crypto caps, hard filters, validation evidence, and final decision gating.

${table(
  [
    "Symbol",
    "Variant",
    "Avg FractionalKellyAllocation",
    "Avg finalPositionSize",
    "Avg activeAllocation",
    "% active > 0",
    "% active >= 0.25%",
    "% active >= 0.50%",
    "% active >= 1.00%",
    "Total Return",
    "Max Drawdown",
    "Trades",
    "Exposure Reckless?"
  ],
  counterfactualRows
)}

## 14. Is the Hard-Zero Below 30 Trades Justified?

It is justified as a safety rule, but it is too cliff-like as a sizing rule for a low-frequency trend-following system. The audit shows the 30-trade boundary is applied twice: first by \`tradeCountMultiplier\`, and again by \`sampleQuality === "Poor"\`. Because both derive from the same threshold, removing only the trade-count hard-zero does not fully test whether small positive Kelly would be mathematically justified; Poor sample quality still forces the final Kelly multiplier to zero.

The hard-zero is reasonable when EV is negative, payoff ratio is invalid, or raw Kelly is non-positive. It is less clearly justified when raw Kelly is positive, EV after costs is positive, and the only blocker is a small but nonzero closed-trade sample.

## 15. Is the 100-Trade Limited-Sample Cutoff Too Strict?

The 100-trade cutoff is conservative and cliff-like. Production applies both a Limited sample multiplier of 0.25x and a 30-99 trade-count multiplier of 0.35x, creating a combined 0.0875x multiplier before the base Kelly fraction. For equities/ETFs, that means raw Kelly is multiplied by 0.0175 in the 30-99 band. For crypto, raw Kelly is multiplied by 0.00875. That can easily shrink otherwise positive Kelly below 0.25% or 0.50%.

This may be appropriate for avoiding overconfidence, but it is the main mathematical mechanism behind capital starvation once EV and decision gates are passed.

## 16. Do Equities/ETFs and Crypto Need Separate Kelly Penalty Curves?

Yes, but not by relaxing crypto. Crypto already remains stricter through the lower ${DEFAULT_QUANT_CONFIG.cryptoKellyFraction} Kelly fraction and lower BTC/ETH allocation cap. The audit supports separate curves because equities/ETFs and crypto have different trading calendars, volatility, fee/slippage realities, and drawdown behavior. Any future production change should preserve crypto strictness and evaluate equity/ETF softening separately.

## 17. Recommended Next Action

Do not change Kelly production behavior yet.

The next action should be a targeted design review of the duplicate small-sample gates. Specifically, evaluate whether \`sampleQuality === "Poor"\` should remain a hard-zero if \`tradeCountMultiplier\` already handles the same threshold, or whether one of those should become a graded diagnostic penalty. Keep EV <= 0, payoffRatio <= 0, and rawKelly <= 0 as hard-zero conditions.
`;

  writeFileSync("KELLY_SAMPLE_PENALTY_AUDIT.md", markdown);
  console.log("Wrote KELLY_SAMPLE_PENALTY_AUDIT.md");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
