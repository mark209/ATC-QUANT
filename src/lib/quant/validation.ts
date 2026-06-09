import type { AssetType, MarketDataPoint } from "@/types/asset";
import type { BacktestSummary, BacktestValidationResult, ParameterSensitivityResult, WalkForwardResult } from "@/types/quant";
import type { QuantConfig } from "./config";
import { boundedScore } from "./config";
import { runTrendBacktest } from "./backtest";

type ValidationRange = "1y" | "3y" | "5y" | "10y" | "max";

interface ValidationOptions {
  validationRange?: ValidationRange;
}

function emptyBacktest(assetType: AssetType): BacktestSummary {
  return runTrendBacktest([], assetType);
}

function scoreBacktest(stats: BacktestSummary): number {
  return boundedScore(50 + stats.sharpeRatio * 14 + stats.profitFactor * 6 + stats.annualizedReturn * 35 + stats.maxDrawdown * 120);
}

function splitHistory(points: MarketDataPoint[]): { inSample: MarketDataPoint[]; outOfSample: MarketDataPoint[] } {
  const splitIndex = Math.max(1, Math.floor(points.length * 0.7));
  return {
    inSample: points.slice(0, splitIndex),
    outOfSample: points.slice(splitIndex)
  };
}

function validationRangeLabel(range: ValidationRange): string {
  return range === "max" ? "Max" : range.toUpperCase();
}

function rangeDays(range: ValidationRange): number | null {
  if (range === "1y") return 252;
  if (range === "3y") return 252 * 3;
  if (range === "5y") return 252 * 5;
  if (range === "10y") return 252 * 10;
  return null;
}

function selectValidationPoints(points: MarketDataPoint[], range: ValidationRange): MarketDataPoint[] {
  const days = rangeDays(range);
  return days === null ? points : points.slice(-days);
}

function minimumOutOfSampleTrades(range: ValidationRange, config: QuantConfig): number {
  if (range === "1y") return Math.max(5, Math.floor(config.validation.minOutOfSampleTrades / 2));
  if (range === "3y") return Math.max(8, Math.floor(config.validation.minOutOfSampleTrades * 0.8));
  if (range === "5y") return config.validation.minOutOfSampleTrades;
  if (range === "10y") return Math.max(15, Math.floor(config.validation.minOutOfSampleTrades * 1.5));
  return Math.max(20, config.validation.minOutOfSampleTrades * 2);
}

function hasUnadjustedEquityPrices(points: MarketDataPoint[], assetType: AssetType): boolean {
  return (
    assetType !== "crypto" &&
    points.some((point) => point.closeAdjustmentSource === "unadjusted" || point.ohlcAdjustmentSource === "unadjusted")
  );
}

function runWalkForward(points: MarketDataPoint[], assetType: AssetType, config: QuantConfig): WalkForwardResult {
  if (points.length < config.minDataPoints * 2) {
    return {
      windowsTested: 0,
      stableWindows: 0,
      tradesPerWindow: [],
      averageOutOfSampleReturn: 0,
      averageOutOfSampleDrawdown: 0,
      stabilityLabel: "Insufficient Data",
      warnings: ["Not enough history for reliable walk-forward validation."]
    };
  }

  const windowSize = Math.floor(points.length / 4);
  const returns: number[] = [];
  const drawdowns: number[] = [];
  const tradesPerWindow: number[] = [];
  for (let start = 0; start + windowSize * 2 <= points.length; start += Math.max(60, Math.floor(windowSize / 2))) {
    const test = points.slice(start + windowSize, start + windowSize * 2);
    const stats = runTrendBacktest(test, assetType, config.feeRate, config.slippageRate);
    returns.push(stats.totalReturn);
    drawdowns.push(stats.maxDrawdown);
    tradesPerWindow.push(stats.totalTrades);
  }

  const stableWindows = returns.filter((value, index) => value > 0 && drawdowns[index] > -0.25).length;
  const windowsTested = returns.length;
  const averageOutOfSampleReturn = returns.reduce((sum, value) => sum + value, 0) / Math.max(1, returns.length);
  const averageOutOfSampleDrawdown = drawdowns.reduce((sum, value) => sum + value, 0) / Math.max(1, drawdowns.length);
  const stabilityRatio = windowsTested === 0 ? 0 : stableWindows / windowsTested;
  const insufficientTradesPerWindow = tradesPerWindow.some((count) => count < config.validation.minWalkForwardTradesPerWindow);

  return {
    windowsTested,
    stableWindows,
    tradesPerWindow,
    averageOutOfSampleReturn,
    averageOutOfSampleDrawdown,
    stabilityLabel: insufficientTradesPerWindow
      ? "Insufficient trades per window"
      : stabilityRatio >= 0.7
        ? "Stable"
        : stabilityRatio >= 0.4
          ? "Mixed"
          : "Unstable",
    warnings: [
      ...(insufficientTradesPerWindow ? ["One or more walk-forward windows have too few trades for reliable validation."] : []),
      ...(!insufficientTradesPerWindow && stabilityRatio < 0.4 ? ["Walk-forward performance is unstable across test windows."] : [])
    ]
  };
}

