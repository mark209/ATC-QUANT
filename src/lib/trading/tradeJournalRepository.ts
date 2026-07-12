import type { TradeRecord } from "./tradeJournal";

export interface TradeJournalRepository {
  append(record: TradeRecord): Promise<void>;
  appendMany(records: readonly TradeRecord[]): Promise<void>;
  readAll(): Promise<TradeRecord[]>;
  findById(tradeId: string): Promise<TradeRecord | undefined>;
  has(tradeId: string): Promise<boolean>;
}
