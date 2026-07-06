import { describe, expect, it } from "vitest";
import type { CapitalStarvationDecision } from "@/lib/quant/capitalStarvationAudit";
import {
  evaluateShadowAllocationExperiment,
  recommendShadowMode,
  shadowAllocationForMode,
  type ShadowAllocationMode
} from "@/lib/quant/shadowAllocationExperiment";

function row(input: Partial<CapitalStarvationDecision>): CapitalStarvationDecision {
  return {
    date: input.date ?? "2025-01-01",
    symbol: input.symbol ?? "TEST",
    assetType: input.assetType ?? "stock",
    finalDecision: input.finalDecision ?? "Watchlist only",
    activeAllocation: input.activeAllocation ?? 0,
    signalScore: input.signalScore ?? 72,
    riskScore: input.riskScore ?? 66,
    validationScore: input.validationScore ?? 62,
    validationEvidenceState: input.validationEvidenceState ?? "Moderate Evidence",
    evAfterCosts: input.evAfterCosts ?? 0.02,
    evPassed: input.evPassed ?? true,
    kellyAllocation: input.kellyAllocation ?? 0.004,
    preHardRuleKellyAllocation: input.preHardRuleKellyAllocation ?? 0.012,
    tradeCount: input.tradeCount ?? 80,
    sampleQuality: input.sampleQuality ?? "Acceptable",
    dataQualityPassed: input.dataQualityPassed ?? true,
    regimeLabel: input.regimeLabel ?? "Trend Up",
    nextPeriodReturn: input.nextPeriodReturn ?? 0.02,
    maxAdverseMove: input.maxAdverseMove ?? -0.01,
    maxFavorableMove: input.maxFavorableMove ?? 0.03,
    blockingReasons: input.blockingReasons ?? [],
    warnings: input.warnings ?? []
  };
}

