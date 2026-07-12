import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { LifecycleEventRepository } from "./lifecycleEventRepository";
import { canonicalLifecycleEvent, type LifecycleEvent, type LifecycleState } from "./lifecycleEvent";
import { canonicalJson } from "./tradeJournal";

export const DEFAULT_LIFECYCLE_JOURNAL_PATH = "data/paper-lifecycle-events.jsonl";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATES = new Set<LifecycleState>([
  "SIGNAL_GENERATED", "TRADE_PROPOSED", "RISK_VALIDATED", "ORDER_CREATED", "ORDER_PENDING",
  "ORDER_PARTIALLY_FILLED", "POSITION_OPEN", "POSITION_UPDATED", "ORDER_FILLED", "ORDER_CANCELLED",
  "POSITION_REMAINS_OPEN", "POSITION_CLOSED", "TRADE_REJECTED", "TRADE_COMPLETED"
]);

function validateEvent(event: LifecycleEvent): LifecycleEvent {
  if (!UUID_PATTERN.test(event.event_id) || !UUID_PATTERN.test(event.trade_id)) throw new Error("event and trade IDs must be UUIDs");
  if (event.parent_trade_id !== null && !UUID_PATTERN.test(event.parent_trade_id)) throw new Error("parent_trade_id must be a UUID or null");
  if (!event.timestamp_utc.endsWith("Z") || Number.isNaN(Date.parse(event.timestamp_utc))) throw new Error("timestamp_utc must be a valid UTC timestamp");
  if (event.state_before !== null && !STATES.has(event.state_before)) throw new Error("state_before is invalid");
  if (!STATES.has(event.state_after) || event.event_type !== event.state_after) throw new Error("event state is invalid");
  for (const [field, value] of Object.entries({
    filled_quantity: event.filled_quantity,
    remaining_quantity: event.remaining_quantity,
    average_fill_price: event.average_fill_price,
    execution_latency_ms: event.execution_latency_ms,
    lifecycle_sequence: event.lifecycle_sequence
  })) if (!Number.isFinite(value) || value < 0) throw new Error(`${field} must be a finite non-negative number`);
  if (event.execution_price !== null && (!Number.isFinite(event.execution_price) || event.execution_price <= 0)) throw new Error("execution_price must be positive or null");
  if (typeof event.reason !== "string" || event.reason.trim().length === 0) throw new Error("reason must be non-empty");
  if (!event.metadata || typeof event.metadata !== "object" || Array.isArray(event.metadata)) throw new Error("metadata must be an object");
  return event;
}

export class FileLifecycleEventRepository implements LifecycleEventRepository {
  constructor(private readonly filePath = DEFAULT_LIFECYCLE_JOURNAL_PATH) {}

  async append(event: LifecycleEvent): Promise<void> { await this.appendMany([event]); }

  async appendMany(events: readonly LifecycleEvent[]): Promise<void> {
    const validated = events.map(validateEvent);
    const ids = new Set<string>();
    const sequences = new Set<string>();
    for (const event of validated) {
      if (ids.has(event.event_id)) throw new Error(`event_id ${event.event_id} is duplicated in the batch`);
      const sequenceKey = `${event.trade_id}:${event.lifecycle_sequence}`;
      if (sequences.has(sequenceKey)) throw new Error(`lifecycle sequence ${sequenceKey} is duplicated in the batch`);
      ids.add(event.event_id);
      sequences.add(sequenceKey);
    }
    const existing = await this.readAll();
    const existingIds = new Set(existing.map((event) => event.event_id));
    const existingSequences = new Set(existing.map((event) => `${event.trade_id}:${event.lifecycle_sequence}`));
    for (const event of validated) {
      if (existingIds.has(event.event_id)) throw new Error(`event_id ${event.event_id} already exists`);
      if (existingSequences.has(`${event.trade_id}:${event.lifecycle_sequence}`)) throw new Error(`lifecycle sequence already exists for ${event.trade_id}`);
    }
    if (validated.length === 0) return;
    await mkdir(dirname(this.filePath), { recursive: true });
    await appendFile(this.filePath, `${validated.map(canonicalJson).join("\n")}\n`, "utf8");
  }

  async readAll(): Promise<LifecycleEvent[]> {
    let content: string;
    try { content = await readFile(this.filePath, "utf8"); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const events = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
      try { return validateEvent(JSON.parse(line) as LifecycleEvent); }
      catch (error) { throw new Error(`Invalid lifecycle journal record at line ${index + 1}: ${(error as Error).message}`); }
    });
    const seen = new Set<string>();
    for (const event of events) {
      const key = `${event.trade_id}:${event.lifecycle_sequence}`;
      if (seen.has(event.event_id) || seen.has(key)) throw new Error(`Duplicate lifecycle record detected for ${key}`);
      seen.add(event.event_id);
      seen.add(key);
    }
    return events;
  }

  async findByTradeId(tradeId: string): Promise<LifecycleEvent[]> {
    return (await this.readAll()).filter((event) => event.trade_id === tradeId);
  }
}
