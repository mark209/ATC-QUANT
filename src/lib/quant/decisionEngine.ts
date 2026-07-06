import type { DecisionLabel, FinalDecisionResult, RegimeLabel, ValidationEvidenceState } from "@/types/quant";
import { boundedScore, DEFAULT_QUANT_CONFIG } from "./config";

export interface FinalDecisionInput {
  dataQualityPassed: boolean;
  hardFiltersPassed: boolean;
  hardFilterBlockingReason?: string;
  regimeLabel: RegimeLabel;
  expectedValuePassed: boolean;
  signalScore: number;
  riskScore: number;
  validationScore: number;
  validationEvidenceState?: ValidationEvidenceState;
  liquidityScore: number;
  finalPositionSize: number;
  riskWarnings: string[];
  validationWarnings: string[];
  portfolioWarnings: string[];
  primaryReasons: string[];
  blockingReasons: string[];
}

function scoreWithinLabelBand(rawScore: number, min: number, max: number): number {
  const scaled = min + (boundedScore(rawScore) / 100) * (max - min);
  return boundedScore(scaled);
}

export function buildFinalDecision(input: FinalDecisionInput): FinalDecisionResult {
  const thresholds = DEFAULT_QUANT_CONFIG.decisionThresholds;
  const blockingReasons = [...input.blockingReasons];
  const warnings = [...input.riskWarnings, ...input.validationWarnings, ...input.portfolioWarnings];
  const rawModelScore = boundedScore(input.signalScore * 0.4 + input.riskScore * 0.3 + input.validationScore * 0.2 + input.liquidityScore * 0.1);
  const evidenceState = input.validationEvidenceState ?? (input.validationScore >= thresholds.strongCandidateValidationScore ? "Strong Evidence" : input.validationScore >= thresholds.positionAllowedValidationScore ? "Moderate Evidence" : "Weak Evidence");
  let decisionLabel: DecisionLabel;

  if (!input.dataQualityPassed || input.regimeLabel === "No Data / Avoid") {
    decisionLabel = "No Data / Avoid";
  } else if (input.regimeLabel === "Risk-Off") {
    decisionLabel = "Risk-off / no trade";
  } else if (!input.hardFiltersPassed && input.hardFilterBlockingReason === "Risk-off regime") {
    decisionLabel = "Risk-off / no trade";
    blockingReasons.push("Risk-off regime");
  } else if (evidenceState === "Failed Evidence") {
    decisionLabel = "Avoid for now";
    blockingReasons.push("Validation evidence failed.");
  } else if (evidenceState === "No Evidence") {
    decisionLabel = "Watchlist only";
    blockingReasons.push("No usable validation evidence is available.");
  } else if (!input.hardFiltersPassed) {
    decisionLabel = "Avoid for now";
    if (input.hardFilterBlockingReason) blockingReasons.push(input.hardFilterBlockingReason);
  } else if (!input.expectedValuePassed) {
    decisionLabel = "Avoid for now";
    blockingReasons.push("Expected value is not reliable after costs and sample-size adjustment.");
  } else if (input.finalPositionSize === 0) {
    decisionLabel = "Risk-off / no trade";
    blockingReasons.push("Final position size is zero after sizing constraints.");
  } else if (
    input.signalScore >= 82 &&
    input.riskScore >= 72 &&
    evidenceState === "Strong Evidence" &&
    input.validationScore >= thresholds.strongCandidateValidationScore &&
    input.finalPositionSize >= thresholds.strongCandidateAllocation
  ) {
    decisionLabel = "Strong candidate";
  } else if (input.finalPositionSize > 0 && input.finalPositionSize < thresholds.minimumMeaningfulAllocation && input.signalScore >= 70) {
    decisionLabel = "Small allocation only";
    blockingReasons.push("Final allocation is below the minimum meaningful allocation threshold.");
  } else if (
    input.signalScore >= 70 &&
    input.riskScore >= 65 &&
    (evidenceState === "Moderate Evidence" || evidenceState === "Strong Evidence") &&
    input.validationScore >= thresholds.positionAllowedValidationScore &&
    input.finalPositionSize >= thresholds.minimumMeaningfulAllocation
  ) {
    decisionLabel = "Position allowed";
  } else if (input.signalScore >= 70 && (input.riskScore < 55 || input.finalPositionSize <= 0.03)) {
    decisionLabel = "Small allocation only";
  } else if (input.signalScore >= 40) {
    decisionLabel = "Watchlist only";
  } else {
    decisionLabel = "Avoid for now";
  }

  if (warnings.some((warning) => warning.toLowerCase().includes("severe")) && decisionLabel === "Strong candidate") {
    decisionLabel = "Small allocation only";
  }

  const labelCappedScore =
    decisionLabel === "No Data / Avoid"
      ? 0
      : decisionLabel === "Risk-off / no trade"
        ? scoreWithinLabelBand(rawModelScore, 0, 20)
        : decisionLabel === "Avoid for now"
          ? scoreWithinLabelBand(rawModelScore, 21, 44)
          : decisionLabel === "Watchlist only"
            ? scoreWithinLabelBand(rawModelScore, 45, 64)
            : decisionLabel === "Small allocation only"
              ? scoreWithinLabelBand(rawModelScore, 65, 74)
              : rawModelScore;
  const scoreAdjustmentReason =
    labelCappedScore === rawModelScore
      ? "Final decision score equals the raw model score because no decision-label cap was applied."
      : `Final decision score was adjusted into the ${decisionLabel} band from a raw model score of ${rawModelScore}.`;
  const activeAllocationLabels: DecisionLabel[] = ["Strong candidate", "Position allowed", "Small allocation only"];
  const activeFinalPositionSize = activeAllocationLabels.includes(decisionLabel) ? input.finalPositionSize : 0;

  return {
    decisionLabel,
    rawModelScore,
    finalScore: labelCappedScore,
    scoreAdjustmentReason,
    signalScore: decisionLabel === "No Data / Avoid" ? 0 : boundedScore(input.signalScore),
    riskScore: decisionLabel === "No Data / Avoid" ? 0 : boundedScore(input.riskScore),
    validationScore: decisionLabel === "No Data / Avoid" ? 0 : boundedScore(input.validationScore),
    finalPositionSize: activeFinalPositionSize,
    primaryReasons: input.primaryReasons,
    blockingReasons: Array.from(new Set(blockingReasons)),
    warnings: Array.from(new Set(warnings))
  };
}
