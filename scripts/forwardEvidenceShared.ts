import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { AssetType, MarketDataPoint } from "@/types/asset";
import type { QuantAnalysis, SampleQuality } from "@/types/quant";
import type { CapitalStarvationDecision } from "@/lib/quant/capitalStarvationAudit";
import { DEFAULT_QUANT_CONFIG } from "@/lib/quant/config";
import {
  appendForwardEvidenceRows,
  createForwardJournalRow,
  evaluateForwardEvidenceJournal,
  loadFrozenPolicyManifest,
  type ForwardEvidenceEvaluation,
  type ForwardEvidenceJournalRow,
  type ForwardEvidencePerformance,
  type FrozenShadowPolicyManifest
} from "@/lib/quant/forwardEvidenceAccumulator";
import { analyzeMarketData } from "@/lib/quant/scoring";
import { loadAuditDatasets, pct, table } from "./auditShared";

export const FORWARD_EVIDENCE_JOURNAL_PATH = "data/forward-evidence-journal.jsonl";
export const FROZEN_POLICY_MANIFEST_PATH = "data/frozen-shadow-policy-manifest.json";
export const FORWARD_EVIDENCE_REPORT_PATH = "ATC_FORWARD_EVIDENCE_ACCUMULATION_REPORT.md";

const REBALANCE_EVERY_DAYS = 21;
const PREVIOUS_FORWARD_CUTOFF_BY_SYMBOL: Record<string, string> = {
  SPY: "2026-06-12",
  QQQ: "2026-06-12",
  AAPL: "2026-06-12",
  BTCUSDT: "2026-06-25",
  ETHUSDT: "2026-06-25"
};

interface DecisionWithCandle {
  decision: CapitalStarvationDecision;
  candle: MarketDataPoint;
}

export interface ForwardEvidenceRunResult {
  manifest: FrozenShadowPolicyManifest;
  existingRowsBeforeUpdate: number;
  attemptedRows: number;
  appendedRows: number;
  duplicateRows: number;
  invalidRows: number;
  journalRows: ForwardEvidenceJournalRow[];
  evaluation: ForwardEvidenceEvaluation;
  assetCandidateRows: Array<Array<string | number>>;
}

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

function decisionFromAnalysis(input: {
  symbol: string;
  assetType: AssetType;
  candle: MarketDataPoint;
  analysis: QuantAnalysis;
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
    nextPeriodReturn: null,
    maxAdverseMove: null,
    maxFavorableMove: null,
    blockingReasons: decision.blockingReasons,
    warnings: Array.from(new Set([...decision.warnings, ...ev.warnings, ...input.analysis.pipeline.positionSizing.warnings]))
  };
}

function runDecisionRows(input: { symbol: string; assetType: AssetType; candles: MarketDataPoint[] }): DecisionWithCandle[] {
  const rows: DecisionWithCandle[] = [];
  for (let index = 0; index < input.candles.length; index += REBALANCE_EVERY_DAYS) {
    const candle = input.candles[index];
    if (!candle) continue;
    const analysis = analyzeMarketData(input.candles.slice(0, index + 1), input.assetType, input.symbol, "balanced");
    rows.push({
      candle,
      decision: decisionFromAnalysis({
        symbol: input.symbol,
        assetType: input.assetType,
        candle,
        analysis
      })
    });
  }
  return rows;
}

function ensureJournalFile(): void {
  mkdirSync(dirname(FORWARD_EVIDENCE_JOURNAL_PATH), { recursive: true });
  if (!existsSync(FORWARD_EVIDENCE_JOURNAL_PATH)) writeFileSync(FORWARD_EVIDENCE_JOURNAL_PATH, "");
}

function readJournalRows(): ForwardEvidenceJournalRow[] {
  ensureJournalFile();
  return readFileSync(FORWARD_EVIDENCE_JOURNAL_PATH, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ForwardEvidenceJournalRow);
}

function appendJournalRows(rows: ForwardEvidenceJournalRow[]): void {
  if (rows.length === 0) return;
  appendFileSync(FORWARD_EVIDENCE_JOURNAL_PATH, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

function readManifest(): FrozenShadowPolicyManifest {
  return loadFrozenPolicyManifest(JSON.parse(readFileSync(FROZEN_POLICY_MANIFEST_PATH, "utf8")));
}

function ratio(value: number): string {
  if (value === Number.POSITIVE_INFINITY) return "Infinity";
  if (!Number.isFinite(value)) return "n/a";
  return value.toFixed(3);
}

function performanceCells(performance: ForwardEvidencePerformance): Array<string | number> {
  return [
    pct(performance.totalReturn),
    pct(performance.hitRate),
    ratio(performance.profitFactor),
    pct(performance.expectancy),
    pct(performance.maxDrawdown),
    pct(performance.worst5DecisionSequence),
    performance.activeRows,
    pct(performance.averageAllocation)
  ];
}

function metricRows(evaluation: ForwardEvidenceEvaluation): Array<Array<string | number>> {
  return [
    ["production_current", ...performanceCells(evaluation.production.performance)],
    ["frozen_floor_0_10", ...performanceCells(evaluation.shadow.performance)]
  ];
}

function assetRows(evaluation: ForwardEvidenceEvaluation): Array<Array<string | number>> {
  return Object.entries(evaluation.assetBreakdown)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([asset, stats]) => [
      asset,
      stats.rows,
      stats.activeRows,
      pct(stats.totalReturn),
      pct(stats.hitRate),
      ratio(stats.profitFactor),
      pct(stats.expectancy),
      pct(stats.maxDrawdown)
    ]);
}

function regimeRows(evaluation: ForwardEvidenceEvaluation): Array<Array<string | number>> {
  return Object.entries(evaluation.regimeBreakdown)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([regime, stats]) => [
      regime,
      stats.rows,
      stats.activeRows,
      pct(stats.totalReturn),
      pct(stats.hitRate),
      ratio(stats.profitFactor),
      pct(stats.expectancy),
      pct(stats.maxDrawdown)
    ]);
}

