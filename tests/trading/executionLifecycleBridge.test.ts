import { describe, expect, it } from "vitest";
import { ExecutionSimulator, EXECUTION_PROFILES, type ExecutionRequest } from "@/lib/trading/executionSimulator";
import { applyExecutionResultToLifecycle } from "@/lib/trading/executionLifecycleBridge";
import { TradeLifecycleEngine, type TradeProposal } from "@/lib/trading/tradeLifecycle";
import type { LifecycleEvent } from "@/lib/trading/lifecycleEvent";
import type { LifecycleEventRepository } from "@/lib/trading/lifecycleEventRepository";
import type { TradeRecord } from "@/lib/trading/tradeJournal";
import type { TradeJournalRepository } from "@/lib/trading/tradeJournalRepository";

class Events implements LifecycleEventRepository {
  values: LifecycleEvent[] = [];
  async append(event: LifecycleEvent) { this.values.push(event); }
  async appendMany(events: readonly LifecycleEvent[]) { this.values.push(...events); }
  async readAll() { return this.values; }
  async findByTradeId(tradeId: string) { return this.values.filter((event) => event.trade_id === tradeId); }
}
class Trades implements TradeJournalRepository {
  values: TradeRecord[] = [];
  async append(record: TradeRecord) { this.values.push(record); }
  async appendMany(records: readonly TradeRecord[]) { this.values.push(...records); }
  async readAll() { return this.values; }
  async findById(tradeId: string) { return this.values.find((record) => record.trade_id === tradeId); }
  async has(tradeId: string) { return this.values.some((record) => record.trade_id === tradeId); }
}

const proposal: TradeProposal = {
  trade_id: "123e4567-e89b-12d3-a456-426614174012",
  strategy_version: "strategy-v1",
  replay_id: "replay-001",
  data_snapshot_id: "dataset-001",
  instrument: "TEST",
  direction: "LONG",
  requested_quantity: 100,
  entry_decision_timestamp_utc: "2026-07-13T00:00:00.000Z",
  stop_loss: 95,
  take_profit: 110,
  risk_percent: 0.01,
  evidence_score: 70,
  confidence_score: 75,
  market_regime: "Trend Up",
  volatility_regime: "Normal volatility",
  liquidity_regime: "Strong",
  signal_scores: { signal: 80 },
  indicator_values_at_entry: { fast_ma: 99 },
  entry_reason: "test",
  risk_profile: "balanced"
};

const request: ExecutionRequest = {
  context: { replay_id: "replay-001", dataset_version: "dataset-v1", strategy_version: "strategy-v1", execution_profile: "ideal", random_seed: "seed-001", data_snapshot_id: "dataset-001" },
  order: { order_id: "order-bridge", trade_id: proposal.trade_id, instrument: "TEST", direction: "LONG", order_type: "MARKET", quantity: 100, decision_timestamp_utc: "2026-07-13T00:00:00.000Z" },
  candles: [{ date: "2026-07-13", timestamp: Date.parse("2026-07-13T00:00:00.000Z"), open: 100, high: 105, low: 95, close: 102, volume: 1_000_000, quoteVolume: 100_000_000 }],
  config: EXECUTION_PROFILES.ideal
};

describe("execution lifecycle bridge", () => {
  it("passes simulator fills to Phase 2A without changing lifecycle rules", async () => {
    const events = new Events();
    const trades = new Trades();
    let sequence = 0;
    const lifecycle = new TradeLifecycleEngine(events, trades, { uuid: () => `123e4567-e89b-12d3-a456-4266141741${String(sequence++).padStart(2, "0")}`, now: () => "2026-07-13T00:00:00.000Z" });
    await lifecycle.start(proposal);
    await lifecycle.propose();
    await lifecycle.validateRisk(true, "approved");
    await lifecycle.createOrder();
    await lifecycle.markPending();
    await applyExecutionResultToLifecycle(lifecycle, new ExecutionSimulator().simulate(request));
    await lifecycle.closePosition({ price: 105, timestamp_utc: "2026-07-14T00:00:00.000Z", reason: "take profit" });
    expect(lifecycle.snapshot().state).toBe("TRADE_COMPLETED");
    expect(trades.values).toHaveLength(1);
  });
});
