import { describe, expect, it } from "vitest";
import { EXECUTION_PROFILES, ExecutionSimulator, type ExecutionOrder, type ExecutionRequest } from "@/lib/trading/executionSimulator";

const baseRequest: ExecutionRequest = {
  context: {
    replay_id: "replay-001",
    dataset_version: "dataset-v1",
    strategy_version: "strategy-v1",
    execution_profile: "normal",
    random_seed: "seed-001",
    data_snapshot_id: "snapshot-001"
  },
  order: {
    order_id: "order-001",
    trade_id: "123e4567-e89b-12d3-a456-426614174010",
    instrument: "TEST",
    direction: "LONG",
    order_type: "MARKET",
    quantity: 100,
    decision_timestamp_utc: "2026-07-13T00:00:00.000Z"
  },
  candles: [{
    date: "2026-07-13",
    timestamp: Date.parse("2026-07-13T00:00:00.000Z"),
    open: 100,
    high: 105,
    low: 95,
    close: 102,
    volume: 1_000_000,
    quoteVolume: 100_000_000
  }]
};

describe("execution simulator", () => {
  it("produces identical events and hashes for identical replay inputs", () => {
    const simulator = new ExecutionSimulator();
    const first = simulator.simulate(baseRequest);
    const second = simulator.simulate(baseRequest);
    expect(second).toEqual(first);
    expect(first.events.every((event) => event.event_hash.length === 64)).toBe(true);
  });

  it("applies configured spread, slippage, and latency to a market fill", () => {
    const simulator = new ExecutionSimulator();
    const request = {
      ...baseRequest,
      config: {
        ...EXECUTION_PROFILES.ideal,
        profile_name: "test",
        spread: { type: "fixed" as const, value: 1 },
        slippage: { type: "fixed" as const, value: 2 },
        latency: { type: "fixed" as const, min_ms: 25, max_ms: 25 },
        fill_schedule: [1]
      }
    };
    const result = simulator.simulate(request);
    const fill = result.events.find((event) => event.filled_quantity > 0);
    expect(fill?.expected_price).toBe(100);
    expect(fill?.actual_price).toBe(102.5);
    expect(fill?.spread_cost).toBe(100);
    expect(fill?.slippage_cost).toBe(200);
    expect(fill?.latency_ms).toBe(25);
  });

  it("handles conservative limit and stop gaps", () => {
    const simulator = new ExecutionSimulator();
    const limitOrder: ExecutionOrder = { ...baseRequest.order, order_type: "LIMIT", limit_price: 99 };
    const stopOrder: ExecutionOrder = { ...baseRequest.order, order_id: "order-002", order_type: "STOP", stop_price: 103 };
    const limit = simulator.simulate({ ...baseRequest, order: limitOrder, config: EXECUTION_PROFILES.ideal });
    const stop = simulator.simulate({ ...baseRequest, order: stopOrder, config: EXECUTION_PROFILES.ideal });
    expect(limit.events.find((event) => event.filled_quantity > 0)?.metadata.gap_type).toBe("none");
    expect(stop.events.find((event) => event.filled_quantity > 0)?.metadata.gap_type).toBe("none");
  });

  it("emits deterministic partial fills and leaves no remainder after the schedule completes", () => {
    const simulator = new ExecutionSimulator();
    const result = simulator.simulate({
      ...baseRequest,
      candles: baseRequest.candles.concat([1, 2].map((index) => ({ ...baseRequest.candles[0], timestamp: baseRequest.candles[0].timestamp + index * 86_400_000, date: `2026-07-${14 + index}` }))),
      config: { ...EXECUTION_PROFILES.ideal, fill_schedule: [0.25, 0.5, 0.25] }
    });
    expect(result.events.filter((event) => event.filled_quantity > 0).map((event) => event.filled_quantity)).toEqual([25, 50, 25]);
    expect(result.remaining_quantity).toBe(0);
    expect(result.partial_fill_rate).toBe(1);
  });

  it("records configured order rejection", () => {
    const simulator = new ExecutionSimulator();
    const result = simulator.simulate({ ...baseRequest, rejection_reason: "insufficient_liquidity" });
    expect(result.events.at(-1)?.status).toBe("rejected");
    expect(result.events.at(-1)?.reason).toBe("insufficient_liquidity");
    expect(result.filled_quantity).toBe(0);
  });

  it("rejects a triggered stop-limit that cannot execute at its limit", () => {
    const simulator = new ExecutionSimulator();
    const result = simulator.simulate({
      ...baseRequest,
      order: { ...baseRequest.order, order_type: "STOP_LIMIT", stop_price: 103, limit_price: 94 },
      config: { ...EXECUTION_PROFILES.ideal, stop_limit_policy: "reject" }
    });
    expect(result.events.at(-1)?.status).toBe("rejected");
    expect(result.events.at(-1)?.reason).toBe("price_moved");
  });
});
