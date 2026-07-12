import type { TradeDirection } from "./tradeJournal";

export interface PositionSnapshot {
  readonly quantity: number;
  readonly average_fill_price: number;
  readonly commission: number;
  readonly spread_cost: number;
  readonly slippage_cost: number;
  readonly execution_delay_ms: number;
}

export class PositionManager {
  private position: PositionSnapshot = { quantity: 0, average_fill_price: 0, commission: 0, spread_cost: 0, slippage_cost: 0, execution_delay_ms: 0 };

  snapshot(): PositionSnapshot { return this.position; }

  applyFill(input: { quantity: number; price: number; commission: number; spread_cost: number; slippage_cost: number; execution_delay_ms: number }): PositionSnapshot {
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error("fill quantity must be positive and finite");
    if (!Number.isFinite(input.price) || input.price <= 0) throw new Error("fill price must be positive and finite");
    const totalQuantity = this.position.quantity + input.quantity;
    this.position = {
      quantity: totalQuantity,
      average_fill_price: this.position.quantity === 0 ? input.price : (this.position.average_fill_price * this.position.quantity + input.price * input.quantity) / totalQuantity,
      commission: this.position.commission + input.commission,
      spread_cost: this.position.spread_cost + input.spread_cost,
      slippage_cost: this.position.slippage_cost + input.slippage_cost,
      execution_delay_ms: this.position.execution_delay_ms + input.execution_delay_ms
    };
    return this.position;
  }

  close(price: number, direction: TradeDirection): { snapshot: PositionSnapshot; gross_pnl: number } {
    if (!Number.isFinite(price) || price <= 0) throw new Error("close price must be positive and finite");
    if (this.position.quantity <= 0) throw new Error("position is not open");
    const multiplier = direction === "LONG" ? 1 : -1;
    const grossPnl = (price - this.position.average_fill_price) * this.position.quantity * multiplier;
    const snapshot = this.position;
    this.position = { quantity: 0, average_fill_price: 0, commission: 0, spread_cost: 0, slippage_cost: 0, execution_delay_ms: 0 };
    return { snapshot, gross_pnl: grossPnl };
  }
}
