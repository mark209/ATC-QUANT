import { createHash } from "node:crypto";
import type { MarketDataPoint } from "@/types/asset";
import { canonicalJson } from "./tradeJournal";
import { calculateExecutionEventHash, type ExecutionEvent } from "./executionEvent";

export type ExecutionProfileName = "ideal" | "normal" | "high_volatility" | "low_liquidity" | "stress_test";
export type OrderType = "MARKET" | "LIMIT" | "STOP" | "STOP_LIMIT";
export type ExecutionDirection = "LONG" | "SHORT";
export type RejectionReason = "insufficient_liquidity" | "market_closed" | "price_moved" | "order_expired" | "risk_rejection" | "exchange_rejection";
export type SpreadModel = { type: "fixed" | "percentage" | "volatility" | "liquidity"; value: number };
export type SlippageModel = { type: "fixed" | "percentage" | "volatility" | "liquidity" | "random"; value: number; min?: number; max?: number };
export type LatencyModel = { type: "fixed" | "random"; min_ms: number; max_ms: number };

export interface ExecutionConfig {
  profile_name: string;
  profile_version: string;
  spread: SpreadModel;
  slippage: SlippageModel;
  latency: LatencyModel;
  fill_schedule: number[];
  minimum_quote_volume: number;
  stop_limit_policy: "remain_pending" | "reject";
}

export interface ExecutionContext {
  replay_id: string;
  dataset_version: string;
  strategy_version: string;
  execution_profile: ExecutionProfileName;
  random_seed: string;
  data_snapshot_id: string;
}

export interface ExecutionOrder {
  order_id: string;
  trade_id: string;
  instrument: string;
  direction: ExecutionDirection;
  order_type: OrderType;
  quantity: number;
  decision_timestamp_utc: string;
  limit_price?: number;
  stop_price?: number;
}

export interface ExecutionRequest {
  context: ExecutionContext;
  order: ExecutionOrder;
  candles: MarketDataPoint[];
  config?: ExecutionConfig;
  rejection_reason?: RejectionReason;
  market_regime?: string;
}

export interface ExecutionResult {
  events: ExecutionEvent[];
  filled_quantity: number;
  remaining_quantity: number;
  average_fill_price: number;
  total_spread_cost: number;
  total_slippage_cost: number;
  total_latency_ms: number;
  partial_fill_rate: number;
  rejection_rate: number;
  gap_executions: number;
}

const profile = (name: string, spread: SpreadModel, slippage: SlippageModel, latency: LatencyModel, fill_schedule: number[], minimum_quote_volume: number): ExecutionConfig => ({
  profile_name: name,
  profile_version: "1",
  spread,
  slippage,
  latency,
  fill_schedule,
  minimum_quote_volume,
  stop_limit_policy: "remain_pending"
});

export const EXECUTION_PROFILES: Record<ExecutionProfileName, ExecutionConfig> = {
  ideal: profile("ideal", { type: "fixed", value: 0 }, { type: "fixed", value: 0 }, { type: "fixed", min_ms: 0, max_ms: 0 }, [1], 0),
  normal: profile("normal", { type: "percentage", value: 0.0005 }, { type: "percentage", value: 0.0005 }, { type: "fixed", min_ms: 100, max_ms: 100 }, [1], 20),
  high_volatility: profile("high_volatility", { type: "volatility", value: 0.001 }, { type: "volatility", value: 0.001 }, { type: "random", min_ms: 100, max_ms: 500 }, [0.5, 0.5], 20),
  low_liquidity: profile("low_liquidity", { type: "liquidity", value: 0.01 }, { type: "liquidity", value: 0.01 }, { type: "random", min_ms: 250, max_ms: 1000 }, [0.25, 0.25, 0.25, 0.25], 40),
  stress_test: profile("stress_test", { type: "percentage", value: 0.002 }, { type: "random", value: 0.002, min: 0, max: 0.01 }, { type: "random", min_ms: 500, max_ms: 2000 }, [0.25, 0.25, 0.25, 0.25], 50)
};

interface FillCandidate { price: number; gap_type: string; reason: string; }

function hashNumber(input: string): number {
  return createHash("sha256").update(input).digest().readUInt32BE(0) / 0xffffffff;
}

