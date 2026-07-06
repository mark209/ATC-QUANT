import type { AssetType } from "@/types/asset";
import type { SampleQuality, ValidationEvidenceState } from "@/types/quant";

export type RejectionCategory =
  | "rejected by risk-off regime"
  | "rejected by failed validation"
  | "rejected by no validation evidence"
  | "rejected by Kelly/sample-size penalty"
  | "rejected by EV/expectancy gate"
  | "rejected by final decision zeroing"
  | "accepted but tiny allocation"
  | "accepted with meaningful allocation";

export interface CapitalStarvationDecision {
  date: string;
  symbol: string;
  assetType: AssetType;
  finalDecision: string;
  activeAllocation: number;
  signalScore: number;
  riskScore: number;
  validationScore: number;
  validationEvidenceState: ValidationEvidenceState;
  evAfterCosts: number;
  evPassed: boolean;
  kellyAllocation: number;
  preHardRuleKellyAllocation: number;
  tradeCount: number;
  sampleQuality: SampleQuality;
  dataQualityPassed: boolean;
  regimeLabel: string;
  nextPeriodReturn: number | null;
  maxAdverseMove: number | null;
  maxFavorableMove: number | null;
  blockingReasons: string[];
  warnings: string[];
}

export interface CategoryStats {
  category: RejectionCategory;
  count: number;
  percentOfTotal: number;
  averageNextPeriodReturn: number;
  averageMissedReturn: number;
  netPositive: boolean;
}

export interface RejectedOpportunityAudit {
  totalDecisions: number;
  byCategory: Record<RejectionCategory, CategoryStats>;
}

export interface DecisionContribution {
  date: string;
  symbol: string;
  allocation: number;
  nextPeriodReturn: number;
  returnContribution: number;
  category: RejectionCategory;
}

export interface AllocationSensitivityScenario {
  name: string;
  monthlyReturn: number;
  totalReturn: number;
  maxDrawdown: number;
  volatility: number;
  activeDays: number;
  averageAllocation: number;
  medianAllocation: number;
  percentDaysAtLeast010: number;
  percentDaysAtLeast025: number;
  percentDaysAtLeast050: number;
  percentDaysAtLeast100: number;
  worstDecisions: DecisionContribution[];
  bestDecisions: DecisionContribution[];
}

export interface SignalQualityBucket {
  count: number;
  averageReturn: number;
  hitRate: number;
  averageWin: number;
  averageLoss: number;
  payoffRatio: number;
  profitFactor: number;
  expectancy: number;
  maxAdverseMove: number | null;
  maxFavorableMove: number | null;
}

export interface SignalQualityAudit {
  overall: SignalQualityBucket;
  byConfidence: Record<string, SignalQualityBucket>;
  byEv: Record<string, SignalQualityBucket>;
  byValidation: Record<string, SignalQualityBucket>;
  byRegime: Record<string, SignalQualityBucket>;
  byAsset: Record<string, SignalQualityBucket>;
}

export interface KellyAlternativeStats {
  averageAllocation: number;
  averageReturnContribution: number;
  commentary: string;
}

export interface KellyRuleDiagnosis {
  hardRuleBlockedCount: number;
  hardRuleBlockedPercent: number;
  averageAllocationBeforeHardRule: number;
  averageAllocationAfterHardRule: number;
  blockedTradeAverageReturn: number;
  blockedTradesNetPositive: boolean;
  alternatives: Record<string, KellyAlternativeStats>;
  recommendation: string;
}

export type CapitalStarvationFinalVerdict =
  | "Signal is weak; do not increase capital."
  | "Signal has edge, but allocation rules are too restrictive."
  | "Inconclusive; needs more forward data."
  | "Strategy is unsafe; reduce or disable allocation.";

export interface FinalVerdictInput {
  signalExpectancy: number;
  sensitivityImprovesReturn: boolean;
  sensitivityMaxDrawdown: number;
  sampleSize: number;
}

export interface FinalVerdictResult {
  verdict: CapitalStarvationFinalVerdict;
  nextSafestChange: string;
  rationale: string;
}

const REJECTION_CATEGORIES: RejectionCategory[] = [
  "rejected by risk-off regime",
  "rejected by failed validation",
  "rejected by no validation evidence",
  "rejected by Kelly/sample-size penalty",
  "rejected by EV/expectancy gate",
  "rejected by final decision zeroing",
  "accepted but tiny allocation",
  "accepted with meaningful allocation"
];
const ACTIVE_DECISIONS = new Set(["Strong candidate", "Position allowed", "Small allocation only"]);

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
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function finiteReturn(row: CapitalStarvationDecision): number | null {
  return typeof row.nextPeriodReturn === "number" && Number.isFinite(row.nextPeriodReturn) ? row.nextPeriodReturn : null;
}

