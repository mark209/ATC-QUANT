import type { AssetType, MarketDataPoint, RiskProfile } from "@/types/asset";
import { averageDollarVolume, DEFAULT_QUANT_CONFIG } from "@/lib/quant/config";
import { analyzeMarketData } from "@/lib/quant/scoring";
import type { ExecutionEvent } from "@/lib/trading/executionEvent";
import type { LifecycleEvent } from "@/lib/trading/lifecycleEvent";
import type { TradeRecord } from "@/lib/trading/tradeJournal";
import type { FrozenDataset } from "./frozenDataset";
import type { RejectionStage } from "./decisionPipelineDiagnostics";

export type TraceStatus = "no signal" | RejectionStage | "proposal created" | "execution" | "completed trade";

export interface TraceValue {
  name: string;
  value: number | string | boolean;
  threshold: number | string | boolean | null;
  passed: boolean;
  source: "strategy" | "diagnostic gate";
}

export interface EvidenceTrace {
  name: string;
  score: number;
  weight: number;
  threshold: number;
  passed: boolean;
}

export interface RiskValidationTrace {
  name: string;
  actual_value: number | string;
  required_threshold: number | string;
  passed: boolean;
  reason: string;
}

export interface StrategyTraceRecord {
  replay_id: string;
  dataset_id: string;
  symbol: string;
  timeframe: string;
  timestamp: string;
  candle_index: number;
  candle: Pick<MarketDataPoint, "date" | "timestamp" | "open" | "high" | "low" | "close" | "volume" | "quoteVolume">;
  inputs: { history_candles: number; current_close: number; current_volume: number };
  pipeline_stage_reached: string;
  final_status: TraceStatus;
  rejection_reason: string | null;
  signal: {
    components: readonly TraceValue[];
    combined_score: number;
    required_score: number;
    passed: boolean;
    reasons: readonly string[];
    warnings: readonly string[];
  } | null;
  evidence: {
    items: readonly EvidenceTrace[];
    total_evidence_score: number;
    required_evidence_score: number;
    passed: boolean;
    hard_filters: readonly string[];
    validation_score: number;
  } | null;
  risk: {
    validations: readonly RiskValidationTrace[];
    combined_score: number;
    required_score: number;
    passed: boolean;
    warnings: readonly string[];
  } | null;
  ev: {
    win_probability: number;
    average_win: number;
    average_loss: number;
    expected_value: number;
    minimum_ev: number;
    passed: boolean;
  } | null;
  kelly: {
    raw_kelly: number;
    capped_kelly: number;
    final_allocation: number;
    minimum_allocation: number;
    passed: boolean;
    zero_allocation_reason: string | null;
  } | null;
  execution: { filled: boolean; completed: boolean; event_count: number };
}

export interface StrategyTraceReport {
  schema_version: string;
  replay_id: string;
  dataset_id: string;
  generated_at: string;
  processed_candles: number;
  warmup_exclusions: number;
  counts: Record<string, number>;
  rejection_summary: readonly { stage: string; count: number; percentage: number; top_reasons: readonly { reason: string; count: number }[] }[];
  hotspots: {
    most_restrictive_rule: string;
    most_restrictive_threshold: string;
    most_common_rejection_reason: string;
    rules_that_never_pass: readonly string[];
    rules_that_always_pass: readonly string[];
    warmup_related_exclusions: number;
  };
  timeline: readonly { timestamp: string; pipeline_stage: string; decision: string; rejection_reason: string | null }[];
}

const WARMUP_CANDLES = 60;
const SIGNAL_GATE = 45;
const EVIDENCE_GATE = 50;
const RISK_GATE = 45;
const EV_GATE = 0;
const ALLOCATION_GATE = 0;

