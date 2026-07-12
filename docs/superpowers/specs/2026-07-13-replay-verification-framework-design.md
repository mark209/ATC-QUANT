# Replay Verification Framework Design

## Scope

Add verification-only infrastructure that validates replay artifacts supplied through dependency injection. The framework must not import, execute, alter, or depend on the current trading engine, strategy logic, indicators, evidence accumulation, risk engine, decision engine, position sizing, execution simulator, lifecycle engine, trade journal implementation, or analytics implementation.

The framework verifies deterministic behavior when a compatible replay runner and complete production artifacts are supplied. It must not claim production replay determinism before Phase 3 has generated real execution events, lifecycle events, trade records, journals, and analytics inputs.

## Verification Inputs

### Replay identity

The immutable replay identity contains:

- `replay_id`;
- `dataset_version` and `dataset_hash`;
- `strategy_version`;
- `execution_profile`;
- `random_seed`;
- configuration payload and `configuration_hash`;
- source Git commit when available.

### Replay artifacts

An artifact bundle may contain:

- execution events;
- lifecycle events;
- completed trade records;
- journal metadata and `journal_hash`;
- analytics inputs;
- dataset/configuration metadata;
- replay output metadata.

Artifacts are supplied as typed values or through injected readers. No production file path is assumed by the core verifier.

### ReplayRunner

The framework accepts an injected `ReplayRunner` with a deterministic replay method. The runner receives a `ReplayIdentity` and immutable input dataset, then returns an artifact bundle. The verifier does not know how the runner creates the artifacts.

Fixture runners are used in unit and integration tests. A production runner adapter can be added after Phase 3 without changing verifier logic.

## Hashing

Canonical serialization uses recursively sorted object keys and stable array order. SHA-256 hashes are calculated for:

- dataset;
- configuration;
- individual trades;
- individual events;
- trade journal;
- execution/lifecycle journals;
- analytics inputs;
- complete replay output.

Hash validation detects modified, missing, duplicated, truncated, or corrupted records. Hashes exclude fields that are intentionally generated outside the replay identity only when the artifact contract explicitly marks them nondeterministic; otherwise all persisted fields participate in the hash.

## Validation Rules

The verifier checks:

- no duplicate trade IDs;
- no duplicate event IDs;
- no duplicate event or lifecycle sequences within their scope;
- no orphan execution/lifecycle events;
- no invalid lifecycle transitions;
- no fills after cancellation;
- no position updates after closure;
- no close before position open;
- exactly one lifecycle for every completed trade;
- monotonic timestamps;
- sequential lifecycle and execution numbers;
- no out-of-order events or skipped required states;
- consistent replay ID, dataset version/hash, configuration hash, strategy version, execution profile, and Git commit;
- consistent trade and event hashes across related artifacts;
- analytics inputs reference known completed trades and events.

Validation results are structured as `PASS`, `FAIL`, `UNAVAILABLE`, or `INCONCLUSIVE`, with machine-readable findings and first-failure details.

`UNAVAILABLE` means a required production artifact or runner is absent. `INCONCLUSIVE` means artifacts exist but are incomplete, insufficient, or cannot support the requested claim. Neither status is a pass.

## Replay Comparison and Stress Test

For two compatible replay outputs, the verifier compares:

- trade IDs;
- event IDs and parent links;
- event ordering and lifecycle transitions;
- trade and event hashes;
- execution prices, spread, slippage, latency, partial fills, gaps, and final trade values;
- journal and analytics-input hashes.

The stress verifier invokes the injected runner 100 times with the same replay identity and compares every artifact bundle to the first run. It fails on any hash, ordering, event, trade, or analytics-input deviation.

The stress test is fixture-validatable in the current phase. A production stress result is only reportable after Phase 3 artifacts and a production runner exist.

## Reporting

The report contains:

- replay status;
- deterministic pass/fail status;
- hash validation;
- journal validation;
- lifecycle validation;
- execution validation;
- consistency validation;
- replay count;
- elapsed duration;
- first mismatch or missing-artifact details;
- verification summary;
- explicit production-readiness limitation.

The report must distinguish fixture verification from production verification and must never promote fixture results into a production determinism claim.

## Testing

Tests cover:

- canonical serialization stability;
- deterministic hash generation;
- tampered, missing, duplicated, and malformed artifacts;
- lifecycle graph validation;
- ordering and timestamp validation;
- cross-artifact consistency validation;
- injected fixture runner comparison;
- 100 identical fixture replays;
- mismatch detection for changed events, configuration, dataset, seed, and trade records;
- `UNAVAILABLE` when production artifacts or runner are absent;
- `INCONCLUSIVE` for incomplete production bundles.

## Phase Boundary and Safety

This framework is infrastructure only. It does not create production journals or replay artifacts and does not alter trading behavior. Before Phase 3, the report must state that production replay determinism is not verified. After Phase 3, a production adapter may supply real artifacts to the same verifier for an actual determinism result.
