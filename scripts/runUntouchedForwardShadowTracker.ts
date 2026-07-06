import { writeFileSync } from "node:fs";
import type { AssetType, MarketDataPoint } from "@/types/asset";
import type { QuantAnalysis, SampleQuality } from "@/types/quant";
import type { CapitalStarvationDecision } from "@/lib/quant/capitalStarvationAudit";
import { DEFAULT_QUANT_CONFIG } from "@/lib/quant/config";
import { analyzeMarketData } from "@/lib/quant/scoring";
import {
  evaluateUntouchedForwardShadowTracker,
  type AssetDiagnosis,
  type EvidenceBucket,
  type RegimeBucket,
  type RegimeDiagnosis,
  type TrackerGroupBreakdown,
  type TrackerPerformance,
  type UntouchedForwardShadowTrackerResult
} from "@/lib/quant/untouchedForwardShadowTracker";
import { loadAuditDatasets, pct, table } from "./auditShared";

const REBALANCE_EVERY_DAYS = 21;
const PREVIOUS_FORWARD_CUTOFF_BY_SYMBOL: Record<string, string> = {
  SPY: "2026-06-12",
  QQQ: "2026-06-12",
  AAPL: "2026-06-12",
  BTCUSDT: "2026-06-25",
  ETHUSDT: "2026-06-25"
};
const COST_SCENARIOS = [
  { name: "no cost", costPerUnitAllocation: 0 },
  { name: "low cost", costPerUnitAllocation: 0.001 },
  { name: "medium cost", costPerUnitAllocation: 0.004 },
  { name: "high cost", costPerUnitAllocation: 0.008 }
];

function sampleMultiplier(sampleQuality: SampleQuality): number {
  if (sampleQuality === "Poor") return 0;
  if (sampleQuality === "Limited") return 0.25;
  if (sampleQuality === "Acceptable") return 0.75;
  return 1;
}

function kellyBeforeTradeCountHardRule(input: {
  assetType: AssetType;
  winRate: number;
  payoffRatio: number;
  expectedValueAfterCosts: number;
  sampleQuality: SampleQuality;
}): number {
  if (input.expectedValueAfterCosts <= 0 || input.payoffRatio <= 0) return 0;
  const rawKelly = input.winRate - (1 - input.winRate) / input.payoffRatio;
  if (rawKelly <= 0) return 0;
  const fraction = input.assetType === "crypto" ? DEFAULT_QUANT_CONFIG.cryptoKellyFraction : DEFAULT_QUANT_CONFIG.kellyFraction;
  return rawKelly * fraction * sampleMultiplier(input.sampleQuality);
}

function nextPeriodStats(candles: MarketDataPoint[], currentIndex: number, nextIndex: number): {
  nextPeriodReturn: number | null;
  maxAdverseMove: number | null;
  maxFavorableMove: number | null;
} {
  const current = candles[currentIndex];
  const next = candles[nextIndex];
  if (!current || !next || current.close <= 0) return { nextPeriodReturn: null, maxAdverseMove: null, maxFavorableMove: null };
  const path = candles.slice(currentIndex + 1, nextIndex + 1);
  return {
    nextPeriodReturn: next.close / current.close - 1,
    maxAdverseMove: path.length === 0 ? null : Math.min(...path.map((point) => point.low)) / current.close - 1,
    maxFavorableMove: path.length === 0 ? null : Math.max(...path.map((point) => point.high)) / current.close - 1
  };
}

function decisionFromAnalysis(input: {
  symbol: string;
  assetType: AssetType;
  candle: MarketDataPoint;
  analysis: QuantAnalysis;
  nextPeriodReturn: number | null;
  maxAdverseMove: number | null;
  maxFavorableMove: number | null;
}): CapitalStarvationDecision {
  const decision = input.analysis.pipeline.finalDecision;
  const ev = input.analysis.pipeline.expectedValue;
  return {
    date: input.candle.date,
    symbol: input.symbol,
    assetType: input.assetType,
    finalDecision: decision.decisionLabel,
    activeAllocation: decision.finalPositionSize,
    signalScore: decision.signalScore,
    riskScore: decision.riskScore,
    validationScore: decision.validationScore,
    validationEvidenceState: input.analysis.pipeline.validation.validationEvidenceState,
    evAfterCosts: ev.expectedValueAfterCosts,
    evPassed: ev.passed,
    kellyAllocation: input.analysis.pipeline.positionSizing.fractionalKellyAllocation,
    preHardRuleKellyAllocation: kellyBeforeTradeCountHardRule({
      assetType: input.assetType,
      winRate: ev.winRate,
      payoffRatio: ev.payoffRatio,
      expectedValueAfterCosts: ev.expectedValueAfterCosts,
      sampleQuality: ev.sampleQuality
    }),
    tradeCount: ev.tradeCount,
    sampleQuality: ev.sampleQuality,
    dataQualityPassed: input.analysis.pipeline.dataQuality.passed,
    regimeLabel: input.analysis.pipeline.signal.regimeLabel,
    nextPeriodReturn: input.nextPeriodReturn,
    maxAdverseMove: input.maxAdverseMove,
    maxFavorableMove: input.maxFavorableMove,
    blockingReasons: decision.blockingReasons,
    warnings: Array.from(new Set([...decision.warnings, ...ev.warnings, ...input.analysis.pipeline.positionSizing.warnings]))
  };
}

