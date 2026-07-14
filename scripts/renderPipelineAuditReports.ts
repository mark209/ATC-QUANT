import { mkdir, readFile, writeFile } from "node:fs/promises";
import { DatasetLibrary } from "../src/lib/datasets/datasetLibrary";
import { ReplayArtifactStore } from "../src/lib/replay/replayArtifacts";
import { buildPipelineAudit, buildPipelineMaster, renderPipelineAudit, renderPipelineMaster } from "../src/lib/analysis/pipelineAudit";
import { canonicalJson } from "../src/lib/trading/tradeJournal";

const library = new DatasetLibrary("datasets");
const store = new ReplayArtifactStore("replays");
const entries = (await library.list()).filter((entry) => entry.metadata.asset_type === "crypto" && entry.metadata.timeframe === "1d" && entry.metadata.dataset_id.includes("crypto-long-horizon"));
const reports = [];
for (const entry of entries) {
  const selected = await library.get(entry.metadata.dataset_id);
  const replayId = `crypto-audit-${selected.metadata.symbol.toLowerCase()}-${selected.metadata.dataset_version}`;
  const bundle = await store.read(replayId);
  const traces = bundle.strategy_trace ?? [];
  const verification = JSON.parse(await readFile(`replays/replay-${replayId}/verification-report.json`, "utf8"));
  const report = buildPipelineAudit({ replayId, generatedAt: bundle.replay_manifest.replay_timestamp, dataset: selected.dataset, traces, executions: bundle.artifacts.execution_events, lifecycle: bundle.artifacts.lifecycle_events, trades: bundle.artifacts.trades, verification });
  await writeFile(`replays/replay-${replayId}/pipeline-audit.json`, canonicalJson(report), "utf8");
  await writeFile(`replays/replay-${replayId}/pipeline-audit.md`, renderPipelineAudit(report), "utf8");
  await mkdir("reports/pipeline-audit", { recursive: true });
  await writeFile(`reports/pipeline-audit/${report.symbol}_PIPELINE_AUDIT.json`, canonicalJson(report), "utf8");
  await writeFile(`reports/pipeline-audit/${report.symbol}_PIPELINE_AUDIT.md`, renderPipelineAudit(report), "utf8");
  reports.push(report);
}
const master = buildPipelineMaster({ generatedAt: new Date().toISOString(), reports });
await writeFile("reports/pipeline-audit/MASTER_PIPELINE_AUDIT.json", canonicalJson(master), "utf8");
await writeFile("reports/pipeline-audit/MASTER_PIPELINE_AUDIT.md", renderPipelineMaster(master), "utf8");
console.log("Pipeline audit reports regenerated from corrected replay artifacts.");
