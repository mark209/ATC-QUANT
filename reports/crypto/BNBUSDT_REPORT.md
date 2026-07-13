# Statistical Edge Validation Report

## Executive Summary
22 completed trades produced 494.21 net profit with 22.73% win rate.
Conclusion: **INSUFFICIENT EVIDENCE: the observed result is not yet statistically defensible because the completed-trade sample is small.**

## Dataset Summary
Replay artifacts: 1
Datasets: 1

## Trade Statistics
Trades: 22
Wins / losses: 5 / 17
Win rate: 22.73%
Average win / loss: 193.56 / -27.86
Net profit: 494.21
Expectancy: 22.46
Profit factor: 2.0435
Average R: 1.2953

## Risk Metrics
Maximum drawdown: 0.23%
Maximum equity drawdown: 225.06
Time under water: 86.96%

## Portfolio Metrics
CAGR: 0.26%
Sharpe: 3.7240
Sortino: 32.2035

## Monte Carlo
Simulations: 10000
Median ending equity: 100494.21
Worst 5% ending equity: 100494.21
Best 5% ending equity: 100494.21
Maximum simulated drawdown: 0.47%

## Bootstrap 95% Confidence Intervals
Expectancy: -29.55 to 96.47
Profit factor: 0.0160 to 8.3478
Win rate: 4.55% to 40.91%
Average return: -3.17% to 22.28%

## Risk Of Ruin
Risk of ruin: 0.00%
Probability of 20% drawdown: 0.00%
Probability of 30% drawdown: 0.00%
Probability of doubling: 0.00%
Probability of new equity high: 100.00%

## Regime Analysis
dataset / binance-bnbusdt-1d-crypto-research-v1: 22 trades, net 494.21, expectancy 22.46
symbol / BNBUSDT: 22 trades, net 494.21, expectancy 22.46
market_regime / No Data / Avoid: 1 trades, net 269.10, expectancy 269.10
market_regime / Sideways / Mean reverting: 19 trades, net 448.60, expectancy 23.61
market_regime / Bull / Trending: 1 trades, net -50.40, expectancy -50.40
market_regime / High Volatility: 1 trades, net -173.09, expectancy -173.09
volatility / Normal volatility: 1 trades, net 269.10, expectancy 269.10
volatility / High volatility: 21 trades, net 225.11, expectancy 10.72
trend_type / Mean reverting: 21 trades, net 544.61, expectancy 25.93
trend_type / Trending: 1 trades, net -50.40, expectancy -50.40

## Robustness Assessment
performance_concentration_largest_win_share: 1.3292527468080362
single_trade_dependency: true
dataset_dependency: true
dataset_count: 1
regime_dependency: false

## Known Limitations
- Fewer than 30 completed trades: confidence intervals and regime conclusions are exploratory, not statistically reliable.
