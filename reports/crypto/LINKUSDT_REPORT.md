# Statistical Edge Validation Report

## Executive Summary
3 completed trades produced -25.24 net profit with 33.33% win rate.
Conclusion: **INSUFFICIENT EVIDENCE: the observed result is not yet statistically defensible because the completed-trade sample is small.**

## Dataset Summary
Replay artifacts: 1
Datasets: 1

## Trade Statistics
Trades: 3
Wins / losses: 1 / 2
Win rate: 33.33%
Average win / loss: 42.58 / -33.91
Net profit: -25.24
Expectancy: -8.41
Profit factor: 0.6279
Average R: -0.0702

## Risk Metrics
Maximum drawdown: 0.07%
Maximum equity drawdown: 67.79
Time under water: 50.00%

## Portfolio Metrics
CAGR: -0.05%
Sharpe: 0.7077
Sortino: 14.7148

## Monte Carlo
Simulations: 10000
Median ending equity: 99974.76
Worst 5% ending equity: 99974.76
Best 5% ending equity: 99974.76
Maximum simulated drawdown: 0.07%

## Bootstrap 95% Confidence Intervals
Expectancy: -35.34 to 42.58
Profit factor: 0.0000 to 9007199254740991.0000
Win rate: 0.00% to 100.00%
Average return: -2.84% to 5.83%

## Risk Of Ruin
Risk of ruin: 0.00%
Probability of 20% drawdown: 0.00%
Probability of 30% drawdown: 0.00%
Probability of doubling: 0.00%
Probability of new equity high: 67.31%

## Regime Analysis
dataset / binance-linkusdt-1d-crypto-research-v1: 3 trades, net -25.24, expectancy -8.41
symbol / LINKUSDT: 3 trades, net -25.24, expectancy -8.41
market_regime / No Data / Avoid: 1 trades, net 42.58, expectancy 42.58
market_regime / High Volatility: 1 trades, net -32.48, expectancy -32.48
market_regime / Sideways / Mean reverting: 1 trades, net -35.34, expectancy -35.34
volatility / High volatility: 3 trades, net -25.24, expectancy -8.41
trend_type / Mean reverting: 3 trades, net -25.24, expectancy -8.41

## Robustness Assessment
performance_concentration_largest_win_share: -1.6874702805516089
single_trade_dependency: false
dataset_dependency: true
dataset_count: 1
regime_dependency: false

## Known Limitations
- Fewer than 30 completed trades: confidence intervals and regime conclusions are exploratory, not statistically reliable.
