# ATC Replay Verification Report

**Status:** FAIL

This report verifies replay artifacts only. It does not execute or alter trading logic.

## Verification Summary

| Check | Result |
|---|---|
| Replay status | FAIL |
| Deterministic replay | FAIL |
| Replay count | 1 |
| Replay duration | 51470 ms |
| Hash validation | PASS |
| Journal validation | PASS |
| Lifecycle validation | FAIL |
| Execution validation | PASS |
| Consistency validation | PASS |
| Analytics validation | PASS |

## Findings

- lifecycle timestamps are out of order for bfe525f1-4b4c-4105-874c-a668ee18f2fb

## Production Claim

Production replay artifacts failed integrity validation.

Replay artifacts require further verification before institutional use.
