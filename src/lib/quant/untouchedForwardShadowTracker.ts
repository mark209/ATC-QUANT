import type { CapitalStarvationDecision } from "./capitalStarvationAudit";
import { shadowAllocationForMode, type CostScenario } from "./shadowAllocationExperiment";

export type UntouchedForwardTrackerVerdict =
  | "Continue paper-only floor_0_10 tracking."
  | "Keep production unchanged and collect more data."
  | "Disable floor_0_10 shadow tracking due to failed forward results."
  | "Research asset exclusions before continuing."
  | "Research regime filters before continuing."
  | "Inconclusive; sample too small."
  | "Unsafe; reduce or disable allocation logic.";

export type UntouchedForwardMode = "production_current" | "frozen_floor_0_10";
export type RegimeBucket = "normal/uptrend" | "downtrend" | "risk-off" | "unknown";
export type EvidenceBucket = "passed validation" | "failed validation" | "no evidence" | "weak evidence" | "strong evidence";

export interface TrackerDecision {
  date: string;
  symbol: string;
  mode: UntouchedForwardMode;
  allocation: number;
  grossReturn: number;
  netReturn: number;
  returnContribution: number;
  regimeBucket: RegimeBucket;
  evidenceBucket: EvidenceBucket;
  validationEvidenceState: string;
}

export interface TrackerPerformance {
  totalReturn: number;
  monthlyReturn: number;
  maxDrawdown: number;
  volatility: number;
  hitRate: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  payoffRatio: number;
  expectancy: number;
  activeDays: number;
  averageAllocation: number;
  medianAllocation: number;
  maximumAllocation: number;
  percentDaysAtLeast010: number;
  percentDaysAtLeast025: number;
  percentDaysAtLeast050: number;
  percentDaysAtLeast100: number;
}

export interface TrackerModeResult {
  mode: UntouchedForwardMode;
  performance: TrackerPerformance;
  decisions: TrackerDecision[];
}

export interface UntouchedForwardWindow {
  untouchedRows: CapitalStarvationDecision[];
  excludedRows: number;
  dateRange: string;
  assetsIncluded: string[];
  assetsExcluded: string[];
  sampleLargeEnough: boolean;
  sampleAssessment: "preliminary" | "meaningful";
}

export interface PassFailCriterion {
  passed: boolean;
  detail: string;
}

export interface TrackerPassFail {
  positiveAfterMediumCosts: PassFailCriterion;
  maxDrawdownBelowFivePercent: PassFailCriterion;
  profitFactorAboveOneTen: PassFailCriterion;
  positiveExpectancyAfterCosts: PassFailCriterion;
  notOutlierDependent: PassFailCriterion;
  notSingleAssetDependent: PassFailCriterion;
  riskOffDowntrendAcceptable: PassFailCriterion;
}

export interface TrackerKillSwitches {
  maxDrawdownExceeded: boolean;
  mediumCostReturnNegative: boolean;
  profitFactorBelowOne: boolean;
  expectancyNegative: boolean;
  worstFiveDecisionSequenceExceeded: boolean;
  oneAssetProfitConcentrationExceeded: boolean;
  oneTradeContributionExceeded: boolean;
  riskOffDowntrendMateriallyHarmful: boolean;
}

export interface TrackerOutlierDependency {
  oneTradeContributionShare: number;
  top3ContributionShare: number;
  top5ContributionShare: number;
  profitWithoutBestTrade: number;
  profitWithoutBest3Trades: number;
  profitWithoutBest5Trades: number;
  fragile: boolean;
}

export interface TrackerGroupBreakdown extends TrackerPerformance {
  rows: number;
}

export interface AssetDiagnosis extends TrackerGroupBreakdown {
  worstDecision: number;
  shouldRemainEligible: boolean;
  flags: string[];
}

export interface RegimeDiagnosis extends TrackerGroupBreakdown {
  recommendation: "active" | "reduced" | "disabled";
}

