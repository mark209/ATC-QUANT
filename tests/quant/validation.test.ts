import { describe, expect, it } from "vitest";
import type { MarketDataPoint } from "@/types/asset";
import { DEFAULT_QUANT_CONFIG } from "@/lib/quant/config";
import { validateTrendBacktest } from "@/lib/quant/validation";

function samplePoints(length: number, dailyStep = 0.25): MarketDataPoint[] {
  return Array.from({ length }, (_, index) => {
    const close = 100 + index * dailyStep + Math.sin(index / 13) * 1.2;
    return {
      date: new Date(Date.UTC(2024, 0, index + 1)).toISOString().slice(0, 10),
      timestamp: Date.UTC(2024, 0, index + 1),
      open: close * 0.995,
      high: close * 1.01,
      low: close * 0.99,
      close,
      volume: 1_000_000,
      quoteVolume: close * 1_000_000
    };
  });
}

describe("backtest validation", () => {
  it("uses a 70/30 in-sample and out-of-sample split", () => {
    const result = validateTrendBacktest(samplePoints(300), "stock", DEFAULT_QUANT_CONFIG);

    expect(result.inSample.equityCurve).toHaveLength(210);
    expect(result.outOfSample.equityCurve).toHaveLength(90);
  });

  it("returns insufficient data instead of fake validation for short histories", () => {
    const result = validateTrendBacktest(samplePoints(120), "stock", DEFAULT_QUANT_CONFIG);

    expect(result.robustnessLabel).toBe("Insufficient Data");
    expect(result.validationScore).toBe(0);
    expect(result.walkForward.stabilityLabel).toBe("Insufficient Data");
    expect(result.walkForward.windowsTested).toBe(0);
    expect(result.warnings).toContain("Insufficient data for reliable out-of-sample and walk-forward validation.");
  });

  it("labels validation as weak evidence when total trades are below the target but usable", () => {
    const result = validateTrendBacktest(samplePoints(300), "stock", DEFAULT_QUANT_CONFIG);

    expect(result.inSample.totalTrades + result.outOfSample.totalTrades).toBeLessThan(DEFAULT_QUANT_CONFIG.minTradeCount);
    expect(["No Evidence", "Weak Evidence"]).toContain(result.validationEvidenceState);
    expect(result.validationScore).toBeLessThanOrEqual(44);
    expect(result.warnings).toContain("Low trade count reduces confidence.");
  });

  it("labels low-but-nonzero out-of-sample validation as inconclusive evidence", () => {
    const result = validateTrendBacktest(samplePoints(700), "stock", DEFAULT_QUANT_CONFIG);

    if (result.outOfSample.totalTrades < result.range.minimumOutOfSampleTrades) {
      expect(result.outOfSampleLabel).toBe(result.outOfSample.totalTrades === 0 ? "Insufficient Data" : "Inconclusive");
      expect(result.warnings).toContain(
        result.outOfSample.totalTrades === 0
          ? `Out-of-sample trade count is zero for ${result.range.validationRange} validation.`
          : `Out-of-sample trade count is below the ${result.range.minimumOutOfSampleTrades}-trade target for ${result.range.validationRange} validation.`
      );
    }
  });

  it("uses range-specific minimum OOS trade counts and preserves graded evidence", () => {
    const result = validateTrendBacktest(samplePoints(700), "stock", DEFAULT_QUANT_CONFIG, { validationRange: "max" });

    expect(result.range.minimumOutOfSampleTrades).toBeGreaterThan(DEFAULT_QUANT_CONFIG.validation.minOutOfSampleTrades);
    if (result.outOfSample.totalTrades < result.range.minimumOutOfSampleTrades) {
      expect(result.outOfSampleLabel).toBe(result.outOfSample.totalTrades === 0 ? "Insufficient Data" : "Inconclusive");
      expect(["No Evidence", "Weak Evidence", "Moderate Evidence"]).toContain(result.validationEvidenceState);
      expect(result.validationScore).toBeLessThanOrEqual(65);
    }
  });

  it("labels walk-forward as insufficient trades per window when trade counts are too low", () => {
    const result = validateTrendBacktest(samplePoints(700), "stock", DEFAULT_QUANT_CONFIG);

    if (result.walkForward.tradesPerWindow.some((count) => count < DEFAULT_QUANT_CONFIG.validation.minWalkForwardTradesPerWindow)) {
      expect(result.walkForward.stabilityLabel).toBe("Insufficient trades per window");
      expect(result.walkForward.warnings).toContain("One or more walk-forward windows have too few trades for reliable validation.");
    }
  });

  it("runs rolling walk-forward windows when enough data exists", () => {
    const result = validateTrendBacktest(samplePoints(600), "stock", DEFAULT_QUANT_CONFIG);

    expect(result.walkForward.windowsTested).toBeGreaterThan(0);
    expect(result.walkForward.stabilityLabel).not.toBe("Insufficient Data");
    expect(["Robust", "Moderate", "Unstable", "Insufficient Data"]).toContain(result.robustnessLabel);
  });

  it("labels unstable walk-forward results without optimizing parameters", () => {
    const unstable = samplePoints(600).map((point, index) => ({
      ...point,
      close: index < 300 ? 100 + index * 0.4 : 220 - (index - 300) * 0.35,
      open: index < 300 ? 100 + index * 0.4 : 220 - (index - 300) * 0.35
    }));

    const result = validateTrendBacktest(unstable, "stock", DEFAULT_QUANT_CONFIG);

    expect(["Mixed", "Unstable", "Insufficient trades per window"]).toContain(result.walkForward.stabilityLabel);
    expect(["Moderate", "Unstable", "Insufficient Data"]).toContain(result.robustnessLabel);
  });

  it("tests the required moving-average combinations for parameter sensitivity", () => {
    const result = validateTrendBacktest(samplePoints(300), "stock", DEFAULT_QUANT_CONFIG);

    expect(result.parameterSensitivity.testedParameters).toEqual([
      { fastWindow: 20, slowWindow: 100 },
      { fastWindow: 50, slowWindow: 150 },
      { fastWindow: 50, slowWindow: 200 },
      { fastWindow: 100, slowWindow: 200 },
      { fastWindow: 20, slowWindow: 200 }
    ]);
    expect(result.parameterSensitivity.results).toHaveLength(5);
    expect(result.parameterSensitivity.results.every((stats) => typeof stats.totalReturn === "number")).toBe(true);
  });

  it("exposes risk-adjusted parameter sensitivity metrics instead of total return only", () => {
    const result = validateTrendBacktest(samplePoints(900), "stock", DEFAULT_QUANT_CONFIG, { validationRange: "max" });

    expect(result.parameterSensitivity.rangeLabel).toBe("Max");
    expect(result.parameterSensitivity.metrics).toHaveLength(result.parameterSensitivity.testedParameters.length);
    expect(result.parameterSensitivity.metrics.every((metric) => Number.isFinite(metric.annualizedReturn))).toBe(true);
    expect(result.parameterSensitivity.metrics.every((metric) => Number.isFinite(metric.maxDrawdown))).toBe(true);
    expect(result.parameterSensitivity.metrics.every((metric) => Number.isFinite(metric.sharpeRatio))).toBe(true);
    expect(result.parameterSensitivity.metrics.every((metric) => Number.isFinite(metric.tradeCount))).toBe(true);
    expect(result.parameterSensitivity.metrics.every((metric) => Number.isFinite(metric.robustnessScore))).toBe(true);
  });

  it("returns exact Phase 5 robustness labels for sensitivity", () => {
    const result = validateTrendBacktest(samplePoints(300), "stock", DEFAULT_QUANT_CONFIG);

    expect(["Robust", "Moderately Sensitive", "Highly Sensitive / Overfit Risk"]).toContain(
      result.parameterSensitivity.robustnessLabel
    );
  });

  it("warns when performance is highly sensitive to the tested parameters", () => {
    const unstable = samplePoints(300).map((point, index) => {
      const close = index % 35 < 18 ? 100 + index * 0.3 : 130 - index * 0.08;
      return {
        ...point,
        open: close,
        high: close * 1.01,
        low: close * 0.99,
        close
      };
    });

    const result = validateTrendBacktest(unstable, "stock", DEFAULT_QUANT_CONFIG);

    if (result.parameterSensitivity.robustnessLabel === "Highly Sensitive / Overfit Risk") {
      expect(result.parameterSensitivity.warnings).toContain("Parameter sensitivity is high; do not cherry-pick the best setting.");
    }
  });
});
