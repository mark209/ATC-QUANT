import { describe, expect, it } from "vitest";
import type { ReplayResultRow, PaperReplayResult } from "@/lib/quant/historicalReplay";
import {
  allocationDistribution,
  classifyAllocationBottleneck,
  profitabilityVerdict,
  summarizePaperReplay
} from "@/lib/quant/profitabilityAudit";

function row(input: Partial<ReplayResultRow>): ReplayResultRow {
  return {
    date: input.date ?? "2025-01-01",
    symbol: "TEST",
    assetType: "stock",
    finalDecision: input.finalDecision ?? "Watchlist only",
    activeAllocation: input.activeAllocation ?? 0,
    signalScore: input.signalScore ?? 70,
    riskScore: input.riskScore ?? 65,
    validationScore: input.validationScore ?? 60,
    validationEvidenceState: input.validationEvidenceState ?? "Moderate Evidence",
    evStatus: input.evStatus ?? "EV passed",
    evAfterCosts: input.evAfterCosts ?? 0.01,
    kellyAllocation: input.kellyAllocation ?? 0.02,
    dataQualityStatus: input.dataQualityStatus ?? "passed",
    regimeLabel: input.regimeLabel ?? "Trend Up",
    blockingReasons: input.blockingReasons ?? [],
    warnings: input.warnings ?? []
  };
}

function paperResult(input: Partial<PaperReplayResult>): PaperReplayResult {
  return {
    symbol: "TEST",
    assetType: "stock",
    startingCapital: 100000,
    endingEquity: 101000,
    totalReturn: 0.01,
    annualizedReturn: 0.12,
    annualizedVolatility: 0.1,
    maxDrawdown: -0.04,
    sharpeRatio: 1.2,
    sortinoRatio: 1.5,
    calmarRatio: 3,
    totalTrades: 4,
    winRate: 0.5,
    averageWin: 0.03,
    averageLoss: -0.01,
    profitFactor: 2,
    expectancyAfterCosts: 0.01,
    longestLosingStreak: 2,
    exposurePercentage: 0.4,
    averageAllocation: 0.015,
    worstMonth: { month: "2025-02", returnPct: -0.02 },
    bestMonth: { month: "2025-01", returnPct: 0.03 },
    equityCurve: [],
    drawdownCurve: [],
    trades: [],
    decisionLog: [],
    monthlyReturns: [
      { month: "2025-01", returnPct: 0.03 },
      { month: "2025-02", returnPct: -0.02 }
    ],
    ...input
  };
}

describe("profitability audit helpers", () => {
  it("buckets zero, sub-0.25%, 0.25%, 0.5%, 1%, and larger allocations", () => {
    const distribution = allocationDistribution([
      row({ activeAllocation: 0 }),
      row({ activeAllocation: 0.001 }),
      row({ activeAllocation: 0.0025 }),
      row({ activeAllocation: 0.005 }),
      row({ activeAllocation: 0.01 }),
      row({ activeAllocation: 0.03 }),
      row({ activeAllocation: 0.06 })
    ]);

    expect(distribution.counts).toEqual({
      "0%": 1,
      ">0% to 0.25%": 1,
      "0.25% to 0.50%": 1,
      "0.50% to 1.00%": 1,
      "1.00% to 2.00%": 1,
      "2.00% to 5.00%": 1,
      ">5.00%": 1
    });
    expect(distribution.zeroAllocationDays).toBe(1);
    expect(distribution.meaningfulAllocationDays).toBe(3);
  });

  it("classifies the exact blocking rule behind zero or tiny allocation", () => {
    expect(classifyAllocationBottleneck(row({ dataQualityStatus: "failed" }))).toBe("Data quality failed");
    expect(classifyAllocationBottleneck(row({ regimeLabel: "Risk-Off", finalDecision: "Risk-off / no trade" }))).toBe("Risk-off regime");
    expect(classifyAllocationBottleneck(row({ evAfterCosts: -0.01, evStatus: "EV failed" }))).toBe("Expected value failed");
    expect(classifyAllocationBottleneck(row({ validationEvidenceState: "No Evidence" }))).toBe("No validation evidence");
    expect(classifyAllocationBottleneck(row({ kellyAllocation: 0, activeAllocation: 0 }))).toBe("Kelly/sample-size sizing");
    expect(classifyAllocationBottleneck(row({ finalDecision: "Watchlist only", activeAllocation: 0.02 }))).toBe("Final decision zeroed allocation");
  });

  it("summarizes replay metrics including skipped opportunities and losing months", () => {
    const summary = summarizePaperReplay(
      paperResult({ decisionLog: [
        row({ activeAllocation: 0, signalScore: 76, regimeLabel: "Trend Up" }),
        row({ activeAllocation: 0.02, signalScore: 80, regimeLabel: "Trend Up" })
      ] })
    );

    expect(summary.skippedOpportunities).toBe(1);
    expect(summary.monthlyLossCount).toBe(1);
    expect(summary.monthlyWinCount).toBe(1);
    expect(summary.daysWithActiveAllocationPct).toBe(0.5);
    expect(summary.zeroAllocationDays).toBe(1);
  });

  it("keeps verdicts blunt about weak monthly returns and capital starvation", () => {
    const verdict = profitabilityVerdict({
      averageMonthlyReturn: 0.001,
      maxDrawdown: -0.15,
      profitFactor: 0.9,
      averageAllocation: 0.001,
      tradeCount: 3,
      sampleMonths: 8
    });

    expect(verdict.currentlyProfitable).toBe(false);
    expect(verdict.onePercentMonthlyRealistic).toBe(false);
    expect(verdict.twoPercentMonthlyRealistic).toBe(false);
    expect(verdict.fivePercentMonthlyAssessment).toContain("unrealistic");
    expect(verdict.mainBottleneck).toContain("capital-starved");
  });
});
