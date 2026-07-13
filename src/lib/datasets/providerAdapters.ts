import type { HistoricalImportInput } from "./datasetLibrary";

export interface HistoricalProviderAdapter {
  readonly provider: string;
  toImportInput(input: HistoricalImportInput): HistoricalImportInput;
}

function jsonRows(raw: string): unknown {
  const parsed = JSON.parse(raw) as unknown;
  if (parsed && typeof parsed === "object" && "result" in parsed) return (parsed as { result: unknown }).result;
  if (parsed && typeof parsed === "object" && "bars" in parsed) return (parsed as { bars: unknown }).bars;
  return parsed;
}

const baseAdapter = (provider: string, mapper: (row: unknown) => Record<string, unknown>): HistoricalProviderAdapter => ({
  provider,
  toImportInput(input) {
    const parsed = jsonRows(input.raw);
    if (!Array.isArray(parsed)) throw new Error(`${provider} payload must contain an array of candles`);
    return { ...input, raw: JSON.stringify(parsed.map(mapper)) };
  }
});

export function createProviderAdapter(provider: string): HistoricalProviderAdapter {
  switch (provider.toLowerCase()) {
    case "binance":
      return baseAdapter("binance", (row) => {
        if (!Array.isArray(row) || row.length < 6) throw new Error("Binance kline row must contain timestamp and OHLCV fields");
        return { timestamp: row[0], open: row[1], high: row[2], low: row[3], close: row[4], volume: row[5] };
      });
    case "alpaca":
      return baseAdapter("alpaca", (row) => {
        if (!row || typeof row !== "object") throw new Error("Alpaca bar must be an object");
        const bar = row as Record<string, unknown>;
        return { timestamp: bar.t ?? bar.timestamp, open: bar.o ?? bar.open, high: bar.h ?? bar.high, low: bar.l ?? bar.low, close: bar.c ?? bar.close, volume: bar.v ?? bar.volume };
      });
    case "csv":
    case "yahoo":
    case "polygon":
    case "alpha-vantage":
      return baseAdapter(provider.toLowerCase(), (row) => row as Record<string, unknown>);
    default:
      throw new Error(`unsupported historical data provider: ${provider}`);
  }
}
