import { describe, expect, it } from "vitest";
import { bootstrapMetrics, monteCarlo, summarizeTrades, type AnalysisTrade } from "@/lib/analysis/statisticalAnalysis";

const trades: AnalysisTrade[] = [
  { net_pnl: 100, return_percent: 0.1, r_multiple: 2, entry_timestamp_utc: "2024-01-01T00:00:00.000Z", exit_timestamp_utc: "2024-01-03T00:00:00.000Z", data_snapshot_id: "a", instrument: "BTCUSDT", market_regime: "Trend Up", volatility_regime: "Low volatility" },
  { net_pnl: -50, return_percent: -0.05, r_multiple: -1, entry_timestamp_utc: "2024-01-04T00:00:00.000Z", exit_timestamp_utc: "2024-01-05T00:00:00.000Z", data_snapshot_id: "a", instrument: "BTCUSDT", market_regime: "Range / Chop", volatility_regime: "Normal volatility" },
  { net_pnl: 25, return_percent: 0.025, r_multiple: 0.5, entry_timestamp_utc: "2024-01-06T00:00:00.000Z", exit_timestamp_utc: "2024-01-08T00:00:00.000Z", data_snapshot_id: "a", instrument: "BTCUSDT", market_regime: "Trend Up", volatility_regime: "Low volatility" }
];

describe("statistical edge analysis", () => {
  it("computes trade and edge metrics from immutable trade outcomes", () => {
    const result = summarizeTrades(trades, 1000);
    expect(result.trade_count).toBe(3);
    expect(result.winning_trades).toBe(2);
    expect(result.win_rate).toBeCloseTo(2 / 3);
    expect(result.net_profit).toBe(75);
    expect(result.expectancy).toBe(25);
    expect(result.profit_factor).toBeCloseTo(2.5);
    expect(result.average_holding_days).toBeCloseTo(5 / 3);
  });

  it("keeps Monte Carlo and bootstrap results deterministic for the same seed", () => {
    expect(monteCarlo(trades, 1000, 42)).toEqual(monteCarlo(trades, 1000, 42));
    expect(bootstrapMetrics(trades, 1000, 42)).toEqual(bootstrapMetrics(trades, 1000, 42));
  });
});
