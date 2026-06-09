import { describe, expect, it } from "vitest";
import type { MarketDataPoint } from "@/types/asset";
import { calculateATR } from "@/lib/quant/atr";
import { DEFAULT_QUANT_CONFIG } from "@/lib/quant/config";
import { runEntryZoneAblation } from "@/lib/quant/entryZoneAblation";
import { findMostRecentConfirmedSwingHigh, findMostRecentConfirmedSwingLow } from "@/lib/quant/pivots";
import { analyzeOptimalEntryZone } from "@/lib/quant/optimalEntryZone";
import { calculateRollingVWAP, calculateVWAP, calculateVWAPBands } from "@/lib/quant/vwap";

const DAY = 24 * 60 * 60 * 1000;

function candle(index: number, input: Partial<MarketDataPoint> = {}): MarketDataPoint {
  const close = input.close ?? 100 + index;
  const high = input.high ?? close + 1;
  const low = input.low ?? close - 1;
  const open = input.open ?? close - 0.25;
  const timestamp = Date.UTC(2025, 0, 1) + index * DAY;
  return {
    date: new Date(timestamp).toISOString().slice(0, 10),
    timestamp,
    open,
    high,
    low,
    close,
    volume: input.volume ?? 1_000,
    quoteVolume: input.quoteVolume
  };
}

describe("VWAP indicators", () => {
  it("calculates VWAP from typical price and volume", () => {
    const points = [
      candle(0, { high: 12, low: 8, close: 10, volume: 100 }),
      candle(1, { high: 24, low: 18, close: 18, volume: 200 })
    ];

    const result = calculateVWAP(points);

    expect(result.value).toBeCloseTo((10 * 100 + 20 * 200) / 300, 6);
    expect(result.warnings).toHaveLength(0);
  });

  it("handles missing or zero volume without crashing", () => {
    const result = calculateVWAP([candle(0, { volume: 0 }), candle(1, { volume: Number.NaN })]);

    expect(result.value).toBeNull();
    expect(result.warnings).toContain("VWAP could not be calculated because usable volume is zero.");
  });

  it("calculates rolling VWAP by timestamp duration and warns on partial history", () => {
    const points = Array.from({ length: 5 }, (_, index) => candle(index, { close: 100 + index, volume: 100 }));

    const result = calculateRollingVWAP(points, points.length - 1, 7);

    expect(result.value).toBeCloseTo(102, 6);
    expect(result.warnings).toContain("Rolling VWAP used partial history because less than 7 days of data are available.");
  });

  it("calculates volume-weighted VWAP standard deviation bands", () => {
    const points = [candle(0, { close: 99, high: 100, low: 98 }), candle(1, { close: 101, high: 102, low: 100 })];

    const result = calculateVWAPBands(points);

    expect(result.vwap).toBeCloseTo(100, 6);
    expect(result.weightedStdDev).toBeCloseTo(1, 6);
    expect(result.upperBand1).toBeCloseTo(101, 6);
    expect(result.lowerBand2).toBeCloseTo(98, 6);
  });
});

describe("ATR and confirmed pivots", () => {
  it("calculates ATR from true range", () => {
    const points = [
      candle(0, { high: 11, low: 9, close: 10 }),
      candle(1, { high: 13, low: 10, close: 12 }),
      candle(2, { high: 15, low: 11, close: 14 })
    ];

    const result = calculateATR(points, 2);

    expect(result.value).toBeCloseTo(3.5, 6);
  });

  it("detects the most recent confirmed swing low without lookahead", () => {
    const lows = [10, 9, 8, 5, 8, 9, 10];
    const points = lows.map((low, index) => candle(index, { low, high: low + 5, close: low + 2 }));

    expect(findMostRecentConfirmedSwingLow(points, 3, 3, 5)).toBeNull();
    const confirmed = findMostRecentConfirmedSwingLow(points, 3, 3, 6);
    expect(confirmed).toMatchObject({ pivotIndex: 3, confirmationIndex: 6, price: 5 });
  });

  it("detects the most recent confirmed swing high without lookahead", () => {
    const highs = [10, 11, 12, 18, 12, 11, 10];
    const points = highs.map((high, index) => candle(index, { high, low: high - 5, close: high - 2 }));

    expect(findMostRecentConfirmedSwingHigh(points, 3, 3, 5)).toBeNull();
    const confirmed = findMostRecentConfirmedSwingHigh(points, 3, 3, 6);
    expect(confirmed).toMatchObject({ pivotIndex: 3, confirmationIndex: 6, price: 18 });
  });
});

