import type { MarketDataPoint } from "@/types/asset";
import type { BacktestSummary } from "@/types/quant";
import { calculateDrawdowns } from "./drawdown";
import { calculateExpectedValue } from "./expectedValue";
import { calculateSimpleReturns, annualizedReturn } from "./returns";
import { calmarRatio, sharpeRatio, sortinoRatio } from "./ratios";
import { annualizedVolatility } from "./volatility";
import { calculateLogReturns } from "./returns";
import { periodsPerYear } from "./riskRegime";
import type { AssetType } from "@/types/asset";

export interface TrendBacktestCache {
  readonly movingSums: ReadonlyMap<number, readonly number[]>;
}

export function createTrendBacktestCache(points: readonly MarketDataPoint[], windows = [20, 50, 100, 150, 200]): TrendBacktestCache {
  const closes = points.map((point) => point.close);
  const movingSums = new Map<number, readonly number[]>();
  for (const window of windows) {
    const sums: number[] = new Array(closes.length);
    for (let index = 0; index < closes.length; index += 1) {
      const start = Math.max(0, index + 1 - window);
      let sum = 0;
      for (let valueIndex = start; valueIndex <= index; valueIndex += 1) sum += closes[valueIndex];
      sums[index] = sum;
    }
    movingSums.set(window, Object.freeze(sums));
  }
  return Object.freeze({ movingSums });
}

export function runTrendBacktest(
  points: MarketDataPoint[],
  assetType: AssetType,
  fees = 0.001,
  slippage = 0.001,
  fastWindow = 50,
  slowWindow = 200,
  cache?: TrendBacktestCache
): BacktestSummary {
  const closes = points.map((point) => point.close);
  const simpleReturns = calculateSimpleReturns(closes);
  const periods = periodsPerYear(assetType);
  let equity = 100000;
  let exposureDays = 0;
  let trades = 0;
  let inMarket = false;
  let losingStreak = 0;
  let worstLosingStreak = 0;
  let feesPaid = 0;
  let slippageCostEstimate = 0;
  let currentHoldingPeriod = 0;
  const holdingPeriods: number[] = [];
  const tradeReturns: number[] = [];
  let activeTradeReturn = 0;

  const equityCurve = points.slice(1).map((point, index) => {
    const lookbackLength = index + 1;
    const fastSum = cache?.movingSums.get(fastWindow)?.[index];
    const slowSum = cache?.movingSums.get(slowWindow)?.[index];
    const fastMa = lookbackLength >= fastWindow ? (fastSum ?? closes.slice(index + 1 - fastWindow, index + 1).reduce((sum, value) => sum + value, 0)) / fastWindow : closes[index];
    const slowMa = lookbackLength >= slowWindow ? (slowSum ?? closes.slice(index + 1 - slowWindow, index + 1).reduce((sum, value) => sum + value, 0)) / slowWindow : fastMa;
    const signal = closes[index] >= fastMa && fastMa >= slowMa;
    if (signal !== inMarket) {
      if (inMarket && currentHoldingPeriod > 0) {
        holdingPeriods.push(currentHoldingPeriod);
        tradeReturns.push(activeTradeReturn);
        currentHoldingPeriod = 0;
        activeTradeReturn = 0;
      }
      trades += 1;
      inMarket = signal;
      feesPaid += equity * fees;
      slippageCostEstimate += equity * slippage;
      equity *= 1 - fees - slippage;
    }
    if (signal) {
      exposureDays += 1;
      currentHoldingPeriod += 1;
      activeTradeReturn += simpleReturns[index];
      equity *= 1 + simpleReturns[index];
      if (simpleReturns[index] < 0) {
        losingStreak += 1;
        worstLosingStreak = Math.max(worstLosingStreak, losingStreak);
      } else {
        losingStreak = 0;
      }
    }
    return { date: point.date, equity };
  });

  if (inMarket && currentHoldingPeriod > 0) {
    holdingPeriods.push(currentHoldingPeriod);
    tradeReturns.push(activeTradeReturn);
  }

  const strategyReturns = calculateSimpleReturns(equityCurve.map((point) => point.equity));
  const strategyLogReturns = calculateLogReturns(equityCurve.map((point) => point.equity));
  const expectedValue = calculateExpectedValue(strategyReturns, fees, slippage);
  const drawdown = calculateDrawdowns(equityCurve.map((point) => ({ date: point.date, value: point.equity })));
  const cagr = annualizedReturn(strategyReturns, periods);
  const vol = annualizedVolatility(strategyLogReturns, periods);
  const exposureTime = exposureDays / Math.max(1, points.length);

  return {
    totalReturn: equity / 100000 - 1,
    cagr,
    annualizedVolatility: vol,
    sharpeRatio: sharpeRatio(cagr, vol),
    sortinoRatio: sortinoRatio(strategyReturns, cagr),
    calmarRatio: calmarRatio(cagr, drawdown.maxDrawdown),
    maxDrawdown: drawdown.maxDrawdown,
    averageDrawdown: drawdown.averageDrawdown,
    recoveryTime: drawdown.recoveryTime,
    winRate: expectedValue.winRate,
    averageWin: expectedValue.averageWin,
    averageLoss: expectedValue.averageLoss,
    payoffRatio: expectedValue.payoffRatio,
    profitFactor: expectedValue.profitFactor,
    expectedValue: expectedValue.expectedValueAfterCosts,
    expectancy: expectedValue.expectedValueAfterCosts,
    numberOfTrades: trades,
    totalTrades: trades,
    averageHoldingPeriod:
      holdingPeriods.length === 0 ? 0 : holdingPeriods.reduce((sum, value) => sum + value, 0) / holdingPeriods.length,
    worstLosingStreak,
    longestLosingStreak: worstLosingStreak,
    largestSingleLoss: Math.min(0, ...strategyReturns),
    bestTrade: tradeReturns.length === 0 ? 0 : Math.max(...tradeReturns),
    worstTrade: tradeReturns.length === 0 ? 0 : Math.min(...tradeReturns),
    fees,
    slippage,
    feesPaid,
    slippageCostEstimate,
    turnover: trades / Math.max(1, points.length),
    exposureTime,
    exposureAdjustedReturn: exposureTime === 0 ? 0 : cagr / exposureTime,
    equityCurve
  };
}
