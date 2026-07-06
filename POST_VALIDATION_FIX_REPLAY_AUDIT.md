# Post-Validation-Fix Replay Audit

## 1. Executive Summary

This audit reran production historical replay after the graded validation evidence model was added. The result is more honest and more interpretable, but it does not yet produce economically meaningful exposure.

- Validation is no longer the only visible blocker: replay rows now separate No Evidence, Weak Evidence, Moderate Evidence, Strong Evidence, and Failed Evidence.
- Production allocation is still heavily starved. Across the 63-day replay set, 84.8214% of rows had 0% active allocation and only 0.0000% reached at least 0.50%.
- Kelly remains the dominant raw sizing bottleneck when the final decision allows exposure. The main reason is unchanged: EV/Kelly still applies trade-count and sample-quality penalties, and low-frequency trend following often does not generate enough closed trades.
- The graded validation fix did not create reckless exposure. Strong candidate remained rare, Failed Evidence remained blocking, and crypto remained stricter than equities/ETFs.

## 2. Replay Settings Used

- Assets: AAPL, SPY, QQQ, BTCUSDT, ETHUSDT.
- Rebalance intervals: 63 trading/calendar rows and 5 trading/calendar rows.
- Starting capital for paper replay metrics: $100000.00.
- Data source path: `fetchMarketDataWithFallback(... chartRangeRequested: "max")`, using dense `backtestCandles`.
- Analysis path: existing production `analyzeMarketData`.
- Strategy behavior changed: none.
- Kelly behavior changed: none.
- Historical replay is not live paper trading.

## 3. Asset-by-Asset Validation State Distribution

| Symbol |Rebalance Days |Rows |Validation Evidence Distribution |
| --- |--- |--- |--- |
| AAPL |63 |40 |No Evidence: 12 (30.0000%)<br>Weak Evidence: 16 (40.0000%)<br>Moderate Evidence: 3 (7.5000%)<br>Strong Evidence: 0 (0.0000%)<br>Failed Evidence: 9 (22.5000%) |
| AAPL |5 |503 |No Evidence: 146 (29.0258%)<br>Weak Evidence: 207 (41.1531%)<br>Moderate Evidence: 35 (6.9583%)<br>Strong Evidence: 0 (0.0000%)<br>Failed Evidence: 115 (22.8628%) |
| SPY |63 |40 |No Evidence: 12 (30.0000%)<br>Weak Evidence: 16 (40.0000%)<br>Moderate Evidence: 12 (30.0000%)<br>Strong Evidence: 0 (0.0000%)<br>Failed Evidence: 0 (0.0000%) |
| SPY |5 |503 |No Evidence: 141 (28.0318%)<br>Weak Evidence: 208 (41.3519%)<br>Moderate Evidence: 148 (29.4235%)<br>Strong Evidence: 1 (0.1988%)<br>Failed Evidence: 5 (0.9940%) |
| QQQ |63 |40 |No Evidence: 12 (30.0000%)<br>Weak Evidence: 14 (35.0000%)<br>Moderate Evidence: 11 (27.5000%)<br>Strong Evidence: 1 (2.5000%)<br>Failed Evidence: 2 (5.0000%) |
| QQQ |5 |503 |No Evidence: 141 (28.0318%)<br>Weak Evidence: 176 (34.9901%)<br>Moderate Evidence: 152 (30.2187%)<br>Strong Evidence: 15 (2.9821%)<br>Failed Evidence: 19 (3.7773%) |
| BTCUSDT |63 |52 |No Evidence: 18 (34.6154%)<br>Weak Evidence: 14 (26.9231%)<br>Moderate Evidence: 6 (11.5385%)<br>Strong Evidence: 0 (0.0000%)<br>Failed Evidence: 14 (26.9231%) |
| BTCUSDT |5 |645 |No Evidence: 223 (34.5736%)<br>Weak Evidence: 181 (28.0620%)<br>Moderate Evidence: 77 (11.9380%)<br>Strong Evidence: 0 (0.0000%)<br>Failed Evidence: 164 (25.4264%) |
| ETHUSDT |63 |52 |No Evidence: 19 (36.5385%)<br>Weak Evidence: 2 (3.8462%)<br>Moderate Evidence: 0 (0.0000%)<br>Strong Evidence: 0 (0.0000%)<br>Failed Evidence: 31 (59.6154%) |
| ETHUSDT |5 |645 |No Evidence: 239 (37.0543%)<br>Weak Evidence: 28 (4.3411%)<br>Moderate Evidence: 0 (0.0000%)<br>Strong Evidence: 0 (0.0000%)<br>Failed Evidence: 378 (58.6047%) |

