import { describe, expect, it } from "vitest";
import {
  analyzeAllocationSensitivity,
  analyzeKellyRule,
  analyzeRejectedOpportunities,
  analyzeSignalQuality,
  capitalStarvationVerdict,
  type CapitalStarvationDecision
} from "@/lib/quant/capitalStarvationAudit";

function decision(input: Partial<CapitalStarvationDecision>): CapitalStarvationDecision {
  return {
    date: input.date ?? "2025-01-01",
    symbol: input.symbol ?? "TEST",
    assetType: input.assetType ?? "stock",
    finalDecision: input.finalDecision ?? "Watchlist only",
    activeAllocation: input.activeAllocation ?? 0,
    signalScore: input.signalScore ?? 70,
    riskScore: input.riskScore ?? 65,
    validationScore: input.validationScore ?? 60,
    validationEvidenceState: input.validationEvidenceState ?? "Moderate Evidence",
    evAfterCosts: input.evAfterCosts ?? 0.01,
    evPassed: input.evPassed ?? true,
    kellyAllocation: input.kellyAllocation ?? 0.01,
    preHardRuleKellyAllocation: input.preHardRuleKellyAllocation ?? input.kellyAllocation ?? 0.01,
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

describe("capital starvation root-cause audit", () => {
  it("classifies rejected opportunities and measures missed small-allocation returns", () => {
    const rows = [
      decision({ finalDecision: "Risk-off / no trade", regimeLabel: "Risk-Off", nextPeriodReturn: 0.04 }),
      decision({ validationEvidenceState: "Failed Evidence", nextPeriodReturn: -0.03 }),
      decision({ validationEvidenceState: "No Evidence", nextPeriodReturn: 0.01 }),
      decision({ evPassed: false, evAfterCosts: -0.01, nextPeriodReturn: -0.02 }),
      decision({ kellyAllocation: 0, preHardRuleKellyAllocation: 0.02, tradeCount: 12, nextPeriodReturn: 0.05 }),
      decision({ finalDecision: "Watchlist only", activeAllocation: 0, nextPeriodReturn: 0.02 }),
      decision({ finalDecision: "Small allocation only", activeAllocation: 0.004, nextPeriodReturn: 0.03 }),
      decision({ finalDecision: "Position allowed", activeAllocation: 0.02, nextPeriodReturn: 0.01 })
    ];

    const audit = analyzeRejectedOpportunities(rows, 0.0025);

    expect(audit.byCategory["rejected by risk-off regime"].count).toBe(1);
    expect(audit.byCategory["rejected by failed validation"].count).toBe(1);
    expect(audit.byCategory["rejected by no validation evidence"].count).toBe(1);
    expect(audit.byCategory["rejected by EV/expectancy gate"].count).toBe(1);
    expect(audit.byCategory["rejected by Kelly/sample-size penalty"].count).toBe(1);
    expect(audit.byCategory["rejected by final decision zeroing"].count).toBe(1);
    expect(audit.byCategory["accepted but tiny allocation"].count).toBe(1);
    expect(audit.byCategory["accepted with meaningful allocation"].count).toBe(1);
    expect(audit.byCategory["rejected by Kelly/sample-size penalty"].averageMissedReturn).toBeCloseTo(0.000125, 8);
    expect(audit.byCategory["rejected by Kelly/sample-size penalty"].netPositive).toBe(true);
  });

  it("runs allocation sensitivity scenarios without changing production allocations", () => {
    const rows = [
      decision({ date: "2025-01-01", activeAllocation: 0, nextPeriodReturn: 0.02, kellyAllocation: 0, preHardRuleKellyAllocation: 0.02, tradeCount: 10 }),
      decision({ date: "2025-02-01", activeAllocation: 0.002, nextPeriodReturn: -0.01 }),
      decision({ date: "2025-03-01", activeAllocation: 0.02, nextPeriodReturn: 0.03 })
    ];

    const scenarios = analyzeAllocationSensitivity(rows);
    const production = scenarios.find((scenario) => scenario.name === "current production allocation");
    const floor50 = scenarios.find((scenario) => scenario.name === "min allocation floor of 0.50%");
    const warmup = scenarios.find((scenario) => scenario.name === "relaxed Kelly warmup below 30 trades");

    expect(production?.averageAllocation).toBeCloseTo((0 + 0.002 + 0.02) / 3, 8);
    expect(floor50?.activeDays).toBe(3);
    expect(floor50?.percentDaysAtLeast050).toBe(1);
    expect(warmup?.averageAllocation).toBeGreaterThan(production?.averageAllocation ?? 0);
    expect(floor50?.worstDecisions[0].returnContribution).toBeLessThan(0);
    expect(floor50?.bestDecisions[0].returnContribution).toBeGreaterThan(0);
  });

  it("summarizes signal quality by confidence, EV, validation, regime, and asset", () => {
    const rows = [
      decision({ symbol: "AAA", signalScore: 85, evAfterCosts: 0.03, validationEvidenceState: "Strong Evidence", regimeLabel: "Trend Up", nextPeriodReturn: 0.04 }),
      decision({ symbol: "AAA", signalScore: 55, evAfterCosts: -0.01, validationEvidenceState: "Weak Evidence", regimeLabel: "Range / Chop", nextPeriodReturn: -0.02 }),
      decision({ symbol: "BBB", signalScore: 72, evAfterCosts: 0.005, validationEvidenceState: "Moderate Evidence", regimeLabel: "Trend Up", nextPeriodReturn: 0.01 })
    ];

    const quality = analyzeSignalQuality(rows);

    expect(quality.byConfidence["High confidence"].averageReturn).toBeCloseTo(0.04, 8);
    expect(quality.byEv["EV <= 0"].averageReturn).toBeCloseTo(-0.02, 8);
    expect(quality.byValidation["Strong Evidence"].hitRate).toBe(1);
    expect(quality.byRegime["Trend Up"].profitFactor).toBe(Number.POSITIVE_INFINITY);
    expect(quality.byAsset.AAA.count).toBe(2);
    expect(quality.overall.payoffRatio).toBeGreaterThan(1);
  });

  it("diagnoses hard Kelly blocking against softer alternatives", () => {
    const rows = [
      decision({ kellyAllocation: 0, preHardRuleKellyAllocation: 0.04, tradeCount: 10, nextPeriodReturn: 0.03 }),
      decision({ kellyAllocation: 0, preHardRuleKellyAllocation: 0.02, tradeCount: 20, nextPeriodReturn: -0.01 }),
      decision({ kellyAllocation: 0.03, preHardRuleKellyAllocation: 0.03, tradeCount: 40, nextPeriodReturn: 0.02 })
    ];

    const diagnosis = analyzeKellyRule(rows);

    expect(diagnosis.hardRuleBlockedCount).toBe(2);
    expect(diagnosis.averageAllocationBeforeHardRule).toBeCloseTo(0.03, 8);
    expect(diagnosis.averageAllocationAfterHardRule).toBe(0);
    expect(diagnosis.blockedTradeAverageReturn).toBeCloseTo(0.01, 8);
    expect(diagnosis.blockedTradesNetPositive).toBe(true);
    expect(diagnosis.alternatives["linear warmup"].averageAllocation).toBeGreaterThan(0);
    expect(diagnosis.alternatives["Bayesian/shrunk Kelly"].commentary).toContain("low-frequency");
  });

  it("returns an allowed final verdict from signal and sensitivity evidence", () => {
    expect(
      capitalStarvationVerdict({
        signalExpectancy: -0.001,
        sensitivityImprovesReturn: false,
        sensitivityMaxDrawdown: -0.05,
        sampleSize: 120
      }).verdict
    ).toBe("Signal is weak; do not increase capital.");

    expect(
      capitalStarvationVerdict({
        signalExpectancy: 0.01,
        sensitivityImprovesReturn: true,
        sensitivityMaxDrawdown: -0.08,
        sampleSize: 180
      }).verdict
    ).toBe("Signal has edge, but allocation rules are too restrictive.");

    expect(
      capitalStarvationVerdict({
        signalExpectancy: 0.01,
        sensitivityImprovesReturn: true,
        sensitivityMaxDrawdown: -0.35,
        sampleSize: 180
      }).verdict
    ).toBe("Strategy is unsafe; reduce or disable allocation.");
  });
});
