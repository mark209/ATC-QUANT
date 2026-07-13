# Phase 3 Replay Infrastructure

Phase 3 provides a paper-only deterministic replay path around the existing quant engine. It does not alter signal generation, evidence accumulation, risk logic, decision logic, position sizing, execution mechanics, or trading rules.

## Workflow

`FrozenDatasetStore` loads or creates a write-once OHLCV snapshot. `DeterministicReplayRunner` replays each candle sequentially. At decision time it analyzes only candles before the current candle, then uses the current candle for paper execution. Existing strategy analysis is called through `analyzeMarketData`; the adapter does not reimplement its rules.

Rejected paper decisions are recorded as deterministic `TRADE_REJECTED` lifecycle events. When the current engine produces positive allocation, the adapter creates a paper lifecycle, routes entry and exit mechanics through the existing `ExecutionSimulator`, and persists completed trades.

## Frozen Dataset Format

Datasets are JSON snapshots containing dataset identity, source metadata, OHLCV candles, UTC bounds, schema version, checksum algorithm, and a content hash. `validateFrozenDataset` rejects duplicate, missing, unordered, irregular, malformed, non-positive, or tampered candles. `FrozenDatasetStore` uses exclusive file creation and never overwrites an existing snapshot.

The bundled fixture at `data/frozen/atc-bundled-research-fixture.json` is deterministic research data generated for infrastructure verification. It is not real market evidence and must not be used to claim a strategy edge.

## Replay Artifacts

Each replay is written once under `replays/replay-<id>/`:

- `manifest.json`
- `dataset.json`
- `dataset-manifest.json`
- `execution-events.jsonl`
- `lifecycle-events.jsonl`
- `trades.jsonl`
- `analytics.json`
- `replay-report.json`
- `artifact-manifest.json`

The artifact manifest links dataset, configuration, execution journal, lifecycle journal, trade journal, analytics, replay report, strategy commit, and engine version. Writes use exclusive creation; an existing replay ID is rejected.

## Verification Integration

`npm run replay` creates the frozen fixture and one immutable replay bundle. `npm run verify-replay` loads the latest persisted bundle, reruns the deterministic adapter 100 times without overwriting artifacts, and passes the results to the Phase 2C `verifyReplayDeterminism` framework.

The current fixture produces zero completed trades because the existing EV/Kelly gate returns zero allocation. This is expected behavior and is preserved in the lifecycle journal as rejected decisions. Verification PASS means artifact integrity and deterministic reproducibility, not profitability.

## Known Limitations

- The bundled dataset is synthetic infrastructure data, not a frozen exchange or equity history.
- The current quant engine is batch-oriented; the adapter uses historical prefixes to prevent future candles from entering a decision.
- Exit handling is paper-only and uses the existing simulator on the next available candle.
- Rejected decision lifecycle events are not completed trade records.
- No live broker, order router, or real-money execution is connected.
