# ATC Stress Test Report

This report uses synthetic stress transformations on historical candles and paper replay rows. It does not enable or test real-money execution. Each scenario is bounded to the most recent 120 rebalance decisions to keep the audit runnable.

| Symbol | Scenario | Decision Rows | Duplicate/Conflict Rows | Total Return | Avg Monthly Return | Max Drawdown | Profit Factor | Avg Allocation | Skipped Opportunities | Paper Trades |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SPY | baseline | 120 | 0 | 0.09% | 0.00% | -0.03% | 13.685 | 0.07% | 38 | 42 |
| SPY | losing streak / sudden crash | 120 | 0 | -0.00% | -0.00% | -0.00% | 0.383 | 0.00% | 50 | 18 |
| SPY | sideways choppy market | 120 | 0 | 0.00% | 0.00% | 0.00% | 0.000 | 0.00% | 0 | 0 |
| SPY | high-volatility regime | 120 | 0 | 0.00% | 0.00% | 0.00% | 0.000 | 0.00% | 0 | 0 |
| SPY | low-volume liquidity regime | 120 | 0 | 0.09% | 0.00% | -0.03% | 13.685 | 0.07% | 38 | 42 |
| SPY | missing data | 108 | 0 | 0.13% | 0.00% | -0.03% | n/a | 0.08% | 35 | 25 |
| SPY | stale data | 120 | 0 | 0.09% | 0.00% | -0.03% | 15.528 | 0.07% | 38 | 42 |
| SPY | outlier candle | 120 | 0 | 0.09% | 0.00% | -0.03% | 13.685 | 0.07% | 38 | 42 |
| SPY | high slippage and fees | 120 | 0 | 0.07% | 0.00% | -0.03% | 7.663 | 0.07% | 38 | 42 |
| SPY | execution delay | 120 | 0 | 0.07% | 0.00% | -0.04% | 3.951 | 0.07% | 38 | 41 |
| SPY | duplicate signals | 144 | 24 | 0.09% | 0.00% | -0.03% | 13.685 | 0.07% | 45 | 42 |
| SPY | conflicting signals | 138 | 18 | 0.71% | 0.00% | -0.16% | 6.089 | 0.26% | 42 | 64 |
| QQQ | baseline | 120 | 0 | 0.10% | 0.00% | -0.05% | 3.235 | 0.08% | 29 | 38 |
| QQQ | losing streak / sudden crash | 120 | 0 | -0.01% | -0.00% | -0.06% | 0.526 | 0.03% | 29 | 34 |
| QQQ | sideways choppy market | 120 | 0 | 0.00% | 0.00% | 0.00% | 0.000 | 0.00% | 0 | 0 |
| QQQ | high-volatility regime | 120 | 0 | 0.00% | 0.00% | 0.00% | 0.000 | 0.00% | 0 | 0 |
| QQQ | low-volume liquidity regime | 120 | 0 | 0.10% | 0.00% | -0.05% | 3.235 | 0.08% | 29 | 38 |
| QQQ | missing data | 108 | 0 | 0.07% | 0.00% | -0.04% | 11.055 | 0.08% | 28 | 36 |
| QQQ | stale data | 120 | 0 | 0.09% | 0.00% | -0.05% | 4.039 | 0.08% | 29 | 38 |
| QQQ | outlier candle | 120 | 0 | 0.10% | 0.00% | -0.05% | 3.235 | 0.08% | 29 | 38 |
| QQQ | high slippage and fees | 120 | 0 | 0.08% | 0.00% | -0.05% | 2.424 | 0.08% | 29 | 39 |
| QQQ | execution delay | 120 | 0 | 0.09% | 0.00% | -0.04% | 2.983 | 0.08% | 29 | 40 |
| QQQ | duplicate signals | 144 | 24 | 0.10% | 0.00% | -0.05% | 3.235 | 0.08% | 34 | 38 |
| QQQ | conflicting signals | 138 | 18 | 1.30% | 0.01% | -0.27% | 6.316 | 0.31% | 33 | 66 |
| AAPL | baseline | 120 | 0 | -0.01% | 0.00% | -0.10% | 0.671 | 0.06% | 28 | 31 |
| AAPL | losing streak / sudden crash | 120 | 0 | -0.01% | 0.00% | -0.03% | 0.293 | 0.01% | 29 | 19 |
| AAPL | sideways choppy market | 120 | 0 | 0.00% | 0.00% | 0.00% | 0.000 | 0.00% | 0 | 0 |
| AAPL | high-volatility regime | 120 | 0 | 0.00% | 0.00% | 0.00% | 0.000 | 0.00% | 0 | 0 |
| AAPL | low-volume liquidity regime | 120 | 0 | -0.01% | 0.00% | -0.10% | 0.671 | 0.06% | 28 | 31 |
| AAPL | missing data | 108 | 0 | 0.01% | 0.00% | -0.09% | 0.884 | 0.06% | 24 | 30 |
| AAPL | stale data | 120 | 0 | -0.02% | 0.00% | -0.08% | 0.625 | 0.06% | 28 | 32 |
| AAPL | outlier candle | 120 | 0 | -0.01% | 0.00% | -0.10% | 0.671 | 0.06% | 28 | 31 |
| AAPL | high slippage and fees | 120 | 0 | -0.03% | 0.00% | -0.11% | 0.350 | 0.06% | 28 | 32 |
| AAPL | execution delay | 120 | 0 | -0.00% | 0.00% | -0.10% | 0.654 | 0.06% | 28 | 31 |
| AAPL | duplicate signals | 144 | 24 | -0.01% | 0.00% | -0.10% | 0.671 | 0.06% | 31 | 31 |
| AAPL | conflicting signals | 138 | 18 | 0.80% | 0.00% | -0.51% | 1.914 | 0.29% | 30 | 55 |
| BTCUSDT | baseline | 120 | 0 | 0.02% | 0.00% | -0.07% | 1.450 | 0.02% | 28 | 13 |
| BTCUSDT | losing streak / sudden crash | 120 | 0 | 0.02% | 0.00% | -0.07% | 1.450 | 0.02% | 28 | 13 |
| BTCUSDT | sideways choppy market | 120 | 0 | 0.00% | 0.00% | 0.00% | 0.000 | 0.00% | 0 | 0 |
| BTCUSDT | high-volatility regime | 120 | 0 | 0.00% | 0.00% | 0.00% | 0.000 | 0.00% | 0 | 0 |
| BTCUSDT | low-volume liquidity regime | 120 | 0 | 0.02% | 0.00% | -0.07% | 1.450 | 0.02% | 28 | 13 |
| BTCUSDT | missing data | 120 | 0 | -0.05% | -0.00% | -0.07% | 0.000 | 0.01% | 27 | 4 |
| BTCUSDT | stale data | 120 | 0 | 0.02% | 0.00% | -0.07% | 1.450 | 0.02% | 28 | 13 |
| BTCUSDT | outlier candle | 120 | 0 | 0.02% | 0.00% | -0.07% | 1.450 | 0.02% | 28 | 13 |
| BTCUSDT | high slippage and fees | 120 | 0 | 0.01% | -0.00% | -0.07% | 1.184 | 0.02% | 28 | 14 |
| BTCUSDT | execution delay | 120 | 0 | -0.00% | -0.00% | -0.07% | 0.924 | 0.02% | 28 | 14 |
| BTCUSDT | duplicate signals | 144 | 24 | 0.02% | 0.00% | -0.07% | 1.450 | 0.02% | 30 | 13 |
| BTCUSDT | conflicting signals | 138 | 18 | -0.20% | -0.00% | -1.82% | 0.941 | 0.22% | 30 | 44 |
| ETHUSDT | baseline | 120 | 0 | 0.00% | 0.00% | 0.00% | 0.000 | 0.00% | 17 | 0 |
| ETHUSDT | losing streak / sudden crash | 120 | 0 | 0.00% | 0.00% | 0.00% | 0.000 | 0.00% | 17 | 0 |
| ETHUSDT | sideways choppy market | 120 | 0 | 0.00% | 0.00% | 0.00% | 0.000 | 0.00% | 0 | 0 |
| ETHUSDT | high-volatility regime | 120 | 0 | 0.00% | 0.00% | 0.00% | 0.000 | 0.00% | 0 | 0 |
| ETHUSDT | low-volume liquidity regime | 120 | 0 | 0.00% | 0.00% | 0.00% | 0.000 | 0.00% | 17 | 0 |
| ETHUSDT | missing data | 120 | 0 | 0.13% | 0.00% | -0.12% | n/a | 0.02% | 8 | 7 |
| ETHUSDT | stale data | 120 | 0 | 0.00% | 0.00% | 0.00% | 0.000 | 0.00% | 17 | 0 |
| ETHUSDT | outlier candle | 120 | 0 | 0.00% | 0.00% | 0.00% | 0.000 | 0.00% | 17 | 0 |
| ETHUSDT | high slippage and fees | 120 | 0 | 0.00% | 0.00% | 0.00% | 0.000 | 0.00% | 17 | 0 |
| ETHUSDT | execution delay | 120 | 0 | 0.00% | 0.00% | 0.00% | 0.000 | 0.00% | 17 | 0 |
| ETHUSDT | duplicate signals | 144 | 24 | 0.00% | 0.00% | 0.00% | 0.000 | 0.00% | 19 | 0 |
| ETHUSDT | conflicting signals | 138 | 18 | -0.08% | -0.00% | -2.21% | 0.983 | 0.23% | 17 | 35 |

## Covered Stress Conditions

- Losing streaks and sudden crash: price path is shocked down after the midpoint.
- Sideways/choppy market: closes alternate around a flat base.
- High-volatility regime: alternating candle-level volatility shock.
- Low-volume/liquidity regime: volume and quote volume are reduced by 99%.
- Missing data: every tenth candle is removed.
- Stale data: the final segment repeats stale prices and zero volume.
- Outlier candles: a single candle receives extreme high/low values.
- Slippage and fees: paper execution costs are increased.
- Execution delay: replay decisions execute two candles later.
- Duplicate signals: repeated decision rows are inserted.
- Conflicting signals: contradictory same-date paper decisions are inserted.

Stress results are diagnostic. Any scenario that looks profitable here still needs a separate out-of-sample paper-forward period before capital is considered.
