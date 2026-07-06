# ATC Shadow Allocation Experiment Report

## Executive Summary

This is a paper-only shadow allocation experiment. Shadow modes are not production changes, do not place trades, do not connect to broker APIs, and must not be treated as permission to trade real capital.

- Candidate selection window: 468 decision rows.
- Separate holdout/forward window: 202 decision rows.
- Best-performing shadow mode on holdout: floor_1_00 (1.29% total return).
- Most robust recommended paper-only mode: floor_0_10.
- Edge survives medium realistic costs for recommended mode: yes.
- Final verdict: Continue paper-only with 0.10% shadow floor.
- Safest next paper-only experiment: floor_0_10
- Rationale: Recommendation prefers the smallest robust paper-only mode that survived medium costs, second-half performance, drawdown, and outlier checks.

## Window Split

The capital-starvation report was used only to choose candidate shadow policies. The performance below is measured on later holdout rows.

| Symbol | Total Rows | Selection Rows | Selection Window | Holdout Rows | Holdout Window |
| --- | --- | --- | --- | --- | --- |
| SPY | 120 | 84 | 2016-07-05 to 2023-06-07 | 36 | 2023-07-10 to 2026-06-12 |
| QQQ | 120 | 84 | 2016-07-05 to 2023-06-07 | 36 | 2023-07-10 to 2026-06-12 |
| AAPL | 120 | 84 | 2016-07-05 to 2023-06-07 | 36 | 2023-07-10 to 2026-06-12 |
| BTCUSDT | 155 | 108 | 2017-08-17 to 2023-10-12 | 47 | 2023-11-02 to 2026-06-25 |
| ETHUSDT | 155 | 108 | 2017-08-17 to 2023-10-12 | 47 | 2023-11-02 to 2026-06-25 |

## Performance By Mode

| Mode | Warning | Total Return | Monthly Return | Max Drawdown | Volatility | Sharpe-like | Profit Factor | Hit Rate | Avg Win | Avg Loss | Payoff Ratio | Expectancy | Active Days | Avg Allocation | Median Allocation | Max Allocation | % >= 0.10% | % >= 0.25% | % >= 0.50% | % >= 1.00% |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| production_current |  | 0.02% | 0.00% | -0.14% | 0.01% | 0.013 | 1.056 | 23.27% | 0.01% | -0.01% | 0.786 | 0.00% | 82 | 0.10% | 0.00% | 0.31% | 40.59% | 20.79% | 0.00% | 0.00% |
| floor_0_10 |  | 0.13% | 0.00% | -0.08% | 0.01% | 0.068 | 1.295 | 30.69% | 0.01% | -0.01% | 0.898 | 0.00% | 105 | 0.11% | 0.10% | 0.31% | 51.98% | 20.79% | 0.00% | 0.00% |
| floor_0_25 |  | 0.31% | 0.01% | -0.10% | 0.01% | 0.116 | 1.611 | 30.69% | 0.01% | -0.01% | 1.117 | 0.00% | 105 | 0.13% | 0.25% | 0.31% | 51.98% | 51.98% | 0.00% | 0.00% |
| floor_0_50 |  | 0.65% | 0.02% | -0.17% | 0.03% | 0.123 | 1.669 | 30.69% | 0.03% | -0.02% | 1.157 | 0.00% | 105 | 0.26% | 0.50% | 0.50% | 51.98% | 51.98% | 51.98% | 0.00% |
| floor_1_00 | Aggressive diagnostic only; not a production recommendation. | 1.29% | 0.04% | -0.35% | 0.05% | 0.123 | 1.669 | 30.69% | 0.05% | -0.04% | 1.157 | 0.01% | 105 | 0.52% | 1.00% | 1.00% | 51.98% | 51.98% | 51.98% | 51.98% |
| soft_validation_penalty |  | 0.04% | 0.00% | -0.12% | 0.01% | 0.021 | 1.081 | 29.70% | 0.01% | -0.01% | 0.955 | 0.00% | 113 | 0.11% | 0.06% | 0.31% | 40.59% | 20.79% | 0.00% | 0.00% |
| soft_ev_gate |  | 0.02% | 0.00% | -0.14% | 0.01% | 0.013 | 1.056 | 23.27% | 0.01% | -0.01% | 0.786 | 0.00% | 82 | 0.10% | 0.00% | 0.31% | 40.59% | 20.79% | 0.00% | 0.00% |
| final_zeroing_ablation | Unsafe for production unless proven otherwise; this bypasses final decision zeroing diagnostically. | 0.39% | 0.01% | -0.41% | 0.03% | 0.061 | 1.256 | 33.66% | 0.03% | -0.03% | 1.071 | 0.00% | 126 | 0.31% | 0.50% | 0.50% | 62.38% | 62.38% | 61.39% | 0.00% |

