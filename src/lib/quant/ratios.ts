import { mean, standardDeviation, percentile } from "./volatility";

const NEAR_ZERO = 1e-6;
const MAX_ABS_SHARPE = 10;
const MAX_ABS_SORTINO = 10;
const MAX_ABS_CALMAR = 20;

export interface GuardedRatio {
  value: number;
  reliable: boolean;
  warning?: string;
}

function capRatio(value: number, maxAbsValue: number, name: string): GuardedRatio {
  if (!Number.isFinite(value)) {
    return { value: 0, reliable: false, warning: `${name} ratio is unreliable because the calculation produced a non-finite value.` };
  }
  if (Math.abs(value) > maxAbsValue) {
    return {
      value: Math.sign(value) * maxAbsValue,
      reliable: false,
      warning: `${name} ratio exceeded the reliability guardrail and was capped for display and scoring.`
    };
  }
  return { value, reliable: true };
}

export function sharpeRatio(annualizedReturn: number, annualizedVolatility: number, riskFreeRate = 0.04): number {
  if (annualizedVolatility === 0) return 0;
  return (annualizedReturn - riskFreeRate) / annualizedVolatility;
}

export function guardedSharpeRatio(annualizedReturn: number, annualizedVolatility: number, riskFreeRate = 0.04): GuardedRatio {
  if (annualizedVolatility < NEAR_ZERO) {
    return { value: 0, reliable: false, warning: "Sharpe ratio is unreliable because annualized volatility is near zero." };
  }
  return capRatio(sharpeRatio(annualizedReturn, annualizedVolatility, riskFreeRate), MAX_ABS_SHARPE, "Sharpe");
}

export function sortinoRatio(simpleReturns: number[], annualReturn: number, minimumAcceptableReturn = 0, periodsPerYear = 252): number {
  const downside = simpleReturns.filter((value) => value < minimumAcceptableReturn);
  const downsideDeviation = standardDeviation(downside);
  if (downsideDeviation === 0) return 0;
  return annualReturn / (downsideDeviation * Math.sqrt(periodsPerYear));
}

export function guardedSortinoRatio(simpleReturns: number[], annualReturn: number, minimumAcceptableReturn = 0, periodsPerYear = 252): GuardedRatio {
  const downside = simpleReturns.filter((value) => value < minimumAcceptableReturn);
  const downsideDeviation = standardDeviation(downside);
  if (downside.length < 2 || downsideDeviation < NEAR_ZERO) {
    return { value: 0, reliable: false, warning: "Sortino ratio is unreliable because downside deviation is near zero." };
  }
  return capRatio(sortinoRatio(simpleReturns, annualReturn, minimumAcceptableReturn, periodsPerYear), MAX_ABS_SORTINO, "Sortino");
}

export function calmarRatio(cagr: number, maxDrawdown: number): number {
  if (maxDrawdown === 0) return 0;
  return cagr / Math.abs(maxDrawdown);
}

export function guardedCalmarRatio(cagr: number, maxDrawdown: number): GuardedRatio {
  if (Math.abs(maxDrawdown) < NEAR_ZERO) {
    return { value: 0, reliable: false, warning: "Calmar ratio is unreliable because max drawdown is near zero." };
  }
  return capRatio(calmarRatio(cagr, maxDrawdown), MAX_ABS_CALMAR, "Calmar");
}

export function valueAtRisk(simpleReturns: number[], confidence = 95): number {
  return percentile(simpleReturns, 100 - confidence);
}

export function conditionalValueAtRisk(simpleReturns: number[], confidence = 95): number {
  const varLevel = valueAtRisk(simpleReturns, confidence);
  const tailReturns = simpleReturns.filter((value) => value <= varLevel);
  return tailReturns.length === 0 ? varLevel : mean(tailReturns);
}