export function classifyRejection(row: CapitalStarvationDecision): RejectionCategory {
  if (row.regimeLabel === "Risk-Off" || row.finalDecision === "Risk-off / no trade") return "rejected by risk-off regime";
  if (row.validationEvidenceState === "Failed Evidence") return "rejected by failed validation";
  if (row.validationEvidenceState === "No Evidence") return "rejected by no validation evidence";
  if (!row.evPassed || row.evAfterCosts <= 0) return "rejected by EV/expectancy gate";
  if (row.kellyAllocation <= 0 && row.preHardRuleKellyAllocation > 0) return "rejected by Kelly/sample-size penalty";
  if (!ACTIVE_DECISIONS.has(row.finalDecision) || row.activeAllocation <= 0) return "rejected by final decision zeroing";
  if (row.activeAllocation < 0.01) return "accepted but tiny allocation";
  return "accepted with meaningful allocation";
}

export function analyzeRejectedOpportunities(
  rows: CapitalStarvationDecision[],
  smallPaperAllocation = 0.0025
): RejectedOpportunityAudit {
  const byCategory = Object.fromEntries(
    REJECTION_CATEGORIES.map((category) => [
      category,
      {
        category,
        count: 0,
        percentOfTotal: 0,
        averageNextPeriodReturn: 0,
        averageMissedReturn: 0,
        netPositive: false
      }
    ])
  ) as Record<RejectionCategory, CategoryStats>;
  const returnsByCategory = new Map<RejectionCategory, number[]>();

  for (const row of rows) {
    const category = classifyRejection(row);
    const nextReturn = finiteReturn(row);
    byCategory[category].count += 1;
    if (nextReturn !== null) {
      const existing = returnsByCategory.get(category) ?? [];
      existing.push(nextReturn);
      returnsByCategory.set(category, existing);
    }
  }

  for (const category of REJECTION_CATEGORIES) {
    const returns = returnsByCategory.get(category) ?? [];
    const avgReturn = average(returns);
    byCategory[category] = {
      ...byCategory[category],
      percentOfTotal: byCategory[category].count / Math.max(1, rows.length),
      averageNextPeriodReturn: avgReturn,
      averageMissedReturn: avgReturn * smallPaperAllocation,
      netPositive: avgReturn > 0
    };
  }

  return { totalDecisions: rows.length, byCategory };
}

function isEligibleForDiagnosticCapital(row: CapitalStarvationDecision): boolean {
  return row.dataQualityPassed && row.regimeLabel !== "Risk-Off" && row.evAfterCosts > 0 && row.signalScore >= 60;
}

function sampleQualityMultiplier(sampleQuality: SampleQuality): number {
  if (sampleQuality === "Poor") return 0;
  if (sampleQuality === "Limited") return 0.25;
  if (sampleQuality === "Acceptable") return 0.75;
  return 1;
}

function scenarioAllocation(row: CapitalStarvationDecision, scenarioName: string): number {
  const production = Math.max(0, row.activeAllocation);
  if (scenarioName === "current production allocation") return production;
  if (!isEligibleForDiagnosticCapital(row)) return production;

  if (scenarioName.startsWith("min allocation floor")) {
    const floor = scenarioName.includes("0.10%")
      ? 0.001
      : scenarioName.includes("0.25%")
        ? 0.0025
        : scenarioName.includes("0.50%")
          ? 0.005
          : 0.01;
    return Math.max(production, floor);
  }

  if (scenarioName === "relaxed Kelly warmup below 30 trades") {
    if (row.tradeCount >= 30 || row.preHardRuleKellyAllocation <= 0) return production;
    return Math.max(production, Math.min(0.01, row.preHardRuleKellyAllocation * (row.tradeCount / 30)));
  }

  if (scenarioName === "capped fractional Kelly alternative") {
    return Math.max(production, Math.min(0.02, row.preHardRuleKellyAllocation * 0.5 * sampleQualityMultiplier(row.sampleQuality)));
  }

  if (scenarioName === "validation-softening mode where lack of evidence reduces allocation but does not force zero") {
    if (row.validationEvidenceState !== "No Evidence") return production;
    return Math.max(production, Math.min(0.005, row.preHardRuleKellyAllocation * 0.25));
  }

  return production;
}

function maxDrawdownFromReturns(returns: number[]): number {
  let equity = 1;
  let peak = 1;
  let maxDrawdown = 0;
  for (const value of returns) {
    equity *= 1 + value;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.min(maxDrawdown, equity / peak - 1);
  }
  return maxDrawdown;
}

function monthlyReturn(rows: CapitalStarvationDecision[], returns: number[]): number {
  const byMonth = new Map<string, number[]>();
  rows.forEach((row, index) => {
    const month = row.date.slice(0, 7);
    const existing = byMonth.get(month) ?? [];
    existing.push(returns[index] ?? 0);
    byMonth.set(month, existing);
  });
  const monthly = Array.from(byMonth.values()).map((values) => values.reduce((equity, value) => equity * (1 + value), 1) - 1);
  return average(monthly);
}

