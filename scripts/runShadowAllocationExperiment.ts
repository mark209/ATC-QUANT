import { writeFileSync } from "node:fs";
import type { AssetType, MarketDataPoint } from "@/types/asset";
import type { QuantAnalysis, SampleQuality } from "@/types/quant";
import type { CapitalStarvationDecision } from "@/lib/quant/capitalStarvationAudit";
import { DEFAULT_QUANT_CONFIG } from "@/lib/quant/config";
import { analyzeMarketData } from "@/lib/quant/scoring";
import {
  evaluateShadowAllocationExperiment,
  recommendShadowMode,
  type ShadowAllocationMode,
  type ShadowModeResult,
  type ShadowPerformance,
  type ShadowRecommendation,
  type ShadowRobustnessBucket
} from "@/lib/quant/shadowAllocationExperiment";
import { loadAuditDatasets, pct, ratio, table } from "./auditShared";

const REBALANCE_EVERY_DAYS = 21;
const SELECTION_FRACTION = 0.7;
const MODES: ShadowAllocationMode[] = [
  "production_current",
  "floor_0_10",
  "floor_0_25",
  "floor_0_50",
  "floor_1_00",
  "soft_validation_penalty",
  "soft_ev_gate",
  "final_zeroing_ablation"
];
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

function splitRows(rows: CapitalStarvationDecision[]): {
  selectionRows: CapitalStarvationDecision[];
  holdoutRows: CapitalStarvationDecision[];
} {
  const splitIndex = Math.max(1, Math.floor(rows.length * SELECTION_FRACTION));
  return {
    selectionRows: rows.slice(0, splitIndex),
    holdoutRows: rows.slice(splitIndex)
  };
}

function fmt(value: number): string {
  return Number.isFinite(value) ? ratio(value) : "n/a";
}

function performanceRows(results: ShadowModeResult[]): Array<Array<string | number>> {
  return results.map((result) => {
    const p = result.performance;
    return [
      result.mode,
      result.warning ?? "",
      pct(p.totalReturn),
      pct(p.monthlyReturn),
      pct(p.maxDrawdown),
      pct(p.volatility),
      fmt(p.sharpeLikeRatio),
      fmt(p.profitFactor),
      pct(p.hitRate),
      pct(p.averageWin),
      pct(p.averageLoss),
      fmt(p.payoffRatio),
      pct(p.expectancy),
      p.activeDays,
      pct(p.averageAllocation),
      pct(p.medianAllocation),
      pct(p.maximumAllocation),
      pct(p.percentDaysAtLeast010),
      pct(p.percentDaysAtLeast025),
      pct(p.percentDaysAtLeast050),
      pct(p.percentDaysAtLeast100)
    ];
  });
}

function costRows(results: ShadowModeResult[]): Array<Array<string | number>> {
  return results.flatMap((result) =>
    result.costSensitivity.map((cost) => [
      result.mode,
      cost.costScenario,
      pct(cost.performance.totalReturn),
      pct(cost.performance.maxDrawdown),
      fmt(cost.performance.profitFactor),
      pct(cost.performance.averageAllocation),
      cost.survivesCosts ? "survives" : "fails"
    ])
  );
}

function robustnessRows(results: ShadowModeResult[]): Array<Array<string | number>> {
  const wanted = new Set([
    "first half",
    "second half",
    "uptrend/other regime",
    "downtrend/risk-off regime",
    "High confidence",
    "Medium confidence",
    "Low confidence",
    "EV <= 0",
    "EV 0% to 1%",
    "EV > 1%",
    "No Evidence",
    "Weak Evidence",
    "Moderate Evidence",
    "Strong Evidence",
    "Failed Evidence",
    "SPY",
    "QQQ",
    "AAPL",
    "BTCUSDT",
    "ETHUSDT"
  ]);
  return results.flatMap((result) =>
    Object.entries(result.robustness.bySplit)
      .filter(([split]) => wanted.has(split))
      .map(([split, stats]: [string, ShadowRobustnessBucket]) => [
        result.mode,
        split,
        stats.count,
        pct(stats.totalReturn),
        pct(stats.averageReturnContribution),
        pct(stats.hitRate),
        stats.works ? "works" : "fails"
      ])
  );
}

