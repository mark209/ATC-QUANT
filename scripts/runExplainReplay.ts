import { ReplayArtifactStore } from "../src/lib/replay/replayArtifacts";
import { buildStrategyTraceReport, generateStrategyTrace, renderStrategyTraceReport } from "../src/lib/replay/strategyTrace";

const store = new ReplayArtifactStore("replays");
const bundle = await store.latest();
const configuration = bundle.replay_manifest.configuration as { asset_type: "crypto" | "stock" | "etf" | "index"; risk_profile: "conservative" | "balanced" | "aggressive" };
const traces = generateStrategyTrace({ replayId: bundle.replay_manifest.replay_id, dataset: bundle.dataset, assetType: configuration.asset_type, riskProfile: configuration.risk_profile, executionEvents: bundle.artifacts.execution_events, lifecycleEvents: bundle.artifacts.lifecycle_events, trades: bundle.artifacts.trades });
const report = buildStrategyTraceReport({ replayId: bundle.replay_manifest.replay_id, datasetId: bundle.dataset.dataset_id, generatedAt: new Date().toISOString(), traces });
await store.writeExplainability(bundle.replay_manifest.replay_id, traces, report);
console.log([`Replay: ${report.replay_id}`, `Dataset: ${report.dataset_id}`, `Processed candles: ${report.processed_candles}`, `Warm-up exclusions: ${report.warmup_exclusions}`, `Signals rejected: ${report.counts["signal rejected"]}`, `Evidence rejected: ${report.counts["evidence rejected"]}`, `Risk rejected: ${report.counts["risk rejected"]}`, `EV rejected: ${report.counts["EV rejected"]}`, `Kelly rejected: ${report.counts["Kelly rejected"]}`, `Proposals: ${report.counts["proposal created"]}`, `Executions: ${report.counts.execution}`, `Completed trades: ${report.counts["completed trade"]}`, `Most restrictive rule: ${report.hotspots.most_restrictive_rule}`].join("\n"));
console.log(`Report: replays/replay-${report.replay_id}/strategy-explainability-report.md`);
