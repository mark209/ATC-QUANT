import type { CapitalStarvationDecision } from "./capitalStarvationAudit";

export type ShadowAllocationMode =
  | "production_current"
  | "floor_0_10"
  | "floor_0_25"
  | "floor_0_50"
  | "floor_1_00"
  | "soft_validation_penalty"
  | "soft_ev_gate"
  | "final_zeroing_ablation";

export type ShadowVerdict =
  | "Keep production unchanged; signal not robust enough."
  | "Continue paper-only with 0.10% shadow floor."
  | "Continue paper-only with 0.25% shadow floor."
  | "Continue paper-only with soft validation penalty."
  | "Continue paper-only with soft EV gate."
  | "Inconclusive; collect more forward data."
  | "Unsafe; reduce or disable allocation.";

export interface CostScenario {
  name: "no cost" | "low cost" | "medium cost" | "high cost" | string;
  costPerUnitAllocation: number;
}

export interface ShadowDecisionResult {
  date: string;
  symbol: string;
  mode: ShadowAllocationMode;
  allocation: number;
  grossReturn: number;
  netReturn: number;
  returnContribution: number;
  regimeLabel: string;
  confidenceBucket: string;
  evBucket: string;
  validationGrade: string;
}

export interface ShadowPerformance {
  totalReturn: number;
  monthlyReturn: number;
  maxDrawdown: number;
  volatility: number;
  sharpeLikeRatio: number;
  profitFactor: number;
  hitRate: number;
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

export interface ShadowDrawdownSafety {
  worstSingleDecisionLoss: number;
  worst3DecisionSequence: number;
  worst5DecisionSequence: number;
  maxDrawdown: number;
  underwaterPeriods: number;
  violatesFivePercentResearchThreshold: boolean;
}

export interface ShadowLeakageAndRealismChecks {
  lookaheadBiasRisk: "low" | "medium" | "high";
  samePeriodReturnLeakageRisk: "low" | "medium" | "high";
  nextPeriodReturnsUnavailableAtDecisionTime: boolean;
  indicatorsUseFutureDataKnown: boolean;
  costsIncluded: boolean;
  impossibleFillAssumptionRisk: "low" | "medium" | "high";
  outlierDependencyRisk: "low" | "medium" | "high";
  notes: string[];
}

export interface ShadowOutlierDependence {
  topDecisionContributionShare: number;
  topTwoDecisionContributionShare: number;
  reliesOnOneOrTwoOutliers: boolean;
}

export interface ShadowRobustnessBucket {
  count: number;
  totalReturn: number;
  averageReturnContribution: number;
  hitRate: number;
  works: boolean;
}

export interface ShadowRobustness {
  bySplit: Record<string, ShadowRobustnessBucket>;
}

export interface ShadowCostSensitivity {
  costScenario: string;
  performance: ShadowPerformance;
  survivesCosts: boolean;
}

export interface ShadowModeResult {
  mode: ShadowAllocationMode;
  warning: string | null;
  performance: ShadowPerformance;
  decisions: ShadowDecisionResult[];
  robustness: ShadowRobustness;
  costSensitivity: ShadowCostSensitivity[];
  drawdownSafety: ShadowDrawdownSafety;
  leakageAndRealism: ShadowLeakageAndRealismChecks;
  outlierDependence: ShadowOutlierDependence;
}

export interface ShadowExperimentInput {
  selectionRows: CapitalStarvationDecision[];
  holdoutRows: CapitalStarvationDecision[];
  modes?: ShadowAllocationMode[];
  costScenarios?: CostScenario[];
}

export interface ShadowExperimentResult {
  selectionRows: number;
  holdoutRows: number;
  modes: ShadowAllocationMode[];
  modeResults: ShadowModeResult[];
}

export interface RecommendationCandidate {
  mode: ShadowAllocationMode;
  totalReturn: number;
  survivesMediumCost: boolean;
  secondHalfReturn: number;
  maxDrawdown: number;
  outlierShare: number;
}

export interface ShadowRecommendation {
  verdict: ShadowVerdict;
  safestNextExperiment: ShadowAllocationMode | "none";
  rationale: string;
}

const DEFAULT_MODES: ShadowAllocationMode[] = [
  "production_current",
  "floor_0_10",
  "floor_0_25",
  "floor_0_50",
  "floor_1_00",
  "soft_validation_penalty",
  "soft_ev_gate",
  "final_zeroing_ablation"
];

const DEFAULT_COSTS: CostScenario[] = [
  { name: "no cost", costPerUnitAllocation: 0 },
  { name: "low cost", costPerUnitAllocation: 0.001 },
  { name: "medium cost", costPerUnitAllocation: 0.004 },
  { name: "high cost", costPerUnitAllocation: 0.008 }
];

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

function confidenceBucket(row: CapitalStarvationDecision): string {
  if (row.signalScore >= 80) return "High confidence";
  if (row.signalScore >= 65) return "Medium confidence";
  return "Low confidence";
}

function evBucket(row: CapitalStarvationDecision): string {
  if (row.evAfterCosts <= 0) return "EV <= 0";
  if (row.evAfterCosts < 0.01) return "EV 0% to 1%";
  return "EV > 1%";
}

function minimumSafetyPassed(row: CapitalStarvationDecision): boolean {
  return row.dataQualityPassed && row.regimeLabel !== "Risk-Off" && row.evAfterCosts > 0 && row.signalScore >= 60;
}

function strictSafetyPassed(row: CapitalStarvationDecision): boolean {
  return minimumSafetyPassed(row) && row.validationEvidenceState !== "Failed Evidence" && row.validationEvidenceState !== "No Evidence";
}

function weakEvSafetyPassed(row: CapitalStarvationDecision): boolean {
  return row.dataQualityPassed && row.regimeLabel !== "Risk-Off" && row.evAfterCosts > 0 && row.signalScore >= 60;
}

function diagnosticBaseAllocation(row: CapitalStarvationDecision): number {
  const candidates = [row.activeAllocation, row.kellyAllocation, row.preHardRuleKellyAllocation].filter((value) => Number.isFinite(value));
  return Math.max(0, ...candidates);
}

export function shadowAllocationForMode(row: CapitalStarvationDecision, mode: ShadowAllocationMode): number {
  const production = Math.max(0, row.activeAllocation);
  if (mode === "production_current") return production;

  if (mode === "floor_0_10") return strictSafetyPassed(row) ? Math.max(production, 0.001) : production;
  if (mode === "floor_0_25") return strictSafetyPassed(row) ? Math.max(production, 0.0025) : production;
  if (mode === "floor_0_50") return strictSafetyPassed(row) ? Math.max(production, 0.005) : production;
  if (mode === "floor_1_00") return strictSafetyPassed(row) ? Math.max(production, 0.01) : production;

  if (mode === "soft_validation_penalty") {
    if (!minimumSafetyPassed(row)) return production;
    if (row.validationEvidenceState === "Failed Evidence") return Math.max(production, Math.min(0.001, diagnosticBaseAllocation(row) * 0.1));
    if (row.validationEvidenceState === "No Evidence") return Math.max(production, Math.min(0.0025, diagnosticBaseAllocation(row) * 0.25));
    return production;
  }

  if (mode === "soft_ev_gate") {
    if (!weakEvSafetyPassed(row)) return production;
    if (row.evPassed) return production;
    return Math.max(production, Math.min(0.0025, diagnosticBaseAllocation(row) * 0.2));
  }

  if (mode === "final_zeroing_ablation") {
    if (!minimumSafetyPassed(row)) return production;
    return Math.max(production, Math.min(0.005, diagnosticBaseAllocation(row)));
  }

  return production;
}

function buildDecisionResult(
  row: CapitalStarvationDecision,
  mode: ShadowAllocationMode,
  costPerUnitAllocation: number
): ShadowDecisionResult {
  const allocation = shadowAllocationForMode(row, mode);
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
    regimeLabel: row.regimeLabel,
    confidenceBucket: confidenceBucket(row),
    evBucket: evBucket(row),
    validationGrade: row.validationEvidenceState
  };
}

