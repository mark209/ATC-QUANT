import { mkdir, readdir, writeFile } from "node:fs/promises";
import { ReplayArtifactStore } from "../src/lib/replay/replayArtifacts";
import { buildStatisticalReport, renderStatisticalReport, type AnalysisTrade } from "../src/lib/analysis/statisticalAnalysis";
import { canonicalJson } from "../src/lib/trading/tradeJournal";

const store = new ReplayArtifactStore("replays");
const replayIds = (await readdir("replays", { withFileTypes: true })).filter((entry) => entry.isDirectory() && entry.name.startsWith("replay-")).map((entry) => entry.name.slice("replay-".length));
if (!replayIds.length) throw new Error("no replay artifacts exist");
const bundles = await Promise.all(replayIds.map((replayId) => store.read(replayId)));
const bundle = bundles.sort((left, right) => Date.parse(right.replay_manifest.replay_timestamp) - Date.parse(left.replay_manifest.replay_timestamp))[0];
const trades = bundle.artifacts.trades as readonly AnalysisTrade[];
const report = buildStatisticalReport({ replayIds: [bundle.replay_manifest.replay_id], trades, datasets: [{ dataset_id: bundle.dataset.dataset_id, symbol: bundle.dataset.symbol, timeframe: bundle.dataset.timeframe, candle_count: bundle.dataset.candle_count, dataset_hash: bundle.dataset.dataset_hash }], generatedAt: bundle.replay_manifest.replay_timestamp });
await mkdir("reports", { recursive: true });
await writeFile(`reports/statistical-analysis-${bundle.replay_manifest.replay_id}.json`, canonicalJson(report), "utf8");
await writeFile(`reports/statistical-analysis-${bundle.replay_manifest.replay_id}.md`, renderStatisticalReport(report), "utf8");
console.log("STATISTICAL ANALYSIS");
console.log(report.executive_summary);
console.log(`Conclusion: ${report.conclusion}`);
console.log(`Report: reports/statistical-analysis-${bundle.replay_manifest.replay_id}.md`);
