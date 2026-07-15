import { describe, expect, it } from "vitest";
import { buildLongHorizonDetails } from "@/lib/analysis/longHorizon";
import { summarizeTrades } from "@/lib/analysis/statisticalAnalysis";
import type { FrozenDataset } from "@/lib/replay/frozenDataset";

const dataset = {
  candles: [
    { timestamp: Date.parse("2020-01-01T00:00:00.000Z") },
    { timestamp: Date.parse("2020-01-02T00:00:00.000Z") },
    { timestamp: Date.parse("2020-01-03T00:00:00.000Z") },
  ],
} as unknown as FrozenDataset;

describe("long-horizon analysis", () => {
  it("represents empty time segments without throwing", () => {
    const result = buildLongHorizonDetails(dataset, []);
    expect(result.segments).toHaveLength(3);
    expect(result.segments.every((segment) => segment.metrics.trade_count === 0)).toBe(true);
    expect(summarizeTrades([]).trade_count).toBe(0);
  });
});
