import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { TradeJournalRepository } from "./tradeJournalRepository";
import { canonicalJson, validateTradeRecord, type TradeRecord } from "./tradeJournal";

export const DEFAULT_TRADE_JOURNAL_PATH = "data/paper-trade-journal.jsonl";

export class FileTradeJournalRepository implements TradeJournalRepository {
  constructor(private readonly filePath = DEFAULT_TRADE_JOURNAL_PATH) {}

  async append(record: TradeRecord): Promise<void> {
    await this.appendMany([record]);
  }

  async appendMany(records: readonly TradeRecord[]): Promise<void> {
    const validated = records.map(validateTradeRecord);
    const ids = new Set<string>();
    for (const record of validated) {
      if (ids.has(record.trade_id)) throw new Error(`trade_id ${record.trade_id} is duplicated in the batch`);
      ids.add(record.trade_id);
    }
    const existing = await this.readAll();
    const existingIds = new Set(existing.map((record) => record.trade_id));
    for (const record of validated) {
      if (existingIds.has(record.trade_id)) throw new Error(`trade_id ${record.trade_id} already exists`);
    }
    if (validated.length === 0) return;
    await mkdir(dirname(this.filePath), { recursive: true });
    await appendFile(this.filePath, `${validated.map(canonicalJson).join("\n")}\n`, "utf8");
  }

  async readAll(): Promise<TradeRecord[]> {
    let content: string;
    try {
      content = await readFile(this.filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        try {
          return validateTradeRecord(JSON.parse(line) as TradeRecord);
        } catch (error) {
          throw new Error(`Invalid trade journal record at line ${index + 1}: ${(error as Error).message}`);
        }
      });
  }

  async findById(tradeId: string): Promise<TradeRecord | undefined> {
    return (await this.readAll()).find((record) => record.trade_id === tradeId);
  }

  async has(tradeId: string): Promise<boolean> {
    return (await this.findById(tradeId)) !== undefined;
  }
}
