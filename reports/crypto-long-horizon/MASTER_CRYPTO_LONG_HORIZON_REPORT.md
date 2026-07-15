# MASTER CRYPTO LONG-HORIZON REPORT

Generated: 2026-07-13T23:51:44.542Z

| Asset | Trades | PF | Expectancy | Max DD | Recovery | Sharpe | Sortino | Calmar | Bootstrap Expectancy | MC Worst 5% | Risk of Ruin | Verification |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|---|
| BNBUSDT | 3 | 1.63 | 48.83 | 0.23% | 0.64 | 6.30 | 90.26 | 1.38 | -141.60 to 377.45 | 100146.49 | 0.00% | FAIL |
| BTCUSDT | 4 | 1.52 | 655.16 | 4.64% | 0.56 | 6.32 | 190.74 | 2.44 | -1888.23 to 5334.75 | 102620.64 | 0.00% | FAIL |
| ETHUSDT | 6 | 1.92 | 54.73 | 0.29% | 1.12 | 5.37 | 94.08 | 3.74 | -108.59 to 316.38 | 100328.40 | 0.00% | FAIL |

## BTC Specialization Test
BTC strongest: true
ETH converges toward BTC: false
BNB stable: true
Performance deteriorates with sample size: false
Profit factor remains stable: true
Expectancy remains positive: true

Best period: BTCUSDT:early-history
Worst period: BTCUSDT:middle-history

## Limitations
- Long-horizon history is limited to the available Binance spot daily candles.
- Each asset remains an independent replay; the master report compares but does not pool trade outcomes.
- The existing lifecycle timestamp-ordering verification defect remains unresolved.
- Fewer than 30 completed trades on any asset remains statistically weak even with longer candle history.
