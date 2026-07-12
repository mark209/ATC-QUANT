import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileLifecycleEventRepository } from "@/lib/trading/fileLifecycleEventRepository";
import type { LifecycleEvent } from "@/lib/trading/lifecycleEvent";

const event: LifecycleEvent = {
  event_id: "123e4567-e89b-12d3-a456-426614174011",
  trade_id: "123e4567-e89b-12d3-a456-426614174010",
  parent_trade_id: null,
  event_type: "SIGNAL_GENERATED",
  timestamp_utc: "2026-07-13T00:00:00.000Z",
  state_before: null,
  state_after: "SIGNAL_GENERATED",
  filled_quantity: 0,
  remaining_quantity: 100,
  average_fill_price: 0,
  execution_price: null,
  execution_latency_ms: 0,
  reason: "signal received",
  metadata: {},
  lifecycle_sequence: 1
};

describe("file lifecycle event repository", () => {
  it("persists events append-only and rejects duplicate event IDs", async () => {
    const directory = await mkdtemp(join(tmpdir(), "atc-lifecycle-"));
    const path = join(directory, "events.jsonl");
    try {
      const repository = new FileLifecycleEventRepository(path);
      await repository.append(event);
      const before = await readFile(path, "utf8");
      await expect(repository.append(event)).rejects.toThrow("already exists");
      expect(await readFile(path, "utf8")).toBe(before);
      expect(await repository.findByTradeId(event.trade_id)).toEqual([event]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
