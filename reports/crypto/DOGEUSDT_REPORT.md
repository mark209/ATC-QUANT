# Statistical Edge Validation Report

## Executive Summary
4 completed trades produced 138.43 net profit with 50.00% win rate.
Conclusion: **INSUFFICIENT EVIDENCE: the observed result is not yet statistically defensible because the completed-trade sample is small.**

## Dataset Summary
Replay artifacts: 1
Datasets: 1

## Trade Statistics
Trades: 4
Wins / losses: 2 / 2
Win rate: 50.00%
Average win / loss: 133.64 / -64.43
Net profit: 138.43
Expectancy: 34.61
Profit factor: 2.0743
Average R: 0.4064

## Risk Metrics
Maximum drawdown: 0.13%
Maximum equity drawdown: 128.51
Time under water: 40.00%

## Portfolio Metrics
CAGR: 0.31%
Sharpe: 6.1712
Sortino: 120.4373

## Monte Carlo
Simulations: 10000
Median ending equity: 100138.43
Worst 5% ending equity: 100138.43
Best 5% ending equity: 100138.43
Maximum simulated drawdown: 0.13%

## Bootstrap 95% Confidence Intervals
Expectancy: -64.43 to 184.16
Profit factor: 0.0000 to 9007199254740991.0000
Win rate: 0.00% to 100.00%
Average return: -4.41% to 23.54%

## Risk Of Ruin
Risk of ruin: 0.00%
Probability of 20% drawdown: 0.00%
Probability of 30% drawdown: 0.00%
Probability of doubling: 0.00%
Probability of new equity high: 100.00%

## Regime Analysis
dataset / binance-dogeusdt-1d-crypto-research-v1: 4 trades, net 138.43, expectancy 34.61
symbol / DOGEUSDT: 4 trades, net 138.43, expectancy 34.61
market_regime / No Data / Avoid: 2 trades, net 267.28, expectancy 133.64
market_regime / High Volatility: 2 trades, net -128.85, expectancy -64.43
volatility / High volatility: 4 trades, net 138.43, expectancy 34.61
trend_type / Mean reverting: 4 trades, net 138.43, expectancy 34.61

## Robustness Assessment
performance_concentration_largest_win_share: 1.8996439575690625
single_trade_dependency: true
dataset_dependency: true
dataset_count: 1
regime_dependency: false

## Known Limitations
- Fewer than 30 completed trades: confidence intervals and regime conclusions are exploratory, not statistically reliable.
