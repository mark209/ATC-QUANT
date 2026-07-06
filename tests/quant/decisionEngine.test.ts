import { describe, expect, it } from "vitest";
import { buildFinalDecision } from "@/lib/quant/decisionEngine";
import type { DecisionLabel } from "@/types/quant";

const baseInput = {
  dataQualityPassed: true,
  hardFiltersPassed: true,
  hardFilterBlockingReason: undefined,
  regimeLabel: "Trend Up" as const,
  expectedValuePassed: true,
  signalScore: 76,
  riskScore: 72,
  validationScore: 70,
  validationEvidenceState: "Strong Evidence" as const,
  liquidityScore: 80,
  finalPositionSize: 0.08,
  riskWarnings: [],
  validationWarnings: [],
  portfolioWarnings: [],
  primaryReasons: ["Trend, risk, expected value, and validation are acceptable."],
  blockingReasons: []
};

const allowedLabels: DecisionLabel[] = [
  "Strong candidate",
  "Position allowed",
  "Small allocation only",
  "Watchlist only",
  "Avoid for now",
  "Risk-off / no trade",
  "No Data / Avoid"
];

describe("final decision engine", () => {
  it("returns No Data / Avoid when data quality fails", () => {
    const result = buildFinalDecision({ ...baseInput, dataQualityPassed: false });

    expect(result.decisionLabel).toBe("No Data / Avoid");
    expect(result.finalScore).toBe(0);
    expect(result.finalPositionSize).toBe(0);
  });

  it("forces active allocation to zero for No Data / Avoid", () => {
    const result = buildFinalDecision({ ...baseInput, dataQualityPassed: false, finalPositionSize: 0.08 });

    expect(result.decisionLabel).toBe("No Data / Avoid");
    expect(result.finalPositionSize).toBe(0);
  });

  it("returns Risk-off / no trade for a risk-off regime", () => {
    const result = buildFinalDecision({ ...baseInput, regimeLabel: "Risk-Off", finalPositionSize: 0.08 });

    expect(result.decisionLabel).toBe("Risk-off / no trade");
    expect(result.finalPositionSize).toBe(0);
  });

  it("returns Risk-off / no trade for a risk-off hard filter failure", () => {
    const result = buildFinalDecision({
      ...baseInput,
      hardFiltersPassed: false,
      hardFilterBlockingReason: "Risk-off regime",
      blockingReasons: ["Risk-off regime"]
    });

    expect(result.decisionLabel).toBe("Risk-off / no trade");
    expect(result.blockingReasons).toContain("Risk-off regime");
  });

  it("returns Avoid for now when expected value after costs is not positive", () => {
    const result = buildFinalDecision({
      ...baseInput,
      hardFiltersPassed: false,
      hardFilterBlockingReason: "Expected value after costs",
      expectedValuePassed: false,
      blockingReasons: ["Expected value after costs"]
    });

    expect(result.decisionLabel).toBe("Avoid for now");
    expect(result.blockingReasons).toContain("Expected value after costs");
    expect(result.finalPositionSize).toBe(0);
  });

  it("forces active allocation to zero for Avoid for now", () => {
    const result = buildFinalDecision({
      ...baseInput,
      hardFiltersPassed: false,
      hardFilterBlockingReason: "Expected value after costs",
      expectedValuePassed: false,
      finalPositionSize: 0.04,
      blockingReasons: ["Expected value after costs"]
    });

    expect(result.decisionLabel).toBe("Avoid for now");
    expect(result.finalPositionSize).toBe(0);
  });

  it("does not allow Watchlist only to carry active allocation", () => {
    const result = buildFinalDecision({
      ...baseInput,
      signalScore: 48,
      riskScore: 70,
      validationScore: 70,
      finalPositionSize: 0.06
    });

    expect(result.decisionLabel).toBe("Watchlist only");
    expect(result.finalPositionSize).toBe(0);
  });

  it("returns Small allocation only for sub-1% nonzero allocation", () => {
    const result = buildFinalDecision({
      ...baseInput,
      signalScore: 88,
      riskScore: 76,
      validationScore: 78,
      finalPositionSize: 0.0027
    });

    expect(result.decisionLabel).toBe("Small allocation only");
    expect(result.finalPositionSize).toBeCloseTo(0.0027, 8);
  });

  it("requires allocation above the configured meaningful minimum for Position allowed", () => {
    const result = buildFinalDecision({
      ...baseInput,
      signalScore: 88,
      riskScore: 76,
      validationScore: 65,
      finalPositionSize: 0.012
    });

    expect(result.decisionLabel).toBe("Position allowed");
    expect(result.finalPositionSize).toBeCloseTo(0.012, 8);
  });

  it("requires stronger validation and meaningful allocation for Strong candidate", () => {
    const weakAllocation = buildFinalDecision({
      ...baseInput,
      signalScore: 90,
      riskScore: 80,
      validationScore: 78,
      finalPositionSize: 0.02
    });
    const strong = buildFinalDecision({
      ...baseInput,
      signalScore: 90,
      riskScore: 80,
      validationScore: 78,
      finalPositionSize: 0.06
    });

    expect(weakAllocation.decisionLabel).toBe("Position allowed");
    expect(strong.decisionLabel).toBe("Strong candidate");
  });

  it("requires Strong Evidence for Strong candidate", () => {
    const result = buildFinalDecision({
      ...baseInput,
      signalScore: 90,
      riskScore: 80,
      validationScore: 78,
      validationEvidenceState: "Moderate Evidence",
      finalPositionSize: 0.06
    });

    expect(result.decisionLabel).toBe("Position allowed");
  });

  it("allows Weak Evidence to carry only Small allocation when other checks pass", () => {
    const result = buildFinalDecision({
      ...baseInput,
      signalScore: 88,
      riskScore: 76,
      validationScore: 44,
      validationEvidenceState: "Weak Evidence",
      finalPositionSize: 0.004
    });

    expect(result.decisionLabel).toBe("Small allocation only");
    expect(result.finalPositionSize).toBeCloseTo(0.004, 8);
  });

  it("forces No Evidence to zero active allocation", () => {
    const result = buildFinalDecision({
      ...baseInput,
      validationScore: 0,
      validationEvidenceState: "No Evidence",
      finalPositionSize: 0.04
    });

    expect(result.decisionLabel).toBe("Watchlist only");
    expect(result.finalPositionSize).toBe(0);
  });

  it("forces Failed Evidence to Avoid for now and zero active allocation", () => {
    const result = buildFinalDecision({
      ...baseInput,
      validationScore: 25,
      validationEvidenceState: "Failed Evidence",
      finalPositionSize: 0.04
    });

    expect(result.decisionLabel).toBe("Avoid for now");
    expect(result.finalPositionSize).toBe(0);
  });

  it("returns Small allocation only for strong signal with high risk", () => {
    const result = buildFinalDecision({
      ...baseInput,
      signalScore: 88,
      riskScore: 40,
      validationScore: 75,
      finalPositionSize: 0.08,
      riskWarnings: ["Drawdown stress is severe."]
    });

    expect(result.decisionLabel).toBe("Small allocation only");
  });

  it("returns Position allowed or Strong candidate for strong signal, acceptable risk, positive EV, and stable validation", () => {
    const result = buildFinalDecision({
      ...baseInput,
      signalScore: 88,
      riskScore: 76,
      validationScore: 78,
      finalPositionSize: 0.1
    });

    expect(["Position allowed", "Strong candidate"]).toContain(result.decisionLabel);
  });

  it("returns Watchlist only for a mixed signal", () => {
    const result = buildFinalDecision({
      ...baseInput,
      signalScore: 48,
      riskScore: 70,
      validationScore: 70,
      finalPositionSize: 0.06,
      primaryReasons: ["The setup is mixed."]
    });

    expect(result.decisionLabel).toBe("Watchlist only");
  });

  it("keeps raw model score separate from final decision score", () => {
    const result = buildFinalDecision({
      ...baseInput,
      hardFiltersPassed: false,
      hardFilterBlockingReason: "Expected value after costs",
      expectedValuePassed: false,
      signalScore: 96,
      riskScore: 77,
      validationScore: 60,
      liquidityScore: 80,
      blockingReasons: ["Expected value after costs"]
    });

    expect(result.rawModelScore).toBe(82);
    expect(result.finalScore).toBeLessThan(result.rawModelScore);
    expect(result.scoreAdjustmentReason).toContain("Avoid for now");
  });

  it("does not collapse different watchlist raw scores to the same final score", () => {
    const lowerRaw = buildFinalDecision({
      ...baseInput,
      hardFiltersPassed: false,
      hardFilterBlockingReason: "Expected value after costs",
      expectedValuePassed: false,
      signalScore: 70,
      riskScore: 62,
      validationScore: 55,
      liquidityScore: 70,
      blockingReasons: ["Expected value after costs"]
    });
    const higherRaw = buildFinalDecision({
      ...baseInput,
      hardFiltersPassed: false,
      hardFilterBlockingReason: "Expected value after costs",
      expectedValuePassed: false,
      signalScore: 96,
      riskScore: 77,
      validationScore: 60,
      liquidityScore: 80,
      blockingReasons: ["Expected value after costs"]
    });

    expect(lowerRaw.decisionLabel).toBe("Avoid for now");
    expect(higherRaw.decisionLabel).toBe("Avoid for now");
    expect(lowerRaw.rawModelScore).not.toBe(higherRaw.rawModelScore);
    expect(lowerRaw.finalScore).not.toBe(higherRaw.finalScore);
    expect(higherRaw.finalScore).toBeLessThanOrEqual(44);
  });

  it("only returns approved decision labels and never Buy or Sell", () => {
    const scenarios = [
      buildFinalDecision({ ...baseInput, dataQualityPassed: false }),
      buildFinalDecision({ ...baseInput, regimeLabel: "Risk-Off" }),
      buildFinalDecision({ ...baseInput, signalScore: 88, riskScore: 76, validationScore: 78, finalPositionSize: 0.1 }),
      buildFinalDecision({ ...baseInput, signalScore: 48 })
    ];

    for (const result of scenarios) {
      expect(allowedLabels).toContain(result.decisionLabel);
      expect(result.decisionLabel).not.toMatch(/\b(Buy|Sell)\b/i);
    }
  });
});
