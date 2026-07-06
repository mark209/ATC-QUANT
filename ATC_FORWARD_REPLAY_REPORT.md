# ATC Forward Replay Report

This is a paper-only replay. Each decision uses only candles available up to that date. Any simulated execution happens on a later candle inside the paper portfolio engine.

| Symbol | Decision Rows | Total Return | Avg Monthly Return | Max Drawdown | Profit Factor | Avg Allocation | Active Decision Days | Skipped Opportunities | Paper Trades |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SPY | 365 | 0.02% | 0.00% | -0.03% | 0.979 | 0.02% | 64.93% | 0 | 161 |
| QQQ | 365 | 0.05% | 0.00% | -0.03% | 1.566 | 0.03% | 64.38% | 0 | 164 |
| AAPL | 365 | -0.01% | -0.00% | -0.03% | 0.357 | 0.00% | 13.15% | 104 | 26 |
| BTCUSDT | 365 | 0.00% | 0.00% | 0.00% | 0.000 | 0.00% | 0.00% | 69 | 0 |
| ETHUSDT | 365 | 0.00% | 0.00% | 0.00% | 0.000 | 0.00% | 0.00% | 68 | 0 |

Decision explanations, blocking reasons, warnings, paper trades, and portfolio value over time are stored in `ATC_FORWARD_REPLAY_DECISIONS.json`.
