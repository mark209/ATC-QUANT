# ATC System Profitability Audit

## Executive Summary

This audit is a historical backtest and paper-replay review only. It does not connect to brokerage execution, place trades, or enable live trading.

- Currently profitable: Yes, but only under the tested assumptions
- Realistic potential to target 1% monthly: No
- Realistic potential to target 2% monthly: No
- 5% monthly: 5% monthly is unrealistic/high risk for this architecture unless materially higher drawdown, leverage, or concentration is accepted.
- Main bottleneck: The system is capital-starved: average active allocation is below 1%, so even correct signals cannot compound meaningfully.

## Backtest / Forward Replay Results

| Symbol | Decision Rows | Total Return | Avg Monthly Return | Winning Months | Losing Months | Max Drawdown | Sharpe-like | Profit Factor | Win Rate | Avg Win | Avg Loss | Expectancy / Trade | Trades | Skipped Opportunities | Avg Allocation | Active Decision Days | Buy/Hold |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SPY | 120 | 0.09% | 0.00% | 27 | 16 | -0.03% | -10.000 | 13.685 | 91.67% | 7.18% | -2.62% | 6.36% | 42 | 38 | 0.07% | 30.00% | 318.45% |
| QQQ | 120 | 0.10% | 0.00% | 22 | 22 | -0.05% | -10.000 | 3.235 | 86.36% | 12.39% | -5.51% | 9.95% | 38 | 29 | 0.08% | 31.67% | 610.32% |
| AAPL | 120 | -0.01% | 0.00% | 16 | 17 | -0.10% | -10.000 | 0.671 | 61.90% | 6.93% | -4.54% | 2.56% | 31 | 28 | 0.06% | 21.67% | 1321.24% |
| BTCUSDT | 155 | -0.04% | -0.00% | 3 | 8 | -0.10% | -10.000 | 0.392 | 55.56% | 11.77% | -8.40% | 2.81% | 15 | 25 | 0.02% | 7.10% | 1376.96% |
| ETHUSDT | 155 | -0.00% | -0.00% | 0 | 1 | -0.03% | -10.000 | 0.000 | 0.00% | 0.00% | -0.06% | -0.06% | 2 | 14 | 0.00% | 0.65% | 487.67% |

## Allocation Bottlenecks

| Symbol | Zero Days | Active Days | >= 1% Days | Avg Allocation | Avg Nonzero Allocation | Distribution |
| --- | --- | --- | --- | --- | --- | --- |
| SPY | 84 | 36 | 0 | 0.07% | 0.23% | 0%: 84 (70.00%)<br>>0% to 0.25%: 26 (21.67%)<br>0.25% to 0.50%: 10 (8.33%)<br>0.50% to 1.00%: 0 (0.00%)<br>1.00% to 2.00%: 0 (0.00%)<br>2.00% to 5.00%: 0 (0.00%)<br>>5.00%: 0 (0.00%) |
| QQQ | 82 | 38 | 0 | 0.08% | 0.25% | 0%: 82 (68.33%)<br>0.25% to 0.50%: 22 (18.33%)<br>>0% to 0.25%: 16 (13.33%)<br>0.50% to 1.00%: 0 (0.00%)<br>1.00% to 2.00%: 0 (0.00%)<br>2.00% to 5.00%: 0 (0.00%)<br>>5.00%: 0 (0.00%) |
| AAPL | 94 | 26 | 0 | 0.06% | 0.29% | 0%: 94 (78.33%)<br>0.25% to 0.50%: 19 (15.83%)<br>>0% to 0.25%: 7 (5.83%)<br>0.50% to 1.00%: 0 (0.00%)<br>1.00% to 2.00%: 0 (0.00%)<br>2.00% to 5.00%: 0 (0.00%)<br>>5.00%: 0 (0.00%) |
| BTCUSDT | 144 | 11 | 0 | 0.02% | 0.25% | 0%: 144 (92.90%)<br>>0% to 0.25%: 6 (3.87%)<br>0.25% to 0.50%: 5 (3.23%)<br>0.50% to 1.00%: 0 (0.00%)<br>1.00% to 2.00%: 0 (0.00%)<br>2.00% to 5.00%: 0 (0.00%)<br>>5.00%: 0 (0.00%) |
| ETHUSDT | 154 | 1 | 0 | 0.00% | 0.24% | 0%: 154 (99.35%)<br>>0% to 0.25%: 1 (0.65%)<br>0.25% to 0.50%: 0 (0.00%)<br>0.50% to 1.00%: 0 (0.00%)<br>1.00% to 2.00%: 0 (0.00%)<br>2.00% to 5.00%: 0 (0.00%)<br>>5.00%: 0 (0.00%) |

## Blocking Rules

