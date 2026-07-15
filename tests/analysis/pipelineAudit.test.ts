import { describe, expect, it } from "vitest";
import { buildPipelineAudit } from "@/lib/analysis/pipelineAudit";
import type { FrozenDataset } from "@/lib/replay/frozenDataset";
import type { StrategyTraceRecord } from "@/lib/replay/strategyTrace";

const dataset = { dataset_id: "audit-dataset", symbol: "BTCUSDT", timeframe: "1d", candle_count: 2, candles: [{ timestamp: 1, date: "1970-01-01", open: 1, high: 1, low: 1, close: 1, volume: 1 }, { timestamp: 86_400_001, date: "1970-01-02", open: 1, high: 1, low: 1, close: 1, volume: 1 }], start_timestamp: "1970-01-01T00:00:00.001Z", end_timestamp: "1970-01-02T00:00:00.001Z" } as unknown as FrozenDataset;
const traces = [
  { candle_index: 0, timestamp: "1970-01-01T00:00:00.001Z", pipeline_stage_reached: "warm-up", final_status: "no signal", dataset_id: "audit-dataset", symbol: "BTCUSDT", signal: null, evidence: null, risk: null, ev: null, kelly: null, execution: { filled: false, completed: false, event_count: 0 } },
  { candle_index: 1, timestamp: "1970-01-02T00:00:00.001Z", pipeline_stage_reached: "execution", final_status: "completed trade", dataset_id: "audit-dataset", symbol: "BTCUSDT", signal: { passed: true, combined_score: 80, required_score: 45, components: [], warnings: [] }, evidence: { passed: true, items: [], total_evidence_score: 80, required_evidence_score: 50 }, risk: { passed: true, validations: [], combined_score: 80, required_score: 45, warnings: [] }, ev: { expected_value: 1, minimum_ev: 0 }, kelly: { final_allocation: 0.1, minimum_allocation: 0 }, execution: { filled: true, completed: true, event_count: 1 } },
] as unknown as StrategyTraceRecord[];

describe("pipeline audit", () => {
  it("accounts for candles, lifecycle stages, and completed trade lineage", () => {
    const report = buildPipelineAudit({ replayId: "audit-replay", generatedAt: "2026-07-14T00:00:00.000Z", dataset, traces, executions: [{ trade_id: "trade-1", event_id: "execution-1", event_type: "ORDER_FILLED", status: "filled", filled_quantity: 1, timestamp_utc: traces[1].timestamp, metadata: { order_id: "order-1" } } as never], lifecycle: ["SIGNAL_GENERATED", "TRADE_PROPOSED", "RISK_VALIDATED", "ORDER_CREATED", "POSITION_OPEN", "POSITION_CLOSED", "TRADE_COMPLETED"].map((state, index) => ({ event_id: `life-${index}`, trade_id: "trade-1", state_after: state, state_before: index ? ["SIGNAL_GENERATED", "TRADE_PROPOSED", "RISK_VALIDATED", "ORDER_CREATED", "POSITION_OPEN", "POSITION_CLOSED"][index - 1] ?? null : null, lifecycle_sequence: index + 1, timestamp_utc: traces[1].timestamp, event_type: state, parent_trade_id: null, filled_quantity: 1, remaining_quantity: 0, average_fill_price: 1, execution_price: 1, execution_latency_ms: 0, reason: "test", metadata: {} } as never)), trades: [{ trade_id: "trade-1", net_pnl: 10 } as never] });
    expect(report.dataset_audit.every_candle_once).toBe(true);
    expect(report.dataset_audit.no_candles_skipped).toBe(true);
    expect(report.funnel.completed_trades).toBe(1);
    expect(report.replay_audit.completed_trade_lineages).toBe(1);
    expect(report.replay_audit.proposals_without_terminal).toBe(0);
  });
});
