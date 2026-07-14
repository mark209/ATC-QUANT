# BTCUSDT Pipeline Audit

Replay: crypto-audit-btcusdt-long-v1
Dataset: binance-btcusdt-1d-crypto-long-horizon-v1
Verification: PASS

## Pipeline Funnel
| Stage | Count |
|---|---:|
| total_candles | 3253 |
| warmup_excluded | 60 |
| signal_generated | 3117 |
| signal_rejected | 1432 |
| evidence_passed | 4 |
| evidence_rejected | 1761 |
| risk_passed | 4 |
| risk_rejected | 3113 |
| ev_evaluated | 4 |
| ev_rejected | 0 |
| kelly_evaluated | 4 |
| kelly_rejected | 0 |
| proposals_created | 3117 |
| proposals_rejected | 3113 |
| orders_created | 4 |
| orders_rejected | 0 |
| orders_executed | 4 |
| orders_cancelled | 0 |
| positions_opened | 4 |
| positions_closed | 4 |
| completed_trades | 4 |

## Rule Attribution
| Rule | Rejections | % opportunities | % surviving | Avg confidence | Common market regime | Common volatility regime |
|---|---:|---:|---:|---:|---|---|
| Expected value | 1744 | 54.62% | 120.36% | 73.11 | mean reverting | 0.9446874657895049 |
| Trend | 1425 | 44.63% | 80.60% | 16.70 | mean reverting | 1.0180204353109061 |
| Volatility regime | 14 | 0.44% | 0.44% | 51.00 | mean reverting | 1.0220220157581277 |
| Momentum | 7 | 0.22% | 0.22% | 42.00 | mean reverting | 0.8226134736204618 |
| Trend / momentum | 3 | 0.09% | 0.09% | 51.00 | mean reverting | 0.9554497845530755 |

## Filter Waterfall
| Stage | Count | Retained | Loss from previous |
|---|---:|---:|---:|
| 100% candles | 3253 | 100.00% | 0 |
| Signal | 1761 | 54.13% | 1492 |
| Evidence | 0 | 0.00% | 1761 |
| Risk | 4 | 0.12% | -4 |
| EV | 4 | 0.12% | 0 |
| Kelly | 4 | 0.12% | 0 |
| Proposal | 3117 | 95.82% | -3113 |
| Execution | 4 | 0.12% | 3113 |
| Completed trade | 4 | 0.12% | 0 |

## Opportunity Density
| Metric | Count | Per 100 candles |
|---|---:|---:|
| signals | 1761 | 54.1346 |
| proposals | 4 | 0.1230 |
| executions | 4 | 0.1230 |
| completed trades | 4 | 0.1230 |

## Trade Concentration
Largest trade: 7616.61
Top 3 contribution: 290.64%
Top 5 contribution: 290.64%
Largest profit share: 100.00%
Gini coefficient: 0.674288

## Dataset Audit
every_candle_once: true
no_candles_skipped: true
duplicate_candles: 0
chronological: true
replay_start: 2017-08-17T00:00:00.000Z
replay_end: 2026-07-13T00:00:00.000Z
warmup_boundary: 0-59
indicator_initialization: analysis begins at candle 60
coverage_start: 2017-08-17T00:00:00.000Z
coverage_end: 2026-07-13T00:00:00.000Z
trace_count: 3253

## Replay Accounting
proposal_count: 3117
terminal_proposal_count: 3117
proposals_without_terminal: 0
orphan_proposals: 0
orphan_executions: 0
orphan_lifecycle_events: 0
missing_closes: 0
duplicate_closes: 0
execution_count: 4
cancelled_orders: 0
positions_opened: 4
positions_closed: 4
completed_trade_lineages: 4
lifecycle_without_execution_expected_rejections: 3113

## Reconciliation
- Trace proposal count 0 differs from lifecycle proposal count 3117.
- Trace signal count 1761 differs from lifecycle SIGNAL_GENERATED count 3117.

## Findings
- Trace proposal count 0 differs from lifecycle proposal count 3117.
- Trace signal count 1761 differs from lifecycle SIGNAL_GENERATED count 3117.

## Conclusion
LOW TRADE COUNT IS CONSISTENT WITH A SELECTIVE PIPELINE; no strategy conclusion should be made until trace and lifecycle funnels reconcile.