## 4. Asset-by-Asset Final Decision Distribution

| Symbol |Rebalance Days |Rows |Final Decision Distribution |
| --- |--- |--- |--- |
| AAPL |63 |40 |Strong candidate: 0 (0.0000%)<br>Position allowed: 0 (0.0000%)<br>Small allocation only: 8 (20.0000%)<br>Watchlist only: 9 (22.5000%)<br>Avoid for now: 15 (37.5000%)<br>Risk-off / no trade: 4 (10.0000%)<br>No Data / Avoid: 4 (10.0000%) |
| AAPL |5 |503 |Strong candidate: 0 (0.0000%)<br>Position allowed: 0 (0.0000%)<br>Small allocation only: 103 (20.4771%)<br>Watchlist only: 125 (24.8509%)<br>Avoid for now: 187 (37.1769%)<br>Risk-off / no trade: 40 (7.9523%)<br>No Data / Avoid: 48 (9.5427%) |
| SPY |63 |40 |Strong candidate: 0 (0.0000%)<br>Position allowed: 0 (0.0000%)<br>Small allocation only: 12 (30.0000%)<br>Watchlist only: 14 (35.0000%)<br>Avoid for now: 6 (15.0000%)<br>Risk-off / no trade: 4 (10.0000%)<br>No Data / Avoid: 4 (10.0000%) |
| SPY |5 |503 |Strong candidate: 0 (0.0000%)<br>Position allowed: 0 (0.0000%)<br>Small allocation only: 168 (33.3996%)<br>Watchlist only: 141 (28.0318%)<br>Avoid for now: 112 (22.2664%)<br>Risk-off / no trade: 34 (6.7594%)<br>No Data / Avoid: 48 (9.5427%) |
| QQQ |63 |40 |Strong candidate: 0 (0.0000%)<br>Position allowed: 0 (0.0000%)<br>Small allocation only: 11 (27.5000%)<br>Watchlist only: 12 (30.0000%)<br>Avoid for now: 7 (17.5000%)<br>Risk-off / no trade: 6 (15.0000%)<br>No Data / Avoid: 4 (10.0000%) |
| QQQ |5 |503 |Strong candidate: 0 (0.0000%)<br>Position allowed: 0 (0.0000%)<br>Small allocation only: 159 (31.6103%)<br>Watchlist only: 127 (25.2485%)<br>Avoid for now: 112 (22.2664%)<br>Risk-off / no trade: 57 (11.3320%)<br>No Data / Avoid: 48 (9.5427%) |
| BTCUSDT |63 |52 |Strong candidate: 0 (0.0000%)<br>Position allowed: 0 (0.0000%)<br>Small allocation only: 3 (5.7692%)<br>Watchlist only: 4 (7.6923%)<br>Avoid for now: 15 (28.8462%)<br>Risk-off / no trade: 26 (50.0000%)<br>No Data / Avoid: 4 (7.6923%) |
| BTCUSDT |5 |645 |Strong candidate: 0 (0.0000%)<br>Position allowed: 0 (0.0000%)<br>Small allocation only: 45 (6.9767%)<br>Watchlist only: 52 (8.0620%)<br>Avoid for now: 194 (30.0775%)<br>Risk-off / no trade: 303 (46.9767%)<br>No Data / Avoid: 51 (7.9070%) |
| ETHUSDT |63 |52 |Strong candidate: 0 (0.0000%)<br>Position allowed: 0 (0.0000%)<br>Small allocation only: 0 (0.0000%)<br>Watchlist only: 1 (1.9231%)<br>Avoid for now: 15 (28.8462%)<br>Risk-off / no trade: 32 (61.5385%)<br>No Data / Avoid: 4 (7.6923%) |
| ETHUSDT |5 |645 |Strong candidate: 0 (0.0000%)<br>Position allowed: 0 (0.0000%)<br>Small allocation only: 3 (0.4651%)<br>Watchlist only: 22 (3.4109%)<br>Avoid for now: 187 (28.9922%)<br>Risk-off / no trade: 382 (59.2248%)<br>No Data / Avoid: 51 (7.9070%) |

## 5. Allocation Bucket Distribution

