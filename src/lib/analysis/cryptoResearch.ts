import type { StatisticalAnalysisReport } from "./statisticalAnalysis";

export interface CryptoAssetResearchRow {
  symbol: string;
  dataset_id: string;
  replay_id: string;
  completed_trades: number;
  win_rate: number;
  expectancy: number;
  profit_factor: number;
  maximum_drawdown: number;
  sharpe: number | null;
  sortino: number | null;
  monte_carlo_median: number;
  monte_carlo_worst_5: number;
  bootstrap_expectancy: [number, number];
  risk_of_ruin: number;
  confidence_score: number;
  robustness_score: number;
  composite_score: number;
  verification_status: string;
}

export interface CryptoMasterReport {
  schema_version: string;
  generated_at: string;
  asset_class: "crypto";
  timeframe: "1d";
  assets: readonly CryptoAssetResearchRow[];
  best_performing_dataset: string | null;
  worst_performing_dataset: string | null;
  most_robust_dataset: string | null;
  highest_confidence_dataset: string | null;
  conclusion: string;
  known_limitations: readonly string[];
}

function finite(value: number): number { return Number.isFinite(value) ? value : 0; }

export function buildCryptoMasterReport(input: { generatedAt: string; rows: readonly { symbol: string; dataset_id: string; replay_id: string; report: StatisticalAnalysisReport; verification_status: string }[] }): CryptoMasterReport {
  const assets = input.rows.map(({ symbol, dataset_id, replay_id, report, verification_status }) => {
    const metrics = report.trade_statistics;
    const sampleScore = Math.min(1, metrics.trade_count / 30);
    const confidenceScore = sampleScore * (report.bootstrap.expectancy[0] > 0 ? 1 : 0.5);
    const rawConcentration = Number(report.robustness.performance_concentration_largest_win_share) || 0;
    const concentration = Math.min(1, Math.max(0, rawConcentration));
    const outOfSamplePositive = report.out_of_sample.out_of_sample.expectancy > 0 ? 1 : 0.5;
    const robustnessScore = Math.max(0, Math.min(1, (1 - concentration) * (1 - Math.min(1, metrics.maximum_drawdown)) * outOfSamplePositive));
    const compositeScore = 0.35 * sampleScore + 0.25 * (metrics.expectancy > 0 ? 1 : 0) + 0.2 * (report.bootstrap.expectancy[0] > 0 ? 1 : 0.5) + 0.2 * robustnessScore;
    return { symbol, dataset_id, replay_id, completed_trades: metrics.trade_count, win_rate: metrics.win_rate, expectancy: metrics.expectancy, profit_factor: finite(metrics.profit_factor), maximum_drawdown: metrics.maximum_drawdown, sharpe: metrics.sharpe_ratio, sortino: metrics.sortino_ratio, monte_carlo_median: report.monte_carlo.median, monte_carlo_worst_5: report.monte_carlo.p05, bootstrap_expectancy: report.bootstrap.expectancy, risk_of_ruin: report.risk_of_ruin.risk_of_ruin, confidence_score: confidenceScore, robustness_score: robustnessScore, composite_score: compositeScore, verification_status };
  }).sort((a, b) => a.symbol.localeCompare(b.symbol));
  const byScore = [...assets].sort((a, b) => b.composite_score - a.composite_score);
  const byProfit = [...assets].sort((a, b) => b.expectancy - a.expectancy);
  const limitations = ["Each symbol currently has one daily dataset; asset-level independence is preserved, but cross-asset inference remains limited.", "A dataset with fewer than 30 completed trades is exploratory and should not support a production edge claim.", "Order-only Monte Carlo preserves total ending equity; it tests path and drawdown sensitivity, not outcome uncertainty.", "The existing verifier reports lifecycle timestamp ordering failures on these artifacts; verification must be remediated before production claims."];
  return { schema_version: "1.0", generated_at: input.generatedAt, asset_class: "crypto", timeframe: "1d", assets, best_performing_dataset: byScore[0]?.dataset_id ?? null, worst_performing_dataset: byScore.at(-1)?.dataset_id ?? null, most_robust_dataset: [...assets].sort((a, b) => b.robustness_score - a.robustness_score)[0]?.dataset_id ?? null, highest_confidence_dataset: [...assets].sort((a, b) => b.confidence_score - a.confidence_score)[0]?.dataset_id ?? null, conclusion: assets.length < 5 ? "INSUFFICIENT CRYPTO COVERAGE: required daily markets are missing." : "CRYPTO EVIDENCE EXPANDED BUT NOT PRODUCTION-READY: sample sizes are small and verification failures remain.", known_limitations: limitations };
}

export function renderCryptoMasterReport(report: CryptoMasterReport): string {
  return ["# MASTER CRYPTO REPORT", "", `Generated: ${report.generated_at}`, `Asset class: ${report.asset_class}`, `Timeframe: ${report.timeframe}`, `Conclusion: **${report.conclusion}**`, "", "## Dataset Comparison", "| Asset | Trades | Win Rate | Expectancy | Profit Factor | Max Drawdown | Sharpe | Sortino | MC Worst 5% | Bootstrap Expectancy | Confidence | Robustness |", "|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|", ...report.assets.map((row) => `| ${row.symbol} | ${row.completed_trades} | ${(row.win_rate * 100).toFixed(2)}% | ${row.expectancy.toFixed(2)} | ${row.profit_factor.toFixed(2)} | ${(row.maximum_drawdown * 100).toFixed(2)}% | ${row.sharpe === null ? "n/a" : row.sharpe.toFixed(2)} | ${row.sortino === null ? "n/a" : row.sortino.toFixed(2)} | ${row.monte_carlo_worst_5.toFixed(2)} | ${row.bootstrap_expectancy[0].toFixed(2)} to ${row.bootstrap_expectancy[1].toFixed(2)} | ${row.confidence_score.toFixed(3)} | ${row.robustness_score.toFixed(3)} |`), "", "## Research Highlights", `Best composite dataset: ${report.best_performing_dataset ?? "n/a"}`, `Worst composite dataset: ${report.worst_performing_dataset ?? "n/a"}`, `Most robust dataset: ${report.most_robust_dataset ?? "n/a"}`, `Highest confidence dataset: ${report.highest_confidence_dataset ?? "n/a"}`, "", "## Known Limitations", ...report.known_limitations.map((limitation) => `- ${limitation}`), ""].join("\n");
}