function firstReason(stage: TraceStatus, analysis: ReturnType<typeof analyzeMarketData>): string | null {
  if (stage === "signal rejected") return analysis.pipeline.signal.warnings[0] ?? "Combined technical signal score did not meet the diagnostic signal gate.";
  if (stage === "evidence rejected") return analysis.pipeline.hardFilters.blockingReason ?? analysis.pipeline.validation.warnings[0] ?? "Evidence did not meet the diagnostic evidence gate.";
  if (stage === "risk rejected") return analysis.pipeline.risk.warnings[0] ?? "Risk validation did not meet the diagnostic risk gate.";
  if (stage === "EV rejected") return analysis.pipeline.expectedValue.warnings[0] ?? "Expected value did not pass after costs and sample-size adjustment.";
  if (stage === "Kelly rejected") return analysis.positionSizing.warnings[0] ?? "Kelly allocation was below the executable allocation threshold.";
  return null;
}

function traceCandle(candle: MarketDataPoint): StrategyTraceRecord["candle"] {
  return { date: candle.date, timestamp: candle.timestamp, open: candle.open, high: candle.high, low: candle.low, close: candle.close, volume: candle.volume, quoteVolume: candle.quoteVolume };
}

function buildTrace(input: {
  replayId: string;
  dataset: FrozenDataset;
  assetType: AssetType;
  riskProfile: RiskProfile;
  index: number;
  analysis: ReturnType<typeof analyzeMarketData> | null;
  executionEvents: readonly ExecutionEvent[];
  lifecycleEvents: readonly LifecycleEvent[];
  trades: readonly TradeRecord[];
}): StrategyTraceRecord {
  const candle = input.dataset.candles[input.index];
  const timestamp = new Date(candle.timestamp).toISOString();
  const executionEvents = input.executionEvents.filter((event) => event.timestamp_utc === timestamp);
  const completed = executionEvents.some((event) => event.event_type === "ORDER_FILLED") && input.trades.length > 0;
  if (!input.analysis) return { replay_id: input.replayId, dataset_id: input.dataset.dataset_id, symbol: input.dataset.symbol, timeframe: input.dataset.timeframe, timestamp, candle_index: input.index, candle: traceCandle(candle), inputs: { history_candles: input.index, current_close: candle.close, current_volume: candle.volume }, pipeline_stage_reached: "warm-up", final_status: "no signal", rejection_reason: `Warm-up exclusion: replay requires ${WARMUP_CANDLES} historical candles before analysis.`, signal: null, evidence: null, risk: null, ev: null, kelly: null, execution: { filled: false, completed: false, event_count: 0 } };

  const analysis = input.analysis;
  const signal = analysis.pipeline.signal;
  const technicalSignal = signal.combinedSignalScore >= SIGNAL_GATE;
  const evidencePass = technicalSignal && analysis.pipeline.dataQuality.passed && analysis.pipeline.hardFilters.passed && analysis.pipeline.validation.validationScore >= EVIDENCE_GATE;
  const riskPass = evidencePass && analysis.pipeline.risk.combinedRiskScore >= RISK_GATE && analysis.pipeline.risk.drawdownLabel !== "Risk-Off";
  const evPass = riskPass && analysis.pipeline.expectedValue.passed;
  const kellyPass = evPass && analysis.positionSizing.finalAllocation > ALLOCATION_GATE;
  const proposal = kellyPass && analysis.pipeline.finalDecision.finalPositionSize > ALLOCATION_GATE;
  let status: TraceStatus = "proposal created";
  if (!technicalSignal) status = "signal rejected";
  else if (!evidencePass) status = "evidence rejected";
  else if (!riskPass) status = "risk rejected";
  else if (!evPass) status = "EV rejected";
  else if (!kellyPass) status = "Kelly rejected";
  else if (!proposal) status = "lifecycle rejected";
  else if (completed) status = "completed trade";
  else if (executionEvents.some((event) => event.status === "rejected")) status = "execution rejected";
  else if (input.lifecycleEvents.some((event) => event.event_type === "TRADE_REJECTED" && event.timestamp_utc === timestamp)) status = "lifecycle rejected";
  else if (executionEvents.some((event) => event.event_type === "ORDER_FILLED")) status = "execution";

  const componentThresholds: Record<string, number> = { Trend: 70, Momentum: 65, Regime: 50, Combined: SIGNAL_GATE };
  const componentValues: Array<[string, number]> = [["Trend", signal.trendScore], ["Momentum", signal.momentumScore], ["Regime", signal.regimeScore], ["Combined", signal.combinedSignalScore]];
  const signalComponents = componentValues.map(([name, value]) => ({ name, value, threshold: componentThresholds[name], passed: value >= componentThresholds[name], source: name === "Combined" ? "diagnostic gate" as const : "strategy" as const }));
  const evidenceItems = analysis.investability.signals.map((item) => ({ name: item.name, score: item.score, weight: item.weight, threshold: 65, passed: item.score >= 65 }));
  const totalEvidenceScore = evidenceItems.reduce((sum, item) => sum + item.score * item.weight, 0);
  const dollarVolume = averageDollarVolume(analysisInput(input));
  const maxVolatility = DEFAULT_QUANT_CONFIG.maxRealizedVolatility[input.assetType];
  const maxDrawdown = DEFAULT_QUANT_CONFIG.maxDrawdown[input.assetType];
  const minLiquidity = DEFAULT_QUANT_CONFIG.liquidityMinimums[input.assetType];
  const riskValidations = [
    { name: "combined risk score", actual_value: analysis.pipeline.risk.combinedRiskScore, required_threshold: RISK_GATE, passed: analysis.pipeline.risk.combinedRiskScore >= RISK_GATE, reason: analysis.pipeline.risk.combinedRiskScore >= RISK_GATE ? "Risk score passed." : "Risk score was below the diagnostic risk gate." },
    { name: "drawdown regime", actual_value: analysis.pipeline.risk.drawdownLabel, required_threshold: "not Risk-Off", passed: analysis.pipeline.risk.drawdownLabel !== "Risk-Off", reason: analysis.pipeline.risk.drawdownLabel !== "Risk-Off" ? "Drawdown regime passed." : "Drawdown regime is Risk-Off." },
    { name: "realized volatility", actual_value: analysis.riskMetrics.annualizedVolatility, required_threshold: maxVolatility, passed: analysis.riskMetrics.annualizedVolatility <= maxVolatility, reason: analysis.riskMetrics.annualizedVolatility <= maxVolatility ? "Volatility is within the hard limit." : "Realized volatility exceeded the hard limit." },
    { name: "maximum drawdown", actual_value: analysis.riskMetrics.maxDrawdown, required_threshold: maxDrawdown, passed: analysis.riskMetrics.maxDrawdown >= maxDrawdown, reason: analysis.riskMetrics.maxDrawdown >= maxDrawdown ? "Maximum drawdown is within the hard limit." : "Maximum drawdown exceeded the hard limit." },
    { name: "average dollar volume", actual_value: dollarVolume, required_threshold: minLiquidity, passed: dollarVolume >= minLiquidity, reason: dollarVolume >= minLiquidity ? "Liquidity passed the hard minimum." : "Liquidity was below the hard minimum." }
  ];
  const zeroAllocationReason = analysis.positionSizing.finalAllocation > 0 ? null : analysis.positionSizing.warnings.join(" ") || `Allocation was zero because ${analysis.positionSizing.limitingFactor} evaluated to zero.`;
  return { replay_id: input.replayId, dataset_id: input.dataset.dataset_id, symbol: input.dataset.symbol, timeframe: input.dataset.timeframe, timestamp, candle_index: input.index, candle: traceCandle(candle), inputs: { history_candles: input.index, current_close: candle.close, current_volume: candle.volume }, pipeline_stage_reached: status === "proposal created" || status === "execution" || status === "completed trade" ? "proposal" : status, final_status: status, rejection_reason: firstReason(status, analysis), signal: { components: signalComponents, combined_score: signal.combinedSignalScore, required_score: SIGNAL_GATE, passed: technicalSignal, reasons: signal.reasons, warnings: signal.warnings }, evidence: { items: evidenceItems, total_evidence_score: totalEvidenceScore, required_evidence_score: EVIDENCE_GATE, passed: evidencePass, hard_filters: analysis.pipeline.hardFilters.failedFilters, validation_score: analysis.pipeline.validation.validationScore }, risk: { validations: riskValidations, combined_score: analysis.pipeline.risk.combinedRiskScore, required_score: RISK_GATE, passed: riskPass, warnings: analysis.pipeline.risk.warnings }, ev: { win_probability: analysis.pipeline.expectedValue.winRate, average_win: analysis.pipeline.expectedValue.averageWin, average_loss: analysis.pipeline.expectedValue.averageLoss, expected_value: analysis.pipeline.expectedValue.expectedValueAfterCosts, minimum_ev: EV_GATE, passed: evPass }, kelly: { raw_kelly: analysis.positionSizing.fractionalKellyAllocation, capped_kelly: analysis.positionSizing.fractionalKellyAllocation, final_allocation: analysis.positionSizing.finalAllocation, minimum_allocation: ALLOCATION_GATE, passed: kellyPass, zero_allocation_reason: zeroAllocationReason }, execution: { filled: executionEvents.some((event) => event.event_type === "ORDER_FILLED"), completed, event_count: executionEvents.length } };
}

