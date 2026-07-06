import { writeFileSync } from "node:fs";
import type { AssetType, MarketDataPoint } from "@/types/asset";
import type { QuantAnalysis, SampleQuality } from "@/types/quant";
import {
  analyzeAllocationSensitivity,
  analyzeKellyRule,
  analyzeRejectedOpportunities,
  analyzeSignalQuality,
  capitalStarvationVerdict,
  classifyRejection,
  type AllocationSensitivityScenario,
  type CapitalStarvationDecision,
  type CategoryStats,
  type SignalQualityBucket
} from "@/lib/quant/capitalStarvationAudit";
import { DEFAULT_QUANT_CONFIG } from "@/lib/quant/config";
import { analyzeMarketData } from "@/lib/quant/scoring";
import { average, distributionText, loadAuditDatasets, pct, ratio, table } from "./auditShared";

const REBALANCE_EVERY_DAYS = 21;

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
  if (!current || !next || current.close <= 0) {
    return { nextPeriodReturn: null, maxAdverseMove: null, maxFavorableMove: null };
  }
  const path = candles.slice(currentIndex + 1, nextIndex + 1);
  const lows = path.map((point) => point.low).filter((value) => Number.isFinite(value));
  const highs = path.map((point) => point.high).filter((value) => Number.isFinite(value));
  return {
    nextPeriodReturn: next.close / current.close - 1,
    maxAdverseMove: lows.length === 0 ? null : Math.min(...lows) / current.close - 1,
    maxFavorableMove: highs.length === 0 ? null : Math.max(...highs) / current.close - 1
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

function runCapitalReplay(input: {
  symbol: string;
  assetType: AssetType;
  candles: MarketDataPoint[];
}): CapitalStarvationDecision[] {
  const rows: CapitalStarvationDecision[] = [];
  for (let index = 0; index < input.candles.length; index += REBALANCE_EVERY_DAYS) {
    const candle = input.candles[index];
    if (!candle) continue;
    const available = input.candles.slice(0, index + 1);
    const analysis = analyzeMarketData(available, input.assetType, input.symbol, "balanced");
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

function fmtNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return value.toFixed(3);
}

function categoryRows(symbol: string, total: number, categories: Record<string, CategoryStats>): Array<Array<string | number>> {
  return Object.values(categories).map((stats) => [
    symbol,
    stats.category,
    stats.count,
    pct(stats.percentOfTotal),
    pct(stats.averageNextPeriodReturn),
    pct(stats.averageMissedReturn),
    stats.netPositive ? "Net positive" : "Net negative/flat"
  ]);
}

function sensitivityRows(symbol: string, scenarios: AllocationSensitivityScenario[]): Array<Array<string | number>> {
  return scenarios.map((scenario) => [
    symbol,
    scenario.name,
    pct(scenario.monthlyReturn),
    pct(scenario.totalReturn),
    pct(scenario.maxDrawdown),
    pct(scenario.volatility),
    scenario.activeDays,
    pct(scenario.averageAllocation),
    pct(scenario.medianAllocation),
    pct(scenario.percentDaysAtLeast010),
    pct(scenario.percentDaysAtLeast025),
    pct(scenario.percentDaysAtLeast050),
    pct(scenario.percentDaysAtLeast100),
    scenario.worstDecisions
      .map((item) => `${item.date} ${item.symbol} ${pct(item.returnContribution)}`)
      .join("<br>"),
    scenario.bestDecisions
      .map((item) => `${item.date} ${item.symbol} ${pct(item.returnContribution)}`)
      .join("<br>")
  ]);
}

function qualityRows(groupName: string, buckets: Record<string, SignalQualityBucket>): Array<Array<string | number>> {
  return Object.entries(buckets).map(([bucket, stats]) => [
    groupName,
    bucket,
    stats.count,
    pct(stats.averageReturn),
    pct(stats.hitRate),
    pct(stats.averageWin),
    pct(stats.averageLoss),
    ratio(stats.payoffRatio),
    ratio(stats.profitFactor),
    pct(stats.expectancy),
    pct(stats.maxAdverseMove ?? 0),
    pct(stats.maxFavorableMove ?? 0)
  ]);
}

function kellyRows(symbol: string, rows: CapitalStarvationDecision[]): Array<Array<string | number>> {
  const diagnosis = analyzeKellyRule(rows);
  return Object.entries(diagnosis.alternatives).map(([name, stats]) => [
    symbol,
    name,
    diagnosis.hardRuleBlockedCount,
    pct(diagnosis.hardRuleBlockedPercent),
    pct(diagnosis.averageAllocationBeforeHardRule),
    pct(diagnosis.averageAllocationAfterHardRule),
    pct(diagnosis.blockedTradeAverageReturn),
    diagnosis.blockedTradesNetPositive ? "Net positive" : "Net negative/flat",
    pct(stats.averageAllocation),
    pct(stats.averageReturnContribution),
    stats.commentary
  ]);
}

function scenarioByName(scenarios: AllocationSensitivityScenario[], name: string): AllocationSensitivityScenario {
  const scenario = scenarios.find((item) => item.name === name);
  if (!scenario) throw new Error(`Missing scenario ${name}`);
  return scenario;
}

async function main() {
  console.log("ATC CAPITAL STARVATION ROOT-CAUSE AUDIT");
  console.log("Mode: diagnostic historical replay only. No live trading or broker execution.");

  const datasets = await loadAuditDatasets();
  const allRows: CapitalStarvationDecision[] = [];
  const rejectedRows: Array<Array<string | number>> = [];
  const sensitivityTableRows: Array<Array<string | number>> = [];
  const kellyTableRows: Array<Array<string | number>> = [];

  for (const dataset of datasets) {
    console.log(`Running capital starvation replay for ${dataset.asset.symbol}`);
    const rows = runCapitalReplay({
      symbol: dataset.asset.symbol,
      assetType: dataset.asset.assetType,
      candles: dataset.candles
    });
    allRows.push(...rows);

    const rejected = analyzeRejectedOpportunities(rows);
    rejectedRows.push(...categoryRows(dataset.asset.symbol, rows.length, rejected.byCategory));
    sensitivityTableRows.push(...sensitivityRows(dataset.asset.symbol, analyzeAllocationSensitivity(rows)));
    kellyTableRows.push(...kellyRows(dataset.asset.symbol, rows));
  }

  const combinedRejected = analyzeRejectedOpportunities(allRows);
  const combinedSensitivity = analyzeAllocationSensitivity(allRows);
  const quality = analyzeSignalQuality(allRows);
  const combinedKelly = analyzeKellyRule(allRows);
  const production = scenarioByName(combinedSensitivity, "current production allocation");
  const bestDiagnostic = [...combinedSensitivity]
    .filter((scenario) => scenario.name !== "current production allocation")
    .sort((a, b) => b.totalReturn - a.totalReturn)[0];
  const finalVerdict = capitalStarvationVerdict({
    signalExpectancy: quality.overall.expectancy,
    sensitivityImprovesReturn: bestDiagnostic.totalReturn > production.totalReturn,
    sensitivityMaxDrawdown: bestDiagnostic.maxDrawdown,
    sampleSize: allRows.length
  });

  const categoryCounts = Object.fromEntries(
    Object.entries(combinedRejected.byCategory).map(([category, stats]) => [category, stats.count])
  );
  const combinedKellyRows = kellyRows("ALL", allRows);
  const signalQualityRows = [
    ...qualityRows("Confidence", quality.byConfidence),
    ...qualityRows("EV bucket", quality.byEv),
    ...qualityRows("Validation", quality.byValidation),
    ...qualityRows("Regime", quality.byRegime),
    ...qualityRows("Asset", quality.byAsset)
  ];

  const markdown = `# ATC Capital Starvation Root-Cause Audit

## Executive Summary

This audit is diagnostic and paper/backtest-only. It does not connect to broker APIs, place trades, or change production allocation logic.

- Final verdict: ${finalVerdict.verdict}
- Next safest change: ${finalVerdict.nextSafestChange}
- Rationale: ${finalVerdict.rationale}
- Production total return in diagnostic decision replay: ${pct(production.totalReturn)}
- Best diagnostic what-if: ${bestDiagnostic.name} at ${pct(bestDiagnostic.totalReturn)} total return with ${pct(bestDiagnostic.maxDrawdown)} max drawdown.
- Signal expectancy across replay decisions: ${pct(quality.overall.expectancy)}
- Hard Kelly below-30-trade blocks: ${combinedKelly.hardRuleBlockedCount} (${pct(combinedKelly.hardRuleBlockedPercent)}).

## Rejected Opportunity Audit

Each replay row is classified into one mutually exclusive root-cause bucket. Missed return assumes a diagnostic ${pct(0.0025)} paper allocation and is not a recommendation to trade.

${table(["Symbol", "Category", "Count", "% Decisions", "Avg Next Return", "Avg Missed Return @ 0.25%", "Bucket Sign"], rejectedRows)}

### Combined Rejection Distribution

${distributionText(categoryCounts, allRows.length)}

## Allocation Sensitivity Audit

These are what-if simulations only. Production behavior is unchanged.

${table(
  [
    "Symbol",
    "Scenario",
    "Monthly Return",
    "Total Return",
    "Max Drawdown",
    "Volatility",
    "Active Days",
    "Avg Allocation",
    "Median Allocation",
    "% >= 0.10%",
    "% >= 0.25%",
    "% >= 0.50%",
    "% >= 1.00%",
    "Worst 5 Decisions",
    "Best 5 Decisions"
  ],
  sensitivityTableRows
)}

## Combined Allocation Sensitivity

${table(
  [
    "Symbol",
    "Scenario",
    "Monthly Return",
    "Total Return",
    "Max Drawdown",
    "Volatility",
    "Active Days",
    "Avg Allocation",
    "Median Allocation",
    "% >= 0.10%",
    "% >= 0.25%",
    "% >= 0.50%",
    "% >= 1.00%",
    "Worst 5 Decisions",
    "Best 5 Decisions"
  ],
  sensitivityRows("ALL", combinedSensitivity)
)}

## Signal Quality Audit

This section asks whether the signal deserves more capital before changing allocation rules.

Overall: count ${quality.overall.count}, expectancy ${pct(quality.overall.expectancy)}, hit rate ${pct(quality.overall.hitRate)}, payoff ratio ${fmtNumber(quality.overall.payoffRatio)}, profit factor ${fmtNumber(quality.overall.profitFactor)}.

${table(
  [
    "Group",
    "Bucket",
    "Count",
    "Avg Return",
    "Hit Rate",
    "Avg Win",
    "Avg Loss",
    "Payoff Ratio",
    "Profit Factor",
    "Expectancy",
    "Max Adverse",
    "Max Favorable"
  ],
  signalQualityRows
)}

## Kelly Rule Diagnosis

The current hard rule forces Kelly to zero when validated trade count is below 30. This audit compares it with softer diagnostic alternatives without changing production.

${table(
  [
    "Symbol",
    "Kelly Rule",
    "Blocked Count",
    "% Blocked",
    "Avg Kelly Before Hard Rule",
    "Avg Kelly After Hard Rule",
    "Avg Blocked Next Return",
    "Blocked Bucket Sign",
    "Alternative Avg Allocation",
    "Alternative Avg Return Contribution",
    "Commentary"
  ],
  [...kellyTableRows, ...combinedKellyRows]
)}

Diagnosis: ${combinedKelly.recommendation}

## Root-Cause Interpretation

- If rejected buckets are net negative, the system is probably rejecting weak signals correctly.
- If rejected buckets are net positive while allocation remains near zero, the sizing/validation rules may be too restrictive.
- If sensitivity scenarios improve return only by accepting material drawdown, the signal is not safely deployable.
- If high-confidence, positive-EV, and stronger-validation buckets do not outperform weaker buckets, the signal does not deserve more capital yet.
- A Bayesian/shrunk Kelly warmup is more defensible than simply removing the 30-trade hard rule because it preserves uncertainty penalties for low-frequency trend systems.

## Final Recommendation

Verdict: ${finalVerdict.verdict}

ATC should remain paper-only. Allocation should not be increased in production from this audit alone. The next safest change is diagnostic only: run a paper-only small allocation floor or Bayesian/shrunk Kelly warmup and require a separate forward sample before changing real allocation rules.
`;

  writeFileSync("ATC_CAPITAL_STARVATION_ROOT_CAUSE_AUDIT.md", markdown);

  console.log(`Final verdict: ${finalVerdict.verdict}`);
  console.log(`Next safest change: ${finalVerdict.nextSafestChange}`);
  console.log(`Production total return: ${pct(production.totalReturn)}`);
  console.log(`Best diagnostic what-if: ${bestDiagnostic.name} ${pct(bestDiagnostic.totalReturn)}`);
  console.log(`Signal expectancy: ${pct(quality.overall.expectancy)}`);
  console.log(`Hard Kelly blocks: ${combinedKelly.hardRuleBlockedCount} (${pct(combinedKelly.hardRuleBlockedPercent)})`);
  console.log("Wrote ATC_CAPITAL_STARVATION_ROOT_CAUSE_AUDIT.md");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
