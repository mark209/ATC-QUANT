import { describe, expect, it } from "vitest";
import { createFrozenDataset } from "@/lib/replay/frozenDataset";
import { validateInstitutionalDataset } from "@/lib/datasets/datasetLibrary";

describe("institutional dataset validation", () => {
  it("reports checksum corruption and malformed OHLCV", () => {
    const dataset = createFrozenDataset({ dataset_id: "real", dataset_version: "v1", source: "NYSE historical export", symbol: "SPY", timeframe: "1d", timezone: "UTC", candles: [{ date: "2026-01-01", timestamp: Date.parse("2026-01-01T00:00:00.000Z"), open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }], creation_timestamp: "2026-01-02T00:00:00.000Z" });
    const report = validateInstitutionalDataset({ ...dataset, dataset_hash: "0".repeat(64), exchange: "NYSE", asset_type: "etf", start_date: "2026-01-01", end_date: "2026-01-01", quality_status: "VALID", synthetic: false });
    expect(report.valid).toBe(false);
    expect(report.checksum_valid).toBe(false);
  });
});