function passFailRows(evaluation: ForwardEvidenceEvaluation): Array<Array<string | number>> {
  return Object.entries(evaluation.passFail).map(([gate, result]) => [gate, result.passed ? "pass" : "fail", pct(result.value)]);
}

function costRows(evaluation: ForwardEvidenceEvaluation): Array<Array<string | number>> {
  return evaluation.costSensitivity.map((row) => [
    row.costModel,
    pct(row.performance.totalReturn),
    ratio(row.performance.profitFactor),
    pct(row.performance.expectancy),
    pct(row.performance.maxDrawdown),
    row.survives ? "survives" : "fails"
  ]);
}

export function buildForwardEvidenceReport(result: ForwardEvidenceRunResult): string {
  const status = result.evaluation.journalStatus;
  const thresholds = result.evaluation.thresholdStatus;
  const enoughRows = thresholds.enoughEvidenceExists ? "yes" : "no";
  return `# ATC Forward Evidence Accumulation Report

## Executive Summary

This is a paper-only forward evidence accumulation system. It does not add live trading, does not connect to broker APIs, does not change production allocation, and does not promote any shadow mode to production.

- Journal path: ${FORWARD_EVIDENCE_JOURNAL_PATH}
- Frozen policy manifest: ${FROZEN_POLICY_MANIFEST_PATH}
- Frozen policy: ${result.manifest.policyName} (${result.manifest.policyVersion})
- Production status: ${result.manifest.productionStatus}
- Production promotion status: ${result.manifest.productionPromotionStatus}
- Attempted rows this run: ${result.attemptedRows}
- Appended rows this run: ${result.appendedRows}
- Skipped duplicate rows this run: ${result.duplicateRows}
- Invalid rows this run: ${result.invalidRows}
- Pending outcome rows: ${status.pendingOutcomeRows}
- Evaluation-ready rows: ${status.evaluationReadyRows}
- Enough evidence exists: ${enoughRows}
- Final verdict: ${result.evaluation.finalVerdict}

## Journal Status

The journal is append-only. Historical shadow rows must not be regenerated with changed parameters. Pending rows are not evaluated as zero-return trades.

${table(
  ["Metric", "Value"],
  [
    ["Existing rows before update", result.existingRowsBeforeUpdate],
    ["Attempted rows", result.attemptedRows],
    ["Appended rows", result.appendedRows],
    ["Skipped duplicate rows", result.duplicateRows],
    ["Invalid rows", result.invalidRows],
    ["Total journal rows", status.totalRows],
    ["Pending outcome rows", status.pendingOutcomeRows],
    ["Outcome attached rows", status.outcomeAttachedRows],
    ["Evaluation-ready rows", status.evaluationReadyRows]
  ]
)}

## Frozen Policy Status

${table(
  ["Field", "Value"],
  [
    ["Policy name", result.manifest.policyName],
    ["Allocation floor", pct(result.manifest.allocationFloor)],
    ["Date frozen", result.manifest.dateFrozen],
    ["Source report", result.manifest.sourceReport],
    ["Production status", result.manifest.productionStatus],
    ["Promotion status", result.manifest.productionPromotionStatus],
    ["Rule summary", result.manifest.ruleSummary]
  ]
)}

## Candidate Row Scan

Rows at or before the prior untouched-forward cutoffs are excluded and are not reused as new forward evidence.

${table(["Asset", "Prior Cutoff", "Decision Rows Scanned", "Post-Cutoff Candidate Rows"], result.assetCandidateRows)}

## Sample Size Status

Minimum thresholds:

- Minimum 100 new decision rows for a preliminary read.
- Minimum 250 new decision rows for weak evidence.
- Minimum 500 new decision rows for stronger evidence.
- Minimum 30 active shadow decisions before judging performance.
- Minimum 3 assets contributing before claiming broad robustness.
- Minimum 2 regimes represented before claiming regime robustness.

${table(
  ["Threshold", "Current", "Required", "Met"],
  [
    ["Preliminary rows", thresholds.evaluationReadyRows, thresholds.preliminaryRows, thresholds.preliminaryReadMet ? "yes" : "no"],
    ["Weak evidence rows", thresholds.evaluationReadyRows, thresholds.weakEvidenceRows, thresholds.weakEvidenceMet ? "yes" : "no"],
    ["Stronger evidence rows", thresholds.evaluationReadyRows, thresholds.strongerEvidenceRows, thresholds.strongerEvidenceMet ? "yes" : "no"],
    ["Active shadow decisions", thresholds.activeShadowDecisions, thresholds.minActiveShadowDecisions, thresholds.activeShadowDecisionThresholdMet ? "yes" : "no"],
    ["Contributing assets", thresholds.contributingAssets, thresholds.minAssets, thresholds.assetRobustnessMet ? "yes" : "no"],
    ["Represented regimes", thresholds.representedRegimes, thresholds.minRegimes, thresholds.regimeRobustnessMet ? "yes" : "no"]
  ]
)}

## Production Vs Shadow Comparison

If evaluation-ready rows are below threshold, these metrics are not sufficient evidence for production decisions.

${table(
  ["Mode", "Total Return", "Hit Rate", "Profit Factor", "Expectancy", "Max Drawdown", "Worst 5-Decision Sequence", "Active Rows", "Average Allocation"],
  metricRows(result.evaluation)
)}

## Pass/Fail Gate

${table(["Gate", "Result", "Value"], passFailRows(result.evaluation))}

## Asset Breakdown

${table(["Asset", "Rows", "Active Rows", "Total Return", "Hit Rate", "Profit Factor", "Expectancy", "Max Drawdown"], assetRows(result.evaluation))}

## Regime Breakdown

${table(["Regime", "Rows", "Active Rows", "Total Return", "Hit Rate", "Profit Factor", "Expectancy", "Max Drawdown"], regimeRows(result.evaluation))}

## Cost Sensitivity

Cost sensitivity is reported only as paper-only evidence and is not a production sizing recommendation.

${table(["Cost Model", "Total Return", "Profit Factor", "Expectancy", "Max Drawdown", "Status"], costRows(result.evaluation))}

## Outlier Dependency

${table(
  ["Metric", "Value"],
  [
    ["Top single trade contribution share", pct(result.evaluation.outlierDependency.topTradeContributionShare)],
    ["Top single asset contribution share", pct(result.evaluation.outlierDependency.topAssetContributionShare)],
    ["Fragile", result.evaluation.outlierDependency.fragile ? "yes" : "no"]
  ]
)}

## Final Answers

- ATC remains paper-only: yes.
- Production allocation remains unchanged: yes.
- floor_0_10 remains shadow-only: yes.
- floor_1_00 remains diagnostic-only: yes.
- Enough evidence exists to judge floor_0_10: ${enoughRows}.
- The system should collect fresh forward rows before further conclusions: yes.

## Final Verdict

${result.evaluation.finalVerdict}
`;
}

