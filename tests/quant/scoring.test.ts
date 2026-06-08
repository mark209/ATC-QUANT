import { describe, expect, it } from "vitest";
import { analyzeMarketData } from "@/lib/quant/scoring";
import type { MarketDataPoint } from "@/types/asset";

function samplePoints(): MarketDataPoint[] {
  return Array.from({ length: 260 }, (_, index) => {
    const close = 100 + index * 0.35 + Math.sin(index / 7) * 2;
    return {
      date: new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10),
      timestamp: Date.UTC(2025, 0, index + 1),
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
});
