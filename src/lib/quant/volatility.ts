export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const average = mean(values);
  const variance = values.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function annualizedVolatility(logReturns: number[], periodsPerYear: number): number {
  return standardDeviation(logReturns) * Math.sqrt(periodsPerYear);
}

export function ewmaVolatility(logReturns: number[], lambda = 0.94, periodsPerYear = 252): number {
  if (logReturns.length === 0) return 0;
  let variance = Math.pow(logReturns[0], 2);
  for (const value of logReturns.slice(1)) {
    variance = lambda * variance + (1 - lambda) * Math.pow(value, 2);
  }
  return Math.sqrt(variance) * Math.sqrt(periodsPerYear);
}

export function percentile(values: number[], percentileRank: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((percentileRank / 100) * sorted.length)));
  return sorted[index];
}
