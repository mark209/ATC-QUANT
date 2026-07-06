import type { PaperReplayResult, ReplayResultRow } from "./historicalReplay";

export type AllocationBucket =
  | "0%"
  | ">0% to 0.25%"
  | "0.25% to 0.50%"
  | "0.50% to 1.00%"
  | "1.00% to 2.00%"
  | "2.00% to 5.00%"
  | ">5.00%";

export type AllocationBottleneck =
  | "Data quality failed"
  | "Risk-off regime"
  | "Expected value failed"
  | "No validation evidence"
  | "Failed validation evidence"
  | "Kelly/sample-size sizing"
  | "Final decision zeroed allocation"
  | "Sub-meaningful allocation"
  | "Allocation active";

export interface AllocationDistribution {
  counts: Record<AllocationBucket, number>;
  zeroAllocationDays: number;
  activeAllocationDays: number;
  meaningfulAllocationDays: number;
  averageAllocation: number;
  averageNonZeroAllocation: number;
}

export interface PaperReplayAuditSummary {
  symbol: string;
  totalReturn: number;
  averageMonthlyReturn: number;
  monthlyWinCount: number;
  monthlyLossCount: number;
  maxDrawdown: number;
  sharpeLikeReturn: number;
  profitFactor: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  expectancyPerTrade: number;
  tradeCount: number;
  skippedOpportunities: number;
  averageAllocation: number;
  daysWithActiveAllocationPct: number;
  zeroAllocationDays: number;
  bestMonth: string;
  bestMonthReturn: number;
  worstMonth: string;
  worstMonthReturn: number;
  consecutiveLosingTrades: number;
}

export interface ProfitabilityVerdictInput {
  averageMonthlyReturn: number;
  maxDrawdown: number;
  profitFactor: number;
  averageAllocation: number;
  tradeCount: number;
  sampleMonths: number;
}

export interface ProfitabilityVerdict {
  currentlyProfitable: boolean;
  onePercentMonthlyRealistic: boolean;
  twoPercentMonthlyRealistic: boolean;
  fivePercentMonthlyAssessment: string;
  mainBottleneck: string;
}

const ALLOCATION_BUCKETS: AllocationBucket[] = [
  "0%",
  ">0% to 0.25%",
  "0.25% to 0.50%",
  "0.50% to 1.00%",
  "1.00% to 2.00%",
  "2.00% to 5.00%",
  ">5.00%"
];
const ACTIVE_DECISIONS = new Set(["Strong candidate", "Position allowed", "Small allocation only"]);

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function bucketForAllocation(value: number): AllocationBucket {
  if (value <= 0) return "0%";
  if (value < 0.0025) return ">0% to 0.25%";
  if (value < 0.005) return "0.25% to 0.50%";
  if (value < 0.01) return "0.50% to 1.00%";
  if (value < 0.02) return "1.00% to 2.00%";
  if (value <= 0.05) return "2.00% to 5.00%";
  return ">5.00%";
}

export function allocationDistribution(rows: ReplayResultRow[]): AllocationDistribution {
  const counts = Object.fromEntries(ALLOCATION_BUCKETS.map((bucket) => [bucket, 0])) as Record<AllocationBucket, number>;
  const allocations = rows.map((row) => Math.max(0, row.activeAllocation));
  for (const allocation of allocations) counts[bucketForAllocation(allocation)] += 1;

  const nonZero = allocations.filter((allocation) => allocation > 0);
  return {
    counts,
    zeroAllocationDays: counts["0%"],
    activeAllocationDays: nonZero.length,
    meaningfulAllocationDays: allocations.filter((allocation) => allocation >= 0.01).length,
    averageAllocation: average(allocations),
    averageNonZeroAllocation: average(nonZero)
  };
}

