import { describe, expect, it } from "vitest";
import type { CapitalStarvationDecision } from "@/lib/quant/capitalStarvationAudit";
import {
  evaluateUntouchedForwardShadowTracker,
  filterUntouchedForwardRows,
  frozenFloor010Allocation,
  type UntouchedForwardTrackerVerdict
} from "@/lib/quant/untouchedForwardShadowTracker";

function decision(input: Partial<CapitalStarvationDecision>): CapitalStarvationDecision {
  return {
    date: input.date ?? "2026-07-01",
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
    nextPeriodReturn: input.nextPeriodReturn ?? 0.02,
    maxAdverseMove: input.maxAdverseMove ?? -0.01,
    maxFavorableMove: input.maxFavorableMove ?? 0.03,
    blockingReasons: input.blockingReasons ?? [],
    warnings: input.warnings ?? []
  };
}

describe("untouched forward shadow tracker", () => {
  it("keeps only rows after the previous forward cutoff", () => {
    const rows = [
      decision({ symbol: "SPY", date: "2026-06-12" }),
      decision({ symbol: "SPY", date: "2026-07-03" }),
      decision({ symbol: "AAPL", date: "2026-06-13" })
    ];

    const window = filterUntouchedForwardRows(rows, { SPY: "2026-06-12", AAPL: "2026-06-13" }, 2);

    expect(window.untouchedRows).toHaveLength(1);
    expect(window.untouchedRows[0].date).toBe("2026-07-03");
    expect(window.excludedRows).toBe(2);
    expect(window.assetsIncluded).toEqual(["SPY"]);
    expect(window.assetsExcluded).toEqual(["AAPL"]);
    expect(window.sampleLargeEnough).toBe(false);
  });

  it("freezes floor_0_10 without changing production allocation", () => {
    const safeZeroProduction = decision({ activeAllocation: 0 });
    const riskOff = decision({ activeAllocation: 0, regimeLabel: "Risk-Off", finalDecision: "Risk-off / no trade" });

    expect(frozenFloor010Allocation(safeZeroProduction)).toBe(0.001);
    expect(frozenFloor010Allocation(riskOff)).toBe(0);

    const result = evaluateUntouchedForwardShadowTracker({
      rows: [safeZeroProduction],
      previousCutoffBySymbol: { SPY: "2026-06-01" },
      minMeaningfulRows: 1,
      costScenarios: [{ name: "medium cost", costPerUnitAllocation: 0 }]
    });

    expect(result.production.performance.averageAllocation).toBe(0);
    expect(result.frozen.performance.averageAllocation).toBe(0.001);
  });

  it("detects fragile one-trade dependence and asset concentration", () => {
    const rows = [
      decision({ symbol: "SPY", date: "2026-07-01", nextPeriodReturn: 1 }),
      decision({ symbol: "SPY", date: "2026-07-22", nextPeriodReturn: -0.01 }),
      decision({ symbol: "QQQ", date: "2026-07-01", nextPeriodReturn: 0.01 }),
      decision({ symbol: "QQQ", date: "2026-07-22", nextPeriodReturn: 0.01 })
    ];

    const result = evaluateUntouchedForwardShadowTracker({
      rows,
      previousCutoffBySymbol: { SPY: "2026-06-01", QQQ: "2026-06-01" },
      minMeaningfulRows: 1,
      costScenarios: [{ name: "medium cost", costPerUnitAllocation: 0 }]
    });

    expect(result.outlierDependency.oneTradeContributionShare).toBeGreaterThan(0.5);
    expect(result.killSwitches.oneTradeContributionExceeded).toBe(true);
    expect(result.killSwitches.oneAssetProfitConcentrationExceeded).toBe(true);
    expect(result.passFail.notOutlierDependent.passed).toBe(false);
  });

  it("flags asset, regime, and evidence failures", () => {
    const rows = [
      decision({ symbol: "AAPL", date: "2026-07-01", nextPeriodReturn: -0.04 }),
      decision({ symbol: "ETHUSDT", date: "2026-07-01", assetType: "crypto", nextPeriodReturn: -0.03 }),
      decision({ symbol: "SPY", date: "2026-07-01", regimeLabel: "Risk-Off", finalDecision: "Risk-off / no trade", nextPeriodReturn: -0.05 }),
      decision({ symbol: "QQQ", date: "2026-07-01", validationEvidenceState: "Failed Evidence", activeAllocation: 0.001, nextPeriodReturn: -0.02 })
    ];

    const result = evaluateUntouchedForwardShadowTracker({
      rows,
      previousCutoffBySymbol: { AAPL: "2026-06-01", ETHUSDT: "2026-06-01", SPY: "2026-06-01", QQQ: "2026-06-01" },
      minMeaningfulRows: 1,
      costScenarios: [{ name: "medium cost", costPerUnitAllocation: 0 }]
    });

    expect(result.assetBreakdown.AAPL.flags).toContain("AAPL watchlist failure");
    expect(result.assetBreakdown.ETHUSDT.flags).toContain("ETHUSDT watchlist failure");
    expect(result.regimeBreakdown["risk-off"].recommendation).toBe("disabled");
    expect(result.evidenceBreakdown["failed validation"].totalReturn).toBeLessThan(0);
    expect(result.evidenceAnswers.failedEvidenceRowsRemainBlocked).toBe("yes");
  });

  it("returns only one of the allowed final verdicts", () => {
    const result = evaluateUntouchedForwardShadowTracker({
      rows: [],
      previousCutoffBySymbol: { SPY: "2026-06-01" },
      minMeaningfulRows: 20
    });

    const allowed: UntouchedForwardTrackerVerdict[] = [
      "Continue paper-only floor_0_10 tracking.",
      "Keep production unchanged and collect more data.",
      "Disable floor_0_10 shadow tracking due to failed forward results.",
      "Research asset exclusions before continuing.",
      "Research regime filters before continuing.",
      "Inconclusive; sample too small.",
      "Unsafe; reduce or disable allocation logic."
    ];

    expect(allowed).toContain(result.finalVerdict);
    expect(result.finalVerdict).toBe("Inconclusive; sample too small.");
    expect(result.answers.shouldRemainPaperOnly).toBe("yes");
    expect(result.answers.shouldProductionRemainUnchanged).toBe("yes");
    expect(result.answers.isFloor010ReadyForProduction).toBe("no");
    expect(result.answers.isFloor100ReadyForProduction).toBe("no");
  });
});
