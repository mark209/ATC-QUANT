# ATC Forward Evidence Accumulation Report

## Executive Summary

This is a paper-only forward evidence accumulation system. It does not add live trading, does not connect to broker APIs, does not change production allocation, and does not promote any shadow mode to production.

- Journal path: data/forward-evidence-journal.jsonl
- Frozen policy manifest: data/frozen-shadow-policy-manifest.json
- Frozen policy: frozen_floor_0_10 (2026-07-06.floor_0_10.v1)
- Production status: paper-only
- Production promotion status: not approved
- Attempted rows this run: 0
- Appended rows this run: 0
- Skipped duplicate rows this run: 0
- Invalid rows this run: 0
- Pending outcome rows: 0
- Evaluation-ready rows: 0
- Enough evidence exists: no
- Final verdict: Inconclusive; sample too small.

## Journal Status

The journal is append-only. Historical shadow rows must not be regenerated with changed parameters. Pending rows are not evaluated as zero-return trades.

| Metric | Value |
| --- | --- |
| Existing rows before update | 0 |
| Attempted rows | 0 |
| Appended rows | 0 |
| Skipped duplicate rows | 0 |
| Invalid rows | 0 |
| Total journal rows | 0 |
| Pending outcome rows | 0 |
| Outcome attached rows | 0 |
| Evaluation-ready rows | 0 |

## Frozen Policy Status

| Field | Value |
| --- | --- |
| Policy name | frozen_floor_0_10 |
| Allocation floor | 0.10% |
| Date frozen | 2026-07-06 |
| Source report | ATC_SHADOW_ALLOCATION_EXPERIMENT_REPORT.md |
| Production status | paper-only |
| Promotion status | not approved |
| Rule summary | Apply a 0.10% paper-only shadow allocation floor only when the existing strict shadow safety gates pass. This does not alter production allocation. |

## Candidate Row Scan

Rows at or before the prior untouched-forward cutoffs are excluded and are not reused as new forward evidence.

| Asset | Prior Cutoff | Decision Rows Scanned | Post-Cutoff Candidate Rows |
| --- | --- | --- | --- |
| SPY | 2026-06-12 | 120 | 0 |
| QQQ | 2026-06-12 | 120 | 0 |
| AAPL | 2026-06-12 | 120 | 0 |
| BTCUSDT | 2026-06-25 | 155 | 0 |
| ETHUSDT | 2026-06-25 | 155 | 0 |

## Sample Size Status

Minimum thresholds:

- Minimum 100 new decision rows for a preliminary read.
- Minimum 250 new decision rows for weak evidence.
- Minimum 500 new decision rows for stronger evidence.
- Minimum 30 active shadow decisions before judging performance.
- Minimum 3 assets contributing before claiming broad robustness.
- Minimum 2 regimes represented before claiming regime robustness.

| Threshold | Current | Required | Met |
| --- | --- | --- | --- |
| Preliminary rows | 0 | 100 | no |
| Weak evidence rows | 0 | 250 | no |
| Stronger evidence rows | 0 | 500 | no |
| Active shadow decisions | 0 | 30 | no |
| Contributing assets | 0 | 3 | no |
| Represented regimes | 0 | 2 | no |

## Production Vs Shadow Comparison

If evaluation-ready rows are below threshold, these metrics are not sufficient evidence for production decisions.

| Mode | Total Return | Hit Rate | Profit Factor | Expectancy | Max Drawdown | Worst 5-Decision Sequence | Active Rows | Average Allocation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| production_current | 0.00% | 0.00% | 0.000 | 0.00% | 0.00% | 0.00% | 0 | 0.00% |
| frozen_floor_0_10 | 0.00% | 0.00% | 0.000 | 0.00% | 0.00% | 0.00% | 0 | 0.00% |

## Pass/Fail Gate

| Gate | Result | Value |
| --- | --- | --- |
| mediumCostTotalReturnPositive | fail | 0.00% |
| profitFactorAboveOneTen | fail | 0.00% |
| expectancyPositiveAfterCosts | fail | 0.00% |
| maxDrawdownBelowFivePercent | pass | 0.00% |
| noSingleTradeAboveHalfProfit | pass | 0.00% |
| noSingleAssetAboveEightyPercentProfit | pass | 0.00% |
| riskOffDowntrendLossesAcceptable | pass | 0.00% |

## Asset Breakdown

| Asset | Rows | Active Rows | Total Return | Hit Rate | Profit Factor | Expectancy | Max Drawdown |
| --- | --- | --- | --- | --- | --- | --- | --- |

## Regime Breakdown

| Regime | Rows | Active Rows | Total Return | Hit Rate | Profit Factor | Expectancy | Max Drawdown |
| --- | --- | --- | --- | --- | --- | --- | --- |

## Cost Sensitivity

Cost sensitivity is reported only as paper-only evidence and is not a production sizing recommendation.

| Cost Model | Total Return | Profit Factor | Expectancy | Max Drawdown | Status |
| --- | --- | --- | --- | --- | --- |
| no cost | 0.00% | 0.000 | 0.00% | 0.00% | fails |
| low cost | 0.00% | 0.000 | 0.00% | 0.00% | fails |
| medium cost | 0.00% | 0.000 | 0.00% | 0.00% | fails |
| high cost | 0.00% | 0.000 | 0.00% | 0.00% | fails |

## Outlier Dependency

| Metric | Value |
| --- | --- |
| Top single trade contribution share | 0.00% |
| Top single asset contribution share | 0.00% |
| Fragile | no |

## Final Answers

- ATC remains paper-only: yes.
- Production allocation remains unchanged: yes.
- floor_0_10 remains shadow-only: yes.
- floor_1_00 remains diagnostic-only: yes.
- Enough evidence exists to judge floor_0_10: no.
- The system should collect fresh forward rows before further conclusions: yes.

## Final Verdict

Inconclusive; sample too small.