export interface EvidenceAnswers {
  failedEvidenceRowsRemainBlocked: "yes" | "no" | "inconclusive";
  noEvidenceRowsRemainBlocked: "yes" | "no" | "inconclusive";
  softValidationStillResearch: "yes, paper-only" | "no" | "inconclusive";
}

export interface TrackerCostSensitivity {
  costScenario: string;
  performance: TrackerPerformance;
  survivesEdge: boolean;
}

export interface UntouchedForwardShadowTrackerInput {
  rows: CapitalStarvationDecision[];
  previousCutoffBySymbol: Record<string, string>;
  minMeaningfulRows?: number;
  costScenarios?: CostScenario[];
  worstFiveDecisionResearchLossThreshold?: number;
}

export interface UntouchedForwardShadowTrackerResult {
  policyStatement: string;
  window: UntouchedForwardWindow;
  production: TrackerModeResult;
  frozen: TrackerModeResult;
  costSensitivity: TrackerCostSensitivity[];
  passFail: TrackerPassFail;
  killSwitches: TrackerKillSwitches;
  assetBreakdown: Record<string, AssetDiagnosis>;
  regimeBreakdown: Record<RegimeBucket, RegimeDiagnosis>;
  evidenceBreakdown: Record<EvidenceBucket, TrackerGroupBreakdown>;
  evidenceAnswers: EvidenceAnswers;
  outlierDependency: TrackerOutlierDependency;
  answers: {
    shouldRemainPaperOnly: "yes";
    shouldProductionRemainUnchanged: "yes";
    isFloor010ReadyForProduction: "yes" | "no";
    isFloor100ReadyForProduction: "no";
    nextSafestPaperOnlyAction: string;
  };
  finalVerdict: UntouchedForwardTrackerVerdict;
}

const DEFAULT_COST_SCENARIOS: CostScenario[] = [
  { name: "no cost", costPerUnitAllocation: 0 },
  { name: "low cost", costPerUnitAllocation: 0.001 },
  { name: "medium cost", costPerUnitAllocation: 0.004 },
  { name: "high cost", costPerUnitAllocation: 0.008 }
];

const DEFAULT_MIN_MEANINGFUL_ROWS = 50;
const DEFAULT_WORST_FIVE_DECISION_THRESHOLD = -0.005;
const POLICY_STATEMENT = "This is a frozen paper-only shadow policy, not a production allocation change.";

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

function safeReturn(row: CapitalStarvationDecision): number {
  return typeof row.nextPeriodReturn === "number" && Number.isFinite(row.nextPeriodReturn) ? row.nextPeriodReturn : 0;
}

function maxDrawdown(contributions: number[]): number {
  let equity = 1;
  let peak = 1;
  let worst = 0;
  for (const contribution of contributions) {
    equity *= 1 + contribution;
    peak = Math.max(peak, equity);
    worst = Math.min(worst, equity / peak - 1);
  }
  return worst;
}

function monthlyReturn(decisions: TrackerDecision[]): number {
  const byMonth = new Map<string, number[]>();
  for (const decision of decisions) {
    const month = decision.date.slice(0, 7);
    byMonth.set(month, [...(byMonth.get(month) ?? []), decision.returnContribution]);
  }
  return average(Array.from(byMonth.values()).map((values) => values.reduce((sum, value) => sum + value, 0)));
}

function windowWorst(values: number[], window: number): number {
  if (values.length === 0) return 0;
  if (values.length < window) return values.reduce((sum, value) => sum + value, 0);
  let worst = Number.POSITIVE_INFINITY;
  for (let index = 0; index + window <= values.length; index += 1) {
    worst = Math.min(worst, values.slice(index, index + window).reduce((sum, value) => sum + value, 0));
  }
  return worst === Number.POSITIVE_INFINITY ? 0 : worst;
}

