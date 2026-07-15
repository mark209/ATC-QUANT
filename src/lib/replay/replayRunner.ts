import { createHash } from "node:crypto";
import type { AssetType, MarketDataPoint } from "@/types/asset";
import { analyzeMarketData } from "@/lib/quant/scoring";
import type { ExecutionEvent } from "@/lib/trading/executionEvent";
import { calculateExecutionEventHash } from "@/lib/trading/executionEvent";
import { applyExecutionResultToLifecycle } from "@/lib/trading/executionLifecycleBridge";
import { ExecutionSimulator, EXECUTION_PROFILES, type ExecutionProfileName } from "@/lib/trading/executionSimulator";
import type { LifecycleEvent } from "@/lib/trading/lifecycleEvent";
import type { TradeRecord } from "@/lib/trading/tradeJournal";
import { TradeLifecycleEngine, type LifecycleMetadataProvider, type TradeProposal } from "@/lib/trading/tradeLifecycle";
import type { ReplayArtifacts, ReplayIdentity } from "@/lib/quant/replayVerification";
import { calculateHash } from "@/lib/quant/replayVerification";
import { createDatasetManifest, validateFrozenDataset, type FrozenDataset } from "./frozenDataset";
import { buildAnalyticsSnapshot, buildArtifactManifest, ReplayArtifactStore, type ReplayArtifactBundle, type ReplayManifest, type ReplayReportArtifact } from "./replayArtifacts";
import { generateDecisionPipelineDiagnostics, snapshotDecisionPipeline, type DecisionPipelineObservation } from "./decisionPipelineDiagnostics";
import { createTrendBacktestCache } from "@/lib/quant/backtest";

export const REPLAY_ENGINE_VERSION = "phase3-replay-1";

export interface ProductionReplayIdentity extends ReplayIdentity {
  dataset_id: string;
  strategy_git_commit: string;
  engine_version: string;
  replay_timestamp: string;
}

export interface ReplayRunnerOptions {
  asset_type: AssetType;
  risk_profile: "conservative" | "balanced" | "aggressive";
  root_directory?: string;
}

class MemoryLifecycleRepository {
  readonly events: LifecycleEvent[] = [];
  async append(event: LifecycleEvent): Promise<void> { this.events.push(event); }
  async appendMany(events: readonly LifecycleEvent[]): Promise<void> { this.events.push(...events); }
  async readAll(): Promise<LifecycleEvent[]> { return [...this.events]; }
  async findByTradeId(tradeId: string): Promise<LifecycleEvent[]> { return this.events.filter((event) => event.trade_id === tradeId); }
}

class MemoryTradeRepository {
  readonly records: TradeRecord[] = [];
  async append(record: TradeRecord): Promise<void> { this.records.push(record); }
  async appendMany(records: readonly TradeRecord[]): Promise<void> { this.records.push(...records); }
  async readAll(): Promise<TradeRecord[]> { return [...this.records]; }
  async findById(tradeId: string): Promise<TradeRecord | undefined> { return this.records.find((record) => record.trade_id === tradeId); }
  async has(tradeId: string): Promise<boolean> { return this.records.some((record) => record.trade_id === tradeId); }
}

