import type { AssetType, RiskProfile } from "@/types/asset";
import type { ExecutionEvent } from "@/lib/trading/executionEvent";
import type { LifecycleEvent } from "@/lib/trading/lifecycleEvent";
import type { TradeRecord } from "@/lib/trading/tradeJournal";
import { analyzeMarketData } from "@/lib/quant/scoring";
import type { FrozenDataset } from "./frozenDataset";

export type RejectionStage = "signal rejected" | "evidence rejected" | "risk rejected" | "EV rejected" | "Kelly rejected" | "execution rejected" | "lifecycle rejected";

export interface PipelineFunnel {
  historicalCandles: number;
  technicalSignals: number;
  evidenceQualifiedSignals: number;
  riskApprovedSignals: number;
  expectedValueEvaluations: number;
  kellyEvaluations: number;
  tradeProposals: number;
  tradeExecutions: number;
  completedTrades: number;
}

export interface RejectionRecord {
  replay_id: string;
  timestamp: string;
  symbol: string;
  timeframe: string;
  rejection_stage: RejectionStage;
  rejection_reason: string;
  evidence_score: number;
  confidence_score: number;
  ev_value: number;
  kelly_fraction: number;
  volatility_regime: string;
  liquidity_regime: string;
  market_regime: string;
}

export interface EVDiagnostic {
  timestamp: string;
  win_probability: number;
  average_win: number;
  average_loss: number;
  calculated_ev: number;
  minimum_ev_threshold: number;
  passed: boolean;
}

export interface KellyDiagnostic {
  timestamp: string;
  kelly_fraction: number;
  capped_kelly: number;
  final_allocation: number;
  minimum_allocation_threshold: number;
  passed: boolean;
  zero_allocation_reason: string | null;
}

export interface DecisionTimelineEntry {
  timestamp: string;
  technical_signal: boolean;
  evidence_qualified: boolean;
  risk_approved: boolean;
  ev_passed: boolean;
  kelly_passed: boolean;
  trade_proposed: boolean;
  execution_filled: boolean;
  completed_trade: boolean;
  rejection_stage: RejectionStage | null;
  rejection_reason: string | null;
}

export interface DecisionPipelineDiagnostics {
  schema_version: string;
  replay_id: string;
  generated_at: string;
  symbol: string;
  timeframe: string;
  funnel: PipelineFunnel;
  rejection_histogram: Record<RejectionStage, number>;
  rejection_reasons: Record<string, number>;
  rejections: readonly RejectionRecord[];
  ev_diagnostics: readonly EVDiagnostic[];
  kelly_diagnostics: readonly KellyDiagnostic[];
  timeline: readonly DecisionTimelineEntry[];
  most_restrictive_filters: readonly { filter: string; rejected: number }[];
  trade_opportunity_summary: string;
}

export interface DecisionPipelineSnapshot {
  pipeline: {
    signal: { combinedSignalScore: number; reasons: readonly string[]; regimeLabel: string };
    dataQuality: { passed: boolean };
    hardFilters: { passed: boolean; blockingReason?: string; warnings: readonly string[] };
    validation: { validationScore: number; warnings: readonly string[] };
    risk: { combinedRiskScore: number; drawdownLabel: string; warnings: readonly string[]; liquidityScore: number; liquidityLabel: string };
    expectedValue: { winRate: number; averageWin: number; averageLoss: number; expectedValueAfterCosts: number; passed: boolean; warnings: readonly string[] };
    finalDecision: { finalPositionSize: number };
  };
  investability: { score: number };
  positionSizing: { fractionalKellyAllocation: number; finalAllocation: number; warnings: readonly string[]; limitingFactor: string };
  riskMetrics: { annualizedVolatility: number };
}

export interface DecisionPipelineObservation {
  timestamp: string;
  analysis: DecisionPipelineSnapshot;
}