function performance(decisions: TrackerDecision[]): TrackerPerformance {
  const contributions = decisions.map((decision) => decision.returnContribution);
  const activeContributions = decisions.filter((decision) => decision.allocation > 0).map((decision) => decision.returnContribution);
  const allocations = decisions.map((decision) => decision.allocation);
  const wins = activeContributions.filter((value) => value > 0);
  const losses = activeContributions.filter((value) => value < 0);
  const grossWin = wins.reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(losses.reduce((sum, value) => sum + value, 0));
  const avgWin = average(wins);
  const avgLoss = average(losses);

  return {
    totalReturn: contributions.reduce((sum, value) => sum + value, 0),
    monthlyReturn: monthlyReturn(decisions),
    maxDrawdown: maxDrawdown(contributions),
    volatility: standardDeviation(contributions),
    hitRate: activeContributions.length === 0 ? 0 : wins.length / activeContributions.length,
    profitFactor: grossLoss === 0 ? (grossWin > 0 ? Number.POSITIVE_INFINITY : 0) : grossWin / grossLoss,
    averageWin: avgWin,
    averageLoss: avgLoss,
    payoffRatio: avgLoss === 0 ? (avgWin > 0 ? Number.POSITIVE_INFINITY : 0) : avgWin / Math.abs(avgLoss),
    expectancy: average(activeContributions),
    activeDays: allocations.filter((allocation) => allocation > 0).length,
    averageAllocation: average(allocations),
    medianAllocation: median(allocations),
    maximumAllocation: Math.max(0, ...allocations),
    percentDaysAtLeast010: allocations.filter((allocation) => allocation >= 0.001).length / Math.max(1, allocations.length),
    percentDaysAtLeast025: allocations.filter((allocation) => allocation >= 0.0025).length / Math.max(1, allocations.length),
    percentDaysAtLeast050: allocations.filter((allocation) => allocation >= 0.005).length / Math.max(1, allocations.length),
    percentDaysAtLeast100: allocations.filter((allocation) => allocation >= 0.01).length / Math.max(1, allocations.length)
  };
}

function regimeBucket(row: CapitalStarvationDecision): RegimeBucket {
  const label = row.regimeLabel.toLowerCase();
  if (label.includes("risk-off") || label.includes("risk off")) return "risk-off";
  if (label.includes("down")) return "downtrend";
  if (label.trim().length === 0 || label.includes("unknown")) return "unknown";
  return "normal/uptrend";
}

function primaryEvidenceBucket(row: CapitalStarvationDecision): EvidenceBucket {
  if (row.validationEvidenceState === "Failed Evidence") return "failed validation";
  if (row.validationEvidenceState === "No Evidence") return "no evidence";
  if (row.validationEvidenceState === "Weak Evidence") return "weak evidence";
  if (row.validationEvidenceState === "Strong Evidence") return "strong evidence";
  return "passed validation";
}

export function frozenFloor010Allocation(row: CapitalStarvationDecision): number {
  return shadowAllocationForMode(row, "floor_0_10");
}

function allocationForMode(row: CapitalStarvationDecision, mode: UntouchedForwardMode): number {
  if (mode === "production_current") return Math.max(0, row.activeAllocation);
  return frozenFloor010Allocation(row);
}

function decisionForMode(row: CapitalStarvationDecision, mode: UntouchedForwardMode, costPerUnitAllocation: number): TrackerDecision {
  const allocation = allocationForMode(row, mode);
  const grossReturn = safeReturn(row);
  const netReturn = grossReturn - (allocation > 0 ? costPerUnitAllocation : 0);
  return {
    date: row.date,
    symbol: row.symbol,
    mode,
    allocation,
    grossReturn,
    netReturn,
    returnContribution: allocation * netReturn,
    regimeBucket: regimeBucket(row),
    evidenceBucket: primaryEvidenceBucket(row),
    validationEvidenceState: row.validationEvidenceState
  };
}