| Symbol |Rebalance Days |Rows |Active Allocation Bucket Distribution |
| --- |--- |--- |--- |
| AAPL |63 |40 |0%: 32 (80.0000%)<br>>0% to 0.25%: 1 (2.5000%)<br>0.25% to 0.50%: 7 (17.5000%)<br>0.50% to 1.00%: 0 (0.0000%)<br>1.00% to 2.00%: 0 (0.0000%)<br>2.00% to 5.00%: 0 (0.0000%)<br>>5.00%: 0 (0.0000%) |
| AAPL |5 |503 |0%: 400 (79.5229%)<br>>0% to 0.25%: 20 (3.9761%)<br>0.25% to 0.50%: 83 (16.5010%)<br>0.50% to 1.00%: 0 (0.0000%)<br>1.00% to 2.00%: 0 (0.0000%)<br>2.00% to 5.00%: 0 (0.0000%)<br>>5.00%: 0 (0.0000%) |
| SPY |63 |40 |0%: 28 (70.0000%)<br>>0% to 0.25%: 11 (27.5000%)<br>0.25% to 0.50%: 1 (2.5000%)<br>0.50% to 1.00%: 0 (0.0000%)<br>1.00% to 2.00%: 0 (0.0000%)<br>2.00% to 5.00%: 0 (0.0000%)<br>>5.00%: 0 (0.0000%) |
| SPY |5 |503 |0%: 335 (66.6004%)<br>>0% to 0.25%: 162 (32.2068%)<br>0.25% to 0.50%: 6 (1.1928%)<br>0.50% to 1.00%: 0 (0.0000%)<br>1.00% to 2.00%: 0 (0.0000%)<br>2.00% to 5.00%: 0 (0.0000%)<br>>5.00%: 0 (0.0000%) |
| QQQ |63 |40 |0%: 29 (72.5000%)<br>>0% to 0.25%: 6 (15.0000%)<br>0.25% to 0.50%: 5 (12.5000%)<br>0.50% to 1.00%: 0 (0.0000%)<br>1.00% to 2.00%: 0 (0.0000%)<br>2.00% to 5.00%: 0 (0.0000%)<br>>5.00%: 0 (0.0000%) |
| QQQ |5 |503 |0%: 344 (68.3897%)<br>>0% to 0.25%: 63 (12.5249%)<br>0.25% to 0.50%: 96 (19.0855%)<br>0.50% to 1.00%: 0 (0.0000%)<br>1.00% to 2.00%: 0 (0.0000%)<br>2.00% to 5.00%: 0 (0.0000%)<br>>5.00%: 0 (0.0000%) |
| BTCUSDT |63 |52 |0%: 49 (94.2308%)<br>>0% to 0.25%: 2 (3.8462%)<br>0.25% to 0.50%: 1 (1.9231%)<br>0.50% to 1.00%: 0 (0.0000%)<br>1.00% to 2.00%: 0 (0.0000%)<br>2.00% to 5.00%: 0 (0.0000%)<br>>5.00%: 0 (0.0000%) |
| BTCUSDT |5 |645 |0%: 600 (93.0233%)<br>>0% to 0.25%: 19 (2.9457%)<br>0.25% to 0.50%: 26 (4.0310%)<br>0.50% to 1.00%: 0 (0.0000%)<br>1.00% to 2.00%: 0 (0.0000%)<br>2.00% to 5.00%: 0 (0.0000%)<br>>5.00%: 0 (0.0000%) |
| ETHUSDT |63 |52 |0%: 52 (100.0000%)<br>>0% to 0.25%: 0 (0.0000%)<br>0.25% to 0.50%: 0 (0.0000%)<br>0.50% to 1.00%: 0 (0.0000%)<br>1.00% to 2.00%: 0 (0.0000%)<br>2.00% to 5.00%: 0 (0.0000%)<br>>5.00%: 0 (0.0000%) |
| ETHUSDT |5 |645 |0%: 642 (99.5349%)<br>>0% to 0.25%: 3 (0.4651%)<br>0.25% to 0.50%: 0 (0.0000%)<br>0.50% to 1.00%: 0 (0.0000%)<br>1.00% to 2.00%: 0 (0.0000%)<br>2.00% to 5.00%: 0 (0.0000%)<br>>5.00%: 0 (0.0000%) |

## 6. Average Allocations