function runDecisionRows(input: { symbol: string; assetType: AssetType; candles: MarketDataPoint[] }): CapitalStarvationDecision[] {
  const rows: CapitalStarvationDecision[] = [];
  for (let index = 0; index < input.candles.length; index += REBALANCE_EVERY_DAYS) {
    const candle = input.candles[index];
    if (!candle) continue;
    const analysis = analyzeMarketData(input.candles.slice(0, index + 1), input.assetType, input.symbol, "balanced");
    const nextIndex = Math.min(input.candles.length - 1, index + REBALANCE_EVERY_DAYS);
    rows.push(
      decisionFromAnalysis({
        symbol: input.symbol,
        assetType: input.assetType,
        candle,
        analysis,
        ...nextPeriodStats(input.candles, index, nextIndex)
      })
    );
  }
  return rows;
}

function ratio(value: number): string {
  if (value === Number.POSITIVE_INFINITY) return "Infinity";
  if (!Number.isFinite(value)) return "n/a";
  return value.toFixed(3);
}

function fmtPerformance(performance: TrackerPerformance): Array<string | number> {
  return [
    pct(performance.totalReturn),
    pct(performance.monthlyReturn),
    pct(performance.maxDrawdown),
    pct(performance.volatility),
    pct(performance.hitRate),
    ratio(performance.profitFactor),
    pct(performance.averageWin),
    pct(performance.averageLoss),
    ratio(performance.payoffRatio),
    pct(performance.expectancy),
    performance.activeDays,
    pct(performance.averageAllocation),
    pct(performance.medianAllocation),
    pct(performance.maximumAllocation),
    pct(performance.percentDaysAtLeast010),
    pct(performance.percentDaysAtLeast025),
    pct(performance.percentDaysAtLeast050),
    pct(performance.percentDaysAtLeast100)
  ];
}

function performanceRows(result: UntouchedForwardShadowTrackerResult): Array<Array<string | number>> {
  return [
    ["production_current", ...fmtPerformance(result.production.performance)],
    ["frozen_floor_0_10", ...fmtPerformance(result.frozen.performance)]
  ];
}

function assetRows(assets: Record<string, AssetDiagnosis>): Array<Array<string | number>> {
  return Object.entries(assets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([symbol, stats]) => [
      symbol,
      pct(stats.totalReturn),
      stats.activeDays,
      pct(stats.hitRate),
      ratio(stats.profitFactor),
      pct(stats.expectancy),
      pct(stats.maxDrawdown),
      pct(stats.worstDecision),
      stats.shouldRemainEligible ? "yes" : "no",
      stats.flags.join(", ") || "none"
    ]);
}

function regimeRows(regimes: Record<RegimeBucket, RegimeDiagnosis>): Array<Array<string | number>> {
  return (["normal/uptrend", "downtrend", "risk-off", "unknown"] as RegimeBucket[]).map((regime) => {
    const stats = regimes[regime];
    return [
      regime,
      pct(stats.totalReturn),
      stats.rows,
      stats.activeDays,
      pct(stats.hitRate),
      ratio(stats.profitFactor),
      pct(stats.expectancy),
      pct(stats.maxDrawdown),
      stats.recommendation
    ];
  });
}

function evidenceRows(evidence: Record<EvidenceBucket, TrackerGroupBreakdown>): Array<Array<string | number>> {
  return (["passed validation", "failed validation", "no evidence", "weak evidence", "strong evidence"] as EvidenceBucket[]).map((bucket) => {
    const stats = evidence[bucket];
    return [
      bucket,
      pct(stats.totalReturn),
      stats.rows,
      stats.activeDays,
      pct(stats.hitRate),
      ratio(stats.profitFactor),
      pct(stats.expectancy),
      pct(stats.maxDrawdown)
    ];
  });
}