function maxDrawdown(returns: number[]): number {
  let equity = 1;
  let peak = 1;
  let worst = 0;
  for (const value of returns) {
    equity *= 1 + value;
    peak = Math.max(peak, equity);
    worst = Math.min(worst, equity / peak - 1);
  }
  return worst;
}

function monthlyReturn(decisions: ShadowDecisionResult[]): number {
  const byMonth = new Map<string, number[]>();
  for (const decision of decisions) {
    const month = decision.date.slice(0, 7);
    const existing = byMonth.get(month) ?? [];
    existing.push(decision.returnContribution);
    byMonth.set(month, existing);
  }
  return average(Array.from(byMonth.values()).map((values) => values.reduce((sum, value) => sum + value, 0)));
}

function performance(decisions: ShadowDecisionResult[]): ShadowPerformance {
  const contributions = decisions.map((decision) => decision.returnContribution);
  const allocations = decisions.map((decision) => decision.allocation);
  const wins = contributions.filter((value) => value > 0);
  const losses = contributions.filter((value) => value < 0);
  const grossWin = wins.reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(losses.reduce((sum, value) => sum + value, 0));
  const avgWin = average(wins);
  const avgLoss = average(losses);
  const vol = standardDeviation(contributions);

  return {
    totalReturn: contributions.reduce((sum, value) => sum + value, 0),
    monthlyReturn: monthlyReturn(decisions),
    maxDrawdown: maxDrawdown(contributions),
    volatility: vol,
    sharpeLikeRatio: vol === 0 ? 0 : average(contributions) / vol,
    profitFactor: grossLoss === 0 ? (grossWin > 0 ? Number.POSITIVE_INFINITY : 0) : grossWin / grossLoss,
    hitRate: contributions.length === 0 ? 0 : wins.length / contributions.length,
    averageWin: avgWin,
    averageLoss: avgLoss,
    payoffRatio: avgLoss === 0 ? (avgWin > 0 ? Number.POSITIVE_INFINITY : 0) : avgWin / Math.abs(avgLoss),
    expectancy: average(contributions),
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

function windowWorst(values: number[], window: number): number {
  if (values.length === 0) return 0;
  if (values.length < window) return values.reduce((sum, value) => sum + value, 0);
  let worst = Number.POSITIVE_INFINITY;
  for (let index = 0; index + window <= values.length; index += 1) {
    const total = values.slice(index, index + window).reduce((sum, value) => sum + value, 0);
    worst = Math.min(worst, total);
  }
  return worst === Number.POSITIVE_INFINITY ? 0 : worst;
}

function drawdownSafety(decisions: ShadowDecisionResult[]): ShadowDrawdownSafety {
  const contributions = decisions.map((decision) => decision.returnContribution);
  const dd = maxDrawdown(contributions);
  const worstSingle = Math.min(0, ...contributions);
  let equity = 1;
  let peak = 1;
  let underwaterPeriods = 0;
  for (const value of contributions) {
    equity *= 1 + value;
    peak = Math.max(peak, equity);
    if (equity < peak) underwaterPeriods += 1;
  }
  return {
    worstSingleDecisionLoss: worstSingle,
    worst3DecisionSequence: Math.min(worstSingle, windowWorst(contributions, 3)),
    worst5DecisionSequence: Math.min(worstSingle, windowWorst(contributions, 5)),
    maxDrawdown: dd,
    underwaterPeriods,
    violatesFivePercentResearchThreshold: dd <= -0.05
  };
}

function outlierDependence(decisions: ShadowDecisionResult[]): ShadowOutlierDependence {
  const positive = decisions.map((decision) => Math.max(0, decision.returnContribution)).sort((a, b) => b - a);
  const totalPositive = positive.reduce((sum, value) => sum + value, 0);
  const top = totalPositive === 0 ? 0 : (positive[0] ?? 0) / totalPositive;
  const topTwo = totalPositive === 0 ? 0 : ((positive[0] ?? 0) + (positive[1] ?? 0)) / totalPositive;
  return {
    topDecisionContributionShare: top,
    topTwoDecisionContributionShare: topTwo,
    reliesOnOneOrTwoOutliers: topTwo > 0.5
  };
}

function summarizeBucket(decisions: ShadowDecisionResult[]): ShadowRobustnessBucket {
  const contributions = decisions.map((decision) => decision.returnContribution);
  const wins = contributions.filter((value) => value > 0);
  const total = contributions.reduce((sum, value) => sum + value, 0);
  return {
    count: decisions.length,
    totalReturn: total,
    averageReturnContribution: average(contributions),
    hitRate: decisions.length === 0 ? 0 : wins.length / decisions.length,
    works: total > 0 && decisions.length > 0
  };
}

function addBucket(target: Record<string, ShadowDecisionResult[]>, key: string, decision: ShadowDecisionResult): void {
  const existing = target[key] ?? [];
  existing.push(decision);
  target[key] = existing;
}

function robustness(decisions: ShadowDecisionResult[]): ShadowRobustness {
  const grouped: Record<string, ShadowDecisionResult[]> = {};
  const mid = Math.floor(decisions.length / 2);
  decisions.forEach((decision, index) => {
    addBucket(grouped, index < mid ? "first half" : "second half", decision);
    addBucket(grouped, decision.regimeLabel === "Risk-Off" || decision.regimeLabel === "Trend Down" ? "downtrend/risk-off regime" : "uptrend/other regime", decision);
    addBucket(grouped, decision.symbol, decision);
    addBucket(grouped, decision.confidenceBucket, decision);
    addBucket(grouped, decision.evBucket, decision);
    addBucket(grouped, decision.validationGrade, decision);
  });
  return {
    bySplit: Object.fromEntries(Object.entries(grouped).map(([key, value]) => [key, summarizeBucket(value)]))
  };
}

function leakageAndRealism(costsIncluded: boolean, outliers: ShadowOutlierDependence): ShadowLeakageAndRealismChecks {
  return {
    lookaheadBiasRisk: "low",
    samePeriodReturnLeakageRisk: "low",
    nextPeriodReturnsUnavailableAtDecisionTime: true,
    indicatorsUseFutureDataKnown: false,
    costsIncluded,
    impossibleFillAssumptionRisk: "medium",
    outlierDependencyRisk: outliers.reliesOnOneOrTwoOutliers ? "high" : "low",
    notes: [
      "Shadow modes are evaluated on holdout rows only; selection rows are not included in performance metrics.",
      "Next-period returns are measured after the decision date and are unavailable to the decision at the time it is made.",
      "Execution is still an approximation; the model does not prove fill quality, spread stability, partial fills, or market impact."
    ]
  };
}

function modeWarning(mode: ShadowAllocationMode): string | null {
  if (mode === "floor_1_00") return "Aggressive diagnostic only; not a production recommendation.";
  if (mode === "final_zeroing_ablation") return "Unsafe for production unless proven otherwise; this bypasses final decision zeroing diagnostically.";
  return null;
}

function evaluateMode(rows: CapitalStarvationDecision[], mode: ShadowAllocationMode, primaryCost: CostScenario, costs: CostScenario[]): ShadowModeResult {
  const decisions = rows.map((row) => buildDecisionResult(row, mode, primaryCost.costPerUnitAllocation));
  const outliers = outlierDependence(decisions);
  return {
    mode,
    warning: modeWarning(mode),
    performance: performance(decisions),
    decisions,
    robustness: robustness(decisions),
    costSensitivity: costs.map((cost) => {
      const costDecisions = rows.map((row) => buildDecisionResult(row, mode, cost.costPerUnitAllocation));
      const costPerformance = performance(costDecisions);
      return {
        costScenario: cost.name,
        performance: costPerformance,
        survivesCosts: costPerformance.totalReturn > 0 && costPerformance.maxDrawdown > -0.05
      };
    }),
    drawdownSafety: drawdownSafety(decisions),
    leakageAndRealism: leakageAndRealism(primaryCost.costPerUnitAllocation > 0, outliers),
    outlierDependence: outliers
  };
}

export function evaluateShadowAllocationExperiment(input: ShadowExperimentInput): ShadowExperimentResult {
  const modes = input.modes ?? DEFAULT_MODES;
  const costs = input.costScenarios ?? DEFAULT_COSTS;
  const primaryCost = costs.find((cost) => cost.name === "medium cost" || cost.name === "medium") ?? costs[0] ?? DEFAULT_COSTS[2];

  return {
    selectionRows: input.selectionRows.length,
    holdoutRows: input.holdoutRows.length,
    modes,
    modeResults: modes.map((mode) => evaluateMode(input.holdoutRows, mode, primaryCost, costs))
  };
}

function verdictForMode(mode: ShadowAllocationMode): ShadowVerdict {
  if (mode === "floor_0_10") return "Continue paper-only with 0.10% shadow floor.";
  if (mode === "floor_0_25") return "Continue paper-only with 0.25% shadow floor.";
  if (mode === "soft_validation_penalty") return "Continue paper-only with soft validation penalty.";
  if (mode === "soft_ev_gate") return "Continue paper-only with soft EV gate.";
  return "Keep production unchanged; signal not robust enough.";
}

function modeSafetyRank(mode: ShadowAllocationMode): number {
  if (mode === "floor_0_10") return 1;
  if (mode === "floor_0_25") return 2;
  if (mode === "soft_validation_penalty") return 3;
  if (mode === "soft_ev_gate") return 4;
  if (mode === "floor_0_50") return 5;
  if (mode === "floor_1_00") return 6;
  if (mode === "final_zeroing_ablation") return 7;
  return 99;
}

export function recommendShadowMode(
  candidates: RecommendationCandidate[],
  allowedModes: ShadowAllocationMode[] = DEFAULT_MODES
): ShadowRecommendation {
  if (candidates.length === 0) {
    return {
      verdict: "Inconclusive; collect more forward data.",
      safestNextExperiment: "none",
      rationale: "No shadow mode candidates were available."
    };
  }

  const eligible = candidates.filter(
    (candidate) =>
      allowedModes.includes(candidate.mode) &&
      candidate.mode !== "production_current" &&
      candidate.mode !== "final_zeroing_ablation" &&
      candidate.survivesMediumCost &&
      candidate.totalReturn > 0 &&
      candidate.secondHalfReturn > 0 &&
      candidate.maxDrawdown > -0.05 &&
      candidate.outlierShare <= 0.5
  );

  if (eligible.length === 0) {
    const unsafe = candidates.some((candidate) => candidate.maxDrawdown <= -0.05);
    return {
      verdict: unsafe ? "Unsafe; reduce or disable allocation." : "Keep production unchanged; signal not robust enough.",
      safestNextExperiment: "none",
      rationale: "No candidate survived costs, second-half robustness, drawdown, and outlier-dependence filters."
    };
  }

  const conservative = [...eligible].sort((a, b) => modeSafetyRank(a.mode) - modeSafetyRank(b.mode))[0];
  return {
    verdict: verdictForMode(conservative.mode),
    safestNextExperiment: conservative.mode,
    rationale:
      "Recommendation prefers the smallest robust paper-only mode that survived medium costs, second-half performance, drawdown, and outlier checks."
  };
}