| Symbol |Rebalance Days |Avg finalPositionSize |Avg activeAllocation |Median activeAllocation |Max activeAllocation |Avg nonzero allocation |% active > 0 |% active >= 0.25% |% active >= 0.50% |% active >= 1.00% |
| --- |--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |
| AAPL |63 |0.0586% |0.0586% |0.0000% |0.3640% |0.2932% |20.0000% |17.5000% |0.0000% |0.0000% |
| AAPL |5 |0.0603% |0.0603% |0.0000% |0.3788% |0.2945% |20.4771% |16.5010% |0.0000% |0.0000% |
| SPY |63 |0.0625% |0.0625% |0.0000% |0.2565% |0.2085% |30.0000% |2.5000% |0.0000% |0.0000% |
| SPY |5 |0.0695% |0.0695% |0.0000% |0.2682% |0.2080% |33.3996% |1.1928% |0.0000% |0.0000% |
| QQQ |63 |0.0673% |0.0673% |0.0000% |0.2819% |0.2446% |27.5000% |12.5000% |0.0000% |0.0000% |
| QQQ |5 |0.0790% |0.0790% |0.0000% |0.2974% |0.2498% |31.6103% |19.0855% |0.0000% |0.0000% |
| BTCUSDT |63 |0.0140% |0.0140% |0.0000% |0.2553% |0.2421% |5.7692% |1.9231% |0.0000% |0.0000% |
| BTCUSDT |5 |0.0175% |0.0175% |0.0000% |0.2747% |0.2512% |6.9767% |4.0310% |0.0000% |0.0000% |
| ETHUSDT |63 |0.0000% |0.0000% |0.0000% |0.0000% |0.0000% |0.0000% |0.0000% |0.0000% |0.0000% |
| ETHUSDT |5 |0.0011% |0.0011% |0.0000% |0.2366% |0.2312% |0.4651% |0.0000% |0.0000% |0.0000% |

## 7. Kelly Diagnostics

