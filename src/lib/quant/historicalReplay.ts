import type { AssetType, MarketDataPoint } from "@/types/asset";
import type { DecisionLabel, QuantAnalysis, ValidationEvidenceState } from "@/types/quant";
import { DEFAULT_QUANT_CONFIG } from "./config";
import { calculateDrawdowns } from "./drawdown";
import { analyzeMarketData } from "./scoring";
import { guardedCalmarRatio, guardedSharpeRatio, guardedSortinoRatio } from "./ratios";
import { annualizedReturn, calculateSimpleReturns } from "./returns";
import { annualizedVolatility } from "./volatility";
import { periodsPerYear } from "./riskRegime";

export type ReplayEvStatus = "EV passed" | "EV limited" | "EV failed";

export interface ReplayResultRow {
  date: string;
  symbol: string;
  assetType: AssetType;
  finalDecision: string;
  activeAllocation: number;
  signalScore: number;
  riskScore: number;
  validationScore: number;
  validationEvidenceState: ValidationEvidenceState;
  evStatus: ReplayEvStatus;
  evAfterCosts: number;
  kellyAllocation: number;
  dataQualityStatus: "passed" | "failed";
  regimeLabel: string;
  blockingReasons: string[];
  warnings: string[];
}

export interface ReplayInput {
  symbol: string;
  assetType: AssetType;
  candles: MarketDataPoint[];
  startDate?: string;
  endDate?: string;
  riskProfile?: "conservative" | "balanced" | "aggressive";
  rebalanceEveryDays?: number;
  analyzer?: (availableCandles: MarketDataPoint[]) => QuantAnalysis;
}

export interface PaperReplayTrade {
  date: string;
  executionDate: string;
  symbol: string;
  side: "BUY" | "SELL";
  decision: string;
  requestedAllocation: number;
  executionPrice: number;
  quantity: number;
  grossNotional: number;
  feesPaid: number;
  slippagePaid: number;
  realizedPnl: number;
  returnPct: number;
}

export interface MonthlyReturn {
  month: string;
  returnPct: number;
}

export interface PaperReplayResult {
  symbol: string;
  assetType: AssetType;
  startingCapital: number;
  endingEquity: number;
  totalReturn: number;
  annualizedReturn: number;
  annualizedVolatility: number;
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  totalTrades: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  expectancyAfterCosts: number;
  longestLosingStreak: number;
  exposurePercentage: number;
  averageAllocation: number;
  worstMonth: MonthlyReturn | null;
  bestMonth: MonthlyReturn | null;
  equityCurve: Array<{ date: string; equity: number }>;
  drawdownCurve: Array<{ date: string; drawdown: number }>;
  trades: PaperReplayTrade[];
  decisionLog: ReplayResultRow[];
  monthlyReturns: MonthlyReturn[];
}

export interface BenchmarkResult {
  symbol: string;
  assetType: AssetType;
  totalReturn: number;
  endingEquity: number;
  equityCurve: Array<{ date: string; equity: number }>;
}

export interface BenchmarkComparison {
  buyAndHold: BenchmarkResult[];
  equalWeightPortfolio: BenchmarkResult | null;
}

export interface MonteCarloResult {
  simulations: number;
  medianEndingEquity: number;
  percentile5EndingEquity: number;
  percentile95EndingEquity: number;
  medianMaxDrawdown: number;
  percentile95MaxDrawdown: number;
  worstSimulatedDrawdown: number;
  longestLosingStreakDistribution: {
    median: number;
    percentile95: number;
    max: number;
  };
  probabilityDrawdown10: number;
  probabilityDrawdown20: number;
  probabilityDrawdown30: number;
}

const ACTIVE_LABELS = new Set<DecisionLabel>(["Strong candidate", "Position allowed", "Small allocation only"]);

function evStatus(analysis: QuantAnalysis): ReplayEvStatus {
  const ev = analysis.pipeline.expectedValue;
  if (ev.expectedValueAfterCosts <= 0) return "EV failed";
  return ev.passed ? "EV passed" : "EV limited";
}

function clampActiveAllocation(decision: string, allocation: number): number {
  return ACTIVE_LABELS.has(decision as DecisionLabel) ? Math.max(0, allocation) : 0;
}

