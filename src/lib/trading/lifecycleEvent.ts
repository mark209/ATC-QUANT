import { canonicalJson } from "./tradeJournal";

export type LifecycleState =
  | "SIGNAL_GENERATED"
  | "TRADE_PROPOSED"
  | "RISK_VALIDATED"
  | "ORDER_CREATED"
  | "ORDER_PENDING"
  | "ORDER_PARTIALLY_FILLED"
  | "POSITION_OPEN"
  | "POSITION_UPDATED"
  | "ORDER_FILLED"
  | "ORDER_CANCELLED"
  | "POSITION_REMAINS_OPEN"
  | "POSITION_CLOSED"
  | "TRADE_REJECTED"
  | "TRADE_COMPLETED";

export type LifecycleEventType = LifecycleState;

export interface LifecycleEvent {
  readonly event_id: string;
  readonly trade_id: string;
  readonly parent_trade_id: string | null;
  readonly event_type: LifecycleEventType;
  readonly timestamp_utc: string;
  readonly state_before: LifecycleState | null;
  readonly state_after: LifecycleState;
  readonly filled_quantity: number;
  readonly remaining_quantity: number;
  readonly average_fill_price: number;
  readonly execution_price: number | null;
  readonly execution_latency_ms: number;
  readonly reason: string;
  readonly metadata: Record<string, unknown>;
  readonly lifecycle_sequence: number;
}

export function canonicalLifecycleEvent(event: LifecycleEvent): string {
  return canonicalJson(event);
}
