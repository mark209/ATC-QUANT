# ATC Replay Verification Report

**Status:** FAIL

This report verifies replay artifacts only. It does not execute or alter trading logic.

## Verification Summary

| Check | Result |
|---|---|
| Replay status | FAIL |
| Deterministic replay | FAIL |
| Replay count | 1 |
| Replay duration | 49847 ms |
| Hash validation | PASS |
| Journal validation | PASS |
| Lifecycle validation | FAIL |
| Execution validation | PASS |
| Consistency validation | PASS |
| Analytics validation | PASS |

## Findings

- lifecycle timestamps are out of order for 287fa501-e8f0-4b8a-8457-3d8b8489b6d2

## Production Claim

Production replay artifacts failed integrity validation.

Replay artifacts require further verification before institutional use.
