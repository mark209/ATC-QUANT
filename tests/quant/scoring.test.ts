import { describe, expect, it } from "vitest";
import { analyzeMarketData } from "@/lib/quant/scoring";
import type { MarketDataPoint } from "@/types/asset";

function samplePoints(count = 260, startYear = 2025): MarketDataPoint[] {
  return Array.from({ length: count }, (_, index) => {
    const close = 100 + index * 0.35 + Math.sin(index / 7) * 2;
    return {
      date: new Date(Date.UTC(startYear, 0, index + 1)).toISOString().slice(0, 10),
      timestamp: Date.UTC(startYear, 0, index + 1),
      open: close * 0.99,
      high: close * 1.02,
      low: close * 0.98,
      close,
      volume: 1_000_000,
      quoteVolume: close * 1_000_000
    };
  });
}

describe("investability scoring", () => {
  it("produces a bounded score and classification", () => {
    const result = analyzeMarketData(samplePoints(), "stock", "TEST", "balanced");
    expect(result.investability.score).toBeGreaterThanOrEqual(0);
    expect(result.investability.score).toBeLessThanOrEqual(100);
    expect(result.investability.classification.length).toBeGreaterThan(0);
    expect(result.backtest.numberOfTrades).toBeGreaterThanOrEqual(0);
  });

  it("derives expected value and Kelly inputs from backtested trades instead of daily asset returns", () => {
    const result = analyzeMarketData(samplePoints(), "stock", "TEST", "balanced");

    expect(result.pipeline.expectedValue.tradeCount).toBe(result.backtest.trades.length);
    expect(result.pipeline.expectedValue.tradeCount).not.toBe(259);
    if (result.pipeline.expectedValue.expectedValueAfterCosts <= 0) {
      expect(result.pipeline.positionSizing.fractionalKellyAllocation).toBe(0);
    }
  });

  it("returns both signal and allocation-adjusted backtests", () => {
    const result = analyzeMarketData(samplePoints(), "stock", "TEST", "balanced");

    expect(result.backtest.assumptionLabel).toBe("100% signal backtest");
    expect(result.allocationAdjustedBacktest.assumptionLabel).toBe("Allocation-adjusted backtest");
    expect(result.allocationAdjustedBacktest.allocation).toBe(result.positionSizing.finalAllocation);
  });

  it("uses engine, backtest, and validation candles instead of sparse chart candles when range metadata is supplied", () => {
    const chartCandles = samplePoints(168, 1984);
    const engineCandles = samplePoints(260, 2025);
    const backtestCandles = samplePoints(520, 2024);
    const validationCandles = samplePoints(780, 2023);

    const result = analyzeMarketData(engineCandles, "stock", "TEST", "balanced", {
      chartCandles,
      engineCandles,
      backtestCandles,
      validationCandles,
      rangeMetadata: {
        chartRangeRequested: "max",
        chartDataRangeUsed: "max",
        engineRangeUsed: "10y",
        backtestRangeUsed: "10y",
        validationRangeUsed: "10y",
        fallbackUsed: true,
        fallbackReason: "Chart range max was sparse; engine used 10y daily data."
      }
    });

    expect(result.pipeline.dataQuality.dataPoints).toBe(engineCandles.length);
    expect(result.backtest.equityCurve).toHaveLength(backtestCandles.length);
    expect(result.pipeline.validation.range.validationRange).toBe("10Y");
    expect(result.rangeUsage.chart).toBe("Max");
    expect(result.rangeUsage.currentSignal).toContain("10y");
    expect(result.rangeUsage.backtest).toContain("10y");
    expect(result.rangeUsage.validation).toContain("10y");
  });
});
