import type { AssetType, MarketDataPoint } from "@/types/asset";
import type { BacktestSummary, BacktestValidationResult, ParameterSensitivityResult, WalkForwardResult } from "@/types/quant";
import type { QuantConfig } from "./config";
import { boundedScore } from "./config";
import { runTrendBacktest } from "./backtest";

function emptyBacktest(assetType: AssetType): BacktestSummary {
  return runTrendBacktest([], assetType);
}

function scoreBacktest(stats: BacktestSummary): number {
  return boundedScore(50 + stats.sharpeRatio * 12 + stats.profitFactor * 8 + stats.totalReturn * 40 + stats.maxDrawdown * 120);
}

function splitHistory(points: MarketDataPoint[]): { inSample: MarketDataPoint[]; outOfSample: MarketDataPoint[] } {
  const splitIndex = Math.max(1, Math.floor(points.length * 0.7));
  return {
    inSample: points.slice(0, splitIndex),
    outOfSample: points.slice(splitIndex)
  };
}

function runWalkForward(points: MarketDataPoint[], assetType: AssetType, config: QuantConfig): WalkForwardResult {
  if (points.length < config.minDataPoints * 2) {
    return {
      windowsTested: 0,
      stableWindows: 0,
      averageOutOfSampleReturn: 0,
      averageOutOfSampleDrawdown: 0,
      stabilityLabel: "Insufficient sample",
      warnings: ["Not enough history for reliable walk-forward validation."]
    };
  }

  const windowSize = Math.floor(points.length / 4);
  const returns: number[] = [];
  const drawdowns: number[] = [];
  for (let start = 0; start + windowSize * 2 <= points.length; start += Math.max(60, Math.floor(windowSize / 2))) {
    const test = points.slice(start + windowSize, start + windowSize * 2);
    const stats = runTrendBacktest(test, assetType, config.feeRate, config.slippageRate);
    returns.push(stats.totalReturn);
    drawdowns.push(stats.maxDrawdown);
  }

  const stableWindows = returns.filter((value, index) => value > 0 && drawdowns[index] > -0.25).length;
  const windowsTested = returns.length;
  const averageOutOfSampleReturn = returns.reduce((sum, value) => sum + value, 0) / Math.max(1, returns.length);
  const averageOutOfSampleDrawdown = drawdowns.reduce((sum, value) => sum + value, 0) / Math.max(1, drawdowns.length);
  const stabilityRatio = windowsTested === 0 ? 0 : stableWindows / windowsTested;

  return {
    windowsTested,
    stableWindows,
    averageOutOfSampleReturn,
    averageOutOfSampleDrawdown,
    stabilityLabel: stabilityRatio >= 0.7 ? "Stable" : stabilityRatio >= 0.4 ? "Mixed" : "Unstable",
    warnings: stabilityRatio < 0.4 ? ["Walk-forward performance is unstable across test windows."] : []
  };
}

function runParameterSensitivity(points: MarketDataPoint[], assetType: AssetType, config: QuantConfig): ParameterSensitivityResult {
  if (points.length < config.minDataPoints) {
    return {
      testedParameters: [],
      sensitivityLabel: "Insufficient sample",
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
  const testedParameters = parameters.map(([fastWindow, slowWindow]) => {
    const stats = runTrendBacktest(points, assetType, config.feeRate, config.slippageRate, fastWindow, slowWindow);
    return {
      fastWindow,
      slowWindow,
      totalReturn: stats.totalReturn,
      maxDrawdown: stats.maxDrawdown,
      sharpeRatio: stats.sharpeRatio
    };
  });
  const positiveCount = testedParameters.filter((result) => result.totalReturn > 0).length;
  const returns = testedParameters.map((result) => result.totalReturn);
  const returnRange = Math.max(...returns) - Math.min(...returns);
  const sensitivityLabel =
    positiveCount >= 4 && returnRange < 0.35
      ? "Robust"
      : positiveCount >= 3 && returnRange < 0.6
        ? "Moderately sensitive"
        : "Highly sensitive / overfit risk";

  return {
    testedParameters,
    sensitivityLabel,
    warnings: sensitivityLabel === "Highly sensitive / overfit risk" ? ["Parameter sensitivity is high; avoid cherry-picking the best setting."] : []
  };
}

export function validateTrendBacktest(points: MarketDataPoint[], assetType: AssetType, config: QuantConfig): BacktestValidationResult {
  const warnings: string[] = [];
  const { inSample: inSamplePoints, outOfSample: outOfSamplePoints } = splitHistory(points);
  const inSample = inSamplePoints.length > 1 ? runTrendBacktest(inSamplePoints, assetType, config.feeRate, config.slippageRate) : emptyBacktest(assetType);
  const outOfSample =
    outOfSamplePoints.length > 1 ? runTrendBacktest(outOfSamplePoints, assetType, config.feeRate, config.slippageRate) : emptyBacktest(assetType);
  const walkForward = runWalkForward(points, assetType, config);
  const parameterSensitivity = runParameterSensitivity(points, assetType, config);

  warnings.push(...walkForward.warnings, ...parameterSensitivity.warnings);
  if (outOfSamplePoints.length < config.minTradeCount) warnings.push("Out-of-sample period is short; validation confidence is limited.");

  const outOfSampleScore = scoreBacktest(outOfSample);
  const walkForwardScore =
    walkForward.stabilityLabel === "Stable" ? 85 : walkForward.stabilityLabel === "Mixed" ? 60 : walkForward.stabilityLabel === "Unstable" ? 30 : 40;
  const sensitivityScore =
    parameterSensitivity.sensitivityLabel === "Robust"
      ? 85
      : parameterSensitivity.sensitivityLabel === "Moderately sensitive"
        ? 60
        : parameterSensitivity.sensitivityLabel === "Highly sensitive / overfit risk"
          ? 25
          : 40;
  const validationScore = boundedScore(
    outOfSampleScore * config.validationWeights.outOfSample +
      walkForwardScore * config.validationWeights.walkForward +
      sensitivityScore * config.validationWeights.parameterSensitivity
  );
  const robustnessLabel =
    walkForward.stabilityLabel === "Insufficient sample" || parameterSensitivity.sensitivityLabel === "Insufficient sample"
      ? "Insufficient sample"
      : validationScore >= 75
        ? "Robust"
        : validationScore >= 55
          ? "Moderate"
          : "Overfit risk";

  return {
    inSample,
    outOfSample,
    walkForward,
    parameterSensitivity,
    robustnessLabel,
    validationScore,
    warnings
  };
}
