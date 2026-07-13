import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ExecutionEventRepository } from "./executionEventRepository";
import { validateExecutionEvent, type ExecutionEvent } from "./executionEvent";
import { canonicalJson } from "./tradeJournal";

export const DEFAULT_EXECUTION_EVENT_JOURNAL_PATH = "data/paper-execution-events.jsonl";

export class ExecutionEventRepositoryFile implements ExecutionEventRepository {
  constructor(private readonly filePath = DEFAULT_EXECUTION_EVENT_JOURNAL_PATH) {}

  async append(event: ExecutionEvent): Promise<void> { await this.appendMany([event]); }

  async appendMany(events: readonly ExecutionEvent[]): Promise<void> {
    const validated = events.map(validateExecutionEvent);
    const existing = await this.readAll();
    const ids = new Set(existing.map((event) => event.event_id));
    const sequences = new Set(existing.map((event) => `${event.trade_id}:${event.event_sequence}`));
    for (const event of validated) {
      const sequenceKey = `${event.trade_id}:${event.event_sequence}`;
      if (ids.has(event.event_id)) throw new Error(`event_id ${event.event_id} already exists`);
      if (sequences.has(sequenceKey)) throw new Error(`event sequence already exists for ${event.trade_id}`);
      ids.add(event.event_id);
      sequences.add(sequenceKey);
    }
    if (validated.length === 0) return;
    await mkdir(dirname(this.filePath), { recursive: true });
    await appendFile(this.filePath, `${validated.map(canonicalJson).join("\n")}\n`, "utf8");
  }

  async readAll(): Promise<ExecutionEvent[]> {
    let content: string;
    try { content = await readFile(this.filePath, "utf8"); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const events = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
      try { return validateExecutionEvent(JSON.parse(line) as ExecutionEvent); }
      catch (error) { throw new Error(`Invalid execution journal record at line ${index + 1}: ${(error as Error).message}`); }
    });
    const ids = new Set<string>();
    const sequences = new Set<string>();
    for (const event of events) {
      const sequenceKey = `${event.trade_id}:${event.event_sequence}`;
      if (ids.has(event.event_id) || sequences.has(sequenceKey)) throw new Error(`Duplicate execution event detected for ${sequenceKey}`);
      ids.add(event.event_id);
      sequences.add(sequenceKey);
    }
    return events;
  }

  async findByTradeId(tradeId: string): Promise<ExecutionEvent[]> {
    return (await this.readAll()).filter((event) => event.trade_id === tradeId);
  }
}