function evaluateMode(rows: CapitalStarvationDecision[], mode: UntouchedForwardMode, costPerUnitAllocation: number): TrackerModeResult {
  const decisions = rows.map((row) => decisionForMode(row, mode, costPerUnitAllocation));
  return { mode, decisions, performance: performance(decisions) };
}

export function filterUntouchedForwardRows(
  rows: CapitalStarvationDecision[],
  previousCutoffBySymbol: Record<string, string>,
  minMeaningfulRows = DEFAULT_MIN_MEANINGFUL_ROWS
): UntouchedForwardWindow {
  const untouchedRows = [...rows]
    .filter((row) => {
      const cutoff = previousCutoffBySymbol[row.symbol];
      return cutoff === undefined || row.date > cutoff;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol));
  const included = new Set(untouchedRows.map((row) => row.symbol));
  const all = new Set(rows.map((row) => row.symbol));
  const dates = untouchedRows.map((row) => row.date).sort();

  return {
    untouchedRows,
    excludedRows: rows.length - untouchedRows.length,
    dateRange: dates.length === 0 ? "n/a" : `${dates[0]} to ${dates[dates.length - 1]}`,
    assetsIncluded: [...included].sort(),
    assetsExcluded: [...all].filter((symbol) => !included.has(symbol)).sort(),
    sampleLargeEnough: untouchedRows.length >= minMeaningfulRows,
    sampleAssessment: untouchedRows.length >= minMeaningfulRows ? "meaningful" : "preliminary"
  };
}

function groupPerformance(decisions: TrackerDecision[]): TrackerGroupBreakdown {
  return { rows: decisions.length, ...performance(decisions) };
}

function emptyGroup(): TrackerGroupBreakdown {
  return groupPerformance([]);
}

function groupedBy<T extends string>(decisions: TrackerDecision[], keys: readonly T[], keyFor: (decision: TrackerDecision) => T): Record<T, TrackerGroupBreakdown> {
  const grouped = Object.fromEntries(keys.map((key) => [key, [] as TrackerDecision[]])) as Record<T, TrackerDecision[]>;
  for (const decision of decisions) {
    grouped[keyFor(decision)].push(decision);
  }
  return Object.fromEntries(keys.map((key) => [key, groupPerformance(grouped[key])])) as Record<T, TrackerGroupBreakdown>;
}

function assetBreakdown(decisions: TrackerDecision[]): Record<string, AssetDiagnosis> {
  const byAsset = new Map<string, TrackerDecision[]>();
  for (const decision of decisions) byAsset.set(decision.symbol, [...(byAsset.get(decision.symbol) ?? []), decision]);

  return Object.fromEntries(
    [...byAsset.entries()].map(([symbol, assetDecisions]) => {
      const stats = groupPerformance(assetDecisions);
      const worstDecision = Math.min(0, ...assetDecisions.map((decision) => decision.returnContribution));
      const outliers = outlierDependency(assetDecisions);
      const flags: string[] = [];
      if (symbol === "AAPL" && (stats.expectancy <= 0 || stats.profitFactor < 1.1)) flags.push("AAPL watchlist failure");
      if (symbol === "ETHUSDT" && (stats.expectancy <= 0 || stats.profitFactor < 1.1)) flags.push("ETHUSDT watchlist failure");
      if (stats.expectancy < 0) flags.push("negative expectancy");
      if (stats.maxDrawdown <= -0.05) flags.push("high drawdown");
      if (outliers.fragile) flags.push("one-outlier dependent");
      return [
        symbol,
        {
          ...stats,
          worstDecision,
          shouldRemainEligible: flags.length === 0 && stats.activeDays > 0 && stats.profitFactor >= 1,
          flags
        }
      ];
    })
  );
}

