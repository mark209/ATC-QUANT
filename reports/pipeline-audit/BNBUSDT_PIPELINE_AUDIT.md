# BNBUSDT Pipeline Audit

Replay: crypto-audit-bnbusdt-long-v1
Dataset: binance-bnbusdt-1d-crypto-long-horizon-v1
Verification: PASS

## Pipeline Funnel
| Stage | Count |
|---|---:|
| total_candles | 3172 |
| warmup_excluded | 60 |
| signal_generated | 3101 |
| signal_rejected | 1385 |
| evidence_passed | 3 |
| evidence_rejected | 1727 |
| risk_passed | 3 |
| risk_rejected | 3098 |
| ev_evaluated | 3 |
| ev_rejected | 0 |
| kelly_evaluated | 3 |
| kelly_rejected | 0 |
| proposals_created | 3101 |
| proposals_rejected | 3098 |
| orders_created | 3 |
| orders_rejected | 0 |
| orders_executed | 3 |
| orders_cancelled | 0 |
| positions_opened | 3 |
| positions_closed | 3 |
| completed_trades | 3 |

## Rule Attribution
| Rule | Rejections | % opportunities | % surviving | Avg confidence | Common market regime | Common volatility regime |
|---|---:|---:|---:|---:|---|---|
| Expected value | 1619 | 52.02% | 108.44% | 70.35 | mean reverting | 1.443751658850481 |
| Trend | 1369 | 43.99% | 78.54% | 18.52 | mean reverting | 1.9752450245494482 |
| Trend / momentum | 59 | 1.90% | 1.93% | 56.03 | mean reverting | 1.9445225002388387 |
| Volatility regime | 49 | 1.57% | 1.60% | 64.76 | mean reverting | 2.222579495565633 |
| Momentum | 16 | 0.51% | 0.52% | 41.69 | mean reverting | 1.8992896564766388 |

## Filter Waterfall
| Stage | Count | Retained | Loss from previous |
|---|---:|---:|---:|
| 100% candles | 3172 | 100.00% | 0 |
| Signal | 1727 | 54.45% | 1445 |
| Evidence | 0 | 0.00% | 1727 |
| Risk | 3 | 0.09% | -3 |
| EV | 3 | 0.09% | 0 |
| Kelly | 3 | 0.09% | 0 |
| Proposal | 3101 | 97.76% | -3098 |
| Execution | 3 | 0.09% | 3098 |
| Completed trade | 3 | 0.09% | 0 |

## Opportunity Density
| Metric | Count | Per 100 candles |
|---|---:|---:|
| signals | 1727 | 54.4451 |
| proposals | 3 | 0.0946 |
| executions | 3 | 0.0946 |
| completed trades | 3 | 0.0946 |

## Trade Concentration
Largest trade: 377.45
Top 3 contribution: 257.65%
Top 5 contribution: 257.65%
Largest profit share: 100.00%
Gini coefficient: 0.605693

## Dataset Audit
every_candle_once: true
no_candles_skipped: true
duplicate_candles: 0
chronological: true
replay_start: 2017-11-06T00:00:00.000Z
replay_end: 2026-07-13T00:00:00.000Z
warmup_boundary: 0-59
indicator_initialization: analysis begins at candle 60
coverage_start: 2017-11-06T00:00:00.000Z
coverage_end: 2026-07-13T00:00:00.000Z
trace_count: 3172

## Replay Accounting
proposal_count: 3101
terminal_proposal_count: 3101
proposals_without_terminal: 0
orphan_proposals: 0
orphan_executions: 0
orphan_lifecycle_events: 0
missing_closes: 0
duplicate_closes: 0
execution_count: 3
cancelled_orders: 0
positions_opened: 3
positions_closed: 3
completed_trade_lineages: 3
lifecycle_without_execution_expected_rejections: 3098

## Reconciliation
- Trace proposal count 0 differs from lifecycle proposal count 3101.
- Trace signal count 1727 differs from lifecycle SIGNAL_GENERATED count 3101.

## Findings
- Trace proposal count 0 differs from lifecycle proposal count 3101.
- Trace signal count 1727 differs from lifecycle SIGNAL_GENERATED count 3101.

## Conclusion
LOW TRADE COUNT IS CONSISTENT WITH A SELECTIVE PIPELINE; no strategy conclusion should be made until trace and lifecycle funnels reconcile.
