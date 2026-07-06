import { describe, expect, it } from "vitest";
import type { CapitalStarvationDecision } from "@/lib/quant/capitalStarvationAudit";
import {
  appendForwardEvidenceRows,
  assessForwardEvidenceThresholds,
  attachForwardOutcome,
  classifyForwardJournalRow,
  createForwardJournalRow,
  evaluateForwardEvidenceJournal,
  loadFrozenPolicyManifest,
  type ForwardEvidenceVerdict,
  type FrozenShadowPolicyManifest
} from "@/lib/quant/forwardEvidenceAccumulator";

function manifest(input: Partial<FrozenShadowPolicyManifest> = {}): FrozenShadowPolicyManifest {
  return {
    policyName: "frozen_floor_0_10",
    policyVersion: input.policyVersion ?? "2026-07-06.floor_0_10.v1",
    allocationFloor: 0.001,
    dateFrozen: "2026-07-06",
    sourceReport: "ATC_SHADOW_ALLOCATION_EXPERIMENT_REPORT.md",
    ruleSummary: "Apply a 0.10% paper-only floor only when strict shadow safety gates pass.",
    safetyRestrictions: ["No live trading", "Risk-off remains blocked", "Failed/no evidence remains blocked"],
    costAssumptions: [{ name: "medium cost", costPerUnitAllocation: 0.004 }],
    productionStatus: "paper-only",
    productionPromotionStatus: "not approved",
    ...input
  };
}

function decision(input: Partial<CapitalStarvationDecision>): CapitalStarvationDecision {
  return {
    date: input.date ?? "2026-07-10",
    symbol: input.symbol ?? "SPY",
    assetType: input.assetType ?? "etf",
    finalDecision: input.finalDecision ?? "Watchlist only",
    activeAllocation: input.activeAllocation ?? 0,
    signalScore: input.signalScore ?? 72,
    riskScore: input.riskScore ?? 65,
    validationScore: input.validationScore ?? 64,
    validationEvidenceState: input.validationEvidenceState ?? "Moderate Evidence",
    evAfterCosts: input.evAfterCosts ?? 0.02,
    evPassed: input.evPassed ?? true,
    kellyAllocation: input.kellyAllocation ?? 0.004,
    preHardRuleKellyAllocation: input.preHardRuleKellyAllocation ?? 0.012,
    tradeCount: input.tradeCount ?? 80,
    sampleQuality: input.sampleQuality ?? "Acceptable",
    dataQualityPassed: input.dataQualityPassed ?? true,
    regimeLabel: input.regimeLabel ?? "Trend Up",
    nextPeriodReturn: input.nextPeriodReturn ?? null,
    maxAdverseMove: input.maxAdverseMove ?? null,
    maxFavorableMove: input.maxFavorableMove ?? null,
    blockingReasons: input.blockingReasons ?? ["sample reason"],
    warnings: input.warnings ?? []
  };
}