function regimeBreakdown(decisions: TrackerDecision[]): Record<RegimeBucket, RegimeDiagnosis> {
  const base = groupedBy(decisions, ["normal/uptrend", "downtrend", "risk-off", "unknown"] as const, (decision) => decision.regimeBucket);
  return Object.fromEntries(
    Object.entries(base).map(([bucket, stats]) => {
      let recommendation: RegimeDiagnosis["recommendation"] = "reduced";
      if (stats.rows === 0 || stats.activeDays === 0) recommendation = "disabled";
      else if (stats.totalReturn > 0 && stats.expectancy > 0 && stats.profitFactor > 1.1 && stats.maxDrawdown > -0.05) recommendation = "active";
      else if (stats.totalReturn < 0 || stats.expectancy < 0 || stats.maxDrawdown <= -0.05) recommendation = "disabled";
      return [bucket, { ...stats, recommendation }];
    })
  ) as Record<RegimeBucket, RegimeDiagnosis>;
}

function evidenceBreakdown(decisions: TrackerDecision[]): Record<EvidenceBucket, TrackerGroupBreakdown> {
  const base = groupedBy(
    decisions,
    ["passed validation", "failed validation", "no evidence", "weak evidence", "strong evidence"] as const,
    (decision) => decision.evidenceBucket
  );
  const strongRows = decisions.filter((decision) => decision.validationEvidenceState === "Strong Evidence");
  const passedRows = decisions.filter((decision) =>
    decision.validationEvidenceState === "Moderate Evidence" || decision.validationEvidenceState === "Strong Evidence"
  );
  return {
    ...base,
    "passed validation": groupPerformance(passedRows),
    "strong evidence": groupPerformance(strongRows)
  };
}

function outlierDependency(decisions: TrackerDecision[]): TrackerOutlierDependency {
  const positive = decisions.map((decision) => Math.max(0, decision.returnContribution)).sort((a, b) => b - a);
  const totalPositive = positive.reduce((sum, value) => sum + value, 0);
  const total = decisions.reduce((sum, decision) => sum + decision.returnContribution, 0);
  const top = (count: number) => positive.slice(0, count).reduce((sum, value) => sum + value, 0);
  const share = (count: number) => (totalPositive === 0 ? 0 : top(count) / totalPositive);
  return {
    oneTradeContributionShare: share(1),
    top3ContributionShare: share(3),
    top5ContributionShare: share(5),
    profitWithoutBestTrade: total - top(1),
    profitWithoutBest3Trades: total - top(3),
    profitWithoutBest5Trades: total - top(5),
    fragile: share(1) > 0.5 || share(3) > 0.8
  };
}

function maxAssetPositiveShare(decisions: TrackerDecision[]): number {
  const byAsset = new Map<string, number>();
  for (const decision of decisions) {
    byAsset.set(decision.symbol, (byAsset.get(decision.symbol) ?? 0) + Math.max(0, decision.returnContribution));
  }
  const totalPositive = [...byAsset.values()].reduce((sum, value) => sum + value, 0);
  return totalPositive === 0 ? 0 : Math.max(0, ...byAsset.values()) / totalPositive;
}

function passFail(
  frozen: TrackerModeResult,
  outliers: TrackerOutlierDependency,
  regimes: Record<RegimeBucket, RegimeDiagnosis>,
  maxAssetShare: number
): TrackerPassFail {
  const perf = frozen.performance;
  const riskOffDowntrendLoss = regimes["risk-off"].totalReturn + regimes.downtrend.totalReturn;
  return {
    positiveAfterMediumCosts: {
      passed: perf.totalReturn > 0,
      detail: "Total return must remain positive after medium costs."
    },
    maxDrawdownBelowFivePercent: {
      passed: perf.maxDrawdown > -0.05,
      detail: "Max drawdown must stay below 5%."
    },
    profitFactorAboveOneTen: {
      passed: perf.profitFactor > 1.1,
      detail: "Profit factor must remain above 1.10."
    },
    positiveExpectancyAfterCosts: {
      passed: perf.expectancy > 0,
      detail: "Expectancy must remain positive after costs."
    },
    notOutlierDependent: {
      passed: !outliers.fragile,
      detail: "Result must not rely on one or a few outlier trades."
    },
    notSingleAssetDependent: {
      passed: maxAssetShare <= 0.8,
      detail: "No single asset may contribute more than 80% of positive profit."
    },
    riskOffDowntrendAcceptable: {
      passed: riskOffDowntrendLoss > -0.002 && regimes["risk-off"].maxDrawdown > -0.05 && regimes.downtrend.maxDrawdown > -0.05,
      detail: "Risk-off and downtrend splits must not create material losses."
    }
  };
}

