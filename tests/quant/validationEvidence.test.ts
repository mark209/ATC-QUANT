import { afterEach, describe, expect, it, vi } from "vitest";
import type { AssetType, MarketDataPoint } from "@/types/asset";
import type { BacktestSummary } from "@/types/quant";
import { DEFAULT_QUANT_CONFIG } from "@/lib/quant/config";

type MockStats = Partial<BacktestSummary>;
type ScenarioStats = { totalTrades: number } & Partial<BacktestSummary>;

const scenario = vi.hoisted(() => ({
  full: { totalTrades: 0 },
  inSample: { totalTrades: 0 },
  outOfSample: { totalTrades: 0 },
  walkForward: { totalTrades: 3 },
  parameter: { totalTrades: 10 }
}));

function summary(stats: MockStats = {}): BacktestSummary {
  return {
    assumptionLabel: "mock",
    allocation: 1,
    totalReturn: stats.totalReturn ?? 0.05,
    annualizedReturn: stats.annualizedReturn ?? 0.08,
    cagr: stats.cagr ?? 0.08,
    annualizedVolatility: stats.annualizedVolatility ?? 0.12,
    sharpeRatio: stats.sharpeRatio ?? 0.8,
    sortinoRatio: stats.sortinoRatio ?? 0.9,
    calmarRatio: stats.calmarRatio ?? 0.7,
    maxDrawdown: stats.maxDrawdown ?? -0.08,
    averageDrawdown: stats.averageDrawdown ?? -0.03,
    recoveryTime: stats.recoveryTime ?? null,
    winRate: stats.winRate ?? 0.55,
    averageWin: stats.averageWin ?? 0.08,
    averageLoss: stats.averageLoss ?? -0.04,
    payoffRatio: stats.payoffRatio ?? 2,
    profitFactor: stats.profitFactor ?? 1.4,
    expectedValue: stats.expectedValue ?? 0.02,
    expectancy: stats.expectancy ?? 0.02,
    numberOfTrades: stats.numberOfTrades ?? stats.totalTrades ?? 0,
    totalTrades: stats.totalTrades ?? 0,
    averageHoldingPeriod: stats.averageHoldingPeriod ?? 20,
    worstLosingStreak: stats.worstLosingStreak ?? 1,
    longestLosingStreak: stats.longestLosingStreak ?? 1,
    largestSingleLoss: stats.largestSingleLoss ?? -0.05,
    bestTrade: stats.bestTrade ?? 0.12,
    worstTrade: stats.worstTrade ?? -0.05,
    fees: stats.fees ?? 0,
    slippage: stats.slippage ?? 0,
    feesPaid: stats.feesPaid ?? 0,
    slippageCostEstimate: stats.slippageCostEstimate ?? 0,
    turnover: stats.turnover ?? 0,
    exposureTime: stats.exposureTime ?? 0,
    exposureAdjustedReturn: stats.exposureAdjustedReturn ?? 0,
    ratioWarnings: stats.ratioWarnings ?? [],
    trades: stats.trades ?? [],
    equityCurve: stats.equityCurve ?? [],
    drawdownCurve: stats.drawdownCurve ?? []
  };
}

vi.mock("@/lib/quant/backtest", () => ({
  runTrendBacktest: (points: MarketDataPoint[], _assetType: AssetType, _fee?: number, _slip?: number, fastWindow?: number) => {
    if (fastWindow !== undefined) return summary(scenario.parameter);
    if (points.length === 0) return summary({ totalTrades: 0, totalReturn: 0, annualizedReturn: 0, profitFactor: 0, sharpeRatio: 0 });
    const validationLength = 1000;
    if (points.length === validationLength) return summary(scenario.full);
    if (points.length === Math.floor(validationLength * 0.7)) return summary(scenario.inSample);
    if (points.length === validationLength - Math.floor(validationLength * 0.7)) return summary(scenario.outOfSample);
    return summary(scenario.walkForward);
  }
}));

