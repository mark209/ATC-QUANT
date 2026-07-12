# Deterministic Paper Execution Simulator Design

## Scope

Add a paper-only execution simulation layer between decision/risk outputs and the lifecycle engine. The simulator models execution mechanics only. It must not import or change strategy logic, indicators, signal generation, evidence accumulation, risk decisions, position sizing, entry conditions, exit conditions, or optimization parameters.

```text
Signal Engine
  -> Decision Engine
  -> Risk Engine
  -> Execution Simulator
  -> Lifecycle Engine
  -> Trade Journal
  -> Analytics
```

## Core Components

### ExecutionSimulator

The simulator is a pure orchestration layer. It accepts an execution request, immutable historical candle data, and an `ExecutionConfig`, then emits deterministic `ExecutionEvent` values. It never decides whether a trade should exist; it only determines how a supplied order would execute.

### ExecutionConfig

All execution assumptions are supplied through configuration. The configuration contains order-type policies, spread model, slippage model, latency model, partial-fill schedule, rejection policy, gap policy, intrabar priority, cost rates, profile/version metadata, and deterministic seed inputs.

No execution assumption is embedded as an unlabelled constant in simulator logic. Profiles include `ideal`, `normal`, `high_volatility`, `low_liquidity`, and `stress_test`.

### ExecutionEvent repository

Execution events are stored as canonical JSONL records in an append-only event journal. The repository supports append and read only. It rejects duplicate event IDs, duplicate sequences within a trade, invalid hashes, and malformed records. It never exposes update or delete operations.

## Deterministic Identity and Ordering

The deterministic replay identity is the combination of:

- `replay_id`;
- `dataset_version`;
- `strategy_version`;
- `execution_profile`;
- `random_seed`.

The simulator derives all pseudo-random decisions from these inputs and the stable order/trade context. The same inputs must produce the same event payloads, sequence values, and hashes.

Every event contains:

- `event_sequence`, unique and increasing within the replay;
- `lifecycle_sequence`, unique and increasing within the trade;
- `parent_event_id`;
- `event_hash` over the canonical event payload;
- `trade_hash` identifying the deterministic trade context.

Events also contain `strategy_git_commit`, `engine_version`, `journal_version`, `execution_profile_version`, `simulator_version`, and `data_snapshot_id` for forensic replay.

## Order Types and Conservative OHLC Semantics

Supported order types are market, limit, stop, and stop-limit. The handler boundary is extensible for future order types.

- Market orders execute at the first tradable price adjusted for configured spread and slippage.
- A limit buy fills at the candle open when the open gaps below the limit; otherwise it fills at the limit only when the low reaches the limit.
- A limit sell fills at the candle open when the open gaps above the limit; otherwise it fills at the limit only when the high reaches the limit.
- A stop buy fills at the open when the open gaps above the stop; otherwise it fills at the stop only when the high reaches the stop.
- A stop sell fills at the open when the open gaps below the stop; otherwise it fills at the stop only when the low reaches the stop.
- A stop-limit order activates at the stop and fills only when the limit condition is subsequently satisfied; a gap beyond the executable limit remains unfilled or follows the configured rejection/expiry policy.
- Gaps execute at the first tradable price, never at an assumed favorable historical price.
- Limit orders never receive price improvement beyond the conservative open/limit rules.
- If stop-loss and take-profit are both touched in one OHLC candle, stop-loss executes first.

The simulator records gap classification and actual execution price on every affected event. OHLC data cannot reveal intrabar ordering, queue position, or true bid/ask path; those limitations are documented and no hidden precision is assumed.

## Cost Models

### Spread

Profiles select fixed, percentage, volatility-adjusted, or liquidity-adjusted spread. The applied spread and spread cost are recorded per execution event.

### Slippage

Profiles select fixed, percentage, volatility-based, liquidity-based, or seeded-random slippage. Each event records expected price, actual price, slippage cost, and the model/version used.

### Latency

Profiles select fixed or seeded-random latency. Decision timestamp, execution timestamp, and latency milliseconds are recorded. Latency affects which supplied candle/price observation is eligible for execution but does not create future data.

## Partial Fills and Rejections

Fill schedules support 0%, 25%, 50%, 75%, and 100% quantities, with multiple fills allowed. A zero fill leaves the order pending. The first positive fill is handed to the lifecycle engine as a position-opening fill. Later fills update remaining quantity and weighted-average price. Cancellation of the remainder never closes the filled position.

Rejections support insufficient liquidity, market closed, price moved, order expired, risk rejection, and exchange rejection. Each rejection is an immutable event with a reason and no filled quantity.

## Lifecycle Integration

The simulator emits explicit fill, pending, rejection, cancellation, and execution outputs consumed by the lifecycle engine. It does not call strategy or risk modules and does not bypass lifecycle state transitions. Completed trade summaries remain the responsibility of the lifecycle/trade journal boundary.

## Replay Verification

Provide a replay verification command that accepts the same replay identity and dataset, reruns the simulator, and compares event count, canonical payload, sequence values, and `event_hash` for every event. Any mismatch fails verification and identifies the first differing sequence/event.

## Reporting

Execution reporting is derived from immutable events and includes average slippage, spread, latency, partial-fill rate, rejection rate, gap executions, total execution cost, cost by instrument, and cost by regime/profile.

## Testing

Tests cover:

- all supported order types;
- every spread and slippage model;
- fixed and seeded latency;
- all partial-fill percentages and repeated fills;
- each rejection reason;
- gap-through-limit, stop, stop-loss, and take-profit behavior;
- conservative stop-first ambiguity handling;
- deterministic same-seed replay and different-seed divergence;
- event hashes, parent links, and sequence uniqueness;
- append-only storage and duplicate protection;
- lifecycle integration for first fill, later fills, cancellation, and close;
- replay verification success and mismatch detection.

## Safety and Known Limitations

This is paper simulation only. It must not connect to brokers, accounts, order routers, or live execution. OHLC simulation cannot model tick-level path, queue priority, hidden liquidity, market impact, exchange matching rules, partial fill timing, or true spread dynamics. The simulator must expose those limitations in documentation and event metadata rather than implying live-equivalent execution.
