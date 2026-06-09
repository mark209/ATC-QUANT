import { describe, expect, it } from "vitest";
import type { MarketAnalysisResponse } from "@/lib/data/marketDataAdapter";
import type { MarketScanResult } from "@/lib/data/marketScanner";
import type { QuantAnalysis } from "@/types/quant";
import { candidatesForUniverse, rankScanResults, summarizeScanAnalysis } from "@/lib/data/marketScanner";

function analysis(overrides: Partial<QuantAnalysis["pipeline"]["finalDecision"]> = {}): QuantAnalysis {
  return {
    assetType: "etf",
    riskProfile: "balanced",
    rangeUsage: {
      chart: "Selected chart range",
      currentSignal: "Recent 365 daily candles",
      backtest: "Full fetched history",
      validation: "Max"
    },
    riskMetrics: {
      annualizedReturn: 0,
      annualizedVolatility: 0,
      ewmaVolatility: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      valueAtRisk95: 0,
      conditionalValueAtRisk95: 0,
      expectedValue: 0,
      profitFactor: 0,
      maxDrawdown: 0,
      currentDrawdown: 0,
      recoveryTime: null,
      ratioWarnings: []
    },
    drawdown: { currentDrawdown: 0, maxDrawdown: 0, averageDrawdown: 0, maxDuration: 0, recoveryTime: null, series: [] },
    positionSizing: {
      volatilityTargetAllocation: 0.12,
      fractionalKellyAllocation: 0.08,
      assetClassMaxAllocation: 0.2,
      drawdownAdjustedAllocation: 0.15,
      finalAllocation: 0.08,
      finalPositionSize: 0.08,
      limitingConstraint: "Fractional Kelly",
      limitingFactor: "Fractional Kelly",
      riskMode: "Normal",
      exposureAdjustment: 1,
      warnings: []
    },
    investability: {
      score: 72,
      classification: "Position allowed",
      confidence: "Medium",
      riskMode: "Normal",
      explanation: "Trend is positive.",
      invalidation: "Close below long-term average.",
      monitor: [],
      signals: []
    },
    backtest: {
      assumptionLabel: "100% signal backtest",
      allocation: 1,
      totalReturn: 0,
      annualizedReturn: 0,
      cagr: 0,
      annualizedVolatility: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      maxDrawdown: 0,
      averageDrawdown: 0,
      recoveryTime: null,
      winRate: 0,
      averageWin: 0,
      averageLoss: 0,
      payoffRatio: 0,
      profitFactor: 0,
      expectedValue: 0,
      expectancy: 0,
      numberOfTrades: 0,
      totalTrades: 0,
      averageHoldingPeriod: 0,
      worstLosingStreak: 0,
      longestLosingStreak: 0,
      largestSingleLoss: 0,
      bestTrade: 0,
      worstTrade: 0,
      fees: 0,
      slippage: 0,
      feesPaid: 0,
      slippageCostEstimate: 0,
      turnover: 0,
      exposureTime: 0,
      exposureAdjustedReturn: 0,
      ratioWarnings: [],
      trades: [],
      equityCurve: [],
      drawdownCurve: []
    },
    allocationAdjustedBacktest: {
      assumptionLabel: "Allocation-adjusted backtest",
      allocation: 0.08,
      totalReturn: 0,
      annualizedReturn: 0,
      cagr: 0,
      annualizedVolatility: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      maxDrawdown: 0,
      averageDrawdown: 0,
      recoveryTime: null,
      winRate: 0,
      averageWin: 0,
      averageLoss: 0,
      payoffRatio: 0,
      profitFactor: 0,
      expectedValue: 0,
      expectancy: 0,
      numberOfTrades: 0,
      totalTrades: 0,
      averageHoldingPeriod: 0,
      worstLosingStreak: 0,
      longestLosingStreak: 0,
      largestSingleLoss: 0,
      bestTrade: 0,
      worstTrade: 0,
      fees: 0,
      slippage: 0,
      feesPaid: 0,
      slippageCostEstimate: 0,
      turnover: 0,
      exposureTime: 0,
      exposureAdjustedReturn: 0,
      ratioWarnings: [],
      trades: [],
      equityCurve: [],
      drawdownCurve: []
    },
    pipeline: {
      dataQuality: {
        passed: true,
        score: 90,
        issues: [],
        warnings: [],
        dataPoints: 250,
        requiredDataPoints: 200,
        totalCandles: 250,
        usableCandlesAfterWarmup: 50,
        estimatedTrades: 5,
        outOfSampleTrades: 2,
        walkForwardTradesPerWindow: []
      },
      hardFilters: { passed: true, failedFilters: [], warnings: [] },
      signal: {
        trendScore: 80,
        momentumScore: 70,
        regimeScore: 75,
        combinedSignalScore: 75,
        regimeLabel: "Trend Up",
        reasons: ["Trend and momentum are constructive."],
        warnings: []
      },
      risk: {
        volatilityScore: 70,
        drawdownScore: 75,
        liquidityScore: 80,
        riskAdjustedScore: 70,
        combinedRiskScore: 72,
        volatilityLabel: "Normal",
        drawdownLabel: "Normal",
        liquidityLabel: "Liquid",
        warnings: []
      },
      expectedValue: {
        expectedValue: 0.01,
        expectedValueAfterCosts: 0.006,
        winRate: 0.55,
        lossRate: 0.45,
        averageWin: 0.02,
        averageLoss: 0.012,
        payoffRatio: 1.67,
        profitFactor: 1.5,
        tradeCount: 120,
        sampleQuality: "Acceptable",
        passed: true,
        warnings: [],
        costs: { fees: 0.001, slippage: 0.001, spread: 0, averageTradeCost: 0.002 }
      },
      validation: {
        inSample: {} as QuantAnalysis["backtest"],
        outOfSample: {} as QuantAnalysis["backtest"],
        outOfSampleLabel: "Reliable",
        walkForward: {
          windowsTested: 4,
          stableWindows: 3,
          tradesPerWindow: [3, 4, 4, 5],
          averageOutOfSampleReturn: 0.1,
          averageOutOfSampleDrawdown: -0.08,
          stabilityLabel: "Stable",
          warnings: []
        },
        parameterSensitivity: {
          testedParameters: [],
          results: [],
          metrics: [],
          rangeLabel: "Max",
          robustnessLabel: "Robust",
          sensitivityLabel: "Robust",
          warnings: []
        },
        range: {
          validationRange: "Max",
          minimumOutOfSampleTrades: 20
        },
        robustnessLabel: "Robust",
        validationScore: 76,
        warnings: []
      },
      positionSizing: {
        volatilityTargetAllocation: 0.12,
        fractionalKellyAllocation: 0.08,
        assetClassMaxAllocation: 0.2,
        drawdownAdjustedAllocation: 0.15,
        finalAllocation: 0.08,
        finalPositionSize: 0.08,
        limitingConstraint: "Fractional Kelly",
        limitingFactor: "Fractional Kelly",
        riskMode: "Normal",
        exposureAdjustment: 1,
        warnings: []
      },
      portfolioRisk: {
        passed: true,
        totalExposure: 0.08,
        assetClassExposure: {},
        correlatedExposureWarnings: [],
        warnings: []
      },
      finalDecision: {
        decisionLabel: "Position allowed",
        rawModelScore: 72,
        finalScore: 72,
        scoreAdjustmentReason: "Final decision score equals the raw model score because no decision-label cap was applied.",
        signalScore: 75,
        riskScore: 72,
        validationScore: 76,
        finalPositionSize: 0.08,
        primaryReasons: ["Trend and momentum are constructive."],
        blockingReasons: [],
        warnings: [],
        ...overrides
      },
      explanation: { why: "Trend is positive.", improvements: [], blockers: [] },
      layers: {} as QuantAnalysis["pipeline"]["layers"]
    },
    optimalEntryZone: {
      symbol: "SPY",
      timeframe: "1D",
      regimeDirection: "LONG_ELIGIBLE",
      actionability: "WATCHLIST",
      entrySide: "LONG",
      entryQualityScore: 60,
      entryZone: { lower: 490, upper: 500 },
      currentPrice: 500,
      distanceFromEntryZonePercent: 0,
      invalidationPrice: 480,
      suggestedStop: 479,
      targets: [],
      vwapData: {
        sessionVWAP: 500,
        rollingVWAP7D: 498,
        rollingVWAP30D: 495,
        rollingVWAP90D: 490,
        anchoredVWAP: 496,
        vwapStdDev: 5,
        vwapZScore: 0.8,
        upperBand1: 505,
        lowerBand1: 495,
        upperBand2: 510,
        lowerBand2: 490
      },
      riskData: {
        atr: 6,
        stopDistancePercent: 4.2,
        estimatedRewardRisk: 1.5
      },
      explanation: ["Main strategy classifies asset as LONG_ELIGIBLE."],
      warnings: []
    },
    entryZoneAblation: {
      cases: [],
      warnings: []
    },
    assumptions: []
  };
}