function uuidFrom(input: string): string {
  const hex = createHash("sha256").update(input).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20)}`;
}

function supportedProfile(value: string): ExecutionProfileName {
  if (!(value in EXECUTION_PROFILES)) throw new Error(`unsupported execution profile ${value}`);
  return value as ExecutionProfileName;
}

function appendExecutionEvents(target: ExecutionEvent[], events: readonly ExecutionEvent[]): void {
  const tradeId = events[0]?.trade_id;
  if (!tradeId) return;
  let sequence = target.filter((event) => event.trade_id === tradeId).length;
  for (const event of events) {
    const normalized = { ...event, event_sequence: ++sequence, event_hash: "" } as ExecutionEvent;
    target.push(Object.freeze({ ...normalized, event_hash: calculateExecutionEventHash(normalized) }));
  }
}

function isEligible(analysis: ReturnType<typeof analyzeMarketData>): boolean {
  return analysis.positionSizing.finalAllocation > 0 && analysis.pipeline.finalDecision.finalPositionSize > 0 && analysis.pipeline.finalDecision.decisionLabel !== "Risk-off / no trade" && analysis.pipeline.finalDecision.decisionLabel !== "Avoid for now";
}

export class DeterministicReplayRunner {
  private readonly simulator = new ExecutionSimulator();
  private readonly artifactStore: ReplayArtifactStore;

  constructor(private readonly options: ReplayRunnerOptions) {
    this.artifactStore = new ReplayArtifactStore(options.root_directory ?? "replays");
  }

  async run(identity: ReplayIdentity, rawDataset: unknown): Promise<ReplayArtifacts> {
    return (await this.runAndPersist(identity as ProductionReplayIdentity, validateFrozenDataset(rawDataset as FrozenDataset), false)).artifacts;
  }

  async runAndPersist(identity: ProductionReplayIdentity, dataset: FrozenDataset, persist = true): Promise<ReplayArtifactBundle> {
    validateFrozenDataset(dataset);
    if (identity.dataset_id !== dataset.dataset_id || identity.dataset_version !== dataset.dataset_version || identity.dataset_hash !== dataset.dataset_hash) throw new Error("replay identity does not match frozen dataset");
    const profile = supportedProfile(identity.execution_profile);
    const lifecycleEvents: LifecycleEvent[] = [];
    const trades: TradeRecord[] = [];
    const executionEvents: ExecutionEvent[] = [];
    const decisions: Array<{ timestamp: string; eligible: boolean; allocation: number; label: string }> = [];
    const observations: DecisionPipelineObservation[] = [];
    const backtestCache = createTrendBacktestCache(dataset.candles);
    let open: { lifecycle: TradeLifecycleEngine; lifecycleRepository: MemoryLifecycleRepository; tradeRepository: MemoryTradeRepository; trade_id: string; quantity: number; timestamp: string } | null = null;
    let clockTimestamp = identity.replay_timestamp;

    for (let index = 60; index < dataset.candles.length; index += 1) {
      const current = dataset.candles[index];
      const history = dataset.candles.slice(0, index);
      const analysis = analyzeMarketData(history, this.options.asset_type, dataset.symbol, this.options.risk_profile, backtestCache);
      observations.push({ timestamp: new Date(current.timestamp).toISOString(), analysis: snapshotDecisionPipeline(analysis) });
      const eligible = isEligible(analysis);
      decisions.push({ timestamp: new Date(current.timestamp).toISOString(), eligible, allocation: analysis.positionSizing.finalAllocation, label: analysis.pipeline.finalDecision.decisionLabel });
      if (open && !eligible) {
        clockTimestamp = new Date(current.timestamp).toISOString();
        await this.closeOpenPosition(open, current, identity, dataset, profile, executionEvents);
        lifecycleEvents.push(...open.lifecycleRepository.events.filter((event) => !lifecycleEvents.some((known) => known.event_id === event.event_id)));
        trades.push(...open.tradeRepository.records.filter((trade) => !trades.some((known) => known.trade_id === trade.trade_id)));
        open = null;
      }
      if (!eligible) {
        const rejectedTradeId = uuidFrom(`${identity.replay_id}:${dataset.dataset_hash}:${current.timestamp}:rejected`);
        const rejectedEvents = new MemoryLifecycleRepository();
        const rejectedTrades = new MemoryTradeRepository();
        let rejectedSequence = 0;
        const rejectedLifecycle = new TradeLifecycleEngine(rejectedEvents, rejectedTrades, { uuid: () => uuidFrom(`${rejectedTradeId}:lifecycle:${++rejectedSequence}`), now: () => new Date(current.timestamp).toISOString() });
        await rejectedLifecycle.start({ trade_id: rejectedTradeId, strategy_version: identity.strategy_version, replay_id: identity.replay_id, data_snapshot_id: dataset.dataset_id, instrument: dataset.symbol, direction: "LONG", requested_quantity: 1, entry_decision_timestamp_utc: new Date(current.timestamp).toISOString(), stop_loss: current.close * 0.95, take_profit: current.close * 1.1, risk_percent: 0.0001, evidence_score: Math.max(0.0001, analysis.pipeline.validation.validationScore), confidence_score: Math.max(0.0001, analysis.pipeline.signal.combinedSignalScore), market_regime: analysis.pipeline.signal.regimeLabel, volatility_regime: analysis.riskMetrics.annualizedVolatility.toFixed(6), liquidity_regime: analysis.pipeline.risk.liquidityScore >= 65 ? "Strong" : "Limited", signal_scores: {}, indicator_values_at_entry: { final_score: analysis.pipeline.finalDecision.finalScore }, entry_reason: "paper decision evaluated by existing quant engine", risk_profile: this.options.risk_profile });
        await rejectedLifecycle.propose();
        await rejectedLifecycle.validateRisk(false, analysis.pipeline.finalDecision.blockingReasons[0] ?? "existing decision engine rejected paper proposal");
        lifecycleEvents.push(...rejectedEvents.events);
        continue;
      }
      if (!open) {
        clockTimestamp = new Date(current.timestamp).toISOString();
        const tradeId = uuidFrom(`${identity.replay_id}:${dataset.dataset_hash}:${current.timestamp}`);
        const quantity = Math.max(1, Math.floor((100_000 * analysis.positionSizing.finalAllocation) / current.open));
        const proposal: TradeProposal = {
          trade_id: tradeId,
          strategy_version: identity.strategy_version,
          replay_id: identity.replay_id,
          data_snapshot_id: dataset.dataset_id,
          instrument: dataset.symbol,
          direction: "LONG",
          requested_quantity: quantity,
          entry_decision_timestamp_utc: new Date(current.timestamp).toISOString(),
          stop_loss: current.close * 0.95,
          take_profit: current.close * 1.1,
          risk_percent: Math.max(0.0001, analysis.positionSizing.finalAllocation),
          evidence_score: Math.max(0.0001, analysis.pipeline.validation.validationScore),
          confidence_score: Math.max(0.0001, analysis.pipeline.signal.combinedSignalScore),
          market_regime: analysis.pipeline.signal.regimeLabel,
          volatility_regime: analysis.riskMetrics.annualizedVolatility.toFixed(6),
          liquidity_regime: analysis.pipeline.risk.liquidityScore >= 65 ? "Strong" : "Limited",
          signal_scores: Object.fromEntries(analysis.investability.signals.map((signal) => [signal.name, signal.score])),
          indicator_values_at_entry: { final_score: analysis.pipeline.finalDecision.finalScore, close: current.close },
          entry_reason: analysis.pipeline.explanation.why,
          risk_profile: this.options.risk_profile
        };
        const events = new MemoryLifecycleRepository();
        const tradeRepository = new MemoryTradeRepository();
        let lifecycleSequence = 0;
        const metadataProvider: LifecycleMetadataProvider = {
          uuid: () => uuidFrom(`${tradeId}:lifecycle:${++lifecycleSequence}`),
          now: () => clockTimestamp
        };
        const lifecycle = new TradeLifecycleEngine(events, tradeRepository, metadataProvider);
        await lifecycle.start(proposal);
        await lifecycle.propose();
        await lifecycle.validateRisk(true, "existing risk engine decision accepted paper proposal");
        await lifecycle.createOrder();
        await lifecycle.markPending();
        const orderId = uuidFrom(`${identity.replay_id}:${tradeId}:entry-order`);
        const result = this.simulator.simulate({
          context: { replay_id: identity.replay_id, dataset_version: identity.dataset_version, strategy_version: identity.strategy_version, execution_profile: profile, random_seed: identity.random_seed, data_snapshot_id: dataset.dataset_id },
          order: { order_id: orderId, trade_id: tradeId, instrument: dataset.symbol, direction: "LONG", order_type: "MARKET", quantity, decision_timestamp_utc: new Date(current.timestamp).toISOString() },
          candles: [current],
          config: EXECUTION_PROFILES[profile],
          market_regime: analysis.pipeline.signal.regimeLabel
        });
        appendExecutionEvents(executionEvents, result.events);
        await applyExecutionResultToLifecycle(lifecycle, result);
        lifecycleEvents.push(...events.events);
        if (lifecycle.snapshot().position.quantity > 0) open = { lifecycle, lifecycleRepository: events, tradeRepository, trade_id: tradeId, quantity, timestamp: new Date(current.timestamp).toISOString() };
      }
    }
    if (open) {
      const finalCandle = dataset.candles.at(-1)!;
      clockTimestamp = new Date(finalCandle.timestamp).toISOString();
      await this.closeOpenPosition(open, finalCandle, identity, dataset, profile, executionEvents);
      lifecycleEvents.push(...open.lifecycleRepository.events.filter((event) => !lifecycleEvents.some((known) => known.event_id === event.event_id)));
      trades.push(...open.tradeRepository.records.filter((trade) => !trades.some((known) => known.trade_id === trade.trade_id)));
    }
    const analytics = buildAnalyticsSnapshot({ replay_id: identity.replay_id, dataset_hash: dataset.dataset_hash, generated_at: identity.replay_timestamp, trades });
    const replayManifest: ReplayManifest = Object.freeze({ ...identity, artifact_schema_version: "1.0" });
    const replayReport: ReplayReportArtifact = Object.freeze({ replay_id: identity.replay_id, dataset_id: dataset.dataset_id, dataset_hash: dataset.dataset_hash, strategy_version: identity.strategy_version, execution_profile: identity.execution_profile, decision_count: decisions.length, trade_count: trades.length, execution_event_count: executionEvents.length, lifecycle_event_count: lifecycleEvents.length, generated_at: identity.replay_timestamp, status: "COMPLETED" });
    const artifactManifest = buildArtifactManifest({ replay_manifest: replayManifest, execution_events: executionEvents, lifecycle_events: lifecycleEvents, trades, analytics, replay_report: replayReport });
    const diagnostics = generateDecisionPipelineDiagnostics({ replayId: identity.replay_id, generatedAt: identity.replay_timestamp, dataset, assetType: this.options.asset_type, riskProfile: this.options.risk_profile, executionEvents, lifecycleEvents, trades, observations });
    const bundle: ReplayArtifactBundle = { replay_manifest: replayManifest, dataset_manifest: createDatasetManifest(dataset), dataset, artifacts: { metadata: { ...identity, journal_hash: artifactManifest.trade_journal_hash, execution_journal_hash: artifactManifest.execution_journal_hash, lifecycle_journal_hash: artifactManifest.lifecycle_journal_hash, analytics_inputs_hash: artifactManifest.analytics_hash }, trades, execution_events: executionEvents, lifecycle_events: lifecycleEvents, analytics_inputs: analytics, replay_output: replayReport }, analytics, replay_report: replayReport, artifact_manifest: artifactManifest, diagnostics };
    if (persist) await this.artifactStore.write(bundle);
    return bundle;
  }

  private async closeOpenPosition(open: { lifecycle: TradeLifecycleEngine; trade_id: string; quantity: number }, candle: MarketDataPoint, identity: ProductionReplayIdentity, dataset: FrozenDataset, profile: ExecutionProfileName, executionEvents: ExecutionEvent[]): Promise<void> {
    const result = this.simulator.simulate({ context: { replay_id: identity.replay_id, dataset_version: identity.dataset_version, strategy_version: identity.strategy_version, execution_profile: profile, random_seed: identity.random_seed, data_snapshot_id: dataset.dataset_id }, order: { order_id: uuidFrom(`${identity.replay_id}:${open.trade_id}:exit-order`), trade_id: open.trade_id, instrument: dataset.symbol, direction: "SHORT", order_type: "MARKET", quantity: open.quantity, decision_timestamp_utc: new Date(candle.timestamp).toISOString() }, candles: [candle], config: EXECUTION_PROFILES[profile] });
    appendExecutionEvents(executionEvents, result.events);
    const fill = result.events.find((event) => event.filled_quantity > 0 && event.actual_price !== null);
    if (!fill || fill.actual_price === null) throw new Error(`paper exit did not fill for ${open.trade_id}`);
    await open.lifecycle.closePosition({ price: fill.actual_price, timestamp_utc: new Date(candle.timestamp).toISOString(), reason: "signal exit or end of dataset", spread_cost: fill.spread_cost, slippage_cost: fill.slippage_cost, execution_latency_ms: fill.latency_ms });
  }
}