## Robustness Checks

This table shows whether a mode works broadly or only in one narrow split.

| Mode | Split | Count | Total Return | Avg Contribution | Hit Rate | Status |
| --- | --- | --- | --- | --- | --- | --- |
| production_current | first half | 101 | 0.09% | 0.00% | 42.57% | works |
| production_current | uptrend/other regime | 160 | 0.02% | 0.00% | 29.38% | works |
| production_current | SPY | 36 | 0.06% | 0.00% | 52.78% | works |
| production_current | High confidence | 97 | -0.04% | -0.00% | 37.11% | fails |
| production_current | EV 0% to 1% | 92 | 0.12% | 0.00% | 43.48% | works |
| production_current | Weak Evidence | 31 | -0.05% | -0.00% | 19.35% | fails |
| production_current | Medium confidence | 35 | 0.06% | 0.00% | 31.43% | works |
| production_current | Moderate Evidence | 89 | 0.04% | 0.00% | 43.82% | works |
| production_current | Low confidence | 70 | 0.00% | 0.00% | 0.00% | fails |
| production_current | QQQ | 36 | 0.08% | 0.00% | 52.78% | works |
| production_current | Strong Evidence | 3 | 0.03% | 0.01% | 66.67% | works |
| production_current | AAPL | 36 | -0.06% | -0.00% | 16.67% | fails |
| production_current | EV > 1% | 110 | -0.10% | -0.00% | 6.36% | fails |
| production_current | downtrend/risk-off regime | 42 | 0.00% | 0.00% | 0.00% | fails |
| production_current | Failed Evidence | 79 | 0.00% | 0.00% | 0.00% | fails |
| production_current | second half | 101 | -0.07% | -0.00% | 3.96% | fails |
| production_current | BTCUSDT | 47 | -0.05% | -0.00% | 6.38% | fails |
| production_current | ETHUSDT | 47 | 0.00% | 0.00% | 0.00% | fails |
| floor_0_10 | first half | 101 | 0.10% | 0.00% | 49.50% | works |
| floor_0_10 | uptrend/other regime | 160 | 0.13% | 0.00% | 38.75% | works |
| floor_0_10 | SPY | 36 | 0.06% | 0.00% | 61.11% | works |
| floor_0_10 | High confidence | 97 | 0.04% | 0.00% | 44.33% | works |
| floor_0_10 | EV 0% to 1% | 92 | 0.13% | 0.00% | 50.00% | works |
| floor_0_10 | Weak Evidence | 31 | 0.02% | 0.00% | 45.16% | works |
| floor_0_10 | Medium confidence | 35 | 0.09% | 0.00% | 48.57% | works |
| floor_0_10 | Moderate Evidence | 89 | 0.08% | 0.00% | 51.69% | works |
| floor_0_10 | Low confidence | 70 | 0.00% | 0.00% | 2.86% | works |
| floor_0_10 | QQQ | 36 | 0.09% | 0.00% | 61.11% | works |
| floor_0_10 | Strong Evidence | 3 | 0.03% | 0.01% | 66.67% | works |
| floor_0_10 | AAPL | 36 | -0.07% | -0.00% | 19.44% | fails |
| floor_0_10 | EV > 1% | 110 | 0.00% | 0.00% | 14.55% | works |
| floor_0_10 | downtrend/risk-off regime | 42 | 0.00% | 0.00% | 0.00% | fails |
| floor_0_10 | Failed Evidence | 79 | 0.00% | 0.00% | 0.00% | fails |
| floor_0_10 | second half | 101 | 0.03% | 0.00% | 11.88% | works |
| floor_0_10 | BTCUSDT | 47 | 0.05% | 0.00% | 23.40% | works |
| floor_0_10 | ETHUSDT | 47 | 0.00% | 0.00% | 0.00% | fails |
| floor_0_25 | first half | 101 | 0.13% | 0.00% | 49.50% | works |
| floor_0_25 | uptrend/other regime | 160 | 0.31% | 0.00% | 38.75% | works |
| floor_0_25 | SPY | 36 | 0.08% | 0.00% | 61.11% | works |
| floor_0_25 | High confidence | 97 | 0.15% | 0.00% | 44.33% | works |
| floor_0_25 | EV 0% to 1% | 92 | 0.16% | 0.00% | 50.00% | works |
| floor_0_25 | Weak Evidence | 31 | 0.12% | 0.00% | 45.16% | works |
| floor_0_25 | Medium confidence | 35 | 0.15% | 0.00% | 48.57% | works |
| floor_0_25 | Moderate Evidence | 89 | 0.16% | 0.00% | 51.69% | works |
| floor_0_25 | Low confidence | 70 | 0.01% | 0.00% | 2.86% | works |
| floor_0_25 | QQQ | 36 | 0.10% | 0.00% | 61.11% | works |
| floor_0_25 | Strong Evidence | 3 | 0.03% | 0.01% | 66.67% | works |
| floor_0_25 | AAPL | 36 | -0.08% | -0.00% | 19.44% | fails |
| floor_0_25 | EV > 1% | 110 | 0.15% | 0.00% | 14.55% | works |
| floor_0_25 | downtrend/risk-off regime | 42 | 0.00% | 0.00% | 0.00% | fails |
| floor_0_25 | Failed Evidence | 79 | 0.00% | 0.00% | 0.00% | fails |
| floor_0_25 | second half | 101 | 0.18% | 0.00% | 11.88% | works |
| floor_0_25 | BTCUSDT | 47 | 0.20% | 0.00% | 23.40% | works |
| floor_0_25 | ETHUSDT | 47 | 0.00% | 0.00% | 0.00% | fails |
| floor_0_50 | first half | 101 | 0.28% | 0.00% | 49.50% | works |
| floor_0_50 | uptrend/other regime | 160 | 0.65% | 0.00% | 38.75% | works |
| floor_0_50 | SPY | 36 | 0.17% | 0.00% | 61.11% | works |
| floor_0_50 | High confidence | 97 | 0.33% | 0.00% | 44.33% | works |
| floor_0_50 | EV 0% to 1% | 92 | 0.33% | 0.00% | 50.00% | works |
| floor_0_50 | Weak Evidence | 31 | 0.26% | 0.01% | 45.16% | works |
| floor_0_50 | Medium confidence | 35 | 0.30% | 0.01% | 48.57% | works |
| floor_0_50 | Moderate Evidence | 89 | 0.32% | 0.00% | 51.69% | works |
| floor_0_50 | Low confidence | 70 | 0.02% | 0.00% | 2.86% | works |
| floor_0_50 | QQQ | 36 | 0.21% | 0.01% | 61.11% | works |
| floor_0_50 | Strong Evidence | 3 | 0.06% | 0.02% | 66.67% | works |
| floor_0_50 | AAPL | 36 | -0.14% | -0.00% | 19.44% | fails |
| floor_0_50 | EV > 1% | 110 | 0.32% | 0.00% | 14.55% | works |
| floor_0_50 | downtrend/risk-off regime | 42 | 0.00% | 0.00% | 0.00% | fails |
| floor_0_50 | Failed Evidence | 79 | 0.00% | 0.00% | 0.00% | fails |
| floor_0_50 | second half | 101 | 0.37% | 0.00% | 11.88% | works |
| floor_0_50 | BTCUSDT | 47 | 0.40% | 0.01% | 23.40% | works |
| floor_0_50 | ETHUSDT | 47 | 0.00% | 0.00% | 0.00% | fails |
| floor_1_00 | first half | 101 | 0.56% | 0.01% | 49.50% | works |
| floor_1_00 | uptrend/other regime | 160 | 1.29% | 0.01% | 38.75% | works |
| floor_1_00 | SPY | 36 | 0.34% | 0.01% | 61.11% | works |
| floor_1_00 | High confidence | 97 | 0.65% | 0.01% | 44.33% | works |
| floor_1_00 | EV 0% to 1% | 92 | 0.66% | 0.01% | 50.00% | works |
| floor_1_00 | Weak Evidence | 31 | 0.52% | 0.02% | 45.16% | works |
| floor_1_00 | Medium confidence | 35 | 0.59% | 0.02% | 48.57% | works |
| floor_1_00 | Moderate Evidence | 89 | 0.65% | 0.01% | 51.69% | works |
| floor_1_00 | Low confidence | 70 | 0.05% | 0.00% | 2.86% | works |
| floor_1_00 | QQQ | 36 | 0.42% | 0.01% | 61.11% | works |
| floor_1_00 | Strong Evidence | 3 | 0.12% | 0.04% | 66.67% | works |
| floor_1_00 | AAPL | 36 | -0.28% | -0.01% | 19.44% | fails |
| floor_1_00 | EV > 1% | 110 | 0.63% | 0.01% | 14.55% | works |
| floor_1_00 | downtrend/risk-off regime | 42 | 0.00% | 0.00% | 0.00% | fails |
| floor_1_00 | Failed Evidence | 79 | 0.00% | 0.00% | 0.00% | fails |
| floor_1_00 | second half | 101 | 0.73% | 0.01% | 11.88% | works |
| floor_1_00 | BTCUSDT | 47 | 0.80% | 0.02% | 23.40% | works |
| floor_1_00 | ETHUSDT | 47 | 0.00% | 0.00% | 0.00% | fails |
| soft_validation_penalty | first half | 101 | 0.10% | 0.00% | 45.54% | works |
| soft_validation_penalty | uptrend/other regime | 160 | 0.04% | 0.00% | 37.50% | works |
| soft_validation_penalty | SPY | 36 | 0.06% | 0.00% | 52.78% | works |
| soft_validation_penalty | High confidence | 97 | -0.04% | -0.00% | 44.33% | fails |
| soft_validation_penalty | EV 0% to 1% | 92 | 0.14% | 0.00% | 48.91% | works |
| soft_validation_penalty | Weak Evidence | 31 | -0.05% | -0.00% | 19.35% | fails |
| soft_validation_penalty | Medium confidence | 35 | 0.06% | 0.00% | 42.86% | works |
| soft_validation_penalty | Moderate Evidence | 89 | 0.04% | 0.00% | 43.82% | works |
| soft_validation_penalty | Low confidence | 70 | 0.01% | 0.00% | 2.86% | works |
| soft_validation_penalty | QQQ | 36 | 0.08% | 0.00% | 52.78% | works |
| soft_validation_penalty | Strong Evidence | 3 | 0.03% | 0.01% | 66.67% | works |
| soft_validation_penalty | AAPL | 36 | -0.04% | -0.00% | 30.56% | fails |
| soft_validation_penalty | EV > 1% | 110 | -0.10% | -0.00% | 13.64% | fails |
| soft_validation_penalty | downtrend/risk-off regime | 42 | 0.00% | 0.00% | 0.00% | fails |
| soft_validation_penalty | Failed Evidence | 79 | 0.02% | 0.00% | 16.46% | works |
| soft_validation_penalty | second half | 101 | -0.06% | -0.00% | 13.86% | fails |
| soft_validation_penalty | BTCUSDT | 47 | -0.05% | -0.00% | 10.64% | fails |
| soft_validation_penalty | ETHUSDT | 47 | -0.00% | -0.00% | 12.77% | fails |
| soft_ev_gate | first half | 101 | 0.09% | 0.00% | 42.57% | works |
| soft_ev_gate | uptrend/other regime | 160 | 0.02% | 0.00% | 29.38% | works |
| soft_ev_gate | SPY | 36 | 0.06% | 0.00% | 52.78% | works |
| soft_ev_gate | High confidence | 97 | -0.04% | -0.00% | 37.11% | fails |
| soft_ev_gate | EV 0% to 1% | 92 | 0.12% | 0.00% | 43.48% | works |
| soft_ev_gate | Weak Evidence | 31 | -0.05% | -0.00% | 19.35% | fails |
| soft_ev_gate | Medium confidence | 35 | 0.06% | 0.00% | 31.43% | works |
| soft_ev_gate | Moderate Evidence | 89 | 0.04% | 0.00% | 43.82% | works |
| soft_ev_gate | Low confidence | 70 | 0.00% | 0.00% | 0.00% | fails |
| soft_ev_gate | QQQ | 36 | 0.08% | 0.00% | 52.78% | works |
| soft_ev_gate | Strong Evidence | 3 | 0.03% | 0.01% | 66.67% | works |
| soft_ev_gate | AAPL | 36 | -0.06% | -0.00% | 16.67% | fails |
| soft_ev_gate | EV > 1% | 110 | -0.10% | -0.00% | 6.36% | fails |
| soft_ev_gate | downtrend/risk-off regime | 42 | 0.00% | 0.00% | 0.00% | fails |
| soft_ev_gate | Failed Evidence | 79 | 0.00% | 0.00% | 0.00% | fails |
| soft_ev_gate | second half | 101 | -0.07% | -0.00% | 3.96% | fails |
| soft_ev_gate | BTCUSDT | 47 | -0.05% | -0.00% | 6.38% | fails |
| soft_ev_gate | ETHUSDT | 47 | 0.00% | 0.00% | 0.00% | fails |
| final_zeroing_ablation | first half | 101 | 0.37% | 0.00% | 52.48% | works |
| final_zeroing_ablation | uptrend/other regime | 160 | 0.39% | 0.00% | 42.50% | works |
| final_zeroing_ablation | SPY | 36 | 0.17% | 0.00% | 61.11% | works |
| final_zeroing_ablation | High confidence | 97 | -0.02% | -0.00% | 44.33% | fails |
| final_zeroing_ablation | EV 0% to 1% | 92 | 0.49% | 0.01% | 55.43% | works |
| final_zeroing_ablation | Weak Evidence | 31 | -0.11% | -0.00% | 22.58% | fails |
| final_zeroing_ablation | Medium confidence | 35 | 0.28% | 0.01% | 60.00% | works |
| final_zeroing_ablation | Moderate Evidence | 89 | 0.32% | 0.00% | 51.69% | works |
| final_zeroing_ablation | Low confidence | 70 | 0.13% | 0.00% | 5.71% | works |
| final_zeroing_ablation | QQQ | 36 | 0.21% | 0.01% | 61.11% | works |
| final_zeroing_ablation | Strong Evidence | 3 | 0.06% | 0.02% | 66.67% | works |
| final_zeroing_ablation | AAPL | 36 | 0.02% | 0.00% | 33.33% | works |
| final_zeroing_ablation | EV > 1% | 110 | -0.10% | -0.00% | 15.45% | fails |
| final_zeroing_ablation | downtrend/risk-off regime | 42 | 0.00% | 0.00% | 0.00% | fails |
| final_zeroing_ablation | Failed Evidence | 79 | 0.11% | 0.00% | 16.46% | works |
| final_zeroing_ablation | second half | 101 | 0.02% | 0.00% | 14.85% | works |
| final_zeroing_ablation | BTCUSDT | 47 | 0.04% | 0.00% | 12.77% | works |
| final_zeroing_ablation | ETHUSDT | 47 | -0.06% | -0.00% | 12.77% | fails |