function runParameterSensitivity(
  points: MarketDataPoint[],
  assetType: AssetType,
  config: QuantConfig,
  range: ValidationRange
): ParameterSensitivityResult {
  if (points.length < config.minDataPoints) {
    return {
      testedParameters: [],
      results: [],
      metrics: [],
      rangeLabel: validationRangeLabel(range),
      robustnessLabel: "Insufficient Data",
      sensitivityLabel: "Insufficient Data",
      warnings: ["Not enough history for parameter sensitivity testing."]
    };
  }

  const parameters = [
    [20, 100],
    [50, 150],
    [50, 200],
    [100, 200],
    [20, 200]
  ] as const;
  const testedParameters = parameters.map(([fastWindow, slowWindow]) => ({ fastWindow, slowWindow }));
  const results = testedParameters.map(({ fastWindow, slowWindow }) =>
    runTrendBacktest(points, assetType, config.feeRate, config.slippageRate, fastWindow, slowWindow)
  );
  const metrics = results.map((result, index) => {
    const tested = testedParameters[index];
    const robustnessScore = boundedScore(
      50 + result.sharpeRatio * 10 + result.annualizedReturn * 35 + result.maxDrawdown * 80 + Math.min(result.totalTrades, 30)
    );
    return {
      fastWindow: tested.fastWindow,
      slowWindow: tested.slowWindow,
      totalReturn: result.totalReturn,
      annualizedReturn: result.annualizedReturn,
      maxDrawdown: result.maxDrawdown,
      sharpeRatio: result.sharpeRatio,
      tradeCount: result.totalTrades,
      robustnessScore
    };
  });
  const positiveCount = metrics.filter((result) => result.annualizedReturn > 0 && result.sharpeRatio > 0).length;
  const robustnessScores = metrics.map((result) => result.robustnessScore);
  const robustnessRange = Math.max(...robustnessScores) - Math.min(...robustnessScores);
  const robustnessLabel =
    positiveCount >= 4 && robustnessRange < 20
      ? "Robust"
      : positiveCount >= 3 && robustnessRange < 35
        ? "Moderately Sensitive"
        : "Highly Sensitive / Overfit Risk";

  return {
    testedParameters,
    results,
    metrics,
    rangeLabel: validationRangeLabel(range),
    robustnessLabel,
    sensitivityLabel: robustnessLabel,
    warnings:
      robustnessLabel === "Highly Sensitive / Overfit Risk"
        ? ["Parameter sensitivity is high; do not cherry-pick the best setting.", "Sensitivity is evaluated with annualized return, max drawdown, Sharpe, and trade count instead of total return only."]
        : ["Sensitivity is evaluated with annualized return, max drawdown, Sharpe, and trade count instead of total return only."]
  };
}

