# ETHUSDT Pipeline Audit

Replay: crypto-audit-ethusdt-long-v1
Dataset: binance-ethusdt-1d-crypto-long-horizon-v1
Verification: PASS

## Pipeline Funnel
| Stage | Count |
|---|---:|
| total_candles | 3253 |
| warmup_excluded | 60 |
| signal_generated | 3116 |
| signal_rejected | 1578 |
| evidence_passed | 6 |
| evidence_rejected | 1615 |
| risk_passed | 6 |
| risk_rejected | 3110 |
| ev_evaluated | 6 |
| ev_rejected | 0 |
| kelly_evaluated | 6 |
| kelly_rejected | 0 |
| proposals_created | 3116 |
| proposals_rejected | 3110 |
| orders_created | 6 |
| orders_rejected | 0 |
| orders_executed | 6 |
| orders_cancelled | 0 |
| positions_opened | 6 |
| positions_closed | 6 |
| completed_trades | 6 |

## Rule Attribution
| Rule | Rejections | % opportunities | % surviving | Avg confidence | Common market regime | Common volatility regime |
|---|---:|---:|---:|---:|---|---|
| Expected value | 1609 | 50.39% | 101.58% | 69.11 | mean reverting | 1.1008430089904737 |
| Trend | 1577 | 49.39% | 97.59% | 15.26 | mean reverting | 1.2636072490499202 |
| Volatility regime | 5 | 0.16% | 0.16% | 51.00 | mean reverting | 1.1985147262050693 |
| Trend / momentum | 1 | 0.03% | 0.03% | 51.00 | mean reverting | 1.2005765013469707 |
| Momentum | 1 | 0.03% | 0.03% | 44.00 | mean reverting | 1.0807572116752788 |

## Filter Waterfall
| Stage | Count | Retained | Loss from previous |
|---|---:|---:|---:|
| 100% candles | 3253 | 100.00% | 0 |
| Signal | 1615 | 49.65% | 1638 |
| Evidence | 0 | 0.00% | 1615 |
| Risk | 6 | 0.18% | -6 |
| EV | 6 | 0.18% | 0 |
| Kelly | 6 | 0.18% | 0 |
| Proposal | 3116 | 95.79% | -3110 |
| Execution | 6 | 0.18% | 3110 |
| Completed trade | 6 | 0.18% | 0 |

## Opportunity Density
| Metric | Count | Per 100 candles |
|---|---:|---:|
| signals | 1615 | 49.6465 |
| proposals | 6 | 0.1844 |
| executions | 6 | 0.1844 |
| completed trades | 6 | 0.1844 |

## Trade Concentration
Largest trade: 686.99
Top 3 contribution: 209.19%
Top 5 contribution: 209.19%
Largest profit share: 100.00%
Gini coefficient: 0.607953

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
proposal_count: 3116
terminal_proposal_count: 3116
proposals_without_terminal: 0
orphan_proposals: 0
orphan_executions: 0
orphan_lifecycle_events: 0
missing_closes: 0
duplicate_closes: 0
execution_count: 6
cancelled_orders: 0
positions_opened: 6
positions_closed: 6
completed_trade_lineages: 6
lifecycle_without_execution_expected_rejections: 3110

## Reconciliation
- Trace proposal count 0 differs from lifecycle proposal count 3116.
- Trace signal count 1615 differs from lifecycle SIGNAL_GENERATED count 3116.

## Findings
- Trace proposal count 0 differs from lifecycle proposal count 3116.
- Trace signal count 1615 differs from lifecycle SIGNAL_GENERATED count 3116.

## Conclusion
LOW TRADE COUNT IS CONSISTENT WITH A SELECTIVE PIPELINE; no strategy conclusion should be made until trace and lifecycle funnels reconcile.
