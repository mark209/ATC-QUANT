# Lineage Contract

## 1. Rules

Every persisted record belongs to exactly one frozen dataset and one replay.
Identifiers are immutable after creation. A replay is never amended in place;
a corrected or re-run artifact receives a new replay identity or an explicitly
versioned replacement outside the immutable research record.

## 2. Canonical Identifiers

| Identifier | Creation point | Lifetime | Relationships | Uniqueness |
|---|---|---|---|---|
| `dataset_id` | Dataset freeze/import | Immutable dataset snapshot | Parent of every replay using the snapshot | Unique in the dataset catalog; paired with version/checksum |
| `replay_id` | Replay identity creation | One replay execution and its artifacts | Belongs to one `dataset_id`; parent of all journals/reports | Unique across replay artifacts |
| `proposal_id` | Trade opportunity creation | From first proposal decision to terminal outcome | Belongs to one replay; may create orders and a position | Unique within and preferably across replay IDs |
| `order_id` | Simulator order creation | One entry or exit order attempt | Belongs to one proposal; may produce execution events | Unique per order in a replay |
| `execution_id` | Execution event creation | One execution event | Belongs to one order/proposal and event sequence | Unique per execution event |
| `position_id` | Position open | From open through close | Belongs to one proposal and is closed by execution/lifecycle events | Unique per position |
| `trade_id` | Completed trade record creation; currently also lifecycle/execution key | Immutable completed trade | References the proposal, position, replay, and dataset | Unique per completed trade |

## 3. Current Implementation Mapping

The existing implementation uses `trade_id` as the common lifecycle and
execution correlation key. For actionable proposals it also identifies the
resulting completed trade. The canonical model distinguishes `proposal_id` and
`trade_id` conceptually, but the current artifact model does not persist a
separate proposal identifier for every opportunity. Proposal audit records
therefore use the lifecycle trade identity as the proposal correlation key.

Similarly, `order_id` is currently carried in execution-event metadata, and
`position_id` is inferred from the lifecycle trade grouping. These are documented
gaps, not reasons to rewrite existing artifacts.

## 4. Relationship Invariants

```text
dataset_id
   |
   +--> replay_id
          |
          +--> proposal_id (current correlation: lifecycle trade_id)
                 +--> order_id
                 |      +--> execution_id (one or more, ordered)
                 +--> position_id (currently inferred)
                        +--> trade_id (completed trade, if closed)
```

Required invariants:

1. Every artifact record has the same `replay_id` as its replay manifest.
2. Every replay references exactly one immutable dataset hash.
3. Every proposal has one terminal state: rejected, cancelled, or completed.
4. Every execution belongs to one proposal/order correlation and has a valid
   sequence.
5. Every completed trade has one entry lineage and one close lineage.
6. No identifier is duplicated within its namespace.
7. Timestamps are UTC ISO-8601 values and are nondecreasing within a lifecycle
   and execution sequence.
8. Hashes are calculated from canonical JSON excluding the hash field itself.

## 5. Identifier Validation

`ReplayVerification` validates replay and dataset identity, journal IDs,
execution sequences, lifecycle transitions and timestamps, trade hashes, and
cross-artifact references. The consistency audit additionally checks orphan,
duplicate, missing, skipped, and mismatched lineage records.

## 6. Known Gaps and Future Contract

The next canonical artifact revision should persist `proposal_id`, `order_id`,
and `position_id` as first-class fields and add a decision journal containing
one record for each canonical stage. That enhancement is observational and must
not change strategy behavior. Until then, consumers must use the mapping above
and must not claim that the separate IDs exist in current files.
