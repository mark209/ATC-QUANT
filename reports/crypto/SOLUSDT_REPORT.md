# Statistical Edge Validation Report

## Executive Summary
8 completed trades produced 499.54 net profit with 25.00% win rate.
Conclusion: **INSUFFICIENT EVIDENCE: the observed result is not yet statistically defensible because the completed-trade sample is small.**

## Dataset Summary
Replay artifacts: 1
Datasets: 1

## Trade Statistics
Trades: 8
Wins / losses: 2 / 6
Win rate: 25.00%
Average win / loss: 486.91 / -79.05
Net profit: 499.54
Expectancy: 62.44
Profit factor: 2.0533
Average R: 1.4742

## Risk Metrics
Maximum drawdown: 0.37%
Maximum equity drawdown: 372.74
Time under water: 66.67%

## Portfolio Metrics
CAGR: 1.02%
Sharpe: 3.2867
Sortino: 17.7955

## Monte Carlo
Simulations: 10000
Median ending equity: 100499.54
Worst 5% ending equity: 100499.54
Best 5% ending equity: 100499.54
Maximum simulated drawdown: 0.47%

## Bootstrap 95% Confidence Intervals
Expectancy: -83.26 to 280.04
Profit factor: 0.0000 to 9.1312
Win rate: 0.00% to 50.00%
Average return: -7.23% to 18.95%

## Risk Of Ruin
Risk of ruin: 0.00%
Probability of 20% drawdown: 0.00%
Probability of 30% drawdown: 0.00%
Probability of doubling: 0.00%
Probability of new equity high: 100.00%

## Regime Analysis
dataset / binance-solusdt-1d-crypto-research-v1: 8 trades, net 499.54, expectancy 62.44
symbol / SOLUSDT: 8 trades, net 499.54, expectancy 62.44
market_regime / No Data / Avoid: 4 trades, net 784.04, expectancy 196.01
market_regime / High Volatility: 4 trades, net -284.50, expectancy -71.13
volatility / High volatility: 8 trades, net 499.54, expectancy 62.44
trend_type / Mean reverting: 8 trades, net 499.54, expectancy 62.44

## Robustness Assessment
performance_concentration_largest_win_share: 1.5715658405733277
single_trade_dependency: true
dataset_dependency: true
dataset_count: 1
regime_dependency: false

## Known Limitations
- Fewer than 30 completed trades: confidence intervals and regime conclusions are exploratory, not statistically reliable.
