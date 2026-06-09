import type { BacktestTrade, ExpectedValueResult, SampleQuality } from "@/types/quant";

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

export function calculateExpectedValue(simpleReturns: number[], fees = 0.001, slippage = 0.001, spread = 0): ExpectedValueResult {
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
  const averageTradeCost = fees * 2 + slippage * 2 + spread;
  const grossExpectedValue = winRate * averageWin - lossRate * Math.abs(averageLoss);
  const expectedValueAfterCosts = (grossExpectedValue - averageTradeCost) * confidenceMultiplier(quality);
  const warnings: string[] = ["Expected value is a historical estimate, not a certainty."];

  if (quality === "Poor") warnings.push("Poor sample size; expected value is unreliable.");
  if (quality === "Limited") warnings.push("Limited sample size; expected value should be treated cautiously.");
  if (expectedValueAfterCosts <= 0) warnings.push("Expected value is not positive after fees, slippage, and spread.");

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

export function calculateExpectedValueFromTrades(trades: BacktestTrade[]): ExpectedValueResult {
  const closedNetReturns = trades.map((trade) => trade.netReturnPct).filter((value) => Number.isFinite(value));
  const wins = closedNetReturns.filter((value) => value > 0);
  const losses = closedNetReturns.filter((value) => value < 0);
  const winningTrades = trades.filter((trade) => trade.netPnl > 0);
  const losingTrades = trades.filter((trade) => trade.netPnl < 0);
  const tradeCount = closedNetReturns.length;
  const quality = sampleQuality(tradeCount);
  const winRate = tradeCount === 0 ? 0 : wins.length / tradeCount;
  const lossRate = tradeCount === 0 ? 0 : losses.length / tradeCount;
  const averageWin = wins.length === 0 ? 0 : wins.reduce((sum, value) => sum + value, 0) / wins.length;
  const averageLoss = losses.length === 0 ? 0 : losses.reduce((sum, value) => sum + value, 0) / losses.length;
  const grossProfit = winningTrades.reduce((sum, trade) => sum + trade.netPnl, 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, trade) => sum + trade.netPnl, 0));
  const expectancyAfterCosts = tradeCount === 0 ? 0 : closedNetReturns.reduce((sum, value) => sum + value, 0) / tradeCount;
  const averageTradeCost =
    trades.length === 0
      ? 0
      : trades.reduce((sum, trade) => sum + (trade.capitalDeployed === 0 ? 0 : (trade.feesPaid + trade.slippagePaid) / trade.capitalDeployed), 0) /
        trades.length;
  const expectedValueAfterCosts = expectancyAfterCosts * confidenceMultiplier(quality);
  const payoffRatio = averageLoss === 0 ? 0 : averageWin / Math.abs(averageLoss);
  const profitFactor = grossLoss === 0 && grossProfit > 0 ? Number.POSITIVE_INFINITY : grossLoss === 0 ? 0 : grossProfit / grossLoss;
  const warnings: string[] = [
    "Expected value is a historical estimate, not a certainty.",
    "Expected value is calculated from closed net backtest trades."
  ];

  if (tradeCount === 0) warnings.push("No closed trades available.");
  if (quality === "Poor") warnings.push("Poor sample size; expected value is unreliable.");
  if (quality === "Limited") warnings.push("Limited sample size; expected value should be treated cautiously.");
  if (grossLoss === 0 && grossProfit > 0) warnings.push("Profit factor is undefined because there are no losing trades.");
  if (losses.length === 0 && wins.length > 0) warnings.push("Payoff ratio is unreliable because there are no losing trades.");
  if (expectedValueAfterCosts <= 0) warnings.push("Expected value is not positive after fees, slippage, and spread.");

  return {
    expectedValue: expectancyAfterCosts,
    expectedValueAfterCosts,
    winRate,
    lossRate,
    averageWin,
    averageLoss,
    payoffRatio,
    profitFactor,
    tradeCount,
    sampleQuality: quality,
    passed: expectedValueAfterCosts > 0 && quality !== "Poor",
    warnings,
    costs: {
      fees: 0,
      slippage: 0,
      spread: 0,
      averageTradeCost
    }
  };
}
