import { writeFileSync } from "node:fs";
import type { AssetType, MarketDataPoint } from "@/types/asset";
import type { DecisionLabel, QuantAnalysis, SampleQuality, ValidationEvidenceState } from "@/types/quant";
import { fetchMarketDataWithFallback } from "@/lib/data/marketDataAdapter";
import { DEFAULT_QUANT_CONFIG } from "@/lib/quant/config";
import { simulatePaperPortfolio, type ReplayResultRow } from "@/lib/quant/historicalReplay";
import { analyzeMarketData } from "@/lib/quant/scoring";

type AssetSpec = { symbol: string; assetType: AssetType; baselineAverageAllocation: number };
type Bottleneck =
  | "VolatilityTargetAllocation"
  | "FractionalKellyAllocation"
  | "AssetClassMaxAllocation"
  | "DrawdownAdjustedAllocation"
  | "FinalDecisionZeroing"
  | "DataQualityBlock"
  | "RiskOffBlock"
  | "NegativeEVBlock"
  | "NoEvidenceBlock"
  | "FailedEvidenceBlock";

type AuditRow = ReplayResultRow & {
  finalPositionSize: number;
  volatilityTargetAllocation: number;
  fractionalKellyAllocation: number;
  assetClassMaxAllocation: number;
  drawdownAdjustedAllocation: number;
  rawLimitingConstraint: Bottleneck;
  bottleneck: Bottleneck;
  tradeCount: number;
  sampleQuality: SampleQuality;
  tradeCountMultiplier: number;
  sampleMultiplier: number;
  feesPaid: number;
  slippagePaid: number;
};

const ASSETS: AssetSpec[] = [
  { symbol: "AAPL", assetType: "stock", baselineAverageAllocation: 0.000867 },
  { symbol: "SPY", assetType: "etf", baselineAverageAllocation: 0.000633 },
  { symbol: "QQQ", assetType: "etf", baselineAverageAllocation: 0.00069 },
  { symbol: "BTCUSDT", assetType: "crypto", baselineAverageAllocation: 0.000187 },
  { symbol: "ETHUSDT", assetType: "crypto", baselineAverageAllocation: 0.000244 }
];
const REBALANCE_DAYS = [63, 5];
const STARTING_CAPITAL = 100000;
const ACTIVE_LABELS = new Set<DecisionLabel>(["Strong candidate", "Position allowed", "Small allocation only"]);
const EVIDENCE_STATES: ValidationEvidenceState[] = ["No Evidence", "Weak Evidence", "Moderate Evidence", "Strong Evidence", "Failed Evidence"];
const DECISION_LABELS: DecisionLabel[] = [
  "Strong candidate",
  "Position allowed",
  "Small allocation only",
  "Watchlist only",
  "Avoid for now",
  "Risk-off / no trade",
  "No Data / Avoid"
];
const BOTTLENECKS: Bottleneck[] = [
  "VolatilityTargetAllocation",
  "FractionalKellyAllocation",
  "AssetClassMaxAllocation",
  "DrawdownAdjustedAllocation",
  "FinalDecisionZeroing",
  "DataQualityBlock",
  "RiskOffBlock",
  "NegativeEVBlock",
  "NoEvidenceBlock",
  "FailedEvidenceBlock"
];

function pct(value: number): string {
  return `${(value * 100).toFixed(4)}%`;
}

function num(value: number): string {
  if (!Number.isFinite(value)) return "Not meaningful";
  return value.toFixed(4);
}

function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function sortedCandles(candles: MarketDataPoint[]): MarketDataPoint[] {
  return [...candles].sort((a, b) => a.timestamp - b.timestamp);
}

function benchmarkReturn(candles: MarketDataPoint[]): number {
  const first = candles[0]?.open ?? candles[0]?.close ?? 0;
  const last = candles.at(-1)?.close ?? first;
  return first === 0 ? 0 : last / first - 1;
}

function ratio(value: number): string {
  if (!Number.isFinite(value) || Math.abs(value) >= 10) return "Not meaningful";
  return value.toFixed(4);
}

function sampleMultiplier(sampleQuality: SampleQuality): number {
  if (sampleQuality === "Poor") return 0;
  if (sampleQuality === "Limited") return 0.25;
  if (sampleQuality === "Acceptable") return 0.75;
  return 1;
}

