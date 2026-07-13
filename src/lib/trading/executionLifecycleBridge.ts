import type { ExecutionResult } from "./executionSimulator";
import type { TradeLifecycleEngine } from "./tradeLifecycle";

export async function applyExecutionResultToLifecycle(lifecycle: TradeLifecycleEngine, result: ExecutionResult): Promise<void> {
  for (const event of result.events) {
    if (event.filled_quantity > 0) {
      if (event.actual_price === null) throw new Error("filled execution event is missing actual_price");
      await lifecycle.applyFill({
        quantity: event.filled_quantity,
        price: event.actual_price,
        execution_latency_ms: event.latency_ms,
        commission: 0,
        spread_cost: event.spread_cost,
        slippage_cost: event.slippage_cost
      });
    }
    if (event.status === "rejected" || event.status === "cancelled") await lifecycle.cancelOrder(event.reason);
  }
}
