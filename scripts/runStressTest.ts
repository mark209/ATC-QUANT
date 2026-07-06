import { writeFileSync } from "node:fs";
import type { MarketDataPoint } from "@/types/asset";
import { summarizePaperReplay } from "@/lib/quant/profitabilityAudit";
import { simulatePaperPortfolio, type ReplayResultRow } from "@/lib/quant/historicalReplay";
import { loadAuditDatasets, pct, ratio, runExplainedReplay, table } from "./auditShared";

const REBALANCE_EVERY_DAYS = 21;
const MAX_STRESS_DECISION_ROWS = 120;

type StressScenario =
  | "baseline"
  | "losing streak / sudden crash"
  | "sideways choppy market"
  | "high-volatility regime"
  | "low-volume liquidity regime"
  | "missing data"
  | "stale data"
  | "outlier candle"
  | "high slippage and fees"
  | "execution delay"
  | "duplicate signals"
  | "conflicting signals";

function clone(point: MarketDataPoint): MarketDataPoint {
  return { ...point };
}

function scalePoint(point: MarketDataPoint, factor: number): MarketDataPoint {
  return {
    ...point,
    open: point.open * factor,
    high: point.high * factor,
    low: point.low * factor,
    close: point.close * factor,
    quoteVolume: point.quoteVolume === undefined ? undefined : point.quoteVolume * factor
  };
}

function scenarioCandles(candles: MarketDataPoint[], scenario: StressScenario): MarketDataPoint[] {
  if (scenario === "missing data") return candles.filter((_, index) => index % 10 !== 0).map(clone);
  const mid = Math.floor(candles.length / 2);
  const transformed = candles.map(clone);

  if (scenario === "losing streak / sudden crash") {
    return transformed.map((point, index) => (index >= mid ? scalePoint(point, 0.65) : point));
  }
  if (scenario === "sideways choppy market") {
    const base = candles[mid]?.close ?? candles[0]?.close ?? 1;
    return transformed.map((point, index) => {
      const factor = 1 + (index % 2 === 0 ? 0.015 : -0.015);
      return { ...point, open: base, high: base * 1.02, low: base * 0.98, close: base * factor };
    });
  }
  if (scenario === "high-volatility regime") {
    return transformed.map((point, index) => {
      const factor = 1 + (index % 2 === 0 ? 0.08 : -0.08);
      return scalePoint(point, factor);
    });
  }
  if (scenario === "low-volume liquidity regime") {
    return transformed.map((point) => ({ ...point, volume: point.volume * 0.01, quoteVolume: (point.quoteVolume ?? point.volume * point.close) * 0.01 }));
  }
  if (scenario === "stale data") {
    return transformed.map((point, index) => {
      if (index < transformed.length - 30) return point;
      const stale = transformed[transformed.length - 31] ?? point;
      return { ...point, open: stale.open, high: stale.high, low: stale.low, close: stale.close, volume: 0, quoteVolume: 0 };
    });
  }
  if (scenario === "outlier candle") {
    const point = transformed[mid];
    if (point) transformed[mid] = { ...point, high: point.close * 5, low: point.close * 0.2 };
    return transformed;
  }

  return transformed;
}

function delayedRows(rows: ReplayResultRow[], candles: MarketDataPoint[], delayDays: number): ReplayResultRow[] {
  const dateIndex = new Map(candles.map((candle, index) => [candle.date, index]));
  return rows.map((row) => {
    const index = dateIndex.get(row.date) ?? 0;
    const delayedDate = candles[Math.min(candles.length - 1, index + delayDays)]?.date ?? row.date;
    return { ...row, date: delayedDate };
  });
}

function duplicateRows(rows: ReplayResultRow[]): ReplayResultRow[] {
  return rows.flatMap((row, index) => (index % 5 === 0 ? [row, { ...row }] : [row]));
}

function conflictingRows(rows: ReplayResultRow[]): ReplayResultRow[] {
  return rows.flatMap((row, index) => {
    if (index % 7 !== 0) return [row];
    return [
      row,
      {
        ...row,
        finalDecision: row.activeAllocation > 0 ? "Risk-off / no trade" : "Position allowed",
        activeAllocation: row.activeAllocation > 0 ? 0 : 0.02,
        blockingReasons: [...row.blockingReasons, "Synthetic conflicting signal stress test"]
      }
    ];
  });
}

