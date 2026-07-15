# SPY_REPORT

## Dataset Summary
- Provider: Alpaca historical stock bars, IEX feed
- Source file: data/incoming/equities/alpaca-spy-1d.json
- Asset type: etf
- Timeframe: 1d
- Candles acquired: 1498
- Date range: 2018-11-01 to 2026-07-13
- Input checksum: ce421ed5bb8569ca65a43bd6b5f563f37f93a8490e363594d37473531438246e

## Validation
- Duplicate timestamps: 0
- Unordered timestamps: 0
- Irregular session intervals: 327
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