export function runHistoricalDecisionReplay(input: ReplayInput): ReplayResultRow[] {
  const sorted = [...input.candles].sort((a, b) => a.timestamp - b.timestamp);
  const start = input.startDate ?? sorted[0]?.date;
  const end = input.endDate ?? sorted.at(-1)?.date;
  const step = Math.max(1, input.rebalanceEveryDays ?? 21);
  const rows: ReplayResultRow[] = [];
  const analyzer =
    input.analyzer ??
    ((availableCandles: MarketDataPoint[]) =>
      analyzeMarketData(availableCandles, input.assetType, input.symbol, input.riskProfile ?? "balanced"));

  for (let index = 0; index < sorted.length; index += step) {
    const candle = sorted[index];
    if (!candle || (start && candle.date < start) || (end && candle.date > end)) continue;
    const available = sorted.slice(0, index + 1);
    const analysis = analyzer(available);
    const decision = analysis.pipeline.finalDecision;
    const expectedValue = analysis.pipeline.expectedValue;

    rows.push({
      date: candle.date,
      symbol: input.symbol,
      assetType: input.assetType,
      finalDecision: decision.decisionLabel,
      activeAllocation: clampActiveAllocation(decision.decisionLabel, decision.finalPositionSize),
      signalScore: decision.signalScore,
      riskScore: decision.riskScore,
      validationScore: decision.validationScore,
      validationEvidenceState: analysis.pipeline.validation.validationEvidenceState,
      evStatus: evStatus(analysis),
      evAfterCosts: expectedValue.expectedValueAfterCosts,
      kellyAllocation: analysis.pipeline.positionSizing.fractionalKellyAllocation,
      dataQualityStatus: analysis.pipeline.dataQuality.passed ? "passed" : "failed",
      regimeLabel: analysis.pipeline.signal.regimeLabel,
      blockingReasons: decision.blockingReasons,
      warnings: Array.from(new Set([...decision.warnings, ...expectedValue.warnings]))
    });
  }

  return rows;
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[index];
}

function monthlyReturns(equityCurve: Array<{ date: string; equity: number }>): MonthlyReturn[] {
  const byMonth = new Map<string, { first: number; last: number }>();
  for (const point of equityCurve) {
    const month = point.date.slice(0, 7);
    const existing = byMonth.get(month);
    if (!existing) byMonth.set(month, { first: point.equity, last: point.equity });
    else existing.last = point.equity;
  }
  return Array.from(byMonth.entries()).map(([month, values]) => ({
    month,
    returnPct: values.first === 0 ? 0 : values.last / values.first - 1
  }));
}

