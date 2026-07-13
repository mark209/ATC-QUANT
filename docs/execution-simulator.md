# Paper Execution Simulator

Phase 2B adds deterministic execution mechanics between trade proposals and the Phase 2A lifecycle engine. It does not call or modify the signal, evidence, risk, decision, sizing, or backtest modules.

## Components

- `src/lib/trading/executionSimulator.ts`: order, fill, spread, slippage, latency, rejection, and OHLC gap simulation.
- `src/lib/trading/executionEvent.ts`: immutable execution event model, runtime validation, and event hashing.
- `src/lib/trading/executionEventRepository.ts`: append/read repository contract.
- `src/lib/trading/executionEventRepositoryFile.ts`: append-only JSONL execution journal.
- `src/lib/trading/executionLifecycleBridge.ts`: passes explicit simulator fills/cancellations to the existing lifecycle engine.
- `src/lib/trading/executionReport.ts`: execution cost and event summaries.

## Determinism

The simulator derives all seeded choices and event IDs from `replay_id`, `dataset_version`, `strategy_version`, `execution_profile`, `random_seed`, order identity, and event sequence. The same immutable candles and configuration produce the same event payloads, actual prices, fill quantities, timestamps, and SHA-256 event hashes.

## Profiles and assumptions

Execution assumptions are configuration data in `EXECUTION_PROFILES`: `ideal`, `normal`, `high_volatility`, `low_liquidity`, and `stress_test`. Each profile defines spread, slippage, latency, fill schedule, minimum quote volume, and stop-limit policy.

Supported spread models are fixed, percentage, volatility-adjusted, and liquidity-adjusted. Supported slippage models are fixed, percentage, volatility-based, liquidity-based, and seeded-random. Latency is fixed or replay-seeded random.

## Conservative OHLC behavior

- Market orders use the first eligible candle open.
- Limit orders fill at the open on a gap beyond the limit, otherwise at the limit when touched.
- Stop orders fill at the open on a gap beyond the stop, otherwise at the stop when touched.
- Stop-limit orders require both trigger and executable limit conditions; configured rejection produces `price_moved`.
- Actual execution prices include adverse spread and slippage. Limit orders never receive hidden price improvement beyond the documented gap rule.
- OHLC data cannot reveal intrabar path, queue priority, hidden liquidity, market impact, or true bid/ask dynamics.

## Event journal and lifecycle handoff

Execution events are written to `data/paper-execution-events.jsonl` by default. They are append-only, hash-validated, sequence-checked, and duplicate-protected. The bridge assumes the lifecycle is already at `ORDER_PENDING`; it applies positive fills through `TradeLifecycleEngine.applyFill` and maps simulator rejection/cancellation statuses to lifecycle cancellation. The lifecycle engine remains the authority for position state and completed trade journaling.

## Limitations

This is paper simulation only. It does not connect to brokers, accounts, exchanges, or live order routers. JSONL repositories do not provide cross-process locking or database transactions. Commission is supplied by the lifecycle close/fill boundary; execution events record spread and slippage costs explicitly.
