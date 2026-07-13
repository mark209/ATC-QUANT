import { createHash } from "node:crypto";
import { canonicalJson } from "./tradeJournal";

export type ExecutionEventStatus = "pending" | "partially_filled" | "filled" | "rejected" | "cancelled";
export type ExecutionEventType = "ORDER_PENDING" | "ORDER_PARTIALLY_FILLED" | "ORDER_FILLED" | "ORDER_REJECTED" | "ORDER_CANCELLED" | "GAP_EXECUTION";

export interface ExecutionEvent {
  readonly event_id: string;
  readonly trade_id: string;
  readonly event_type: ExecutionEventType;
  readonly timestamp_utc: string;
  readonly expected_price: number | null;
  readonly actual_price: number | null;
  readonly spread_cost: number;
  readonly slippage_cost: number;
  readonly latency_ms: number;
  readonly filled_quantity: number;
  readonly remaining_quantity: number;
  readonly status: ExecutionEventStatus;
  readonly reason: string;
  readonly metadata: Record<string, unknown>;
  readonly event_sequence: number;
  readonly event_hash: string;
}

function withoutHash(event: ExecutionEvent): Omit<ExecutionEvent, "event_hash"> {
  const { event_hash: _eventHash, ...hashable } = event;
  return hashable;
}

export function calculateExecutionEventHash(event: ExecutionEvent): string {
  return createHash("sha256").update(canonicalJson(withoutHash(event))).digest("hex");
}

export function validateExecutionEvent(event: ExecutionEvent): ExecutionEvent {
  if (!event.event_id || !event.trade_id) throw new Error("event_id and trade_id are required");
  if (!event.timestamp_utc.endsWith("Z") || Number.isNaN(Date.parse(event.timestamp_utc))) throw new Error("timestamp_utc must be a valid UTC timestamp");
  for (const [field, value] of Object.entries({
    spread_cost: event.spread_cost,
    slippage_cost: event.slippage_cost,
    latency_ms: event.latency_ms,
    filled_quantity: event.filled_quantity,
    remaining_quantity: event.remaining_quantity,
    event_sequence: event.event_sequence
  })) if (!Number.isFinite(value) || value < 0) throw new Error(`${field} must be finite and non-negative`);
  for (const [field, value] of Object.entries({ expected_price: event.expected_price, actual_price: event.actual_price })) {
    if (value !== null && (!Number.isFinite(value) || value <= 0)) throw new Error(`${field} must be positive or null`);
  }
  if (event.event_hash !== calculateExecutionEventHash(event)) throw new Error("event_hash does not match event contents");
  return event;
}
