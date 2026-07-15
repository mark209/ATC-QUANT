# MASTER PIPELINE AUDIT

Generated: 2026-07-14T02:23:40.840Z

| Asset | Candles | Signals | Proposals | Executions | Completed trades | Verification |
|---|---:|---:|---:|---:|---:|---|
| BTCUSDT | 3253 | 3117 | 3117 | 4 | 4 | PASS |
| ETHUSDT | 3253 | 3116 | 3116 | 6 | 6 | PASS |
| BNBUSDT | 3172 | 3101 | 3101 | 3 | 3 | PASS |

## Master Answers
- BTC produced four completed trades because only four lifecycle proposals reached risk validation and execution in the observed replay.
- The low count is not yet fully attributable to intended selectivity because the trace and lifecycle funnels disagree materially.
- Replay verification passes after correcting lifecycle entry timestamps to use the candle decision timestamp.
- The largest observed loss occurs before risk validation, but the current diagnostic trace does not expose a matching proposal-level rule for every lifecycle rejection.
- No strategy optimization was performed; resolve the trace/lifecycle reconciliation before expanding to equities research.

Most restrictive observed count: risk_rejected
