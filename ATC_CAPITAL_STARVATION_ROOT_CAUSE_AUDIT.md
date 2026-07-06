# ATC Capital Starvation Root-Cause Audit

## Executive Summary

This audit is diagnostic and paper/backtest-only. It does not connect to broker APIs, place trades, or change production allocation logic.

- Final verdict: Signal has edge, but allocation rules are too restrictive.
- Next safest change: Test a small paper-only allocation floor or Bayesian Kelly warmup before any production sizing change.
- Rationale: Signal expectancy is positive and diagnostic allocation sensitivity improved returns without an unacceptable drawdown.
- Production total return in diagnostic decision replay: 0.16%
- Best diagnostic what-if: min allocation floor of 1.00% at 9.69% total return with -0.76% max drawdown.
- Signal expectancy across replay decisions: 2.53%
- Hard Kelly below-30-trade blocks: 0 (0.00%).

## Rejected Opportunity Audit

Each replay row is classified into one mutually exclusive root-cause bucket. Missed return assumes a diagnostic 0.25% paper allocation and is not a recommendation to trade.

| Symbol | Category | Count | % Decisions | Avg Next Return | Avg Missed Return @ 0.25% | Bucket Sign |
| --- | --- | --- | --- | --- | --- | --- |
| SPY | rejected by risk-off regime | 7 | 5.83% | 2.24% | 0.01% | Net positive |
| SPY | rejected by failed validation | 0 | 0.00% | 0.00% | 0.00% | Net negative/flat |
| SPY | rejected by no validation evidence | 33 | 27.50% | 1.20% | 0.00% | Net positive |
| SPY | rejected by Kelly/sample-size penalty | 0 | 0.00% | 0.00% | 0.00% | Net negative/flat |
| SPY | rejected by EV/expectancy gate | 30 | 25.00% | 1.62% | 0.00% | Net positive |
| SPY | rejected by final decision zeroing | 14 | 11.67% | 0.11% | 0.00% | Net positive |
| SPY | accepted but tiny allocation | 36 | 30.00% | 1.37% | 0.00% | Net positive |
| SPY | accepted with meaningful allocation | 0 | 0.00% | 0.00% | 0.00% | Net negative/flat |
| QQQ | rejected by risk-off regime | 11 | 9.17% | 3.12% | 0.01% | Net positive |
| QQQ | rejected by failed validation | 3 | 2.50% | 0.91% | 0.00% | Net positive |
| QQQ | rejected by no validation evidence | 33 | 27.50% | 1.81% | 0.00% | Net positive |
| QQQ | rejected by Kelly/sample-size penalty | 0 | 0.00% | 0.00% | 0.00% | Net negative/flat |
| QQQ | rejected by EV/expectancy gate | 22 | 18.33% | 2.74% | 0.01% | Net positive |
| QQQ | rejected by final decision zeroing | 13 | 10.83% | 0.92% | 0.00% | Net positive |
| QQQ | accepted but tiny allocation | 38 | 31.67% | 1.27% | 0.00% | Net positive |
| QQQ | accepted with meaningful allocation | 0 | 0.00% | 0.00% | 0.00% | Net negative/flat |
| AAPL | rejected by risk-off regime | 7 | 5.83% | 8.92% | 0.02% | Net positive |
| AAPL | rejected by failed validation | 25 | 20.83% | 2.55% | 0.01% | Net positive |
| AAPL | rejected by no validation evidence | 32 | 26.67% | 1.90% | 0.00% | Net positive |
| AAPL | rejected by Kelly/sample-size penalty | 0 | 0.00% | 0.00% | 0.00% | Net negative/flat |
| AAPL | rejected by EV/expectancy gate | 16 | 13.33% | 5.34% | 0.01% | Net positive |
| AAPL | rejected by final decision zeroing | 14 | 11.67% | 2.71% | 0.01% | Net positive |
| AAPL | accepted but tiny allocation | 26 | 21.67% | -0.09% | -0.00% | Net negative/flat |
| AAPL | accepted with meaningful allocation | 0 | 0.00% | 0.00% | 0.00% | Net negative/flat |
| BTCUSDT | rejected by risk-off regime | 77 | 49.68% | 0.60% | 0.00% | Net positive |
| BTCUSDT | rejected by failed validation | 18 | 11.61% | 1.16% | 0.00% | Net positive |
| BTCUSDT | rejected by no validation evidence | 16 | 10.32% | 6.64% | 0.02% | Net positive |
| BTCUSDT | rejected by Kelly/sample-size penalty | 0 | 0.00% | 0.00% | 0.00% | Net negative/flat |
| BTCUSDT | rejected by EV/expectancy gate | 27 | 17.42% | 9.90% | 0.02% | Net positive |
| BTCUSDT | rejected by final decision zeroing | 6 | 3.87% | 8.26% | 0.02% | Net positive |
| BTCUSDT | accepted but tiny allocation | 11 | 7.10% | -1.46% | -0.00% | Net negative/flat |
| BTCUSDT | accepted with meaningful allocation | 0 | 0.00% | 0.00% | 0.00% | Net negative/flat |
| ETHUSDT | rejected by risk-off regime | 97 | 62.58% | 1.42% | 0.00% | Net positive |
| ETHUSDT | rejected by failed validation | 43 | 27.74% | 5.77% | 0.01% | Net positive |
| ETHUSDT | rejected by no validation evidence | 13 | 8.39% | 11.48% | 0.03% | Net positive |
| ETHUSDT | rejected by Kelly/sample-size penalty | 0 | 0.00% | 0.00% | 0.00% | Net negative/flat |
| ETHUSDT | rejected by EV/expectancy gate | 1 | 0.65% | 2.50% | 0.01% | Net positive |
| ETHUSDT | rejected by final decision zeroing | 0 | 0.00% | 0.00% | 0.00% | Net negative/flat |
| ETHUSDT | accepted but tiny allocation | 1 | 0.65% | 0.34% | 0.00% | Net positive |
| ETHUSDT | accepted with meaningful allocation | 0 | 0.00% | 0.00% | 0.00% | Net negative/flat |

### Combined Rejection Distribution

rejected by risk-off regime: 199 (29.70%)<br>rejected by no validation evidence: 127 (18.96%)<br>accepted but tiny allocation: 112 (16.72%)<br>rejected by EV/expectancy gate: 96 (14.33%)<br>rejected by failed validation: 89 (13.28%)<br>rejected by final decision zeroing: 47 (7.01%)<br>rejected by Kelly/sample-size penalty: 0 (0.00%)<br>accepted with meaningful allocation: 0 (0.00%)

## Allocation Sensitivity Audit

These are what-if simulations only. Production behavior is unchanged.