describe("shadow allocation experiment", () => {
  it("keeps production unchanged and applies floors only after safety checks", () => {
    const safe = row({ activeAllocation: 0 });
    const riskOff = row({ activeAllocation: 0, regimeLabel: "Risk-Off", finalDecision: "Risk-off / no trade" });
    const badData = row({ activeAllocation: 0, dataQualityPassed: false });

    expect(shadowAllocationForMode(safe, "production_current")).toBe(0);
    expect(shadowAllocationForMode(safe, "floor_0_25")).toBe(0.0025);
    expect(shadowAllocationForMode(riskOff, "floor_1_00")).toBe(0);
    expect(shadowAllocationForMode(badData, "floor_0_50")).toBe(0);
  });

  it("softens validation and EV gates without allowing clearly unsafe rows", () => {
    const noEvidence = row({ validationEvidenceState: "No Evidence", activeAllocation: 0, preHardRuleKellyAllocation: 0.02 });
    const failedEvidence = row({ validationEvidenceState: "Failed Evidence", activeAllocation: 0, preHardRuleKellyAllocation: 0.02 });
    const weakEv = row({ evPassed: false, evAfterCosts: 0.001, activeAllocation: 0, preHardRuleKellyAllocation: 0.02 });
    const negativeEv = row({ evPassed: false, evAfterCosts: -0.01, activeAllocation: 0, preHardRuleKellyAllocation: 0.02 });

    expect(shadowAllocationForMode(noEvidence, "soft_validation_penalty")).toBeGreaterThan(0);
    expect(shadowAllocationForMode(failedEvidence, "soft_validation_penalty")).toBeGreaterThan(0);
    expect(shadowAllocationForMode(weakEv, "soft_ev_gate")).toBeGreaterThan(0);
    expect(shadowAllocationForMode(negativeEv, "soft_ev_gate")).toBe(0);
  });

  it("evaluates modes on holdout rows only and applies cost drag", () => {
    const selectionRows = [
      row({ date: "2025-01-01", nextPeriodReturn: 0.5 }),
      row({ date: "2025-02-01", nextPeriodReturn: 0.5 })
    ];
    const holdoutRows = [
      row({ date: "2025-03-01", nextPeriodReturn: 0.02 }),
      row({ date: "2025-04-01", nextPeriodReturn: -0.01 })
    ];

    const result = evaluateShadowAllocationExperiment({
      selectionRows,
      holdoutRows,
      modes: ["production_current", "floor_0_50"],
      costScenarios: [{ name: "medium", costPerUnitAllocation: 0.004 }]
    });
    const floor = result.modeResults.find((mode) => mode.mode === "floor_0_50");

    expect(result.selectionRows).toBe(2);
    expect(result.holdoutRows).toBe(2);
    expect(floor?.performance.totalReturn).toBeCloseTo(0.005 * (0.02 - 0.004) + 0.005 * (-0.01 - 0.004), 6);
    expect(floor?.performance.totalReturn).toBeLessThan(0.005 * 1);
  });

  it("reports robustness splits, drawdown safety, and outlier dependence", () => {
    const holdoutRows = [
      row({ date: "2025-01-01", symbol: "AAA", signalScore: 85, nextPeriodReturn: 0.1 }),
      row({ date: "2025-02-01", symbol: "AAA", signalScore: 82, nextPeriodReturn: -0.02 }),
      row({ date: "2025-03-01", symbol: "BBB", signalScore: 60, regimeLabel: "Risk-Off", nextPeriodReturn: -0.03 }),
      row({ date: "2025-04-01", symbol: "BBB", signalScore: 70, nextPeriodReturn: 0.01 })
    ];

    const result = evaluateShadowAllocationExperiment({
      selectionRows: holdoutRows,
      holdoutRows,
      modes: ["floor_1_00"],
      costScenarios: [{ name: "medium", costPerUnitAllocation: 0 }]
    });
    const mode = result.modeResults[0];

    expect(mode.robustness.bySplit["first half"].count).toBe(2);
    expect(mode.robustness.bySplit["second half"].count).toBe(2);
    expect(mode.robustness.bySplit["High confidence"].count).toBe(2);
    expect(mode.drawdownSafety.worst3DecisionSequence).toBeLessThanOrEqual(mode.drawdownSafety.worstSingleDecisionLoss);
    expect(mode.leakageAndRealism.nextPeriodReturnsUnavailableAtDecisionTime).toBe(true);
    expect(mode.outlierDependence.topTwoDecisionContributionShare).toBeGreaterThan(0);
  });

  it("prefers robust smaller paper-only modes and rejects fragile cost failure", () => {
    const modes: ShadowAllocationMode[] = ["floor_0_10", "floor_0_25", "floor_1_00"];
    const result = recommendShadowMode([
      {
        mode: "floor_1_00",
        totalReturn: 0.1,
        survivesMediumCost: true,
        secondHalfReturn: -0.01,
        maxDrawdown: -0.01,
        outlierShare: 0.2
      },
      {
        mode: "floor_0_25",
        totalReturn: 0.04,
        survivesMediumCost: true,
        secondHalfReturn: 0.02,
        maxDrawdown: -0.01,
        outlierShare: 0.2
      },
      {
        mode: "floor_0_10",
        totalReturn: 0.02,
        survivesMediumCost: true,
        secondHalfReturn: 0.01,
        maxDrawdown: -0.01,
        outlierShare: 0.2
      }
    ], modes);

    expect(result.verdict).toBe("Continue paper-only with 0.10% shadow floor.");

    const failed = recommendShadowMode([
      {
        mode: "floor_0_25",
        totalReturn: 0.04,
        survivesMediumCost: false,
        secondHalfReturn: 0.02,
        maxDrawdown: -0.01,
        outlierShare: 0.2
      }
    ], ["floor_0_25"]);

    expect(failed.verdict).toBe("Keep production unchanged; signal not robust enough.");
  });
});