export function snapshotDecisionPipeline(analysis: ReturnType<typeof analyzeMarketData>): DecisionPipelineSnapshot {
  return {
    pipeline: {
      signal: { combinedSignalScore: analysis.pipeline.signal.combinedSignalScore, reasons: analysis.pipeline.signal.reasons, regimeLabel: analysis.pipeline.signal.regimeLabel },
      dataQuality: { passed: analysis.pipeline.dataQuality.passed },
      hardFilters: { passed: analysis.pipeline.hardFilters.passed, blockingReason: analysis.pipeline.hardFilters.blockingReason, warnings: analysis.pipeline.hardFilters.warnings },
      validation: { validationScore: analysis.pipeline.validation.validationScore, warnings: analysis.pipeline.validation.warnings },
      risk: { combinedRiskScore: analysis.pipeline.risk.combinedRiskScore, drawdownLabel: analysis.pipeline.risk.drawdownLabel, warnings: analysis.pipeline.risk.warnings, liquidityScore: analysis.pipeline.risk.liquidityScore, liquidityLabel: analysis.pipeline.risk.liquidityLabel },
      expectedValue: { winRate: analysis.pipeline.expectedValue.winRate, averageWin: analysis.pipeline.expectedValue.averageWin, averageLoss: analysis.pipeline.expectedValue.averageLoss, expectedValueAfterCosts: analysis.pipeline.expectedValue.expectedValueAfterCosts, passed: analysis.pipeline.expectedValue.passed, warnings: analysis.pipeline.expectedValue.warnings },
      finalDecision: { finalPositionSize: analysis.pipeline.finalDecision.finalPositionSize }
    },
    investability: { score: analysis.investability.score },
    positionSizing: { fractionalKellyAllocation: analysis.positionSizing.fractionalKellyAllocation, finalAllocation: analysis.positionSizing.finalAllocation, warnings: analysis.positionSizing.warnings, limitingFactor: analysis.positionSizing.limitingFactor },
    riskMetrics: { annualizedVolatility: analysis.riskMetrics.annualizedVolatility }
  };
}

const REJECTION_STAGES: RejectionStage[] = ["signal rejected", "evidence rejected", "risk rejected", "EV rejected", "Kelly rejected", "execution rejected", "lifecycle rejected"];

function firstReason(analysis: DecisionPipelineSnapshot, stage: RejectionStage): string {
  if (stage === "signal rejected") return analysis.pipeline.signal.reasons[0] ?? "Combined technical signal score did not meet the signal gate.";
  if (stage === "evidence rejected") return analysis.pipeline.hardFilters.blockingReason ?? analysis.pipeline.validation.warnings[0] ?? "Evidence did not qualify the opportunity.";
  if (stage === "risk rejected") return analysis.pipeline.risk.warnings[0] ?? `Risk score ${analysis.pipeline.risk.combinedRiskScore.toFixed(2)} did not meet the risk gate.`;
  if (stage === "EV rejected") return analysis.pipeline.expectedValue.warnings[0] ?? "Expected value did not pass after costs and sample-quality adjustment.";
  if (stage === "Kelly rejected") return analysis.positionSizing.warnings[0] ?? `Kelly allocation ${analysis.positionSizing.finalAllocation.toFixed(6)} was below the executable allocation threshold.`;
  return "Existing replay lifecycle or execution path rejected the proposal.";
}

function zeroAllocationReason(analysis: DecisionPipelineSnapshot): string | null {
  if (analysis.positionSizing.finalAllocation > 0) return null;
  return analysis.positionSizing.warnings.join(" ") || `Allocation was zero because ${analysis.positionSizing.limitingFactor} evaluated to zero.`;
}