export function analyzeAllocationSensitivity(rows: CapitalStarvationDecision[]): AllocationSensitivityScenario[] {
  const scenarioNames = [
    "current production allocation",
    "min allocation floor of 0.10%",
    "min allocation floor of 0.25%",
    "min allocation floor of 0.50%",
    "min allocation floor of 1.00%",
    "relaxed Kelly warmup below 30 trades",
    "capped fractional Kelly alternative",
    "validation-softening mode where lack of evidence reduces allocation but does not force zero"
  ];

  return scenarioNames.map((name): AllocationSensitivityScenario => {
    const allocations = rows.map((row) => scenarioAllocation(row, name));
    const contributions = rows.map((row, index) => allocations[index] * (finiteReturn(row) ?? 0));
    const decisions = rows.map((row, index): DecisionContribution => ({
      date: row.date,
      symbol: row.symbol,
      allocation: allocations[index],
      nextPeriodReturn: finiteReturn(row) ?? 0,
      returnContribution: contributions[index],
      category: classifyRejection(row)
    }));
    const totalReturn = contributions.reduce((equity, value) => equity * (1 + value), 1) - 1;

    return {
      name,
      monthlyReturn: monthlyReturn(rows, contributions),
      totalReturn,
      maxDrawdown: maxDrawdownFromReturns(contributions),
      volatility: standardDeviation(contributions),
      activeDays: allocations.filter((allocation) => allocation > 0).length,
      averageAllocation: average(allocations),
      medianAllocation: median(allocations),
      percentDaysAtLeast010: allocations.filter((allocation) => allocation >= 0.001).length / Math.max(1, rows.length),
      percentDaysAtLeast025: allocations.filter((allocation) => allocation >= 0.0025).length / Math.max(1, rows.length),
      percentDaysAtLeast050: allocations.filter((allocation) => allocation >= 0.005).length / Math.max(1, rows.length),
      percentDaysAtLeast100: allocations.filter((allocation) => allocation >= 0.01).length / Math.max(1, rows.length),
      worstDecisions: [...decisions].sort((a, b) => a.returnContribution - b.returnContribution).slice(0, 5),
      bestDecisions: [...decisions].sort((a, b) => b.returnContribution - a.returnContribution).slice(0, 5)
    };
  });
}

function summarizeReturns(rows: CapitalStarvationDecision[]): SignalQualityBucket {
  const returns = rows.map(finiteReturn).filter((value): value is number => value !== null);
  const wins = returns.filter((value) => value > 0);
  const losses = returns.filter((value) => value < 0);
  const grossWin = wins.reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(losses.reduce((sum, value) => sum + value, 0));
  const avgWin = average(wins);
  const avgLoss = average(losses);
  const adverseMoves = rows.map((row) => row.maxAdverseMove).filter((value): value is number => typeof value === "number");
  const favorableMoves = rows.map((row) => row.maxFavorableMove).filter((value): value is number => typeof value === "number");

  return {
    count: rows.length,
    averageReturn: average(returns),
    hitRate: returns.length === 0 ? 0 : wins.length / returns.length,
    averageWin: avgWin,
    averageLoss: avgLoss,
    payoffRatio: avgLoss === 0 ? (avgWin > 0 ? Number.POSITIVE_INFINITY : 0) : avgWin / Math.abs(avgLoss),
    profitFactor: grossLoss === 0 ? (grossWin > 0 ? Number.POSITIVE_INFINITY : 0) : grossWin / grossLoss,
    expectancy: average(returns),
    maxAdverseMove: adverseMoves.length === 0 ? null : Math.min(...adverseMoves),
    maxFavorableMove: favorableMoves.length === 0 ? null : Math.max(...favorableMoves)
  };
}

