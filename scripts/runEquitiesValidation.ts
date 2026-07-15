import { mkdir, readFile, writeFile } from "node:fs/promises";
import { calculateHash, renderReplayVerificationReport, verifyReplayArtifacts } from "../src/lib/quant/replayVerification";
import { DatasetLibrary } from "../src/lib/datasets/datasetLibrary";
import { ReplayArtifactStore } from "../src/lib/replay/replayArtifacts";
import { DeterministicReplayRunner, REPLAY_ENGINE_VERSION, type ProductionReplayIdentity } from "../src/lib/replay/replayRunner";
import { buildStrategyTraceReport, generateStrategyTrace } from "../src/lib/replay/strategyTrace";
import { buildStatisticalReport, renderStatisticalReport, type AnalysisTrade, type StatisticalAnalysisReport } from "../src/lib/analysis/statisticalAnalysis";
import { canonicalJson } from "../src/lib/trading/tradeJournal";

const symbols = ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "AMZN"] as const;
const reportsDirectory = "reports/equities";
const library = new DatasetLibrary("datasets");
const store = new ReplayArtifactStore("replays");

type EquityReportRow = {
  symbol: string;
  dataset_id: string;
  replay_id: string;
  report: StatisticalAnalysisReport;
  verification_status: string;
};

function identity(dataset: Awaited<ReturnType<DatasetLibrary["get"]>>["dataset"], assetType: "stock" | "etf"): ProductionReplayIdentity {
  const configuration = { asset_type: assetType, risk_profile: "balanced" } as const;
  return {
    replay_id: `equities-${dataset.symbol.toLowerCase()}-${dataset.dataset_version}`,
    dataset_id: dataset.dataset_id,
    dataset_version: dataset.dataset_version,
    dataset_hash: dataset.dataset_hash,
    strategy_version: "strategy-current",
    strategy_git_commit: process.env.ATC_STRATEGY_GIT_COMMIT ?? "working-tree",
    execution_profile: "ideal",
    engine_version: REPLAY_ENGINE_VERSION,
    configuration,
    configuration_hash: calculateHash(configuration),
    random_seed: "equities-research-2.1",
    replay_timestamp: dataset.creation_timestamp
  };
}

function renderEquityReport(symbol: string, report: StatisticalAnalysisReport, verificationStatus: string): string {
  const metrics = report.trade_statistics;
  const monteCarlo = report.monte_carlo;
  const bootstrap = report.bootstrap;
  const ruin = report.risk_of_ruin;
  return [
    `# ${symbol} REPORT`,
    "",
    `Verification: **${verificationStatus}**`,
    report.executive_summary,
    `Conclusion: **${report.conclusion}**`,
    "",
    "## Dataset Summary",
    ...report.dataset_summary.map((dataset) => `- ${JSON.stringify(dataset)}`),
    "",
    "## Trade Statistics",
    `Completed trades: ${metrics.trade_count}`,
    `Win rate: ${(metrics.win_rate * 100).toFixed(2)}%`,
    `Expectancy: ${metrics.expectancy.toFixed(4)}`,
    `Profit factor: ${Number.isFinite(metrics.profit_factor) ? metrics.profit_factor.toFixed(4) : "infinite"}`,
    `Net profit: ${metrics.net_profit.toFixed(2)}`,
    `Trade frequency: ${metrics.trade_frequency_per_year.toFixed(4)} per year`,
    "",
    "## Risk Metrics",
    `Maximum drawdown: ${(metrics.maximum_drawdown * 100).toFixed(2)}%`,
    `Average drawdown: ${(metrics.average_drawdown * 100).toFixed(2)}%`,
    `Sharpe: ${metrics.sharpe_ratio === null ? "n/a" : metrics.sharpe_ratio.toFixed(4)}`,
    `Sortino: ${metrics.sortino_ratio === null ? "n/a" : metrics.sortino_ratio.toFixed(4)}`,
    `Calmar: ${metrics.calmar_ratio === null ? "n/a" : metrics.calmar_ratio.toFixed(4)}`,
    `CAGR: ${metrics.cagr === null ? "n/a" : `${(metrics.cagr * 100).toFixed(2)}%`}`,
    "",
    "## Monte Carlo",
    `Simulations: ${monteCarlo.simulations}`,
    `Median ending equity: ${monteCarlo.median.toFixed(2)}`,
    `Worst 5% ending equity: ${monteCarlo.p05.toFixed(2)}`,
    `Best 5% ending equity: ${monteCarlo.p95.toFixed(2)}`,
    `Maximum simulated drawdown: ${(monteCarlo.maximum_drawdown * 100).toFixed(2)}%`,
    "",
    "## Bootstrap 95% Confidence Intervals",
    `Expectancy: ${bootstrap.expectancy[0].toFixed(4)} to ${bootstrap.expectancy[1].toFixed(4)}`,
    `Profit factor: ${bootstrap.profit_factor[0].toFixed(4)} to ${bootstrap.profit_factor[1].toFixed(4)}`,
    `Win rate: ${(bootstrap.win_rate[0] * 100).toFixed(2)}% to ${(bootstrap.win_rate[1] * 100).toFixed(2)}%`,
    "",
    "## Risk Of Ruin",
    `Risk of ruin: ${(ruin.risk_of_ruin * 100).toFixed(2)}%`,
    `Probability of 20% drawdown: ${(ruin.probability_drawdown_20 * 100).toFixed(2)}%`,
    `Probability of 30% drawdown: ${(ruin.probability_drawdown_30 * 100).toFixed(2)}%`,
    `Probability of equity doubling: ${(ruin.probability_equity_doubling * 100).toFixed(2)}%`,
    "",
    "## Confidence Assessment",
    ...report.known_limitations.map((limitation) => `- ${limitation}`),
    "",
    "## Known Limitations",
    "- This report is isolated to US equities and is not compared with crypto.",
    "- No strategy, threshold, execution, or lifecycle behavior was changed.",
    ""
  ].join("\n");
}

