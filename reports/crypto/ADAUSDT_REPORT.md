# Statistical Edge Validation Report

## Executive Summary
7 completed trades produced -369.82 net profit with 14.29% win rate.
Conclusion: **INSUFFICIENT EVIDENCE: the observed result is not yet statistically defensible because the completed-trade sample is small.**

## Dataset Summary
Replay artifacts: 1
Datasets: 1

## Trade Statistics
Trades: 7
Wins / losses: 1 / 6
Win rate: 14.29%
Average win / loss: 243.51 / -102.22
Net profit: -369.82
Expectancy: -52.83
Profit factor: 0.3970
Average R: 5.9047

## Risk Metrics
Maximum drawdown: 0.41%
Maximum equity drawdown: 412.23
Time under water: 87.50%

## Portfolio Metrics
CAGR: -1.14%
Sharpe: -8.3939
Sortino: -14.0227

## Monte Carlo
Simulations: 10000
Median ending equity: 99630.18
Worst 5% ending equity: 99630.18
Best 5% ending equity: 99630.18
Maximum simulated drawdown: 0.61%

## Bootstrap 95% Confidence Intervals
Expectancy: -139.17 to 58.11
Profit factor: 0.0000 to 2.2848
Win rate: 0.00% to 42.86%
Average return: -12.28% to 2.75%

## Risk Of Ruin
Risk of ruin: 0.00%
Probability of 20% drawdown: 0.00%
Probability of 30% drawdown: 0.00%
Probability of doubling: 0.00%
Probability of new equity high: 41.30%

## Regime Analysis
dataset / binance-adausdt-1d-crypto-research-v1: 7 trades, net -369.82, expectancy -52.83
symbol / ADAUSDT: 7 trades, net -369.82, expectancy -52.83
market_regime / No Data / Avoid: 7 trades, net -369.82, expectancy -52.83
volatility / High volatility: 7 trades, net -369.82, expectancy -52.83
trend_type / Mean reverting: 7 trades, net -369.82, expectancy -52.83

## Robustness Assessment
performance_concentration_largest_win_share: -0.6584588610581354
single_trade_dependency: false
dataset_dependency: true
dataset_count: 1
regime_dependency: true

## Known Limitations
- Fewer than 30 completed trades: confidence intervals and regime conclusions are exploratory, not statistically reliable.
