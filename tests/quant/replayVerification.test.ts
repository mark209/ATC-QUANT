import { describe, expect, it } from "vitest";
import { calculateExecutionEventHash } from "@/lib/trading/executionEvent";
import { createTradeRecord, type TradeRecord } from "@/lib/trading/tradeJournal";
import {
  calculateHash,
  canonicalSerialize,
  compareReplayArtifacts,
  createReplayVerificationReport,
  hashJournal,
  type ReplayArtifacts,
  type ReplayIdentity,
  type ReplayRunner,
  verifyReplayArtifacts,
  verifyReplayDeterminism
} from "@/lib/quant/replayVerification";

const tradeId = "123e4567-e89b-42d3-a456-426614174010";
const identity: ReplayIdentity = {
  replay_id: "replay-2c-001",
  dataset_version: "dataset-v1",
  dataset_hash: calculateHash({ candles: [{ timestamp: 1, close: 100 }] }),
  strategy_version: "strategy-v1",
  execution_profile: "normal",
  random_seed: "seed-1",
  configuration: { profile: "normal", version: "1" },
  configuration_hash: calculateHash({ profile: "normal", version: "1" }),
  source_git_commit: "abc123"
};

function makeTrade(): TradeRecord {
  return createTradeRecord({
    strategy_version: identity.strategy_version,
    replay_id: identity.replay_id,
    data_snapshot_id: "snapshot-1",
    instrument: "TEST",
    direction: "LONG",
    entry_timestamp_utc: "2026-07-13T00:00:00.000Z",
    exit_timestamp_utc: "2026-07-14T00:00:00.000Z",
    entry_decision_timestamp_utc: "2026-07-13T00:00:00.000Z",
    entry_price: 100,
    exit_price: 102,
    quantity: 1,
    notional_value: 100,
    stop_loss: 98,
    take_profit: 104,
    gross_pnl: 2,
    net_pnl: 1.9,
    return_percent: 0.019,
    r_multiple: 1,
    risk_percent: 0.01,
    commission: 0.1,
    spread_cost: 0,
    slippage_cost: 0,
    execution_delay_ms: 100,
    evidence_score: 0.8,
    confidence_score: 0.8,
    market_regime: "uptrend",
    volatility_regime: "normal",
    liquidity_regime: "normal",
    signal_scores: { trend: 0.8 },
    indicator_values_at_entry: { rsi: 60 },
    entry_reason: "fixture signal",
    exit_reason: "fixture exit",
    fill_status: "filled",
    execution_status: "paper_completed",
    risk_profile: "balanced"
  }, { tradeId, createdAtUtc: "2026-07-14T00:00:01.000Z" });
}

function lifecycleEvents() {
  const states = [
    [null, "SIGNAL_GENERATED"],
    ["SIGNAL_GENERATED", "TRADE_PROPOSED"],
    ["TRADE_PROPOSED", "RISK_VALIDATED"],
    ["RISK_VALIDATED", "ORDER_CREATED"],
    ["ORDER_CREATED", "ORDER_PENDING"],
    ["ORDER_PENDING", "POSITION_OPEN"],
    ["POSITION_OPEN", "ORDER_FILLED"],
    ["ORDER_FILLED", "POSITION_CLOSED"],
    ["POSITION_CLOSED", "TRADE_COMPLETED"]
  ] as const;
  return states.map(([before, after], index) => ({
    event_id: `lifecycle-${index + 1}`,
    trade_id: tradeId,
    parent_trade_id: tradeId,
    event_type: after,
    timestamp_utc: new Date(Date.parse("2026-07-13T00:00:00.000Z") + index * 1000).toISOString(),
    state_before: before,
    state_after: after,
    filled_quantity: after === "POSITION_OPEN" || after === "ORDER_FILLED" ? 1 : 0,
    remaining_quantity: after === "ORDER_FILLED" || after === "POSITION_CLOSED" || after === "TRADE_COMPLETED" ? 0 : 1,
    average_fill_price: after === "POSITION_OPEN" || after === "ORDER_FILLED" ? 100 : 0,
    execution_price: after === "POSITION_OPEN" ? 100 : after === "POSITION_CLOSED" || after === "TRADE_COMPLETED" ? 102 : null,
    execution_latency_ms: 0,
    reason: "fixture",
    metadata: {
      replay_id: identity.replay_id,
      strategy_version: identity.strategy_version,
      data_snapshot_id: "snapshot-1"
    },
    lifecycle_sequence: index + 1
  }));
}

