# Complete Trade Lifecycle Engine Design

## Scope

Add a deterministic, paper-only lifecycle engine around the existing quant outputs. The engine records proposals, risk outcomes, simulated fills, position changes, exits, and completed trades without changing strategy logic, indicators, signal generation, risk logic, execution decisions, replay behavior, AI behavior, or optimization parameters.

## State Machine

The primary lifecycle is:

```text
SIGNAL_GENERATED
  -> TRADE_PROPOSED
  -> RISK_VALIDATED
  -> ORDER_CREATED
  -> ORDER_PENDING
  -> ORDER_PARTIALLY_FILLED (zero or more times)
  -> POSITION_OPEN (first successful fill)
  -> POSITION_UPDATED (additional fills or position changes)
  -> ORDER_FILLED (remaining order quantity reaches zero)
  -> POSITION_CLOSED
  -> TRADE_COMPLETED
```

Rejected trades terminate at `TRADE_REJECTED` after proposal or risk validation. Orders may terminate at `ORDER_CANCELLED`. If cancellation occurs after a partial fill, the filled quantity remains an open position and the state becomes `POSITION_REMAINS_OPEN`; it does not manufacture a completed trade.

Exit reasons are recorded as metadata and may be stop loss, take profit, manual exit, or timeout exit. An exit closes the currently open quantity and then emits `POSITION_CLOSED` and `TRADE_COMPLETED`.

Every transition is validated against the previous state. Invalid transitions fail without writing an event.

## Event Journal

Each transition is an immutable `TradeLifecycleEvent` with:

- `event_id`;
- `trade_id`;
- `parent_trade_id`;
- `event_type`;
- `timestamp_utc`;
- `state_before` and `state_after`;
- `filled_quantity`;
- `remaining_quantity`;
- `average_fill_price`;
- `execution_price`;
- `execution_latency_ms`;
- `reason`;
- `metadata`.

Events are serialized as one canonical JSON object per line in an append-only JSONL event journal. The event repository exposes append and read operations only; it has no update or delete method. Duplicate event IDs and invalid transitions are rejected. Existing bytes are never rewritten.

## Determinism

The lifecycle engine accepts a clock and UUID generator as dependencies. Production paper runs may use platform UUIDs and UTC time; replay tests provide deterministic generators and timestamps. Given the same input events, fills, exits, and simulation clock, the engine must produce the same ordered lifecycle event sequence and position quantities.

The engine never fetches market data, calls a broker, or creates an order outside the simulation boundary. It consumes caller-provided trade proposals and simulated fills only.

## Position Accounting

- The first positive fill opens the filled quantity immediately.
- Additional fills reduce remaining order quantity and update weighted-average entry price.
- `ORDER_FILLED` is emitted only when remaining order quantity reaches zero.
- Cancelling a partially filled order preserves the filled position and emits `POSITION_REMAINS_OPEN`.
- A close uses the caller-provided execution price and closes the current filled quantity.
- The final trade summary is written only after the position reaches zero.
- Partial fill costs and execution latency are retained in event metadata and rolled into the final trade record.

## Completed Trade Journal

The final `TradeRecord` is a summary of the completed position, including identity, timestamps, prices, quantity, PnL, costs, R multiple, evidence, confidence, regimes, signal and indicator snapshots, reasons, fill status, execution status, and risk profile. It is appended after `POSITION_CLOSED` and is never updated.

The event journal remains the source of truth for reconstructing intermediate order and position behavior. The completed journal is the source of truth for completed-trade analytics.

## Testing

Unit tests cover:

- valid state transitions;
- rejected proposals and rejected risk validation;
- pending orders;
- first-fill position opening;
- repeated partial fills and weighted-average pricing;
- final fill and `ORDER_FILLED`;
- cancellation before fill;
- cancellation after partial fill;
- stop-loss, take-profit, manual, and timeout exits;
- invalid transitions and invalid quantities;
- deterministic event sequences using injected clock and UUID providers.

Integration tests cover:

- event append/read round trips;
- no event overwrite on repeated writes;
- complete lifecycle producing one completed trade record;
- partial-fill cancellation producing no completed trade until a later close;
- malformed event journal rejection;
- final trade summary being reconstructible from event history.

## Safety and Non-goals

- Paper simulation only; no broker APIs, account APIs, or live execution.
- No changes to signal generation, risk validation logic, or strategy parameters.
- No automatic fills from market data; fills are explicit simulator inputs.
- No optimization or analytics implementation beyond the lifecycle data required for later analytics.