function killSwitches(
  frozen: TrackerModeResult,
  outliers: TrackerOutlierDependency,
  regimes: Record<RegimeBucket, RegimeDiagnosis>,
  maxAssetShare: number,
  worstFiveDecisionResearchLossThreshold: number
): TrackerKillSwitches {
  const perf = frozen.performance;
  const contributions = frozen.decisions.map((decision) => decision.returnContribution);
  const riskOffDowntrendLoss = regimes["risk-off"].totalReturn + regimes.downtrend.totalReturn;
  const hasActiveDecisions = perf.activeDays > 0;
  return {
    maxDrawdownExceeded: perf.maxDrawdown <= -0.05,
    mediumCostReturnNegative: perf.totalReturn < 0,
    profitFactorBelowOne: hasActiveDecisions && perf.profitFactor < 1,
    expectancyNegative: perf.expectancy < 0,
    worstFiveDecisionSequenceExceeded: windowWorst(contributions, 5) < worstFiveDecisionResearchLossThreshold,
    oneAssetProfitConcentrationExceeded: maxAssetShare > 0.8,
    oneTradeContributionExceeded: outliers.oneTradeContributionShare > 0.5,
    riskOffDowntrendMateriallyHarmful: riskOffDowntrendLoss < -0.002 || regimes["risk-off"].maxDrawdown <= -0.05 || regimes.downtrend.maxDrawdown <= -0.05
  };
}

function evidenceAnswers(breakdown: Record<EvidenceBucket, TrackerGroupBreakdown>): EvidenceAnswers {
  const failed = breakdown["failed validation"];
  const noEvidence = breakdown["no evidence"];
  const failedEvidenceRowsRemainBlocked = failed.rows === 0 ? "inconclusive" : failed.totalReturn > 0 && failed.profitFactor > 1.1 ? "no" : "yes";
  const noEvidenceRowsRemainBlocked = noEvidence.rows === 0 ? "inconclusive" : noEvidence.totalReturn > 0 && noEvidence.profitFactor > 1.1 ? "no" : "yes";
  const softValidationStillResearch =
    failedEvidenceRowsRemainBlocked === "no" || noEvidenceRowsRemainBlocked === "no" ? "yes, paper-only" : "inconclusive";
  return { failedEvidenceRowsRemainBlocked, noEvidenceRowsRemainBlocked, softValidationStillResearch };
}

function verdict(input: {
  sampleLargeEnough: boolean;
  frozen: TrackerModeResult;
  killSwitches: TrackerKillSwitches;
  passFail: TrackerPassFail;
  assets: Record<string, AssetDiagnosis>;
  regimes: Record<RegimeBucket, RegimeDiagnosis>;
}): UntouchedForwardTrackerVerdict {
  if (!input.sampleLargeEnough) return "Inconclusive; sample too small.";
  if (input.killSwitches.maxDrawdownExceeded) return "Unsafe; reduce or disable allocation logic.";
  if (
    input.killSwitches.mediumCostReturnNegative ||
    input.killSwitches.profitFactorBelowOne ||
    input.killSwitches.expectancyNegative ||
    input.killSwitches.worstFiveDecisionSequenceExceeded
  ) {
    return "Disable floor_0_10 shadow tracking due to failed forward results.";
  }
  if (Object.values(input.assets).some((asset) => asset.activeDays > 0 && !asset.shouldRemainEligible)) {
    return "Research asset exclusions before continuing.";
  }
  if (input.regimes.downtrend.recommendation === "disabled" || input.regimes["risk-off"].recommendation === "disabled") {
    return "Research regime filters before continuing.";
  }
  if (Object.values(input.passFail).every((criterion) => criterion.passed)) return "Continue paper-only floor_0_10 tracking.";
  return input.frozen.performance.totalReturn > 0 ? "Keep production unchanged and collect more data." : "Inconclusive; sample too small.";
}