| Symbol | Main Bottleneck | Distribution |
| --- | --- | --- |
| SPY | Sub-meaningful allocation | Sub-meaningful allocation: 36 (30.00%)<br>Kelly/sample-size sizing: 20 (16.67%)<br>No validation evidence: 18 (15.00%)<br>Final decision zeroed allocation: 14 (11.67%)<br>Expected value failed: 13 (10.83%)<br>Data quality failed: 12 (10.00%)<br>Risk-off regime: 7 (5.83%) |
| QQQ | Sub-meaningful allocation | Sub-meaningful allocation: 38 (31.67%)<br>Kelly/sample-size sizing: 22 (18.33%)<br>No validation evidence: 21 (17.50%)<br>Final decision zeroed allocation: 13 (10.83%)<br>Data quality failed: 12 (10.00%)<br>Risk-off regime: 11 (9.17%)<br>Failed validation evidence: 2 (1.67%)<br>Expected value failed: 1 (0.83%) |
| AAPL | Sub-meaningful allocation | Sub-meaningful allocation: 26 (21.67%)<br>Failed validation evidence: 24 (20.00%)<br>No validation evidence: 17 (14.17%)<br>Final decision zeroed allocation: 14 (11.67%)<br>Kelly/sample-size sizing: 13 (10.83%)<br>Data quality failed: 12 (10.00%)<br>Expected value failed: 7 (5.83%)<br>Risk-off regime: 7 (5.83%) |
| BTCUSDT | Risk-off regime | Risk-off regime: 75 (48.39%)<br>Kelly/sample-size sizing: 27 (17.42%)<br>Failed validation evidence: 18 (11.61%)<br>Data quality failed: 12 (7.74%)<br>Sub-meaningful allocation: 11 (7.10%)<br>No validation evidence: 6 (3.87%)<br>Final decision zeroed allocation: 6 (3.87%) |
| ETHUSDT | Risk-off regime | Risk-off regime: 95 (61.29%)<br>Failed validation evidence: 43 (27.74%)<br>Data quality failed: 12 (7.74%)<br>No validation evidence: 3 (1.94%)<br>Kelly/sample-size sizing: 1 (0.65%)<br>Sub-meaningful allocation: 1 (0.65%) |

## Risk Weaknesses

- SPY: average allocation below 1%; capital deployment is not meaningful.
- QQQ: average allocation below 1%; capital deployment is not meaningful.
- AAPL: average allocation below 1%; capital deployment is not meaningful.
- BTCUSDT: trade sample below 30; profitability evidence is weak.
- BTCUSDT: average allocation below 1%; capital deployment is not meaningful.
- ETHUSDT: trade sample below 30; profitability evidence is weak.
- ETHUSDT: average allocation below 1%; capital deployment is not meaningful.

## Bugs / Audit Findings

- The existing architecture correctly routes signals through validation, EV, risk, position sizing, and final decision labels.
- The current sizing formula can make the system technically correct but economically inactive: final allocation is the minimum of volatility targeting, fractional Kelly, asset cap, and drawdown control.
- The hard Kelly trade-count penalty below 30 trades is a major suspected allocation blocker for a low-frequency trend-following strategy.
- Forward replay uses only candles available up to each replay date, which reduces lookahead risk.
- Results still depend on provider historical data quality and adjusted equity OHLC availability.

## Anti-Overfitting Checks

- Lookahead bias: replay slices candles up to the decision date and paper execution occurs on the next candle open.
- Survivorship bias: this script tests only the configured symbols; it does not prove robustness across delisted or failed assets.
- Curve fitting: parameter sensitivity exists in validation, but thresholds are still fixed architecture choices that require out-of-sample monitoring.
- Execution assumptions: fees and slippage are included, but real spreads, partial fills, borrow limits, outages, and market impact are not fully modeled.
- Data reuse: the same history can influence validation and evaluation if users treat this report as tuning feedback; keep a separate holdout period before risking capital.

## Recommended Fixes

1. Keep live execution disabled.
2. Add a diagnostic-only graded trade-count multiplier to compare against the current hard-zero Kelly rule.
3. Expand the symbol universe and include failed/delisted assets where possible.
4. Run a true out-of-sample paper period before changing capital allocation.
5. Track spread, stale-data, missing-data, duplicate-signal, and execution-delay failures as first-class audit outputs.

## Next Steps Before Using Real Capital

Do not use real capital from this audit alone. Require a long enough paper-forward sample with positive expectancy after fees/slippage, meaningful allocation, tolerable drawdown, and stable behavior through stress tests.

Final answer to the core question: ATC is not proven capable of producing realistic monthly profits yet. The most likely blocker is not signal generation alone; it is capital deployment being starved by validation/EV/Kelly sample-size constraints and conservative final allocation rules.