export function generateDecisionPipelineDiagnostics(input: {
  replayId: string;
  generatedAt: string;
  dataset: FrozenDataset;
  assetType: AssetType;
  riskProfile: RiskProfile;
  executionEvents: readonly ExecutionEvent[];
  lifecycleEvents: readonly LifecycleEvent[];
  trades: readonly TradeRecord[];
  warmupCandles?: number;
  observations?: readonly DecisionPipelineObservation[];
}): DecisionPipelineDiagnostics {
  const warmup = input.warmupCandles ?? 60;
  const observations = input.observations ?? Array.from({ length: Math.max(0, input.dataset.candles.length - warmup) }, (_, offset) => {
    const index = warmup + offset;
    return {
      timestamp: new Date(input.dataset.candles[index].timestamp).toISOString(),
      analysis: snapshotDecisionPipeline(analyzeMarketData(input.dataset.candles.slice(0, index), input.assetType, input.dataset.symbol, input.riskProfile))
    };
  });

  const rejectionHistogram = Object.fromEntries(REJECTION_STAGES.map((stage) => [stage, 0])) as Record<RejectionStage, number>;
  const rejectionReasons: Record<string, number> = {};
  const rejections: RejectionRecord[] = [];
  const evDiagnostics: EVDiagnostic[] = [];
  const kellyDiagnostics: KellyDiagnostic[] = [];
  const timeline: DecisionTimelineEntry[] = [];
  let evidenceQualifiedSignals = 0;
  let riskApprovedSignals = 0;
  let evEvaluations = 0;
  let kellyEvaluations = 0;
  let tradeProposals = 0;

  for (const observation of observations) {
    const { analysis } = observation;
    const technicalSignal = analysis.pipeline.signal.combinedSignalScore >= 45;
    const evidenceQualified = technicalSignal && analysis.pipeline.dataQuality.passed && analysis.pipeline.hardFilters.passed && analysis.pipeline.validation.validationScore >= 50;
    const riskApproved = evidenceQualified && analysis.pipeline.risk.combinedRiskScore >= 45 && analysis.pipeline.risk.drawdownLabel !== "Risk-Off";
    if (evidenceQualified) evidenceQualifiedSignals += 1;
    if (riskApproved) riskApprovedSignals += 1;
    const evEvaluated = riskApproved;
    const evPassed = evEvaluated && analysis.pipeline.expectedValue.passed;
    if (evEvaluated) {
      evEvaluations += 1;
      evDiagnostics.push({ timestamp: observation.timestamp, win_probability: analysis.pipeline.expectedValue.winRate, average_win: analysis.pipeline.expectedValue.averageWin, average_loss: analysis.pipeline.expectedValue.averageLoss, calculated_ev: analysis.pipeline.expectedValue.expectedValueAfterCosts, minimum_ev_threshold: 0, passed: analysis.pipeline.expectedValue.passed });
    }
    const kellyEvaluated = evPassed;
    const kellyPassed = kellyEvaluated && analysis.positionSizing.finalAllocation > 0;
    if (kellyEvaluated) {
      kellyEvaluations += 1;
      kellyDiagnostics.push({ timestamp: observation.timestamp, kelly_fraction: analysis.positionSizing.fractionalKellyAllocation, capped_kelly: analysis.positionSizing.fractionalKellyAllocation, final_allocation: analysis.positionSizing.finalAllocation, minimum_allocation_threshold: 0, passed: kellyPassed, zero_allocation_reason: zeroAllocationReason(analysis) });
    }
    const proposed = kellyPassed && analysis.pipeline.finalDecision.finalPositionSize > 0;
    if (proposed) tradeProposals += 1;
    let rejectionStage: RejectionStage | null = null;
    if (!technicalSignal) rejectionStage = "signal rejected";
    else if (!evidenceQualified) rejectionStage = "evidence rejected";
    else if (!riskApproved) rejectionStage = "risk rejected";
    else if (!evPassed) rejectionStage = "EV rejected";
    else if (!kellyPassed) rejectionStage = "Kelly rejected";
    if (rejectionStage) {
      const reason = firstReason(analysis, rejectionStage);
      rejectionHistogram[rejectionStage] += 1;
      rejectionReasons[reason] = (rejectionReasons[reason] ?? 0) + 1;
      rejections.push({ replay_id: input.replayId, timestamp: observation.timestamp, symbol: input.dataset.symbol, timeframe: input.dataset.timeframe, rejection_stage: rejectionStage, rejection_reason: reason, evidence_score: analysis.pipeline.validation.validationScore, confidence_score: analysis.investability.score, ev_value: analysis.pipeline.expectedValue.expectedValueAfterCosts, kelly_fraction: analysis.positionSizing.fractionalKellyAllocation, volatility_regime: analysis.riskMetrics.annualizedVolatility.toFixed(6), liquidity_regime: analysis.pipeline.risk.liquidityLabel, market_regime: analysis.pipeline.signal.regimeLabel });
    }
    timeline.push({ timestamp: observation.timestamp, technical_signal: technicalSignal, evidence_qualified: evidenceQualified, risk_approved: riskApproved, ev_passed: evPassed, kelly_passed: kellyPassed, trade_proposed: proposed, execution_filled: false, completed_trade: false, rejection_stage: rejectionStage, rejection_reason: rejectionStage ? rejections.at(-1)?.rejection_reason ?? null : null });
  }

  const filledEvents = input.executionEvents.filter((event) => event.event_type === "ORDER_FILLED" && event.filled_quantity > 0);
  const completedTrades = input.trades.length;
  const executionRejected = tradeProposals === 0 ? 0 : input.executionEvents.filter((event) => event.status === "rejected").length;
  const lifecycleRejected = tradeProposals === 0 ? 0 : input.lifecycleEvents.filter((event) => event.event_type === "TRADE_REJECTED").length;
  rejectionHistogram["execution rejected"] = executionRejected;
  rejectionHistogram["lifecycle rejected"] = lifecycleRejected;
  for (const entry of timeline) {
    const filled = filledEvents.some((event) => event.timestamp_utc === entry.timestamp);
    entry.execution_filled = filled;
    entry.completed_trade = filled && completedTrades > 0;
  }
  const filters = REJECTION_STAGES.map((filter) => ({ filter, rejected: rejectionHistogram[filter] })).sort((a, b) => b.rejected - a.rejected);
  const top = filters[0];
  return {
    schema_version: "1.0",
    replay_id: input.replayId,
    generated_at: input.generatedAt,
    symbol: input.dataset.symbol,
    timeframe: input.dataset.timeframe,
    funnel: { historicalCandles: input.dataset.candles.length, technicalSignals: observations.length, evidenceQualifiedSignals, riskApprovedSignals, expectedValueEvaluations: evEvaluations, kellyEvaluations, tradeProposals, tradeExecutions: filledEvents.length, completedTrades },
    rejection_histogram: rejectionHistogram,
    rejection_reasons: rejectionReasons,
    rejections,
    ev_diagnostics: evDiagnostics,
    kelly_diagnostics: kellyDiagnostics,
    timeline,
    most_restrictive_filters: filters,
    trade_opportunity_summary: top ? `${completedTrades} completed trades from ${tradeProposals} proposals. The most restrictive filter was ${top.filter} with ${top.rejected} rejection(s).` : "No decision opportunities reached the diagnostic pipeline."
  };
}

