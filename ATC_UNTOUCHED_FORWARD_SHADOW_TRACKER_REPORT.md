# ATC Untouched Forward Shadow Tracker Report

## Executive Summary

This is a frozen paper-only shadow policy, not a production allocation change.

- Frozen policy: floor_0_10.
- Allocation floor: 0.10% only when the existing strict shadow safety gates pass.
- Production allocation remains unchanged.
- No optimization was run on this forward tracking window.
- New untouched decision rows: 0.
- Date range: n/a.
- Assets included: none.
- Assets excluded: AAPL, BTCUSDT, ETHUSDT, QQQ, SPY.
- Sample assessment: preliminary.
- Sample large enough to judge: no.
- Medium-cost edge survived: no.
- Outlier dependency: not concentrated.
- Asset-level failures: none.
- Regime-level failures: none.
- Final verdict: Inconclusive; sample too small.

## Frozen Policy Guardrails

This tracker freezes the previously recommended paper-only policy. It does not promote floor_0_10 into production, does not promote floor_1_00, does not connect to broker APIs, and does not place trades.

## Untouched Forward Window

The previous shadow experiment used selection and holdout rows through the cutoffs below. This tracker excludes those rows and only evaluates later rows when available.

| Symbol | Previous Forward Cutoff | All Decision Rows | New Untouched Rows | First New Row | Last New Row |
| --- | --- | --- | --- | --- | --- |
| SPY | 2026-06-12 | 120 | 0 | n/a | n/a |
| QQQ | 2026-06-12 | 120 | 0 | n/a | n/a |
| AAPL | 2026-06-12 | 120 | 0 | n/a | n/a |
| BTCUSDT | 2026-06-25 | 155 | 0 | n/a | n/a |
| ETHUSDT | 2026-06-25 | 155 | 0 | n/a | n/a |

## Production Vs Frozen Shadow

| Mode | Total Return | Monthly Return | Max Drawdown | Volatility | Hit Rate | Profit Factor | Avg Win | Avg Loss | Payoff Ratio | Expectancy | Active Days | Avg Allocation | Median Allocation | Max Allocation | % >= 0.10% | % >= 0.25% | % >= 0.50% | % >= 1.00% |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| production_current | 0.00% | 0.00% | 0.00% | 0.00% | 0.00% | 0.000 | 0.00% | 0.00% | 0.000 | 0.00% | 0 | 0.00% | 0.00% | 0.00% | 0.00% | 0.00% | 0.00% | 0.00% |
| frozen_floor_0_10 | 0.00% | 0.00% | 0.00% | 0.00% | 0.00% | 0.000 | 0.00% | 0.00% | 0.000 | 0.00% | 0 | 0.00% | 0.00% | 0.00% | 0.00% | 0.00% | 0.00% | 0.00% |

## Forward Survival Criteria

These pass/fail criteria are defined before interpreting the untouched result.

| Criterion | Result | Rule |
| --- | --- | --- |
| positiveAfterMediumCosts | fail | Total return must remain positive after medium costs. |
| maxDrawdownBelowFivePercent | pass | Max drawdown must stay below 5%. |
| profitFactorAboveOneTen | fail | Profit factor must remain above 1.10. |
| positiveExpectancyAfterCosts | fail | Expectancy must remain positive after costs. |
| notOutlierDependent | pass | Result must not rely on one or a few outlier trades. |
| notSingleAssetDependent | pass | No single asset may contribute more than 80% of positive profit. |
| riskOffDowntrendAcceptable | pass | Risk-off and downtrend splits must not create material losses. |

## Paper-Only Kill Switches

| Kill Switch | Status |
| --- | --- |
| maxDrawdownExceeded | clear |
| mediumCostReturnNegative | clear |
| profitFactorBelowOne | clear |
| expectancyNegative | clear |
| worstFiveDecisionSequenceExceeded | clear |
| oneAssetProfitConcentrationExceeded | clear |
| oneTradeContributionExceeded | clear |
| riskOffDowntrendMateriallyHarmful | clear |

## Asset-Level Diagnosis

| Asset | Total Return | Active Rows | Hit Rate | Profit Factor | Expectancy | Max Drawdown | Worst Decision | Eligible | Flags |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

## Regime-Level Diagnosis

| Regime | Total Return | Rows | Active Rows | Hit Rate | Profit Factor | Expectancy | Max Drawdown | Shadow Action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| normal/uptrend | 0.00% | 0 | 0 | 0.00% | 0.000 | 0.00% | 0.00% | disabled |
| downtrend | 0.00% | 0 | 0 | 0.00% | 0.000 | 0.00% | 0.00% | disabled |
| risk-off | 0.00% | 0 | 0 | 0.00% | 0.000 | 0.00% | 0.00% | disabled |
| unknown | 0.00% | 0 | 0 | 0.00% | 0.000 | 0.00% | 0.00% | disabled |

## Evidence-Grade Diagnosis

| Evidence Status | Total Return | Rows | Active Rows | Hit Rate | Profit Factor | Expectancy | Max Drawdown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| passed validation | 0.00% | 0 | 0 | 0.00% | 0.000 | 0.00% | 0.00% |
| failed validation | 0.00% | 0 | 0 | 0.00% | 0.000 | 0.00% | 0.00% |
| no evidence | 0.00% | 0 | 0 | 0.00% | 0.000 | 0.00% | 0.00% |
| weak evidence | 0.00% | 0 | 0 | 0.00% | 0.000 | 0.00% | 0.00% |
| strong evidence | 0.00% | 0 | 0 | 0.00% | 0.000 | 0.00% | 0.00% |

- Should failed-evidence rows remain blocked? inconclusive
- Should no-evidence rows remain blocked? inconclusive
- Should soft validation still be researched? inconclusive

## Cost Sensitivity

| Cost Scenario | Total Return | Max Drawdown | Profit Factor | Expectancy | Average Allocation | Edge Survival |
| --- | --- | --- | --- | --- | --- | --- |
| no cost | 0.00% | 0.00% | 0.000 | 0.00% | 0.00% | fails |
| low cost | 0.00% | 0.00% | 0.000 | 0.00% | 0.00% | fails |
| medium cost | 0.00% | 0.00% | 0.000 | 0.00% | 0.00% | fails |
| high cost | 0.00% | 0.00% | 0.000 | 0.00% | 0.00% | fails |

## Outlier Dependency

| Metric | Value |
| --- | --- |
| Top 1 trade contribution to total profit | 0.00% |
| Top 3 trade contribution to total profit | 0.00% |
| Top 5 trade contribution to total profit | 0.00% |
| Profit without best trade | 0.00% |
| Profit without best 3 trades | 0.00% |
| Profit without best 5 trades | 0.00% |
| Outlier dependency | not concentrated |

## Final Answers

- Should ATC remain paper-only? yes
- Should production allocation remain unchanged? yes
- Is floor_0_10 ready for production? no
- Is floor_1_00 ready for production? no
- Next safest paper-only action: Keep production unchanged and collect more untouched paper-only forward rows.

## Final Verdict

Inconclusive; sample too small.
