import { describe, expect, it } from "vitest";
import type { MarketDataPoint } from "@/types/asset";
import { createTrendBacktestCache, runTrendBacktest } from "@/lib/quant/backtest";
import { createBundledResearchDataset } from "@/lib/replay/sampleDataset";

function point(index: number, close: number, open = close): MarketDataPoint {
  return {
    date: new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10),
    timestamp: Date.UTC(2025, 0, index + 1),
    open,
    high: Math.max(open, close) * 1.01,
    low: Math.min(open, close) * 0.99,
    close,
    volume: 1_000_000,
    quoteVolume: close * 1_000_000
  };
}

describe("trade-by-trade trend backtest", () => {
  it("enters and exits trades on the next candle open after close-based signals", () => {
    const points = [
      point(0, 10, 10),
      point(1, 12, 100),
      point(2, 14, 200),
      point(3, 9, 300),
      point(4, 8, 400)
    ];

    const result = runTrendBacktest(points, "stock", 0, 0, 2, 3);

    expect(result.totalTrades).toBe(1);
    expect(result.trades[0]).toMatchObject({
      entryDate: points[3].date,
      entryPrice: 300,
      exitDate: points[4].date,
      exitPrice: 400,
      exitReason: "Trend exit"
    });
    expect(result.trades[0].holdingPeriod).toBe(1);
  });

  it("deducts fees from entry and exit notional", () => {
    const points = [
      point(0, 10, 10),
      point(1, 12, 100),
      point(2, 14, 100),
      point(3, 9, 100),
      point(4, 8, 100)
    ];

    const result = runTrendBacktest(points, "stock", 0.01, 0, 2, 3);

    expect(result.totalTrades).toBe(1);
    expect(result.trades[0].grossPnl).toBeCloseTo(0, 6);
    expect(result.trades[0].fees).toBeCloseTo(1990, 6);
    expect(result.trades[0].netPnl).toBeCloseTo(-1990, 6);
    expect(result.feesPaid).toBeCloseTo(1990, 6);
  });

  it("deducts slippage from entry and exit execution", () => {
    const points = [
      point(0, 10, 10),
      point(1, 12, 100),
      point(2, 14, 100),
      point(3, 9, 100),
      point(4, 8, 100)
    ];

    const result = runTrendBacktest(points, "stock", 0, 0.01, 2, 3);

    expect(result.totalTrades).toBe(1);
    expect(result.trades[0].entryPrice).toBeCloseTo(101, 6);
    expect(result.trades[0].exitPrice).toBeCloseTo(99, 6);
    expect(result.trades[0].slippage).toBeCloseTo(1980.1980198, 6);
    expect(result.trades[0].netPnl).toBeCloseTo(-1980.1980198, 6);
    expect(result.slippageCostEstimate).toBeCloseTo(1980.1980198, 6);
  });

  it("does not use a future close to enter before the next open", () => {
    const points = [
      point(0, 10, 10),
      point(1, 12, 100),
      point(2, 14, 200)
    ];

    const result = runTrendBacktest(points, "stock", 0, 0, 2, 3);

    expect(result.totalTrades).toBe(0);
    expect(result.equityCurve.at(-1)?.equity).toBe(100000);
  });

  it("returns an equity curve and drawdown curve from realized trade equity", () => {
    const points = [
      point(0, 10, 10),
      point(1, 12, 100),
      point(2, 14, 100),
      point(3, 9, 100),
      point(4, 8, 100)
    ];

    const result = runTrendBacktest(points, "stock", 0.01, 0, 2, 3);

    expect(result.equityCurve).toHaveLength(points.length);
    expect(result.drawdownCurve).toHaveLength(points.length);
    expect(result.maxDrawdown).toBeLessThan(0);
    expect(Math.min(...result.drawdownCurve.map((point) => point.drawdown))).toBeCloseTo(result.maxDrawdown, 6);
  });

  it("keeps cash uninvested when an allocation below 100% is configured", () => {
    const points = [
      point(0, 10, 10),
      point(1, 12, 100),
      point(2, 14, 100),
      point(3, 9, 100),
      point(4, 8, 110)
    ];

    const result = runTrendBacktest(points, "stock", 0, 0, 2, 3, { allocation: 0.1 });

    expect(result.totalTrades).toBe(1);
    expect(result.trades[0].positionSize).toBeCloseTo(10_000, 6);
    expect(result.trades[0].allocationUsed).toBeCloseTo(0.1, 6);
    expect(result.trades[0].capitalDeployed).toBeCloseTo(10_000, 6);
    expect(result.trades[0].cashReserve).toBeCloseTo(90_000, 6);
    expect(result.trades[0].positionValue).toBeCloseTo(10_000, 6);
    expect(result.trades[0].grossReturnPct).toBeCloseTo(0.01, 6);
    expect(result.trades[0].netReturnPct).toBeCloseTo(0.01, 6);
    expect(result.trades[0].netPnl).toBeCloseTo(1_000, 6);
    expect(result.equityCurve.at(-1)?.equity).toBeCloseTo(101_000, 6);
    expect(result.totalReturn).toBeCloseTo(0.01, 6);
  });

  it("records full allocation metadata for a 100% signal backtest", () => {
    const points = [
      point(0, 10, 10),
      point(1, 12, 100),
      point(2, 14, 100),
      point(3, 9, 100),
      point(4, 8, 110)
    ];

    const result = runTrendBacktest(points, "stock", 0, 0, 2, 3);

    expect(result.totalTrades).toBe(1);
    expect(result.trades[0].allocationUsed).toBeCloseTo(1, 6);
    expect(result.trades[0].capitalDeployed).toBeCloseTo(100_000, 6);
    expect(result.trades[0].cashReserve).toBeCloseTo(0, 6);
    expect(result.trades[0].positionValue).toBeCloseTo(100_000, 6);
    expect(result.trades[0].grossReturnPct).toBeCloseTo(0.1, 6);
    expect(result.trades[0].netReturnPct).toBeCloseTo(0.1, 6);
  });

  it("scales fees and slippage by deployed allocation instead of full account equity", () => {
    const points = [
      point(0, 10, 10),
      point(1, 12, 100),
      point(2, 14, 100),
      point(3, 9, 100),
      point(4, 8, 100)
    ];

    const full = runTrendBacktest(points, "stock", 0.01, 0.01, 2, 3, { allocation: 1 });
    const partial = runTrendBacktest(points, "stock", 0.01, 0.01, 2, 3, { allocation: 0.1 });

    expect(full.totalTrades).toBe(1);
    expect(partial.totalTrades).toBe(1);
    expect(full.trades[0].feesPaid).toBeCloseTo(partial.trades[0].feesPaid * 10, 6);
    expect(full.trades[0].slippagePaid).toBeCloseTo(partial.trades[0].slippagePaid * 10, 6);
    expect(Math.abs(full.trades[0].netPnl)).toBeCloseTo(Math.abs(partial.trades[0].netPnl) * 10, 6);
  });
});

describe("deterministic backtest cache", () => {
  it("returns bit-for-bit identical output to the uncached calculation", () => {
    const dataset = createBundledResearchDataset();
    const points = dataset.candles.slice(0, 240);
    const uncached = runTrendBacktest(points, "stock");
    const cached = runTrendBacktest(points, "stock", 0.001, 0.001, 50, 200, createTrendBacktestCache(points));
    expect(cached).toEqual(uncached);
  });
});
