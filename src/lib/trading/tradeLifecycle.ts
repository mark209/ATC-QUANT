import { randomUUID } from "node:crypto";
import type { TradeDirection, RiskProfile, TradeRecordDraft } from "./tradeJournal";
import { TradeJournalService } from "./tradeJournalService";
import type { TradeJournalRepository } from "./tradeJournalRepository";
import type { LifecycleEventRepository } from "./lifecycleEventRepository";
import type { LifecycleEvent, LifecycleState } from "./lifecycleEvent";
import { OrderManager, type ManagedOrder } from "./orderManager";
import { PositionManager, type PositionSnapshot } from "./positionManager";

export interface TradeProposal {
  trade_id: string;
  strategy_version: string;
  replay_id: string;
  data_snapshot_id: string;
  instrument: string;
  direction: TradeDirection;
  requested_quantity: number;
  entry_decision_timestamp_utc: string;
  stop_loss: number;
  take_profit: number;
  risk_percent: number;
  evidence_score: number;
  confidence_score: number;
  market_regime: string;
  volatility_regime: string;
  liquidity_regime: string;
  signal_scores: Record<string, number>;
  indicator_values_at_entry: Record<string, number>;
  entry_reason: string;
  risk_profile: RiskProfile;
}

export interface FillInput {
  quantity: number;
  price: number;
  execution_latency_ms: number;
  commission: number;
  spread_cost: number;
  slippage_cost: number;
}

export interface CloseInput {
  price: number;
  timestamp_utc: string;
  reason: string;
  commission?: number;
  spread_cost?: number;
  slippage_cost?: number;
  execution_latency_ms?: number;
}

export interface LifecycleSnapshot {
  readonly trade_id: string;
  readonly state: LifecycleState | null;
  readonly order: ManagedOrder | null;
  readonly position: PositionSnapshot;
  readonly remaining_quantity: number;
  readonly average_fill_price: number;
}

export interface LifecycleMetadataProvider {
  uuid(): string;
  now(): string;
}

const defaultMetadataProvider: LifecycleMetadataProvider = { uuid: () => randomUUID(), now: () => new Date().toISOString() };

