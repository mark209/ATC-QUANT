import { describe, expect, it } from "vitest";
import {
  calmarRatio,
  conditionalValueAtRisk,
  guardedCalmarRatio,
  guardedSharpeRatio,
  guardedSortinoRatio,
  sharpeRatio,
  sortinoRatio,
  valueAtRisk
} from "@/lib/quant/ratios";

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

  it("marks Sortino unreliable when downside deviation is near zero", () => {
    const result = guardedSortinoRatio([0.01, 0.012, -0.00000001, 0.011], 0.35);

    expect(result.reliable).toBe(false);
    expect(result.value).toBe(0);
    expect(result.warning).toContain("Sortino ratio is unreliable");
  });

  it("uses configurable annualization periods for Sortino", () => {
    const returns = [0.02, -0.01, 0.015, -0.005, 0.01, -0.02];
    const equitySortino = sortinoRatio(returns, 0.12, 0, 252);
    const cryptoSortino = sortinoRatio(returns, 0.12, 0, 365);

    expect(cryptoSortino).toBeLessThan(equitySortino);
    expect(cryptoSortino).toBeCloseTo(equitySortino * Math.sqrt(252 / 365), 8);
  });

  it("caps unrealistic risk-adjusted ratios and returns reliability warnings", () => {
    const sharpe = guardedSharpeRatio(2.5, 0.01, 0.04);
    const calmar = guardedCalmarRatio(1.2, -0.01);

    expect(sharpe.value).toBeLessThanOrEqual(10);
    expect(sharpe.reliable).toBe(false);
    expect(calmar.value).toBeLessThanOrEqual(20);
    expect(calmar.reliable).toBe(false);
  });
});
