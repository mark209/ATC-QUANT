# TIMESTAMP AUDIT

Historical failure found: true
Corrected replay passes: true
Deterministic replay compromised by historical defect: true
Replay results valid after correction: true

## Root Cause
Before the correction, replayRunner initialized lifecycle metadata time from replay_timestamp. Entry lifecycle events therefore used the replay wall-clock timestamp, while historical exit events used candle timestamps. The first historical event appeared after its later exit, so lifecycle ordering failed.

## Affected Files
- src/lib/replay/replayRunner.ts
- replays/replay-crypto-long-btcusdt-long-v1/lifecycle-events.jsonl
- replays/replay-crypto-long-btcusdt-long-v1/verification-report.json

## Affected Artifacts
- replays/replay-crypto-long-btcusdt-long-v1/lifecycle-events.jsonl
- replays/replay-crypto-long-btcusdt-long-v1/verification-report.json
- reports/crypto-long-horizon/BTCUSDT_LONG_HORIZON_REPORT.json

## Remediation
Set the lifecycle clock to the current candle timestamp before creating each entry lifecycle. Re-run the production replay and deterministic verification, and retire or relabel artifacts generated before the correction.
