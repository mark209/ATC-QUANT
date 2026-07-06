import { writeFileSync } from "node:fs";
import { allocationDistribution, classifyAllocationBottleneck } from "@/lib/quant/profitabilityAudit";
import { countBy, distributionText, loadAuditDatasets, mostCommon, pct, runExplainedReplay, table } from "./auditShared";

const REBALANCE_EVERY_DAYS = 21;

async function main() {
  console.log("ATC ALLOCATION DISTRIBUTION AUDIT");
  console.log("Mode: paper/backtest diagnostics only. No brokerage execution.");

  const datasets = await loadAuditDatasets();
  const rows: Array<Array<string | number>> = [];
  const blockerRows: Array<Array<string | number>> = [];

  for (const dataset of datasets) {
    console.log(`Auditing allocation for ${dataset.asset.symbol}`);
    const bundle = runExplainedReplay({
      asset: dataset.asset,
      candles: dataset.candles,
      rebalanceEveryDays: REBALANCE_EVERY_DAYS
    });
    const distribution = allocationDistribution(bundle.rows);
    const blockers = countBy(bundle.rows.map(classifyAllocationBottleneck));

    rows.push([
      dataset.asset.symbol,
      bundle.rows.length,
      distribution.zeroAllocationDays,
      distribution.activeAllocationDays,
      distribution.meaningfulAllocationDays,
      pct(distribution.averageAllocation),
      pct(distribution.averageNonZeroAllocation),
      distributionText(distribution.counts, bundle.rows.length)
    ]);
    blockerRows.push([
      dataset.asset.symbol,
      mostCommon(blockers),
      distributionText(blockers, bundle.rows.length)
    ]);
  }

  const markdown = `# ATC Allocation Distribution Audit

This report answers when the system allocates 0%, sub-0.25%, 0.25%, 0.5%, 1%, and larger sizes. It is diagnostic only and does not change production sizing.

## Allocation Buckets

${table(["Symbol", "Rows", "0% Days", "Active Days", ">= 1% Days", "Avg Allocation", "Avg Nonzero Allocation", "Bucket Distribution"], rows)}

## Blocking Rules

${table(["Symbol", "Main Blocking Rule", "Blocking Distribution"], blockerRows)}

## Interpretation

- 0% allocation usually means one of: data quality failed, risk-off regime, EV failed, validation evidence was absent/failed, Kelly was zero, or final decision labels zeroed exposure.
- 0.25% to 1% allocation means the system is technically deploying capital but may still be economically too small after fees, slippage, and opportunity cost.
- 1% or greater allocation is the first bucket treated here as meaningful deployment.
- If most rows sit below 1%, the system can be analytically right and still unable to produce meaningful monthly profits.
`;

  writeFileSync("ATC_ALLOCATION_DISTRIBUTION_AUDIT.md", markdown);
  console.log("Wrote ATC_ALLOCATION_DISTRIBUTION_AUDIT.md");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
