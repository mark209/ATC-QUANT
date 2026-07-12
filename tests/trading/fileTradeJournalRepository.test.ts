import { appendFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileTradeJournalRepository } from "@/lib/trading/fileTradeJournalRepository";
import { createTradeRecord, type TradeRecordDraft } from "@/lib/trading/tradeJournal";

const makeDraft = (instrument: string): TradeRecordDraft => ({
  strategy_version: "strategy-v1",
  replay_id: `replay-${instrument}`,
  data_snapshot_id: "dataset-001",
  instrument,
  direction: "LONG",
  entry_timestamp_utc: "2026-07-13T00:00:00.000Z",
  exit_timestamp_utc: "2026-07-14T00:00:00.000Z",
  entry_decision_timestamp_utc: "2026-07-12T23:59:00.000Z",
  entry_price: 100,
  exit_price: 101,
  quantity: 1,
  notional_value: 100,
  stop_loss: 95,
  take_profit: 110,
  gross_pnl: 1,
  net_pnl: 0.8,
  return_percent: 0.008,
  r_multiple: 0.2,
  risk_percent: 0.01,
  commission: 0.1,
  spread_cost: 0.05,
  slippage_cost: 0.05,
  execution_delay_ms: 10,
  evidence_score: 60,
  confidence_score: 60,
  market_regime: "Trend Up",
  volatility_regime: "Normal volatility",
  liquidity_regime: "Strong",
  signal_scores: { signal: 70 },
  indicator_values_at_entry: { indicator: 1 },
  entry_reason: "test",
  exit_reason: "manual",
  fill_status: "filled",
  execution_status: "paper_completed",
  risk_profile: "balanced"
});

describe("file trade journal repository", () => {
  it("appends and reads immutable JSONL records", async () => {
    const directory = await mkdtemp(join(tmpdir(), "atc-trade-journal-"));
    const path = join(directory, "trades.jsonl");
    try {
      const repository = new FileTradeJournalRepository(path);
      const first = createTradeRecord(makeDraft("AAA"), {
        tradeId: "123e4567-e89b-12d3-a456-426614174001",
        createdAtUtc: "2026-07-14T00:01:00.000Z"
      });
      const second = createTradeRecord(makeDraft("BBB"), {
        tradeId: "123e4567-e89b-12d3-a456-426614174002",
        createdAtUtc: "2026-07-14T00:02:00.000Z"
      });

      await repository.appendMany([first, second]);
      expect(await repository.readAll()).toEqual([first, second]);
      expect(await repository.findById(first.trade_id)).toEqual(first);
      expect(await repository.has(first.trade_id)).toBe(true);
      expect((await readFile(path, "utf8")).trim().split("\n")).toHaveLength(2);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects duplicate IDs without changing the journal", async () => {
    const directory = await mkdtemp(join(tmpdir(), "atc-trade-journal-"));
    const path = join(directory, "trades.jsonl");
    try {
      const repository = new FileTradeJournalRepository(path);
      const record = createTradeRecord(makeDraft("AAA"), {
        tradeId: "123e4567-e89b-12d3-a456-426614174003",
        createdAtUtc: "2026-07-14T00:01:00.000Z"
      });
      await repository.append(record);
      const before = await readFile(path, "utf8");
      await expect(repository.append(record)).rejects.toThrow("already exists");
      expect(await readFile(path, "utf8")).toBe(before);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects malformed persisted records", async () => {
    const directory = await mkdtemp(join(tmpdir(), "atc-trade-journal-"));
    const path = join(directory, "trades.jsonl");
    try {
      const repository = new FileTradeJournalRepository(path);
      await appendFile(path, '{"trade_id":"bad"}\n', "utf8");
      await expect(repository.readAll()).rejects.toThrow("line 1");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