function drawdownRows(results: ShadowModeResult[]): Array<Array<string | number>> {
  return results.map((result) => {
    const safety = result.drawdownSafety;
    return [
      result.mode,
      pct(safety.worstSingleDecisionLoss),
      pct(safety.worst3DecisionSequence),
      pct(safety.worst5DecisionSequence),
      pct(safety.maxDrawdown),
      safety.underwaterPeriods,
      safety.violatesFivePercentResearchThreshold ? "violates" : "passes"
    ];
  });
}

function leakageRows(results: ShadowModeResult[]): Array<Array<string | number>> {
  return results.map((result) => {
    const checks = result.leakageAndRealism;
    return [
      result.mode,
      checks.lookaheadBiasRisk,
      checks.samePeriodReturnLeakageRisk,
      checks.nextPeriodReturnsUnavailableAtDecisionTime ? "yes" : "no",
      checks.indicatorsUseFutureDataKnown ? "known issue" : "not detected",
      checks.costsIncluded ? "yes" : "no",
      checks.impossibleFillAssumptionRisk,
      checks.outlierDependencyRisk,
      result.outlierDependence.reliesOnOneOrTwoOutliers ? "fragile" : "not concentrated",
      pct(result.outlierDependence.topTwoDecisionContributionShare)
    ];
  });
}

function recommendationCandidates(results: ShadowModeResult[]) {
  return results.map((result) => ({
    mode: result.mode,
    totalReturn: result.performance.totalReturn,
    survivesMediumCost:
      result.costSensitivity.find((cost) => cost.costScenario === "medium cost")?.survivesCosts ?? result.performance.totalReturn > 0,
    secondHalfReturn: result.robustness.bySplit["second half"]?.totalReturn ?? 0,
    maxDrawdown: result.performance.maxDrawdown,
    outlierShare: result.outlierDependence.topTwoDecisionContributionShare
  }));
}

function bestMode(results: ShadowModeResult[]): ShadowModeResult {
  return [...results].sort((a, b) => b.performance.totalReturn - a.performance.totalReturn)[0];
}

function robustMode(results: ShadowModeResult[], recommendation: ShadowRecommendation): string {
  if (recommendation.safestNextExperiment !== "none") return recommendation.safestNextExperiment;
  return "none";
}

