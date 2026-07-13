import { calculateHash } from "../src/lib/quant/replayVerification";
import { FrozenDatasetStore } from "../src/lib/replay/frozenDataset";
import { DeterministicReplayRunner, REPLAY_ENGINE_VERSION, type ProductionReplayIdentity } from "../src/lib/replay/replayRunner";
import { RESEARCH_DATASET_SPECS } from "./generateReplayDatasetMatrix";

for (const spec of RESEARCH_DATASET_SPECS) {
  const dataset = await new FrozenDatasetStore(`data/frozen/${spec.dataset_id}.json`).read();
  const configuration = { asset_type: spec.symbol.includes("BTC") || spec.symbol.includes("ETH") ? "crypto" as const : "stock" as const, risk_profile: "balanced" as const };
  const identity: ProductionReplayIdentity = {
    replay_id: `matrix-${spec.dataset_id}`,
    dataset_id: dataset.dataset_id,
    dataset_version: dataset.dataset_version,
    dataset_hash: dataset.dataset_hash,
    strategy_version: "strategy-current",
    strategy_git_commit: process.env.ATC_STRATEGY_GIT_COMMIT ?? "working-tree",
    execution_profile: "ideal",
    engine_version: REPLAY_ENGINE_VERSION,
    configuration,
    configuration_hash: calculateHash(configuration),
    random_seed: `matrix-${spec.seed}`,
    replay_timestamp: dataset.creation_timestamp
  };
  const bundle = await new DeterministicReplayRunner({ asset_type: configuration.asset_type, risk_profile: configuration.risk_profile, root_directory: "replays" }).runAndPersist(identity, dataset);
  console.log(`${spec.dataset_id}: candles=${dataset.candle_count} decisions=${bundle.replay_report.decision_count} proposals=${bundle.diagnostics?.funnel.tradeProposals ?? 0} completed=${bundle.replay_report.trade_count}`);
}
