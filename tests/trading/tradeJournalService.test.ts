import { describe, expect, it } from "vitest";
import { TradeJournalService } from "@/lib/trading/tradeJournalService";
import { type TradeRecord, type TradeRecordDraft } from "@/lib/trading/tradeJournal";

const draft = {
  strategy_version: "strategy-v1",
  replay_id: "replay-001",
  data_snapshot_id: "dataset-001",
  instrument: "TEST",
  direction: "SHORT",
  entry_timestamp_utc: "2026-07-13T00:00:00.000Z",
  exit_timestamp_utc: "2026-07-14T00:00:00.000Z",
  entry_decision_timestamp_utc: "2026-07-12T23:59:00.000Z",
  entry_price: 100,
  exit_price: 95,
  quantity: 2,
  notional_value: 200,
  stop_loss: 105,
  take_profit: 90,
  gross_pnl: 10,
  net_pnl: 9,
  return_percent: 0.045,
  r_multiple: 1,
  risk_percent: 0.01,
  commission: 0.5,
  spread_cost: 0.25,
  slippage_cost: 0.25,
  execution_delay_ms: 20,
  evidence_score: 70,
  confidence_score: 75,
  market_regime: "Trend Down",
  volatility_regime: "Normal volatility",
  liquidity_regime: "Strong",
  signal_scores: { signal: 80 },
  indicator_values_at_entry: { indicator: 2 },
  entry_reason: "test",
  exit_reason: "take profit",
  fill_status: "filled",
  execution_status: "paper_completed",
  risk_profile: "balanced"
} satisfies TradeRecordDraft;

describe("trade journal service", () => {
  it("generates metadata and delegates the completed record to the repository", async () => {
    const records: TradeRecord[] = [];
    const service = new TradeJournalService(
      {
        append: async (record) => {
          records.push(record);
        },
        appendMany: async (batch) => {
          records.push(...batch);
        },
        readAll: async () => records,
        findById: async (tradeId) => records.find((record) => record.trade_id === tradeId),
        has: async (tradeId) => records.some((record) => record.trade_id === tradeId)
      },
      {
        uuid: () => "123e4567-e89b-12d3-a456-426614174004",
        now: () => "2026-07-14T00:03:00.000Z"
      }
    );

    const record = await service.recordCompletedTrade(draft);
    expect(record.trade_id).toBe("123e4567-e89b-12d3-a456-426614174004");
    expect(record.created_at_utc).toBe("2026-07-14T00:03:00.000Z");
    expect(records).toEqual([record]);
  });
});
