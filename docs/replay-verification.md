# Replay Verification Framework

Phase 2C is verification-only infrastructure. It does not execute strategy logic, modify execution assumptions, or create production replay artifacts.

## Workflow

1. A caller supplies an immutable `ReplayIdentity`, frozen dataset, and injected `ReplayRunner`.
2. The runner returns trade records, execution events, lifecycle events, analytics inputs, and replay output.
3. `verifyReplayArtifacts` validates hashes, journals, event ordering, lifecycle transitions, orphan records, and cross-artifact metadata.
4. `verifyReplayDeterminism` runs the same identity 100 times by default and compares canonical artifact projections.
5. `renderReplayVerificationReport` produces a Markdown report with explicit status and findings.

The framework has no default production runner. The CLI therefore writes an `UNAVAILABLE` report until Phase 3 provides a frozen dataset, real journals, lifecycle events, execution events, completed trades, and analytics inputs.

## Determinism Guarantees

Replay identity includes:

- replay ID;
- dataset version and hash;
- strategy version;
- execution profile;
- random seed;
- configuration and configuration hash;
- source Git commit when available.

Canonical serialization recursively sorts object keys while preserving array order. SHA-256 hashes are used for configuration, journals, analytics inputs, trade records, and execution events. Replay comparison includes IDs, ordering, lifecycle transitions, prices, costs, latency, partial fills, gap handling, trade results, analytics inputs, and replay output.

## Validation Rules

The verifier detects duplicate IDs, invalid hashes, orphan events, missing order references, fills after cancellation, invalid lifecycle transitions, non-contiguous sequences, out-of-order timestamps, incomplete completed-trade lifecycles, and inconsistent replay metadata.

`PASS` means the supplied artifact bundle passed internal consistency checks. It does not prove profitability or strategy quality. `FAIL` means a deterministic or integrity invariant was violated. `INCONCLUSIVE` means artifacts exist but are incomplete. `UNAVAILABLE` means the required production runner or artifacts do not exist.

## Testing

Fixture tests cover canonical hashing, tampering, duplicates, lifecycle validation, analytics references, mismatch detection, unavailable state, and 100 identical injected replays. Fixture success must never be reported as production determinism.

## Known Limitations

- No production replay runner exists in the current repository.
- No frozen historical dataset or production analytics-input artifact exists in the current repository.
- The verifier cannot detect undocumented nondeterminism inside an injected runner unless it changes returned artifacts.
- Lifecycle transition validation follows the Phase 2A event contract; rejected-trade persistence remains dependent on the supplied artifact bundle.
- A source Git commit is checked when supplied, but the framework does not inspect Git itself.
