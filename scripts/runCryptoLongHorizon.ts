import { mkdir, readFile, writeFile } from "node:fs/promises";
import { calculateHash, createReplayVerificationReport, renderReplayVerificationReport } from "../src/lib/quant/replayVerification";
import { DatasetLibrary } from "../src/lib/datasets/datasetLibrary";
import { ReplayArtifactStore } from "../src/lib/replay/replayArtifacts";
import { DeterministicReplayRunner, REPLAY_ENGINE_VERSION, type ProductionReplayIdentity } from "../src/lib/replay/replayRunner";
import { buildStrategyTraceReport, generateStrategyTrace } from "../src/lib/replay/strategyTrace";
import { buildStatisticalReport, renderStatisticalReport, type AnalysisTrade } from "../src/lib/analysis/statisticalAnalysis";
import { buildLongHorizonDetails, buildLongHorizonMaster, renderLongHorizonAssetReport, renderLongHorizonMasterReport, type LongHorizonAssetReport } from "../src/lib/analysis/longHorizon";
import { canonicalJson } from "../src/lib/trading/tradeJournal";

const library = new DatasetLibrary("datasets");
const entries = (await library.list()).filter((entry) => entry.metadata.asset_type === "crypto" && entry.metadata.timeframe === "1d" && entry.metadata.dataset_id.includes("crypto-long-horizon"));
if (!entries.length) throw new Error("no long-horizon crypto datasets are frozen");
const store = new ReplayArtifactStore("replays");
const rows: Array<{ symbol: string; dataset_id: string; replay_id: string; report: LongHorizonAssetReport }> = [];
for (const entry of entries) {
  const selected = await library.get(entry.metadata.dataset_id);
  const configuration = { asset_type: "crypto" as const, risk_profile: "balanced" as const };
  const replayId = `crypto-long-${selected.metadata.symbol.toLowerCase()}-${selected.metadata.dataset_version}`;
  const identity: ProductionReplayIdentity = { replay_id: replayId, dataset_id: selected.dataset.dataset_id, dataset_version: selected.dataset.dataset_version, dataset_hash: selected.dataset.dataset_hash, strategy_version: "strategy-current", strategy_git_commit: process.env.ATC_STRATEGY_GIT_COMMIT ?? "working-tree", execution_profile: "ideal", engine_version: REPLAY_ENGINE_VERSION, configuration, configuration_hash: calculateHash(configuration), random_seed: "crypto-long-horizon-1.2", replay_timestamp: selected.dataset.creation_timestamp };
  let bundle;
  try { bundle = await store.read(replayId); }
  catch { bundle = await new DeterministicReplayRunner({ ...configuration, root_directory: "replays" }).runAndPersist(identity, selected.dataset); }
  const traces = generateStrategyTrace({ replayId, dataset: selected.dataset, assetType: "crypto", riskProfile: "balanced", executionEvents: bundle.artifacts.execution_events, lifecycleEvents: bundle.artifacts.lifecycle_events, trades: bundle.artifacts.trades });
  await store.writeExplainability(replayId, traces, buildStrategyTraceReport({ replayId, datasetId: selected.dataset.dataset_id, generatedAt: identity.replay_timestamp, traces }));
  const replayDirectory = `replays/replay-${replayId}`;
  let verification;
  try { verification = JSON.parse(await readFile(`${replayDirectory}/verification-report.json`, "utf8")); }
  catch { verification = await createReplayVerificationReport({ identity, dataset: selected.dataset, runner: new DeterministicReplayRunner({ ...configuration, root_directory: "replays" }), repetitions: 2 }); }
  await writeFile(`${replayDirectory}/verification-report.json`, canonicalJson(verification), "utf8");
  await writeFile(`${replayDirectory}/verification-report.md`, renderReplayVerificationReport(verification), "utf8");
  const base = buildStatisticalReport({ replayIds: [replayId], trades: bundle.artifacts.trades as readonly AnalysisTrade[], datasets: [{ dataset_id: selected.dataset.dataset_id, symbol: selected.dataset.symbol, timeframe: selected.dataset.timeframe, candle_count: selected.dataset.candle_count, dataset_hash: selected.dataset.dataset_hash }], generatedAt: identity.replay_timestamp });
  const details = buildLongHorizonDetails(selected.dataset, bundle.artifacts.trades as readonly AnalysisTrade[]);
  const report: LongHorizonAssetReport = { base, long_horizon: details, verification_status: verification.status };
  await mkdir("reports/crypto-long-horizon", { recursive: true });
  await writeFile(`reports/crypto-long-horizon/${selected.metadata.symbol}_LONG_HORIZON_REPORT.json`, canonicalJson(report), "utf8");
  await writeFile(`reports/crypto-long-horizon/${selected.metadata.symbol}_LONG_HORIZON_REPORT.md`, renderLongHorizonAssetReport(report), "utf8");
  rows.push({ symbol: selected.metadata.symbol, dataset_id: selected.metadata.dataset_id, replay_id: replayId, report });
  console.log(`${selected.metadata.symbol}: ${base.trade_statistics.trade_count} trades, verification ${verification.status}`);
}
const master = buildLongHorizonMaster({ generatedAt: entries.map((entry) => entry.metadata.creation_timestamp).sort().at(-1) ?? new Date().toISOString(), rows });
await mkdir("reports/crypto-long-horizon", { recursive: true });
await writeFile("reports/crypto-long-horizon/MASTER_CRYPTO_LONG_HORIZON_REPORT.json", canonicalJson(master), "utf8");
await writeFile("reports/crypto-long-horizon/MASTER_CRYPTO_LONG_HORIZON_REPORT.md", renderLongHorizonMasterReport(master), "utf8");
console.log("Master long-horizon report: reports/crypto-long-horizon/MASTER_CRYPTO_LONG_HORIZON_REPORT.md");
