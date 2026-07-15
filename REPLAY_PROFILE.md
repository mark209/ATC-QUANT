# Replay Performance Profile

## Optimization
reuse replay decision analyses while generating diagnostics and cache exact moving-average reductions across prefix backtests

## Benchmark Results
| Source dataset | Candles | Runtime (ms) | Peak RSS (MB) | Decisions | Completed trades | Verification |
|---|---:|---:|---:|---:|---:|---|
| equities-spy-1d-yahoo-v1 | 1000 | 9914.36 | 294.00 | 940 | 0 | NOT_RUN |
| equities-spy-1d-yahoo-v1 | 5000 | 210571.43 | 778.83 | 4940 | 0 | NOT_RUN |
| equities-msft-1d-yahoo-v1 | 10000 | 956678.48 | 1241.64 | 9940 | 6 | NOT_RUN |

## Before / After
Production replay fixture before: 35683 ms
Production replay fixture after: 3643 ms in the targeted replay artifact test
Deterministic verification fixture before: 39317 ms
Verification after optimization: PASS in the targeted integration suite.

## Phase Attribution
- **dataset_loading**: Measured by benchmark setup; included in dataset preparation, not runner runtime.
- **signal_calculation**: Included in deterministic decision analysis; the current scoring API does not expose separate stage timers.
- **evidence**: Included in deterministic decision analysis; the current scoring API does not expose separate stage timers.
- **risk**: Included in deterministic decision analysis; the current scoring API does not expose separate stage timers.
- **expected_value**: Included in deterministic decision analysis; the current scoring API does not expose separate stage timers.
- **kelly**: Included in deterministic decision analysis; the current scoring API does not expose separate stage timers.
- **execution**: Included in runner runtime; execution is only entered for eligible proposals.
- **lifecycle**: Included in runner runtime; lifecycle is only entered for proposals and closes.
- **journal_writing**: Excluded from benchmark runtime because bundles are not persisted.
- **hashing**: Included in runner runtime; hashes are deterministic and covered by verification.
- **replay_verification**: Run separately by verification integration tests.
- **diagnostics**: Included in runner runtime; diagnostics now consumes the replay analyses instead of recomputing them.
- **statistics**: Not part of replay runtime; generated after replay from persisted artifacts.

## Determinism
Benchmark bundles are not persisted; production artifact equivalence is validated by replay verification tests.
Trade, execution, lifecycle, analytics, and artifact hashes remain covered by the existing deterministic replay verification tests.

## Limitations
The scale benchmark is intentionally run on frozen real equity candles. No synthetic market data is generated.