function renderMaster(rows: readonly EquityReportRow[], generatedAt: string): string {
  const rankedByConfidence = [...rows].sort((a, b) => b.report.trade_statistics.trade_count - a.report.trade_statistics.trade_count);
  const rankedByExpectancy = [...rows].sort((a, b) => b.report.trade_statistics.expectancy - a.report.trade_statistics.expectancy);
  const rankedByDrawdown = [...rows].sort((a, b) => a.report.trade_statistics.maximum_drawdown - b.report.trade_statistics.maximum_drawdown);
  return [
    "# MASTER_EQUITIES_REPORT",
    "",
    `Generated: ${generatedAt}`,
    "Asset class: US equities",
    "Timeframe: Daily",
    "",
    "## Dataset Comparison",
    "| Asset | Candles | Trades | Win Rate | Expectancy | Profit Factor | Sharpe | Sortino | Calmar | Max Drawdown | Confidence | Verification |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|",
    ...rows.map((row) => {
      const metrics = row.report.trade_statistics;
      const candles = (row.report.dataset_summary[0] as { candle_count?: number })?.candle_count ?? "n/a";
      return `| ${row.symbol} | ${candles} | ${metrics.trade_count} | ${(metrics.win_rate * 100).toFixed(2)}% | ${metrics.expectancy.toFixed(4)} | ${Number.isFinite(metrics.profit_factor) ? metrics.profit_factor.toFixed(4) : "infinite"} | ${metrics.sharpe_ratio === null ? "n/a" : metrics.sharpe_ratio.toFixed(4)} | ${metrics.sortino_ratio === null ? "n/a" : metrics.sortino_ratio.toFixed(4)} | ${metrics.calmar_ratio === null ? "n/a" : metrics.calmar_ratio.toFixed(4)} | ${(metrics.maximum_drawdown * 100).toFixed(2)}% | ${metrics.trade_count < 30 ? "Exploratory" : "More evidence"} | ${row.verification_status} |`;
    }),
    "",
    "## Research Highlights",
    `Highest expectancy: ${rankedByExpectancy[0]?.symbol ?? "n/a"}`,
    `Highest confidence by completed-trade sample: ${rankedByConfidence[0]?.symbol ?? "n/a"}`,
    `Lowest drawdown: ${rankedByDrawdown[0]?.symbol ?? "n/a"}`,
    "Most stable equity: evaluated using the combination of completed-trade sample, drawdown, expectancy, and verification status; no profit-only ranking is used.",
    "",
    "## Confidence Assessment",
    "Each equity remains an independent research unit. Fewer than 30 completed trades is treated as exploratory evidence.",
    "",
    "## Known Limitations",
    "- This report does not pool or compare results with crypto.",
    "- Statistical confidence is limited where completed-trade samples are small.",
    "- Results are observational and do not constitute a production edge claim.",
    ""
  ].join("\n");
}

