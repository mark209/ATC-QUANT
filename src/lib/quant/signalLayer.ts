import type { AssetType } from "@/types/asset";
import type { RegimeLabel, SignalResult } from "@/types/quant";
import type { QuantConfig } from "./config";
import { boundedScore } from "./config";
import { movingAverage, momentum } from "./momentum";

function slope(values: number[], window: number): number {
  if (values.length < window * 2) return 0;
  const recent = values.slice(-window).reduce((sum, value) => sum + value, 0) / window;
  const prior = values.slice(-window * 2, -window).reduce((sum, value) => sum + value, 0) / window;
  return prior === 0 ? 0 : recent / prior - 1;
}

export function classifyRegime(input: {
  prices: number[];
  realizedVolatility: number;
  currentDrawdown: number;
  assetType: AssetType;
  config: QuantConfig;
}): RegimeLabel {
  const current = input.prices.at(-1);
  const ma50 = movingAverage(input.prices, 50);
  const ma200 = movingAverage(input.prices, 200);
  if (!current || !ma50 || !ma200) return "No Data / Avoid";
  if (Math.abs(input.currentDrawdown) >= input.config.drawdownRiskOffThreshold) return "Risk-Off";
  if (input.realizedVolatility >= input.config.maxRealizedVolatility[input.assetType] * 0.85) return "High Volatility";
  if (current > ma50 && current > ma200 && ma50 > ma200) return "Trend Up";
  if (current < ma50 && current < ma200 && ma50 < ma200) return "Trend Down";
  return "Range / Chop";
}

export function calculateSignalLayer(input: {
  prices: number[];
  realizedVolatility: number;
  currentDrawdown: number;
  assetType: AssetType;
  config: QuantConfig;
}): SignalResult {
  const current = input.prices.at(-1) ?? 0;
  const ma50 = movingAverage(input.prices, 50);
  const ma200 = movingAverage(input.prices, 200);
  const ma50Slope = slope(input.prices, 50);
  const ma200Slope = slope(input.prices, 100);
  const trendChecks = [ma50 !== null && current > ma50, ma200 !== null && current > ma200, ma50 !== null && ma200 !== null && ma50 > ma200, ma50Slope > 0, ma200Slope > 0];
  const trendScore = boundedScore((trendChecks.filter(Boolean).length / trendChecks.length) * 100);
  const momentumWindows = [21, 63, 126, 252];
  const momentumWeights = [0.15, 0.25, 0.3, 0.3];
  const rawMomentum = momentumWindows.reduce((sum, window, index) => sum + momentum(input.prices, window) * momentumWeights[index], 0);
  const momentumScore = boundedScore(50 + rawMomentum * 220);
  const regimeLabel = classifyRegime(input);
  const regimeScore = regimeLabel === "Trend Up" ? 85 : regimeLabel === "Range / Chop" ? 50 : regimeLabel === "High Volatility" ? 35 : regimeLabel === "Trend Down" ? 25 : 0;
  const combinedSignalScore = boundedScore(
    trendScore * input.config.signalWeights.trend +
      momentumScore * input.config.signalWeights.momentum +
      regimeScore * input.config.signalWeights.regime
  );
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (trendScore >= 70) reasons.push("Trend structure is positive against key moving averages.");
  if (momentumScore >= 65) reasons.push("Multi-window momentum is supportive.");
  if (regimeLabel === "Trend Up") reasons.push("Regime is classified as Trend Up.");
  if (regimeLabel === "Range / Chop") warnings.push("Regime is mixed and may be vulnerable to whipsaw.");
  if (regimeLabel === "High Volatility") warnings.push("High volatility regime reduces signal quality.");
  if (regimeLabel === "Risk-Off") warnings.push("Risk-off regime blocks new allocation.");
  if (regimeLabel === "No Data / Avoid") warnings.push("Insufficient data to classify regime.");

  return {
    trendScore,
    momentumScore,
    regimeScore,
    combinedSignalScore,
    regimeLabel,
    reasons,
    warnings
  };
}
