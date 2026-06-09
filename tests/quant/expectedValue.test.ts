import { describe, expect, it } from "vitest";
import type { BacktestTrade } from "@/types/quant";
import { calculateExpectedValue, calculateExpectedValueFromTrades } from "@/lib/quant/expectedValue";
import { fractionalKelly } from "@/lib/quant/positionSizing";

function trade(returnPct: number, netPnl = returnPct * 1000): BacktestTrade {
  return {
    entryDate: "2025-01-01",
    entryPrice: 100,
    exitDate: "2025-01-02",
    exitPrice: 100 * (1 + returnPct),
    positionSize: 1000,
    quantity: 10,
    allocationUsed: 1,
    capitalDeployed: 1000,
    cashReserve: 0,
    positionValue: 1000,
    grossReturnPct: returnPct,
    netReturnPct: returnPct,
    feesPaid: 2,
    slippagePaid: 1,
    fees: 2,
    slippage: 1,
    grossPnl: netPnl + 3,
    netPnl,
    returnPct,
    holdingPeriod: 1,
    exitReason: "Test"
  };
}

describe("expected value", () => {
  it("uses win rate only as part of expected value", () => {
    const result = calculateExpectedValue([0.03, 0.02, -0.01, -0.02], 0.001, 0.001);
    expect(result.winRate).toBe(0.5);
    expect(result.payoffRatio).toBeCloseTo(1.666666, 5);
    expect(result.expectedValue).toBeGreaterThan(0);
  });

  it("deducts round-trip fees, slippage, and spread from gross expected value", () => {
    const result = calculateExpectedValue([0.04, 0.04, -0.01, -0.01], 0.001, 0.002, 0.0005);

    expect(result.expectedValue).toBeCloseTo(0.015, 6);
    expect(result.costs.averageTradeCost).toBeCloseTo(0.0065, 6);
    expect(result.expectedValueAfterCosts).toBeCloseTo((0.015 - 0.0065) * 0.25, 6);
  });

  it("marks fewer than 30 trades as poor and blocks passing even when EV is positive", () => {
    const result = calculateExpectedValue(Array.from({ length: 29 }, () => 0.02), 0.001, 0.001);

    expect(result.tradeCount).toBe(29);
    expect(result.sampleQuality).toBe("Poor");
    expect(result.passed).toBe(false);
    expect(result.warnings).toContain("Poor sample size; expected value is unreliable.");
  });

  it("marks 30 to 99 trades as limited and warns that EV should be treated cautiously", () => {
    const result = calculateExpectedValue(Array.from({ length: 30 }, () => 0.02), 0.001, 0.001);

    expect(result.sampleQuality).toBe("Limited");
    expect(result.passed).toBe(true);
    expect(result.warnings).toContain("Limited sample size; expected value should be treated cautiously.");
  });

  it("marks 100 or more trades as acceptable", () => {
    const result = calculateExpectedValue(Array.from({ length: 100 }, () => 0.02), 0.001, 0.001);

    expect(result.sampleQuality).toBe("Acceptable");
    expect(result.passed).toBe(true);
  });

  it("fails when expected value after costs is not positive", () => {
    const result = calculateExpectedValue([0.002, -0.002, 0.001, -0.001], 0.001, 0.001);

    expect(result.expectedValueAfterCosts).toBeLessThanOrEqual(0);
    expect(result.passed).toBe(false);
    expect(result.warnings).toContain("Expected value is not positive after fees, slippage, and spread.");
  });

  it("warns that expected value is historical and not certain", () => {
    const result = calculateExpectedValue(Array.from({ length: 100 }, () => 0.02), 0.001, 0.001);

    expect(result.warnings).toContain("Expected value is a historical estimate, not a certainty.");
  });

  it("calculates expected value from closed net backtest trades only", () => {
    const result = calculateExpectedValueFromTrades([trade(0.1), trade(-0.05), trade(0.02), trade(-0.01)]);

    expect(result.tradeCount).toBe(4);
    expect(result.winRate).toBe(0.5);
    expect(result.averageWin).toBeCloseTo(0.06, 8);
    expect(result.averageLoss).toBeCloseTo(-0.03, 8);
    expect(result.payoffRatio).toBeCloseTo(2, 8);
    expect(result.profitFactor).toBeCloseTo(2, 8);
    expect(result.expectedValueAfterCosts).toBeCloseTo(0.015 * 0.25, 8);
    expect(result.warnings).toContain("Expected value is calculated from closed net backtest trades.");
  });

  it("marks zero-trade EV as unavailable and blocks passing", () => {
    const result = calculateExpectedValueFromTrades([]);

    expect(result.tradeCount).toBe(0);
    expect(result.sampleQuality).toBe("Poor");
    expect(result.expectedValueAfterCosts).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.warnings).toContain("No closed trades available.");
  });

  it("does not report winning-only profit factor as zero", () => {
    const result = calculateExpectedValueFromTrades([trade(0.03), trade(0.02), trade(0.01)]);

    expect(result.profitFactor).toBe(Number.POSITIVE_INFINITY);
    expect(result.payoffRatio).toBe(0);
    expect(result.warnings).toContain("Profit factor is undefined because there are no losing trades.");
    expect(result.warnings).toContain("Payoff ratio is unreliable because there are no losing trades.");
  });

  it("keeps winning-only small samples from creating aggressive Kelly", () => {
    const result = calculateExpectedValueFromTrades([trade(0.03), trade(0.02), trade(0.01)]);
    const kelly = fractionalKelly(
      result.winRate,
      result.payoffRatio,
      "stock",
      result.expectedValueAfterCosts,
      result.sampleQuality,
      result.tradeCount
    );

    expect(result.sampleQuality).toBe("Poor");
    expect(kelly).toBe(0);
  });

  it("marks losing-only trade EV as negative and blocks Kelly", () => {
    const result = calculateExpectedValueFromTrades([trade(-0.03), trade(-0.02), trade(-0.01)]);
    const kelly = fractionalKelly(
      result.winRate,
      result.payoffRatio,
      "stock",
      result.expectedValueAfterCosts,
      result.sampleQuality,
      result.tradeCount
    );

    expect(result.profitFactor).toBe(0);
    expect(result.expectedValueAfterCosts).toBeLessThan(0);
    expect(result.passed).toBe(false);
    expect(kelly).toBe(0);
  });

  it("forces Kelly to zero when trade-derived EV after costs is negative", () => {
    const result = calculateExpectedValueFromTrades([trade(0.01), trade(-0.05), trade(0.01), trade(-0.04)]);
    const kelly = fractionalKelly(
      result.winRate,
      result.payoffRatio,
      "stock",
      result.expectedValueAfterCosts,
      result.sampleQuality,
      result.tradeCount
    );

    expect(result.expectedValueAfterCosts).toBeLessThan(0);
    expect(kelly).toBe(0);
  });
});
