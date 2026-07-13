# Statistical Edge Validation Report

## Executive Summary
14 completed trades produced 27152.49 net profit with 28.57% win rate.
Conclusion: **INSUFFICIENT EVIDENCE: the observed result is not yet statistically defensible because the completed-trade sample is small.**

## Dataset Summary
Replay artifacts: 1
Datasets: 1

## Trade Statistics
Trades: 14
Wins / losses: 4 / 10
Win rate: 28.57%
Average win / loss: 11749.12 / -1984.40
Net profit: 27152.49
Expectancy: 1939.46
Profit factor: 2.3683
Average R: 1.0442

## Risk Metrics
Maximum drawdown: 10.31%
Maximum equity drawdown: 10313.06
Time under water: 66.67%

## Portfolio Metrics
CAGR: 13.59%
Sharpe: 4.8445
Sortino: 24.0489

## Monte Carlo
Simulations: 10000
Median ending equity: 127152.49
Worst 5% ending equity: 127152.49
Best 5% ending equity: 127152.49
Maximum simulated drawdown: 19.84%

## Bootstrap 95% Confidence Intervals
Expectancy: -1394.38 to 6104.14
Profit factor: 0.1517 to 8.5381
Win rate: 7.14% to 50.00%
Average return: -1.80% to 9.68%

## Risk Of Ruin
Risk of ruin: 0.00%
Probability of 20% drawdown: 0.00%
Probability of 30% drawdown: 0.00%
Probability of doubling: 0.00%
Probability of new equity high: 100.00%

## Regime Analysis
dataset / binance-btcusdt-1d-crypto-research-v2: 14 trades, net 27152.49, expectancy 1939.46
symbol / BTCUSDT: 14 trades, net 27152.49, expectancy 1939.46
market_regime / No Data / Avoid: 1 trades, net 11740.80, expectancy 11740.80
market_regime / Sideways / Mean reverting: 13 trades, net 15411.69, expectancy 1185.51
volatility / Normal volatility: 4 trades, net 5885.20, expectancy 1471.30
volatility / High volatility: 10 trades, net 21267.29, expectancy 2126.73
trend_type / Mean reverting: 14 trades, net 27152.49, expectancy 1939.46

## Robustness Assessment
performance_concentration_largest_win_share: 0.7827068530363144
single_trade_dependency: true
dataset_dependency: true
dataset_count: 1
regime_dependency: false

## Known Limitations
- Fewer than 30 completed trades: confidence intervals and regime conclusions are exploratory, not statistically reliable.