| Symbol | Scenario | Monthly Return | Total Return | Max Drawdown | Volatility | Active Days | Avg Allocation | Median Allocation | % >= 0.10% | % >= 0.25% | % >= 0.50% | % >= 1.00% | Worst 5 Decisions | Best 5 Decisions |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SPY | current production allocation | 0.00% | 0.09% | -0.02% | 0.00% | 36 | 0.07% | 0.00% | 30.00% | 8.33% | 0.00% | 0.00% | 2025-02-10 SPY -0.02%<br>2022-01-04 SPY -0.02%<br>2024-07-10 SPY -0.02%<br>2026-02-11 SPY -0.01%<br>2024-12-06 SPY -0.01% | 2021-10-05 SPY 0.02%<br>2026-04-14 SPY 0.01%<br>2024-06-07 SPY 0.01%<br>2021-12-03 SPY 0.01%<br>2024-09-09 SPY 0.01% |
| SPY | min allocation floor of 0.10% | 0.00% | 0.12% | -0.03% | 0.01% | 74 | 0.10% | 0.10% | 61.67% | 8.33% | 0.00% | 0.00% | 2025-02-10 SPY -0.02%<br>2022-01-04 SPY -0.02%<br>2024-07-10 SPY -0.02%<br>2020-02-05 SPY -0.01%<br>2026-02-11 SPY -0.01% | 2021-10-05 SPY 0.02%<br>2026-04-14 SPY 0.01%<br>2024-06-07 SPY 0.01%<br>2021-12-03 SPY 0.01%<br>2024-09-09 SPY 0.01% |
| SPY | min allocation floor of 0.25% | 0.00% | 0.19% | -0.06% | 0.01% | 74 | 0.16% | 0.25% | 61.67% | 61.67% | 0.00% | 0.00% | 2020-02-05 SPY -0.03%<br>2018-12-03 SPY -0.02%<br>2025-02-10 SPY -0.02%<br>2022-01-04 SPY -0.02%<br>2018-10-03 SPY -0.02% | 2020-11-03 SPY 0.02%<br>2021-10-05 SPY 0.02%<br>2026-04-14 SPY 0.02%<br>2021-03-08 SPY 0.02%<br>2024-06-07 SPY 0.01% |
| SPY | min allocation floor of 0.50% | 0.00% | 0.38% | -0.12% | 0.02% | 74 | 0.31% | 0.50% | 61.67% | 61.67% | 61.67% | 0.00% | 2020-02-05 SPY -0.05%<br>2018-12-03 SPY -0.05%<br>2025-02-10 SPY -0.04%<br>2022-01-04 SPY -0.03%<br>2018-10-03 SPY -0.03% | 2020-11-03 SPY 0.05%<br>2021-10-05 SPY 0.04%<br>2026-04-14 SPY 0.03%<br>2021-03-08 SPY 0.03%<br>2021-12-03 SPY 0.03% |
| SPY | min allocation floor of 1.00% | 0.01% | 0.77% | -0.23% | 0.03% | 74 | 0.62% | 1.00% | 61.67% | 61.67% | 61.67% | 61.67% | 2020-02-05 SPY -0.11%<br>2018-12-03 SPY -0.09%<br>2025-02-10 SPY -0.08%<br>2022-01-04 SPY -0.06%<br>2018-10-03 SPY -0.06% | 2020-11-03 SPY 0.09%<br>2021-10-05 SPY 0.07%<br>2026-04-14 SPY 0.07%<br>2021-03-08 SPY 0.07%<br>2021-12-03 SPY 0.06% |
| SPY | relaxed Kelly warmup below 30 trades | 0.00% | 0.09% | -0.02% | 0.00% | 36 | 0.07% | 0.00% | 30.00% | 8.33% | 0.00% | 0.00% | 2025-02-10 SPY -0.02%<br>2022-01-04 SPY -0.02%<br>2024-07-10 SPY -0.02%<br>2026-02-11 SPY -0.01%<br>2024-12-06 SPY -0.01% | 2021-10-05 SPY 0.02%<br>2026-04-14 SPY 0.01%<br>2024-06-07 SPY 0.01%<br>2021-12-03 SPY 0.01%<br>2024-09-09 SPY 0.01% |
| SPY | capped fractional Kelly alternative | 0.00% | 0.10% | -0.03% | 0.00% | 42 | 0.07% | 0.00% | 30.00% | 8.33% | 0.00% | 0.00% | 2025-02-10 SPY -0.02%<br>2022-01-04 SPY -0.02%<br>2024-07-10 SPY -0.02%<br>2026-02-11 SPY -0.01%<br>2024-12-06 SPY -0.01% | 2021-10-05 SPY 0.02%<br>2026-04-14 SPY 0.01%<br>2024-06-07 SPY 0.01%<br>2021-12-03 SPY 0.01%<br>2024-09-09 SPY 0.01% |
| SPY | validation-softening mode where lack of evidence reduces allocation but does not force zero | 0.00% | 0.09% | -0.02% | 0.00% | 36 | 0.07% | 0.00% | 30.00% | 8.33% | 0.00% | 0.00% | 2025-02-10 SPY -0.02%<br>2022-01-04 SPY -0.02%<br>2024-07-10 SPY -0.02%<br>2026-02-11 SPY -0.01%<br>2024-12-06 SPY -0.01% | 2021-10-05 SPY 0.02%<br>2026-04-14 SPY 0.01%<br>2024-06-07 SPY 0.01%<br>2021-12-03 SPY 0.01%<br>2024-09-09 SPY 0.01% |
| QQQ | current production allocation | 0.00% | 0.11% | -0.04% | 0.01% | 38 | 0.08% | 0.00% | 31.67% | 18.33% | 0.00% | 0.00% | 2024-07-10 QQQ -0.03%<br>2025-02-10 QQQ -0.03%<br>2022-01-04 QQQ -0.02%<br>2021-09-03 QQQ -0.01%<br>2026-01-12 QQQ -0.01% | 2026-04-14 QQQ 0.03%<br>2024-06-07 QQQ 0.02%<br>2024-01-08 QQQ 0.02%<br>2025-10-10 QQQ 0.02%<br>2023-06-07 QQQ 0.01% |
| QQQ | min allocation floor of 0.10% | 0.00% | 0.20% | -0.03% | 0.01% | 83 | 0.12% | 0.10% | 69.17% | 18.33% | 0.00% | 0.00% | 2024-07-10 QQQ -0.03%<br>2025-02-10 QQQ -0.03%<br>2022-01-04 QQQ -0.02%<br>2021-09-03 QQQ -0.01%<br>2021-02-04 QQQ -0.01% | 2026-04-14 QQQ 0.03%<br>2024-06-07 QQQ 0.02%<br>2024-01-08 QQQ 0.02%<br>2025-10-10 QQQ 0.02%<br>2023-06-07 QQQ 0.01% |
| QQQ | min allocation floor of 0.25% | 0.00% | 0.35% | -0.04% | 0.01% | 83 | 0.18% | 0.25% | 69.17% | 69.17% | 0.00% | 0.00% | 2024-07-10 QQQ -0.03%<br>2022-01-04 QQQ -0.03%<br>2025-02-10 QQQ -0.03%<br>2021-02-04 QQQ -0.02%<br>2020-02-05 QQQ -0.02% | 2026-04-14 QQQ 0.03%<br>2020-11-03 QQQ 0.03%<br>2021-03-08 QQQ 0.03%<br>2021-10-05 QQQ 0.03%<br>2024-06-07 QQQ 0.02% |
| QQQ | min allocation floor of 0.50% | 0.01% | 0.71% | -0.07% | 0.02% | 83 | 0.35% | 0.50% | 69.17% | 69.17% | 69.17% | 0.00% | 2024-07-10 QQQ -0.05%<br>2022-01-04 QQQ -0.05%<br>2025-02-10 QQQ -0.05%<br>2021-02-04 QQQ -0.05%<br>2020-02-05 QQQ -0.04% | 2026-04-14 QQQ 0.07%<br>2020-11-03 QQQ 0.05%<br>2021-03-08 QQQ 0.05%<br>2021-10-05 QQQ 0.05%<br>2024-06-07 QQQ 0.04% |
| QQQ | min allocation floor of 1.00% | 0.01% | 1.42% | -0.14% | 0.04% | 83 | 0.69% | 1.00% | 69.17% | 69.17% | 69.17% | 69.17% | 2024-07-10 QQQ -0.11%<br>2022-01-04 QQQ -0.11%<br>2025-02-10 QQQ -0.10%<br>2021-02-04 QQQ -0.09%<br>2020-02-05 QQQ -0.09% | 2026-04-14 QQQ 0.14%<br>2020-11-03 QQQ 0.11%<br>2021-03-08 QQQ 0.11%<br>2021-10-05 QQQ 0.10%<br>2024-06-07 QQQ 0.09% |
| QQQ | relaxed Kelly warmup below 30 trades | 0.00% | 0.11% | -0.04% | 0.01% | 38 | 0.08% | 0.00% | 31.67% | 18.33% | 0.00% | 0.00% | 2024-07-10 QQQ -0.03%<br>2025-02-10 QQQ -0.03%<br>2022-01-04 QQQ -0.02%<br>2021-09-03 QQQ -0.01%<br>2026-01-12 QQQ -0.01% | 2026-04-14 QQQ 0.03%<br>2024-06-07 QQQ 0.02%<br>2024-01-08 QQQ 0.02%<br>2025-10-10 QQQ 0.02%<br>2023-06-07 QQQ 0.01% |
| QQQ | capped fractional Kelly alternative | 0.00% | 0.14% | -0.03% | 0.01% | 45 | 0.08% | 0.00% | 31.67% | 18.33% | 0.00% | 0.00% | 2024-07-10 QQQ -0.03%<br>2025-02-10 QQQ -0.03%<br>2022-01-04 QQQ -0.02%<br>2021-09-03 QQQ -0.01%<br>2026-01-12 QQQ -0.01% | 2026-04-14 QQQ 0.03%<br>2024-06-07 QQQ 0.02%<br>2024-01-08 QQQ 0.02%<br>2025-10-10 QQQ 0.02%<br>2023-06-07 QQQ 0.01% |
| QQQ | validation-softening mode where lack of evidence reduces allocation but does not force zero | 0.00% | 0.11% | -0.04% | 0.01% | 38 | 0.08% | 0.00% | 31.67% | 18.33% | 0.00% | 0.00% | 2024-07-10 QQQ -0.03%<br>2025-02-10 QQQ -0.03%<br>2022-01-04 QQQ -0.02%<br>2021-09-03 QQQ -0.01%<br>2026-01-12 QQQ -0.01% | 2026-04-14 QQQ 0.03%<br>2024-06-07 QQQ 0.02%<br>2024-01-08 QQQ 0.02%<br>2025-10-10 QQQ 0.02%<br>2023-06-07 QQQ 0.01% |
| AAPL | current production allocation | -0.00% | -0.01% | -0.08% | 0.01% | 26 | 0.06% | 0.00% | 21.67% | 15.83% | 0.00% | 0.00% | 2022-04-05 AAPL -0.04%<br>2022-02-03 AAPL -0.03%<br>2021-09-03 AAPL -0.03%<br>2024-02-07 AAPL -0.03%<br>2024-07-10 AAPL -0.03% | 2021-12-03 AAPL 0.04%<br>2022-03-07 AAPL 0.03%<br>2021-11-03 AAPL 0.02%<br>2024-11-06 AAPL 0.02%<br>2023-11-06 AAPL 0.02% |
| AAPL | min allocation floor of 0.10% | 0.00% | 0.14% | -0.07% | 0.01% | 75 | 0.10% | 0.10% | 62.50% | 15.83% | 0.00% | 0.00% | 2022-04-05 AAPL -0.04%<br>2022-02-03 AAPL -0.03%<br>2021-09-03 AAPL -0.03%<br>2024-02-07 AAPL -0.03%<br>2024-07-10 AAPL -0.03% | 2021-12-03 AAPL 0.04%<br>2022-03-07 AAPL 0.03%<br>2021-11-03 AAPL 0.02%<br>2024-11-06 AAPL 0.02%<br>2023-11-06 AAPL 0.02% |
| AAPL | min allocation floor of 0.25% | 0.00% | 0.37% | -0.07% | 0.02% | 75 | 0.17% | 0.25% | 62.50% | 62.50% | 0.00% | 0.00% | 2018-11-01 AAPL -0.04%<br>2021-02-04 AAPL -0.04%<br>2022-04-05 AAPL -0.04%<br>2022-02-03 AAPL -0.03%<br>2021-09-03 AAPL -0.03% | 2020-07-07 AAPL 0.05%<br>2021-12-03 AAPL 0.04%<br>2026-04-14 AAPL 0.04%<br>2021-06-07 AAPL 0.04%<br>2019-12-04 AAPL 0.04% |
| AAPL | min allocation floor of 0.50% | 0.01% | 0.75% | -0.13% | 0.03% | 75 | 0.31% | 0.50% | 62.50% | 62.50% | 62.50% | 0.00% | 2018-11-01 AAPL -0.08%<br>2021-02-04 AAPL -0.08%<br>2022-04-05 AAPL -0.05%<br>2020-02-05 AAPL -0.05%<br>2024-02-07 AAPL -0.05% | 2020-07-07 AAPL 0.09%<br>2026-04-14 AAPL 0.08%<br>2021-06-07 AAPL 0.07%<br>2019-12-04 AAPL 0.07%<br>2020-04-06 AAPL 0.07% |
| AAPL | min allocation floor of 1.00% | 0.01% | 1.50% | -0.26% | 0.06% | 75 | 0.63% | 1.00% | 62.50% | 62.50% | 62.50% | 62.50% | 2018-11-01 AAPL -0.17%<br>2021-02-04 AAPL -0.15%<br>2022-04-05 AAPL -0.10%<br>2020-02-05 AAPL -0.10%<br>2024-02-07 AAPL -0.10% | 2020-07-07 AAPL 0.18%<br>2026-04-14 AAPL 0.16%<br>2021-06-07 AAPL 0.15%<br>2019-12-04 AAPL 0.15%<br>2020-04-06 AAPL 0.15% |
| AAPL | relaxed Kelly warmup below 30 trades | -0.00% | -0.01% | -0.08% | 0.01% | 26 | 0.06% | 0.00% | 21.67% | 15.83% | 0.00% | 0.00% | 2022-04-05 AAPL -0.04%<br>2022-02-03 AAPL -0.03%<br>2021-09-03 AAPL -0.03%<br>2024-02-07 AAPL -0.03%<br>2024-07-10 AAPL -0.03% | 2021-12-03 AAPL 0.04%<br>2022-03-07 AAPL 0.03%<br>2021-11-03 AAPL 0.02%<br>2024-11-06 AAPL 0.02%<br>2023-11-06 AAPL 0.02% |
| AAPL | capped fractional Kelly alternative | 0.00% | 0.06% | -0.07% | 0.01% | 46 | 0.08% | 0.00% | 32.50% | 15.83% | 0.00% | 0.00% | 2022-04-05 AAPL -0.04%<br>2022-02-03 AAPL -0.03%<br>2021-09-03 AAPL -0.03%<br>2024-02-07 AAPL -0.03%<br>2024-07-10 AAPL -0.03% | 2021-12-03 AAPL 0.04%<br>2022-03-07 AAPL 0.03%<br>2021-11-03 AAPL 0.02%<br>2024-11-06 AAPL 0.02%<br>2023-11-06 AAPL 0.02% |
| AAPL | validation-softening mode where lack of evidence reduces allocation but does not force zero | -0.00% | -0.01% | -0.08% | 0.01% | 26 | 0.06% | 0.00% | 21.67% | 15.83% | 0.00% | 0.00% | 2022-04-05 AAPL -0.04%<br>2022-02-03 AAPL -0.03%<br>2021-09-03 AAPL -0.03%<br>2024-02-07 AAPL -0.03%<br>2024-07-10 AAPL -0.03% | 2021-12-03 AAPL 0.04%<br>2022-03-07 AAPL 0.03%<br>2021-11-03 AAPL 0.02%<br>2024-11-06 AAPL 0.02%<br>2023-11-06 AAPL 0.02% |
| BTCUSDT | current production allocation | -0.00% | -0.04% | -0.06% | 0.01% | 11 | 0.02% | 0.00% | 7.10% | 3.23% | 0.00% | 0.00% | 2024-06-20 BTCUSDT -0.03%<br>2025-02-06 BTCUSDT -0.03%<br>2024-08-01 BTCUSDT -0.02%<br>2024-05-30 BTCUSDT -0.01%<br>2025-05-22 BTCUSDT -0.01% | 2025-05-01 BTCUSDT 0.04%<br>2024-11-14 BTCUSDT 0.03%<br>2024-12-26 BTCUSDT 0.01%<br>2017-08-17 BTCUSDT 0.00%<br>2017-09-07 BTCUSDT 0.00% |
| BTCUSDT | min allocation floor of 0.10% | 0.00% | 0.27% | -0.07% | 0.01% | 59 | 0.05% | 0.00% | 38.06% | 3.23% | 0.00% | 0.00% | 2024-06-20 BTCUSDT -0.03%<br>2025-02-06 BTCUSDT -0.03%<br>2019-09-12 BTCUSDT -0.02%<br>2021-05-13 BTCUSDT -0.02%<br>2024-08-01 BTCUSDT -0.02% | 2020-12-17 BTCUSDT 0.07%<br>2021-01-28 BTCUSDT 0.05%<br>2025-05-01 BTCUSDT 0.04%<br>2020-10-15 BTCUSDT 0.04%<br>2020-11-26 BTCUSDT 0.03% |
| BTCUSDT | min allocation floor of 0.25% | 0.01% | 0.73% | -0.09% | 0.03% | 59 | 0.10% | 0.00% | 38.06% | 38.06% | 0.00% | 0.00% | 2019-09-12 BTCUSDT -0.05%<br>2021-05-13 BTCUSDT -0.05%<br>2021-11-18 BTCUSDT -0.04%<br>2021-01-07 BTCUSDT -0.04%<br>2020-08-13 BTCUSDT -0.03% | 2020-12-17 BTCUSDT 0.18%<br>2021-01-28 BTCUSDT 0.14%<br>2020-10-15 BTCUSDT 0.09%<br>2020-11-26 BTCUSDT 0.08%<br>2024-01-25 BTCUSDT 0.07% |
| BTCUSDT | min allocation floor of 0.50% | 0.01% | 1.46% | -0.18% | 0.05% | 59 | 0.19% | 0.00% | 38.06% | 38.06% | 38.06% | 0.00% | 2019-09-12 BTCUSDT -0.11%<br>2021-05-13 BTCUSDT -0.10%<br>2021-11-18 BTCUSDT -0.08%<br>2021-01-07 BTCUSDT -0.08%<br>2020-08-13 BTCUSDT -0.07% | 2020-12-17 BTCUSDT 0.36%<br>2021-01-28 BTCUSDT 0.27%<br>2020-10-15 BTCUSDT 0.18%<br>2020-11-26 BTCUSDT 0.16%<br>2024-01-25 BTCUSDT 0.15% |
| BTCUSDT | min allocation floor of 1.00% | 0.03% | 2.93% | -0.37% | 0.11% | 59 | 0.38% | 0.00% | 38.06% | 38.06% | 38.06% | 38.06% | 2019-09-12 BTCUSDT -0.21%<br>2021-05-13 BTCUSDT -0.21%<br>2021-11-18 BTCUSDT -0.16%<br>2021-01-07 BTCUSDT -0.15%<br>2020-08-13 BTCUSDT -0.14% | 2020-12-17 BTCUSDT 0.73%<br>2021-01-28 BTCUSDT 0.55%<br>2020-10-15 BTCUSDT 0.36%<br>2020-11-26 BTCUSDT 0.33%<br>2024-01-25 BTCUSDT 0.30% |
| BTCUSDT | relaxed Kelly warmup below 30 trades | -0.00% | -0.04% | -0.06% | 0.01% | 11 | 0.02% | 0.00% | 7.10% | 3.23% | 0.00% | 0.00% | 2024-06-20 BTCUSDT -0.03%<br>2025-02-06 BTCUSDT -0.03%<br>2024-08-01 BTCUSDT -0.02%<br>2024-05-30 BTCUSDT -0.01%<br>2025-05-22 BTCUSDT -0.01% | 2025-05-01 BTCUSDT 0.04%<br>2024-11-14 BTCUSDT 0.03%<br>2024-12-26 BTCUSDT 0.01%<br>2017-08-17 BTCUSDT 0.00%<br>2017-09-07 BTCUSDT 0.00% |
| BTCUSDT | capped fractional Kelly alternative | -0.00% | -0.01% | -0.06% | 0.01% | 18 | 0.02% | 0.00% | 7.10% | 3.23% | 0.00% | 0.00% | 2024-06-20 BTCUSDT -0.03%<br>2025-02-06 BTCUSDT -0.03%<br>2024-08-01 BTCUSDT -0.02%<br>2024-05-30 BTCUSDT -0.01%<br>2025-05-22 BTCUSDT -0.01% | 2025-05-01 BTCUSDT 0.04%<br>2024-11-14 BTCUSDT 0.03%<br>2024-10-24 BTCUSDT 0.02%<br>2024-12-26 BTCUSDT 0.01%<br>2025-07-03 BTCUSDT 0.01% |
| BTCUSDT | validation-softening mode where lack of evidence reduces allocation but does not force zero | -0.00% | -0.04% | -0.06% | 0.01% | 11 | 0.02% | 0.00% | 7.10% | 3.23% | 0.00% | 0.00% | 2024-06-20 BTCUSDT -0.03%<br>2025-02-06 BTCUSDT -0.03%<br>2024-08-01 BTCUSDT -0.02%<br>2024-05-30 BTCUSDT -0.01%<br>2025-05-22 BTCUSDT -0.01% | 2025-05-01 BTCUSDT 0.04%<br>2024-11-14 BTCUSDT 0.03%<br>2024-12-26 BTCUSDT 0.01%<br>2017-08-17 BTCUSDT 0.00%<br>2017-09-07 BTCUSDT 0.00% |
| ETHUSDT | current production allocation | 0.00% | 0.00% | 0.00% | 0.00% | 1 | 0.00% | 0.00% | 0.65% | 0.00% | 0.00% | 0.00% | 2017-08-17 ETHUSDT 0.00%<br>2017-09-07 ETHUSDT 0.00%<br>2017-09-28 ETHUSDT 0.00%<br>2017-10-19 ETHUSDT 0.00%<br>2017-11-09 ETHUSDT 0.00% | 2023-06-08 ETHUSDT 0.00%<br>2017-08-17 ETHUSDT 0.00%<br>2017-09-07 ETHUSDT 0.00%<br>2017-09-28 ETHUSDT 0.00%<br>2017-10-19 ETHUSDT 0.00% |
| ETHUSDT | min allocation floor of 0.10% | 0.00% | 0.27% | -0.08% | 0.01% | 44 | 0.03% | 0.00% | 28.39% | 0.00% | 0.00% | 0.00% | 2021-05-13 ETHUSDT -0.02%<br>2021-12-30 ETHUSDT -0.02%<br>2025-01-16 ETHUSDT -0.02%<br>2025-10-16 ETHUSDT -0.01%<br>2024-03-28 ETHUSDT -0.01% | 2020-12-17 ETHUSDT 0.09%<br>2021-04-22 ETHUSDT 0.06%<br>2020-07-23 ETHUSDT 0.05%<br>2021-01-28 ETHUSDT 0.05%<br>2024-02-15 ETHUSDT 0.04% |
| ETHUSDT | min allocation floor of 0.25% | 0.01% | 0.68% | -0.19% | 0.03% | 44 | 0.07% | 0.00% | 28.39% | 28.39% | 0.00% | 0.00% | 2021-05-13 ETHUSDT -0.06%<br>2021-12-30 ETHUSDT -0.05%<br>2025-01-16 ETHUSDT -0.05%<br>2025-10-16 ETHUSDT -0.04%<br>2024-03-28 ETHUSDT -0.03% | 2020-12-17 ETHUSDT 0.23%<br>2021-04-22 ETHUSDT 0.14%<br>2020-07-23 ETHUSDT 0.14%<br>2021-01-28 ETHUSDT 0.11%<br>2024-02-15 ETHUSDT 0.09% |
| ETHUSDT | min allocation floor of 0.50% | 0.01% | 1.36% | -0.38% | 0.06% | 44 | 0.14% | 0.00% | 28.39% | 28.39% | 28.39% | 0.00% | 2021-05-13 ETHUSDT -0.12%<br>2021-12-30 ETHUSDT -0.10%<br>2025-01-16 ETHUSDT -0.09%<br>2025-10-16 ETHUSDT -0.07%<br>2024-03-28 ETHUSDT -0.07% | 2020-12-17 ETHUSDT 0.45%<br>2021-04-22 ETHUSDT 0.28%<br>2020-07-23 ETHUSDT 0.27%<br>2021-01-28 ETHUSDT 0.23%<br>2024-02-15 ETHUSDT 0.19% |
| ETHUSDT | min allocation floor of 1.00% | 0.03% | 2.73% | -0.76% | 0.12% | 44 | 0.28% | 0.00% | 28.39% | 28.39% | 28.39% | 28.39% | 2021-05-13 ETHUSDT -0.23%<br>2021-12-30 ETHUSDT -0.19%<br>2025-01-16 ETHUSDT -0.19%<br>2025-10-16 ETHUSDT -0.15%<br>2024-03-28 ETHUSDT -0.14% | 2020-12-17 ETHUSDT 0.91%<br>2021-04-22 ETHUSDT 0.55%<br>2020-07-23 ETHUSDT 0.54%<br>2021-01-28 ETHUSDT 0.46%<br>2024-02-15 ETHUSDT 0.37% |
| ETHUSDT | relaxed Kelly warmup below 30 trades | 0.00% | 0.00% | 0.00% | 0.00% | 1 | 0.00% | 0.00% | 0.65% | 0.00% | 0.00% | 0.00% | 2017-08-17 ETHUSDT 0.00%<br>2017-09-07 ETHUSDT 0.00%<br>2017-09-28 ETHUSDT 0.00%<br>2017-10-19 ETHUSDT 0.00%<br>2017-11-09 ETHUSDT 0.00% | 2023-06-08 ETHUSDT 0.00%<br>2017-08-17 ETHUSDT 0.00%<br>2017-09-07 ETHUSDT 0.00%<br>2017-09-28 ETHUSDT 0.00%<br>2017-10-19 ETHUSDT 0.00% |
| ETHUSDT | capped fractional Kelly alternative | -0.00% | -0.01% | -0.06% | 0.00% | 23 | 0.01% | 0.00% | 0.65% | 0.00% | 0.00% | 0.00% | 2025-01-16 ETHUSDT -0.01%<br>2024-03-28 ETHUSDT -0.01%<br>2025-10-16 ETHUSDT -0.01%<br>2024-06-20 ETHUSDT -0.01%<br>2024-12-05 ETHUSDT -0.01% | 2024-02-15 ETHUSDT 0.03%<br>2024-01-25 ETHUSDT 0.02%<br>2025-07-24 ETHUSDT 0.02%<br>2023-11-23 ETHUSDT 0.01%<br>2024-07-11 ETHUSDT 0.00% |
| ETHUSDT | validation-softening mode where lack of evidence reduces allocation but does not force zero | 0.00% | 0.00% | 0.00% | 0.00% | 1 | 0.00% | 0.00% | 0.65% | 0.00% | 0.00% | 0.00% | 2017-08-17 ETHUSDT 0.00%<br>2017-09-07 ETHUSDT 0.00%<br>2017-09-28 ETHUSDT 0.00%<br>2017-10-19 ETHUSDT 0.00%<br>2017-11-09 ETHUSDT 0.00% | 2023-06-08 ETHUSDT 0.00%<br>2017-08-17 ETHUSDT 0.00%<br>2017-09-07 ETHUSDT 0.00%<br>2017-09-28 ETHUSDT 0.00%<br>2017-10-19 ETHUSDT 0.00% |

