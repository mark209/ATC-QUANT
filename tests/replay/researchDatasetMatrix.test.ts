import { describe, expect, it } from "vitest";
import { validateFrozenDataset } from "@/lib/replay/frozenDataset";
import { RESEARCH_DATASET_SPECS, createResearchDataset } from "../../scripts/generateReplayDatasetMatrix";

describe("research dataset matrix", () => {
  it("covers symbols, regimes, periods, and timeframes", () => {
    expect(new Set(RESEARCH_DATASET_SPECS.map((spec) => spec.symbol)).size).toBeGreaterThan(1);
    expect(new Set(RESEARCH_DATASET_SPECS.map((spec) => spec.regime))).toEqual(new Set(["bull", "bear", "sideways"]));
    expect(new Set(RESEARCH_DATASET_SPECS.map((spec) => spec.timeframe)).size).toBeGreaterThan(1);
    expect(Math.max(...RESEARCH_DATASET_SPECS.map((spec) => spec.days))).toBeGreaterThan(365);
  });

  it("creates valid frozen datasets with deterministic hashes", () => {
    const first = createResearchDataset(RESEARCH_DATASET_SPECS[0]);
    const second = createResearchDataset(RESEARCH_DATASET_SPECS[0]);
    expect(validateFrozenDataset(first).dataset_hash).toBe(second.dataset_hash);
    expect(first.candle_count).toBe(1095);
    expect(first.source).toContain("not live market evidence");
  });
});
