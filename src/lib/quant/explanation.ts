import type { FinalDecisionResult, HardFilterResult, PositionSizingResult, SignalResult, RiskResult } from "@/types/quant";

export function buildDecisionExplanation(input: {
  symbol: string;
  signal: SignalResult;
  risk: RiskResult;
  hardFilters: HardFilterResult;
  decision: FinalDecisionResult;
  sizing: PositionSizingResult;
}): { why: string; improvements: string[]; blockers: string[] } {
  const positive = [
    input.signal.combinedSignalScore >= 65 ? "trend and momentum are supportive" : undefined,
    input.risk.liquidityScore >= 70 ? "liquidity is strong" : undefined,
    input.risk.combinedRiskScore >= 65 ? "risk metrics are acceptable" : undefined
  ].filter(Boolean);
  const blockers = [...input.hardFilters.failedFilters, ...input.decision.blockingReasons];
  const riskText =
    input.decision.finalPositionSize === 0
      ? `allocation is blocked by ${input.sizing.limitingFactor}`
      : `position size is limited by ${input.sizing.limitingFactor}`;
  const why =
    blockers.length > 0
      ? `${input.symbol} is ${input.decision.decisionLabel}. ${positive.length > 0 ? `${positive.join(", ")}, but ` : ""}${riskText}.`
      : `${input.symbol} is ${input.decision.decisionLabel}. ${positive.length > 0 ? positive.join(", ") : "the setup is mixed"}, and ${riskText}.`;

  const improvements: string[] = [];
  if (input.signal.trendScore < 70) improvements.push("Cleaner price alignment above the 50-day and 200-day moving averages.");
  if (input.signal.momentumScore < 65) improvements.push("Stronger multi-window momentum across 1M, 3M, 6M, and 12M windows.");
  if (input.risk.volatilityScore < 65) improvements.push("Lower realized or EWMA volatility.");
  if (input.risk.drawdownScore < 65) improvements.push("Reduced current drawdown stress.");
  if (input.risk.liquidityScore < 65) improvements.push("Higher and more consistent dollar volume.");
  if (input.decision.validationScore < 65) improvements.push("More stable out-of-sample and walk-forward validation.");

  return {
    why,
    improvements: improvements.length > 0 ? improvements : ["Maintain stable trend, liquidity, and validation behavior."],
    blockers: Array.from(new Set(blockers))
  };
}