function validateTradeProposal(proposal: TradeProposal): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(proposal.trade_id)) throw new Error("trade_id must be a UUID");
  for (const [field, value] of Object.entries({
    strategy_version: proposal.strategy_version,
    replay_id: proposal.replay_id,
    data_snapshot_id: proposal.data_snapshot_id,
    instrument: proposal.instrument,
    entry_decision_timestamp_utc: proposal.entry_decision_timestamp_utc,
    market_regime: proposal.market_regime,
    volatility_regime: proposal.volatility_regime,
    liquidity_regime: proposal.liquidity_regime,
    entry_reason: proposal.entry_reason
  })) if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${field} must be a non-empty string`);
  if (!proposal.entry_decision_timestamp_utc.endsWith("Z") || Number.isNaN(Date.parse(proposal.entry_decision_timestamp_utc))) throw new Error("entry_decision_timestamp_utc must be a valid UTC timestamp");
  for (const [field, value] of Object.entries({
    requested_quantity: proposal.requested_quantity,
    stop_loss: proposal.stop_loss,
    take_profit: proposal.take_profit,
    risk_percent: proposal.risk_percent,
    evidence_score: proposal.evidence_score,
    confidence_score: proposal.confidence_score
  })) if (!Number.isFinite(value) || value <= 0) throw new Error(`${field} must be positive and finite`);
}

export class TradeLifecycleEngine {
  private proposal: TradeProposal | null = null;
  private state: LifecycleState | null = null;
  private orderManager: OrderManager | null = null;
  private readonly positionManager = new PositionManager();
  private lifecycleSequence = 0;
  private entryTimestamp: string | null = null;
  private totalGrossPnl = 0;
  private totalCloseCosts = { commission: 0, spread_cost: 0, slippage_cost: 0, execution_latency_ms: 0 };

  constructor(
    private readonly eventRepository: LifecycleEventRepository,
    private readonly tradeRepository: TradeJournalRepository,
    private readonly metadataProvider: LifecycleMetadataProvider = defaultMetadataProvider
  ) {}

  snapshot(): LifecycleSnapshot {
    const order = this.orderManager?.snapshot() ?? null;
    const position = this.positionManager.snapshot();
    return {
      trade_id: this.proposal?.trade_id ?? "",
      state: this.state,
      order,
      position,
      remaining_quantity: order?.remaining_quantity ?? 0,
      average_fill_price: position.average_fill_price
    };
  }

  async start(proposal: TradeProposal): Promise<void> {
    if (this.state !== null) throw new Error("lifecycle has already started");
    validateTradeProposal(proposal);
    this.proposal = proposal;
    await this.emit("SIGNAL_GENERATED", "signal received", 0, proposal.requested_quantity, null);
  }

  async propose(): Promise<void> { this.requireState("SIGNAL_GENERATED"); await this.emit("TRADE_PROPOSED", "trade proposal created"); }

  async validateRisk(passed: boolean, reason: string): Promise<void> {
    this.requireState("TRADE_PROPOSED");
    await this.emit(passed ? "RISK_VALIDATED" : "TRADE_REJECTED", reason);
  }

  async createOrder(): Promise<void> {
    this.requireState("RISK_VALIDATED");
    const proposal = this.requireProposal();
    this.orderManager = new OrderManager(this.metadataProvider.uuid(), proposal.trade_id, proposal.requested_quantity);
    await this.emit("ORDER_CREATED", "paper order created");
  }

  async markPending(): Promise<void> {
    this.requireState("ORDER_CREATED");
    this.requireOrder().markPending();
    await this.emit("ORDER_PENDING", "order is pending");
  }

  async applyFill(input: FillInput): Promise<void> {
    if (!this.state || !["ORDER_PENDING", "ORDER_PARTIALLY_FILLED", "POSITION_OPEN", "POSITION_UPDATED"].includes(this.state)) {
      throw new Error("Invalid lifecycle transition: order is not fillable");
    }
    const orderBefore = this.requireOrder().snapshot();
    const orderAfter = this.requireOrder().applyFill(input.quantity);
    const position = this.positionManager.applyFill({
      quantity: input.quantity,
      price: input.price,
      commission: input.commission,
      spread_cost: input.spread_cost,
      slippage_cost: input.slippage_cost,
      execution_delay_ms: input.execution_latency_ms
    });
    if (position.quantity === input.quantity && orderAfter.remaining_quantity > 0) {
      await this.emit("ORDER_PARTIALLY_FILLED", "order partially filled", input.quantity, orderAfter.remaining_quantity, input.price, input.execution_latency_ms);
      await this.emit("POSITION_OPEN", "position opened on first fill", position.quantity, orderAfter.remaining_quantity, input.price, input.execution_latency_ms);
    } else if (position.quantity === input.quantity) {
      await this.emit("POSITION_OPEN", "position opened on first fill", position.quantity, orderAfter.remaining_quantity, input.price, input.execution_latency_ms);
      await this.emit("ORDER_FILLED", "order fully filled", position.quantity, 0, input.price, input.execution_latency_ms);
    } else {
      await this.emit("POSITION_UPDATED", "position updated by additional fill", position.quantity, orderAfter.remaining_quantity, input.price, input.execution_latency_ms);
      if (orderAfter.remaining_quantity === 0) await this.emit("ORDER_FILLED", "order fully filled", position.quantity, 0, input.price, input.execution_latency_ms);
    }
    if (!this.entryTimestamp) this.entryTimestamp = this.metadataProvider.now();
    void orderBefore;
  }

  async cancelOrder(reason: string): Promise<void> {
    if (!this.state || !["ORDER_PENDING", "ORDER_PARTIALLY_FILLED", "POSITION_OPEN", "POSITION_UPDATED"].includes(this.state)) throw new Error("Invalid lifecycle transition: order cannot be cancelled");
    const order = this.requireOrder().cancel();
    const position = this.positionManager.snapshot();
    await this.emit("ORDER_CANCELLED", reason, position.quantity, order.remaining_quantity, null, 0);
    if (position.quantity > 0) await this.emit("POSITION_REMAINS_OPEN", "filled position remains open after order cancellation", position.quantity, order.remaining_quantity, null, 0);
  }

  async closePosition(input: CloseInput): Promise<void> {
    if (!this.state || !["POSITION_OPEN", "POSITION_UPDATED", "POSITION_REMAINS_OPEN", "ORDER_FILLED"].includes(this.state)) throw new Error("Invalid lifecycle transition: position is not open");
    const proposal = this.requireProposal();
    this.lastClosedQuantity = this.positionManager.snapshot().quantity;
    const closed = this.positionManager.close(input.price, proposal.direction);
    this.totalGrossPnl = closed.gross_pnl;
    this.totalCloseCosts = {
      commission: closed.snapshot.commission + (input.commission ?? 0),
      spread_cost: closed.snapshot.spread_cost + (input.spread_cost ?? 0),
      slippage_cost: closed.snapshot.slippage_cost + (input.slippage_cost ?? 0),
      execution_latency_ms: closed.snapshot.execution_delay_ms + (input.execution_latency_ms ?? 0)
    };
    await this.emit("POSITION_CLOSED", input.reason, 0, this.requireOrder().snapshot().remaining_quantity, input.price, input.execution_latency_ms ?? 0);
    const draft: TradeRecordDraft = this.buildTradeDraft(input);
    await new TradeJournalService(this.tradeRepository, {
      uuid: () => proposal.trade_id,
      now: () => this.metadataProvider.now()
    }).recordCompletedTrade(draft);
    await this.emit("TRADE_COMPLETED", "completed trade written to trade journal", 0, this.requireOrder().snapshot().remaining_quantity, input.price, input.execution_latency_ms ?? 0);
  }

  private buildTradeDraft(input: CloseInput): TradeRecordDraft {
    const proposal = this.requireProposal();
    const entryPrice = this.lastPositionEntryPrice;
    const quantity = this.lastClosedQuantity;
    const notional = entryPrice * quantity;
    const totalCosts = this.totalCloseCosts.commission + this.totalCloseCosts.spread_cost + this.totalCloseCosts.slippage_cost;
    const netPnl = this.totalGrossPnl - totalCosts;
    const riskPerUnit = Math.abs(entryPrice - proposal.stop_loss);
    return {
      strategy_version: proposal.strategy_version,
      replay_id: proposal.replay_id,
      data_snapshot_id: proposal.data_snapshot_id,
      instrument: proposal.instrument,
      direction: proposal.direction,
      entry_timestamp_utc: this.entryTimestamp ?? proposal.entry_decision_timestamp_utc,
      exit_timestamp_utc: input.timestamp_utc,
      entry_decision_timestamp_utc: proposal.entry_decision_timestamp_utc,
      entry_price: entryPrice,
      exit_price: input.price,
      quantity,
      notional_value: notional,
      stop_loss: proposal.stop_loss,
      take_profit: proposal.take_profit,
      gross_pnl: this.totalGrossPnl,
      net_pnl: netPnl,
      return_percent: notional === 0 ? 0 : netPnl / notional,
      r_multiple: riskPerUnit === 0 ? 0 : this.totalGrossPnl / (riskPerUnit * quantity),
      risk_percent: proposal.risk_percent,
      commission: this.totalCloseCosts.commission,
      spread_cost: this.totalCloseCosts.spread_cost,
      slippage_cost: this.totalCloseCosts.slippage_cost,
      execution_delay_ms: this.totalCloseCosts.execution_latency_ms,
      evidence_score: proposal.evidence_score,
      confidence_score: proposal.confidence_score,
      market_regime: proposal.market_regime,
      volatility_regime: proposal.volatility_regime,
      liquidity_regime: proposal.liquidity_regime,
      signal_scores: proposal.signal_scores,
      indicator_values_at_entry: proposal.indicator_values_at_entry,
      entry_reason: proposal.entry_reason,
      exit_reason: input.reason,
      fill_status: this.requireOrder().snapshot().remaining_quantity === 0 ? "filled" : "partially_filled",
      execution_status: "paper_completed",
      risk_profile: proposal.risk_profile
    };
  }

  private lastPositionEntryPrice = 0;
  private lastClosedQuantity = 0;

  private async emit(stateAfter: LifecycleState, reason: string, filledQuantity?: number, remainingQuantity?: number, executionPrice: number | null = null, latency = 0): Promise<void> {
    const proposal = this.requireProposal();
    const position = this.positionManager.snapshot();
    const order = this.orderManager?.snapshot();
    if (executionPrice !== null && ["POSITION_OPEN", "POSITION_UPDATED", "ORDER_FILLED"].includes(stateAfter) && position.quantity > 0) {
      this.lastPositionEntryPrice = position.average_fill_price;
    }
    if (stateAfter === "POSITION_CLOSED") this.lastClosedQuantity = this.lastClosedQuantity || position.quantity;
    const event: LifecycleEvent = {
      event_id: this.metadataProvider.uuid(),
      trade_id: proposal.trade_id,
      parent_trade_id: proposal.trade_id,
      event_type: stateAfter,
      timestamp_utc: this.metadataProvider.now(),
      state_before: this.state,
      state_after: stateAfter,
      filled_quantity: filledQuantity ?? position.quantity,
      remaining_quantity: remainingQuantity ?? order?.remaining_quantity ?? 0,
      average_fill_price: position.average_fill_price,
      execution_price: executionPrice,
      execution_latency_ms: latency,
      reason,
      metadata: { strategy_version: proposal.strategy_version, replay_id: proposal.replay_id, data_snapshot_id: proposal.data_snapshot_id },
      lifecycle_sequence: ++this.lifecycleSequence
    };
    await this.eventRepository.append(event);
    this.state = stateAfter;
  }

  private requireProposal(): TradeProposal { if (!this.proposal) throw new Error("lifecycle has not started"); return this.proposal; }
  private requireOrder(): OrderManager { if (!this.orderManager) throw new Error("order has not been created"); return this.orderManager; }
  private requireState(expected: LifecycleState): void { if (this.state !== expected) throw new Error(`Invalid lifecycle transition: expected ${expected}, got ${this.state ?? "NONE"}`); }
}
