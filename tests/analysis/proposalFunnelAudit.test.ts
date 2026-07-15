import { describe, expect, it } from "vitest";
import { buildProposalFunnelAudit } from "@/lib/analysis/proposalFunnelAudit";

describe("proposal funnel audit", () => {
  it("counts stage attrition and reports the first trace/lifecycle divergence", () => {
    const timestamp = "2020-01-01T00:00:00.000Z";
    const report = buildProposalFunnelAudit({ replayId: "r1", datasetId: "d1", symbol: "BTCUSDT", generatedAt: timestamp, proposals: [{ proposal_id: "p1", lifecycle: ["SIGNAL_GENERATED", "TRADE_PROPOSED", "TRADE_REJECTED"].map((state, index) => ({ event_id: `e${index}`, trade_id: "p1", parent_trade_id: null, event_type: state, timestamp_utc: timestamp, state_before: index === 0 ? null : index === 1 ? "SIGNAL_GENERATED" : "TRADE_PROPOSED", state_after: state, filled_quantity: 0, remaining_quantity: 0, average_fill_price: 0, execution_price: null, execution_latency_ms: 0, reason: "risk gate rejected", metadata: {}, lifecycle_sequence: index + 1 } as never)) }], traces: [{ timestamp, final_status: "evidence rejected", pipeline_stage_reached: "evidence rejected", rejection_reason: "evidence failed" } as never], executions: [], trades: [] });
    expect(report.proposal_count).toBe(1);
    expect(report.stage_summaries.find((stage) => stage.stage === "evidence")?.rejected).toBe(1);
    expect(report.greatest_reduction_stage).toBe("evidence");
    expect(report.mismatch_count).toBe(1);
    expect(report.mismatches[0].proposal_id).toBe("p1");
    expect(report.mismatches[0].first_divergence).toBe("proposal");
  });
});
