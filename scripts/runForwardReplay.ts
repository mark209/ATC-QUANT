import { writeFileSync } from "node:fs";
import { summarizePaperReplay } from "@/lib/quant/profitabilityAudit";
import { loadAuditDatasets, pct, ratio, runExplainedReplay, table } from "./auditShared";

const REBALANCE_EVERY_DAYS = 1;
const MAX_DECISION_ROWS = 365;

async function main() {
  console.log("ATC FORWARD REPLAY");
  console.log("Mode: day-by-day paper replay only. No brokerage execution.");

  const datasets = await loadAuditDatasets();
  const summaryRows: Array<Array<string | number>> = [];
  const decisionExport = [];

  for (const dataset of datasets) {
    console.log(`Running day-by-day replay for ${dataset.asset.symbol}`);
    const bundle = runExplainedReplay({
      asset: dataset.asset,
      candles: dataset.candles,
      rebalanceEveryDays: REBALANCE_EVERY_DAYS,
      maxDecisionRows: MAX_DECISION_ROWS
    });
    const summary = summarizePaperReplay(bundle.portfolio);

    summaryRows.push([
      dataset.asset.symbol,
      bundle.rows.length,
      pct(summary.totalReturn),
      pct(summary.averageMonthlyReturn),
      pct(summary.maxDrawdown),
      ratio(summary.profitFactor),
      pct(summary.averageAllocation),
      pct(summary.daysWithActiveAllocationPct),
      summary.skippedOpportunities,
      summary.tradeCount
    ]);
    decisionExport.push({
      symbol: dataset.asset.symbol,
      decisions: bundle.rows,
      equityCurve: bundle.portfolio.equityCurve,
      trades: bundle.portfolio.trades
    });
  }

  const markdown = `# ATC Forward Replay Report

This is a paper-only replay. Each decision uses only candles available up to that date. Any simulated execution happens on a later candle inside the paper portfolio engine.

${table(
  [
    "Symbol",
    "Decision Rows",
    "Total Return",
    "Avg Monthly Return",
    "Max Drawdown",
    "Profit Factor",
    "Avg Allocation",
    "Active Decision Days",
    "Skipped Opportunities",
    "Paper Trades"
  ],
  summaryRows
)}

Decision explanations, blocking reasons, warnings, paper trades, and portfolio value over time are stored in \`ATC_FORWARD_REPLAY_DECISIONS.json\`.
`;

  writeFileSync("ATC_FORWARD_REPLAY_REPORT.md", markdown);
  writeFileSync("ATC_FORWARD_REPLAY_DECISIONS.json", JSON.stringify(decisionExport, null, 2));
  console.log("Wrote ATC_FORWARD_REPLAY_REPORT.md");
  console.log("Wrote ATC_FORWARD_REPLAY_DECISIONS.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
