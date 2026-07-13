import { describe, expect, it } from "vitest";
import { importHistoricalOhlcv, DatasetLibrary } from "@/lib/datasets/datasetLibrary";

describe("institutional dataset library", () => {
  it("imports UTC OHLCV deterministically, removes duplicates, and orders candles", () => {
    const result = importHistoricalOhlcv({ dataset_id: "real", dataset_version: "v1", symbol: "SPY", exchange: "NYSE", asset_type: "etf", timeframe: "1d", source: "provider export", creation_timestamp: "2026-01-01T00:00:00.000Z", raw: "timestamp,open,high,low,close,volume\n2026-01-02T00:00:00.000Z,2,3,1,2.5,10\n2026-01-01T00:00:00.000Z,1,2,0.5,1.5,9\n2026-01-01T00:00:00.000Z,1,2,0.5,1.5,9" });
    expect(result.source_rows).toBe(3);
    expect(result.duplicate_candles_removed).toBe(1);
    expect(result.candles.map((candle) => candle.timestamp)).toEqual([Date.parse("2026-01-01T00:00:00.000Z"), Date.parse("2026-01-02T00:00:00.000Z")]);
  });

  it("rejects non-UTC timestamps and exposes an empty institutional catalog", async () => {
    expect(() => importHistoricalOhlcv({ dataset_id: "real", dataset_version: "v1", symbol: "SPY", exchange: "NYSE", asset_type: "etf", timeframe: "1d", source: "provider export", creation_timestamp: "2026-01-01T00:00:00.000Z", raw: "timestamp,open,high,low,close,volume\n2026-01-01,1,2,0.5,1.5,9" })).toThrow("UTC");
    expect(await new DatasetLibrary("datasets").list()).toHaveLength(0);
    await expect(new DatasetLibrary("datasets").get("missing")).rejects.toThrow("unknown institutional dataset");
  });
});