describe("Optimal Entry Zone Engine", () => {
  function trendingPoints(length = 120): MarketDataPoint[] {
    return Array.from({ length }, (_, index) => {
      const pullback = index > 100 ? (index - 100) * -0.35 : 0;
      const close = 100 + index * 0.7 + Math.sin(index / 4) + pullback;
      return candle(index, {
        open: close - 0.4,
        high: close + 1.2,
        low: close - 1.2,
        close,
        volume: 2_000_000
      });
    });
  }

  it("produces long entry analysis only when the main strategy allows long", () => {
    const result = analyzeOptimalEntryZone({
      symbol: "BTCUSDT",
      timeframe: "1D",
      candles: trendingPoints(),
      mainStrategyDirection: "LONG_ELIGIBLE",
      liquidityPassed: true,
      volatilityPassed: true,
      expectedValuePassed: true
    });

    expect(result.regimeDirection).toBe("LONG_ELIGIBLE");
    expect(result.entrySide).toBe("LONG");
    expect(result.entryZone).not.toBeNull();
    expect(result.explanation[0]).toBe("Main strategy classifies asset as LONG_ELIGIBLE.");
  });

  it("does not generate actionable zones when the main strategy returns NOT_TRADABLE", () => {
    const result = analyzeOptimalEntryZone({
      symbol: "BTCUSDT",
      timeframe: "1D",
      candles: trendingPoints(),
      mainStrategyDirection: "NOT_TRADABLE",
      liquidityPassed: true,
      volatilityPassed: true,
      expectedValuePassed: true
    });

    expect(result.actionability).toBe("NO_TRADE");
    expect(result.entrySide).toBe("NONE");
    expect(result.entryZone).toBeNull();
    expect(result.explanation).toContain("Main strategy does not allow a trade; VWAP data is context only.");
  });

  it("does not let VWAP create a short setup when short eligibility is disabled upstream", () => {
    const result = analyzeOptimalEntryZone({
      symbol: "BTCUSDT",
      timeframe: "1D",
      candles: trendingPoints(),
      mainStrategyDirection: "NOT_TRADABLE",
      requestedSide: "SHORT",
      liquidityPassed: true,
      volatilityPassed: true,
      expectedValuePassed: true
    });

    expect(result.actionability).toBe("NO_TRADE");
    expect(result.entrySide).toBe("NONE");
    expect(result.warnings).toContain("VWAP is not a standalone short signal.");
  });

  it("returns no trade when long price is too extended above VWAP", () => {
    const points = trendingPoints();
    const last = points.at(-1);
    if (last) {
      last.close += 80;
      last.high = last.close + 2;
      last.low = last.close - 2;
    }

    const result = analyzeOptimalEntryZone({
      symbol: "BTCUSDT",
      timeframe: "1D",
      candles: points,
      mainStrategyDirection: "LONG_ELIGIBLE",
      liquidityPassed: true,
      volatilityPassed: true,
      expectedValuePassed: true
    });

    expect(result.actionability).toBe("NO_TRADE");
    expect(result.reasonNoTrade).toContain("Price is more than 2 standard deviations above VWAP.");
  });

  it("marks VWAP ablation variants inactive instead of showing fake comparative backtests", () => {
    const result = runEntryZoneAblation(trendingPoints(), "stock", DEFAULT_QUANT_CONFIG);
    const variants = result.cases.filter((item) => item.label !== "Current system only");

    expect(variants.length).toBeGreaterThan(0);
    expect(variants.every((item) => item.status === "Scaffold only / not active")).toBe(true);
    expect(variants.every((item) => item.summary === null)).toBe(true);
    expect(result.warnings).toContain("VWAP ablation filters are scaffold-only and are not active in backtest results.");
  });
});
