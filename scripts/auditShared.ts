import type { AssetType, MarketDataPoint } from "@/types/asset";
import type { QuantAnalysis } from "@/types/quant";
import { fetchMarketDataWithFallback } from "@/lib/data/marketDataAdapter";
import { simulatePaperPortfolio, type PaperReplayResult, type ReplayResultRow } from "@/lib/quant/historicalReplay";
import { analyzeMarketData } from "@/lib/quant/scoring";

export interface AuditAsset {
  symbol: string;
  assetType: AssetType;
}

export interface AuditDataset {
  asset: AuditAsset;
  candles: MarketDataPoint[];
}

export interface ExplainedReplayRow extends ReplayResultRow {
  explanation: string;
  sizingWarnings: string[];
}

export interface ReplayBundle {
  rows: ExplainedReplayRow[];
  portfolio: PaperReplayResult;
}

export const AUDIT_ASSETS: AuditAsset[] = [
  { symbol: "SPY", assetType: "etf" },
  { symbol: "QQQ", assetType: "etf" },
  { symbol: "AAPL", assetType: "stock" },
  { symbol: "BTCUSDT", assetType: "crypto" },
  { symbol: "ETHUSDT", assetType: "crypto" }
];

export const STARTING_CAPITAL = 100000;

const ACTIVE_DECISIONS = new Set(["Strong candidate", "Position allowed", "Small allocation only"]);

export function pct(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  return `${(value * 100).toFixed(2)}%`;
}

export function ratio(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  return value.toFixed(3);
}

export function money(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  return `$${value.toFixed(2)}`;
}

export function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function sortedCandles(candles: MarketDataPoint[]): MarketDataPoint[] {
  return [...candles].sort((a, b) => a.timestamp - b.timestamp);
}

export function table(headers: string[], rows: Array<Array<string | number>>): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`)
  ].join("\n");
}

export function countBy(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

export function mostCommon(counts: Record<string, number>): string {
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "n/a";
}

export function distributionText(counts: Record<string, number>, total: number): string {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => `${label}: ${count} (${pct(count / Math.max(1, total))})`)
    .join("<br>");
}

export async function loadAuditDatasets(assets: AuditAsset[] = AUDIT_ASSETS): Promise<AuditDataset[]> {
  const datasets: AuditDataset[] = [];
  for (const asset of assets) {
    console.log(`Fetching historical data for ${asset.symbol}`);
    const data = await fetchMarketDataWithFallback({
      symbol: asset.symbol,
      assetType: asset.assetType,
      chartRangeRequested: "max"
    });
    datasets.push({ asset, candles: sortedCandles(data.backtestCandles) });
  }
  return datasets;
}

function rowFromAnalysis(asset: AuditAsset, candle: MarketDataPoint, analysis: QuantAnalysis): ExplainedReplayRow {
  const decision = analysis.pipeline.finalDecision;
  const expectedValue = analysis.pipeline.expectedValue;
  const activeAllocation = ACTIVE_DECISIONS.has(decision.decisionLabel) ? Math.max(0, decision.finalPositionSize) : 0;

  return {
    date: candle.date,
    symbol: asset.symbol,
    assetType: asset.assetType,
    finalDecision: decision.decisionLabel,
    activeAllocation,
    signalScore: decision.signalScore,
    riskScore: decision.riskScore,
    validationScore: decision.validationScore,
    validationEvidenceState: analysis.pipeline.validation.validationEvidenceState,
    evStatus: expectedValue.expectedValueAfterCosts <= 0 ? "EV failed" : expectedValue.passed ? "EV passed" : "EV limited",
    evAfterCosts: expectedValue.expectedValueAfterCosts,
    kellyAllocation: analysis.pipeline.positionSizing.fractionalKellyAllocation,
    dataQualityStatus: analysis.pipeline.dataQuality.passed ? "passed" : "failed",
    regimeLabel: analysis.pipeline.signal.regimeLabel,
    blockingReasons: decision.blockingReasons,
    warnings: Array.from(new Set([...decision.warnings, ...expectedValue.warnings])),
    explanation: analysis.pipeline.explanation.why,
    sizingWarnings: analysis.pipeline.positionSizing.warnings
  };
}

export function runExplainedReplay(input: {
  asset: AuditAsset;
  candles: MarketDataPoint[];
  rebalanceEveryDays: number;
  maxDecisionRows?: number;
}): ReplayBundle {
  const rows: ExplainedReplayRow[] = [];
  const startIndex = input.maxDecisionRows
    ? Math.max(0, input.candles.length - input.maxDecisionRows * input.rebalanceEveryDays)
    : 0;

  for (let index = startIndex; index < input.candles.length; index += input.rebalanceEveryDays) {
    const candle = input.candles[index];
    if (!candle) continue;
    const available = input.candles.slice(0, index + 1);
    const analysis = analyzeMarketData(available, input.asset.assetType, input.asset.symbol, "balanced");
    rows.push(rowFromAnalysis(input.asset, candle, analysis));
  }

  const portfolio = simulatePaperPortfolio({
    symbol: input.asset.symbol,
    assetType: input.asset.assetType,
    candles: input.candles,
    replayRows: rows,
    startingCapital: STARTING_CAPITAL
  });

  return { rows, portfolio };
}

export function buyAndHoldReturn(candles: MarketDataPoint[]): number {
  const first = candles[0]?.open ?? candles[0]?.close ?? 0;
  const last = candles.at(-1)?.close ?? first;
  return first === 0 ? 0 : last / first - 1;
}
