import { describe, expect, it } from "vitest";
import { runTrendBacktest, createTrendBacktestCache } from "@/lib/quant/backtest";
import { createBundledResearchDataset } from "@/lib/replay/sampleDataset";

describe("deterministic backtest cache", () => {
  it("returns bit-for-bit identical output to the uncached calculation", () => {
    const dataset = createBundledResearchDataset();
    const points = dataset.candles.slice(0, 240);
    const uncached = runTrendBacktest(points, "stock");
    const cached = runTrendBacktest(points, "stock", 0.001, 0.001, 50, 200, createTrendBacktestCache(points));
    expect(cached).toEqual(uncached);
  });
});
