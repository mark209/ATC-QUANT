import { createFrozenDataset, type FrozenDataset } from "./frozenDataset";

export function createBundledResearchDataset(): FrozenDataset {
  const start = Date.parse("2025-01-01T00:00:00.000Z");
  const candles = Array.from({ length: 320 }, (_, index) => {
    const timestamp = start + index * 86_400_000;
    const close = 100 + index * 0.08 + Math.sin(index / 11) * 2.5 + Math.sin(index / 31) * 3;
    const open = close - 0.35 + Math.sin(index) * 0.1;
    const high = Math.max(open, close) + 0.9;
    const low = Math.min(open, close) - 0.9;
    const volume = 2_000_000 + Math.round(Math.abs(Math.sin(index / 7)) * 500_000);
    return { date: new Date(timestamp).toISOString().slice(0, 10), timestamp, open, high, low, close, volume, quoteVolume: close * volume };
  });
  return createFrozenDataset({
    dataset_id: "atc-bundled-research-fixture",
    dataset_version: "2026-01-fixture-v1",
    source: "ATC deterministic research fixture; not live market evidence",
    symbol: "ATC-FIXTURE",
    timeframe: "1d",
    timezone: "UTC",
    candles,
    creation_timestamp: "2026-01-02T00:00:00.000Z"
  });
}
