import type { ExecutionEvent } from "./executionEvent";

export interface ExecutionReport {
  event_count: number;
  filled_event_count: number;
  average_slippage: number;
  average_spread: number;
  average_latency_ms: number;
  partial_fill_rate: number;
  rejection_rate: number;
  gap_executions: number;
  total_execution_cost: number;
  cost_by_instrument: Record<string, number>;
  cost_by_regime: Record<string, number>;
}

export function summarizeExecutionEvents(events: readonly ExecutionEvent[]): ExecutionReport {
  const filled = events.filter((event) => event.filled_quantity > 0);
  const rejected = events.filter((event) => event.status === "rejected");
  const partial = events.filter((event) => event.status === "partially_filled");
  const costByInstrument: Record<string, number> = {};
  const costByRegime: Record<string, number> = {};
  for (const event of events) {
    const instrument = String(event.metadata.instrument ?? "unknown");
    const regime = String(event.metadata.market_regime ?? "unknown");
    const cost = event.spread_cost + event.slippage_cost;
    costByInstrument[instrument] = (costByInstrument[instrument] ?? 0) + cost;
    costByRegime[regime] = (costByRegime[regime] ?? 0) + cost;
  }
  return {
    event_count: events.length,
    filled_event_count: filled.length,
    average_slippage: filled.length === 0 ? 0 : filled.reduce((sum, event) => sum + event.slippage_cost, 0) / filled.length,
    average_spread: filled.length === 0 ? 0 : filled.reduce((sum, event) => sum + event.spread_cost, 0) / filled.length,
    average_latency_ms: events.length === 0 ? 0 : events.reduce((sum, event) => sum + event.latency_ms, 0) / events.length,
    partial_fill_rate: events.length === 0 ? 0 : partial.length / events.length,
    rejection_rate: events.length === 0 ? 0 : rejected.length / events.length,
    gap_executions: events.filter((event) => event.metadata.gap_type && event.metadata.gap_type !== "none").length,
    total_execution_cost: events.reduce((sum, event) => sum + event.spread_cost + event.slippage_cost, 0),
    cost_by_instrument: costByInstrument,
    cost_by_regime: costByRegime
  };
}
