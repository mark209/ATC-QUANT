import { calculateHash } from "../src/lib/quant/replayVerification";
import { FrozenDatasetStore } from "../src/lib/replay/frozenDataset";
import { createBundledResearchDataset } from "../src/lib/replay/sampleDataset";
import { ReplayArtifactStore } from "../src/lib/replay/replayArtifacts";
import { DeterministicReplayRunner, REPLAY_ENGINE_VERSION, type ProductionReplayIdentity } from "../src/lib/replay/replayRunner";

const datasetPath = "data/frozen/atc-bundled-research-fixture.json";
const datasetStore = new FrozenDatasetStore(datasetPath);
let dataset;
try { dataset = await datasetStore.read(); }
catch { dataset = createBundledResearchDataset(); await datasetStore.write(dataset); }

const configuration = { asset_type: "stock", risk_profile: "balanced" };
const identity: ProductionReplayIdentity = {
  replay_id: "phase3-bundled-replay-v1",
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
catch { bundle = await new DeterministicReplayRunner({ asset_type: "stock", risk_profile: "balanced", root_directory: "replays" }).runAndPersist(identity, dataset); }
console.log("ATC REPLAY");
console.log(`Replay ID: ${bundle.replay_manifest.replay_id}`);
console.log(`Dataset hash: ${bundle.replay_manifest.dataset_hash}`);
console.log(`Decisions: ${bundle.replay_report.decision_count}`);
console.log(`Completed trades: ${bundle.replay_report.trade_count}`);
console.log(`Artifacts: replays/replay-${bundle.replay_manifest.replay_id}`);
