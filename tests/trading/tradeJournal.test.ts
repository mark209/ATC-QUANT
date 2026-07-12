import { describe, expect, it } from "vitest";
import {
  calculateTradeHash,
  createTradeRecord,
  validateTradeRecord,
  type TradeRecordDraft
} from "@/lib/trading/tradeJournal";

const draft: TradeRecordDraft = {
  strategy_version: "strategy-v1",
  replay_id: "replay-001",
  data_snapshot_id: "dataset-001",
  instrument: "TEST",
  direction: "LONG",
  entry_timestamp_utc: "2026-07-13T00:00:00.000Z",
  exit_timestamp_utc: "2026-07-14T00:00:00.000Z",
  entry_decision_timestamp_utc: "2026-07-12T23:59:00.000Z",
  entry_price: 100,
  exit_price: 105,
  quantity: 10,
  notional_value: 1000,
  stop_loss: 95,
  take_profit: 110,
  gross_pnl: 50,
  net_pnl: 48,
  return_percent: 0.048,
  r_multiple: 1,
  risk_percent: 0.01,
  commission: 1,
  spread_cost: 0.5,
  slippage_cost: 0.5,
  execution_delay_ms: 25,
  evidence_score: 72,
  confidence_score: 68,
  market_regime: "Trend Up",
  volatility_regime: "Normal volatility",
  liquidity_regime: "Strong",
  signal_scores: { trend: 80, momentum: 70 },
  indicator_values_at_entry: { fast_ma: 99, slow_ma: 95 },
  entry_reason: "test entry",
  exit_reason: "take profit",
  fill_status: "filled",
  execution_status: "paper_completed",
  risk_profile: "balanced"
};

describe("trade journal model", () => {
  it("creates a completed trade with generated UUID, UTC timestamp, and hash", () => {
    const record = createTradeRecord(draft, {
      tradeId: "123e4567-e89b-12d3-a456-426614174000",
      createdAtUtc: "2026-07-14T00:01:00.000Z"
    });

    expect(record.trade_id).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(record.created_at_utc).toBe("2026-07-14T00:01:00.000Z");
    expect(record.trade_hash).toBe(calculateTradeHash(record));
    expect(Object.isFrozen(record.signal_scores)).toBe(true);
    expect(Object.isFrozen(record.indicator_values_at_entry)).toBe(true);
    expect(validateTradeRecord(record)).toEqual(record);
  });

  it("rejects non-finite numeric fields and non-UTC timestamps", () => {
    expect(() => createTradeRecord({ ...draft, entry_price: Number.NaN })).toThrow("entry_price");
    expect(() => createTradeRecord({ ...draft, exit_timestamp_utc: "2026-07-14" })).toThrow("UTC timestamp");
  });
});