## Combined Allocation Sensitivity

| Symbol | Scenario | Monthly Return | Total Return | Max Drawdown | Volatility | Active Days | Avg Allocation | Median Allocation | % >= 0.10% | % >= 0.25% | % >= 0.50% | % >= 1.00% | Worst 5 Decisions | Best 5 Decisions |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ALL | current production allocation | 0.00% | 0.16% | -0.13% | 0.01% | 112 | 0.04% | 0.00% | 16.72% | 8.36% | 0.00% | 0.00% | 2022-04-05 AAPL -0.04%<br>2024-07-10 QQQ -0.03%<br>2022-02-03 AAPL -0.03%<br>2024-06-20 BTCUSDT -0.03%<br>2021-09-03 AAPL -0.03% | 2021-12-03 AAPL 0.04%<br>2025-05-01 BTCUSDT 0.04%<br>2026-04-14 QQQ 0.03%<br>2022-03-07 AAPL 0.03%<br>2024-11-14 BTCUSDT 0.03% |
| ALL | min allocation floor of 0.10% | 0.01% | 1.01% | -0.08% | 0.01% | 335 | 0.08% | 0.10% | 50.00% | 8.36% | 0.00% | 0.00% | 2022-04-05 AAPL -0.04%<br>2024-07-10 QQQ -0.03%<br>2022-02-03 AAPL -0.03%<br>2024-06-20 BTCUSDT -0.03%<br>2021-09-03 AAPL -0.03% | 2020-12-17 ETHUSDT 0.09%<br>2020-12-17 BTCUSDT 0.07%<br>2021-04-22 ETHUSDT 0.06%<br>2021-01-28 BTCUSDT 0.05%<br>2020-07-23 ETHUSDT 0.05% |
| ALL | min allocation floor of 0.25% | 0.02% | 2.34% | -0.19% | 0.02% | 335 | 0.13% | 0.25% | 50.00% | 50.00% | 0.00% | 0.00% | 2021-05-13 ETHUSDT -0.06%<br>2019-09-12 BTCUSDT -0.05%<br>2021-05-13 BTCUSDT -0.05%<br>2021-12-30 ETHUSDT -0.05%<br>2025-01-16 ETHUSDT -0.05% | 2020-12-17 ETHUSDT 0.23%<br>2020-12-17 BTCUSDT 0.18%<br>2021-04-22 ETHUSDT 0.14%<br>2021-01-28 BTCUSDT 0.14%<br>2020-07-23 ETHUSDT 0.14% |
| ALL | min allocation floor of 0.50% | 0.04% | 4.74% | -0.38% | 0.04% | 335 | 0.25% | 0.50% | 50.00% | 50.00% | 50.00% | 0.00% | 2021-05-13 ETHUSDT -0.12%<br>2019-09-12 BTCUSDT -0.11%<br>2021-05-13 BTCUSDT -0.10%<br>2021-12-30 ETHUSDT -0.10%<br>2025-01-16 ETHUSDT -0.09% | 2020-12-17 ETHUSDT 0.45%<br>2020-12-17 BTCUSDT 0.36%<br>2021-04-22 ETHUSDT 0.28%<br>2021-01-28 BTCUSDT 0.27%<br>2020-07-23 ETHUSDT 0.27% |
| ALL | min allocation floor of 1.00% | 0.08% | 9.69% | -0.76% | 0.09% | 335 | 0.50% | 1.00% | 50.00% | 50.00% | 50.00% | 50.00% | 2021-05-13 ETHUSDT -0.23%<br>2019-09-12 BTCUSDT -0.21%<br>2021-05-13 BTCUSDT -0.21%<br>2021-12-30 ETHUSDT -0.19%<br>2025-01-16 ETHUSDT -0.19% | 2020-12-17 ETHUSDT 0.91%<br>2020-12-17 BTCUSDT 0.73%<br>2021-04-22 ETHUSDT 0.55%<br>2021-01-28 BTCUSDT 0.55%<br>2020-07-23 ETHUSDT 0.54% |
| ALL | relaxed Kelly warmup below 30 trades | 0.00% | 0.16% | -0.13% | 0.01% | 112 | 0.04% | 0.00% | 16.72% | 8.36% | 0.00% | 0.00% | 2022-04-05 AAPL -0.04%<br>2024-07-10 QQQ -0.03%<br>2022-02-03 AAPL -0.03%<br>2024-06-20 BTCUSDT -0.03%<br>2021-09-03 AAPL -0.03% | 2021-12-03 AAPL 0.04%<br>2025-05-01 BTCUSDT 0.04%<br>2026-04-14 QQQ 0.03%<br>2022-03-07 AAPL 0.03%<br>2024-11-14 BTCUSDT 0.03% |
| ALL | capped fractional Kelly alternative | 0.00% | 0.27% | -0.10% | 0.01% | 174 | 0.05% | 0.00% | 18.66% | 8.36% | 0.00% | 0.00% | 2022-04-05 AAPL -0.04%<br>2024-07-10 QQQ -0.03%<br>2022-02-03 AAPL -0.03%<br>2024-06-20 BTCUSDT -0.03%<br>2021-09-03 AAPL -0.03% | 2021-12-03 AAPL 0.04%<br>2025-05-01 BTCUSDT 0.04%<br>2026-04-14 QQQ 0.03%<br>2022-03-07 AAPL 0.03%<br>2024-02-15 ETHUSDT 0.03% |
| ALL | validation-softening mode where lack of evidence reduces allocation but does not force zero | 0.00% | 0.16% | -0.13% | 0.01% | 112 | 0.04% | 0.00% | 16.72% | 8.36% | 0.00% | 0.00% | 2022-04-05 AAPL -0.04%<br>2024-07-10 QQQ -0.03%<br>2022-02-03 AAPL -0.03%<br>2024-06-20 BTCUSDT -0.03%<br>2021-09-03 AAPL -0.03% | 2021-12-03 AAPL 0.04%<br>2025-05-01 BTCUSDT 0.04%<br>2026-04-14 QQQ 0.03%<br>2022-03-07 AAPL 0.03%<br>2024-11-14 BTCUSDT 0.03% |