export function simulatePaperPortfolio(input: {
  symbol: string;
  assetType: AssetType;
  candles: MarketDataPoint[];
  replayRows: ReplayResultRow[];
  startingCapital?: number;
  feeRate?: number;
  slippageRate?: number;
}): PaperReplayResult {
  const candles = [...input.candles].sort((a, b) => a.timestamp - b.timestamp);
  const startingCapital = input.startingCapital ?? 100000;
  const feeRate = input.feeRate ?? DEFAULT_QUANT_CONFIG.feeRate;
  const slippageRate = input.slippageRate ?? DEFAULT_QUANT_CONFIG.slippageRate;
  const decisionsByDate = new Map(input.replayRows.map((row) => [row.date, row]));
  const trades: PaperReplayTrade[] = [];
  const equityCurve: Array<{ date: string; equity: number }> = [];
  const allocationSeries: number[] = [];
  let cash = startingCapital;
  let quantity = 0;
  let costBasis = 0;
  let losingStreak = 0;
  let longestLosingStreak = 0;
  let pendingDecision: ReplayResultRow | null = null;

  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index];

    if (pendingDecision) {
      const targetAllocation = clampActiveAllocation(pendingDecision.finalDecision, pendingDecision.activeAllocation);
      const markEquity = cash + quantity * candle.open;
      const currentValue = quantity * candle.open;
      const targetValue = markEquity * targetAllocation;
      const delta = targetValue - currentValue;

      if (Math.abs(delta) > 1) {
        const side: "BUY" | "SELL" = delta > 0 ? "BUY" : "SELL";
        const executionPrice = side === "BUY" ? candle.open * (1 + slippageRate) : candle.open * (1 - slippageRate);
        let tradedQuantity = 0;
        let grossNotional = 0;
        let fee = 0;
        let realizedPnl = 0;
        let returnPct = 0;

        if (side === "BUY") {
          grossNotional = Math.min(delta, cash / (1 + feeRate));
          fee = grossNotional * feeRate;
          tradedQuantity = executionPrice === 0 ? 0 : grossNotional / executionPrice;
          cash -= grossNotional + fee;
          quantity += tradedQuantity;
          costBasis += grossNotional + fee;
        } else {
          grossNotional = Math.min(-delta, quantity * executionPrice);
          tradedQuantity = executionPrice === 0 ? 0 : grossNotional / executionPrice;
          fee = grossNotional * feeRate;
          const averageCost = quantity === 0 ? 0 : costBasis / quantity;
          const removedCost = averageCost * tradedQuantity;
          realizedPnl = grossNotional - fee - removedCost;
          returnPct = removedCost === 0 ? 0 : realizedPnl / removedCost;
          cash += grossNotional - fee;
          quantity = Math.max(0, quantity - tradedQuantity);
          costBasis = Math.max(0, costBasis - removedCost);
          losingStreak = realizedPnl < 0 ? losingStreak + 1 : 0;
          longestLosingStreak = Math.max(longestLosingStreak, losingStreak);
        }

        trades.push({
          date: pendingDecision.date,
          executionDate: candle.date,
          symbol: input.symbol,
          side,
          decision: pendingDecision.finalDecision,
          requestedAllocation: targetAllocation,
          executionPrice,
          quantity: tradedQuantity,
          grossNotional,
          feesPaid: fee,
          slippagePaid: Math.abs(candle.open - executionPrice) * tradedQuantity,
          realizedPnl,
          returnPct
        });
      }

      pendingDecision = null;
    }

    const equity = cash + quantity * candle.close;
    equityCurve.push({ date: candle.date, equity });
    allocationSeries.push(equity === 0 ? 0 : (quantity * candle.close) / equity);
    pendingDecision = decisionsByDate.get(candle.date) ?? null;
  }

  const equityValues = equityCurve.map((point) => point.equity);
  const returns = calculateSimpleReturns(equityValues);
  const periods = periodsPerYear(input.assetType);
  const annReturn = annualizedReturn(returns, periods);
  const annVol = annualizedVolatility(returns, periods);
  const drawdown = calculateDrawdowns(equityCurve.map((point) => ({ date: point.date, value: point.equity })));
  const sharpe = guardedSharpeRatio(annReturn, annVol);
  const sortino = guardedSortinoRatio(returns, annReturn, 0, periods);
  const calmar = guardedCalmarRatio(annReturn, drawdown.maxDrawdown);
  const closedReturns = trades.filter((trade) => trade.side === "SELL").map((trade) => trade.returnPct);
  const wins = closedReturns.filter((value) => value > 0);
  const losses = closedReturns.filter((value) => value < 0);
  const grossProfit = trades.filter((trade) => trade.realizedPnl > 0).reduce((sum, trade) => sum + trade.realizedPnl, 0);
  const grossLoss = Math.abs(trades.filter((trade) => trade.realizedPnl < 0).reduce((sum, trade) => sum + trade.realizedPnl, 0));
  const months = monthlyReturns(equityCurve);

  return {
    symbol: input.symbol,
    assetType: input.assetType,
    startingCapital,
    endingEquity: equityValues.at(-1) ?? startingCapital,
    totalReturn: (equityValues.at(-1) ?? startingCapital) / startingCapital - 1,
    annualizedReturn: annReturn,
    annualizedVolatility: annVol,
    maxDrawdown: drawdown.maxDrawdown,
    sharpeRatio: sharpe.value,
    sortinoRatio: sortino.value,
    calmarRatio: calmar.value,
    totalTrades: trades.length,
    winRate: closedReturns.length === 0 ? 0 : wins.length / closedReturns.length,
    averageWin: average(wins),
    averageLoss: average(losses),
    profitFactor: grossLoss === 0 ? (grossProfit > 0 ? Number.POSITIVE_INFINITY : 0) : grossProfit / grossLoss,
    expectancyAfterCosts: average(closedReturns),
    longestLosingStreak,
    exposurePercentage: allocationSeries.filter((value) => value > 0.001).length / Math.max(1, allocationSeries.length),
    averageAllocation: average(allocationSeries),
    worstMonth: months.length === 0 ? null : months.reduce((worst, item) => (item.returnPct < worst.returnPct ? item : worst), months[0]),
    bestMonth: months.length === 0 ? null : months.reduce((best, item) => (item.returnPct > best.returnPct ? item : best), months[0]),
    equityCurve,
    drawdownCurve: drawdown.series,
    trades,
    decisionLog: input.replayRows,
    monthlyReturns: months
  };
}

