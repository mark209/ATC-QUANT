# Artifact Contract

## 1. Contract Principles

Replay artifacts are immutable research inputs. Producers write a complete
bundle under one replay directory. Consumers validate identity, checksums,
schemas, sequences, and references before analysis. Derived reports never
overwrite source journals.

Base artifact schema version is `1.0`; the replay engine version currently used
by the production runner is `phase3-replay-1`. Dataset identity is additionally
protected by the dataset checksum and manifest.

## 2. Persisted Artifact Matrix

| Artifact | Producer | Consumer | Hash/version | Persistence and retention | Validation |
|---|---|---|---|---|---|
| `manifest.json` | Replay runner/store | All consumers | Replay identity; schema `1.0` | Retain with replay forever | Required replay, dataset, strategy, engine, and configuration identity |
| `dataset.json` | Frozen dataset library/store | Replay runner, diagnostics | Dataset hash; dataset schema | Immutable source snapshot | OHLCV schema, UTC, order, duplicates, checksum |
| `dataset-manifest.json` | Dataset library | Replay runner, verification | Dataset checksum/version | Immutable with dataset | Metadata, date range, candle count, quality status |
| `execution-events.jsonl` | Execution simulator/store | Verification, lifecycle analysis | Per-event `event_hash`; bundle `execution_journal_hash` | Retain with replay | Event IDs, status, quantities, timestamps, sequence, hash, replay/trade references |
| `lifecycle-events.jsonl` | Lifecycle engine/store | Verification, explainability, audits | Bundle `lifecycle_journal_hash` | Retain with replay | Valid transition table, timestamps, state sequence, IDs, replay consistency |
| `trades.jsonl` | Trade journal/store | Analytics, statistics, verification | Per-trade `trade_hash`; bundle `trade_journal_hash` | Retain as immutable completed-trade source | Required fields, UTC timestamps, P&L, fill status, hash |
| `analytics.json` | Replay runner/analytics | Research reports, verification | Bundle `analytics_hash`; input trade hashes | Retain with replay; derived | Trade references, equity curve, totals, hash inputs |
| `replay-report.json` | Replay runner/store | Operators, verification | Bundle `replay_report_hash` | Retain with replay | Counts, status `COMPLETED`, identity consistency |
| `artifact-manifest.json` | Artifact store | Verification and archival | Contains hashes for base artifacts | Retain as bundle index | All listed hashes match current files and replay identity |
| `verification-report.json/.md` | Replay verification | Research gate, operators | Report schema `1.0`; derived | Retain with the replay that produced it | Hash, journal, lifecycle, execution, consistency, analytics, determinism findings |
| `decision-pipeline-diagnostics.json/.md` | Diagnostics | Explainability, research reports | Derived report schema | Retain with replay; never source input | Funnel totals, rejection attribution, EV/Kelly records, replay identity |
| `strategy-trace.jsonl` | Strategy trace | Explainability, audits | Derived trace schema | Retain with replay; immutable per replay | One record per processed candle, stage/status consistency, replay identity |
| `strategy-explainability.json/.md` | Explainability | Engineers, research reports | Derived report schema | Retain with replay | Trace coverage, stage counts, thresholds, reasons, identity |
| `proposal-funnel-audit.json/.md` | Proposal audit | Consistency audit, engineers | Derived audit schema | Retain with audit run | Stage accounting, terminal states, first divergence, proposal IDs |
| `pipeline-audit.json/.md` | Pipeline audit | Consistency audit, engineers | Derived audit schema | Retain with audit run | Candle accounting, opportunity accounting, lifecycle accounting |
| `pipeline-consistency-audit.json/.md` | Consistency audit | Research gate, engineers | Derived audit schema | Retain with audit run | Lineage, orphan, duplicate, hash, timestamp, trace reconciliation checks |

## 3. Hash and Version Rules

`artifact-manifest.json` is the integrity index for the base replay bundle. The
execution, lifecycle, trade, analytics, and replay report hashes are computed
from canonical serialized content. Individual execution and trade records also
carry record-level hashes. A consumer must reject or quarantine a bundle when a
declared hash differs.

Derived diagnostics, trace, explainability, and audit reports currently have
their own schemas and identity fields but are not included in the base artifact
manifest hash set. This is an explicit contract gap: their contents must be
retained and validated by their producing audit, but they cannot be treated as
covered by the base bundle hash without a future artifact schema revision.

## 4. Artifact Flow

```text
Dataset manifest + dataset
          |
          v
Replay manifest --> journals (execution, lifecycle, trades)
          |                    |
          +--> analytics ------+
          |
          +--> artifact manifest (base hashes)
          |
          +--> diagnostics --> trace --> explainability
          |
          +--> verification --> pipeline/proposal/consistency audits
```

## 5. Consumer Rules

Consumers must:

1. Select a replay by `replay_id`, not by an ambiguous latest file.
2. Verify dataset and replay identity before reading journal rows.
3. Treat rejected trace rows as decisions, not completed trades.
4. Use lifecycle as execution/position state, not as a substitute for missing
   evidence, EV, or Kelly events.
5. Use `trades.jsonl` as the source for completed-trade statistics.
6. Preserve the original bundle when creating reports or corrected replays.
7. Report insufficient or missing artifacts explicitly rather than inferring a
   passing decision.

## 6. Retention

Retain the complete frozen dataset, replay bundle, verification report, and
derived audit reports together. Do not delete pre-correction artifacts; mark
them historical/retired when a replay defect is discovered. Corrected replays
must be independently identifiable and re-verified.