export function evaluateUntouchedForwardShadowTracker(input: UntouchedForwardShadowTrackerInput): UntouchedForwardShadowTrackerResult {
  const costs = input.costScenarios ?? DEFAULT_COST_SCENARIOS;
  const medium = costs.find((cost) => cost.name === "medium cost" || cost.name === "medium") ?? DEFAULT_COST_SCENARIOS[2];
  const window = filterUntouchedForwardRows(input.rows, input.previousCutoffBySymbol, input.minMeaningfulRows ?? DEFAULT_MIN_MEANINGFUL_ROWS);
  const production = evaluateMode(window.untouchedRows, "production_current", medium.costPerUnitAllocation);
  const frozen = evaluateMode(window.untouchedRows, "frozen_floor_0_10", medium.costPerUnitAllocation);
  const costSensitivity = costs.map((cost) => {
    const costResult = evaluateMode(window.untouchedRows, "frozen_floor_0_10", cost.costPerUnitAllocation);
    return {
      costScenario: cost.name,
      performance: costResult.performance,
      survivesEdge:
        costResult.performance.totalReturn > 0 &&
        costResult.performance.maxDrawdown > -0.05 &&
        costResult.performance.profitFactor > 1 &&
        costResult.performance.expectancy > 0
    };
  });
  const assets = assetBreakdown(frozen.decisions);
  const regimes = regimeBreakdown(frozen.decisions);
  const evidence = evidenceBreakdown(frozen.decisions);
  const outliers = outlierDependency(frozen.decisions);
  const assetShare = maxAssetPositiveShare(frozen.decisions);
  const criteria = passFail(frozen, outliers, regimes, assetShare);
  const switches = killSwitches(
    frozen,
    outliers,
    regimes,
    assetShare,
    input.worstFiveDecisionResearchLossThreshold ?? DEFAULT_WORST_FIVE_DECISION_THRESHOLD
  );
  const finalVerdict = verdict({
    sampleLargeEnough: window.sampleLargeEnough,
    frozen,
    killSwitches: switches,
    passFail: criteria,
    assets,
    regimes
  });

  return {
    policyStatement: POLICY_STATEMENT,
    window,
    production,
    frozen,
    costSensitivity,
    passFail: criteria,
    killSwitches: switches,
    assetBreakdown: assets,
    regimeBreakdown: regimes,
    evidenceBreakdown: evidence,
    evidenceAnswers: evidenceAnswers(evidence),
    outlierDependency: outliers,
    answers: {
      shouldRemainPaperOnly: "yes",
      shouldProductionRemainUnchanged: "yes",
      isFloor010ReadyForProduction:
        window.sampleLargeEnough && finalVerdict === "Continue paper-only floor_0_10 tracking." && Object.values(criteria).every((criterion) => criterion.passed)
          ? "yes"
          : "no",
      isFloor100ReadyForProduction: "no",
      nextSafestPaperOnlyAction:
        finalVerdict === "Continue paper-only floor_0_10 tracking."
          ? "Continue frozen floor_0_10 paper tracking into another untouched window; do not change production sizing."
          : "Keep production unchanged and collect more untouched paper-only forward rows."
    },
    finalVerdict
  };
}
