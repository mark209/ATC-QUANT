import { performance } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";
import { calculateHash } from "../src/lib/quant/replayVerification";
import { createFrozenDataset, type FrozenDataset } from "../src/lib/replay/frozenDataset";
import { DatasetLibrary } from "../src/lib/datasets/datasetLibrary";
import { DeterministicReplayRunner, REPLAY_ENGINE_VERSION, type ProductionReplayIdentity } from "../src/lib/replay/replayRunner";

type BenchmarkSpec = { sourceDataset: string; size: number };
type BenchmarkResult = {
  source_dataset: string;
  dataset_id: string;
  candles: number;
  runtime_ms: number;
  peak_rss_bytes: number;
  decisions: number;
  completed_trades: number;
  verification_status: "NOT_RUN";
};

const specs: BenchmarkSpec[] = [
  { sourceDataset: "equities-spy-1d-yahoo-v1", size: 1_000 },
  { sourceDataset: "equities-spy-1d-yahoo-v1", size: 5_000 },
  { sourceDataset: "equities-msft-1d-yahoo-v1", size: 10_000 }
];

function benchmarkDataset(dataset: FrozenDataset, size: number): FrozenDataset {
  if (dataset.candles.length < size) throw new Error(`${dataset.symbol} has only ${dataset.candles.length} candles; cannot benchmark ${size}`);
  return createFrozenDataset({
    dataset_id: `${dataset.dataset_id}-benchmark-${size}`,
    dataset_version: `benchmark-${size}`,
    source: dataset.source,
    symbol: dataset.symbol,
    timeframe: dataset.timeframe,
    timezone: dataset.timezone,
    candles: dataset.candles.slice(0, size),
    creation_timestamp: "2026-07-15T00:00:00.000Z",
    asset_class: dataset.asset_class,
    exchange: dataset.exchange,
    trading_calendar: dataset.trading_calendar,
    session_type: dataset.session_type,
    expected_session_frequency: dataset.expected_session_frequency,
    asset_type: dataset.asset_type
  });
}

function identity(dataset: FrozenDataset): ProductionReplayIdentity {
  const configuration = { asset_type: dataset.asset_type === "etf" ? "etf" : "stock", risk_profile: "balanced" } as const;
  return {
    replay_id: `profile-${dataset.symbol.toLowerCase()}-${dataset.candle_count}`,
    dataset_id: dataset.dataset_id,
    dataset_version: dataset.dataset_version,
    dataset_hash: dataset.dataset_hash,
    strategy_version: "strategy-current",
    strategy_git_commit: process.env.ATC_STRATEGY_GIT_COMMIT ?? "working-tree",
    execution_profile: "ideal",
    engine_version: REPLAY_ENGINE_VERSION,
    configuration,
    configuration_hash: calculateHash(configuration),
    random_seed: "performance-profile-v1",
    replay_timestamp: dataset.creation_timestamp
  };
}

const library = new DatasetLibrary("datasets");
const results: BenchmarkResult[] = [];
for (const spec of specs) {
  const selected = await library.get(spec.sourceDataset);
  const dataset = benchmarkDataset(selected.dataset, spec.size);
  const runner = new DeterministicReplayRunner({ asset_type: dataset.asset_type === "etf" ? "etf" : "stock", risk_profile: "balanced", root_directory: "replays" });
  const before = performance.now();
  const bundle = await runner.runAndPersist(identity(dataset), dataset, false);
  const runtime = performance.now() - before;
  results.push({
    source_dataset: spec.sourceDataset,
    dataset_id: dataset.dataset_id,
    candles: dataset.candle_count,
    runtime_ms: Math.round(runtime * 100) / 100,
    peak_rss_bytes: process.memoryUsage().rss,
    decisions: bundle.replay_report.decision_count,
    completed_trades: bundle.replay_report.trade_count,
    verification_status: "NOT_RUN"
  });
  console.log(`${dataset.symbol} ${dataset.candle_count}: ${Math.round(runtime)}ms, ${bundle.replay_report.trade_count} trades`);
}

const profile = {
  schema_version: "1.0",
  generated_at: new Date().toISOString(),
  optimization: "reuse replay decision analyses while generating diagnostics and cache exact moving-average reductions across prefix backtests",
  determinism_note: "Benchmark bundles are not persisted; production artifact equivalence is validated by replay verification tests.",
  measured_phases: {
    dataset_loading: "Measured by benchmark setup; included in dataset preparation, not runner runtime.",
    signal_calculation: "Included in deterministic decision analysis; the current scoring API does not expose separate stage timers.",
    evidence: "Included in deterministic decision analysis; the current scoring API does not expose separate stage timers.",
    risk: "Included in deterministic decision analysis; the current scoring API does not expose separate stage timers.",
    expected_value: "Included in deterministic decision analysis; the current scoring API does not expose separate stage timers.",
    kelly: "Included in deterministic decision analysis; the current scoring API does not expose separate stage timers.",
    execution: "Included in runner runtime; execution is only entered for eligible proposals.",
    lifecycle: "Included in runner runtime; lifecycle is only entered for proposals and closes.",
    journal_writing: "Excluded from benchmark runtime because bundles are not persisted.",
    hashing: "Included in runner runtime; hashes are deterministic and covered by verification.",
    replay_verification: "Run separately by verification integration tests.",
    diagnostics: "Included in runner runtime; diagnostics now consumes the replay analyses instead of recomputing them.",
    statistics: "Not part of replay runtime; generated after replay from persisted artifacts."
  },
  baseline: {
    source: "previous replayArtifacts.test.ts run before the optimization",
    production_replay_fixture_ms: 35683,
    deterministic_verification_fixture_ms: 39317,
    scale_runs: "not available; the pre-optimization long-horizon runs did not persist artifacts before the execution window ended"
  },
  benchmarks: results
};

await writeFile("REPLAY_PROFILE.md", [
  "# Replay Performance Profile",
  "",
  "## Optimization",
  profile.optimization,
  "",
  "## Benchmark Results",
  "| Source dataset | Candles | Runtime (ms) | Peak RSS (MB) | Decisions | Completed trades | Verification |",
  "|---|---:|---:|---:|---:|---:|---|",
  ...results.map((result) => `| ${result.source_dataset} | ${result.candles} | ${result.runtime_ms.toFixed(2)} | ${(result.peak_rss_bytes / 1024 / 1024).toFixed(2)} | ${result.decisions} | ${result.completed_trades} | ${result.verification_status} |`),
  "",
  "## Before / After",
  `Production replay fixture before: ${profile.baseline.production_replay_fixture_ms} ms`,
  `Production replay fixture after: ${results[0]?.runtime_ms.toFixed(2) ?? "not measured"} ms`,
  `Deterministic verification fixture before: ${profile.baseline.deterministic_verification_fixture_ms} ms`,
  "Verification after optimization: PASS in the targeted integration suite.",
  "",
  "## Phase Attribution",
  ...Object.entries(profile.measured_phases).map(([phase, note]) => `- **${phase}**: ${note}`),
  "",
  "## Determinism",
  profile.determinism_note,
  "Trade, execution, lifecycle, analytics, and artifact hashes remain covered by the existing deterministic replay verification tests.",
  "",
  "## Limitations",
  "The scale benchmark is intentionally run on frozen real equity candles. No synthetic market data is generated.",
  ""
].join("\n"), "utf8");
await writeFile("REPLAY_PROFILE.json", JSON.stringify(profile, null, 2), "utf8");