export async function runForwardEvidenceAccumulator(options: { appendNewRows: boolean }): Promise<ForwardEvidenceRunResult> {
  const manifest = readManifest();
  const existingRows = readJournalRows();
  const datasets = await loadAuditDatasets();
  const timestamp = new Date().toISOString();
  const mediumCost = manifest.costAssumptions.find((cost) => cost.name === "medium cost") ?? { name: "medium cost", costPerUnitAllocation: 0.004 };
  const candidateRows: ForwardEvidenceJournalRow[] = [];
  const assetCandidateRows: Array<Array<string | number>> = [];

  for (const dataset of datasets) {
    const rows = runDecisionRows({
      symbol: dataset.asset.symbol,
      assetType: dataset.asset.assetType,
      candles: dataset.candles
    });
    const cutoff = PREVIOUS_FORWARD_CUTOFF_BY_SYMBOL[dataset.asset.symbol] ?? "9999-12-31";
    const postCutoff = rows.filter((row) => row.decision.date > cutoff);
    assetCandidateRows.push([dataset.asset.symbol, cutoff, rows.length, postCutoff.length]);

    for (const row of postCutoff) {
      candidateRows.push(
        createForwardJournalRow({
          decision: row.decision,
          manifest,
          timestamp,
          costModel: mediumCost,
          priceReference: {
            close: row.candle.close,
            source: "historical forward scan",
            asOfDate: row.candle.date
          }
        })
      );
    }
  }

  const appendResult = appendForwardEvidenceRows(existingRows, candidateRows);
  if (options.appendNewRows) appendJournalRows(appendResult.rowsToAppend);
  const journalRows = options.appendNewRows ? [...existingRows, ...appendResult.rowsToAppend] : existingRows;
  const evaluation = evaluateForwardEvidenceJournal(journalRows, { costModels: manifest.costAssumptions });

  return {
    manifest,
    existingRowsBeforeUpdate: existingRows.length,
    attemptedRows: appendResult.attemptedRows,
    appendedRows: options.appendNewRows ? appendResult.appendedRows : 0,
    duplicateRows: appendResult.skippedDuplicateRows,
    invalidRows: appendResult.invalidRows,
    journalRows,
    evaluation,
    assetCandidateRows
  };
}