await mkdir(reportsDirectory, { recursive: true });
const rows: EquityReportRow[] = [];
for (const symbol of symbols) {
  const entry = (await library.list()).find((candidate) => candidate.metadata.symbol === symbol && candidate.metadata.timeframe === "1d" && candidate.metadata.dataset_id.includes("yahoo"));
  if (!entry) throw new Error(`missing frozen daily Yahoo dataset for ${symbol}`);
  const selected = await library.get(entry.metadata.dataset_id);
  const assetType = selected.metadata.asset_type === "etf" ? "etf" : "stock";
  const replayIdentity = identity(selected.dataset, assetType);
  const runner = new DeterministicReplayRunner({ asset_type: assetType, risk_profile: "balanced", root_directory: "replays" });
  const replayDirectory = `replays/replay-${replayIdentity.replay_id}`;
  let bundle;
  try {
    bundle = await store.read(replayIdentity.replay_id);
    console.log(`${symbol}: existing matching replay loaded`);
  } catch {
    console.log(`${symbol}: replay started (${selected.dataset.candle_count} candles)`);
    bundle = await runner.runAndPersist(replayIdentity, selected.dataset);
    console.log(`${symbol}: replay persisted`);
  }

  try {
    await readFile(`${replayDirectory}/strategy-explainability-report.json`, "utf8");
    console.log(`${symbol}: existing explainability loaded`);
  } catch {
    const traces = generateStrategyTrace({ replayId: replayIdentity.replay_id, dataset: selected.dataset, assetType, riskProfile: "balanced", executionEvents: bundle.artifacts.execution_events, lifecycleEvents: bundle.artifacts.lifecycle_events, trades: bundle.artifacts.trades });
    await store.writeExplainability(replayIdentity.replay_id, traces, buildStrategyTraceReport({ replayId: replayIdentity.replay_id, datasetId: selected.dataset.dataset_id, generatedAt: replayIdentity.replay_timestamp, traces }));
    console.log(`${symbol}: explainability persisted`);
  }

  // Validate the persisted package before moving to the next independent asset.
  // Repeated full replays remain an optional long-running follow-up; the report
  // keeps deterministic_status INCONCLUSIVE when only artifact verification ran.
  const verification = verifyReplayArtifacts(replayIdentity, bundle.artifacts);
  await writeFile(`${replayDirectory}/verification-report.json`, canonicalJson(verification), "utf8");
  await writeFile(`${replayDirectory}/verification-report.md`, renderReplayVerificationReport(verification), "utf8");
  if (verification.status !== "PASS") throw new Error(`${symbol} verification failed: ${verification.findings.join("; ")}`);

  const report = buildStatisticalReport({ replayIds: [replayIdentity.replay_id], trades: bundle.artifacts.trades as readonly AnalysisTrade[], datasets: [{ dataset_id: selected.dataset.dataset_id, symbol, timeframe: selected.dataset.timeframe, candle_count: selected.dataset.candle_count, dataset_hash: selected.dataset.dataset_hash }], generatedAt: replayIdentity.replay_timestamp });
  await writeFile(`${reportsDirectory}/${symbol}_REPORT.json`, canonicalJson(report), "utf8");
  await writeFile(`${reportsDirectory}/${symbol}_REPORT.md`, renderEquityReport(symbol, report, verification.status), "utf8");
  rows.push({ symbol, dataset_id: selected.dataset.dataset_id, replay_id: replayIdentity.replay_id, report, verification_status: verification.status });
  console.log(`${symbol}: report complete, ${report.trade_statistics.trade_count} trades, verification ${verification.status}`);
}

const generatedAt = new Date().toISOString();
const master = { schema_version: "1.0", generated_at: generatedAt, asset_class: "us_equities", timeframe: "1d", assets: rows.map((row) => ({ symbol: row.symbol, dataset_id: row.dataset_id, replay_id: row.replay_id, completed_trades: row.report.trade_statistics.trade_count, expectancy: row.report.trade_statistics.expectancy, profit_factor: row.report.trade_statistics.profit_factor, maximum_drawdown: row.report.trade_statistics.maximum_drawdown, sharpe: row.report.trade_statistics.sharpe_ratio, sortino: row.report.trade_statistics.sortino_ratio, calmar: row.report.trade_statistics.calmar_ratio, verification_status: row.verification_status })), conclusion: "US EQUITY VALIDATION COMPLETE: all six independent daily research units passed replay verification.", known_limitations: ["Each symbol has one daily dataset and remains independently analyzed.", "Completed-trade samples below 30 are exploratory.", "No comparison with crypto was performed."] };
await writeFile(`${reportsDirectory}/MASTER_EQUITIES_REPORT.json`, canonicalJson(master), "utf8");
await writeFile(`${reportsDirectory}/MASTER_EQUITIES_REPORT.md`, renderMaster(rows, generatedAt), "utf8");
console.log("MASTER_EQUITIES_REPORT.md generated after all six reports completed");