## Cost And Slippage Sensitivity

Cost is modeled as return drag per unit allocation on each active shadow decision. Medium cost is the primary realistic-cost scenario.

| Mode | Cost Scenario | Total Return | Max Drawdown | Profit Factor | Avg Allocation | Cost Survival |
| --- | --- | --- | --- | --- | --- | --- |
| production_current | no cost | 0.10% | -0.12% | 1.281 | 0.10% | survives |
| production_current | low cost | 0.08% | -0.12% | 1.221 | 0.10% | survives |
| production_current | medium cost | 0.02% | -0.14% | 1.056 | 0.10% | survives |
| production_current | high cost | -0.06% | -0.17% | 0.866 | 0.10% | fails |
| floor_0_10 | no cost | 0.22% | -0.07% | 1.549 | 0.11% | survives |
| floor_0_10 | low cost | 0.20% | -0.07% | 1.481 | 0.11% | survives |
| floor_0_10 | medium cost | 0.13% | -0.08% | 1.295 | 0.11% | survives |
| floor_0_10 | high cost | 0.04% | -0.10% | 1.082 | 0.11% | survives |
| floor_0_25 | no cost | 0.42% | -0.08% | 1.904 | 0.13% | survives |
| floor_0_25 | low cost | 0.39% | -0.08% | 1.826 | 0.13% | survives |
| floor_0_25 | medium cost | 0.31% | -0.10% | 1.611 | 0.13% | survives |
| floor_0_25 | high cost | 0.20% | -0.12% | 1.364 | 0.13% | survives |
| floor_0_50 | no cost | 0.86% | -0.14% | 1.972 | 0.26% | survives |
| floor_0_50 | low cost | 0.80% | -0.15% | 1.891 | 0.26% | survives |
| floor_0_50 | medium cost | 0.65% | -0.17% | 1.669 | 0.26% | survives |
| floor_0_50 | high cost | 0.44% | -0.21% | 1.414 | 0.26% | survives |
| floor_1_00 | no cost | 1.71% | -0.29% | 1.972 | 0.52% | survives |
| floor_1_00 | low cost | 1.61% | -0.30% | 1.891 | 0.52% | survives |
| floor_1_00 | medium cost | 1.29% | -0.35% | 1.669 | 0.52% | survives |
| floor_1_00 | high cost | 0.87% | -0.42% | 1.414 | 0.52% | survives |
| soft_validation_penalty | no cost | 0.13% | -0.10% | 1.290 | 0.11% | survives |
| soft_validation_penalty | low cost | 0.11% | -0.10% | 1.234 | 0.11% | survives |
| soft_validation_penalty | medium cost | 0.04% | -0.12% | 1.081 | 0.11% | survives |
| soft_validation_penalty | high cost | -0.05% | -0.15% | 0.904 | 0.11% | fails |
| soft_ev_gate | no cost | 0.10% | -0.12% | 1.281 | 0.10% | survives |
| soft_ev_gate | low cost | 0.08% | -0.12% | 1.221 | 0.10% | survives |
| soft_ev_gate | medium cost | 0.02% | -0.14% | 1.056 | 0.10% | survives |
| soft_ev_gate | high cost | -0.06% | -0.17% | 0.866 | 0.10% | fails |
| final_zeroing_ablation | no cost | 0.64% | -0.38% | 1.458 | 0.31% | survives |
| final_zeroing_ablation | low cost | 0.57% | -0.39% | 1.405 | 0.31% | survives |
| final_zeroing_ablation | medium cost | 0.39% | -0.41% | 1.256 | 0.31% | survives |
| final_zeroing_ablation | high cost | 0.13% | -0.44% | 1.082 | 0.31% | survives |

