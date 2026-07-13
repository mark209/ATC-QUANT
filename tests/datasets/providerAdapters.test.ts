import { describe, expect, it } from "vitest";
import { createProviderAdapter } from "@/lib/datasets/providerAdapters";

describe("historical provider adapters", () => {
  it("normalizes Binance kline rows into the existing OHLCV importer contract", () => {
    const adapter = createProviderAdapter("binance");
    const result = adapter.toImportInput({
      dataset_id: "binance-btcusdt-1d-test",
      dataset_version: "v1",
      symbol: "BTCUSDT",
      exchange: "Binance",
      asset_type: "crypto",
      timeframe: "1d",
      source: "Binance Spot Kline API",
      creation_timestamp: "2026-07-13T00:00:00.000Z",
      raw: JSON.stringify({ result: [[1704067200000, "100", "110", "90", "105", "12"]] })
    });
    expect(JSON.parse(result.raw)).toEqual([{ timestamp: 1704067200000, open: "100", high: "110", low: "90", close: "105", volume: "12" }]);
  });

  it("rejects unsupported providers instead of silently selecting a source", () => {
    expect(() => createProviderAdapter("unknown")).toThrow("unsupported historical data provider");
  });
});
