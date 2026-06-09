import { describe, expect, it } from "vitest";
import type { AssetType, MarketDataPoint } from "@/types/asset";
import { DEFAULT_QUANT_CONFIG } from "@/lib/quant/config";
import { validateDataQuality } from "@/lib/quant/dataQuality";
import { analyzeMarketData } from "@/lib/quant/scoring";

function samplePoints(length: number, volume = 1_000_000): MarketDataPoint[] {
  return Array.from({ length }, (_, index) => {
    const close = 100 + index * 0.15;
    return {
      date: new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10),
      timestamp: Date.UTC(2025, 0, index + 1),
      open: close * 0.99,
      high: close * 1.01,
      low: close * 0.98,
      close,
      volume,
      quoteVolume: close * volume
    };
  });
}

describe("data quality", () => {
  it("fails when OHLCV values are missing or non-finite", () => {
    const points = samplePoints(260);
    points[20] = { ...points[20], close: Number.NaN };

    const result = validateDataQuality(points, "stock", DEFAULT_QUANT_CONFIG);

    expect(result.passed).toBe(false);
    expect(result.issues).toContain("Missing or non-finite market values.");
  });

  it("reports candle coverage and estimated validation trade coverage", () => {
    const result = validateDataQuality(samplePoints(600), "stock", DEFAULT_QUANT_CONFIG);

    expect(result.totalCandles).toBe(600);
    expect(result.usableCandlesAfterWarmup).toBe(400);
    expect(result.estimatedTrades).toBeGreaterThanOrEqual(0);
    expect(result.outOfSampleTrades).toBeGreaterThanOrEqual(0);
    expect(result.walkForwardTradesPerWindow.length).toBeGreaterThan(0);
  });

  it("fails invalid prices and invalid volume", () => {
    const points = samplePoints(260);
    points[10] = { ...points[10], high: 90, low: 95 };
    points[11] = { ...points[11], volume: 0 };

    const result = validateDataQuality(points, "stock", DEFAULT_QUANT_CONFIG);

    expect(result.passed).toBe(false);
    expect(result.issues).toContain("Invalid prices.");
    expect(result.issues).toContain("Invalid volume.");
  });

  it("warns on stale timestamps and extreme outlier candles using central thresholds", () => {
    const points = samplePoints(260);
    points[259] = { ...points[259], timestamp: points[258].timestamp };
    const outlierThreshold = Math.max(
      DEFAULT_QUANT_CONFIG.dataQuality.maxOutlierCandles,
      points.length * DEFAULT_QUANT_CONFIG.dataQuality.maxOutlierCandleRate
    );
    for (let index = 0; index < outlierThreshold + 1; index += 1) {
      points[index] = { ...points[index], high: points[index].close * 1.8, low: points[index].close * 0.2 };
    }

    const result = validateDataQuality(points, "stock", DEFAULT_QUANT_CONFIG);

    expect(result.warnings).toContain("Latest data timestamp appears stale.");
    expect(result.warnings).toContain("Extreme outlier candles detected.");
  });

  it("fails unsorted and duplicate candles", () => {
    const points = samplePoints(260);
    points[20] = { ...points[19] };
    points[21] = { ...points[21], timestamp: points[18].timestamp };

    const result = validateDataQuality(points, "stock", DEFAULT_QUANT_CONFIG);

    expect(result.passed).toBe(false);
    expect(result.issues).toContain("Candles are not sorted chronologically.");
    expect(result.issues).toContain("Duplicate candles detected.");
  });

  it("warns on missing candle gaps and stale latest candles", () => {
    const points = samplePoints(260);
    for (let index = 120; index < points.length; index += 1) {
      const shifted = points[index].timestamp + 10 * 24 * 60 * 60 * 1000;
      points[index] = { ...points[index], timestamp: shifted, date: new Date(shifted).toISOString().slice(0, 10) };
    }

    const result = validateDataQuality(points, "stock", DEFAULT_QUANT_CONFIG, {
      asOfTimestamp: Date.UTC(2026, 0, 1)
    });

    expect(result.warnings).toContain("Missing or gapped candles detected.");
    expect(result.warnings).toContain("Latest candle is stale for the selected asset class.");
  });

  it("fails unsupported asset classes without relying on asset-specific config lookups", () => {
    const result = validateDataQuality(samplePoints(260), "commodity" as AssetType, DEFAULT_QUANT_CONFIG);

    expect(result.passed).toBe(false);
    expect(result.issues).toContain("Unsupported asset class.");
    expect(result.requiredDataPoints).toBe(DEFAULT_QUANT_CONFIG.minDataPoints);
  });

  it("short-circuits the scoring pipeline when data quality fails", () => {
    const result = analyzeMarketData(samplePoints(40), "stock", "TEST", "balanced");

    expect(result.pipeline.finalDecision.decisionLabel).toBe("No Data / Avoid");
    expect(result.pipeline.finalDecision.finalScore).toBe(0);
    expect(result.pipeline.finalDecision.signalScore).toBe(0);
    expect(result.pipeline.finalDecision.riskScore).toBe(0);
    expect(result.pipeline.finalDecision.validationScore).toBe(0);
    expect(result.optimalEntryZone.actionability).toBe("NO_TRADE");
    expect(result.optimalEntryZone.entrySide).toBe("NONE");
  });

  it("returns a clean downstream entry-zone object from the scoring pipeline", () => {
    const result = analyzeMarketData(samplePoints(280), "stock", "TEST", "balanced");

    expect(["LONG_ELIGIBLE", "SHORT_ELIGIBLE", "NOT_TRADABLE"]).toContain(result.optimalEntryZone.regimeDirection);
    expect(["WATCHLIST", "ACTIONABLE", "NO_TRADE"]).toContain(result.optimalEntryZone.actionability);
    expect(result.optimalEntryZone.vwapData).toHaveProperty("rollingVWAP7D");
    expect(result.entryZoneAblation.cases.map((item) => item.label)).toContain("Current system + full Optimal Entry Zone Engine");
  });
});
