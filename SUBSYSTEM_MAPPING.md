# Subsystem Mapping

This document maps existing ATC subsystems to the canonical pipeline. “Direct”
means the subsystem persists or validates the stage itself. “Inferred” means a
consumer derives the stage from another artifact. “Not represented” means the
artifact has no dedicated representation for the stage.

## Mapping Matrix

| Subsystem | Market data | Signal | Evidence | Risk | EV | Kelly | Proposal | Order | Execution | Position | Close | Trade journal | Analytics |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Strategy Trace | Direct | Direct | Direct | Direct | Direct | Direct | Inferred | Inferred | Inferred | Inferred | Inferred | Inferred | Direct |
| Lifecycle Journal | Inferred | Direct | Not represented | Direct outcome | Not represented | Not represented | Direct | Direct | Direct state mirror | Direct state | Direct | Inferred | Inferred |
| Execution Journal | Not represented | Not represented | Not represented | Not represented | Not represented | Not represented | Inferred by `trade_id` | Direct metadata | Direct | Not represented | Inferred | Inferred | Not represented |
| Trade Journal | Inferred | Inferred fields | Inferred fields | Inferred fields | Not represented as a calculation | Inferred fields | Inferred | Inferred | Inferred | Inferred | Direct | Direct input | Direct |
| Replay Verification | Direct identity | Inferred | Inferred | Inferred | Inferred | Inferred | Direct lineage checks | Direct consistency checks | Direct sequence checks | Inferred from lifecycle | Direct transition checks | Direct hash checks | Direct input checks |
| Diagnostics | Direct | Direct | Direct | Direct | Direct | Direct | Direct funnel | Inferred | Inferred | Inferred | Inferred | Inferred | Direct |
| Explainability | Direct | Direct | Direct | Direct | Direct | Direct | Inferred | Not represented | Inferred | Inferred | Inferred | Not represented | Direct report |
| Statistics | Inferred | Inferred | Inferred | Inferred | Inferred | Inferred | Inferred | Not represented | Inferred | Inferred | Direct from trades | Direct input | Direct |

## Subsystem Responsibilities

### Strategy Trace

`strategy-trace.jsonl` records one row per processed candle. It is the primary
explanation of inputs, existing calculations, thresholds, decisions, and final
status. It is not currently a proposal journal and therefore does not provide a
canonical `proposal_id` for every candle.

### Lifecycle Journal

`lifecycle-events.jsonl` records state transitions relevant to proposals,
orders, fills, positions, rejection, and completion. It deliberately does not
emit separate evidence, EV, or Kelly event types. Rejected candles may be
represented as paper proposals that terminate at rejection.

### Execution Journal

`execution-events.jsonl` records simulator outcomes, prices, costs, latency,
quantities, event sequence, and event hashes. The current implementation stores
order identity in event metadata rather than a separate order journal.

### Trade Journal

`trades.jsonl` is the completed-trade source for analytics. It carries decision
context such as evidence, confidence, regimes, and signal values, but it is not
a complete record of rejected opportunities.

### Replay Verification

Verification checks artifact hashes, duplicate identifiers, lifecycle
transitions and timestamps, execution sequences, replay identity, and
cross-artifact references. It proves artifact consistency, not that every
strategy calculation is independently recomputed.

### Diagnostics and Explainability

Diagnostics aggregate funnel counts and rejection attribution. Explainability
turns the strategy trace into a decision-tree report. Both are derived research
artifacts and must not be treated as new strategy inputs.

### Statistics

Statistics consume completed immutable trade artifacts. Upstream stages are
available only when carried into diagnostics or inferred from lineage; the
statistical layer must not reconstruct or alter strategy decisions.

## Semantic Reconciliation

| Difference | Classification | Meaning |
|---|---|---|
| Trace stops at the first rejected decision while lifecycle has a paper proposal | Reporting abstraction | The artifacts use different reporting grains; this is not a passing signal claim. |
| Lifecycle lacks dedicated evidence, EV, and Kelly states | Expected abstraction | The lifecycle state machine models execution state, not every quant sub-calculation. |
| Proposal/order/position relationships are reconstructed from lifecycle and execution records | Derived state | The relationship is validated by IDs, timestamps, sequences, and hashes. |
| Per-candle trace has no first-class proposal ID | Future enhancement | A canonical decision journal or trace proposal reference would remove reconciliation ambiguity. |
| Historical lifecycle entry timestamp used replay wall-clock time | Implementation defect, fixed | Corrected replay sets lifecycle clock time from the current candle before entry creation. |

The corrected BTC, ETH, and BNB audit artifacts report zero hash issues,
impossible transitions, timestamp ordering failures, orphan records, or
duplicate lineage records. The remaining trace/lifecycle mismatches are
therefore classified semantics/reporting, not current data or replay defects.

## Interaction Diagram

```text
ReplayRunner
  |-- analyzeMarketData --> StrategyTrace + Diagnostics
  |-- lifecycle bridge --> Lifecycle Journal
  |-- simulator ----------> Execution Journal
  |-- close/finalize ------> Trade Journal
  |-- persist -------------> ReplayArtifactStore

ReplayArtifactStore --> ReplayVerification
ReplayArtifactStore --> Explainability
ReplayArtifactStore --> Statistics
```
