# ATC Replay Verification Report

**Status:** FAIL

This report verifies replay artifacts only. It does not execute or alter trading logic.

## Verification Summary

| Check | Result |
|---|---|
| Replay status | FAIL |
| Deterministic replay | FAIL |
| Replay count | 1 |
| Replay duration | 12732 ms |
| Hash validation | PASS |
| Journal validation | PASS |
| Lifecycle validation | FAIL |
| Execution validation | PASS |
| Consistency validation | PASS |
| Analytics validation | PASS |

## Findings

- lifecycle timestamps are out of order for 80450d0c-4956-45c7-8580-a26f430910a7

## Production Claim

Production replay artifacts failed integrity validation.

Replay artifacts require further verification before institutional use.