export function classifyAllocationBottleneck(row: ReplayResultRow): AllocationBottleneck {
  if (row.dataQualityStatus === "failed" || row.finalDecision === "No Data / Avoid") return "Data quality failed";
  if (row.regimeLabel === "Risk-Off" || row.finalDecision === "Risk-off / no trade") return "Risk-off regime";
  if (row.evAfterCosts <= 0 || row.evStatus === "EV failed") return "Expected value failed";
  if (row.validationEvidenceState === "No Evidence") return "No validation evidence";
  if (row.validationEvidenceState === "Failed Evidence") return "Failed validation evidence";
  if (row.kellyAllocation <= 0) return "Kelly/sample-size sizing";
  if (!ACTIVE_DECISIONS.has(row.finalDecision)) return "Final decision zeroed allocation";
  if (row.activeAllocation <= 0) return "Final decision zeroed allocation";
  if (row.activeAllocation < 0.01) return "Sub-meaningful allocation";
  return "Allocation active";
}

export function summarizePaperReplay(result: PaperReplayResult): PaperReplayAuditSummary {
  const distribution = allocationDistribution(result.decisionLog);
  const skippedOpportunities = result.decisionLog.filter(
    (row) => row.activeAllocation === 0 && row.signalScore >= 70 && row.regimeLabel === "Trend Up"
  ).length;
  const monthlyReturns = result.monthlyReturns.map((month) => month.returnPct);
  const bestMonth = result.bestMonth ?? null;
  const worstMonth = result.worstMonth ?? null;

  return {
    symbol: result.symbol,
    totalReturn: result.totalReturn,
    averageMonthlyReturn: average(monthlyReturns),
    monthlyWinCount: monthlyReturns.filter((value) => value > 0).length,
    monthlyLossCount: monthlyReturns.filter((value) => value < 0).length,
    maxDrawdown: result.maxDrawdown,
    sharpeLikeReturn: result.sharpeRatio,
    profitFactor: result.profitFactor,
    winRate: result.winRate,
    averageWin: result.averageWin,
    averageLoss: result.averageLoss,
    expectancyPerTrade: result.expectancyAfterCosts,
    tradeCount: result.totalTrades,
    skippedOpportunities,
    averageAllocation: result.averageAllocation,
    daysWithActiveAllocationPct: distribution.activeAllocationDays / Math.max(1, result.decisionLog.length),
    zeroAllocationDays: distribution.zeroAllocationDays,
    bestMonth: bestMonth?.month ?? "n/a",
    bestMonthReturn: bestMonth?.returnPct ?? 0,
    worstMonth: worstMonth?.month ?? "n/a",
    worstMonthReturn: worstMonth?.returnPct ?? 0,
    consecutiveLosingTrades: result.longestLosingStreak
  };
}

export function profitabilityVerdict(input: ProfitabilityVerdictInput): ProfitabilityVerdict {
  const hasEnoughMonths = input.sampleMonths >= 12;
  const hasEnoughTrades = input.tradeCount >= 30;
  const capitalStarved = input.averageAllocation < 0.01;
  const economicallyPositive = input.averageMonthlyReturn > 0 && input.profitFactor > 1 && input.maxDrawdown > -0.2;
  const currentlyProfitable = economicallyPositive && input.tradeCount > 0;
  const onePercentMonthlyRealistic =
    currentlyProfitable && hasEnoughMonths && hasEnoughTrades && !capitalStarved && input.averageMonthlyReturn >= 0.0075;
  const twoPercentMonthlyRealistic =
    onePercentMonthlyRealistic && input.averageMonthlyReturn >= 0.015 && input.profitFactor >= 1.4 && input.maxDrawdown > -0.15;

  const mainBottleneck = capitalStarved
    ? "The system is capital-starved: average active allocation is below 1%, so even correct signals cannot compound meaningfully."
    : !hasEnoughTrades
      ? "The trade sample is too small to support a profitability claim."
      : input.profitFactor <= 1
        ? "The realized trade distribution does not show positive profit factor after costs."
        : input.maxDrawdown <= -0.2
          ? "Drawdown is too deep for the observed return profile."
          : "The bottleneck is not isolated; review allocation, validation, and cost assumptions together.";

  return {
    currentlyProfitable,
    onePercentMonthlyRealistic,
    twoPercentMonthlyRealistic,
    fivePercentMonthlyAssessment:
      "5% monthly is unrealistic/high risk for this architecture unless materially higher drawdown, leverage, or concentration is accepted.",
    mainBottleneck
  };
}
