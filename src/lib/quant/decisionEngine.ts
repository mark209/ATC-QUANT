import type { DecisionLabel, FinalDecisionResult, RegimeLabel } from "@/types/quant";
import { boundedScore } from "./config";

export interface FinalDecisionInput {
  dataQualityPassed: boolean;
  hardFiltersPassed: boolean;
  hardFilterBlockingReason?: string;
  regimeLabel: RegimeLabel;
  expectedValuePassed: boolean;
  signalScore: number;
  riskScore: number;
  validationScore: number;
  liquidityScore: number;
  finalPositionSize: number;
  riskWarnings: string[];
  validationWarnings: string[];
  portfolioWarnings: string[];
  primaryReasons: string[];
  blockingReasons: string[];
}

export function buildFinalDecision(input: FinalDecisionInput): FinalDecisionResult {
  const blockingReasons = [...input.blockingReasons];
  const warnings = [...input.riskWarnings, ...input.validationWarnings, ...input.portfolioWarnings];
  const finalScore = boundedScore(input.signalScore * 0.4 + input.riskScore * 0.3 + input.validationScore * 0.2 + input.liquidityScore * 0.1);
  let decisionLabel: DecisionLabel;

  if (!input.dataQualityPassed || input.regimeLabel === "No Data / Avoid") {
    decisionLabel = "No Data / Avoid";
  } else if (input.regimeLabel === "Risk-Off") {
    decisionLabel = "Risk-off / no trade";
  } else if (!input.hardFiltersPassed) {
    decisionLabel = input.hardFilterBlockingReason === "Expected value after costs" ? "Watchlist only" : "Avoid for now";
    if (input.hardFilterBlockingReason) blockingReasons.push(input.hardFilterBlockingReason);
  } else if (!input.expectedValuePassed) {
    decisionLabel = "Watchlist only";
    blockingReasons.push("Expected value is not reliable after costs and sample-size adjustment.");
  } else if (input.finalPositionSize === 0) {
    decisionLabel = "Risk-off / no trade";
    blockingReasons.push("Final position size is zero after sizing constraints.");
  } else if (input.signalScore >= 82 && input.riskScore >= 72 && input.validationScore >= 70 && input.finalPositionSize >= 0.08) {
    decisionLabel = "Strong candidate";
  } else if (input.signalScore >= 70 && input.riskScore >= 65 && input.validationScore >= 60) {
    decisionLabel = "Position allowed";
  } else if (input.signalScore >= 70 && (input.riskScore < 55 || input.finalPositionSize <= 0.03)) {
    decisionLabel = "Small allocation only";
  } else if (input.signalScore >= 50) {
    decisionLabel = "Watchlist only";
  } else {
    decisionLabel = "Avoid for now";
  }

  if (warnings.some((warning) => warning.toLowerCase().includes("severe")) && decisionLabel === "Strong candidate") {
    decisionLabel = "Small allocation only";
  }

  return {
    decisionLabel,
    finalScore,
    signalScore: boundedScore(input.signalScore),
    riskScore: boundedScore(input.riskScore),
    validationScore: boundedScore(input.validationScore),
    finalPositionSize: input.finalPositionSize,
    primaryReasons: input.primaryReasons,
    blockingReasons: Array.from(new Set(blockingReasons)),
    warnings: Array.from(new Set(warnings))
  };
}