| Symbol |Rebalance Days |Avg Kelly |Median Kelly |Max Kelly |Kelly Bucket Distribution |Avg Kelly Trade Count |Sample Quality Distribution |Trade Count Multiplier Distribution |Sample Multiplier Distribution |% EV <= 0 |
| --- |--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |
| AAPL |63 |0.1485% |0.2025% |0.3640% |Kelly = 0: 18 (45.0000%)<br>>0% to 0.25%: 6 (15.0000%)<br>0.25% to 0.50%: 16 (40.0000%)<br>0.50% to 1.00%: 0 (0.0000%)<br>>1.00%: 0 (0.0000%) |29.88 |Poor: 18 (45.0000%)<br>Limited: 22 (55.0000%)<br>Acceptable: 0 (0.0000%)<br>Strong: 0 (0.0000%) |0: 18 (45.0000%)<br>1: 0 (0.0000%)<br>0.35: 22 (55.0000%) |0: 18 (45.0000%)<br>1: 0 (0.0000%)<br>0.25: 22 (55.0000%)<br>0.75: 0 (0.0000%) |17.5000% |
| AAPL |5 |0.1530% |0.2025% |0.3788% |Kelly = 0: 220 (43.7376%)<br>>0% to 0.25%: 82 (16.3022%)<br>0.25% to 0.50%: 201 (39.9602%)<br>0.50% to 1.00%: 0 (0.0000%)<br>>1.00%: 0 (0.0000%) |30.56 |Poor: 220 (43.7376%)<br>Limited: 283 (56.2624%)<br>Acceptable: 0 (0.0000%)<br>Strong: 0 (0.0000%) |0: 220 (43.7376%)<br>1: 0 (0.0000%)<br>0.35: 283 (56.2624%) |0: 220 (43.7376%)<br>1: 0 (0.0000%)<br>0.25: 283 (56.2624%)<br>0.75: 0 (0.0000%) |17.6938% |
| SPY |63 |0.1014% |0.1135% |0.2565% |Kelly = 0: 19 (47.5000%)<br>>0% to 0.25%: 20 (50.0000%)<br>0.25% to 0.50%: 1 (2.5000%)<br>0.50% to 1.00%: 0 (0.0000%)<br>>1.00%: 0 (0.0000%) |28.30 |Poor: 19 (47.5000%)<br>Limited: 21 (52.5000%)<br>Acceptable: 0 (0.0000%)<br>Strong: 0 (0.0000%) |0: 19 (47.5000%)<br>1: 0 (0.0000%)<br>0.35: 21 (52.5000%) |0: 19 (47.5000%)<br>1: 0 (0.0000%)<br>0.25: 21 (52.5000%)<br>0.75: 0 (0.0000%) |27.5000% |
| SPY |5 |0.1035% |0.1328% |0.2682% |Kelly = 0: 239 (47.5149%)<br>>0% to 0.25%: 258 (51.2922%)<br>0.25% to 0.50%: 6 (1.1928%)<br>0.50% to 1.00%: 0 (0.0000%)<br>>1.00%: 0 (0.0000%) |28.90 |Poor: 239 (47.5149%)<br>Limited: 264 (52.4851%)<br>Acceptable: 0 (0.0000%)<br>Strong: 0 (0.0000%) |0: 239 (47.5149%)<br>1: 0 (0.0000%)<br>0.35: 264 (52.4851%) |0: 239 (47.5149%)<br>1: 0 (0.0000%)<br>0.25: 264 (52.4851%)<br>0.75: 0 (0.0000%) |27.0378% |
| QQQ |63 |0.1161% |0.1761% |0.2819% |Kelly = 0: 20 (50.0000%)<br>>0% to 0.25%: 12 (30.0000%)<br>0.25% to 0.50%: 8 (20.0000%)<br>0.50% to 1.00%: 0 (0.0000%)<br>>1.00%: 0 (0.0000%) |27.88 |Poor: 20 (50.0000%)<br>Limited: 20 (50.0000%)<br>Acceptable: 0 (0.0000%)<br>Strong: 0 (0.0000%) |0: 20 (50.0000%)<br>1: 0 (0.0000%)<br>0.35: 20 (50.0000%) |0: 20 (50.0000%)<br>1: 0 (0.0000%)<br>0.25: 20 (50.0000%)<br>0.75: 0 (0.0000%) |10.0000% |
| QQQ |5 |0.1219% |0.1835% |0.2974% |Kelly = 0: 240 (47.7137%)<br>>0% to 0.25%: 147 (29.2247%)<br>0.25% to 0.50%: 116 (23.0616%)<br>0.50% to 1.00%: 0 (0.0000%)<br>>1.00%: 0 (0.0000%) |28.59 |Poor: 240 (47.7137%)<br>Limited: 263 (52.2863%)<br>Acceptable: 0 (0.0000%)<br>Strong: 0 (0.0000%) |0: 240 (47.7137%)<br>1: 0 (0.0000%)<br>0.35: 263 (52.2863%) |0: 240 (47.7137%)<br>1: 0 (0.0000%)<br>0.25: 263 (52.2863%)<br>0.75: 0 (0.0000%) |9.1451% |
| BTCUSDT |63 |0.0516% |0.0000% |0.2553% |Kelly = 0: 40 (76.9231%)<br>>0% to 0.25%: 11 (21.1538%)<br>0.25% to 0.50%: 1 (1.9231%)<br>0.50% to 1.00%: 0 (0.0000%)<br>>1.00%: 0 (0.0000%) |18.06 |Poor: 40 (76.9231%)<br>Limited: 12 (23.0769%)<br>Acceptable: 0 (0.0000%)<br>Strong: 0 (0.0000%) |0: 40 (76.9231%)<br>1: 0 (0.0000%)<br>0.35: 12 (23.0769%) |0: 40 (76.9231%)<br>1: 0 (0.0000%)<br>0.25: 12 (23.0769%)<br>0.75: 0 (0.0000%) |21.1538% |
| BTCUSDT |5 |0.0533% |0.0000% |0.2747% |Kelly = 0: 493 (76.4341%)<br>>0% to 0.25%: 126 (19.5349%)<br>0.25% to 0.50%: 26 (4.0310%)<br>0.50% to 1.00%: 0 (0.0000%)<br>>1.00%: 0 (0.0000%) |18.04 |Poor: 493 (76.4341%)<br>Limited: 152 (23.5659%)<br>Acceptable: 0 (0.0000%)<br>Strong: 0 (0.0000%) |0: 493 (76.4341%)<br>1: 0 (0.0000%)<br>0.35: 152 (23.5659%) |0: 493 (76.4341%)<br>1: 0 (0.0000%)<br>0.25: 152 (23.5659%)<br>0.75: 0 (0.0000%) |19.6899% |
| ETHUSDT |63 |0.0701% |0.0000% |0.2405% |Kelly = 0: 34 (65.3846%)<br>>0% to 0.25%: 18 (34.6154%)<br>0.25% to 0.50%: 0 (0.0000%)<br>0.50% to 1.00%: 0 (0.0000%)<br>>1.00%: 0 (0.0000%) |20.38 |Poor: 34 (65.3846%)<br>Limited: 18 (34.6154%)<br>Acceptable: 0 (0.0000%)<br>Strong: 0 (0.0000%) |0: 34 (65.3846%)<br>1: 0 (0.0000%)<br>0.35: 18 (34.6154%) |0: 34 (65.3846%)<br>1: 0 (0.0000%)<br>0.25: 18 (34.6154%)<br>0.75: 0 (0.0000%) |21.1538% |
| ETHUSDT |5 |0.0696% |0.0000% |0.2522% |Kelly = 0: 424 (65.7364%)<br>>0% to 0.25%: 219 (33.9535%)<br>0.25% to 0.50%: 2 (0.3101%)<br>0.50% to 1.00%: 0 (0.0000%)<br>>1.00%: 0 (0.0000%) |20.31 |Poor: 424 (65.7364%)<br>Limited: 221 (34.2636%)<br>Acceptable: 0 (0.0000%)<br>Strong: 0 (0.0000%) |0: 424 (65.7364%)<br>1: 0 (0.0000%)<br>0.35: 221 (34.2636%) |0: 424 (65.7364%)<br>1: 0 (0.0000%)<br>0.25: 221 (34.2636%)<br>0.75: 0 (0.0000%) |19.6899% |

