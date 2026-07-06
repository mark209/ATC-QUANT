import { writeFileSync } from "node:fs";
import { allocationDistribution, classifyAllocationBottleneck, profitabilityVerdict, summarizePaperReplay } from "@/lib/quant/profitabilityAudit";
import {
  average,
  buyAndHoldReturn,
  countBy,
  distributionText,
  loadAuditDatasets,
  mostCommon,
  pct,
  ratio,
  runExplainedReplay,
  table
} from "./auditShared";

const REBALANCE_EVERY_DAYS = 21;

function verdictText(value: boolean): string {
  return value ? "Yes, but only under the tested assumptions" : "No";
}

async function main() {
  console.log("ATC PROFITABILITY AUDIT");
  console.log("Mode: historical backtest / paper replay only. No brokerage execution.");

  const datasets = await loadAuditDatasets();
  const summaries = [];
  const performanceRows: Array<Array<string | number>> = [];
  const allocationRows: Array<Array<string | number>> = [];
  const bottleneckRows: Array<Array<string | number>> = [];
  const stressNotes: string[] = [];

  for (const dataset of datasets) {
    console.log(`Running ${dataset.asset.symbol} replay`);
    const bundle = runExplainedReplay({
      asset: dataset.asset,
      candles: dataset.candles,
      rebalanceEveryDays: REBALANCE_EVERY_DAYS
    });
    const summary = summarizePaperReplay(bundle.portfolio);
    const allocation = allocationDistribution(bundle.rows);
    const bottlenecks = countBy(bundle.rows.map(classifyAllocationBottleneck));
    summaries.push(summary);

    performanceRows.push([
      dataset.asset.symbol,
      bundle.rows.length,
      pct(summary.totalReturn),
      pct(summary.averageMonthlyReturn),
      summary.monthlyWinCount,
      summary.monthlyLossCount,
      pct(summary.maxDrawdown),
      ratio(summary.sharpeLikeReturn),
      ratio(summary.profitFactor),
      pct(summary.winRate),
      pct(summary.averageWin),
      pct(summary.averageLoss),
      pct(summary.expectancyPerTrade),
      summary.tradeCount,
      summary.skippedOpportunities,
      pct(summary.averageAllocation),
      pct(summary.daysWithActiveAllocationPct),
      pct(buyAndHoldReturn(dataset.candles))
    ]);
    allocationRows.push([
      dataset.asset.symbol,
      allocation.zeroAllocationDays,
      allocation.activeAllocationDays,
      allocation.meaningfulAllocationDays,
      pct(allocation.averageAllocation),
      pct(allocation.averageNonZeroAllocation),
      distributionText(allocation.counts, bundle.rows.length)
    ]);
    bottleneckRows.push([
      dataset.asset.symbol,
      mostCommon(bottlenecks),
      distributionText(bottlenecks, bundle.rows.length)
    ]);

    if (summary.tradeCount < 30) stressNotes.push(`${dataset.asset.symbol}: trade sample below 30; profitability evidence is weak.`);
    if (allocation.averageAllocation < 0.01) stressNotes.push(`${dataset.asset.symbol}: average allocation below 1%; capital deployment is not meaningful.`);
  }

  const avgMonthly = average(summaries.map((summary) => summary.averageMonthlyReturn));
  const avgAllocation = average(summaries.map((summary) => summary.averageAllocation));
  const totalTrades = summaries.reduce((sum, summary) => sum + summary.tradeCount, 0);
  const combinedProfitFactor = average(summaries.map((summary) => Number.isFinite(summary.profitFactor) ? summary.profitFactor : 0));
  const worstDrawdown = Math.min(0, ...summaries.map((summary) => summary.maxDrawdown));
  const sampleMonths = summaries.reduce((sum, summary) => sum + summary.monthlyWinCount + summary.monthlyLossCount, 0);
  const verdict = profitabilityVerdict({
    averageMonthlyReturn: avgMonthly,
    maxDrawdown: worstDrawdown,
    profitFactor: combinedProfitFactor,
    averageAllocation: avgAllocation,
    tradeCount: totalTrades,
    sampleMonths
  });
  const mainBottleneck = verdict.mainBottleneck;

  const markdown = `# ATC System Profitability Audit

## Executive Summary

This audit is a historical backtest and paper-replay review only. It does not connect to brokerage execution, place trades, or enable live trading.

- Currently profitable: ${verdictText(verdict.currentlyProfitable)}
- Realistic potential to target 1% monthly: ${verdictText(verdict.onePercentMonthlyRealistic)}
- Realistic potential to target 2% monthly: ${verdictText(verdict.twoPercentMonthlyRealistic)}
- 5% monthly: ${verdict.fivePercentMonthlyAssessment}
- Main bottleneck: ${mainBottleneck}

## Backtest / Forward Replay Results

${table(
  [
    "Symbol",
    "Decision Rows",
    "Total Return",
    "Avg Monthly Return",
    "Winning Months",
    "Losing Months",
    "Max Drawdown",
    "Sharpe-like",
    "Profit Factor",
    "Win Rate",
    "Avg Win",
    "Avg Loss",
    "Expectancy / Trade",
    "Trades",
    "Skipped Opportunities",
    "Avg Allocation",
    "Active Decision Days",
    "Buy/Hold"
  ],
  performanceRows
)}

## Allocation Bottlenecks

${table(["Symbol", "Zero Days", "Active Days", ">= 1% Days", "Avg Allocation", "Avg Nonzero Allocation", "Distribution"], allocationRows)}

## Blocking Rules

${table(["Symbol", "Main Bottleneck", "Distribution"], bottleneckRows)}

## Risk Weaknesses

${stressNotes.length > 0 ? stressNotes.map((note) => `- ${note}`).join("\n") : "- No obvious sample-size or capital-deployment warning was generated by the summary layer."}

## Bugs / Audit Findings

- The existing architecture correctly routes signals through validation, EV, risk, position sizing, and final decision labels.
- The current sizing formula can make the system technically correct but economically inactive: final allocation is the minimum of volatility targeting, fractional Kelly, asset cap, and drawdown control.
- The hard Kelly trade-count penalty below 30 trades is a major suspected allocation blocker for a low-frequency trend-following strategy.
- Forward replay uses only candles available up to each replay date, which reduces lookahead risk.
- Results still depend on provider historical data quality and adjusted equity OHLC availability.

## Anti-Overfitting Checks

- Lookahead bias: replay slices candles up to the decision date and paper execution occurs on the next candle open.
- Survivorship bias: this script tests only the configured symbols; it does not prove robustness across delisted or failed assets.
- Curve fitting: parameter sensitivity exists in validation, but thresholds are still fixed architecture choices that require out-of-sample monitoring.
- Execution assumptions: fees and slippage are included, but real spreads, partial fills, borrow limits, outages, and market impact are not fully modeled.
- Data reuse: the same history can influence validation and evaluation if users treat this report as tuning feedback; keep a separate holdout period before risking capital.

## Recommended Fixes

1. Keep live execution disabled.
2. Add a diagnostic-only graded trade-count multiplier to compare against the current hard-zero Kelly rule.
3. Expand the symbol universe and include failed/delisted assets where possible.
4. Run a true out-of-sample paper period before changing capital allocation.
5. Track spread, stale-data, missing-data, duplicate-signal, and execution-delay failures as first-class audit outputs.

## Next Steps Before Using Real Capital

Do not use real capital from this audit alone. Require a long enough paper-forward sample with positive expectancy after fees/slippage, meaningful allocation, tolerable drawdown, and stable behavior through stress tests.

Final answer to the core question: ATC is not proven capable of producing realistic monthly profits yet. The most likely blocker is not signal generation alone; it is capital deployment being starved by validation/EV/Kelly sample-size constraints and conservative final allocation rules.
`;

  writeFileSync("ATC_SYSTEM_PROFITABILITY_AUDIT.md", markdown);

  console.log(`Total return: ${pct(average(summaries.map((summary) => summary.totalReturn)))}`);
  console.log(`Average monthly return: ${pct(avgMonthly)}`);
  console.log(`Best month: ${pct(Math.max(...summaries.map((summary) => summary.bestMonthReturn)))}`);
  console.log(`Worst month: ${pct(Math.min(...summaries.map((summary) => summary.worstMonthReturn)))}`);
  console.log(`Max drawdown: ${pct(worstDrawdown)}`);
  console.log(`Profit factor: ${ratio(combinedProfitFactor)}`);
  console.log(`Win rate: ${pct(average(summaries.map((summary) => summary.winRate)))}`);
  console.log(`Average allocation: ${pct(avgAllocation)}`);
  console.log(`Days with active allocation: ${pct(average(summaries.map((summary) => summary.daysWithActiveAllocationPct)))}`);
  console.log(`Zero-allocation days: ${summaries.reduce((sum, summary) => sum + summary.zeroAllocationDays, 0)}`);
  console.log(`Main reason trades were skipped: ${mainBottleneck}`);
  console.log(`Main bottleneck: ${mainBottleneck}`);
  console.log(`Final verdict: ${verdict.currentlyProfitable ? "Profitable in this replay, not proven for live capital." : "Not proven profitable; treat as research/paper-only."}`);
  console.log("Wrote ATC_SYSTEM_PROFITABILITY_AUDIT.md");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