export function renderDecisionPipelineReport(diagnostics: DecisionPipelineDiagnostics): string {
  const funnel = diagnostics.funnel;
  const histogram = Object.entries(diagnostics.rejection_histogram).map(([stage, count]) => `${stage}: ${count}`).join("\n");
  const filters = diagnostics.most_restrictive_filters.map((item) => `${item.filter}: ${item.rejected}`).join("\n");
  const evValues = diagnostics.ev_diagnostics.map((item) => item.calculated_ev);
  const kellyValues = diagnostics.kelly_diagnostics.map((item) => item.final_allocation);
  const distribution = (values: number[]) => values.length ? `count=${values.length}, min=${Math.min(...values).toFixed(6)}, max=${Math.max(...values).toFixed(6)}, average=${(values.reduce((a, b) => a + b, 0) / values.length).toFixed(6)}` : "count=0";
  return [`Decision Pipeline Diagnostics: ${diagnostics.replay_id}`, `Generated: ${diagnostics.generated_at}`, "", "Pipeline funnel", `Historical candles: ${funnel.historicalCandles}`, `Technical signals: ${funnel.technicalSignals}`, `Evidence-qualified signals: ${funnel.evidenceQualifiedSignals}`, `Risk-approved signals: ${funnel.riskApprovedSignals}`, `Expected Value evaluations: ${funnel.expectedValueEvaluations}`, `Kelly evaluations: ${funnel.kellyEvaluations}`, `Trade proposals: ${funnel.tradeProposals}`, `Trade executions: ${funnel.tradeExecutions}`, `Completed trades: ${funnel.completedTrades}`, "", "Rejection histogram", histogram, "", "Most restrictive filters", filters, "", `EV distribution: ${distribution(evValues)}`, `Kelly distribution: ${distribution(kellyValues)}`, "", "Top rejection reasons", ...Object.entries(diagnostics.rejection_reasons).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([reason, count]) => `${count}x ${reason}`), "", "Trade opportunity summary", diagnostics.trade_opportunity_summary, "", "Decision timeline", ...diagnostics.timeline.map((entry) => `${entry.timestamp} | signal=${entry.technical_signal} evidence=${entry.evidence_qualified} risk=${entry.risk_approved} ev=${entry.ev_passed} kelly=${entry.kelly_passed} proposal=${entry.trade_proposed}${entry.rejection_stage ? ` | ${entry.rejection_stage}: ${entry.rejection_reason}` : ""}`)].join("\n");
}