## 8. Bottleneck Attribution

| Symbol |Rebalance Days |Most Common Bottleneck |Second Bottleneck |% Kelly Bottleneck |% Final Decision Zeroing |% Validation State Block |% EV <= 0 |% Drawdown Bottleneck |Full Bottleneck Distribution |
| --- |--- |--- |--- |--- |--- |--- |--- |--- |--- |
| AAPL |63 |NegativeEVBlock |FractionalKellyAllocation |20.0000% |10.0000% |20.0000% |17.5000% |0.0000% |VolatilityTargetAllocation: 0 (0.0000%)<br>FractionalKellyAllocation: 8 (20.0000%)<br>AssetClassMaxAllocation: 0 (0.0000%)<br>DrawdownAdjustedAllocation: 0 (0.0000%)<br>FinalDecisionZeroing: 4 (10.0000%)<br>DataQualityBlock: 4 (10.0000%)<br>RiskOffBlock: 4 (10.0000%)<br>NegativeEVBlock: 12 (30.0000%)<br>NoEvidenceBlock: 0 (0.0000%)<br>FailedEvidenceBlock: 8 (20.0000%) |
| AAPL |5 |NegativeEVBlock |FailedEvidenceBlock |20.4771% |9.3439% |20.8748% |17.6938% |0.0000% |VolatilityTargetAllocation: 0 (0.0000%)<br>FractionalKellyAllocation: 103 (20.4771%)<br>AssetClassMaxAllocation: 0 (0.0000%)<br>DrawdownAdjustedAllocation: 0 (0.0000%)<br>FinalDecisionZeroing: 47 (9.3439%)<br>DataQualityBlock: 48 (9.5427%)<br>RiskOffBlock: 40 (7.9523%)<br>NegativeEVBlock: 160 (31.8091%)<br>NoEvidenceBlock: 0 (0.0000%)<br>FailedEvidenceBlock: 105 (20.8748%) |
| SPY |63 |NegativeEVBlock |FractionalKellyAllocation |30.0000% |15.0000% |0.0000% |27.5000% |0.0000% |VolatilityTargetAllocation: 0 (0.0000%)<br>FractionalKellyAllocation: 12 (30.0000%)<br>AssetClassMaxAllocation: 0 (0.0000%)<br>DrawdownAdjustedAllocation: 0 (0.0000%)<br>FinalDecisionZeroing: 6 (15.0000%)<br>DataQualityBlock: 4 (10.0000%)<br>RiskOffBlock: 4 (10.0000%)<br>NegativeEVBlock: 14 (35.0000%)<br>NoEvidenceBlock: 0 (0.0000%)<br>FailedEvidenceBlock: 0 (0.0000%) |
| SPY |5 |NegativeEVBlock |FractionalKellyAllocation |33.3996% |12.3260% |0.3976% |27.0378% |0.0000% |VolatilityTargetAllocation: 0 (0.0000%)<br>FractionalKellyAllocation: 168 (33.3996%)<br>AssetClassMaxAllocation: 0 (0.0000%)<br>DrawdownAdjustedAllocation: 0 (0.0000%)<br>FinalDecisionZeroing: 62 (12.3260%)<br>DataQualityBlock: 48 (9.5427%)<br>RiskOffBlock: 34 (6.7594%)<br>NegativeEVBlock: 189 (37.5746%)<br>NoEvidenceBlock: 0 (0.0000%)<br>FailedEvidenceBlock: 2 (0.3976%) |
| QQQ |63 |NegativeEVBlock |FractionalKellyAllocation |27.5000% |10.0000% |0.0000% |10.0000% |0.0000% |VolatilityTargetAllocation: 0 (0.0000%)<br>FractionalKellyAllocation: 11 (27.5000%)<br>AssetClassMaxAllocation: 0 (0.0000%)<br>DrawdownAdjustedAllocation: 0 (0.0000%)<br>FinalDecisionZeroing: 4 (10.0000%)<br>DataQualityBlock: 4 (10.0000%)<br>RiskOffBlock: 6 (15.0000%)<br>NegativeEVBlock: 15 (37.5000%)<br>NoEvidenceBlock: 0 (0.0000%)<br>FailedEvidenceBlock: 0 (0.0000%) |
| QQQ |5 |NegativeEVBlock |FractionalKellyAllocation |31.6103% |8.9463% |0.7952% |9.1451% |0.0000% |VolatilityTargetAllocation: 0 (0.0000%)<br>FractionalKellyAllocation: 159 (31.6103%)<br>AssetClassMaxAllocation: 0 (0.0000%)<br>DrawdownAdjustedAllocation: 0 (0.0000%)<br>FinalDecisionZeroing: 45 (8.9463%)<br>DataQualityBlock: 48 (9.5427%)<br>RiskOffBlock: 57 (11.3320%)<br>NegativeEVBlock: 190 (37.7734%)<br>NoEvidenceBlock: 0 (0.0000%)<br>FailedEvidenceBlock: 4 (0.7952%) |
| BTCUSDT |63 |RiskOffBlock |NegativeEVBlock |5.7692% |5.7692% |3.8462% |21.1538% |0.0000% |VolatilityTargetAllocation: 0 (0.0000%)<br>FractionalKellyAllocation: 3 (5.7692%)<br>AssetClassMaxAllocation: 0 (0.0000%)<br>DrawdownAdjustedAllocation: 0 (0.0000%)<br>FinalDecisionZeroing: 3 (5.7692%)<br>DataQualityBlock: 4 (7.6923%)<br>RiskOffBlock: 26 (50.0000%)<br>NegativeEVBlock: 14 (26.9231%)<br>NoEvidenceBlock: 0 (0.0000%)<br>FailedEvidenceBlock: 2 (3.8462%) |
| BTCUSDT |5 |RiskOffBlock |NegativeEVBlock |6.9767% |4.6512% |5.2713% |19.6899% |0.0000% |VolatilityTargetAllocation: 0 (0.0000%)<br>FractionalKellyAllocation: 45 (6.9767%)<br>AssetClassMaxAllocation: 0 (0.0000%)<br>DrawdownAdjustedAllocation: 0 (0.0000%)<br>FinalDecisionZeroing: 30 (4.6512%)<br>DataQualityBlock: 51 (7.9070%)<br>RiskOffBlock: 303 (46.9767%)<br>NegativeEVBlock: 182 (28.2171%)<br>NoEvidenceBlock: 0 (0.0000%)<br>FailedEvidenceBlock: 34 (5.2713%) |
| ETHUSDT |63 |RiskOffBlock |FailedEvidenceBlock |0.0000% |0.0000% |19.2308% |21.1538% |0.0000% |VolatilityTargetAllocation: 0 (0.0000%)<br>FractionalKellyAllocation: 0 (0.0000%)<br>AssetClassMaxAllocation: 0 (0.0000%)<br>DrawdownAdjustedAllocation: 0 (0.0000%)<br>FinalDecisionZeroing: 0 (0.0000%)<br>DataQualityBlock: 4 (7.6923%)<br>RiskOffBlock: 32 (61.5385%)<br>NegativeEVBlock: 6 (11.5385%)<br>NoEvidenceBlock: 0 (0.0000%)<br>FailedEvidenceBlock: 10 (19.2308%) |
| ETHUSDT |5 |RiskOffBlock |FailedEvidenceBlock |0.4651% |0.3101% |17.3643% |19.6899% |0.0000% |VolatilityTargetAllocation: 0 (0.0000%)<br>FractionalKellyAllocation: 3 (0.4651%)<br>AssetClassMaxAllocation: 0 (0.0000%)<br>DrawdownAdjustedAllocation: 0 (0.0000%)<br>FinalDecisionZeroing: 2 (0.3101%)<br>DataQualityBlock: 51 (7.9070%)<br>RiskOffBlock: 382 (59.2248%)<br>NegativeEVBlock: 95 (14.7287%)<br>NoEvidenceBlock: 0 (0.0000%)<br>FailedEvidenceBlock: 112 (17.3643%) |