export function validateTrendBacktest(
  points: MarketDataPoint[],
  assetType: AssetType,
  config: QuantConfig,
  options: ValidationOptions = {}
): BacktestValidationResult {
  const warnings: string[] = [];
  const validationRange = options.validationRange ?? "5y";
  const validationPoints = selectValidationPoints(points, validationRange);
  const minOosTrades = minimumOutOfSampleTrades(validationRange, config);
  const range = {
    validationRange: validationRangeLabel(validationRange),
    minimumOutOfSampleTrades: minOosTrades
  };
  const { inSample: inSamplePoints, outOfSample: outOfSamplePoints } = splitHistory(validationPoints);

  if (validationPoints.length < config.minDataPoints) {
    const insufficientWalkForward = runWalkForward(validationPoints, assetType, config);
    return {
      inSample: emptyBacktest(assetType),
      outOfSample: emptyBacktest(assetType),
      outOfSampleLabel: "Insufficient Data",
      walkForward: insufficientWalkForward,
      parameterSensitivity: {
        testedParameters: [],
        results: [],
        metrics: [],
        rangeLabel: validationRangeLabel(validationRange),
        robustnessLabel: "Insufficient Data",
        sensitivityLabel: "Insufficient Data",
        warnings: ["Not enough history for parameter sensitivity testing."]
      },
      range,
      robustnessLabel: "Insufficient Data",
      validationScore: 0,
      warnings: [
        "Insufficient data for reliable out-of-sample and walk-forward validation.",
        ...insufficientWalkForward.warnings
      ]
    };
  }

  const inSample = inSamplePoints.length > 1 ? runTrendBacktest(inSamplePoints, assetType, config.feeRate, config.slippageRate) : emptyBacktest(assetType);
  const outOfSample =
    outOfSamplePoints.length > 1 ? runTrendBacktest(outOfSamplePoints, assetType, config.feeRate, config.slippageRate) : emptyBacktest(assetType);
  const walkForward = runWalkForward(validationPoints, assetType, config);
  const parameterSensitivity = runParameterSensitivity(validationPoints, assetType, config, validationRange);
  const fullBacktest = runTrendBacktest(validationPoints, assetType, config.feeRate, config.slippageRate);
  const totalTrades = fullBacktest.totalTrades;
  const outOfSampleLabel = outOfSample.totalTrades < minOosTrades ? "Insufficient Data" : "Reliable";
  const unadjustedEquityPrices = hasUnadjustedEquityPrices(validationPoints, assetType);

  warnings.push(...walkForward.warnings, ...parameterSensitivity.warnings);
  if (outOfSamplePoints.length < config.minTradeCount) warnings.push("Out-of-sample period is short; validation confidence is limited.");
  if (totalTrades < config.validation.minTotalTrades) warnings.push("Total trades are below 30; validation is an insufficient sample.");
  if (outOfSampleLabel === "Insufficient Data") {
    warnings.push(`Out-of-sample trade count is below the ${minOosTrades}-trade minimum for ${validationRangeLabel(validationRange)} validation.`);
  }
  if (unadjustedEquityPrices) {
    warnings.push("Equity adjusted OHLC data was unavailable; validation confidence is reduced because returns/backtests may be affected by splits or corporate actions.");
  }
  warnings.push(...inSample.ratioWarnings, ...outOfSample.ratioWarnings, ...fullBacktest.ratioWarnings);

  const outOfSampleScore = scoreBacktest(outOfSample);
  const walkForwardScore =
    walkForward.stabilityLabel === "Stable"
      ? 85
      : walkForward.stabilityLabel === "Mixed"
        ? 60
        : walkForward.stabilityLabel === "Unstable"
          ? 30
          : 35;
  const sensitivityScore =
    parameterSensitivity.robustnessLabel === "Robust"
      ? 85
      : parameterSensitivity.robustnessLabel === "Moderately Sensitive"
        ? 60
        : parameterSensitivity.robustnessLabel === "Highly Sensitive / Overfit Risk"
          ? 25
          : 40;
  const rawValidationScore = boundedScore(
    outOfSampleScore * config.validationWeights.outOfSample +
      walkForwardScore * config.validationWeights.walkForward +
      sensitivityScore * config.validationWeights.parameterSensitivity
  );
  const validationScore =
    totalTrades < config.validation.minTotalTrades || outOfSampleLabel === "Insufficient Data"
      ? Math.min(rawValidationScore, 40)
      : unadjustedEquityPrices
        ? Math.min(rawValidationScore, 55)
      : rawValidationScore;
  const robustnessLabel =
    totalTrades < config.validation.minTotalTrades || outOfSampleLabel === "Insufficient Data"
      ? "Insufficient Data"
      : unadjustedEquityPrices
        ? "Moderate"
      : walkForward.stabilityLabel === "Insufficient Data" || walkForward.stabilityLabel === "Insufficient trades per window"
        ? outOfSampleLabel === "Reliable" && outOfSampleScore >= 65
          ? "Moderate"
          : "Insufficient Data"
      : validationScore >= 75
        ? "Robust"
        : validationScore >= 55
          ? "Moderate"
          : "Unstable";

  return {
    inSample,
    outOfSample,
    outOfSampleLabel,
    walkForward,
    parameterSensitivity,
    range,
    robustnessLabel,
    validationScore,
    warnings
  };
}
