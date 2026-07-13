import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ExecutionEventRepositoryFile } from "@/lib/trading/executionEventRepositoryFile";
import { calculateExecutionEventHash, type ExecutionEvent } from "@/lib/trading/executionEvent";

const eventWithoutHash = {
  event_id: "123e4567-e89b-12d3-a456-426614174011",
  trade_id: "123e4567-e89b-12d3-a456-426614174010",
  event_type: "ORDER_PENDING",
  timestamp_utc: "2026-07-13T00:00:00.000Z",
  expected_price: 100,
  actual_price: null,
  spread_cost: 0,
  slippage_cost: 0,
  latency_ms: 0,
  filled_quantity: 0,
  remaining_quantity: 100,
  status: "pending",
  reason: "order pending",
  metadata: {},
  event_sequence: 1,
} as Omit<ExecutionEvent, "event_hash">;
const event: ExecutionEvent = { ...eventWithoutHash, event_hash: calculateExecutionEventHash({ ...eventWithoutHash, event_hash: "" } as ExecutionEvent) };

describe("execution event repository", () => {
  it("appends and rejects duplicate execution events", async () => {
    const directory = await mkdtemp(join(tmpdir(), "atc-execution-"));
    const path = join(directory, "events.jsonl");
    try {
      const repository = new ExecutionEventRepositoryFile(path);
      await repository.append(event);
      const before = await readFile(path, "utf8");
      await expect(repository.append(event)).rejects.toThrow("already exists");
      expect(await readFile(path, "utf8")).toBe(before);
      expect(await repository.readAll()).toEqual([event]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
