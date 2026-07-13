import { calculateHash } from "../src/lib/quant/replayVerification";
import { FrozenDatasetStore } from "../src/lib/replay/frozenDataset";
import { createBundledResearchDataset } from "../src/lib/replay/sampleDataset";
import { ReplayArtifactStore } from "../src/lib/replay/replayArtifacts";
import { DeterministicReplayRunner, REPLAY_ENGINE_VERSION, type ProductionReplayIdentity } from "../src/lib/replay/replayRunner";
import { DatasetLibrary } from "../src/lib/datasets/datasetLibrary";

const requestedDataset = process.argv.find((argument) => argument.startsWith("--dataset="))?.slice("--dataset=".length) ?? process.env.npm_config_dataset;
let dataset;
let configuration: { asset_type: "crypto" | "stock" | "etf" | "index"; risk_profile: "conservative" | "balanced" | "aggressive" };
let replayId: string;
if (requestedDataset) {
  const selected = await new DatasetLibrary("datasets").get(requestedDataset);
  dataset = selected.dataset;
  configuration = { asset_type: selected.metadata.asset_type, risk_profile: "balanced" };
  replayId = `institutional-${selected.metadata.dataset_id}-${selected.metadata.dataset_version}`;
} else {
  const datasetPath = "data/frozen/atc-bundled-research-fixture.json";
  const datasetStore = new FrozenDatasetStore(datasetPath);
  try { dataset = await datasetStore.read(); }
  catch { dataset = createBundledResearchDataset(); await datasetStore.write(dataset); }
  configuration = { asset_type: "stock", risk_profile: "balanced" };
  replayId = "phase3-bundled-replay-v1";
}
const identity: ProductionReplayIdentity = {
  replay_id: replayId,
  dataset_id: dataset.dataset_id,
  dataset_version: dataset.dataset_version,
  dataset_hash: dataset.dataset_hash,
  strategy_version: "strategy-current",
  strategy_git_commit: process.env.ATC_STRATEGY_GIT_COMMIT ?? "working-tree",
  execution_profile: "ideal",
  engine_version: REPLAY_ENGINE_VERSION,
  configuration,
  configuration_hash: calculateHash(configuration),
  random_seed: "phase3-seed-v1",
  replay_timestamp: dataset.creation_timestamp
};

let bundle;
try { bundle = await new ReplayArtifactStore("replays").read(identity.replay_id); }
  catch { bundle = await new DeterministicReplayRunner({ asset_type: configuration.asset_type, risk_profile: configuration.risk_profile, root_directory: "replays" }).runAndPersist(identity, dataset); }
console.log("ATC REPLAY");
console.log(`Replay ID: ${bundle.replay_manifest.replay_id}`);
console.log(`Dataset hash: ${bundle.replay_manifest.dataset_hash}`);
console.log(`Decisions: ${bundle.replay_report.decision_count}`);
console.log(`Completed trades: ${bundle.replay_report.trade_count}`);
console.log(`Artifacts: replays/replay-${bundle.replay_manifest.replay_id}`);
