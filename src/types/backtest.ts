export interface BacktestAssumptions {
  initialCapital: number;
  fees: number;
  slippage: number;
  rebalancingFrequency: "daily";
  signalDelay: number;
  benchmark: string;
}
