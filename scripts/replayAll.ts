import { calculateHash } from "../src/lib/quant/replayVerification";
import { DatasetLibrary } from "../src/lib/datasets/datasetLibrary";
import { DeterministicReplayRunner, REPLAY_ENGINE_VERSION, type ProductionReplayIdentity } from "../src/lib/replay/replayRunner";
import { ReplayArtifactStore } from "../src/lib/replay/replayArtifacts";
import { buildStrategyTraceReport, generateStrategyTrace } from "../src/lib/replay/strategyTrace";

const library = new DatasetLibrary("datasets");
const store = new ReplayArtifactStore("replays");
const entries = await library.list();
if (entries.length === 0) { console.log("No validated historical datasets available; supply real provider exports before replay-all."); process.exit(0); }
for (const entry of entries) {
  const selected = await library.get(entry.metadata.dataset_id);
  const configuration = { asset_type: selected.metadata.asset_type, risk_profile: "balanced" as const };
  const replayId = `institutional-${selected.metadata.dataset_id}-${selected.metadata.dataset_version}`;
  const identity: ProductionReplayIdentity = { replay_id: replayId, dataset_id: selected.dataset.dataset_id, dataset_version: selected.dataset.dataset_version, dataset_hash: selected.dataset.dataset_hash, strategy_version: "strategy-current", strategy_git_commit: process.env.ATC_STRATEGY_GIT_COMMIT ?? "working-tree", execution_profile: "ideal", engine_version: REPLAY_ENGINE_VERSION, configuration, configuration_hash: calculateHash(configuration), random_seed: "phase4-seed-v1", replay_timestamp: selected.dataset.creation_timestamp };
  let bundle;
  try { bundle = await store.read(replayId); }
  catch { bundle = await new DeterministicReplayRunner({ ...configuration, root_directory: "replays" }).runAndPersist(identity, selected.dataset); }
  const traces = generateStrategyTrace({ replayId, dataset: selected.dataset, assetType: configuration.asset_type, riskProfile: configuration.risk_profile, executionEvents: bundle.artifacts.execution_events, lifecycleEvents: bundle.artifacts.lifecycle_events, trades: bundle.artifacts.trades });
  await store.writeExplainability(replayId, traces, buildStrategyTraceReport({ replayId, datasetId: selected.dataset.dataset_id, generatedAt: identity.replay_timestamp, traces }));
  console.log(`${selected.metadata.dataset_id}: ${bundle.replay_report.decision_count} decisions, ${bundle.replay_report.trade_count} completed trades`);
}