## 9. Replay Performance Metrics

| Symbol |Rebalance Days |Total Return |Annualized Return |Max Drawdown |Sharpe |Sortino |Trades |Avg Trade Allocation |Buy/Hold Benchmark |Fees/Slippage Impact |
| --- |--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |
| AAPL |63 |0.0056% |0.0006% |-0.1194% |Not meaningful |0.0117 |12 |0.1955% |1195.8263% |$2.36 fees / $2.36 slippage |
| AAPL |5 |-0.0089% |-0.0009% |-0.1279% |Not meaningful |-0.0194 |98 |0.2578% |1195.8263% |$8.25 fees / $8.25 slippage |
| SPY |63 |0.0486% |0.0049% |-0.0301% |Not meaningful |0.2217 |16 |0.1563% |317.0179% |$1.75 fees / $1.75 slippage |
| SPY |5 |0.1031% |0.0103% |-0.0215% |Not meaningful |0.5262 |145 |0.1905% |317.0179% |$4.98 fees / $4.98 slippage |
| QQQ |63 |0.0604% |0.0060% |-0.0584% |Not meaningful |0.1770 |14 |0.1922% |614.7667% |$1.60 fees / $1.60 slippage |
| QQQ |5 |0.1671% |0.0167% |-0.0303% |Not meaningful |0.5275 |132 |0.2342% |614.7667% |$4.93 fees / $4.93 slippage |
| BTCUSDT |63 |0.0108% |0.0012% |-0.0789% |Not meaningful |0.0161 |5 |0.1453% |1441.8153% |$0.98 fees / $0.98 slippage |
| BTCUSDT |5 |-0.0218% |-0.0025% |-0.1114% |Not meaningful |-0.0328 |42 |0.2218% |1441.8153% |$2.69 fees / $2.69 slippage |
| ETHUSDT |63 |0.0000% |0.0000% |0.0000% |0.0000 |0.0000 |0 |0.0000% |470.9129% |$0.00 fees / $0.00 slippage |
| ETHUSDT |5 |-0.0055% |-0.0006% |-0.0195% |Not meaningful |-0.0084 |5 |0.1387% |470.9129% |$0.93 fees / $0.93 slippage |