## Signal Quality Audit

This section asks whether the signal deserves more capital before changing allocation rules.

Overall: count 670, expectancy 2.53%, hit rate 58.66%, payoff ratio 1.218, profit factor 1.728.

| Group | Bucket | Count | Avg Return | Hit Rate | Avg Win | Avg Loss | Payoff Ratio | Profit Factor | Expectancy | Max Adverse | Max Favorable |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Confidence | Low confidence | 310 | 2.39% | 56.13% | 12.39% | -10.41% | 1.190 | 1.522 | 2.39% | -57.13% | 102.35% |
| Confidence | High confidence | 257 | 2.87% | 60.31% | 8.62% | -5.88% | 1.467 | 2.230 | 2.87% | -53.50% | 100.56% |
| Confidence | Medium confidence | 103 | 2.09% | 62.14% | 8.22% | -7.96% | 1.033 | 1.695 | 2.09% | -62.25% | 49.51% |
| EV bucket | EV <= 0 | 113 | 3.81% | 63.72% | 13.53% | -13.25% | 1.021 | 1.793 | 3.81% | -52.25% | 102.35% |
| EV bucket | EV 0% to 1% | 267 | 1.89% | 65.92% | 5.55% | -5.20% | 1.067 | 2.064 | 1.89% | -57.13% | 36.90% |
| EV bucket | EV > 1% | 290 | 2.61% | 50.00% | 14.26% | -9.03% | 1.579 | 1.579 | 2.61% | -62.25% | 100.56% |
| Validation | No Evidence | 210 | 2.96% | 62.86% | 11.50% | -11.50% | 1.000 | 1.693 | 2.96% | -62.25% | 102.35% |
| Validation | Weak Evidence | 196 | 2.40% | 59.69% | 8.13% | -6.09% | 1.336 | 1.979 | 2.40% | -31.13% | 77.06% |
| Validation | Moderate Evidence | 98 | 1.99% | 64.29% | 5.57% | -4.46% | 1.250 | 2.249 | 1.99% | -25.02% | 36.76% |
| Validation | Failed Evidence | 163 | 2.40% | 48.47% | 14.97% | -9.42% | 1.590 | 1.495 | 2.40% | -53.50% | 100.56% |
| Validation | Strong Evidence | 3 | 4.51% | 66.67% | 7.31% | -1.10% | 6.630 | 13.260 | 4.51% | -3.97% | 14.01% |
| Regime | No Data / Avoid | 50 | 6.05% | 70.00% | 12.79% | -9.66% | 1.324 | 3.090 | 6.05% | -52.25% | 102.35% |
| Regime | Trend Up | 229 | 1.88% | 60.26% | 6.41% | -4.99% | 1.284 | 1.947 | 1.88% | -25.02% | 77.06% |
| Regime | Range / Chop | 113 | 2.43% | 62.83% | 7.60% | -6.32% | 1.203 | 2.033 | 2.43% | -35.76% | 36.76% |
| Regime | High Volatility | 81 | 4.87% | 60.49% | 13.83% | -8.86% | 1.561 | 2.391 | 4.87% | -53.50% | 100.56% |
| Regime | Trend Down | 12 | 1.76% | 58.33% | 5.70% | -3.76% | 1.515 | 2.120 | 1.76% | -12.96% | 14.39% |
| Regime | Risk-Off | 185 | 1.46% | 50.27% | 15.37% | -12.60% | 1.220 | 1.233 | 1.46% | -62.25% | 87.03% |
| Asset | SPY | 120 | 1.29% | 65.00% | 3.71% | -3.20% | 1.159 | 2.153 | 1.29% | -26.19% | 13.02% |
| Asset | QQQ | 120 | 1.81% | 69.17% | 4.80% | -4.90% | 0.980 | 2.199 | 1.81% | -20.55% | 19.92% |
| Asset | AAPL | 120 | 2.57% | 63.33% | 7.60% | -6.13% | 1.240 | 2.141 | 2.57% | -26.44% | 25.88% |
| Asset | BTCUSDT | 155 | 3.06% | 51.61% | 15.16% | -9.85% | 1.539 | 1.641 | 3.06% | -57.13% | 101.23% |
| Asset | ETHUSDT | 155 | 3.47% | 49.03% | 20.26% | -12.68% | 1.598 | 1.538 | 3.47% | -62.25% | 102.35% |

