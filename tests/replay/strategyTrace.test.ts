import { describe, expect, it } from "vitest";
import { createBundledResearchDataset } from "@/lib/replay/sampleDataset";
import { buildStrategyTraceReport, generateStrategyTrace, renderStrategyTraceReport } from "@/lib/replay/strategyTrace";

describe("strategy trace explainability", () => {
  it("traces every candle and identifies warm-up exclusions", () => {
    const dataset = createBundledResearchDataset();
    const traces = generateStrategyTrace({ replayId: "trace-test", dataset, assetType: "stock", riskProfile: "balanced", executionEvents: [], trades: [] });
    expect(traces).toHaveLength(dataset.candles.length);
    expect(traces.slice(0, 60).every((trace) => trace.final_status === "no signal" && trace.pipeline_stage_reached === "warm-up")).toBe(true);
    expect(traces.slice(60).every((trace) => trace.signal !== null && trace.rejection_reason !== null)).toBe(true);
  });

  it("reports decision-tree counts, hotspots, percentages, and timeline", () => {
    const dataset = createBundledResearchDataset();
    const traces = generateStrategyTrace({ replayId: "report-test", dataset, assetType: "stock", riskProfile: "balanced", executionEvents: [], trades: [] });
    const report = buildStrategyTraceReport({ replayId: "report-test", datasetId: dataset.dataset_id, generatedAt: "2026-01-01T00:00:00.000Z", traces });
    expect(Object.values(report.counts).reduce((sum, count) => sum + count, 0)).toBe(dataset.candles.length);
    expect(report.rejection_summary.some((item) => item.stage === "signal rejected")).toBe(true);
    expect(report.timeline).toHaveLength(dataset.candles.length);
    expect(renderStrategyTraceReport(report)).toContain("Hotspot analysis");
  });
});