async function main() {
  console.log("ATC SHADOW ALLOCATION EXPERIMENT");
  console.log("Mode: paper-only holdout experiment. No production sizing changes and no broker execution.");

  const datasets = await loadAuditDatasets();
  const allSelectionRows: CapitalStarvationDecision[] = [];
  const allHoldoutRows: CapitalStarvationDecision[] = [];
  const splitSummaryRows: Array<Array<string | number>> = [];

  for (const dataset of datasets) {
    console.log(`Building shadow holdout rows for ${dataset.asset.symbol}`);
    const rows = runDecisionRows({
      symbol: dataset.asset.symbol,
      assetType: dataset.asset.assetType,
      candles: dataset.candles
    });
    const split = splitRows(rows);
    allSelectionRows.push(...split.selectionRows);
    allHoldoutRows.push(...split.holdoutRows);
    splitSummaryRows.push([
      dataset.asset.symbol,
      rows.length,
      split.selectionRows.length,
      `${split.selectionRows[0]?.date ?? "n/a"} to ${split.selectionRows.at(-1)?.date ?? "n/a"}`,
      split.holdoutRows.length,
      `${split.holdoutRows[0]?.date ?? "n/a"} to ${split.holdoutRows.at(-1)?.date ?? "n/a"}`
    ]);
  }

  const experiment = evaluateShadowAllocationExperiment({
    selectionRows: allSelectionRows,
    holdoutRows: allHoldoutRows,
    modes: MODES,
    costScenarios: COST_SCENARIOS
  });
  const recommendation = recommendShadowMode(recommendationCandidates(experiment.modeResults), MODES);
  const best = bestMode(experiment.modeResults);
  const robust = robustMode(experiment.modeResults, recommendation);
  const survivesCost = recommendation.safestNextExperiment === "none"
    ? false
    : experiment.modeResults
        .find((result) => result.mode === recommendation.safestNextExperiment)
        ?.costSensitivity.find((cost) => cost.costScenario === "medium cost")?.survivesCosts ?? false;

  const markdown = `# ATC Shadow Allocation Experiment Report

## Executive Summary

This is a paper-only shadow allocation experiment. Shadow modes are not production changes, do not place trades, do not connect to broker APIs, and must not be treated as permission to trade real capital.

- Candidate selection window: ${experiment.selectionRows} decision rows.
- Separate holdout/forward window: ${experiment.holdoutRows} decision rows.
- Best-performing shadow mode on holdout: ${best.mode} (${pct(best.performance.totalReturn)} total return).
- Most robust recommended paper-only mode: ${robust}.
- Edge survives medium realistic costs for recommended mode: ${survivesCost ? "yes" : "no"}.
- Final verdict: ${recommendation.verdict}
- Safest next paper-only experiment: ${recommendation.safestNextExperiment}
- Rationale: ${recommendation.rationale}

## Window Split

The capital-starvation report was used only to choose candidate shadow policies. The performance below is measured on later holdout rows.

${table(["Symbol", "Total Rows", "Selection Rows", "Selection Window", "Holdout Rows", "Holdout Window"], splitSummaryRows)}

## Performance By Mode

${table(
  [
    "Mode",
    "Warning",
    "Total Return",
    "Monthly Return",
    "Max Drawdown",
    "Volatility",
    "Sharpe-like",
    "Profit Factor",
    "Hit Rate",
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
  performanceRows(experiment.modeResults)
)}

## Robustness Checks

This table shows whether a mode works broadly or only in one narrow split.

${table(["Mode", "Split", "Count", "Total Return", "Avg Contribution", "Hit Rate", "Status"], robustnessRows(experiment.modeResults))}

## Cost And Slippage Sensitivity

Cost is modeled as return drag per unit allocation on each active shadow decision. Medium cost is the primary realistic-cost scenario.

${table(["Mode", "Cost Scenario", "Total Return", "Max Drawdown", "Profit Factor", "Avg Allocation", "Cost Survival"], costRows(experiment.modeResults))}

## Drawdown Safety

Research threshold: any mode breaching -5% max drawdown fails the drawdown safety threshold.

${table(
  [
    "Mode",
    "Worst Single Decision Loss",
    "Worst 3-Decision Sequence",
    "Worst 5-Decision Sequence",
    "Max Drawdown",
    "Underwater Periods",
    "5% Threshold"
  ],
  drawdownRows(experiment.modeResults)
)}

## Leakage And Realism Checks

${table(
  [
    "Mode",
    "Lookahead Risk",
    "Same-Period Leakage Risk",
    "Next Returns Unavailable At Decision",
    "Future Indicator Use",
    "Costs Included",
    "Fill Assumption Risk",
    "Outlier Risk",
    "Outlier Dependence",
    "Top Two Positive Contribution Share"
  ],
  leakageRows(experiment.modeResults)
)}

Notes:

- Next-period returns are measured after the decision date and are not available to the decision engine.
- The production analyzer receives only candles available up to each decision date.
- This still does not prove live fill quality. Spread, partial fills, outages, and market impact remain real-world risks.
- If performance disappears after costs or in the second half of the holdout, production allocation should remain unchanged.
- If one or two decisions dominate gains, the edge is fragile.

## Recommendation

Verdict: ${recommendation.verdict}

ATC should remain paper-only. Production allocation should remain unchanged. The safest next step is to continue the selected shadow mode, if any, in paper-only forward tracking and require another untouched holdout window before any production sizing change is considered.
`;

  writeFileSync("ATC_SHADOW_ALLOCATION_EXPERIMENT_REPORT.md", markdown);

  console.log(`Best-performing shadow mode: ${best.mode} (${pct(best.performance.totalReturn)})`);
  console.log(`Most robust shadow mode: ${robust}`);
  console.log(`Edge survives medium costs for recommended mode: ${survivesCost ? "yes" : "no"}`);
  console.log(`Final verdict: ${recommendation.verdict}`);
  console.log("Wrote ATC_SHADOW_ALLOCATION_EXPERIMENT_REPORT.md");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
