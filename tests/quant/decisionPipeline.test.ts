import { describe, expect, it } from "vitest";
import type { MarketDataPoint } from "@/types/asset";
import { DEFAULT_QUANT_CONFIG } from "@/lib/quant/config";
import { validateDataQuality } from "@/lib/quant/dataQuality";
import { evaluateHardFilters } from "@/lib/quant/hardFilters";
import { calculateExpectedValue } from "@/lib/quant/expectedValue";
import { calculatePositionSizing } from "@/lib/quant/positionSizing";
import { evaluatePortfolioRisk } from "@/lib/quant/portfolioRisk";
import { buildFinalDecision } from "@/lib/quant/decisionEngine";
import { validateTrendBacktest } from "@/lib/quant/validation";

function samplePoints(length: number, start = 100, dailyStep = 0.2, volume = 1_000_000): MarketDataPoint[] {
  return Array.from({ length }, (_, index) => {
    const close = start + index * dailyStep + Math.sin(index / 11) * 1.5;
    return {
      date: new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10),
      timestamp: Date.UTC(2025, 0, index + 1),
      open: close * 0.995,
      high: close * 1.01,
      low: close * 0.99,
      close,
      volume,
      quoteVolume: close * volume
    };
  });
}

describe("quant decision pipeline", () => {
  it("fails data quality when there is not enough history", () => {
    const result = validateDataQuality(samplePoints(40), "stock", DEFAULT_QUANT_CONFIG);

    expect(result.passed).toBe(false);
    expect(result.issues).toContain("Insufficient historical data.");
  });

  it("accepts one year of equity trading sessions without failing data quality", () => {
    const result = validateDataQuality(samplePoints(250), "etf", DEFAULT_QUANT_CONFIG);

    expect(result.passed).toBe(true);
    expect(result.issues).not.toContain("Insufficient historical data.");
  });

  it("blocks illiquid assets before scoring", () => {
    const result = evaluateHardFilters(
      {
        dataQuality: {
          passed: true,
          score: 90,
          issues: [],
          warnings: [],
          dataPoints: 260,
          requiredDataPoints: DEFAULT_QUANT_CONFIG.minDataPoints
        },
        assetType: "stock",
        averageDollarVolume: 500_000,
        realizedVolatility: 0.18,
        maxDrawdown: -0.08,
        expectedValueAfterCosts: 0.01,
        expectedValuePassed: true,
        regimeLabel: "Trend Up"
      },
      DEFAULT_QUANT_CONFIG
    );

    expect(result.passed).toBe(false);
    expect(result.failedFilters).toContain("Minimum liquidity");
  });

  it("penalizes expected value when sample size is poor", () => {
    const result = calculateExpectedValue([0.04, -0.02, 0.03, -0.01], 0.001, 0.001);

    expect(result.tradeCount).toBe(4);
    expect(result.sampleQuality).toBe("Poor");
    expect(result.passed).toBe(false);
    expect(result.expectedValueAfterCosts).toBeLessThan(result.expectedValue);
  });

  it("sets Kelly allocation to zero when expected value is negative", () => {
    const result = calculatePositionSizing({
      assetType: "stock",
      symbol: "TEST",
      realizedVolatility: 0.2,
      currentDrawdown: -0.03,
      winRate: 0.35,
      payoffRatio: 0.8,
      expectedValueAfterCosts: -0.01,
      tradeCount: 120,
      sampleQuality: "Acceptable",
      riskProfile: "balanced"
    });

    expect(result.fractionalKellyAllocation).toBe(0);
    expect(result.finalAllocation).toBe(0);
    expect(result.limitingConstraint).toBe("fractional Kelly");
  });

  it("forces zero allocation during risk-off drawdown", () => {
    const result = calculatePositionSizing({
      assetType: "crypto",
      symbol: "SOLUSDT",
      realizedVolatility: 0.5,
      currentDrawdown: -0.35,
      winRate: 0.65,
      payoffRatio: 1.8,
      expectedValueAfterCosts: 0.02,
      tradeCount: 160,
      sampleQuality: "Strong",
      riskProfile: "balanced"
    });

    expect(result.drawdownAdjustedAllocation).toBe(0);
    expect(result.finalAllocation).toBe(0);
    expect(result.limitingConstraint).toBe("drawdown control");
  });

  it("warns when correlated portfolio exposure repeats the same bet", () => {
    const result = evaluatePortfolioRisk(
      {
        candidateSymbol: "ETHUSDT",
        candidateAssetType: "crypto",
        candidateAllocation: 0.08,
        holdings: [
          { symbol: "BTCUSDT", assetType: "crypto", allocation: 0.12 },
          { symbol: "MSTR", assetType: "stock", allocation: 0.08 }
        ]
      },
      DEFAULT_QUANT_CONFIG
    );

    expect(result.passed).toBe(false);
    expect(result.correlatedExposureWarnings.length).toBeGreaterThan(0);
  });

  it("labels strong signal with severe drawdown as small allocation or worse", () => {
    const result = buildFinalDecision({
      dataQualityPassed: true,
      hardFiltersPassed: true,
      hardFilterBlockingReason: undefined,
      regimeLabel: "Trend Up",
      expectedValuePassed: true,
      signalScore: 90,
      riskScore: 35,
      validationScore: 70,
      liquidityScore: 85,
      finalPositionSize: 0.02,
      riskWarnings: ["Drawdown stress is severe."],
      validationWarnings: [],
      portfolioWarnings: [],
      primaryReasons: ["Trend and momentum are positive."],
      blockingReasons: []
    });

    expect(["Small allocation only", "Watchlist only", "Avoid for now"]).toContain(result.decisionLabel);
  });

  it("allows a position when signal, risk, EV, and validation are acceptable", () => {
    const result = buildFinalDecision({
      dataQualityPassed: true,
      hardFiltersPassed: true,
      hardFilterBlockingReason: undefined,
      regimeLabel: "Trend Up",
      expectedValuePassed: true,
      signalScore: 78,
      riskScore: 76,
      validationScore: 72,
      liquidityScore: 90,
      finalPositionSize: 0.08,
      riskWarnings: [],
      validationWarnings: [],
      portfolioWarnings: [],
      primaryReasons: ["Trend, risk, liquidity, and validation are acceptable."],
      blockingReasons: []
    });

    expect(result.decisionLabel).toBe("Position allowed");
  });

  it("returns validation warnings when history is too small for walk-forward testing", () => {
    const result = validateTrendBacktest(samplePoints(120), "stock", DEFAULT_QUANT_CONFIG);

    expect(result.robustnessLabel).toBe("Insufficient sample");
    expect(result.warnings).toContain("Not enough history for reliable walk-forward validation.");
  });
});
