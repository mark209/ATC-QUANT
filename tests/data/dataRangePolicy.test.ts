import { describe, expect, it } from "vitest";
import { evaluateCandleDensity } from "@/lib/data/dataRangePolicy";
import type { MarketDataPoint } from "@/types/asset";

const DAY_MS = 24 * 60 * 60 * 1000;

function points(count: number, gapDays: number, start = Date.UTC(2020, 0, 1)): MarketDataPoint[] {
  return Array.from({ length: count }, (_, index) => {
    const close = 100 + index;
    const timestamp = start + index * gapDays * DAY_MS;
    return {
      date: new Date(timestamp).toISOString().slice(0, 10),
      timestamp,
      open: close,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1000000,
      quoteVolume: close * 1000000,
      closeAdjustmentSource: "adjusted",
      ohlcAdjustmentSource: "derived-from-adjusted-close"
    };
  });
}

describe("data range policy", () => {
  it("detects AAPL-like sparse quarterly max rows as sparse", () => {
    const result = evaluateCandleDensity(points(168, 91, Date.UTC(1984, 11, 1)), "stock", "max", 240);

    expect(result.actualCandleCount).toBe(168);
    expect(result.isSparse).toBe(true);
    expect(result.gapCount).toBeGreaterThan(100);
    expect(result.issues).toContain("Insufficient candles for max: 168 < 240.");
  });

  it("accepts dense crypto daily max rows under crypto calendar assumptions", () => {
    const result = evaluateCandleDensity(points(1825, 1, Date.UTC(2021, 0, 1)), "crypto", "max", 500);

    expect(result.actualCandleCount).toBe(1825);
    expect(result.isSparse).toBe(false);
    expect(result.densityRatio).toBeGreaterThan(0.9);
  });

  it("marks sparse crypto daily data as sparse instead of applying equity trading-day assumptions", () => {
    const result = evaluateCandleDensity(points(120, 7, Date.UTC(2024, 0, 1)), "crypto", "max", 500);

    expect(result.isSparse).toBe(true);
    expect(result.largestGapDays).toBe(7);
    expect(result.warnings).toContain("Missing or gapped candles detected.");
  });
});