function costRows(result: UntouchedForwardShadowTrackerResult): Array<Array<string | number>> {
  return result.costSensitivity.map((cost) => [
    cost.costScenario,
    pct(cost.performance.totalReturn),
    pct(cost.performance.maxDrawdown),
    ratio(cost.performance.profitFactor),
    pct(cost.performance.expectancy),
    pct(cost.performance.averageAllocation),
    cost.survivesEdge ? "survives" : "fails"
  ]);
}

function criteriaRows(result: UntouchedForwardShadowTrackerResult): Array<Array<string | number>> {
  return Object.entries(result.passFail).map(([name, criterion]) => [name, criterion.passed ? "pass" : "fail", criterion.detail]);
}

function killSwitchRows(result: UntouchedForwardShadowTrackerResult): Array<Array<string | number>> {
  return Object.entries(result.killSwitches).map(([name, active]) => [name, active ? "triggered" : "clear"]);
}

function outlierRows(result: UntouchedForwardShadowTrackerResult): Array<Array<string | number>> {
  const outlier = result.outlierDependency;
  return [
    ["Top 1 trade contribution to total profit", pct(outlier.oneTradeContributionShare)],
    ["Top 3 trade contribution to total profit", pct(outlier.top3ContributionShare)],
    ["Top 5 trade contribution to total profit", pct(outlier.top5ContributionShare)],
    ["Profit without best trade", pct(outlier.profitWithoutBestTrade)],
    ["Profit without best 3 trades", pct(outlier.profitWithoutBest3Trades)],
    ["Profit without best 5 trades", pct(outlier.profitWithoutBest5Trades)],
    ["Outlier dependency", outlier.fragile ? "fragile" : "not concentrated"]
  ];
}

function assetFailures(result: UntouchedForwardShadowTrackerResult): string {
  const failures = Object.entries(result.assetBreakdown)
    .filter(([, stats]) => stats.flags.length > 0 || (stats.activeDays > 0 && !stats.shouldRemainEligible))
    .map(([symbol, stats]) => `${symbol}: ${stats.flags.join(", ") || "not eligible"}`);
  return failures.length === 0 ? "none" : failures.join("; ");
}

function regimeFailures(result: UntouchedForwardShadowTrackerResult): string {
  const failures = Object.entries(result.regimeBreakdown)
    .filter(([, stats]) => stats.rows > 0 && stats.recommendation === "disabled")
    .map(([regime]) => regime);
  return failures.length === 0 ? "none" : failures.join(", ");
}