function tradeCountMultiplier(tradeCount: number): number {
  if (tradeCount < DEFAULT_QUANT_CONFIG.validation.minTotalTrades) return 0;
  if (tradeCount < DEFAULT_QUANT_CONFIG.limitedSampleTradeCount) return 0.35;
  return 1;
}

function rawLimitingConstraint(analysis: QuantAnalysis): Bottleneck {
  const sizing = analysis.pipeline.positionSizing;
  const candidates = [
    ["VolatilityTargetAllocation", sizing.volatilityTargetAllocation],
    ["FractionalKellyAllocation", sizing.fractionalKellyAllocation],
    ["AssetClassMaxAllocation", sizing.assetClassMaxAllocation],
    ["DrawdownAdjustedAllocation", sizing.drawdownAdjustedAllocation]
  ] as const;
  return candidates.reduce((lowest, candidate) => (candidate[1] < lowest[1] ? candidate : lowest))[0];
}

function classifyBottleneck(analysis: QuantAnalysis): Bottleneck {
  const decision = analysis.pipeline.finalDecision;
  const ev = analysis.pipeline.expectedValue;
  const evidence = analysis.pipeline.validation.validationEvidenceState;
  if (!analysis.pipeline.dataQuality.passed || decision.decisionLabel === "No Data / Avoid") return "DataQualityBlock";
  if (decision.decisionLabel === "Risk-off / no trade" || analysis.pipeline.signal.regimeLabel === "Risk-Off") return "RiskOffBlock";
  if (ev.expectedValueAfterCosts <= 0 || !ev.passed) return "NegativeEVBlock";
  if (evidence === "No Evidence") return "NoEvidenceBlock";
  if (evidence === "Failed Evidence") return "FailedEvidenceBlock";
  if (!ACTIVE_LABELS.has(decision.decisionLabel)) return "FinalDecisionZeroing";
  return rawLimitingConstraint(analysis);
}

function rowFromAnalysis(asset: AssetSpec, candle: MarketDataPoint, analysis: QuantAnalysis): AuditRow {
  const decision = analysis.pipeline.finalDecision;
  const ev = analysis.pipeline.expectedValue;
  const sizing = analysis.pipeline.positionSizing;
  const activeAllocation = ACTIVE_LABELS.has(decision.decisionLabel as DecisionLabel) ? decision.finalPositionSize : 0;
  return {
    date: candle.date,
    symbol: asset.symbol,
    assetType: asset.assetType,
    finalDecision: decision.decisionLabel,
    finalPositionSize: decision.finalPositionSize,
    activeAllocation,
    signalScore: decision.signalScore,
    riskScore: decision.riskScore,
    validationScore: decision.validationScore,
    validationEvidenceState: analysis.pipeline.validation.validationEvidenceState,
    evStatus: ev.expectedValueAfterCosts <= 0 ? "EV failed" : ev.passed ? "EV passed" : "EV limited",
    evAfterCosts: ev.expectedValueAfterCosts,
    kellyAllocation: sizing.fractionalKellyAllocation,
    dataQualityStatus: analysis.pipeline.dataQuality.passed ? "passed" : "failed",
    regimeLabel: analysis.pipeline.signal.regimeLabel,
    blockingReasons: decision.blockingReasons,
    warnings: Array.from(new Set([...decision.warnings, ...ev.warnings])),
    volatilityTargetAllocation: sizing.volatilityTargetAllocation,
    fractionalKellyAllocation: sizing.fractionalKellyAllocation,
    assetClassMaxAllocation: sizing.assetClassMaxAllocation,
    drawdownAdjustedAllocation: sizing.drawdownAdjustedAllocation,
    rawLimitingConstraint: rawLimitingConstraint(analysis),
    bottleneck: classifyBottleneck(analysis),
    tradeCount: ev.tradeCount,
    sampleQuality: ev.sampleQuality,
    tradeCountMultiplier: tradeCountMultiplier(ev.tradeCount),
    sampleMultiplier: sampleMultiplier(ev.sampleQuality),
    feesPaid: analysis.backtest.feesPaid,
    slippagePaid: analysis.backtest.slippageCostEstimate
  };
}

