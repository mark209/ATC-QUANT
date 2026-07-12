import type { LifecycleEvent } from "./lifecycleEvent";

export interface LifecycleEventRepository {
  append(event: LifecycleEvent): Promise<void>;
  appendMany(events: readonly LifecycleEvent[]): Promise<void>;
  readAll(): Promise<LifecycleEvent[]>;
  findByTradeId(tradeId: string): Promise<LifecycleEvent[]>;
}
