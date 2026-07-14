import { mkdir, readFile, writeFile } from "node:fs/promises";
import { DatasetLibrary } from "../src/lib/datasets/datasetLibrary";
import { ReplayArtifactStore } from "../src/lib/replay/replayArtifacts";
import { buildProposalFunnelAudit, renderProposalFunnelAudit } from "../src/lib/analysis/proposalFunnelAudit";
import { canonicalJson } from "../src/lib/trading/tradeJournal";

const library = new DatasetLibrary("datasets");
const store = new ReplayArtifactStore("replays");
const entries = (await library.list()).filter((entry) => entry.metadata.asset_type === "crypto" && entry.metadata.timeframe === "1d" && entry.metadata.dataset_id.includes("crypto-long-horizon"));
await mkdir("reports/proposal-audit", { recursive: true });
for (const entry of entries) {
  const selected = await library.get(entry.metadata.dataset_id);
  const replayId = `crypto-audit-${selected.metadata.symbol.toLowerCase()}-${selected.metadata.dataset_version}`;
  const bundle = await store.read(replayId);
  const groups = new Map<string, typeof bundle.artifacts.lifecycle_events>();
  for (const event of bundle.artifacts.lifecycle_events) groups.set(event.trade_id, [...(groups.get(event.trade_id) ?? []), event]);
  const report = buildProposalFunnelAudit({ replayId, datasetId: selected.dataset.dataset_id, symbol: selected.dataset.symbol, generatedAt: bundle.replay_manifest.replay_timestamp, proposals: [...groups.entries()].filter(([, events]) => events.some((event) => event.state_after === "TRADE_PROPOSED")).map(([proposal_id, lifecycle]) => ({ proposal_id, lifecycle })), traces: bundle.strategy_trace ?? [], executions: bundle.artifacts.execution_events, trades: bundle.artifacts.trades });
  await writeFile(`replays/replay-${replayId}/proposal-funnel-audit.json`, canonicalJson(report), "utf8");
  await writeFile(`replays/replay-${replayId}/proposal-funnel-audit.md`, renderProposalFunnelAudit(report), "utf8");
  await writeFile(`reports/proposal-audit/${selected.metadata.symbol}_PROPOSAL_FUNNEL_AUDIT.json`, canonicalJson(report), "utf8");
  await writeFile(`reports/proposal-audit/${selected.metadata.symbol}_PROPOSAL_FUNNEL_AUDIT.md`, renderProposalFunnelAudit(report), "utf8");
  console.log(`${selected.metadata.symbol}: ${report.proposal_count} proposals, ${report.mismatch_count} mismatches, greatest reduction ${report.greatest_reduction_stage}=${report.greatest_reduction_count}`);
}