async function main() {
  console.log("ATC UNTOUCHED FORWARD SHADOW TRACKER");
  console.log("Mode: frozen paper-only floor_0_10 tracking. No production sizing changes and no broker execution.");

  const datasets = await loadAuditDatasets();
  const rows: CapitalStarvationDecision[] = [];
  const cutoffRows: Array<Array<string | number>> = [];

  for (const dataset of datasets) {
    console.log(`Building untouched forward rows for ${dataset.asset.symbol}`);
    const assetRowsForSymbol = runDecisionRows({
      symbol: dataset.asset.symbol,
      assetType: dataset.asset.assetType,
      candles: dataset.candles
    });
    rows.push(...assetRowsForSymbol);
    const cutoff = PREVIOUS_FORWARD_CUTOFF_BY_SYMBOL[dataset.asset.symbol] ?? "none";
    const untouched = assetRowsForSymbol.filter((row) => cutoff === "none" || row.date > cutoff);
    cutoffRows.push([
      dataset.asset.symbol,
      cutoff,
      assetRowsForSymbol.length,
      untouched.length,
      untouched[0]?.date ?? "n/a",
      untouched.at(-1)?.date ?? "n/a"
    ]);
  }

  const result = evaluateUntouchedForwardShadowTracker({
    rows,
    previousCutoffBySymbol: PREVIOUS_FORWARD_CUTOFF_BY_SYMBOL,
    costScenarios: COST_SCENARIOS
  });
  const mediumCost = result.costSensitivity.find((cost) => cost.costScenario === "medium cost");

  const markdown = `# ATC Untouched Forward Shadow Tracker Report

## Executive Summary

${result.policyStatement}

- Frozen policy: floor_0_10.
- Allocation floor: 0.10% only when the existing strict shadow safety gates pass.
- Production allocation remains unchanged.
- No optimization was run on this forward tracking window.
- New untouched decision rows: ${result.window.untouchedRows.length}.
- Date range: ${result.window.dateRange}.
- Assets included: ${result.window.assetsIncluded.join(", ") || "none"}.
- Assets excluded: ${result.window.assetsExcluded.join(", ") || "none"}.
- Sample assessment: ${result.window.sampleAssessment}.
- Sample large enough to judge: ${result.window.sampleLargeEnough ? "yes" : "no"}.
- Medium-cost edge survived: ${mediumCost?.survivesEdge ? "yes" : "no"}.
- Outlier dependency: ${result.outlierDependency.fragile ? "fragile" : "not concentrated"}.
- Asset-level failures: ${assetFailures(result)}.
- Regime-level failures: ${regimeFailures(result)}.
- Final verdict: ${result.finalVerdict}

## Frozen Policy Guardrails

This tracker freezes the previously recommended paper-only policy. It does not promote floor_0_10 into production, does not promote floor_1_00, does not connect to broker APIs, and does not place trades.

## Untouched Forward Window

The previous shadow experiment used selection and holdout rows through the cutoffs below. This tracker excludes those rows and only evaluates later rows when available.

${table(["Symbol", "Previous Forward Cutoff", "All Decision Rows", "New Untouched Rows", "First New Row", "Last New Row"], cutoffRows)}

## Production Vs Frozen Shadow

${table(
  [
    "Mode",
    "Total Return",
    "Monthly Return",
    "Max Drawdown",
    "Volatility",
    "Hit Rate",
    "Profit Factor",
    "Avg Win",
    "Avg Loss",
    "Payoff Ratio",
    "Expectancy",
    "Active Days",
    "Avg Allocation",
    "Median Allocation",
    "Max Allocation",
    "% >= 0.10%",
    "% >= 0.25%",
    "% >= 0.50%",
    "% >= 1.00%"
  ],
  performanceRows(result)
)}

## Forward Survival Criteria

These pass/fail criteria are defined before interpreting the untouched result.

${table(["Criterion", "Result", "Rule"], criteriaRows(result))}

## Paper-Only Kill Switches

${table(["Kill Switch", "Status"], killSwitchRows(result))}

## Asset-Level Diagnosis

${table(
  ["Asset", "Total Return", "Active Rows", "Hit Rate", "Profit Factor", "Expectancy", "Max Drawdown", "Worst Decision", "Eligible", "Flags"],
  assetRows(result.assetBreakdown)
)}

## Regime-Level Diagnosis

${table(
  ["Regime", "Total Return", "Rows", "Active Rows", "Hit Rate", "Profit Factor", "Expectancy", "Max Drawdown", "Shadow Action"],
  regimeRows(result.regimeBreakdown)
)}

## Evidence-Grade Diagnosis

${table(
  ["Evidence Status", "Total Return", "Rows", "Active Rows", "Hit Rate", "Profit Factor", "Expectancy", "Max Drawdown"],
  evidenceRows(result.evidenceBreakdown)
)}

- Should failed-evidence rows remain blocked? ${result.evidenceAnswers.failedEvidenceRowsRemainBlocked}
- Should no-evidence rows remain blocked? ${result.evidenceAnswers.noEvidenceRowsRemainBlocked}
- Should soft validation still be researched? ${result.evidenceAnswers.softValidationStillResearch}

## Cost Sensitivity

${table(["Cost Scenario", "Total Return", "Max Drawdown", "Profit Factor", "Expectancy", "Average Allocation", "Edge Survival"], costRows(result))}

## Outlier Dependency

${table(["Metric", "Value"], outlierRows(result))}

## Final Answers

- Should ATC remain paper-only? ${result.answers.shouldRemainPaperOnly}
- Should production allocation remain unchanged? ${result.answers.shouldProductionRemainUnchanged}
- Is floor_0_10 ready for production? ${result.answers.isFloor010ReadyForProduction}
- Is floor_1_00 ready for production? ${result.answers.isFloor100ReadyForProduction}
- Next safest paper-only action: ${result.answers.nextSafestPaperOnlyAction}

## Final Verdict

${result.finalVerdict}
`;

  writeFileSync("ATC_UNTOUCHED_FORWARD_SHADOW_TRACKER_REPORT.md", markdown);

  console.log(`New untouched decision rows: ${result.window.untouchedRows.length}`);
  console.log(`Production current total return: ${pct(result.production.performance.totalReturn)}`);
  console.log(`Frozen floor_0_10 total return: ${pct(result.frozen.performance.totalReturn)}`);
  console.log(`Medium-cost edge survived: ${mediumCost?.survivesEdge ? "yes" : "no"}`);
  console.log(`Outlier dependency: ${result.outlierDependency.fragile ? "yes" : "no"}`);
  console.log(`Asset-level failures: ${assetFailures(result)}`);
  console.log(`Regime-level failures: ${regimeFailures(result)}`);
  console.log(`Final verdict: ${result.finalVerdict}`);
  console.log("Wrote ATC_UNTOUCHED_FORWARD_SHADOW_TRACKER_REPORT.md");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
