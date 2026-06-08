export function calculateLogReturns(prices: number[]): number[] {
  return prices.slice(1).map((price, index) => Math.log(price / prices[index]));
}

export function calculateSimpleReturns(prices: number[]): number[] {
  return prices.slice(1).map((price, index) => (price - prices[index]) / prices[index]);
}

export function compoundReturn(simpleReturns: number[]): number {
  return simpleReturns.reduce((value, nextReturn) => value * (1 + nextReturn), 1) - 1;
}

export function annualizedReturn(simpleReturns: number[], periodsPerYear: number): number {
  if (simpleReturns.length === 0) return 0;
  const totalReturn = compoundReturn(simpleReturns);
  return Math.pow(1 + totalReturn, periodsPerYear / simpleReturns.length) - 1;
}
