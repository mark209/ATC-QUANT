import type { AssetType, MarketDataPoint } from "@/types/asset";
import type { BacktestSummary, BacktestTrade, DrawdownPoint } from "@/types/quant";
import { calculateDrawdowns } from "./drawdown";
import { calculateSimpleReturns, annualizedReturn, calculateLogReturns } from "./returns";
import { guardedCalmarRatio, guardedSharpeRatio, guardedSortinoRatio } from "./ratios";
import { annualizedVolatility } from "./volatility";
import { periodsPerYear } from "./riskRegime";

const STARTING_EQUITY = 100000;

export interface TrendBacktestOptions {
  allocation?: number;
  assumptionLabel?: string;
  cache?: TrendBacktestCache;
}

interface OpenTrade {
  entryDate: string;
  entryIndex: number;
  entryPrice: number;
  entryRawPrice: number;
  startingEquity: number;
  allocationUsed: number;
  capitalDeployed: number;
  cashReserve: number;
  positionSize: number;
  quantity: number;
  entryFee: number;
  entrySlippage: number;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isTrendBacktestCache(value: TrendBacktestOptions | TrendBacktestCache): value is TrendBacktestCache {
  return "movingSums" in value;
}

function movingAverage(closes: number[], endIndex: number, window: number, cache?: TrendBacktestCache): number {
  const cachedSum = cache?.movingSums.get(window)?.[endIndex];
  if (cachedSum !== undefined) return cachedSum / window;
  return average(closes.slice(endIndex + 1 - window, endIndex + 1));
}

function trendSignal(closes: number[], endIndex: number, fastWindow: number, slowWindow: number, cache?: TrendBacktestCache): boolean {
  const length = endIndex + 1;
  if (length < slowWindow) return false;
  const current = closes[endIndex];
  const fastMa = movingAverage(closes, endIndex, fastWindow, cache);
  const slowMa = movingAverage(closes, endIndex, slowWindow, cache);
  return current >= fastMa && fastMa >= slowMa;
}

function emptyBacktest(): BacktestSummary {
  return {
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
  };
}

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
  optionsOrCache: TrendBacktestOptions | TrendBacktestCache = {}
): BacktestSummary {
  const options = isTrendBacktestCache(optionsOrCache) ? { cache: optionsOrCache } : optionsOrCache;
  const cache = options.cache;
  const allocation = Math.max(0, Math.min(1, options.allocation ?? 1));
  const assumptionLabel = options.assumptionLabel ?? (allocation === 1 ? "100% signal backtest" : "Allocation-adjusted backtest");
  if (points.length === 0) return { ...emptyBacktest(), assumptionLabel, allocation };

  const closes = points.map((point) => point.close);
  const periods = periodsPerYear(assetType);
  const trades: BacktestTrade[] = [];
  const equityCurve: Array<{ date: string; equity: number }> = [];
  let cash = STARTING_EQUITY;
  const state: { openTrade: OpenTrade | null } = { openTrade: null };
  let pendingSignal = false;
  let feesPaid = 0;
  let slippageCostEstimate = 0;
  let exposureDays = 0;
  let entries = 0;

  function enter(point: MarketDataPoint, index: number): void {
    if (allocation <= 0) return;
    const rawEntryPrice = point.open;
    const entryPrice = rawEntryPrice * (1 + slippage);
    const startingEquity = cash;
    const allocatedCapital = startingEquity * allocation;
    const cashReserve = Math.max(0, startingEquity - allocatedCapital);
    const entryFee = allocatedCapital * fees;
    const investableCash = Math.max(0, allocatedCapital - entryFee);
    const quantity = entryPrice <= 0 ? 0 : investableCash / entryPrice;
    const positionSize = quantity * entryPrice;
    const entrySlippage = quantity * Math.max(0, entryPrice - rawEntryPrice);

    feesPaid += entryFee;
    slippageCostEstimate += entrySlippage;
    entries += 1;
    state.openTrade = {
      entryDate: point.date,
      entryIndex: index,
      entryPrice,
      entryRawPrice: rawEntryPrice,
      startingEquity,
      allocationUsed: allocation,
      capitalDeployed: allocatedCapital,
      cashReserve,
      positionSize,
      quantity,
      entryFee,
      entrySlippage
    };
    cash = Math.max(0, cash - allocatedCapital);
  }

  function exit(point: MarketDataPoint, index: number, rawExitPrice: number, exitReason: string): void {
    const openTrade = state.openTrade;
    if (!openTrade) return;
    const exitPrice = rawExitPrice * (1 - slippage);
    const exitNotional = openTrade.quantity * exitPrice;
    const grossPnl = exitNotional - openTrade.positionSize;
    const exitFee = exitNotional * fees;
    const exitSlippage = openTrade.quantity * Math.max(0, rawExitPrice - exitPrice);
    const netPnl = grossPnl - openTrade.entryFee - exitFee;
    const grossReturnPct = openTrade.startingEquity === 0 ? 0 : grossPnl / openTrade.startingEquity;
    const netReturnPct = openTrade.startingEquity === 0 ? 0 : netPnl / openTrade.startingEquity;
    const feesForTrade = openTrade.entryFee + exitFee;
    const slippageForTrade = openTrade.entrySlippage + exitSlippage;

    feesPaid += exitFee;
    slippageCostEstimate += exitSlippage;
    trades.push({
      entryDate: openTrade.entryDate,
      entryPrice: openTrade.entryPrice,
      exitDate: point.date,
      exitPrice,
      positionSize: openTrade.positionSize,
      quantity: openTrade.quantity,
      allocationUsed: openTrade.allocationUsed,
      capitalDeployed: openTrade.capitalDeployed,
      cashReserve: openTrade.cashReserve,
      positionValue: openTrade.positionSize,
      grossReturnPct,
      netReturnPct,
      feesPaid: feesForTrade,
      slippagePaid: slippageForTrade,
      fees: feesForTrade,
      slippage: slippageForTrade,
      grossPnl,
      netPnl,
      returnPct: netReturnPct,
      holdingPeriod: index - openTrade.entryIndex,
      exitReason
    });
    cash = Math.max(0, cash + exitNotional - exitFee);
    state.openTrade = null;
  }

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];

    if (index > 0 && pendingSignal !== Boolean(state.openTrade)) {
      if (pendingSignal) {
        enter(point, index);
      } else if (state.openTrade) {
        exit(point, index, point.open, "Trend exit");
      }
    }

    const activeTrade = state.openTrade;
    if (activeTrade) {
      exposureDays += 1;
      equityCurve.push({ date: point.date, equity: cash + activeTrade.quantity * point.close });
    } else {
      equityCurve.push({ date: point.date, equity: cash });
    }

    if (index < points.length - 1) {
      pendingSignal = trendSignal(closes, index, fastWindow, slowWindow, cache);
    }
  }

  if (state.openTrade) {
    const lastIndex = points.length - 1;
    const lastPoint = points[lastIndex];
    exit(lastPoint, lastIndex, lastPoint.close, "End of data");
    equityCurve[lastIndex] = { date: lastPoint.date, equity: cash };
  }

  const equityValues = equityCurve.map((point) => point.equity);
  const strategyReturns = calculateSimpleReturns(equityValues);
  const strategyLogReturns = calculateLogReturns(equityValues);
  const drawdown = calculateDrawdowns(equityCurve.map((point) => ({ date: point.date, value: point.equity })));
  const cagr = annualizedReturn(strategyReturns, periods);
  const vol = annualizedVolatility(strategyLogReturns, periods);
  const tradeReturns = trades.map((trade) => trade.returnPct);
  const winningTrades = trades.filter((trade) => trade.netPnl > 0);
  const losingTrades = trades.filter((trade) => trade.netPnl < 0);
  const grossWins = winningTrades.reduce((sum, trade) => sum + trade.netPnl, 0);
  const grossLosses = Math.abs(losingTrades.reduce((sum, trade) => sum + trade.netPnl, 0));
  let currentLosingStreak = 0;
  let longestLosingStreak = 0;

  for (const trade of trades) {
    if (trade.netPnl < 0) {
      currentLosingStreak += 1;
      longestLosingStreak = Math.max(longestLosingStreak, currentLosingStreak);
    } else {
      currentLosingStreak = 0;
    }
  }

  const finalEquity = equityValues.at(-1) ?? STARTING_EQUITY;
  const exposureTime = exposureDays / Math.max(1, points.length);
  const averageWin = winningTrades.length === 0 ? 0 : average(winningTrades.map((trade) => trade.returnPct));
  const averageLoss = losingTrades.length === 0 ? 0 : average(losingTrades.map((trade) => trade.returnPct));
  const expectancy = tradeReturns.length === 0 ? 0 : average(tradeReturns);
  const drawdownCurve: DrawdownPoint[] = drawdown.series;
  const sharpe = guardedSharpeRatio(cagr, vol);
  const sortino = guardedSortinoRatio(strategyReturns, cagr, 0, periods);
  const calmar = guardedCalmarRatio(cagr, drawdown.maxDrawdown);
  const ratioWarnings = [sharpe.warning, sortino.warning, calmar.warning].filter((warning): warning is string => Boolean(warning));

  return {
    assumptionLabel,
    allocation,
    totalReturn: finalEquity / STARTING_EQUITY - 1,
    annualizedReturn: cagr,
    cagr,
    annualizedVolatility: vol,
    sharpeRatio: sharpe.value,
    sortinoRatio: sortino.value,
    calmarRatio: calmar.value,
    maxDrawdown: drawdown.maxDrawdown,
    averageDrawdown: drawdown.averageDrawdown,
    recoveryTime: drawdown.recoveryTime,
    winRate: trades.length === 0 ? 0 : winningTrades.length / trades.length,
    averageWin,
    averageLoss,
    payoffRatio: averageLoss === 0 ? 0 : averageWin / Math.abs(averageLoss),
    profitFactor: grossLosses === 0 ? 0 : grossWins / grossLosses,
    expectedValue: expectancy,
    expectancy,
    numberOfTrades: trades.length,
    totalTrades: trades.length,
    averageHoldingPeriod: trades.length === 0 ? 0 : average(trades.map((trade) => trade.holdingPeriod)),
    worstLosingStreak: longestLosingStreak,
    longestLosingStreak,
    largestSingleLoss: Math.min(0, ...tradeReturns),
    bestTrade: tradeReturns.length === 0 ? 0 : Math.max(...tradeReturns),
    worstTrade: tradeReturns.length === 0 ? 0 : Math.min(...tradeReturns),
    fees,
    slippage,
    feesPaid,
    slippageCostEstimate,
    turnover: entries / Math.max(1, points.length),
    exposureTime,
    exposureAdjustedReturn: exposureTime === 0 ? 0 : cagr / exposureTime,
    ratioWarnings,
    trades,
    equityCurve,
    drawdownCurve
  };
}