## Drawdown Safety

Research threshold: any mode breaching -5% max drawdown fails the drawdown safety threshold.

| Mode | Worst Single Decision Loss | Worst 3-Decision Sequence | Worst 5-Decision Sequence | Max Drawdown | Underwater Periods | 5% Threshold |
| --- | --- | --- | --- | --- | --- | --- |
| production_current | -0.03% | -0.05% | -0.07% | -0.14% | 182 | passes |
| floor_0_10 | -0.03% | -0.05% | -0.07% | -0.08% | 180 | passes |
| floor_0_25 | -0.03% | -0.05% | -0.07% | -0.10% | 171 | passes |
| floor_0_50 | -0.06% | -0.10% | -0.13% | -0.17% | 170 | passes |
| floor_1_00 | -0.13% | -0.20% | -0.26% | -0.35% | 170 | passes |
| soft_validation_penalty | -0.03% | -0.05% | -0.07% | -0.12% | 182 | passes |
| soft_ev_gate | -0.03% | -0.05% | -0.07% | -0.14% | 182 | passes |
| final_zeroing_ablation | -0.10% | -0.16% | -0.17% | -0.41% | 157 | passes |

## Leakage And Realism Checks

| Mode | Lookahead Risk | Same-Period Leakage Risk | Next Returns Unavailable At Decision | Future Indicator Use | Costs Included | Fill Assumption Risk | Outlier Risk | Outlier Dependence | Top Two Positive Contribution Share |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| production_current | low | low | yes | not detected | yes | medium | low | not concentrated | 15.89% |
| floor_0_10 | low | low | yes | not detected | yes | medium | low | not concentrated | 11.92% |
| floor_0_25 | low | low | yes | not detected | yes | medium | low | not concentrated | 17.68% |
| floor_0_50 | low | low | yes | not detected | yes | medium | low | not concentrated | 17.93% |
| floor_1_00 | low | low | yes | not detected | yes | medium | low | not concentrated | 17.93% |
| soft_validation_penalty | low | low | yes | not detected | yes | medium | low | not concentrated | 13.04% |
| soft_ev_gate | low | low | yes | not detected | yes | medium | low | not concentrated | 15.89% |
| final_zeroing_ablation | low | low | yes | not detected | yes | medium | low | not concentrated | 17.01% |

Notes:

- Next-period returns are measured after the decision date and are not available to the decision engine.
- The production analyzer receives only candles available up to each decision date.
- This still does not prove live fill quality. Spread, partial fills, outages, and market impact remain real-world risks.
- If performance disappears after costs or in the second half of the holdout, production allocation should remain unchanged.
- If one or two decisions dominate gains, the edge is fragile.

## Recommendation

Verdict: Continue paper-only with 0.10% shadow floor.

ATC should remain paper-only. Production allocation should remain unchanged. The safest next step is to continue the selected shadow mode, if any, in paper-only forward tracking and require another untouched holdout window before any production sizing change is considered.