function analysisInput(input: { dataset: FrozenDataset; index: number }): MarketDataPoint[] {
  return input.dataset.candles.slice(0, input.index);
}

export function generateStrategyTrace(input: { replayId: string; dataset: FrozenDataset; assetType: AssetType; riskProfile: RiskProfile; executionEvents: readonly ExecutionEvent[]; lifecycleEvents?: readonly LifecycleEvent[]; trades: readonly TradeRecord[]; warmupCandles?: number }): readonly StrategyTraceRecord[] {
  const warmup = input.warmupCandles ?? WARMUP_CANDLES;
  return input.dataset.candles.map((_, index) => buildTrace({ ...input, lifecycleEvents: input.lifecycleEvents ?? [], index, analysis: index < warmup ? null : analyzeMarketData(input.dataset.candles.slice(0, index), input.assetType, input.dataset.symbol, input.riskProfile) }));
}

function percent(count: number, denominator: number): number { return denominator === 0 ? 0 : Number(((count / denominator) * 100).toFixed(2)); }

export function buildStrategyTraceReport(input: { replayId: string; datasetId: string; generatedAt: string; traces: readonly StrategyTraceRecord[] }): StrategyTraceReport {
  const processed = input.traces.filter((trace) => trace.pipeline_stage_reached !== "warm-up");
  const statuses: TraceStatus[] = ["signal rejected", "evidence rejected", "risk rejected", "EV rejected", "Kelly rejected", "proposal created", "execution", "completed trade"];
  const counts: Record<string, number> = { "no signal": input.traces.filter((trace) => trace.final_status === "no signal").length };
  for (const status of statuses) counts[status] = input.traces.filter((trace) => trace.final_status === status).length;
  const denominator = processed.length;
  const rejectionSummary = ["signal rejected", "evidence rejected", "risk rejected", "EV rejected", "Kelly rejected", "lifecycle rejected", "execution rejected"].map((stage) => {
    const matches = input.traces.filter((trace) => trace.final_status === stage);
    const reasons: Record<string, number> = {};
    for (const trace of matches) if (trace.rejection_reason) reasons[trace.rejection_reason] = (reasons[trace.rejection_reason] ?? 0) + 1;
    return { stage, count: matches.length, percentage: percent(matches.length, denominator), top_reasons: Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([reason, count]) => ({ reason, count })) };
  });
  const ruleCounts: Record<string, { pass: number; fail: number }> = {};
  for (const trace of processed) for (const item of [...(trace.signal?.components ?? []), ...(trace.risk?.validations ?? []).map((item) => ({ name: item.name, passed: item.passed }))]) { const rule = item.name; const current = ruleCounts[rule] ?? { pass: 0, fail: 0 }; item.passed ? current.pass += 1 : current.fail += 1; ruleCounts[rule] = current; }
  const mostRestrictive = Object.entries(ruleCounts).sort((a, b) => b[1].fail - a[1].fail)[0];
  const thresholdFails = processed.flatMap((trace) => [...(trace.signal?.components ?? []), ...(trace.risk?.validations ?? []).map((item) => ({ name: item.name, passed: item.passed, threshold: item.required_threshold }))]).filter((item) => !item.passed);
  const thresholdCounts: Record<string, number> = {};
  for (const item of thresholdFails) thresholdCounts[`${item.name} threshold ${item.threshold}`] = (thresholdCounts[`${item.name} threshold ${item.threshold}`] ?? 0) + 1;
  const mostThreshold = Object.entries(thresholdCounts).sort((a, b) => b[1] - a[1])[0];
  const reasonCounts: Record<string, number> = {};
  for (const trace of processed) if (trace.rejection_reason) reasonCounts[trace.rejection_reason] = (reasonCounts[trace.rejection_reason] ?? 0) + 1;
  const mostReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0];
  return { schema_version: "1.0", replay_id: input.replayId, dataset_id: input.datasetId, generated_at: input.generatedAt, processed_candles: denominator, warmup_exclusions: counts["no signal"], counts, rejection_summary: rejectionSummary, hotspots: { most_restrictive_rule: mostRestrictive ? `${mostRestrictive[0]} (${mostRestrictive[1].fail} failures)` : "none", most_restrictive_threshold: mostThreshold ? `${mostThreshold[0]} (${mostThreshold[1]} failures)` : "none", most_common_rejection_reason: mostReason ? `${mostReason[0]} (${mostReason[1]})` : "none", rules_that_never_pass: Object.entries(ruleCounts).filter(([, value]) => value.pass === 0).map(([name]) => name), rules_that_always_pass: Object.entries(ruleCounts).filter(([, value]) => value.fail === 0).map(([name]) => name), warmup_related_exclusions: counts["no signal"] }, timeline: input.traces.map((trace) => ({ timestamp: trace.timestamp, pipeline_stage: trace.pipeline_stage_reached, decision: trace.final_status, rejection_reason: trace.rejection_reason })) };
}

