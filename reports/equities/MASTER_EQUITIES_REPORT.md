# MASTER_EQUITIES_REPORT

Generated: 2026-07-14T08:39:09.050Z

**Conclusion:** EQUITIES RESEARCH BLOCKED: six real Alpaca inputs were acquired, but the frozen dataset validator rejects legitimate weekend and holiday session gaps. No replay or statistical result is claimed.

## Acquired Inputs
| Symbol | Candles | Date range | Irregular session intervals | Freeze | Replay | Statistics |
|---|---:|---|---:|---|---|---|
| SPY | 1498 | 2018-11-01 to 2026-07-13 | 327 | BLOCKED | NOT_RUN | NOT_RUN |
| QQQ | 1497 | 2020-07-27 to 2026-07-13 | 326 | BLOCKED | NOT_RUN | NOT_RUN |
| AAPL | 1497 | 2020-07-27 to 2026-07-13 | 326 | BLOCKED | NOT_RUN | NOT_RUN |
| MSFT | 1497 | 2020-07-27 to 2026-07-13 | 326 | BLOCKED | NOT_RUN | NOT_RUN |
| NVDA | 1497 | 2020-07-27 to 2026-07-13 | 326 | BLOCKED | NOT_RUN | NOT_RUN |
| AMZN | 1497 | 2020-07-27 to 2026-07-13 | 326 | BLOCKED | NOT_RUN | NOT_RUN |

## Findings
- Six real Alpaca daily equity inputs were acquired and checksummed.
- Dataset freezing is blocked by the existing exact-24-hour `1d` validation rule, which is incompatible with legitimate exchange sessions.
- No completed trades, replay verification, or statistical findings are reported because doing so would require a frozen dataset that has not passed validation.

## Recommendation
Do not infer equities strategy behavior yet. Add a session-aware frozen-dataset contract that preserves exchange trading calendars, then re-import and independently replay these same raw inputs.