## 10. Before/After Comparison

Previous baseline allocations were the known pre-graded-validation replay problem values. The comparison below uses the 63-day replay because that was the clearest prior reference point.

| Symbol |Previous Avg Active Allocation |Current Avg Active Allocation |Change |Current Zero-Allocation Dates |Small Allocation Count |Position Allowed Count |Strong Candidate Count |
| --- |--- |--- |--- |--- |--- |--- |--- |
| AAPL |0.0867% |0.0586% |-0.0281% |80.0000% |8 |0 |0 |
| SPY |0.0633% |0.0625% |-0.0008% |70.0000% |12 |0 |0 |
| QQQ |0.0690% |0.0673% |-0.0017% |72.5000% |11 |0 |0 |
| BTCUSDT |0.0187% |0.0140% |-0.0047% |94.2308% |3 |0 |0 |
| ETHUSDT |0.0244% |0.0000% |-0.0244% |100.0000% |0 |0 |0 |

Interpretation:

- Average active allocations did not materially improve enough to become economically meaningful.
- Zero-allocation dates remain high.
- Small allocation labels now appear only when the model actually has a nonzero active allocation.
- Position allowed appears only when validation evidence, risk, signal, EV, and minimum allocation constraints align.
- Strong candidate remains appropriately rare.
- Weak Evidence is now visible and no longer mislabeled as a hard validation data failure, but it does not automatically overcome Kelly/sample penalties.
- Failed Evidence still blocks allocation.
- Crypto remains stricter than equities/ETFs.

## 11. Is Validation Still The Main Bottleneck?

Validation is no longer the sole explanation. The graded evidence model fixed the old false framing where nearly everything collapsed into Insufficient Data. However, validation still blocks rows that are truly No Evidence or Failed Evidence, and it still prevents normal Position allowed labels unless the evidence reaches Moderate or Strong.

In practical terms: validation is now a confidence gate, not the dominant capital starvation mechanism on every row.

## 12. Is Kelly Now The Main Bottleneck?

Yes. Kelly is still the main sizing bottleneck whenever the system gets past data quality, EV, and decision gating. This is consistent with the unchanged production formula:

```text
FinalPositionSize = min(
  VolatilityTargetAllocation,
  FractionalKellyAllocation,
  AssetClassMaxAllocation,
  DrawdownAdjustedAllocation
)
```

The Kelly layer remains conservative because:

- Negative EV after costs forces Kelly to 0.
- Poor sample quality forces Kelly to 0.
- Limited sample quality applies a 0.25x multiplier.
- Trade counts below 30 force the trade-count multiplier to 0.
- Trade counts below 100 apply a 0.35x multiplier.
- The strategy is low-frequency, so closed trade samples often stay small for long stretches.

## 13. Recommended Next Step

Do not raise Kelly yet.

The next safest step is a Kelly/sample-penalty audit, not a strategy change. Specifically:

1. Confirm whether the trade-count multiplier hard-zero below 30 is too binary for a low-frequency trend-following strategy.
2. Test a diagnostic-only graded trade-count multiplier, similar to the validation evidence model.
3. Keep production unchanged until the diagnostic shows that nonzero Kelly would be justified by positive EV after costs and tolerable drawdown.
4. Keep crypto separate and do not loosen crypto rules just because equity exposure remains too small.

Final verdict: the validation fix improved truthfulness and interpretability, but production replay remains a research prototype because Kelly/sample penalties still starve exposure.