function executionEvents() {
  const events = [
    {
      event_id: "execution-1",
      trade_id: tradeId,
      event_type: "ORDER_PENDING" as const,
      timestamp_utc: "2026-07-13T00:00:00.000Z",
      expected_price: null,
      actual_price: null,
      spread_cost: 0,
      slippage_cost: 0,
      latency_ms: 100,
      filled_quantity: 0,
      remaining_quantity: 1,
      status: "pending" as const,
      reason: "pending",
      metadata: { order_id: "order-1", replay_id: identity.replay_id, instrument: "TEST", market_regime: "uptrend" },
      event_sequence: 1,
      event_hash: ""
    },
    {
      event_id: "execution-2",
      trade_id: tradeId,
      event_type: "ORDER_FILLED" as const,
      timestamp_utc: "2026-07-13T00:00:01.000Z",
      expected_price: 100,
      actual_price: 100,
      spread_cost: 0,
      slippage_cost: 0,
      latency_ms: 100,
      filled_quantity: 1,
      remaining_quantity: 0,
      status: "filled" as const,
      reason: "filled",
      metadata: { order_id: "order-1", replay_id: identity.replay_id, instrument: "TEST", market_regime: "uptrend" },
      event_sequence: 2,
      event_hash: ""
    }
  ];
  return events.map((event) => ({ ...event, event_hash: calculateExecutionEventHash(event) }));
}

function makeArtifacts(): ReplayArtifacts {
  const trades = [makeTrade()];
  const executions = executionEvents();
  const lifecycle = lifecycleEvents();
  return {
    metadata: {
      ...identity,
      journal_hash: hashJournal(trades),
      execution_journal_hash: hashJournal(executions),
      lifecycle_journal_hash: hashJournal(lifecycle),
      analytics_inputs_hash: calculateHash({ trade_ids: [tradeId], values: [1.9] })
    },
    trades,
    execution_events: executions,
    lifecycle_events: lifecycle,
    analytics_inputs: { trade_ids: [tradeId], values: [1.9] },
    replay_output: { equity: [100, 101.9] }
  };
}

describe("replay verification", () => {
  it("canonicalizes object keys and hashes values deterministically", () => {
    expect(canonicalSerialize({ b: 2, a: 1 })).toBe(canonicalSerialize({ a: 1, b: 2 }));
    expect(calculateHash({ b: 2, a: 1 })).toBe(calculateHash({ a: 1, b: 2 }));
  });

  it("passes a complete internally consistent artifact bundle", () => {
    const result = verifyReplayArtifacts(identity, makeArtifacts());
    expect(result.status).toBe("PASS");
    expect(result.hash_validation.status).toBe("PASS");
    expect(result.lifecycle_validation.status).toBe("PASS");
  });

  it("detects tampering, duplicate records, and invalid lifecycle transitions", () => {
    const artifacts = makeArtifacts();
    const tampered = {
      ...artifacts,
      trades: [artifacts.trades[0], artifacts.trades[0]],
      lifecycle_events: artifacts.lifecycle_events.map((event, index) => index === 5 ? { ...event, state_before: "ORDER_CREATED" as const } : event)
    };
    const result = verifyReplayArtifacts(identity, tampered);
    expect(result.status).toBe("FAIL");
    expect(result.findings.some((finding) => finding.includes("duplicate trade ID"))).toBe(true);
    expect(result.findings.some((finding) => finding.includes("invalid lifecycle transition"))).toBe(true);
  });

  it("compares replay artifacts and identifies the first mismatch", () => {
    const first = makeArtifacts();
    const second = makeArtifacts();
    second.replay_output = { equity: [100, 102] };
    const result = compareReplayArtifacts(first, second);
    expect(result.equal).toBe(false);
    expect(result.findings.some((finding) => finding.includes("replay output"))).toBe(true);
  });

  it("runs the injected replay exactly 100 times and passes deterministic stress verification", async () => {
    const fixture = makeArtifacts();
    let calls = 0;
    const runner: ReplayRunner = { run: async () => { calls += 1; return fixture; } };
    const result = await verifyReplayDeterminism({ identity, dataset: { candles: [{ timestamp: 1, close: 100 }] }, runner });
    expect(calls).toBe(100);
    expect(result.status).toBe("PASS");
    expect(result.replay_count).toBe(100);
  });

  it("fails deterministic stress verification when a later replay changes", async () => {
    const first = makeArtifacts();
    let calls = 0;
    const runner: ReplayRunner = { run: async () => {
      calls += 1;
      if (calls === 2) return { ...first, replay_output: { equity: [100, 99] } };
      return first;
    } };
    const result = await verifyReplayDeterminism({ identity, dataset: { candles: [] }, runner });
    expect(result.status).toBe("FAIL");
    expect(result.first_mismatch).toContain("replay output");
    expect(calls).toBe(2);
  });

  it("reports unavailable without a production replay runner", async () => {
    const result = await createReplayVerificationReport({ identity, dataset: {} });
    expect(result.status).toBe("UNAVAILABLE");
    expect(result.replay_status).toBe("UNAVAILABLE");
    expect(result.production_claim).toContain("not verified");
  });

  it("does not treat missing completed artifacts as a successful replay", () => {
    const empty: ReplayArtifacts = { metadata: identity, trades: [], execution_events: [], lifecycle_events: [], analytics_inputs: [] };
    const result = verifyReplayArtifacts(identity, empty);
    expect(result.status).toBe("INCONCLUSIVE");
  });
});
