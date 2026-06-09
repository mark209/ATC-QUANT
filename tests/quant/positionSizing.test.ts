import { describe, expect, it } from "vitest";
import { DEFAULT_QUANT_CONFIG } from "@/lib/quant/config";
import { calculatePositionSizing, fractionalKelly } from "@/lib/quant/positionSizing";

describe("position sizing", () => {
  it("never recommends negative Kelly sizing", () => {
    expect(fractionalKelly(0.3, 1, "stock")).toBe(0);
  });

  it("uses the lowest allocation constraint", () => {
    const result = calculatePositionSizing({
      assetType: "crypto",
      symbol: "BTCUSDT",
      realizedVolatility: 0.8,
      currentDrawdown: -0.1,
      winRate: 0.55,
      payoffRatio: 1.5,
      riskProfile: "balanced"
    });

    expect(result.finalAllocation).toBeLessThanOrEqual(result.assetClassMaxAllocation);
    expect(result.riskMode).toBe("Caution");
  });

  it("keeps the default Kelly fraction conservative", () => {
    expect(DEFAULT_QUANT_CONFIG.kellyFraction).toBeGreaterThanOrEqual(0.1);
    expect(DEFAULT_QUANT_CONFIG.kellyFraction).toBeLessThanOrEqual(0.25);
    expect(DEFAULT_QUANT_CONFIG.cryptoKellyFraction).toBeGreaterThanOrEqual(0.1);
    expect(DEFAULT_QUANT_CONFIG.cryptoKellyFraction).toBeLessThanOrEqual(0.25);
  });

  it("negative expected value forces Kelly allocation to zero", () => {
    const result = calculatePositionSizing({
      assetType: "stock",
      symbol: "TEST",
      realizedVolatility: 0.2,
      currentDrawdown: -0.02,
      winRate: 0.7,
      payoffRatio: 2,
      expectedValueAfterCosts: -0.01,
      sampleQuality: "Acceptable",
      riskProfile: "balanced"
    });

    expect(result.fractionalKellyAllocation).toBe(0);
    expect(result.finalPositionSize).toBe(0);
    expect(result.limitingFactor).toBe("fractional Kelly");
  });

  it("limits Kelly sizing when total or out-of-sample trades are insufficient", () => {
    const result = calculatePositionSizing({
      assetType: "stock",
      symbol: "TEST",
      realizedVolatility: 0.15,
      currentDrawdown: -0.02,
      winRate: 0.7,
      payoffRatio: 2,
      expectedValueAfterCosts: 0.03,
      tradeCount: 20,
      outOfSampleTrades: 3,
      sampleQuality: "Strong",
      riskProfile: "balanced"
    });

    expect(result.fractionalKellyAllocation).toBe(0);
    expect(result.warnings).toContain("Kelly allocation is zero because total validated trades are below 30.");
    expect(result.warnings).toContain("Kelly sizing is limited because out-of-sample evidence is insufficient.");
  });

  it("risk-off drawdown forces final allocation to zero", () => {
    const result = calculatePositionSizing({
      assetType: "stock",
      symbol: "TEST",
      realizedVolatility: 0.15,
      currentDrawdown: -0.3,
      winRate: 0.75,
      payoffRatio: 2.5,
      expectedValueAfterCosts: 0.03,
      sampleQuality: "Strong",
      riskProfile: "balanced"
    });

    expect(result.drawdownAdjustedAllocation).toBe(0);
    expect(result.finalPositionSize).toBe(0);
    expect(result.limitingFactor).toBe("drawdown control");
  });

  it("high volatility reduces allocation through volatility targeting", () => {
    const result = calculatePositionSizing({
      assetType: "stock",
      symbol: "TEST",
      realizedVolatility: 1.5,
      currentDrawdown: -0.01,
      winRate: 1,
      payoffRatio: 10,
      expectedValueAfterCosts: 0.05,
      sampleQuality: "Strong",
      riskProfile: "balanced"
    });

    expect(result.volatilityTargetAllocation).toBeLessThan(result.assetClassMaxAllocation);
    expect(result.finalPositionSize).toBe(result.volatilityTargetAllocation);
    expect(result.limitingFactor).toBe("volatility targeting");
  });

  it("asset-class cap limits altcoin position size", () => {
    const result = calculatePositionSizing({
      assetType: "crypto",
      symbol: "SOLUSDT",
      realizedVolatility: 0.05,
      currentDrawdown: -0.01,
      winRate: 1,
      payoffRatio: 10,
      expectedValueAfterCosts: 0.08,
      sampleQuality: "Strong",
      riskProfile: "balanced"
    });

    expect(result.assetClassMaxAllocation).toBe(DEFAULT_QUANT_CONFIG.maxAltcoinAllocation);
    expect(result.finalPositionSize).toBe(result.assetClassMaxAllocation);
    expect(result.limitingFactor).toBe("asset-class cap");
  });

  it("crypto caps are stricter than equity caps", () => {
    expect(DEFAULT_QUANT_CONFIG.maxBTCEthAllocation).toBeLessThan(DEFAULT_QUANT_CONFIG.maxEquityAllocation);
    expect(DEFAULT_QUANT_CONFIG.maxAltcoinAllocation).toBeLessThan(DEFAULT_QUANT_CONFIG.maxEquityAllocation);
  });

  it("final position size equals the minimum sizing component", () => {
    const result = calculatePositionSizing({
      assetType: "stock",
      symbol: "TEST",
      realizedVolatility: 0.25,
      currentDrawdown: -0.03,
      winRate: 0.7,
      payoffRatio: 2,
      expectedValueAfterCosts: 0.03,
      sampleQuality: "Acceptable",
      riskProfile: "conservative"
    });
    const minimum = Math.min(
      result.volatilityTargetAllocation,
      result.fractionalKellyAllocation,
      result.assetClassMaxAllocation,
      result.drawdownAdjustedAllocation
    );

    expect(result.finalPositionSize).toBe(minimum);
  });
});
