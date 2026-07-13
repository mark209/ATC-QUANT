import { describe, expect, it } from "vitest";
import { createBundledResearchDataset } from "@/lib/replay/sampleDataset";
import { generateDecisionPipelineDiagnostics, renderDecisionPipelineReport } from "@/lib/replay/decisionPipelineDiagnostics";

describe("decision pipeline diagnostics", () => {
  it("builds a monotonic funnel and explicit rejection records", () => {
    const dataset = createBundledResearchDataset();
    const diagnostics = generateDecisionPipelineDiagnostics({ replayId: "diagnostic-test", generatedAt: "2026-01-01T00:00:00.000Z", dataset, assetType: "stock", riskProfile: "balanced", executionEvents: [], lifecycleEvents: [], trades: [] });
    expect(diagnostics.funnel.historicalCandles).toBe(dataset.candles.length);
    expect(diagnostics.funnel.technicalSignals).toBe(dataset.candles.length - 60);
    expect(diagnostics.rejections.every((record) => record.replay_id === "diagnostic-test" && record.rejection_reason.length > 0)).toBe(true);
    expect(diagnostics.funnel.evidenceQualifiedSignals).toBeLessThanOrEqual(diagnostics.funnel.technicalSignals);
    expect(diagnostics.funnel.riskApprovedSignals).toBeLessThanOrEqual(diagnostics.funnel.evidenceQualifiedSignals);
  });

  it("renders the required report sections", () => {
    const dataset = createBundledResearchDataset();
    const diagnostics = generateDecisionPipelineDiagnostics({ replayId: "report-test", generatedAt: "2026-01-01T00:00:00.000Z", dataset, assetType: "stock", riskProfile: "balanced", executionEvents: [], lifecycleEvents: [], trades: [] });
    const report = renderDecisionPipelineReport(diagnostics);
    expect(report).toContain("Pipeline funnel");
    expect(report).toContain("Rejection histogram");
    expect(report).toContain("EV distribution");
    expect(report).toContain("Kelly distribution");
    expect(report).toContain("Decision timeline");
  });
});
