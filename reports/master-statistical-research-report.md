# Statistical Edge Validation Report

## Executive Summary
16 completed trades produced 50194.40 net profit with 31.25% win rate.
Conclusion: **INSUFFICIENT EVIDENCE: the observed result is not yet statistically defensible because the completed-trade sample is small.**

## Dataset Summary
Replay artifacts: 7
Datasets: 7

## Trade Statistics
Trades: 16
Wins / losses: 5 / 11
Win rate: 31.25%
Average win / loss: 13121.68 / -1401.27
Net profit: 50194.40
Expectancy: 3137.15
Profit factor: 4.2564
Average R: 1.9292

## Risk Metrics
Maximum drawdown: 9.12%
Maximum equity drawdown: 9119.59
Time under water: 64.71%

## Portfolio Metrics
CAGR: 17.13%
Sharpe: 5.2553
Sortino: 53.2215

## Monte Carlo
Simulations: 10000
Median ending equity: 150194.40
Worst 5% ending equity: 150194.40
Best 5% ending equity: 150194.40
Maximum simulated drawdown: 15.36%

## Bootstrap 95% Confidence Intervals
Expectancy: -760.62 to 7912.12
Profit factor: 0.3454 to 18.1918
Win rate: 12.50% to 56.25%
Average return: -1.14% to 20.67%

## Risk Of Ruin
Risk of ruin: 0.00%
Probability of 20% drawdown: 0.00%
Probability of 30% drawdown: 0.00%
Probability of doubling: 0.00%
Probability of new equity high: 100.00%

## Regime Analysis
dataset / binance-btcusdt-1d-real-2023-present: 16 trades, net 50194.40, expectancy 3137.15
symbol / BTCUSDT: 16 trades, net 50194.40, expectancy 3137.15
market_regime / No Data / Avoid: 1 trades, net 2271.84, expectancy 2271.84
market_regime / Sideways / Mean reverting: 15 trades, net 47922.56, expectancy 3194.84
volatility / Normal volatility: 16 trades, net 50194.40, expectancy 3137.15
trend_type / Mean reverting: 16 trades, net 50194.40, expectancy 3137.15

## Robustness Assessment
performance_concentration_largest_win_share: 0.5083844014471733
single_trade_dependency: true
dataset_dependency: true
dataset_count: 1
regime_dependency: false

## Known Limitations
- Fewer than 30 completed trades: confidence intervals and regime conclusions are exploratory, not statistically reliable.
