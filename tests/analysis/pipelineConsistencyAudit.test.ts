import { describe, expect, it } from "vitest";
import { buildPipelineConsistencyAudit } from "@/lib/analysis/pipelineConsistencyAudit";

describe("pipeline consistency audit", () => {
  it("creates one canonical lineage and validates identifiers", () => {
    const timestamp = "2020-01-01T00:00:00.000Z";
    const states = ["SIGNAL_GENERATED", "TRADE_PROPOSED", "RISK_VALIDATED", "ORDER_CREATED", "ORDER_PENDING", "POSITION_OPEN", "POSITION_CLOSED", "TRADE_COMPLETED"];
    const lifecycle = states.map((state, index) => ({ event_id: `life-${index}`, trade_id: "p1", parent_trade_id: null, event_type: state, timestamp_utc: timestamp, state_before: index ? states[index - 1] : null, state_after: state, filled_quantity: 1, remaining_quantity: 0, average_fill_price: 1, execution_price: 1, execution_latency_ms: 0, reason: "ok", metadata: { replay_id: "r1" }, lifecycle_sequence: index + 1 } as never));
    const report = buildPipelineConsistencyAudit({ generatedAt: timestamp, replayId: "r1", dataset: { dataset_id: "d1" } as never, manifest: {} as never, artifactManifest: { execution_journal_hash: "x", lifecycle_journal_hash: "x", trade_journal_hash: "x", analytics_hash: "x", replay_report_hash: "x", dataset_hash: "x" }, analytics: {}, replayReport: {}, lifecycle, executions: [{ event_id: "exec-1", trade_id: "p1", filled_quantity: 1, event_sequence: 1, metadata: { replay_id: "r1" } } as never], trades: [{ trade_id: "p1", replay_id: "r1" } as never], traces: [{ timestamp, final_status: "completed trade", pipeline_stage_reached: "completed trade" } as never], proposalAudit: { mismatches: [], lifecycle_unemitted_stages: [] } as never, verification: { status: "PASS", deterministic_status: "PASS" } as never, timestampAudit: { historical_failure_found: false, corrected_replay_passes: true, root_cause: "none", affected_files: [], affected_artifacts: [], deterministic_replay_compromised: false, replay_results_valid_after_correction: true, remediation: "none" } });
    expect(report.canonical_lineages).toHaveLength(1);
    expect(report.integrity.proposal_count).toBe(1);
    expect(report.integrity.duplicate_proposals).toBe(0);
    expect(report.integrity.missing_execution).toBe(0);
    expect(report.integrity.missing_trade).toBe(0);
    expect(report.integrity.impossible_transitions).toBe(0);
  });
});