export function calculateBenchmarks(
  assets: Array<{ symbol: string; assetType: AssetType; candles: MarketDataPoint[] }>,
  startingCapital = 100000
): BenchmarkComparison {
  const buyAndHold = assets.map((asset): BenchmarkResult => {
    const first = asset.candles[0]?.open ?? asset.candles[0]?.close ?? 0;
    const equityCurve = asset.candles.map((candle) => ({
      date: candle.date,
      equity: first === 0 ? startingCapital : startingCapital * (candle.close / first)
    }));
    const endingEquity = equityCurve.at(-1)?.equity ?? startingCapital;
    return {
      symbol: asset.symbol,
      assetType: asset.assetType,
      totalReturn: endingEquity / startingCapital - 1,
      endingEquity,
      equityCurve
    };
  });

  if (assets.length === 0) return { buyAndHold, equalWeightPortfolio: null };

  const minLength = Math.min(...assets.map((asset) => asset.candles.length));
  const perAssetCapital = startingCapital / assets.length;
  const equalWeightCurve = Array.from({ length: minLength }, (_, index) => {
    const equity = assets.reduce((sum, asset) => {
      const first = asset.candles[0]?.open ?? asset.candles[0]?.close ?? 0;
      return sum + (first === 0 ? perAssetCapital : perAssetCapital * (asset.candles[index].close / first));
    }, 0);
    return { date: assets[0].candles[index].date, equity };
  });
  const equalEnding = equalWeightCurve.at(-1)?.equity ?? startingCapital;

  return {
    buyAndHold,
    equalWeightPortfolio: {
      symbol: "Equal weight",
      assetType: assets[0].assetType,
      totalReturn: equalEnding / startingCapital - 1,
      endingEquity: equalEnding,
      equityCurve: equalWeightCurve
    }
  };
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function runMonteCarloStressTest(
  tradeReturns: number[],
  options: { startingCapital?: number; simulations?: number; seed?: number } = {}
): MonteCarloResult {
  const startingCapital = options.startingCapital ?? 100000;
  const simulations = Math.max(1, options.simulations ?? 1000);
  const random = seededRandom(options.seed ?? 12345);
  const sourceReturns = tradeReturns.length === 0 ? [0] : tradeReturns;
  const endingEquities: number[] = [];
  const maxDrawdowns: number[] = [];
  const longestStreaks: number[] = [];

  for (let sim = 0; sim < simulations; sim += 1) {
    let equity = startingCapital;
    let peak = startingCapital;
    let maxDrawdown = 0;
    let streak = 0;
    let longestStreak = 0;
    for (let index = 0; index < sourceReturns.length; index += 1) {
      const sampledReturn = sourceReturns[Math.floor(random() * sourceReturns.length)];
      equity *= 1 + sampledReturn;
      peak = Math.max(peak, equity);
      maxDrawdown = Math.min(maxDrawdown, peak === 0 ? 0 : equity / peak - 1);
      streak = sampledReturn < 0 ? streak + 1 : 0;
      longestStreak = Math.max(longestStreak, streak);
    }
    endingEquities.push(equity);
    maxDrawdowns.push(maxDrawdown);
    longestStreaks.push(longestStreak);
  }

  return {
    simulations,
    medianEndingEquity: percentile(endingEquities, 0.5),
    percentile5EndingEquity: percentile(endingEquities, 0.05),
    percentile95EndingEquity: percentile(endingEquities, 0.95),
    medianMaxDrawdown: percentile(maxDrawdowns, 0.5),
    percentile95MaxDrawdown: percentile(maxDrawdowns.map(Math.abs), 0.95),
    worstSimulatedDrawdown: Math.min(...maxDrawdowns),
    longestLosingStreakDistribution: {
      median: percentile(longestStreaks, 0.5),
      percentile95: percentile(longestStreaks, 0.95),
      max: Math.max(...longestStreaks)
    },
    probabilityDrawdown10: maxDrawdowns.filter((value) => value <= -0.1).length / simulations,
    probabilityDrawdown20: maxDrawdowns.filter((value) => value <= -0.2).length / simulations,
    probabilityDrawdown30: maxDrawdowns.filter((value) => value <= -0.3).length / simulations
  };
}