function deterministicId(input: string): string {
  const hex = createHash("sha256").update(input).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20)}`;
}

function assertConfig(config: ExecutionConfig): void {
  if (!config.profile_name || !config.profile_version) throw new Error("execution profile metadata is required");
  if (!Number.isFinite(config.minimum_quote_volume) || config.minimum_quote_volume < 0) throw new Error("minimum quote volume is invalid");
  if (config.fill_schedule.length === 0 || config.fill_schedule.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) throw new Error("fill schedule must contain percentages between zero and one");
  if (config.fill_schedule.reduce((sum, value) => sum + value, 0) > 1.0000001) throw new Error("fill schedule cannot exceed one hundred percent");
}

function baseFill(order: ExecutionOrder, candle: MarketDataPoint): FillCandidate | null {
  const buy = order.direction === "LONG";
  if (order.order_type === "MARKET") return { price: candle.open, gap_type: "none", reason: "market order at first tradable open" };
  if (order.order_type === "LIMIT") {
    if (order.limit_price === undefined) throw new Error("limit_price is required");
    if (buy && candle.open <= order.limit_price) return { price: candle.open, gap_type: "gap_below_limit", reason: "buy limit filled at gap open" };
    if (!buy && candle.open >= order.limit_price) return { price: candle.open, gap_type: "gap_above_limit", reason: "sell limit filled at gap open" };
    if (buy && candle.low <= order.limit_price) return { price: order.limit_price, gap_type: "none", reason: "buy limit touched" };
    if (!buy && candle.high >= order.limit_price) return { price: order.limit_price, gap_type: "none", reason: "sell limit touched" };
    return null;
  }
  if (order.stop_price === undefined) throw new Error("stop_price is required");
  const stopTriggered = buy ? candle.high >= order.stop_price : candle.low <= order.stop_price;
  if (!stopTriggered) return null;
  if (order.order_type === "STOP") {
    if (buy && candle.open >= order.stop_price) return { price: candle.open, gap_type: "gap_above_stop", reason: "buy stop filled at gap open" };
    if (!buy && candle.open <= order.stop_price) return { price: candle.open, gap_type: "gap_below_stop", reason: "sell stop filled at gap open" };
    return { price: order.stop_price, gap_type: "none", reason: "stop touched" };
  }
  if (order.limit_price === undefined) throw new Error("limit_price is required for stop-limit");
  const limitReached = buy ? candle.low <= order.limit_price : candle.high >= order.limit_price;
  if (!limitReached) return null;
  return { price: order.limit_price, gap_type: "none", reason: "stop-limit executable after trigger" };
}

function modelValue(model: SpreadModel | SlippageModel, price: number, candle: MarketDataPoint, context: ExecutionContext, order: ExecutionOrder): number {
  if (model.type === "fixed") return model.value;
  if (model.type === "percentage") return price * model.value;
  if (model.type === "volatility") return price * (Math.abs(candle.high - candle.low) / Math.max(price, 0.0000001)) * model.value;
  if (model.type === "liquidity") return price * model.value / Math.max(1, candle.quoteVolume ?? candle.volume * price);
  if (model.type !== "random") throw new Error("unsupported execution model");
  const min = model.min ?? 0;
  const max = model.max ?? model.value;
  return min + (max - min) * hashNumber(canonicalJson({ context, order, candle: candle.timestamp, model }));
}

function makeEvent(request: ExecutionRequest, config: ExecutionConfig, sequence: number, eventType: ExecutionEvent["event_type"], timestamp: string, values: Omit<ExecutionEvent, "event_id" | "event_hash" | "trade_id" | "event_type" | "timestamp_utc" | "event_sequence">): ExecutionEvent {
  const event = {
    ...values,
    event_id: deterministicId(canonicalJson({ context: request.context, order: request.order.order_id, sequence, eventType })),
    trade_id: request.order.trade_id,
    event_type: eventType,
    timestamp_utc: timestamp,
    event_sequence: sequence,
    event_hash: ""
  } as ExecutionEvent;
  return Object.freeze({ ...event, event_hash: calculateExecutionEventHash(event) });
}

function eventMetadata(request: ExecutionRequest, config: ExecutionConfig, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...request.context,
    order_id: request.order.order_id,
    instrument: request.order.instrument,
    market_regime: request.market_regime ?? "unknown",
    execution_profile_version: config.profile_version,
    ...extra
  };
}

export class ExecutionSimulator {
  simulate(request: ExecutionRequest): ExecutionResult {
    const config = request.config ?? EXECUTION_PROFILES[request.context.execution_profile];
    assertConfig(config);
    if (request.candles.length === 0) throw new Error("historical candles are required");
    if (!Number.isFinite(request.order.quantity) || request.order.quantity <= 0) throw new Error("order quantity must be positive");
    const latency = config.latency.min_ms + (config.latency.max_ms - config.latency.min_ms) * hashNumber(canonicalJson({ context: request.context, order: request.order, latency: config.latency }));
    const executionStart = Date.parse(request.order.decision_timestamp_utc) + latency;
    if (Number.isNaN(executionStart)) throw new Error("decision timestamp is invalid");
    const events: ExecutionEvent[] = [];
    let remaining = request.order.quantity;
    let filled = 0;
    let weightedPrice = 0;
    let spreadCost = 0;
    let slippageCost = 0;
    let gapExecutions = 0;
    let partialFills = 0;
    let sequence = 1;
    if (request.rejection_reason) {
      const timestamp = new Date(executionStart).toISOString();
      events.push(makeEvent(request, config, sequence, "ORDER_REJECTED", timestamp, { expected_price: null, actual_price: null, spread_cost: 0, slippage_cost: 0, latency_ms: latency, filled_quantity: 0, remaining_quantity: remaining, status: "rejected", reason: request.rejection_reason, metadata: eventMetadata(request, config) }));
      return { events, filled_quantity: 0, remaining_quantity: remaining, average_fill_price: 0, total_spread_cost: 0, total_slippage_cost: 0, total_latency_ms: latency, partial_fill_rate: 0, rejection_rate: 1, gap_executions: 0 };
    }
    events.push(makeEvent(request, config, sequence++, "ORDER_PENDING", new Date(executionStart).toISOString(), { expected_price: null, actual_price: null, spread_cost: 0, slippage_cost: 0, latency_ms: latency, filled_quantity: 0, remaining_quantity: remaining, status: "pending", reason: "order pending for eligible candle", metadata: eventMetadata(request, config) }));
    let fillIndex = 0;
    let stopLimitTriggeredWithoutFill = false;
    for (const candle of request.candles) {
      if (remaining <= 0 || candle.timestamp < Date.parse(request.order.decision_timestamp_utc)) continue;
      if ((candle.quoteVolume ?? candle.volume * candle.close) < config.minimum_quote_volume) continue;
      if (request.order.order_type === "STOP_LIMIT" && request.order.stop_price !== undefined && request.order.limit_price !== undefined) {
        const stopTriggered = request.order.direction === "LONG" ? candle.high >= request.order.stop_price : candle.low <= request.order.stop_price;
        const limitReached = request.order.direction === "LONG" ? candle.low <= request.order.limit_price : candle.high >= request.order.limit_price;
        if (stopTriggered && !limitReached) stopLimitTriggeredWithoutFill = true;
      }
      const candidate = baseFill(request.order, candle);
      if (!candidate) continue;
      const percentage = config.fill_schedule[Math.min(fillIndex, config.fill_schedule.length - 1)];
      const fillQuantity = Math.min(remaining, request.order.quantity * percentage);
      fillIndex += 1;
      if (fillQuantity <= 0) continue;
      if (fillQuantity < remaining) partialFills += 1;
      const spreadPerUnit = modelValue(config.spread, candidate.price, candle, request.context, request.order);
      const rawSlippage = modelValue(config.slippage, candidate.price, candle, request.context, request.order);
      const adverse = request.order.direction === "LONG" ? 1 : -1;
      const actualPrice = candidate.price + adverse * (spreadPerUnit / 2 + rawSlippage);
      const currentSpreadCost = spreadPerUnit * fillQuantity;
      const currentSlippageCost = rawSlippage * fillQuantity;
      const executionTimestamp = new Date(Math.max(executionStart, candle.timestamp)).toISOString();
      const eventType = candidate.gap_type === "none" ? (remaining - fillQuantity <= 0 ? "ORDER_FILLED" : "ORDER_PARTIALLY_FILLED") : "GAP_EXECUTION";
      const status = remaining - fillQuantity <= 0 ? "filled" : "partially_filled";
      events.push(makeEvent(request, config, sequence++, eventType, executionTimestamp, { expected_price: candidate.price, actual_price: actualPrice, spread_cost: currentSpreadCost, slippage_cost: currentSlippageCost, latency_ms: latency, filled_quantity: fillQuantity, remaining_quantity: remaining - fillQuantity, status, reason: candidate.reason, metadata: eventMetadata(request, config, { gap_type: candidate.gap_type }) }));
      weightedPrice = (weightedPrice * filled + actualPrice * fillQuantity) / (filled + fillQuantity);
      filled += fillQuantity;
      remaining -= fillQuantity;
      spreadCost += currentSpreadCost;
      slippageCost += currentSlippageCost;
      if (candidate.gap_type !== "none") gapExecutions += 1;
    }
    if (remaining > 0 && stopLimitTriggeredWithoutFill && config.stop_limit_policy === "reject") {
      events.push(makeEvent(request, config, sequence++, "ORDER_REJECTED", new Date(executionStart).toISOString(), { expected_price: request.order.limit_price ?? null, actual_price: null, spread_cost: 0, slippage_cost: 0, latency_ms: latency, filled_quantity: filled, remaining_quantity: remaining, status: "rejected", reason: "price_moved", metadata: eventMetadata(request, config) }));
    }
    return { events, filled_quantity: filled, remaining_quantity: remaining, average_fill_price: weightedPrice, total_spread_cost: spreadCost, total_slippage_cost: slippageCost, total_latency_ms: events.reduce((sum, event) => sum + event.latency_ms, 0), partial_fill_rate: partialFills > 0 ? 1 : 0, rejection_rate: 0, gap_executions: gapExecutions };
  }
}
