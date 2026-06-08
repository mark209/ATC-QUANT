import { mean, standardDeviation, percentile } from "./volatility";

export function sharpeRatio(annualizedReturn: number, annualizedVolatility: number, riskFreeRate = 0.04): number {
  if (annualizedVolatility === 0) return 0;
  return (annualizedReturn - riskFreeRate) / annualizedVolatility;
}

export function sortinoRatio(simpleReturns: number[], annualReturn: number, minimumAcceptableReturn = 0): number {
  const downside = simpleReturns.filter((value) => value < minimumAcceptableReturn);
  const downsideDeviation = standardDeviation(downside);
  if (downsideDeviation === 0) return 0;
  return annualReturn / (downsideDeviation * Math.sqrt(252));
}

export function calmarRatio(cagr: number, maxDrawdown: number): number {
  if (maxDrawdown === 0) return 0;
  return cagr / Math.abs(maxDrawdown);
}

export function valueAtRisk(simpleReturns: number[], confidence = 95): number {
  return percentile(simpleReturns, 100 - confidence);
}

export function conditionalValueAtRisk(simpleReturns: number[], confidence = 95): number {
  const varLevel = valueAtRisk(simpleReturns, confidence);
  const tailReturns = simpleReturns.filter((value) => value <= varLevel);
  return tailReturns.length === 0 ? varLevel : mean(tailReturns);
}