async function main() {
  console.log("ATC STRESS TEST");
  console.log("Mode: synthetic stress replay only. No brokerage execution.");

  const datasets = await loadAuditDatasets();
  const scenarios: StressScenario[] = [
    "baseline",
    "losing streak / sudden crash",
    "sideways choppy market",
    "high-volatility regime",
    "low-volume liquidity regime",
    "missing data",
    "stale data",
    "outlier candle",
    "high slippage and fees",
    "execution delay",
    "duplicate signals",
    "conflicting signals"
  ];
  const rows: Array<Array<string | number>> = [];

  for (const dataset of datasets) {
    for (const scenario of scenarios) {
      console.log(`Stress ${dataset.asset.symbol}: ${scenario}`);
      const stressedCandles = scenarioCandles(dataset.candles, scenario);
      const bundle = runExplainedReplay({
        asset: dataset.asset,
        candles: stressedCandles,
        rebalanceEveryDays: REBALANCE_EVERY_DAYS,
        maxDecisionRows: MAX_STRESS_DECISION_ROWS
      });
      const replayRows =
        scenario === "execution delay"
          ? delayedRows(bundle.rows, stressedCandles, 2)
          : scenario === "duplicate signals"
            ? duplicateRows(bundle.rows)
            : scenario === "conflicting signals"
              ? conflictingRows(bundle.rows)
              : bundle.rows;
      const portfolio =
        scenario === "high slippage and fees"
          ? simulatePaperPortfolio({
              symbol: dataset.asset.symbol,
              assetType: dataset.asset.assetType,
              candles: stressedCandles,
              replayRows,
              startingCapital: 100000,
              feeRate: 0.003,
              slippageRate: 0.005
            })
          : simulatePaperPortfolio({
              symbol: dataset.asset.symbol,
              assetType: dataset.asset.assetType,
              candles: stressedCandles,
              replayRows,
              startingCapital: 100000
            });
      const summary = summarizePaperReplay({ ...portfolio, decisionLog: replayRows });
      const duplicateCount = replayRows.length - new Set(replayRows.map((row) => row.date)).size;

      rows.push([
        dataset.asset.symbol,
        scenario,
        replayRows.length,
        duplicateCount,
        pct(summary.totalReturn),
        pct(summary.averageMonthlyReturn),
        pct(summary.maxDrawdown),
        ratio(summary.profitFactor),
        pct(summary.averageAllocation),
        summary.skippedOpportunities,
        summary.tradeCount
      ]);
    }
  }

  const markdown = `# ATC Stress Test Report

This report uses synthetic stress transformations on historical candles and paper replay rows. It does not enable or test real-money execution. Each scenario is bounded to the most recent ${MAX_STRESS_DECISION_ROWS} rebalance decisions to keep the audit runnable.

${table(
  [
    "Symbol",
    "Scenario",
    "Decision Rows",
    "Duplicate/Conflict Rows",
    "Total Return",
    "Avg Monthly Return",
    "Max Drawdown",
    "Profit Factor",
    "Avg Allocation",
    "Skipped Opportunities",
    "Paper Trades"
  ],
  rows
)}

## Covered Stress Conditions

- Losing streaks and sudden crash: price path is shocked down after the midpoint.
- Sideways/choppy market: closes alternate around a flat base.
- High-volatility regime: alternating candle-level volatility shock.
- Low-volume/liquidity regime: volume and quote volume are reduced by 99%.
- Missing data: every tenth candle is removed.
- Stale data: the final segment repeats stale prices and zero volume.
- Outlier candles: a single candle receives extreme high/low values.
- Slippage and fees: paper execution costs are increased.
- Execution delay: replay decisions execute two candles later.
- Duplicate signals: repeated decision rows are inserted.
- Conflicting signals: contradictory same-date paper decisions are inserted.

Stress results are diagnostic. Any scenario that looks profitable here still needs a separate out-of-sample paper-forward period before capital is considered.
`;

  writeFileSync("ATC_STRESS_TEST_REPORT.md", markdown);
  console.log("Wrote ATC_STRESS_TEST_REPORT.md");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