function scanResult(overrides: Partial<MarketScanResult>): MarketScanResult {
  return {
    symbol: "SPY",
    name: "SPY",
    assetType: "etf",
    decisionLabel: "Watchlist only",
    finalScore: 50,
    finalPositionSize: 0,
    expectedValueAfterCosts: 0,
    sampleQuality: "Limited",
    validationLabel: "Moderate",
    limitingFactor: "Expected value",
    primaryReason: "",
    warning: "",
    passed: false,
    ...overrides
  };
}

describe("market scanner", () => {
  it("summarizes an investable analysis result", () => {
    const response: MarketAnalysisResponse = {
      dataset: {
        overview: {
          symbol: "SPY",
          name: "SPDR S&P 500 ETF",
          assetType: "etf",
          market: "ETF",
          exchange: "NYSE Arca",
          currentPrice: 500,
          dailyChangePercent: 0.01,
          dailyVolume: 1000000,
          lastUpdated: "2026-06-08T00:00:00.000Z",
          liveSource: "test"
        },
        prices: []
      },
      analysis: analysis()
    };

    const result = summarizeScanAnalysis(response);

    expect(result.symbol).toBe("SPY");
    expect(result.decisionLabel).toBe("Position allowed");
    expect(result.passed).toBe(true);
    expect(result.finalPositionSize).toBe(0.08);
  });

  it("blocks passed status when expected value after costs is not positive", () => {
    const base = analysis();
    base.pipeline.expectedValue.expectedValueAfterCosts = 0;
    const result = summarizeScanAnalysis({
      dataset: {
        overview: {
          symbol: "QQQ",
          name: "QQQ",
          assetType: "etf",
          market: "ETF",
          exchange: "Nasdaq",
          currentPrice: 400,
          dailyChangePercent: 0,
          dailyVolume: 1000000,
          lastUpdated: "2026-06-08T00:00:00.000Z",
          liveSource: "test"
        },
        prices: []
      },
      analysis: base
    });

    expect(result.passed).toBe(false);
  });

  it("ranks passed candidates before higher-scoring blocked candidates", () => {
    const ranked = rankScanResults([
      scanResult({ symbol: "A", finalScore: 99, passed: false }),
      scanResult({ symbol: "B", finalScore: 60, finalPositionSize: 0.04, passed: true })
    ]);

    expect(ranked[0].symbol).toBe("B");
  });

  it("limits universe candidates to the requested count", () => {
    expect(candidatesForUniverse("mixed", 3)).toHaveLength(3);
  });
});
