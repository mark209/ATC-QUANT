import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createFrozenDataset, type FrozenDataset } from "../src/lib/replay/frozenDataset";

export type ResearchRegime = "bull" | "bear" | "sideways";

export interface ResearchDatasetSpec {
  dataset_id: string;
  symbol: string;
  timeframe: "1h" | "4h" | "1d";
  regime: ResearchRegime;
  days: number;
  start: string;
  basePrice: number;
  seed: number;
}

export const RESEARCH_DATASET_SPECS: readonly ResearchDatasetSpec[] = [
  { dataset_id: "atc-btc-bull-1d-3y", symbol: "BTC-RESEARCH", timeframe: "1d", regime: "bull", days: 1095, start: "2023-01-01T00:00:00.000Z", basePrice: 100, seed: 11 },
  { dataset_id: "atc-eth-bear-1d-3y", symbol: "ETH-RESEARCH", timeframe: "1d", regime: "bear", days: 1095, start: "2023-01-01T00:00:00.000Z", basePrice: 140, seed: 23 },
  { dataset_id: "atc-spy-sideways-1d-3y", symbol: "SPY-RESEARCH", timeframe: "1d", regime: "sideways", days: 1095, start: "2023-01-01T00:00:00.000Z", basePrice: 180, seed: 37 },
  { dataset_id: "atc-btc-bull-4h-1y", symbol: "BTC-RESEARCH", timeframe: "4h", regime: "bull", days: 365, start: "2025-01-01T00:00:00.000Z", basePrice: 100, seed: 41 },
  { dataset_id: "atc-eth-bear-1h-180d", symbol: "ETH-RESEARCH", timeframe: "1h", regime: "bear", days: 180, start: "2025-01-01T00:00:00.000Z", basePrice: 140, seed: 53 },
  { dataset_id: "atc-spy-sideways-4h-2y", symbol: "SPY-RESEARCH", timeframe: "4h", regime: "sideways", days: 730, start: "2024-01-01T00:00:00.000Z", basePrice: 180, seed: 67 }
];

const stepMilliseconds: Record<ResearchDatasetSpec["timeframe"], number> = { "1h": 3_600_000, "4h": 14_400_000, "1d": 86_400_000 };
const periodsPerDay: Record<ResearchDatasetSpec["timeframe"], number> = { "1h": 24, "4h": 6, "1d": 1 };

function regimeDrift(regime: ResearchRegime): number {
  if (regime === "bull") return 0.00055;
  if (regime === "bear") return -0.00055;
  return 0;
}

export function createResearchDataset(spec: ResearchDatasetSpec): FrozenDataset {
  const count = spec.days * periodsPerDay[spec.timeframe];
  const start = Date.parse(spec.start);
  const candles = Array.from({ length: count }, (_, index) => {
    const timestamp = start + index * stepMilliseconds[spec.timeframe];
    const cycle = Math.sin((index + spec.seed) / 17) * 0.012 + Math.sin((index + spec.seed) / 53) * 0.018;
    const regimeCycle = spec.regime === "sideways" ? Math.sin((index + spec.seed) / 29) * 0.035 : 0;
    const shock = Math.sin((index * 7 + spec.seed) / 11) * 0.004;
    const returnRate = regimeDrift(spec.regime) + cycle + regimeCycle + shock;
    const close = index === 0 ? spec.basePrice : Math.max(1, spec.basePrice * Math.exp((index / count) * regimeDrift(spec.regime) * 60 + returnRate));
    const previous = index === 0 ? close : spec.basePrice * Math.exp(((index - 1) / count) * regimeDrift(spec.regime) * 60 + cycle);
    const open = Math.max(1, previous);
    const range = Math.max(0.01, close * (0.006 + Math.abs(Math.sin(index / 13)) * 0.006));
    const volume = Math.round(1_000_000 + Math.abs(Math.sin((index + spec.seed) / 9)) * 450_000 + (spec.regime === "sideways" ? 100_000 : 0));
    return { date: new Date(timestamp).toISOString().slice(0, 10), timestamp, open, high: Math.max(open, close) + range, low: Math.max(0.01, Math.min(open, close) - range), close, volume, quoteVolume: close * volume };
  });
  return createFrozenDataset({
    dataset_id: spec.dataset_id,
    dataset_version: "2026-07-research-matrix-v1",
    source: "ATC deterministic synthetic research fixture; not live market evidence",
    symbol: spec.symbol,
    timeframe: spec.timeframe,
    timezone: "UTC",
    candles,
    creation_timestamp: "2026-07-13T00:00:00.000Z"
  });
}

export async function writeResearchDatasetMatrix(root = "data/frozen") {
  for (const spec of RESEARCH_DATASET_SPECS) {
    const dataset = createResearchDataset(spec);
    await writeFile(join(root, `${spec.dataset_id}.json`), JSON.stringify(dataset, null, 2), { encoding: "utf8" });
  }
}

if (process.argv[1]?.endsWith("generateReplayDatasetMatrix.ts")) await writeResearchDatasetMatrix();
