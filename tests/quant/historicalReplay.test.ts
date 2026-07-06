import { describe, expect, it } from "vitest";
import type { MarketDataPoint } from "@/types/asset";
import type { QuantAnalysis } from "@/types/quant";
import {
  type ReplayResultRow,
  calculateBenchmarks,
  runHistoricalDecisionReplay,
  runMonteCarloStressTest,
  simulatePaperPortfolio
} from "@/lib/quant/historicalReplay";

function point(index: number, close: number, open = close): MarketDataPoint {
  const timestamp = Date.UTC(2025, 0, index + 1);
  return {
    date: new Date(timestamp).toISOString().slice(0, 10),
    timestamp,
    open,
    high: Math.max(open, close) * 1.01,
    low: Math.min(open, close) * 0.99,
    close,
    volume: 1_000_000,
    quoteVolume: close * 1_000_000
  };
}

function analysis(decision: string, allocation: number): QuantAnalysis {
  return ({
    pipeline: {
      finalDecision: {
        decisionLabel: decision,
        finalPositionSize: allocation,
        signalScore: 70,
        riskScore: 65,
        validationScore: 60,
        blockingReasons: decision === "Avoid for now" ? ["Test avoid"] : [],
        warnings: []
      },
      validation: {
        validationEvidenceState: "Moderate Evidence"
      },
      expectedValue: {
        expectedValueAfterCosts: allocation > 0 ? 0.01 : 0,
        passed: allocation > 0,
        warnings: []
      },
      positionSizing: {
        fractionalKellyAllocation: allocation
      },
      dataQuality: {
        passed: true
      },
      signal: {
        regimeLabel: allocation > 0 ? "Trend Up" : "Risk-Off"
      }
    }
  } as unknown) as QuantAnalysis;
}

describe("historical paper replay", () => {
  it("replay uses only candles available up to each replay date", () => {
    const candles = [point(0, 100), point(1, 101), point(2, 102), point(3, 103)];
    const seenLengths: number[] = [];

    const rows = runHistoricalDecisionReplay({
      symbol: "TEST",
      assetType: "stock",
      candles,
      startDate: candles[1].date,
      endDate: candles[3].date,
      rebalanceEveryDays: 1,
      analyzer: (available) => {
        seenLengths.push(available.length);
        return analysis("Position allowed", 0.1);
      }
    });

    expect(rows).toHaveLength(3);
    expect(seenLengths).toEqual([2, 3, 4]);
  });

  it("Avoid/Risk-off/No Data decisions create zero allocation while Small allocation uses active allocation", () => {
    const candles = [point(0, 100), point(1, 100), point(2, 100), point(3, 100)];
    const decisions = ["Avoid for now", "Risk-off / no trade", "No Data / Avoid", "Small allocation only"];
    let index = 0;

    const rows = runHistoricalDecisionReplay({
      symbol: "TEST",
      assetType: "stock",
      candles,
      rebalanceEveryDays: 1,
      analyzer: () => {
        const decision = decisions[index++];
        return analysis(decision, decision === "Small allocation only" ? 0.004 : 0.2);
      }
    });

    expect(rows.map((row) => row.activeAllocation)).toEqual([0, 0, 0, 0.004]);
  });

  it("paper portfolio uses next candle open execution and applies fees and slippage", () => {
    const candles = [point(0, 100, 100), point(1, 100, 110), point(2, 120, 120)];
    const rows: ReplayResultRow[] = [
      {
        date: candles[0].date,
        symbol: "TEST",
        assetType: "stock",
        finalDecision: "Position allowed",
        activeAllocation: 0.5,
        signalScore: 70,
        riskScore: 70,
        validationScore: 70,
        validationEvidenceState: "Moderate Evidence",
        evStatus: "EV passed",
        evAfterCosts: 0.01,
        kellyAllocation: 0.5,
        dataQualityStatus: "passed",
        regimeLabel: "Trend Up",
        blockingReasons: [],
        warnings: []
      }
    ];

    const result = simulatePaperPortfolio({
      symbol: "TEST",
      assetType: "stock",
      candles,
      replayRows: [...rows],
      startingCapital: 100000,
      feeRate: 0.001,
      slippageRate: 0.01
    });

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].executionDate).toBe(candles[1].date);
    expect(result.trades[0].executionPrice).toBeCloseTo(111.1, 6);
    expect(result.trades[0].feesPaid).toBeGreaterThan(0);
    expect(result.equityCurve.at(-1)?.equity).toBeGreaterThan(100000);
  });

  it("drawdown calculation and benchmarks are calculated separately", () => {
    const candles = [point(0, 100), point(1, 80), point(2, 90)];
    const replayRows: ReplayResultRow[] = candles.slice(0, 2).map((candle) => ({
      date: candle.date,
      symbol: "TEST",
      assetType: "stock" as const,
      finalDecision: "Position allowed",
      activeAllocation: 1,
      signalScore: 70,
      riskScore: 70,
      validationScore: 70,
      validationEvidenceState: "Moderate Evidence",
      evStatus: "EV passed" as const,
      evAfterCosts: 0.01,
      kellyAllocation: 1,
      dataQualityStatus: "passed",
      regimeLabel: "Trend Up",
      blockingReasons: [],
      warnings: []
    }));

    const result = simulatePaperPortfolio({ symbol: "TEST", assetType: "stock", candles, replayRows, startingCapital: 100000 });
    const benchmarks = calculateBenchmarks([{ symbol: "TEST", assetType: "stock", candles }], 100000);

    expect(result.maxDrawdown).toBeLessThanOrEqual(0);
    expect(benchmarks.buyAndHold[0].symbol).toBe("TEST");
    expect(benchmarks.buyAndHold[0].totalReturn).not.toBe(result.totalReturn);
  });

  it("Monte Carlo returns valid percentile outputs", () => {
    const result = runMonteCarloStressTest([0.1, -0.05, 0.03, -0.02], {
      startingCapital: 100000,
      simulations: 100,
      seed: 42
    });

    expect(result.medianEndingEquity).toBeGreaterThan(0);
    expect(result.percentile5EndingEquity).toBeLessThanOrEqual(result.percentile95EndingEquity);
    expect(result.probabilityDrawdown10).toBeGreaterThanOrEqual(0);
    expect(result.probabilityDrawdown10).toBeLessThanOrEqual(1);
  });
});