describe("forward evidence accumulator", () => {
  it("loads and validates the frozen paper-only policy manifest", () => {
    const loaded = loadFrozenPolicyManifest(manifest());

    expect(loaded.policyName).toBe("frozen_floor_0_10");
    expect(loaded.allocationFloor).toBe(0.001);
    expect(loaded.productionStatus).toBe("paper-only");
    expect(loaded.productionPromotionStatus).toBe("not approved");
  });

  it("creates deterministic append-only journal rows with frozen shadow fields", () => {
    const policy = manifest();
    const source = decision({ activeAllocation: 0, nextPeriodReturn: 0.05 });
    const row = createForwardJournalRow({
      decision: source,
      manifest: policy,
      timestamp: "2026-07-06T12:00:00.000Z",
      costModel: { name: "medium cost", costPerUnitAllocation: 0.004 },
      priceReference: { close: 100, source: "unit-test", asOfDate: "2026-07-10" }
    });
    const repeated = createForwardJournalRow({
      decision: source,
      manifest: policy,
      timestamp: "2026-07-07T12:00:00.000Z",
      costModel: { name: "medium cost", costPerUnitAllocation: 0.004 },
      priceReference: { close: 100, source: "unit-test", asOfDate: "2026-07-10" }
    });

    expect(row.rowId).toBe(repeated.rowId);
    expect(row.asset).toBe("SPY");
    expect(row.productionDecision).toBe("Watchlist only");
    expect(row.productionAllocation).toBe(0);
    expect(row.frozenShadowMode).toBe("frozen_floor_0_10");
    expect(row.frozenShadowAllocation).toBe(0.001);
    expect(row.nextPeriodReturn).toBeNull();
    expect(row.outcomeStatus).toBe("pending outcome");
    expect(row.eligibleForEvaluation).toBe(false);
  });

  it("detects duplicate rows using asset, date, policy version, and decision hashes", () => {
    const policy = manifest();
    const row = createForwardJournalRow({
      decision: decision({ symbol: "QQQ", date: "2026-07-10" }),
      manifest: policy,
      timestamp: "2026-07-06T12:00:00.000Z",
      costModel: { name: "medium cost", costPerUnitAllocation: 0.004 }
    });
    const same = { ...row, timestamp: "2026-07-07T12:00:00.000Z" };
    const differentPolicy = createForwardJournalRow({
      decision: decision({ symbol: "QQQ", date: "2026-07-10" }),
      manifest: manifest({ policyVersion: "2026-07-06.floor_0_10.v2" }),
      timestamp: "2026-07-07T12:00:00.000Z",
      costModel: { name: "medium cost", costPerUnitAllocation: 0.004 }
    });

    const result = appendForwardEvidenceRows([row], [same, differentPolicy]);

    expect(result.attemptedRows).toBe(2);
    expect(result.appendedRows).toBe(1);
    expect(result.skippedDuplicateRows).toBe(1);
    expect(result.rowsToAppend[0].policyVersion).toBe("2026-07-06.floor_0_10.v2");
  });

  it("classifies pending, attached, invalid, and evaluation-ready outcomes without treating pending as zero", () => {
    const pending = createForwardJournalRow({
      decision: decision({ symbol: "AAPL" }),
      manifest: manifest(),
      timestamp: "2026-07-06T12:00:00.000Z",
      costModel: { name: "medium cost", costPerUnitAllocation: 0.004 }
    });
    const attached = { ...pending, nextPeriodReturn: 0.03, outcomeStatus: "outcome attached" as const, eligibleForEvaluation: false };
    const ready = attachForwardOutcome(pending, 0.03, "2026-08-01T00:00:00.000Z");
    const invalid = { ...pending, asset: "" };

    expect(classifyForwardJournalRow(pending)).toBe("pending outcome");
    expect(classifyForwardJournalRow(attached)).toBe("outcome attached");
    expect(classifyForwardJournalRow(ready)).toBe("evaluation-ready");
    expect(classifyForwardJournalRow(invalid)).toBe("invalid/missing data");

    const evaluation = evaluateForwardEvidenceJournal([pending, ready]);
    expect(evaluation.journalStatus.pendingOutcomeRows).toBe(1);
    expect(evaluation.journalStatus.evaluationReadyRows).toBe(1);
    expect(evaluation.shadow.performance.totalReturn).toBeCloseTo(0.001 * (0.03 - 0.004), 8);
  });

  it("reports minimum sample threshold status before allowing conclusions", () => {
    const rows = Array.from({ length: 99 }, (_, index) =>
      attachForwardOutcome(
        createForwardJournalRow({
          decision: decision({ symbol: index % 2 === 0 ? "SPY" : "QQQ", date: `2026-07-${String((index % 28) + 1).padStart(2, "0")}` }),
          manifest: manifest(),
          timestamp: "2026-07-06T12:00:00.000Z",
          costModel: { name: "medium cost", costPerUnitAllocation: 0.004 }
        }),
        0.01,
        "2026-08-01T00:00:00.000Z"
      )
    );

    const status = assessForwardEvidenceThresholds(rows);

    expect(status.preliminaryReadMet).toBe(false);
    expect(status.weakEvidenceMet).toBe(false);
    expect(status.strongerEvidenceMet).toBe(false);
    expect(status.activeShadowDecisionThresholdMet).toBe(true);
    expect(status.assetRobustnessMet).toBe(false);
  });

  it("applies pass/fail gates and returns an allowed verdict", () => {
    const rows = [
      attachForwardOutcome(createForwardJournalRow({ decision: decision({ symbol: "SPY", date: "2026-07-01" }), manifest: manifest(), timestamp: "2026-07-01T00:00:00.000Z", costModel: { name: "medium cost", costPerUnitAllocation: 0.004 } }), 0.04, "2026-08-01T00:00:00.000Z"),
      attachForwardOutcome(createForwardJournalRow({ decision: decision({ symbol: "QQQ", date: "2026-07-02" }), manifest: manifest(), timestamp: "2026-07-02T00:00:00.000Z", costModel: { name: "medium cost", costPerUnitAllocation: 0.004 } }), -0.08, "2026-08-01T00:00:00.000Z")
    ];

    const result = evaluateForwardEvidenceJournal(rows, {
      thresholds: {
        preliminaryRows: 1,
        weakEvidenceRows: 2,
        strongerEvidenceRows: 3,
        minActiveShadowDecisions: 1,
        minAssets: 1,
        minRegimes: 1
      }
    });
    const allowed: ForwardEvidenceVerdict[] = [
      "Continue collecting forward evidence.",
      "Preliminary positive, continue paper-only.",
      "Preliminary negative, keep production unchanged.",
      "Inconclusive; sample too small.",
      "Fragile; edge depends on outliers.",
      "Unsafe; disable shadow tracking.",
      "Ready for deeper paper-trading simulation, not live trading."
    ];

    expect(allowed).toContain(result.finalVerdict);
    expect(result.passFail.mediumCostTotalReturnPositive.passed).toBe(false);
    expect(result.passFail.expectancyPositiveAfterCosts.passed).toBe(false);
    expect(result.finalVerdict).toBe("Preliminary negative, keep production unchanged.");
  });
});
