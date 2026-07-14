import { describe, expect, it } from "vitest";
import { createFrozenDataset, createDatasetManifest } from "@/lib/replay/frozenDataset";
import { validateSessionProgression, type MarketSessionModel } from "@/lib/datasets/marketSession";

const usEquity: MarketSessionModel = { asset_class: "us_equity", exchange: "NYSE", timezone: "America/New_York", trading_calendar: "NYSE", session_type: "US_EQUITY", expected_session_frequency: "one trading session per weekday" };

function candle(timestamp: string) {
  const parsed = Date.parse(timestamp);
  return { timestamp: parsed, date: new Date(parsed).toISOString().slice(0, 10), open: 100, high: 101, low: 99, close: 100.5, volume: 1_000 };
}

function equityDataset(timestamps: string[]) {
  return createFrozenDataset({ dataset_id: `equity-${timestamps.length}`, dataset_version: "v1", source: "Alpaca", symbol: "SPY", timeframe: "1d", timezone: usEquity.timezone, exchange: usEquity.exchange, asset_type: "etf", asset_class: usEquity.asset_class, trading_calendar: usEquity.trading_calendar, session_type: usEquity.session_type, expected_session_frequency: usEquity.expected_session_frequency, candles: timestamps.map(candle), creation_timestamp: "2026-07-14T00:00:00.000Z" });
}

describe("session-aware dataset infrastructure", () => {
  it("accepts a US equity weekend and NYSE holiday gap without changing candles", () => {
    const dataset = equityDataset(["2026-01-16T21:00:00.000Z", "2026-01-20T21:00:00.000Z"]);
    expect(dataset.candles.map((item) => item.timestamp)).toEqual([Date.parse("2026-01-16T21:00:00.000Z"), Date.parse("2026-01-20T21:00:00.000Z")]);
    expect(createDatasetManifest(dataset)).toMatchObject({ session_type: "US_EQUITY", trading_calendar: "NYSE", expected_session_frequency: "one trading session per weekday" });
  });

  it("rejects an unexpected missing weekday session", () => {
    expect(() => equityDataset(["2026-01-16T21:00:00.000Z", "2026-01-21T21:00:00.000Z"])).toThrow("unexpected missing sessions");
  });

  it("detects duplicate sessions and out-of-session bars", () => {
    const duplicate = validateSessionProgression([candle("2026-01-16T21:00:00.000Z"), candle("2026-01-16T22:00:00.000Z")], usEquity);
    expect(duplicate.valid).toBe(false);
    expect(duplicate.duplicate_sessions).toBe(1);
    const weekend = validateSessionProgression([candle("2026-01-17T21:00:00.000Z")], usEquity);
    expect(weekend.out_of_session_bars).toBe(1);
  });

  it("preserves continuous crypto validation and rejects out-of-order data", () => {
    const crypto: MarketSessionModel = { asset_class: "crypto", exchange: "Binance", timezone: "UTC", trading_calendar: "24/7", session_type: "CRYPTO_24_7", expected_session_frequency: "continuous 24-hour intervals" };
    expect(validateSessionProgression([candle("2026-01-01T00:00:00.000Z"), candle("2026-01-02T00:00:00.000Z")], crypto).valid).toBe(true);
    expect(validateSessionProgression([candle("2026-01-02T00:00:00.000Z"), candle("2026-01-01T00:00:00.000Z")], crypto).valid).toBe(false);
  });
});