## Kelly Rule Diagnosis

The current hard rule forces Kelly to zero when validated trade count is below 30. This audit compares it with softer diagnostic alternatives without changing production.

| Symbol | Kelly Rule | Blocked Count | % Blocked | Avg Kelly Before Hard Rule | Avg Kelly After Hard Rule | Avg Blocked Next Return | Blocked Bucket Sign | Alternative Avg Allocation | Alternative Avg Return Contribution | Commentary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SPY | current hard rule | 0 | 0.00% | 0.00% | 0.00% | 0.00% | Net negative/flat | 0.00% | 0.00% | Current rule blocks all below-30-trade Kelly exposure. |
| SPY | linear warmup | 0 | 0.00% | 0.00% | 0.00% | 0.00% | Net negative/flat | 0.00% | 0.00% | Diagnostic only; does not change production sizing. |
| SPY | square-root sample-size discount | 0 | 0.00% | 0.00% | 0.00% | 0.00% | Net negative/flat | 0.00% | 0.00% | Diagnostic only; does not change production sizing. |
| SPY | Bayesian/shrunk Kelly | 0 | 0.00% | 0.00% | 0.00% | 0.00% | Net negative/flat | 0.00% | 0.00% | Bayesian/shrunk Kelly is often more appropriate for a low-frequency trend system because it avoids a binary cliff while still shrinking uncertain samples. |
| SPY | fixed fractional risk cap | 0 | 0.00% | 0.00% | 0.00% | 0.00% | Net negative/flat | 0.00% | 0.00% | Diagnostic only; does not change production sizing. |
| QQQ | current hard rule | 0 | 0.00% | 0.00% | 0.00% | 0.00% | Net negative/flat | 0.00% | 0.00% | Current rule blocks all below-30-trade Kelly exposure. |
| QQQ | linear warmup | 0 | 0.00% | 0.00% | 0.00% | 0.00% | Net negative/flat | 0.00% | 0.00% | Diagnostic only; does not change production sizing. |
| QQQ | square-root sample-size discount | 0 | 0.00% | 0.00% | 0.00% | 0.00% | Net negative/flat | 0.00% | 0.00% | Diagnostic only; does not change production sizing. |
| QQQ | Bayesian/shrunk Kelly | 0 | 0.00% | 0.00% | 0.00% | 0.00% | Net negative/flat | 0.00% | 0.00% | Bayesian/shrunk Kelly is often more appropriate for a low-frequency trend system because it avoids a binary cliff while still shrinking uncertain samples. |
| QQQ | fixed fractional risk cap | 0 | 0.00% | 0.00% | 0.00% | 0.00% | Net negative/flat | 0.00% | 0.00% | Diagnostic only; does not change production sizing. |
| AAPL | current hard rule | 0 | 0.00% | 0.00% | 0.00% | 0.00% | Net negative/flat | 0.00% | 0.00% | Current rule blocks all below-30-trade Kelly exposure. |
| AAPL | linear warmup | 0 | 0.00% | 0.00% | 0.00% | 0.00% | Net negative/flat | 0.00% | 0.00% | Diagnostic only; does not change production sizing. |
| AAPL | square-root sample-size discount | 0 | 0.00% | 0.00% | 0.00% | 0.00% | Net negative/flat | 0.00% | 0.00% | Diagnostic only; does not change production sizing. |
| AAPL | Bayesian/shrunk Kelly | 0 | 0.00% | 0.00% | 0.00% | 0.00% | Net negative/flat | 0.00% | 0.00% | Bayesian/shrunk Kelly is often more appropriate for a low-frequency trend system because it avoids a binary cliff while still shrinking uncertain samples. |
| AAPL | fixed fractional risk cap | 0 | 0.00% | 0.00% | 0.00% | 0.00% | Net negative/flat | 0.00% | 0.00% | Diagnostic only; does not change production sizing. |
| BTCUSDT | current hard rule | 0 | 0.00% | 0.00% | 0.00% | 0.00% | Net negative/flat | 0.00% | 0.00% | Current rule blocks all below-30-trade Kelly exposure. |
| BTCUSDT | linear warmup | 0 | 0.00% | 0.00% | 0.00% | 0.00% | Net negative/flat | 0.00% | 0.00% | Diagnostic only; does not change production sizing. |
| BTCUSDT | square-root sample-size discount | 0 | 0.00% | 0.00% | 0.00% | 0.00% | Net negative/flat | 0.00% | 0.00% | Diagnostic only; does not change production sizing. |
| BTCUSDT | Bayesian/shrunk Kelly | 0 | 0.00% | 0.00% | 0.00% | 0.00% | Net negative/flat | 0.00% | 0.00% | Bayesian/shrunk Kelly is often more appropriate for a low-frequency trend system because it avoids a binary cliff while still shrinking uncertain samples. |
| BTCUSDT | fixed fractional risk cap | 0 | 0.00% | 0.00% | 0.00% | 0.00% | Net negative/flat | 0.00% | 0.00% | Diagnostic only; does not change production sizing. |
| ETHUSDT | current hard rule | 0 | 0.00% | 0.00% | 0.00% | 0.00% | Net negative/flat | 0.00% | 0.00% | Current rule blocks all below-30-trade Kelly exposure. |
| ETHUSDT | linear warmup | 0 | 0.00% | 0.00% | 0.00% | 0.00% | Net negative/flat | 0.00% | 0.00% | Diagnostic only; does not change production sizing. |
| ETHUSDT | square-root sample-size discount | 0 | 0.00% | 0.00% | 0.00% | 0.00% | Net negative/flat | 0.00% | 0.00% | Diagnostic only; does not change production sizing. |
| ETHUSDT | Bayesian/shrunk Kelly | 0 | 0.00% | 0.00% | 0.00% | 0.00% | Net negative/flat | 0.00% | 0.00% | Bayesian/shrunk Kelly is often more appropriate for a low-frequency trend system because it avoids a binary cliff while still shrinking uncertain samples. |
| ETHUSDT | fixed fractional risk cap | 0 | 0.00% | 0.00% | 0.00% | 0.00% | Net negative/flat | 0.00% | 0.00% | Diagnostic only; does not change production sizing. |
| ALL | current hard rule | 0 | 0.00% | 0.00% | 0.00% | 0.00% | Net negative/flat | 0.00% | 0.00% | Current rule blocks all below-30-trade Kelly exposure. |
| ALL | linear warmup | 0 | 0.00% | 0.00% | 0.00% | 0.00% | Net negative/flat | 0.00% | 0.00% | Diagnostic only; does not change production sizing. |
| ALL | square-root sample-size discount | 0 | 0.00% | 0.00% | 0.00% | 0.00% | Net negative/flat | 0.00% | 0.00% | Diagnostic only; does not change production sizing. |
| ALL | Bayesian/shrunk Kelly | 0 | 0.00% | 0.00% | 0.00% | 0.00% | Net negative/flat | 0.00% | 0.00% | Bayesian/shrunk Kelly is often more appropriate for a low-frequency trend system because it avoids a binary cliff while still shrinking uncertain samples. |
| ALL | fixed fractional risk cap | 0 | 0.00% | 0.00% | 0.00% | 0.00% | Net negative/flat | 0.00% | 0.00% | Diagnostic only; does not change production sizing. |

Diagnosis: Do not remove the hard rule blindly. Compare hard-zero behavior against linear, square-root, Bayesian/shrunk, and fixed-fractional diagnostics in paper replay first.

## Root-Cause Interpretation

- If rejected buckets are net negative, the system is probably rejecting weak signals correctly.
- If rejected buckets are net positive while allocation remains near zero, the sizing/validation rules may be too restrictive.
- If sensitivity scenarios improve return only by accepting material drawdown, the signal is not safely deployable.
- If high-confidence, positive-EV, and stronger-validation buckets do not outperform weaker buckets, the signal does not deserve more capital yet.
- A Bayesian/shrunk Kelly warmup is more defensible than simply removing the 30-trade hard rule because it preserves uncertainty penalties for low-frequency trend systems.

## Final Recommendation

Verdict: Signal has edge, but allocation rules are too restrictive.

ATC should remain paper-only. Allocation should not be increased in production from this audit alone. The next safest change is diagnostic only: run a paper-only small allocation floor or Bayesian/shrunk Kelly warmup and require a separate forward sample before changing real allocation rules.
