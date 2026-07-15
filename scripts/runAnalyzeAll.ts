import { mkdir, readdir, writeFile } from "node:fs/promises";
import { ReplayArtifactStore } from "../src/lib/replay/replayArtifacts";
import { buildStatisticalReport, renderStatisticalReport, type AnalysisTrade } from "../src/lib/analysis/statisticalAnalysis";
import { canonicalJson } from "../src/lib/trading/tradeJournal";

const entries = await readdir("replays", { withFileTypes: true });
const replayIds = entries.filter((entry) => entry.isDirectory() && entry.name.startsWith("replay-")).map((entry) => entry.name.slice("replay-".length)).sort();
if (!replayIds.length) throw new Error("no replay artifacts exist");
const store = new ReplayArtifactStore("replays");
const bundles = await Promise.all(replayIds.map((replayId) => store.read(replayId)));
const trades = bundles.flatMap((bundle) => bundle.artifacts.trades as readonly AnalysisTrade[]);
const report = buildStatisticalReport({ replayIds, trades, datasets: bundles.map((bundle) => ({ dataset_id: bundle.dataset.dataset_id, symbol: bundle.dataset.symbol, timeframe: bundle.dataset.timeframe, candle_count: bundle.dataset.candle_count, dataset_hash: bundle.dataset.dataset_hash })), generatedAt: bundles.map((bundle) => bundle.replay_manifest.replay_timestamp).sort().at(-1) });
await mkdir("reports", { recursive: true });
await writeFile("reports/master-statistical-research-report.json", canonicalJson(report), "utf8");
await writeFile("reports/master-statistical-research-report.md", renderStatisticalReport(report), "utf8");
console.log("MASTER STATISTICAL RESEARCH REPORT");
console.log(report.executive_summary);
console.log(`Conclusion: ${report.conclusion}`);
console.log("Report: reports/master-statistical-research-report.md");
