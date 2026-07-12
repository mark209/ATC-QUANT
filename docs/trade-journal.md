# Paper Trade Journal

Phase 1 adds an institutional, append-only journal for completed paper trades. It is infrastructure only and is not connected to the signal, risk, decision, execution, or live brokerage paths.

## Components

- `src/lib/trading/tradeJournal.ts`: typed `TradeRecord`, runtime validation, canonical JSON, SHA-256 trade hashes, UUID and UTC metadata generation.
- `src/lib/trading/tradeJournalRepository.ts`: append/read repository contract with no update or delete methods.
- `src/lib/trading/fileTradeJournalRepository.ts`: JSONL persistent repository. The default path is `data/paper-trade-journal.jsonl`.
- `src/lib/trading/tradeJournalService.ts`: service boundary for creating and persisting completed records.

## Append-only guarantees

Records are validated before writing. Duplicate trade IDs are rejected. Batch writes validate all records and IDs before appending. Reads validate every non-empty JSONL line and report the source line when corruption is found. The repository exposes no update or delete operation, so historical records cannot be changed through the journal API.

Each record contains a SHA-256 `trade_hash` calculated from its canonical contents excluding the hash field itself. JSON object keys are sorted recursively before hashing and serialization. Arrays retain their order.

## Operational boundary

The journal stores completed paper-trade summaries only. It does not create orders, simulate fills, decide risk, fetch market data, or connect to a broker. A future lifecycle phase must supply a completed `TradeRecordDraft`; Phase 1 deliberately does not modify existing quant modules.

## Limitations

The file repository performs duplicate checks before append and is intended for paper/replay workloads. It does not provide cross-process locking or database transactions. A production deployment requiring concurrent writers should add a serialized writer or transactional store behind the same repository interface without changing the record contract.