function runReplay(asset: AssetSpec, candles: MarketDataPoint[], days: number): AuditRow[] {
  const rows: AuditRow[] = [];
  for (let index = 0; index < candles.length; index += days) {
    const candle = candles[index];
    if (!candle) continue;
    const available = candles.slice(0, index + 1);
    const analysis = analyzeMarketData(available, asset.assetType, asset.symbol, "balanced");
    rows.push(rowFromAnalysis(asset, candle, analysis));
  }
  return rows;
}

function countBy<T extends string>(values: T[], universe: T[]): Record<T, number> {
  const counts = Object.fromEntries(universe.map((item) => [item, 0])) as Record<T, number>;
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function allocationBuckets(rows: AuditRow[]) {
  return {
    "0%": rows.filter((row) => row.activeAllocation === 0).length,
    ">0% to 0.25%": rows.filter((row) => row.activeAllocation > 0 && row.activeAllocation < 0.0025).length,
    "0.25% to 0.50%": rows.filter((row) => row.activeAllocation >= 0.0025 && row.activeAllocation < 0.005).length,
    "0.50% to 1.00%": rows.filter((row) => row.activeAllocation >= 0.005 && row.activeAllocation < 0.01).length,
    "1.00% to 2.00%": rows.filter((row) => row.activeAllocation >= 0.01 && row.activeAllocation < 0.02).length,
    "2.00% to 5.00%": rows.filter((row) => row.activeAllocation >= 0.02 && row.activeAllocation <= 0.05).length,
    ">5.00%": rows.filter((row) => row.activeAllocation > 0.05).length
  };
}

function kellyBuckets(rows: AuditRow[]) {
  return {
    "Kelly = 0": rows.filter((row) => row.kellyAllocation === 0).length,
    ">0% to 0.25%": rows.filter((row) => row.kellyAllocation > 0 && row.kellyAllocation < 0.0025).length,
    "0.25% to 0.50%": rows.filter((row) => row.kellyAllocation >= 0.0025 && row.kellyAllocation < 0.005).length,
    "0.50% to 1.00%": rows.filter((row) => row.kellyAllocation >= 0.005 && row.kellyAllocation < 0.01).length,
    ">1.00%": rows.filter((row) => row.kellyAllocation >= 0.01).length
  };
}

function distributionMarkdown<T extends string>(counts: Record<T, number>, total: number): string {
  return Object.entries(counts)
    .map(([label, count]) => `${label}: ${count} (${pct(Number(count) / Math.max(1, total))})`)
    .join("<br>");
}

function table(headers: string[], rows: Array<Array<string | number>>): string {
  return [
    `| ${headers.join(" |")} |`,
    `| ${headers.map(() => "---").join(" |")} |`,
    ...rows.map((row) => `| ${row.join(" |")} |`)
  ].join("\n");
}

function mostCommon(counts: Record<string, number>): string {
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "n/a";
}

function secondMostCommon(counts: Record<string, number>): string {
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[1]?.[0] ?? "n/a";
}

async function main() {
  const datasets = new Map<string, { asset: AssetSpec; candles: MarketDataPoint[] }>();
  for (const asset of ASSETS) {
    console.log(`Fetching ${asset.symbol}`);
    const data = await fetchMarketDataWithFallback({
      symbol: asset.symbol,
      assetType: asset.assetType,
      chartRangeRequested: "max"
    });
    datasets.set(asset.symbol, { asset, candles: sortedCandles(data.backtestCandles) });
  }

  const replays = new Map<string, AuditRow[]>();
  for (const { asset, candles } of datasets.values()) {
    for (const days of REBALANCE_DAYS) {
      console.log(`Running ${asset.symbol} ${days}-day replay over ${candles.length} candles`);
      replays.set(`${asset.symbol}-${days}`, runReplay(asset, candles, days));
    }
  }

  const validationRows: Array<Array<string | number>> = [];
  const decisionRows: Array<Array<string | number>> = [];
  const allocationRows: Array<Array<string | number>> = [];
  const averageRows: Array<Array<string | number>> = [];
  const bottleneckRows: Array<Array<string | number>> = [];
  const kellyRows: Array<Array<string | number>> = [];
  const performanceRows: Array<Array<string | number>> = [];
  const beforeAfterRows: Array<Array<string | number>> = [];

  for (const { asset, candles } of datasets.values()) {
    const benchmark = benchmarkReturn(candles);
    for (const days of REBALANCE_DAYS) {
      const rows = replays.get(`${asset.symbol}-${days}`) ?? [];
      const portfolio = simulatePaperPortfolio({
        symbol: asset.symbol,
        assetType: asset.assetType,
        candles,
        replayRows: rows,
        startingCapital: STARTING_CAPITAL
      });
      const allocations = rows.map((row) => row.activeAllocation);
      const nonzero = allocations.filter((value) => value > 0);
      const validationCounts = countBy(rows.map((row) => row.validationEvidenceState), EVIDENCE_STATES);
      const decisionCounts = countBy(rows.map((row) => row.finalDecision as DecisionLabel), DECISION_LABELS);
      const allocationCounts = allocationBuckets(rows);
      const bottleneckCounts = countBy(rows.map((row) => row.bottleneck), BOTTLENECKS);
      const kellyCounts = kellyBuckets(rows);
      const sampleCounts = countBy(rows.map((row) => row.sampleQuality), ["Poor", "Limited", "Acceptable", "Strong"]);
      const tradeMultiplierCounts = countBy(rows.map((row) => String(row.tradeCountMultiplier)), ["0", "0.35", "1"]);
      const sampleMultiplierCounts = countBy(rows.map((row) => String(row.sampleMultiplier)), ["0", "0.25", "0.75", "1"]);
      const totalFees = portfolio.trades.reduce((sum, trade) => sum + trade.feesPaid, 0);
      const totalSlippage = portfolio.trades.reduce((sum, trade) => sum + trade.slippagePaid, 0);

      validationRows.push([asset.symbol, days, rows.length, distributionMarkdown(validationCounts, rows.length)]);
      decisionRows.push([asset.symbol, days, rows.length, distributionMarkdown(decisionCounts, rows.length)]);
      allocationRows.push([asset.symbol, days, rows.length, distributionMarkdown(allocationCounts, rows.length)]);
      averageRows.push([
        asset.symbol,
        days,
        pct(average(rows.map((row) => row.finalPositionSize))),
        pct(average(allocations)),
        pct(median(allocations)),
        pct(Math.max(0, ...allocations)),
        pct(average(nonzero)),
        pct(nonzero.length / Math.max(1, rows.length)),
        pct(rows.filter((row) => row.activeAllocation >= 0.0025).length / Math.max(1, rows.length)),
        pct(rows.filter((row) => row.activeAllocation >= 0.005).length / Math.max(1, rows.length)),
        pct(rows.filter((row) => row.activeAllocation >= 0.01).length / Math.max(1, rows.length))
      ]);
      bottleneckRows.push([
        asset.symbol,
        days,
        mostCommon(bottleneckCounts),
        secondMostCommon(bottleneckCounts),
        pct((bottleneckCounts.FractionalKellyAllocation ?? 0) / Math.max(1, rows.length)),
        pct((bottleneckCounts.FinalDecisionZeroing ?? 0) / Math.max(1, rows.length)),
        pct(((bottleneckCounts.NoEvidenceBlock ?? 0) + (bottleneckCounts.FailedEvidenceBlock ?? 0)) / Math.max(1, rows.length)),
        pct(rows.filter((row) => row.evAfterCosts <= 0).length / Math.max(1, rows.length)),
        pct((bottleneckCounts.DrawdownAdjustedAllocation ?? 0) / Math.max(1, rows.length)),
        distributionMarkdown(bottleneckCounts, rows.length)
      ]);
      kellyRows.push([
        asset.symbol,
        days,
        pct(average(rows.map((row) => row.kellyAllocation))),
        pct(median(rows.map((row) => row.kellyAllocation))),
        pct(Math.max(0, ...rows.map((row) => row.kellyAllocation))),
        distributionMarkdown(kellyCounts, rows.length),
        average(rows.map((row) => row.tradeCount)).toFixed(2),
        distributionMarkdown(sampleCounts, rows.length),
        distributionMarkdown(tradeMultiplierCounts, rows.length),
        distributionMarkdown(sampleMultiplierCounts, rows.length),
        pct(rows.filter((row) => row.evAfterCosts <= 0).length / Math.max(1, rows.length))
      ]);
      performanceRows.push([
        asset.symbol,
        days,
        pct(portfolio.totalReturn),
        pct(portfolio.annualizedReturn),
        pct(portfolio.maxDrawdown),
        ratio(portfolio.sharpeRatio),
        ratio(portfolio.sortinoRatio),
        portfolio.totalTrades,
        pct(average(portfolio.trades.map((trade) => trade.requestedAllocation))),
        pct(benchmark),
        `${money(totalFees)} fees / ${money(totalSlippage)} slippage`
      ]);
      if (days === 63) {
        const delta = average(allocations) - asset.baselineAverageAllocation;
        beforeAfterRows.push([
          asset.symbol,
          pct(asset.baselineAverageAllocation),
          pct(average(allocations)),
          pct(delta),
          pct(rows.filter((row) => row.activeAllocation === 0).length / Math.max(1, rows.length)),
          decisionCounts["Small allocation only"],
          decisionCounts["Position allowed"],
          decisionCounts["Strong candidate"]
        ]);
      }
    }
  }

  const all63Rows = ASSETS.flatMap((asset) => replays.get(`${asset.symbol}-63`) ?? []);
  const validationBlockRate =
    all63Rows.filter((row) => row.bottleneck === "NoEvidenceBlock" || row.bottleneck === "FailedEvidenceBlock").length /
    Math.max(1, all63Rows.length);
  const kellyBlockRate = all63Rows.filter((row) => row.bottleneck === "FractionalKellyAllocation").length / Math.max(1, all63Rows.length);
  const zeroRate = all63Rows.filter((row) => row.activeAllocation === 0).length / Math.max(1, all63Rows.length);
  const above50bp = all63Rows.filter((row) => row.activeAllocation >= 0.005).length / Math.max(1, all63Rows.length);

  const markdown = `# Post-Validation-Fix Replay Audit

## 1. Executive Summary

This audit reran production historical replay after the graded validation evidence model was added. The result is more honest and more interpretable, but it does not yet produce economically meaningful exposure.

- Validation is no longer the only visible blocker: replay rows now separate No Evidence, Weak Evidence, Moderate Evidence, Strong Evidence, and Failed Evidence.
- Production allocation is still heavily starved. Across the 63-day replay set, ${pct(zeroRate)} of rows had 0% active allocation and only ${pct(above50bp)} reached at least 0.50%.
- Kelly remains the dominant raw sizing bottleneck when the final decision allows exposure. The main reason is unchanged: EV/Kelly still applies trade-count and sample-quality penalties, and low-frequency trend following often does not generate enough closed trades.
- The graded validation fix did not create reckless exposure. Strong candidate remained rare, Failed Evidence remained blocking, and crypto remained stricter than equities/ETFs.

## 2. Replay Settings Used

- Assets: AAPL, SPY, QQQ, BTCUSDT, ETHUSDT.
- Rebalance intervals: 63 trading/calendar rows and 5 trading/calendar rows.
- Starting capital for paper replay metrics: ${money(STARTING_CAPITAL)}.
- Data source path: \`fetchMarketDataWithFallback(... chartRangeRequested: "max")\`, using dense \`backtestCandles\`.
- Analysis path: existing production \`analyzeMarketData\`.
- Strategy behavior changed: none.
- Kelly behavior changed: none.
- Historical replay is not live paper trading.

## 3. Asset-by-Asset Validation State Distribution

${table(["Symbol", "Rebalance Days", "Rows", "Validation Evidence Distribution"], validationRows)}

## 4. Asset-by-Asset Final Decision Distribution

${table(["Symbol", "Rebalance Days", "Rows", "Final Decision Distribution"], decisionRows)}

## 5. Allocation Bucket Distribution

${table(["Symbol", "Rebalance Days", "Rows", "Active Allocation Bucket Distribution"], allocationRows)}

## 6. Average Allocations

${table(
  [
    "Symbol",
    "Rebalance Days",
    "Avg finalPositionSize",
    "Avg activeAllocation",
    "Median activeAllocation",
    "Max activeAllocation",
    "Avg nonzero allocation",
    "% active > 0",
    "% active >= 0.25%",
    "% active >= 0.50%",
    "% active >= 1.00%"
  ],
  averageRows
)}

## 7. Kelly Diagnostics

${table(
  [
    "Symbol",
    "Rebalance Days",
    "Avg Kelly",
    "Median Kelly",
    "Max Kelly",
    "Kelly Bucket Distribution",
    "Avg Kelly Trade Count",
    "Sample Quality Distribution",
    "Trade Count Multiplier Distribution",
    "Sample Multiplier Distribution",
    "% EV <= 0"
  ],
  kellyRows
)}

## 8. Bottleneck Attribution

${table(
  [
    "Symbol",
    "Rebalance Days",
    "Most Common Bottleneck",
    "Second Bottleneck",
    "% Kelly Bottleneck",
    "% Final Decision Zeroing",
    "% Validation State Block",
    "% EV <= 0",
    "% Drawdown Bottleneck",
    "Full Bottleneck Distribution"
  ],
  bottleneckRows
)}

## 9. Replay Performance Metrics

${table(
  [
    "Symbol",
    "Rebalance Days",
    "Total Return",
    "Annualized Return",
    "Max Drawdown",
    "Sharpe",
    "Sortino",
    "Trades",
    "Avg Trade Allocation",
    "Buy/Hold Benchmark",
    "Fees/Slippage Impact"
  ],
  performanceRows
)}

## 10. Before/After Comparison

Previous baseline allocations were the known pre-graded-validation replay problem values. The comparison below uses the 63-day replay because that was the clearest prior reference point.

${table(
  [
    "Symbol",
    "Previous Avg Active Allocation",
    "Current Avg Active Allocation",
    "Change",
    "Current Zero-Allocation Dates",
    "Small Allocation Count",
    "Position Allowed Count",
    "Strong Candidate Count"
  ],
  beforeAfterRows
)}

Interpretation:

- Average active allocations did not materially improve enough to become economically meaningful.
- Zero-allocation dates remain high.
- Small allocation labels now appear only when the model actually has a nonzero active allocation.
- Position allowed appears only when validation evidence, risk, signal, EV, and minimum allocation constraints align.
- Strong candidate remains appropriately rare.
- Weak Evidence is now visible and no longer mislabeled as a hard validation data failure, but it does not automatically overcome Kelly/sample penalties.
- Failed Evidence still blocks allocation.
- Crypto remains stricter than equities/ETFs.

## 11. Is Validation Still The Main Bottleneck?

Validation is no longer the sole explanation. The graded evidence model fixed the old false framing where nearly everything collapsed into Insufficient Data. However, validation still blocks rows that are truly No Evidence or Failed Evidence, and it still prevents normal Position allowed labels unless the evidence reaches Moderate or Strong.

In practical terms: validation is now a confidence gate, not the dominant capital starvation mechanism on every row.

## 12. Is Kelly Now The Main Bottleneck?

Yes. Kelly is still the main sizing bottleneck whenever the system gets past data quality, EV, and decision gating. This is consistent with the unchanged production formula:

\`\`\`text
FinalPositionSize = min(
  VolatilityTargetAllocation,
  FractionalKellyAllocation,
  AssetClassMaxAllocation,
  DrawdownAdjustedAllocation
)
\`\`\`

The Kelly layer remains conservative because:

- Negative EV after costs forces Kelly to 0.
- Poor sample quality forces Kelly to 0.
- Limited sample quality applies a 0.25x multiplier.
- Trade counts below ${DEFAULT_QUANT_CONFIG.validation.minTotalTrades} force the trade-count multiplier to 0.
- Trade counts below ${DEFAULT_QUANT_CONFIG.limitedSampleTradeCount} apply a 0.35x multiplier.
- The strategy is low-frequency, so closed trade samples often stay small for long stretches.

## 13. Recommended Next Step

Do not raise Kelly yet.

The next safest step is a Kelly/sample-penalty audit, not a strategy change. Specifically:

1. Confirm whether the trade-count multiplier hard-zero below ${DEFAULT_QUANT_CONFIG.validation.minTotalTrades} is too binary for a low-frequency trend-following strategy.
2. Test a diagnostic-only graded trade-count multiplier, similar to the validation evidence model.
3. Keep production unchanged until the diagnostic shows that nonzero Kelly would be justified by positive EV after costs and tolerable drawdown.
4. Keep crypto separate and do not loosen crypto rules just because equity exposure remains too small.

Final verdict: the validation fix improved truthfulness and interpretability, but production replay remains a research prototype because Kelly/sample penalties still starve exposure.
`;

  writeFileSync("POST_VALIDATION_FIX_REPLAY_AUDIT.md", markdown);
  console.log("Wrote POST_VALIDATION_FIX_REPLAY_AUDIT.md");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
