import { randomUUID } from "node:crypto";
import { createTradeRecord, type TradeRecord, type TradeRecordDraft } from "./tradeJournal";
import type { TradeJournalRepository } from "./tradeJournalRepository";

export interface TradeJournalMetadataProvider {
  uuid(): string;
  now(): string;
}

const defaultMetadataProvider: TradeJournalMetadataProvider = {
  uuid: () => randomUUID(),
  now: () => new Date().toISOString()
};

export class TradeJournalService {
  constructor(
    private readonly repository: TradeJournalRepository,
    private readonly metadataProvider: TradeJournalMetadataProvider = defaultMetadataProvider
  ) {}

  async recordCompletedTrade(draft: TradeRecordDraft): Promise<TradeRecord> {
    const record = createTradeRecord(draft, {
      tradeId: this.metadataProvider.uuid(),
      createdAtUtc: this.metadataProvider.now()
    });
    await this.repository.append(record);
    return record;
  }
}
