# Append-Only Trade Journal Design

## Scope

Add paper-only institutional trade logging infrastructure without changing strategy logic, indicators, signal generation, execution decisions, replay behavior, AI behavior, or optimization parameters.

The journal records completed paper trades as immutable JSONL records. It is an observability and audit boundary, not an execution component.

## Architecture

### TradeRecord model

`TradeRecord` is a strict TypeScript model representing one completed trade. It contains:

- identity: `trade_id`, `strategy_version`, `replay_id`, `data_snapshot_id`;
- instrument and direction;
- UTC entry, exit, and decision timestamps;
- prices, quantity, notional, stop, and target;
- gross/net PnL, return, R multiple, commission, spread, slippage, and execution delay;
- evidence, confidence, market, volatility, and liquidity regimes;
- signal scores and entry indicator snapshot;
- entry/exit reasons, fill status, execution status, and risk profile.

The implementation will use snake_case at the serialized boundary to match the audit specification. Numeric fields must be finite. Timestamps must be valid UTC ISO-8601 strings. A completed record must have exit data and a terminal execution/fill status.

### Repository boundary

The repository interface exposes:

- append one or more records;
- read all records;
- read by trade ID;
- report whether a trade ID exists.

The interface does not expose update or delete operations. This makes mutation impossible through the journal abstraction.

### JSONL storage

The storage implementation writes one canonical JSON object per line. Appends use the filesystem append operation and create the parent directory when needed. A duplicate `trade_id` is rejected rather than silently duplicated. Existing bytes are never rewritten.

Reads parse and validate each non-empty line. Malformed records fail the read with a line-numbered error so corruption cannot be silently treated as a clean journal.

The journal path is configurable and defaults to a paper-only data location. No broker, order, account, or live-execution API is imported or called.

### Writer and reader

The writer accepts a completed-trade input without identity/timestamp fields, generates a UUID using the platform UUID API, generates a UTC creation timestamp, validates the completed record, and delegates persistence to the repository. The reader delegates to the repository and returns validated records.

Automatic metadata is generated at the logging boundary only; it does not alter any trading decision.

## Immutability and failure handling

- No update, delete, or rewrite method is exposed.
- Duplicate IDs fail before append.
- Invalid records fail before append.
- Multi-record writes validate the entire batch and check IDs before writing, preventing a partially accepted batch.
- A read stops on the first malformed line and identifies the source line.
- The journal is paper-only and carries a documentation warning against connecting it to live execution.

## Testing

Unit tests will cover:

- valid record construction and field preservation;
- generated UUID and UTC timestamp;
- invalid timestamps and non-finite numeric values;
- duplicate ID rejection;
- no update/delete surface on the repository;
- reader validation and line-numbered corruption errors.

Integration tests will use a temporary JSONL file and verify:

- append and read round-trip;
- multiple records remain in append order;
- duplicate append leaves the file unchanged;
- malformed persisted data is rejected;
- writer-generated records are readable by a fresh repository instance.

## Documentation

The implementation documentation will define the serialized schema, status expectations, append-only guarantees, operational recovery procedure, and paper-only safety boundary.

## Non-goals

- No strategy or parameter changes.
- No execution integration.
- No live-trading behavior.
- No analytics, optimization, or trade-performance calculations.
- No migration of existing strategy modules.
