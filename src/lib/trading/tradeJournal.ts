import { createHash, randomUUID } from "node:crypto";

export type TradeDirection = "LONG" | "SHORT";
export type FillStatus = "filled" | "partially_filled";
export type ExecutionStatus = "paper_completed";
export type RiskProfile = "conservative" | "balanced" | "aggressive";

export interface TradeRecordDraft {
  strategy_version: string;
  replay_id: string;
  data_snapshot_id: string;
  instrument: string;
  direction: TradeDirection;
  entry_timestamp_utc: string;
  exit_timestamp_utc: string;
  entry_decision_timestamp_utc: string;
  entry_price: number;
  exit_price: number;
  quantity: number;
  notional_value: number;
  stop_loss: number;
  take_profit: number;
  gross_pnl: number;
  net_pnl: number;
  return_percent: number;
  r_multiple: number;
  risk_percent: number;
  commission: number;
  spread_cost: number;
  slippage_cost: number;
  execution_delay_ms: number;
  evidence_score: number;
  confidence_score: number;
  market_regime: string;
  volatility_regime: string;
  liquidity_regime: string;
  signal_scores: Record<string, number>;
  indicator_values_at_entry: Record<string, number>;
  entry_reason: string;
  exit_reason: string;
  fill_status: FillStatus;
  execution_status: ExecutionStatus;
  risk_profile: RiskProfile;
}

export interface TradeRecord extends TradeRecordDraft {
  readonly trade_id: string;
  readonly created_at_utc: string;
  readonly trade_hash: string;
}

export interface TradeRecordMetadata {
  tradeId?: string;
  createdAtUtc?: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NUMERIC_FIELDS: Array<keyof TradeRecordDraft> = [
  "entry_price",
  "exit_price",
  "quantity",
  "notional_value",
  "stop_loss",
  "take_profit",
  "gross_pnl",
  "net_pnl",
  "return_percent",
  "r_multiple",
  "risk_percent",
  "commission",
  "spread_cost",
  "slippage_cost",
  "execution_delay_ms",
  "evidence_score",
  "confidence_score"
];

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)])
    );
  }
  return value;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function withoutTradeHash(record: TradeRecord): Omit<TradeRecord, "trade_hash"> {
  const { trade_hash: _tradeHash, ...hashable } = record;
  return hashable;
}

export function calculateTradeHash(record: TradeRecord): string {
  return createHash("sha256").update(canonicalJson(withoutTradeHash(record))).digest("hex");
}

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${field} must be a non-empty string`);
}

function assertUtcTimestamp(value: unknown, field: string): asserts value is string {
  assertString(value, field);
  if (!value.endsWith("Z") || Number.isNaN(Date.parse(value))) throw new Error(`${field} must be a valid UTC timestamp`);
}

function assertRecordValues(record: TradeRecord): void {
  assertString(record.trade_id, "trade_id");
  if (!UUID_PATTERN.test(record.trade_id)) throw new Error("trade_id must be a UUID");
  assertUtcTimestamp(record.created_at_utc, "created_at_utc");
  for (const field of [
    "strategy_version",
    "replay_id",
    "data_snapshot_id",
    "instrument",
    "market_regime",
    "volatility_regime",
    "liquidity_regime",
    "entry_reason",
    "exit_reason"
  ] as const) assertString(record[field], field);
  assertUtcTimestamp(record.entry_timestamp_utc, "entry_timestamp_utc");
  assertUtcTimestamp(record.exit_timestamp_utc, "exit_timestamp_utc");
  assertUtcTimestamp(record.entry_decision_timestamp_utc, "entry_decision_timestamp_utc");
  for (const field of NUMERIC_FIELDS) {
    if (!Number.isFinite(record[field])) throw new Error(`${field} must be finite`);
  }
  if (record.quantity <= 0) throw new Error("quantity must be greater than zero");
  if (!["LONG", "SHORT"].includes(record.direction)) throw new Error("direction is invalid");
  if (!["filled", "partially_filled"].includes(record.fill_status)) throw new Error("fill_status is invalid");
  if (record.execution_status !== "paper_completed") throw new Error("execution_status is invalid");
  if (!["conservative", "balanced", "aggressive"].includes(record.risk_profile)) throw new Error("risk_profile is invalid");
  for (const [name, values] of Object.entries({
    signal_scores: record.signal_scores,
    indicator_values_at_entry: record.indicator_values_at_entry
  })) {
    if (!values || typeof values !== "object" || Array.isArray(values)) throw new Error(`${name} must be an object`);
    for (const [key, value] of Object.entries(values)) {
      if (!key || !Number.isFinite(value)) throw new Error(`${name}.${key} must be finite`);
    }
  }
}

export function validateTradeRecord(record: TradeRecord): TradeRecord {
  assertRecordValues(record);
  if (record.trade_hash !== calculateTradeHash(record)) throw new Error("trade_hash does not match record contents");
  return record;
}

export function createTradeRecord(draft: TradeRecordDraft, metadata: TradeRecordMetadata = {}): TradeRecord {
  const baseRecord = {
    ...draft,
    trade_id: metadata.tradeId ?? randomUUID(),
    created_at_utc: metadata.createdAtUtc ?? new Date().toISOString()
  } as TradeRecord;
  const unhashedRecord = { ...baseRecord, trade_hash: "" } as TradeRecord;
  assertRecordValues(unhashedRecord);
  return deepFreeze({ ...unhashedRecord, trade_hash: calculateTradeHash(unhashedRecord) });
}
