import type { AssetType, MarketDataPoint } from "@/types/asset";
import type { DrawdownStressLabel, RiskResult } from "@/types/quant";
import type { QuantConfig } from "./config";
import { averageDollarVolume, boundedScore } from "./config";

function volatilityLabel(volatility: number, assetType: AssetType): string {
  const normal = assetType === "crypto" ? 0.5 : 0.22;
  if (volatility <= normal * 0.7) return "Low";
  if (volatility <= normal) return "Acceptable";
  if (volatility <= normal * 1.5) return "Elevated";
  return "High Volatility";
}

export function drawdownStress(currentDrawdown: number, assetType: AssetType): DrawdownStressLabel {
  const dd = Math.abs(currentDrawdown);
  if (assetType === "crypto") {
    if (dd <= 0.08) return "Normal";
    if (dd <= 0.15) return "Elevated";
    if (dd <= 0.25) return "Severe";
    return "Risk-Off";
  }
  if (dd <= 0.05) return "Normal";
  if (dd <= 0.1) return "Elevated";
  if (dd <= 0.15) return "Severe";
  return "Risk-Off";
}

function liquidityLabel(score: number): string {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Acceptable";
  if (score >= 40) return "Thin";
  return "Illiquid";
}

export function calculateRiskLayer(input: {
  points: MarketDataPoint[];
  assetType: AssetType;
  realizedVolatility: number;
  ewmaVolatility: number;
  currentDrawdown: number;
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  config: QuantConfig;
}): RiskResult {
  const vol = Math.max(input.realizedVolatility, input.ewmaVolatility);
  const maxVol = input.config.maxRealizedVolatility[input.assetType];
  const volatilityScore = boundedScore(100 - (vol / Math.max(0.01, maxVol)) * 80);
  const stress = drawdownStress(input.currentDrawdown, input.assetType);
  const drawdownScore = stress === "Normal" ? 90 : stress === "Elevated" ? 65 : stress === "Severe" ? 35 : 0;
  const dollarVolume = averageDollarVolume(input.points);
  const minLiquidity = input.config.liquidityMinimums[input.assetType];
  const liquidityScore = boundedScore((dollarVolume / Math.max(1, minLiquidity)) * 55);
  const riskAdjustedScore = boundedScore(50 + input.sharpeRatio * 10 + input.sortinoRatio * 8 + input.calmarRatio * 5);
  const combinedRiskScore = boundedScore(
    volatilityScore * input.config.riskWeights.volatility +
      drawdownScore * input.config.riskWeights.drawdown +
      liquidityScore * input.config.riskWeights.liquidity +
      riskAdjustedScore * input.config.riskWeights.riskAdjusted
  );
  const warnings: string[] = [];

  if (volatilityScore < 45) warnings.push("Realized or EWMA volatility is high.");
  if (stress === "Severe") warnings.push("Drawdown stress is severe.");
  if (stress === "Risk-Off") warnings.push("Drawdown stress is Risk-Off.");
  if (liquidityScore < 50) warnings.push("Liquidity is below preferred thresholds.");

  return {
    volatilityScore,
    drawdownScore,
    liquidityScore,
    riskAdjustedScore,
    combinedRiskScore,
    volatilityLabel: volatilityLabel(vol, input.assetType),
    drawdownLabel: stress,
    liquidityLabel: liquidityLabel(liquidityScore),
    warnings
  };
}
