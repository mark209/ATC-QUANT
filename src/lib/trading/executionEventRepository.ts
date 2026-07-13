import type { ExecutionEvent } from "./executionEvent";

export interface ExecutionEventRepository {
  append(event: ExecutionEvent): Promise<void>;
  appendMany(events: readonly ExecutionEvent[]): Promise<void>;
  readAll(): Promise<ExecutionEvent[]>;
  findByTradeId(tradeId: string): Promise<ExecutionEvent[]>;
}