export function renderStrategyTraceReport(report: StrategyTraceReport): string {
  const countLines = Object.entries(report.counts).map(([name, count]) => `${name}: ${count}`).join("\n");
  const rejectionLines = report.rejection_summary.map((item) => `${item.stage}: ${item.count} (${item.percentage}%)\n${item.top_reasons.map((reason) => `  ${reason.count}x ${reason.reason}`).join("\n")}`).join("\n");
  return [`Strategy Trace & Explainability Report: ${report.replay_id}`, `Dataset: ${report.dataset_id}`, `Generated: ${report.generated_at}`, "", "Decision tree counts", countLines, "", "Rejection stages", rejectionLines, "", "Hotspot analysis", `Most restrictive rule: ${report.hotspots.most_restrictive_rule}`, `Most restrictive threshold: ${report.hotspots.most_restrictive_threshold}`, `Most common rejection reason: ${report.hotspots.most_common_rejection_reason}`, `Rules that never pass: ${report.hotspots.rules_that_never_pass.join(", ") || "none"}`, `Rules that always pass: ${report.hotspots.rules_that_always_pass.join(", ") || "none"}`, `Warm-up exclusions: ${report.hotspots.warmup_related_exclusions}`, "", "Timeline", ...report.timeline.map((entry) => `${entry.timestamp} | ${entry.pipeline_stage} | ${entry.decision}${entry.rejection_reason ? ` | ${entry.rejection_reason}` : ""}`)].join("\n");
}