function points(length: number): MarketDataPoint[] {
  return Array.from({ length }, (_, index) => {
    const close = 100 + index * 0.1;
    return {
      date: new Date(Date.UTC(2020, 0, index + 1)).toISOString().slice(0, 10),
      timestamp: Date.UTC(2020, 0, index + 1),
      open: close,
      high: close * 1.01,
      low: close * 0.99,
      close,
      volume: 1_000_000,
      quoteVolume: close * 1_000_000
    };
  });
}

async function validateWith(stats: { full: ScenarioStats; outOfSample: ScenarioStats; walkForward?: ScenarioStats; parameter?: ScenarioStats }) {
  scenario.full = stats.full;
  scenario.inSample = { totalTrades: Math.max(0, (stats.full.totalTrades ?? 0) - (stats.outOfSample.totalTrades ?? 0)) };
  scenario.outOfSample = stats.outOfSample;
  scenario.walkForward = stats.walkForward ?? { totalTrades: 3 };
  scenario.parameter = stats.parameter ?? { totalTrades: 12, annualizedReturn: 0.08, sharpeRatio: 0.8, maxDrawdown: -0.08 };
  const { validateTrendBacktest } = await import("@/lib/quant/validation");
  return validateTrendBacktest(points(1000), "stock", DEFAULT_QUANT_CONFIG, { validationRange: "max" });
}

describe("graded validation evidence states", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("marks histories below 252 candles as No Evidence", async () => {
    const { validateTrendBacktest } = await import("@/lib/quant/validation");
    const result = validateTrendBacktest(points(120), "stock", DEFAULT_QUANT_CONFIG, { validationRange: "max" });

    expect(result.validationEvidenceState).toBe("No Evidence");
    expect(result.validationScore).toBe(0);
  });

  it("marks enough candles but zero trades as No Evidence", async () => {
    const result = await validateWith({ full: { totalTrades: 0 }, outOfSample: { totalTrades: 0 } });

    expect(result.validationEvidenceState).toBe("No Evidence");
    expect(result.validationScore).toBeLessThanOrEqual(10);
  });

  it("marks 20-29 total trades with some positive OOS trades as Weak Evidence", async () => {
    const result = await validateWith({
      full: { totalTrades: 24 },
      outOfSample: { totalTrades: 6, totalReturn: 0.04, expectancy: 0.02 }
    });

    expect(result.validationEvidenceState).toBe("Weak Evidence");
    expect(result.robustnessLabel).not.toBe("Insufficient Data");
    expect(result.warnings).toContain("Validation evidence is weak due to low OOS trade count.");
  });

  it("marks 30-59 total trades with acceptable OOS result as Moderate Evidence", async () => {
    const result = await validateWith({
      full: { totalTrades: 44 },
      outOfSample: { totalTrades: 12, totalReturn: 0.06, expectancy: 0.02 }
    });

    expect(result.validationEvidenceState).toBe("Moderate Evidence");
    expect(result.validationScore).toBeGreaterThanOrEqual(45);
  });

  it("marks 60+ total trades with adequate OOS support as Strong Evidence", async () => {
    const result = await validateWith({
      full: { totalTrades: 72, annualizedReturn: 0.12, sharpeRatio: 1.1, profitFactor: 1.8 },
      outOfSample: { totalTrades: 22, totalReturn: 0.12, annualizedReturn: 0.1, sharpeRatio: 1.1, profitFactor: 1.7 },
      walkForward: { totalTrades: 4 },
      parameter: { totalTrades: 20, annualizedReturn: 0.1, sharpeRatio: 1.1, maxDrawdown: -0.06 }
    });

    expect(result.validationEvidenceState).toBe("Strong Evidence");
    expect(result.robustnessLabel).toBe("Robust");
  });

  it("marks materially bad OOS evidence as Failed Evidence", async () => {
    const result = await validateWith({
      full: { totalTrades: 44 },
      outOfSample: { totalTrades: 12, totalReturn: -0.12, annualizedReturn: -0.15, expectancy: -0.04, maxDrawdown: -0.3 }
    });

    expect(result.validationEvidenceState).toBe("Failed Evidence");
    expect(result.validationScore).toBeLessThanOrEqual(35);
  });
});
