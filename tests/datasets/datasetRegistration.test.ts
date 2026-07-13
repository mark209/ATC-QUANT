import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DatasetLibrary, freezeInstitutionalDataset, importHistoricalOhlcv, validateInstitutionalDataset, type HistoricalImportInput } from "@/lib/datasets/datasetLibrary";

describe("frozen dataset registration", () => {
  it("registers a validated snapshot and refuses a second write of the same dataset", async () => {
    const root = await mkdtemp(join(tmpdir(), "atc-dataset-"));
    try {
      const input: HistoricalImportInput = { dataset_id: "test-real-export", dataset_version: "v1", symbol: "BTCUSDT", exchange: "Binance", asset_type: "crypto", timeframe: "1d", source: "provider export", creation_timestamp: "2026-07-13T00:00:00.000Z", raw: JSON.stringify([{ timestamp: 1704067200000, open: 100, high: 110, low: 90, close: 105, volume: 10 }]) };
      const dataset = freezeInstitutionalDataset(input, importHistoricalOhlcv(input));
      expect(validateInstitutionalDataset(dataset).valid).toBe(true);
      const library = new DatasetLibrary(root);
      await library.register(dataset);
      await expect(library.register(dataset)).rejects.toThrow("dataset already registered");
      expect(JSON.parse(await readFile(join(root, "catalog.json"), "utf8")).datasets).toHaveLength(1);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
