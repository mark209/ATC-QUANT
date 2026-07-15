# Statistical Edge Validation Report

## Executive Summary
7 completed trades produced 137.98 net profit with 14.29% win rate.
Conclusion: **INSUFFICIENT EVIDENCE: the observed result is not yet statistically defensible because the completed-trade sample is small.**

## Dataset Summary
Replay artifacts: 1
Datasets: 1

## Trade Statistics
Trades: 7
Wins / losses: 1 / 6
Win rate: 14.29%
Average win / loss: 778.05 / -106.68
Net profit: 137.98
Expectancy: 19.71
Profit factor: 1.2156
Average R: 0.2364

## Risk Metrics
Maximum drawdown: 0.64%
Maximum equity drawdown: 635.13
Time under water: 75.00%

## Portfolio Metrics
CAGR: 0.22%
Sharpe: 2.4005
Sortino: 26.4817

## Monte Carlo
Simulations: 10000
Median ending equity: 100137.98
Worst 5% ending equity: 100137.98
Best 5% ending equity: 100137.98
Maximum simulated drawdown: 0.64%

## Bootstrap 95% Confidence Intervals
Expectancy: -127.89 to 280.10
Profit factor: 0.0000 to 6.2502
Win rate: 0.00% to 42.86%
Average return: -4.12% to 13.23%

## Risk Of Ruin
Risk of ruin: 0.00%
Probability of 20% drawdown: 0.00%
Probability of 30% drawdown: 0.00%
Probability of doubling: 0.00%
Probability of new equity high: 100.00%

## Regime Analysis
dataset / binance-ethusdt-1d-crypto-research-v1: 7 trades, net 137.98, expectancy 19.71
symbol / ETHUSDT: 7 trades, net 137.98, expectancy 19.71
market_regime / No Data / Avoid: 4 trades, net 461.07, expectancy 115.27
market_regime / Sideways / Mean reverting: 3 trades, net -323.09, expectancy -107.70
volatility / High volatility: 7 trades, net 137.98, expectancy 19.71
trend_type / Mean reverting: 7 trades, net 137.98, expectancy 19.71

## Robustness Assessment
performance_concentration_largest_win_share: 5.6388607044499395
single_trade_dependency: true
dataset_dependency: true
dataset_count: 1
regime_dependency: false

## Known Limitations
- Fewer than 30 completed trades: confidence intervals and regime conclusions are exploratory, not statistically reliable.
