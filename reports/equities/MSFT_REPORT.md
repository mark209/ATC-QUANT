# MSFT_REPORT

## Dataset Summary
- Provider: Alpaca historical stock bars, IEX feed
- Source file: data/incoming/equities/alpaca-msft-1d.json
- Asset type: stock
- Timeframe: 1d
- Candles acquired: 1497
- Date range: 2020-07-27 to 2026-07-13
- Input checksum: 78f16ad108749e3d389a0213fa6dc3af30bff309f6ae6b7ebc685a3683c0aa9d

## Validation
- Duplicate timestamps: 0
- Unordered timestamps: 0
- Irregular session intervals: 326
- Invalid OHLC rows: 0
- Invalid volume rows: 0
- Quality status: **REAL_INPUT_REQUIRES_SESSION_AWARE_FREEZE**

## Replay and Statistics
Replay was not run because the real input could not be frozen under the existing session-unaware `1d` validator. Consequently completed trades, win rate, expectancy, profit factor, drawdown, Monte Carlo, bootstrap, risk of ruin, and confidence are not available.

## Freeze Blocker
The frozen 1d validator requires every adjacent candle timestamp to be exactly 24 hours apart. US equity sessions omit weekends and exchange holidays, so the real Alpaca bars cannot be frozen without changing timestamps or synthesizing candles. Both actions are prohibited.

## Known Limitations
- Alpaca returned real session bars, not synthetic calendar-day bars.
- The existing frozen-dataset and replay architecture is unchanged per the phase constraints.
- No equity result should be compared with crypto until session-aware freezing is supplied by a future platform phase.
