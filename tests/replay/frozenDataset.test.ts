import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDatasetManifest, createFrozenDataset, FrozenDatasetStore, validateFrozenDataset } from "@/lib/replay/frozenDataset";

const tempRoot = join(process.cwd(), "tmp-phase3-dataset-tests");

function candles(count = 4) {
  return Array.from({ length: count }, (_, index) => {
    const timestamp = Date.parse("2026-01-01T00:00:00.000Z") + index * 86_400_000;
    const close = 100 + index;
    return { date: new Date(timestamp).toISOString().slice(0, 10), timestamp, open: close - 0.5, high: close + 1, low: close - 1, close, volume: 1_000_000, quoteVolume: close * 1_000_000 };
  });
}

afterEach(async () => { await rm(tempRoot, { recursive: true, force: true }); });

describe("frozen dataset infrastructure", () => {
  it("creates a hashed dataset and manifest", () => {
    const dataset = createFrozenDataset({ dataset_id: "fixture", dataset_version: "v1", source: "fixture", symbol: "TEST", timeframe: "1d", timezone: "UTC", candles: candles(), creation_timestamp: "2026-01-05T00:00:00.000Z" });
    expect(validateFrozenDataset(dataset).dataset_hash).toHaveLength(64);
    expect(createDatasetManifest(dataset)).toMatchObject({ dataset_id: "fixture", candle_count: 4, quality_status: "VALID", checksum: dataset.dataset_hash });
  });

  it("rejects duplicates, missing intervals, invalid OHLCV, and tampered checksums", () => {
    const dataset = createFrozenDataset({ dataset_id: "fixture", dataset_version: "v1", source: "fixture", symbol: "TEST", timeframe: "1d", timezone: "UTC", candles: candles(), creation_timestamp: "2026-01-05T00:00:00.000Z" });
    expect(() => validateFrozenDataset({ ...dataset, candles: [dataset.candles[0], dataset.candles[0], ...dataset.candles.slice(2)] })).toThrow("duplicate");
    expect(() => validateFrozenDataset({ ...dataset, dataset_hash: "0".repeat(64) })).toThrow("dataset_hash");
    expect(() => validateFrozenDataset({ ...dataset, candles: dataset.candles.map((candle, index) => index === 1 ? { ...candle, volume: 0 } : candle) })).toThrow("invalid volume");
  });

  it("persists a snapshot once and refuses overwrite", async () => {
    await mkdir(tempRoot, { recursive: true });
    const path = join(tempRoot, "dataset.json");
    const store = new FrozenDatasetStore(path);
    const dataset = createFrozenDataset({ dataset_id: "fixture", dataset_version: "v1", source: "fixture", symbol: "TEST", timeframe: "1d", timezone: "UTC", candles: candles(), creation_timestamp: "2026-01-05T00:00:00.000Z" });
    await store.write(dataset);
    expect((await store.read()).dataset_hash).toBe(dataset.dataset_hash);
    await expect(store.write(dataset)).rejects.toThrow();
  });
});
