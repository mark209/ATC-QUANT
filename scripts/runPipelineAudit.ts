import { mkdir, writeFile } from "node:fs/promises";
import { calculateHash, createReplayVerificationReport, renderReplayVerificationReport } from "../src/lib/quant/replayVerification";
import { DatasetLibrary } from "../src/lib/datasets/datasetLibrary";
import { ReplayArtifactStore } from "../src/lib/replay/replayArtifacts";
import { DeterministicReplayRunner, REPLAY_ENGINE_VERSION, type ProductionReplayIdentity } from "../src/lib/replay/replayRunner";
import { buildStrategyTraceReport, generateStrategyTrace } from "../src/lib/replay/strategyTrace";
import { buildPipelineAudit, buildPipelineMaster, renderPipelineAudit, renderPipelineMaster } from "../src/lib/analysis/pipelineAudit";
import { canonicalJson } from "../src/lib/trading/tradeJournal";

const library = new DatasetLibrary("datasets");
const entries = (await library.list()).filter((entry) => entry.metadata.asset_type === "crypto" && entry.metadata.timeframe === "1d" && entry.metadata.dataset_id.includes("crypto-long-horizon"));
if (!entries.length) throw new Error("no long-horizon crypto datasets are frozen");
const store = new ReplayArtifactStore("replays");
const reports = [];
for (const entry of entries) {
  const selected = await library.get(entry.metadata.dataset_id);
  const configuration = { asset_type: "crypto" as const, risk_profile: "balanced" as const };
  const replayId = `crypto-audit-${selected.metadata.symbol.toLowerCase()}-${selected.metadata.dataset_version}`;
  const identity: ProductionReplayIdentity = { replay_id: replayId, dataset_id: selected.dataset.dataset_id, dataset_version: selected.dataset.dataset_version, dataset_hash: selected.dataset.dataset_hash, strategy_version: "strategy-current", strategy_git_commit: process.env.ATC_STRATEGY_GIT_COMMIT ?? "working-tree", execution_profile: "ideal", engine_version: REPLAY_ENGINE_VERSION, configuration, configuration_hash: calculateHash(configuration), random_seed: "crypto-pipeline-audit-1.2A", replay_timestamp: selected.dataset.creation_timestamp };
  const runner = new DeterministicReplayRunner({ ...configuration, root_directory: "replays" });
  const bundle = await runner.runAndPersist(identity, selected.dataset);
  const traces = generateStrategyTrace({ replayId, dataset: selected.dataset, assetType: "crypto", riskProfile: "balanced", executionEvents: bundle.artifacts.execution_events, lifecycleEvents: bundle.artifacts.lifecycle_events, trades: bundle.artifacts.trades });
  await store.writeExplainability(replayId, traces, buildStrategyTraceReport({ replayId, datasetId: selected.dataset.dataset_id, generatedAt: identity.replay_timestamp, traces }));
  const verification = await createReplayVerificationReport({ identity, dataset: selected.dataset, runner, repetitions: 2 });
  const directory = `replays/replay-${replayId}`;
  await writeFile(`${directory}/verification-report.json`, canonicalJson(verification), "utf8");
  await writeFile(`${directory}/verification-report.md`, renderReplayVerificationReport(verification), "utf8");
  const report = buildPipelineAudit({ replayId, generatedAt: identity.replay_timestamp, dataset: selected.dataset, traces, executions: bundle.artifacts.execution_events, lifecycle: bundle.artifacts.lifecycle_events, trades: bundle.artifacts.trades, verification });
  await writeFile(`${directory}/pipeline-audit.json`, canonicalJson(report), "utf8");
  await writeFile(`${directory}/pipeline-audit.md`, renderPipelineAudit(report), "utf8");
  reports.push(report);
  console.log(`${selected.metadata.symbol}: ${report.funnel.total_candles} candles, ${report.funnel.completed_trades} completed trades, verification ${verification.status}`);
}
const master = buildPipelineMaster({ generatedAt: new Date().toISOString(), reports });
await mkdir("reports/pipeline-audit", { recursive: true });
await writeFile("reports/pipeline-audit/MASTER_PIPELINE_AUDIT.json", canonicalJson(master), "utf8");
await writeFile("reports/pipeline-audit/MASTER_PIPELINE_AUDIT.md", renderPipelineMaster(master), "utf8");
for (const report of reports) {
  await writeFile(`reports/pipeline-audit/${report.symbol}_PIPELINE_AUDIT.json`, canonicalJson(report), "utf8");
  await writeFile(`reports/pipeline-audit/${report.symbol}_PIPELINE_AUDIT.md`, renderPipelineAudit(report), "utf8");
}
console.log("Master pipeline audit: reports/pipeline-audit/MASTER_PIPELINE_AUDIT.md");
