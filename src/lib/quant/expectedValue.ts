import type { ExpectedValueStats, SampleQuality } from "@/types/quant";

function sampleQuality(tradeCount: number): SampleQuality {
  if (tradeCount < 30) return "Poor";
  if (tradeCount < 100) return "Limited";
  if (tradeCount < 200) return "Acceptable";
  return "Strong";
}

function confidenceMultiplier(quality: SampleQuality): number {
  if (quality === "Poor") return 0.25;
  if (quality === "Limited") return 0.6;
  if (quality === "Acceptable") return 0.85;
  return 1;
}

export function calculateExpectedValue(simpleReturns: number[], fees = 0.001, slippage = 0.001, spread = 0): ExpectedValueStats {
  const wins = simpleReturns.filter((value) => value > 0);
  const losses = simpleReturns.filter((value) => value < 0);
  const winRate = simpleReturns.length === 0 ? 0 : wins.length / simpleReturns.length;
  const lossRate = simpleReturns.length === 0 ? 0 : losses.length / simpleReturns.length;
  const averageWin = wins.length === 0 ? 0 : wins.reduce((sum, value) => sum + value, 0) / wins.length;
  const averageLoss = losses.length === 0 ? 0 : losses.reduce((sum, value) => sum + value, 0) / losses.length;
  const grossProfit = wins.reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(losses.reduce((sum, value) => sum + value, 0));
  const tradeCount = simpleReturns.length;
  const quality = sampleQuality(tradeCount);
  const averageTradeCost = fees + slippage + spread;
  const grossExpectedValue = winRate * averageWin - lossRate * Math.abs(averageLoss);
  const expectedValueAfterCosts = (grossExpectedValue - averageTradeCost) * confidenceMultiplier(quality);
  const warnings: string[] = [];

  if (quality === "Poor") warnings.push("Poor sample size; expected value is unreliable.");
  if (quality === "Limited") warnings.push("Limited sample size; expected value should be treated cautiously.");
  if (expectedValueAfterCosts <= 0) warnings.push("Expected value is not positive after fees and slippage.");

  return {
    expectedValue: grossExpectedValue,
    expectedValueAfterCosts,
    winRate,
    lossRate,
    averageWin,
    averageLoss,
    payoffRatio: averageLoss === 0 ? 0 : averageWin / Math.abs(averageLoss),
    profitFactor: grossLoss === 0 ? 0 : grossProfit / grossLoss,
    tradeCount,
    sampleQuality: quality,
    passed: expectedValueAfterCosts > 0 && quality !== "Poor",
    warnings,
    costs: {
      fees,
      slippage,
      spread,
      averageTradeCost
    }
  };
}
