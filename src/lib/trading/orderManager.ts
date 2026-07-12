export type OrderStatus = "created" | "pending" | "partially_filled" | "filled" | "cancelled";

export interface ManagedOrder {
  readonly order_id: string;
  readonly trade_id: string;
  readonly requested_quantity: number;
  readonly remaining_quantity: number;
  readonly status: OrderStatus;
}

export class OrderManager {
  private order: ManagedOrder;

  constructor(orderId: string, tradeId: string, requestedQuantity: number) {
    if (requestedQuantity <= 0 || !Number.isFinite(requestedQuantity)) throw new Error("requested quantity must be positive and finite");
    this.order = { order_id: orderId, trade_id: tradeId, requested_quantity: requestedQuantity, remaining_quantity: requestedQuantity, status: "created" };
  }

  snapshot(): ManagedOrder { return this.order; }
  markPending(): ManagedOrder {
    if (this.order.status !== "created") throw new Error("order can only become pending from created");
    this.order = { ...this.order, status: "pending" };
    return this.order;
  }
  applyFill(quantity: number): ManagedOrder {
    if (!["pending", "partially_filled"].includes(this.order.status)) throw new Error("order is not fillable");
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > this.order.remaining_quantity) throw new Error("fill quantity is invalid");
    const remaining = this.order.remaining_quantity - quantity;
    this.order = { ...this.order, remaining_quantity: remaining, status: remaining === 0 ? "filled" : "partially_filled" };
    return this.order;
  }
  cancel(): ManagedOrder {
    if (!["pending", "partially_filled"].includes(this.order.status)) throw new Error("order cannot be cancelled in its current state");
    this.order = { ...this.order, status: "cancelled" };
    return this.order;
  }
}
