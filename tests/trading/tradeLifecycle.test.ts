import { describe, expect, it } from "vitest";
import { TradeLifecycleEngine, type TradeProposal } from "@/lib/trading/tradeLifecycle";
import type { LifecycleEvent } from "@/lib/trading/lifecycleEvent";
import type { LifecycleEventRepository } from "@/lib/trading/lifecycleEventRepository";
import type { TradeRecord } from "@/lib/trading/tradeJournal";
import type { TradeJournalRepository } from "@/lib/trading/tradeJournalRepository";

class MemoryLifecycleRepository implements LifecycleEventRepository {
  events: LifecycleEvent[] = [];
  async append(event: LifecycleEvent): Promise<void> { this.events.push(event); }
  async appendMany(events: readonly LifecycleEvent[]): Promise<void> { this.events.push(...events); }
  async readAll(): Promise<LifecycleEvent[]> { return [...this.events]; }
  async findByTradeId(tradeId: string): Promise<LifecycleEvent[]> { return this.events.filter((event) => event.trade_id === tradeId); }
}

class MemoryTradeRepository implements TradeJournalRepository {
  records: TradeRecord[] = [];
  async append(record: TradeRecord): Promise<void> { this.records.push(record); }
  async appendMany(records: readonly TradeRecord[]): Promise<void> { this.records.push(...records); }
  async readAll(): Promise<TradeRecord[]> { return [...this.records]; }
  async findById(tradeId: string): Promise<TradeRecord | undefined> { return this.records.find((record) => record.trade_id === tradeId); }
  async has(tradeId: string): Promise<boolean> { return this.records.some((record) => record.trade_id === tradeId); }
}

const proposal: TradeProposal = {
  trade_id: "123e4567-e89b-12d3-a456-426614174010",
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
  entry_reason: "trend confirmation",
  risk_profile: "balanced"
};

function engine() {
  const events = new MemoryLifecycleRepository();
  const trades = new MemoryTradeRepository();
  const lifecycle = new TradeLifecycleEngine(events, trades, {
    uuid: (() => {
      let index = 0;
      return () => `123e4567-e89b-12d3-a456-4266141740${20 + index++}`;
    })(),
    now: (() => {
      let index = 0;
      return () => `2026-07-13T00:${String(index++).padStart(2, "0")}:00.000Z`;
    })()
  });
  return { lifecycle, events, trades };
}

describe("trade lifecycle engine", () => {
  it("opens on the first partial fill, updates average price, then completes the trade", async () => {
    const { lifecycle, events, trades } = engine();
    await lifecycle.start(proposal);
    await lifecycle.propose();
    await lifecycle.validateRisk(true, "risk approved");
    await lifecycle.createOrder();
    await lifecycle.markPending();
    await lifecycle.applyFill({ quantity: 25, price: 100, execution_latency_ms: 10, commission: 1, spread_cost: 0.5, slippage_cost: 0.25 });
    expect(lifecycle.snapshot().state).toBe("POSITION_OPEN");
    await lifecycle.applyFill({ quantity: 75, price: 102, execution_latency_ms: 12, commission: 1, spread_cost: 0.5, slippage_cost: 0.25 });
    expect(lifecycle.snapshot().average_fill_price).toBe(101.5);
    expect(lifecycle.snapshot().state).toBe("ORDER_FILLED");
    await lifecycle.closePosition({ price: 105, timestamp_utc: "2026-07-14T00:00:00.000Z", reason: "manual exit" });

    expect(lifecycle.snapshot().state).toBe("TRADE_COMPLETED");
    expect(trades.records).toHaveLength(1);
    expect(trades.records[0].quantity).toBe(100);
    expect(trades.records[0].entry_price).toBe(101.5);
    expect(trades.records[0].gross_pnl).toBe(350);
    expect(events.events.map((event) => event.state_after)).toEqual([
      "SIGNAL_GENERATED", "TRADE_PROPOSED", "RISK_VALIDATED", "ORDER_CREATED", "ORDER_PENDING",
      "ORDER_PARTIALLY_FILLED", "POSITION_OPEN", "POSITION_UPDATED", "ORDER_FILLED", "POSITION_CLOSED", "TRADE_COMPLETED"
    ]);
  });

  it("cancels the remainder while preserving the filled position", async () => {
    const { lifecycle, trades } = engine();
    await lifecycle.start(proposal);
    await lifecycle.propose();
    await lifecycle.validateRisk(true, "risk approved");
    await lifecycle.createOrder();
    await lifecycle.markPending();
    await lifecycle.applyFill({ quantity: 25, price: 100, execution_latency_ms: 10, commission: 0, spread_cost: 0, slippage_cost: 0 });
    await lifecycle.cancelOrder("order expired");
    expect(lifecycle.snapshot().state).toBe("POSITION_REMAINS_OPEN");
    expect(lifecycle.snapshot().remaining_quantity).toBe(75);
    expect(trades.records).toHaveLength(0);
  });

  it("rejects invalid state transitions without writing an event", async () => {
    const { lifecycle, events } = engine();
    await expect(lifecycle.markPending()).rejects.toThrow("Invalid lifecycle transition");
    expect(events.events).toHaveLength(0);
  });

  it("records risk rejection as a terminal lifecycle", async () => {
    const { lifecycle, events, trades } = engine();
    await lifecycle.start(proposal);
    await lifecycle.propose();
    await lifecycle.validateRisk(false, "risk limit rejected");
    expect(lifecycle.snapshot().state).toBe("TRADE_REJECTED");
    expect(events.events.at(-1)?.reason).toBe("risk limit rejected");
    expect(trades.records).toHaveLength(0);
  });

  it("rejects malformed proposals before emitting lifecycle events", async () => {
    const { lifecycle, events } = engine();
    await expect(lifecycle.start({ ...proposal, requested_quantity: 0 })).rejects.toThrow("requested_quantity");
    expect(events.events).toHaveLength(0);
  });
});
