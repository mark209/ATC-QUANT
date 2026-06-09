import { describe, expect, it } from "vitest";
import type { ExpectedValueResult } from "@/types/quant";
import { expectedValueStatusLabel } from "@/components/dashboard/ScoreBreakdown";

function ev(overrides: Partial<ExpectedValueResult>): ExpectedValueResult {
  return {
    expectedValue: 0,
    expectedValueAfterCosts: 0,
    winRate: 0,
    lossRate: 0,
    averageWin: 0,
    averageLoss: 0,
    payoffRatio: 0,
    profitFactor: 0,
    tradeCount: 0,
    sampleQuality: "Poor",
    passed: false,
    warnings: [],
    costs: {
      fees: 0,
      slippage: 0,
      spread: 0,
      averageTradeCost: 0
    },
    ...overrides
  };
}

describe("dashboard EV status labels", () => {
  it("labels nonpositive EV after costs as failed", () => {
    expect(expectedValueStatusLabel(ev({ expectedValueAfterCosts: -0.01, sampleQuality: "Strong" }))).toBe("EV failed");
  });

  it("labels positive EV with weak samples as limited", () => {
    expect(expectedValueStatusLabel(ev({ expectedValueAfterCosts: 0.01, sampleQuality: "Limited", passed: true }))).toBe("EV limited");
  });

  it("labels positive EV with acceptable samples as passed", () => {
    expect(expectedValueStatusLabel(ev({ expectedValueAfterCosts: 0.01, sampleQuality: "Acceptable", passed: true }))).toBe("EV passed");
  });
});
