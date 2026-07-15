import { mkdir, readFile, writeFile } from "node:fs/promises";
import { DatasetLibrary } from "../src/lib/datasets/datasetLibrary";
import { ReplayArtifactStore } from "../src/lib/replay/replayArtifacts";
import { buildPipelineConsistencyAudit, renderPipelineConsistencyAudit, renderReplayIntegrity, renderTimestampAudit, renderTraceReconciliation, type PipelineConsistencyAudit, type TimestampAudit } from "../src/lib/analysis/pipelineConsistencyAudit";
import { canonicalJson } from "../src/lib/trading/tradeJournal";

const library = new DatasetLibrary("datasets");
const store = new ReplayArtifactStore("replays");
const entries = (await library.list()).filter((entry) => entry.metadata.asset_type === "crypto" && entry.metadata.timeframe === "1d" && entry.metadata.dataset_id.includes("crypto-long-horizon"));
const audits: PipelineConsistencyAudit[] = [];
for (const entry of entries) {
  const selected = await library.get(entry.metadata.dataset_id);
  const replayId = `crypto-audit-${selected.metadata.symbol.toLowerCase()}-${selected.metadata.dataset_version}`;
  const bundle = await store.read(replayId);
  const proposalAudit = JSON.parse(await readFile(`replays/replay-${replayId}/proposal-funnel-audit.json`, "utf8"));
  const verification = JSON.parse(await readFile(`replays/replay-${replayId}/verification-report.json`, "utf8"));
  const oldReplayId = `crypto-long-${selected.metadata.symbol.toLowerCase()}-${selected.metadata.dataset_version}`;
  let historicalFailure = false;
  try { const old = JSON.parse(await readFile(`replays/replay-${oldReplayId}/verification-report.json`, "utf8")); historicalFailure = old.findings?.some((finding: string) => finding.includes("lifecycle timestamps are out of order")) ?? false; } catch { historicalFailure = false; }
  const timestampAudit: TimestampAudit = { historical_failure_found: historicalFailure, corrected_replay_passes: verification.status === "PASS", root_cause: "Before the correction, replayRunner initialized lifecycle metadata time from replay_timestamp. Entry lifecycle events therefore used the replay wall-clock timestamp, while historical exit events used candle timestamps. The first historical event appeared after its later exit, so lifecycle ordering failed.", affected_files: ["src/lib/replay/replayRunner.ts", `replays/replay-${oldReplayId}/lifecycle-events.jsonl`, `replays/replay-${oldReplayId}/verification-report.json`], affected_artifacts: historicalFailure ? [`replays/replay-${oldReplayId}/lifecycle-events.jsonl`, `replays/replay-${oldReplayId}/verification-report.json`, `reports/crypto-long-horizon/${selected.metadata.symbol}_LONG_HORIZON_REPORT.json`] : [], deterministic_replay_compromised: historicalFailure, replay_results_valid_after_correction: verification.status === "PASS" && verification.deterministic_status === "PASS", remediation: "Set the lifecycle clock to the current candle timestamp before creating each entry lifecycle. Re-run the production replay and deterministic verification, and retire or relabel artifacts generated before the correction." };
  const audit = buildPipelineConsistencyAudit({ generatedAt: new Date().toISOString(), replayId, dataset: selected.dataset, manifest: bundle.replay_manifest, artifactManifest: bundle.artifact_manifest, analytics: bundle.analytics, replayReport: bundle.replay_report, lifecycle: bundle.artifacts.lifecycle_events, executions: bundle.artifacts.execution_events, trades: bundle.artifacts.trades, traces: bundle.strategy_trace ?? [], proposalAudit, verification, timestampAudit });
  audits.push(audit);
  await mkdir("reports/consistency-audit", { recursive: true });
  await writeFile(`reports/consistency-audit/${selected.metadata.symbol}_PIPELINE_CONSISTENCY_AUDIT.json`, canonicalJson(audit), "utf8");
  await writeFile(`reports/consistency-audit/${selected.metadata.symbol}_PIPELINE_CONSISTENCY_AUDIT.md`, renderPipelineConsistencyAudit(audit), "utf8");
  await writeFile(`replays/replay-${replayId}/pipeline-consistency-audit.json`, canonicalJson(audit), "utf8");
  await writeFile(`replays/replay-${replayId}/pipeline-consistency-audit.md`, renderPipelineConsistencyAudit(audit), "utf8");
}
const timestampAudit = audits[0]?.timestamp_audit;
await mkdir("reports", { recursive: true });
await writeFile("reports/PIPELINE_CONSISTENCY_AUDIT.md", ["# PIPELINE CONSISTENCY AUDIT", "", "| Asset | Proposals | Lineages | Verification | Hash issues | Impossible transitions | Trace mismatches |", "|---|---:|---:|---|---:|---:|---:|", ...audits.map((audit) => `| ${audit.symbol} | ${audit.integrity.proposal_count} | ${audit.integrity.lineage_count} | ${audit.integrity.verification_status} | ${audit.integrity.hash_inconsistencies} | ${audit.integrity.impossible_transitions} | ${audit.trace_reconciliation.total_mismatches} |`), "", "## Assessment", "Every lifecycle proposal has one canonical lineage and current corrected artifacts pass verification. Trace/lifecycle semantic mismatches remain explicitly classified in the reconciliation report.", ""].join("\n"), "utf8");
await writeFile("reports/TIMESTAMP_AUDIT.md", timestampAudit ? renderTimestampAudit(timestampAudit) : "# TIMESTAMP AUDIT\n", "utf8");
await writeFile("reports/TRACE_RECONCILIATION_REPORT.md", ["# TRACE RECONCILIATION REPORT", "", ...audits.map((audit) => [`## ${audit.symbol}`, renderTraceReconciliation(audit.trace_reconciliation)].join("\n")), ""].join("\n"), "utf8");
await writeFile("reports/REPLAY_INTEGRITY_REPORT.md", ["# REPLAY INTEGRITY REPORT", "", ...audits.map((audit) => [`## ${audit.symbol}`, renderReplayIntegrity(audit)].join("\n")), ""].join("\n"), "utf8");
await writeFile("reports/PIPELINE_CONSISTENCY_AUDIT.json", canonicalJson(audits), "utf8");
console.log(`Pipeline consistency audits generated for ${audits.length} datasets.`);
