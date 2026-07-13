import { mkdir, writeFile } from "node:fs/promises";
import { DatasetLibrary } from "../src/lib/datasets/datasetLibrary";
import { ReplayArtifactStore } from "../src/lib/replay/replayArtifacts";
import { canonicalJson } from "../src/lib/trading/tradeJournal";

const library = new DatasetLibrary("datasets");
const store = new ReplayArtifactStore("replays");
const datasets = await library.list();
const rows = [];
for (const entry of datasets) {
  const dataset = await library.get(entry.metadata.dataset_id);
  const replayId = `institutional-${entry.metadata.dataset_id}-${entry.metadata.dataset_version}`;
  const bundle = await store.read(replayId);
  rows.push({ dataset: entry.metadata, candles: dataset.metadata.candle_count, warmup: bundle.diagnostics ? Math.min(60, dataset.metadata.candle_count) : null, signals: bundle.diagnostics?.funnel.technicalSignals ?? null, evidence: bundle.diagnostics?.funnel.evidenceQualifiedSignals ?? null, risk: bundle.diagnostics?.funnel.riskApprovedSignals ?? null, ev: bundle.diagnostics?.funnel.expectedValueEvaluations ?? null, kelly: bundle.diagnostics?.funnel.kellyEvaluations ?? null, proposals: bundle.diagnostics?.funnel.tradeProposals ?? null, executions: bundle.diagnostics?.funnel.tradeExecutions ?? null, completed_trades: bundle.replay_report.trade_count, diagnostics: bundle.diagnostics?.most_restrictive_filters ?? null });
}
const report = { generated_at: new Date().toISOString(), dataset_count: rows.length, datasets: rows, note: rows.length === 0 ? "No real historical datasets have been imported. Statistical edge validation remains blocked until provider-supplied data is frozen and replayed." : "This report is observational and does not change strategy behavior." };
await mkdir("reports", { recursive: true });
await writeFile("reports/master-research-report.json", canonicalJson(report), "utf8");
await writeFile("reports/master-research-report.md", `# Historical Research Report\n\nDatasets: ${rows.length}\n\n${rows.map((row) => `- ${row.dataset.dataset_id}: ${row.candles} candles, ${row.completed_trades} completed trades`).join("\n") || report.note}\n`, "utf8");
console.log(report.note);
console.log(`Research report: reports/master-research-report.md`);