function groupBy(rows: CapitalStarvationDecision[], keyFn: (row: CapitalStarvationDecision) => string): Record<string, SignalQualityBucket> {
  const grouped = new Map<string, CapitalStarvationDecision[]>();
  for (const row of rows) {
    const key = keyFn(row);
    const existing = grouped.get(key) ?? [];
    existing.push(row);
    grouped.set(key, existing);
  }
  return Object.fromEntries(Array.from(grouped.entries()).map(([key, groupedRows]) => [key, summarizeReturns(groupedRows)]));
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

export function analyzeSignalQuality(rows: CapitalStarvationDecision[]): SignalQualityAudit {
  return {
    overall: summarizeReturns(rows),
    byConfidence: groupBy(rows, confidenceBucket),
    byEv: groupBy(rows, evBucket),
    byValidation: groupBy(rows, (row) => row.validationEvidenceState),
    byRegime: groupBy(rows, (row) => row.regimeLabel),
    byAsset: groupBy(rows, (row) => row.symbol)
  };
}

function alternativeAllocation(row: CapitalStarvationDecision, alternative: string): number {
  if (!isEligibleForDiagnosticCapital(row) || row.preHardRuleKellyAllocation <= 0) return row.activeAllocation;
  if (alternative === "current hard rule") return row.kellyAllocation;
  if (alternative === "linear warmup") return row.preHardRuleKellyAllocation * Math.min(1, row.tradeCount / 30);
  if (alternative === "square-root sample-size discount") return row.preHardRuleKellyAllocation * Math.min(1, Math.sqrt(row.tradeCount / 30));
  if (alternative === "Bayesian/shrunk Kelly") return row.preHardRuleKellyAllocation * (row.tradeCount / (row.tradeCount + 30));
  if (alternative === "fixed fractional risk cap") return Math.min(0.005, row.preHardRuleKellyAllocation);
  return row.activeAllocation;
}

export function analyzeKellyRule(rows: CapitalStarvationDecision[]): KellyRuleDiagnosis {
  const blocked = rows.filter((row) => row.tradeCount < 30 && row.kellyAllocation <= 0 && row.preHardRuleKellyAllocation > 0);
  const blockedReturns = blocked.map(finiteReturn).filter((value): value is number => value !== null);
  const alternativeNames = [
    "current hard rule",
    "linear warmup",
    "square-root sample-size discount",
    "Bayesian/shrunk Kelly",
    "fixed fractional risk cap"
  ];
  const alternatives = Object.fromEntries(
    alternativeNames.map((name) => {
      const allocations = blocked.map((row) => alternativeAllocation(row, name));
      const contributions = blocked.map((row, index) => allocations[index] * (finiteReturn(row) ?? 0));
      const commentary =
        name === "Bayesian/shrunk Kelly"
          ? "Bayesian/shrunk Kelly is often more appropriate for a low-frequency trend system because it avoids a binary cliff while still shrinking uncertain samples."
          : name === "current hard rule"
            ? "Current rule blocks all below-30-trade Kelly exposure."
            : "Diagnostic only; does not change production sizing.";
      return [
        name,
        {
          averageAllocation: average(allocations),
          averageReturnContribution: average(contributions),
          commentary
        }
      ];
    })
  ) as Record<string, KellyAlternativeStats>;

  return {
    hardRuleBlockedCount: blocked.length,
    hardRuleBlockedPercent: blocked.length / Math.max(1, rows.length),
    averageAllocationBeforeHardRule: average(blocked.map((row) => row.preHardRuleKellyAllocation)),
    averageAllocationAfterHardRule: average(blocked.map((row) => row.kellyAllocation)),
    blockedTradeAverageReturn: average(blockedReturns),
    blockedTradesNetPositive: average(blockedReturns) > 0,
    alternatives,
    recommendation:
      "Do not remove the hard rule blindly. Compare hard-zero behavior against linear, square-root, Bayesian/shrunk, and fixed-fractional diagnostics in paper replay first."
  };
}

export function capitalStarvationVerdict(input: FinalVerdictInput): FinalVerdictResult {
  if (input.sensitivityMaxDrawdown <= -0.3) {
    return {
      verdict: "Strategy is unsafe; reduce or disable allocation.",
      nextSafestChange: "Keep or tighten allocation caps and investigate drawdown sources before increasing exposure.",
      rationale: "Sensitivity testing produced an unsafe drawdown profile."
    };
  }

  if (input.sampleSize < 100) {
    return {
      verdict: "Inconclusive; needs more forward data.",
      nextSafestChange: "Continue paper replay until there is a larger out-of-sample decision set.",
      rationale: "The decision sample is too small for a capital increase."
    };
  }

  if (input.signalExpectancy <= 0) {
    return {
      verdict: "Signal is weak; do not increase capital.",
      nextSafestChange: "Do not loosen allocation. Improve evidence collection and validate signal quality first.",
      rationale: "Forward decision returns do not show positive expectancy."
    };
  }

  if (input.sensitivityImprovesReturn && input.sensitivityMaxDrawdown > -0.2) {
    return {
      verdict: "Signal has edge, but allocation rules are too restrictive.",
      nextSafestChange: "Test a small paper-only allocation floor or Bayesian Kelly warmup before any production sizing change.",
      rationale: "Signal expectancy is positive and diagnostic allocation sensitivity improved returns without an unacceptable drawdown."
    };
  }

  return {
    verdict: "Inconclusive; needs more forward data.",
    nextSafestChange: "Keep ATC paper-only and extend the forward replay window.",
    rationale: "Evidence is mixed or sensitivity did not clearly improve the outcome."
  };
}
