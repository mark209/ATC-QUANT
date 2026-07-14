import { describe, expect, it } from "vitest";
import { buildCryptoMasterReport } from "@/lib/analysis/cryptoResearch";
import type { StatisticalAnalysisReport } from "@/lib/analysis/statisticalAnalysis";

function report(symbol: string, trades: number, expectancy: number): StatisticalAnalysisReport {
  return { schema_version: "1.0", generated_at: "2026-07-14T00:00:00.000Z", replay_ids: [symbol], capital: 100000, executive_summary: "", dataset_summary: [], trade_statistics: { trade_count: trades, winning_trades: 1, losing_trades: 1, win_rate: 0.5, loss_rate: 0.5, average_win: 100, average_loss: -50, largest_win: 100, largest_loss: -50, average_holding_days: 2, trade_frequency_per_year: 1, gross_profit: 100, gross_loss: -50, net_profit: expectancy * trades, expectancy, expected_value_per_trade: expectancy, payoff_ratio: 2, profit_factor: 2, recovery_factor: 1, edge_ratio: 2, average_r_multiple: 1, r_multiple_distribution: [1, -1], maximum_drawdown: 0.1, maximum_equity_drawdown: 10000, average_drawdown: 0.05, longest_drawdown_days: 10, consecutive_wins: 1, consecutive_losses: 1, exposure: 1000, capital_utilization: 0.01, time_under_water: 0.5, cagr: 0.1, annualized_return: 0.1, volatility: 0.2, sharpe_ratio: 1, sortino_ratio: 1, calmar_ratio: 1, mar_ratio: 1, ulcer_index: 0.1 }, monte_carlo: { median: 100000, p05: 90000, p95: 110000, maximum_drawdown: 0.2, ending_equity: [], simulations: 10000, seed: 1 }, bootstrap: { samples: 10000, seed: 1, confidence_level: 0.95, expectancy: [-1, 2], profit_factor: [0.5, 3], win_rate: [0.2, 0.8], average_return: [-0.1, 0.1] }, risk_of_ruin: { risk_of_ruin: 0, probability_drawdown_20: 0, probability_drawdown_30: 0, probability_equity_doubling: 0.5, probability_new_equity_high: 0.5, simulations: 10000 }, regime_analysis: [], out_of_sample: { training: {} as never, validation: {} as never, out_of_sample: {} as never }, walk_forward: [], robustness: { performance_concentration_largest_win_share: 0.4 }, known_limitations: [], conclusion: "" };
}

describe("crypto research comparison", () => {
  it("bounds robustness scores and keeps the report crypto-only", () => {
    const result = buildCryptoMasterReport({ generatedAt: "2026-07-14T00:00:00.000Z", rows: [{ symbol: "AAA", dataset_id: "aaa", replay_id: "r1", report: report("AAA", 20, 10), verification_status: "PASS" }] });
    expect(result.asset_class).toBe("crypto");
    expect(result.assets[0].robustness_score).toBeGreaterThanOrEqual(0);
    expect(result.assets[0].robustness_score).toBeLessThanOrEqual(1);
  });
});
