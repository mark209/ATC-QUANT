import { describe, expect, it } from "vitest";
import { calmarRatio, conditionalValueAtRisk, sharpeRatio, sortinoRatio, valueAtRisk } from "@/lib/quant/ratios";

describe("ratios", () => {
  it("calculates Sharpe, Sortino, and Calmar", () => {
    expect(sharpeRatio(0.12, 0.2, 0.02)).toBeCloseTo(0.5, 8);
    expect(sortinoRatio([0.02, -0.01, 0.015, -0.005], 0.12)).toBeGreaterThan(0);
    expect(calmarRatio(0.15, -0.1)).toBeCloseTo(1.5, 8);
  });

  it("calculates historical VaR and CVaR", () => {
    const returns = [-0.05, -0.02, 0.01, 0.02, 0.03];
    expect(valueAtRisk(returns)).toBe(-0.05);
    expect(conditionalValueAtRisk(returns)).toBe(-0.05);
  });
});
