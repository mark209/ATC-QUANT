import { describe, expect, it } from "vitest";
import { OrderManager } from "@/lib/trading/orderManager";
import { PositionManager } from "@/lib/trading/positionManager";

describe("order and position managers", () => {
  it("tracks remaining order quantity and rejects fills after cancellation", () => {
    const order = new OrderManager("order-1", "123e4567-e89b-12d3-a456-426614174010", 100);
    order.markPending();
    expect(order.applyFill(25).remaining_quantity).toBe(75);
    order.cancel();
    expect(() => order.applyFill(25)).toThrow("not fillable");
  });

  it("calculates weighted average price and direction-aware close PnL", () => {
    const position = new PositionManager();
    position.applyFill({ quantity: 25, price: 100, commission: 1, spread_cost: 0.5, slippage_cost: 0.25, execution_delay_ms: 10 });
    position.applyFill({ quantity: 75, price: 102, commission: 1, spread_cost: 0.5, slippage_cost: 0.25, execution_delay_ms: 12 });
    expect(position.snapshot().average_fill_price).toBe(101.5);
    expect(position.close(105, "LONG").gross_pnl).toBe(350);
  });
});
