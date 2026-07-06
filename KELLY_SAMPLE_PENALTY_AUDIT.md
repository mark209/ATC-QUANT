# Kelly Sample Penalty Audit

## 1. Executive Summary

This is a diagnostic-only audit. Production strategy behavior was not changed.

- The current Kelly path can hard-zero allocation at multiple layers: non-positive EV after costs, non-positive payoff ratio, non-positive raw Kelly, production trade count below 30, and sampleQuality === "Poor".
- The trade-count hard-zero and Poor sample-quality hard-zero are effectively duplicative because sampleQuality is assigned from the same 30-trade boundary.
- Across the inspected 224 replay rows, 131 rows (58.4821%) had zero production fractional Kelly.
- 81 rows (36.1607%) had positive raw Kelly before penalties but were crushed to zero by the production penalty stack.
- 131 rows (58.4821%) were below 30 trades. 93 rows (41.5179%) were in the 30-99 limited-sample band.
- Counterfactuals are diagnostic only. They keep EV-negative hard-zero, payoffRatio <= 0 hard-zero, crypto's stricter Kelly fraction, crypto caps, hard filters, validation evidence, and final decision gating.

## 2. Files and Functions Inspected

| File | Relevant functions/config |
| --- | --- |
| src/lib/quant/positionSizing.ts | fractionalKelly, calculatePositionSizing, sampleMultiplier, tradeCountMultiplier |
| src/lib/quant/config.ts | minTotalTrades, limitedSampleTradeCount, Kelly fractions, asset caps, decision thresholds |
| src/lib/quant/scoring.ts | analyzeMarketData data flow from backtest trades to EV to sizing to final decision |
| src/lib/quant/expectedValue.ts | sampleQuality, confidenceMultiplier, calculateExpectedValueFromTrades |
| src/lib/quant/backtest.ts | runTrendBacktest closed-trade generation and net returns |
| src/lib/quant/historicalReplay.ts | simulatePaperPortfolio and active allocation replay |
| tests/quant/positionSizing.test.ts | Kelly hard-zero and sizing constraints tests |
| tests/quant/expectedValue.test.ts | EV/sample quality/payoff tests |
| tests/quant/scoring.test.ts | trade-derived EV and allocation-adjusted backtest tests |

## 3. Exact Kelly Formula Path

`analyzeMarketData` runs `runTrendBacktest(backtestCandles, assetType, feeRate, slippageRate)`. The backtest creates closed net trades. `calculateExpectedValueFromTrades(fullBacktest.trades)` derives win rate, payoff ratio, EV after costs, trade count, and sampleQuality from those closed net trades. `calculatePositionSizing` then calls `fractionalKelly`.

Production formula:

```text
if expectedValueAfterCosts <= 0: Kelly = 0
if payoffRatio <= 0: Kelly = 0
rawKelly = winRate - ((1 - winRate) / payoffRatio)
if rawKelly <= 0: Kelly = 0
fraction = crypto ? cryptoKellyFraction(0.10) : kellyFraction(0.20)
fractionalKellyAllocation =
  rawKelly
  * fraction
  * sampleMultiplier(sampleQuality)
  * tradeCountMultiplier(tradeCount)

finalPositionSizeBeforeDecision = min(
  volatilityTargetAllocation,
  fractionalKellyAllocation,
  assetClassMaxAllocation,
  drawdownAdjustedAllocation
)

final active allocation is then gated by buildFinalDecision.
```

## 4. Kelly Hard-Zero Conditions

- `expectedValueAfterCosts <= 0` in `fractionalKelly`.
- `payoffRatio <= 0` in `fractionalKelly`.
- `rawKelly <= 0` in `fractionalKelly`.
- `tradeCount < DEFAULT_QUANT_CONFIG.validation.minTotalTrades`, currently 30, through `tradeCountMultiplier(...)=0`.
- `sampleQuality === "Poor"` through `sampleMultiplier(...)=0`.
- Asset-specific caps do not currently hard-zero Kelly for the audited assets because their caps are nonzero. Caps can limit final position size after Kelly.

## 5. Kelly Shrink Multipliers

- Equity/ETF/index Kelly fraction: 0.2.
- Crypto Kelly fraction: 0.1.
- sampleQuality Poor: 0x.
- sampleQuality Limited: 0.25x.
- sampleQuality Acceptable: 0.75x.
- sampleQuality Strong: 1.00x.
- tradeCount < 30: 0x.
- tradeCount 30-99: 0.35x.
- tradeCount >= 100: 1.00x.

## 6. Asset-by-Asset Kelly Zero Attribution

The table uses a mutually exclusive primary attribution order: EV <= 0, payoffRatio <= 0, raw Kelly <= 0, tradeCount < minTotalTrades, sampleQuality Poor, asset cap, other. Conditions can overlap, especially tradeCount < 30 and sampleQuality Poor.

| Symbol | Rows | Zero Kelly Rows | Primary Zero Attribution |
| --- | --- | --- | --- |
| AAPL | 40 | 18 (45.0000%) | EV after costs <= 0: 7 (17.5000%)<br>payoffRatio <= 0: 1 (2.5000%)<br>raw Kelly <= 0: 0 (0.0000%)<br>tradeCount < minTotalTrades: 10 (25.0000%)<br>sampleQuality === Poor: 0 (0.0000%)<br>asset-specific cap: 0 (0.0000%)<br>other reason: 0 (0.0000%) |
| SPY | 40 | 19 (47.5000%) | EV after costs <= 0: 11 (27.5000%)<br>payoffRatio <= 0: 0 (0.0000%)<br>raw Kelly <= 0: 0 (0.0000%)<br>tradeCount < minTotalTrades: 8 (20.0000%)<br>sampleQuality === Poor: 0 (0.0000%)<br>asset-specific cap: 0 (0.0000%)<br>other reason: 0 (0.0000%) |
| QQQ | 40 | 20 (50.0000%) | EV after costs <= 0: 4 (10.0000%)<br>payoffRatio <= 0: 1 (2.5000%)<br>raw Kelly <= 0: 0 (0.0000%)<br>tradeCount < minTotalTrades: 15 (37.5000%)<br>sampleQuality === Poor: 0 (0.0000%)<br>asset-specific cap: 0 (0.0000%)<br>other reason: 0 (0.0000%) |
| BTCUSDT | 52 | 40 (76.9231%) | EV after costs <= 0: 11 (21.1538%)<br>payoffRatio <= 0: 0 (0.0000%)<br>raw Kelly <= 0: 0 (0.0000%)<br>tradeCount < minTotalTrades: 29 (55.7692%)<br>sampleQuality === Poor: 0 (0.0000%)<br>asset-specific cap: 0 (0.0000%)<br>other reason: 0 (0.0000%) |
| ETHUSDT | 52 | 34 (65.3846%) | EV after costs <= 0: 11 (21.1538%)<br>payoffRatio <= 0: 4 (7.6923%)<br>raw Kelly <= 0: 0 (0.0000%)<br>tradeCount < minTotalTrades: 19 (36.5385%)<br>sampleQuality === Poor: 0 (0.0000%)<br>asset-specific cap: 0 (0.0000%)<br>other reason: 0 (0.0000%) |

## 7. Asset-by-Asset Kelly Shrink Attribution

Rows here are limited to replay rows where raw Kelly was positive before penalties.

| Symbol | Raw Kelly > 0 Rows | Avg Raw Kelly | Median Raw Kelly | Avg After Asset Kelly Fraction | Avg After Trade-Count Multiplier | Avg After Sample-Quality Multiplier | Avg After Asset Cap | Final FractionalKellyAllocation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AAPL | 32 | 16.1849% | 15.4259% | 3.2370% | 0.7427% | 0.1857% | 0.1857% | 0.1857% |
| SPY | 29 | 10.2917% | 10.3617% | 2.0583% | 0.5594% | 0.1398% | 0.1398% | 0.1398% |
| QQQ | 35 | 15.8931% | 13.8875% | 3.1786% | 0.5307% | 0.1327% | 0.1327% | 0.1327% |
| BTCUSDT | 41 | 25.5075% | 26.9789% | 2.5508% | 0.2617% | 0.0654% | 0.0654% | 0.0654% |
| ETHUSDT | 37 | 26.0038% | 26.0104% | 2.6004% | 0.3939% | 0.0985% | 0.0985% | 0.0985% |

## 8. Trade Count Distribution

| Symbol | Rows | Trade Count Distribution | Average Trade Count |
| --- | --- | --- | --- |
| AAPL | 40 | 0-9: 8 (20.0000%)<br>10-19: 5 (12.5000%)<br>20-29: 5 (12.5000%)<br>30-49: 16 (40.0000%)<br>50-99: 6 (15.0000%)<br>100-199: 0 (0.0000%)<br>200+: 0 (0.0000%) | 29.88 |
| SPY | 40 | 0-9: 7 (17.5000%)<br>10-19: 6 (15.0000%)<br>20-29: 6 (15.0000%)<br>30-49: 16 (40.0000%)<br>50-99: 5 (12.5000%)<br>100-199: 0 (0.0000%)<br>200+: 0 (0.0000%) | 28.30 |
| QQQ | 40 | 0-9: 8 (20.0000%)<br>10-19: 6 (15.0000%)<br>20-29: 6 (15.0000%)<br>30-49: 13 (32.5000%)<br>50-99: 7 (17.5000%)<br>100-199: 0 (0.0000%)<br>200+: 0 (0.0000%) | 27.88 |
| BTCUSDT | 52 | 0-9: 17 (32.6923%)<br>10-19: 15 (28.8462%)<br>20-29: 8 (15.3846%)<br>30-49: 12 (23.0769%)<br>50-99: 0 (0.0000%)<br>100-199: 0 (0.0000%)<br>200+: 0 (0.0000%) | 18.06 |
| ETHUSDT | 52 | 0-9: 19 (36.5385%)<br>10-19: 6 (11.5385%)<br>20-29: 9 (17.3077%)<br>30-49: 18 (34.6154%)<br>50-99: 0 (0.0000%)<br>100-199: 0 (0.0000%)<br>200+: 0 (0.0000%) | 20.38 |

## 9. Sample Quality Distribution

| Symbol | Rows | Sample Quality Distribution |
| --- | --- | --- |
| AAPL | 40 | Poor: 18 (45.0000%)<br>Limited: 22 (55.0000%)<br>Acceptable: 0 (0.0000%)<br>Strong: 0 (0.0000%) |
| SPY | 40 | Poor: 19 (47.5000%)<br>Limited: 21 (52.5000%)<br>Acceptable: 0 (0.0000%)<br>Strong: 0 (0.0000%) |
| QQQ | 40 | Poor: 20 (50.0000%)<br>Limited: 20 (50.0000%)<br>Acceptable: 0 (0.0000%)<br>Strong: 0 (0.0000%) |
| BTCUSDT | 52 | Poor: 40 (76.9231%)<br>Limited: 12 (23.0769%)<br>Acceptable: 0 (0.0000%)<br>Strong: 0 (0.0000%) |
| ETHUSDT | 52 | Poor: 34 (65.3846%)<br>Limited: 18 (34.6154%)<br>Acceptable: 0 (0.0000%)<br>Strong: 0 (0.0000%) |

## 10. EV After Costs Diagnostics

EV is still correctly trade-derived from closed net backtest trades through `calculateExpectedValueFromTrades(fullBacktest.trades)`. In this path, trade fees and slippage have already been reflected in each trade's `netReturnPct`; `expectedValue.costs.averageTradeCost` is reported from the realized closed trades for audit visibility.

| Symbol | EV After Costs <= 0 | Avg EV After Costs | Median EV After Costs | Avg Win | Avg Loss | Avg Payoff Ratio | Avg Profit Factor | Avg Trade Cost |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AAPL | 7 (17.5000%) | 0.7449% | 0.8081% | 9.3328% | -2.1187% | 3.7375 | Not meaningful | 0.3630% |
| SPY | 11 (27.5000%) | 0.1858% | 0.2324% | 3.9345% | -1.0860% | 3.2533 | 1.2650 | 0.3607% |
| QQQ | 4 (10.0000%) | 0.4792% | 0.4636% | 6.5566% | -1.3332% | 4.1636 | Not meaningful | 0.3623% |
| BTCUSDT | 11 (21.1538%) | 4.1237% | 5.4279% | 50.2573% | -6.2209% | 9.5321 | 2.5644 | 0.3931% |
| ETHUSDT | 11 (21.1538%) | 4.7082% | 5.4446% | 40.1020% | -3.9108% | 7.3099 | Not meaningful | 0.3507% |

## 11. Payoff Ratio and Raw Kelly Diagnostics

| Symbol | Payoff Ratio <= 0 | Raw Kelly <= 0 | Raw Kelly > 0 But Final Kelly = 0 | Max Raw Kelly | Max Final Kelly |
| --- | --- | --- | --- | --- | --- |
| AAPL | 5 (12.5000%) | 8 (20.0000%) | 10 (25.0000%) | 57.5768% | 0.3640% |
| SPY | 4 (10.0000%) | 11 (27.5000%) | 8 (20.0000%) | 23.6316% | 0.2565% |
| QQQ | 5 (12.5000%) | 5 (12.5000%) | 15 (37.5000%) | 37.7841% | 0.2819% |
| BTCUSDT | 10 (19.2308%) | 11 (21.1538%) | 29 (55.7692%) | 43.4266% | 0.2553% |
| ETHUSDT | 15 (28.8462%) | 15 (28.8462%) | 19 (36.5385%) | 37.0411% | 0.2405% |

## 12. Allocation Impact

Buckets use active allocation after final decision gating.

| Symbol | Rows | Active Allocation Bucket Distribution |
| --- | --- | --- |
| AAPL | 40 | 0%: 32 (80.0000%)<br>>0% to 0.25%: 1 (2.5000%)<br>0.25% to 0.50%: 7 (17.5000%)<br>0.50% to 1.00%: 0 (0.0000%)<br>1.00% to 2.00%: 0 (0.0000%)<br>2.00% to 5.00%: 0 (0.0000%)<br>>5.00%: 0 (0.0000%) |
| SPY | 40 | 0%: 28 (70.0000%)<br>>0% to 0.25%: 11 (27.5000%)<br>0.25% to 0.50%: 1 (2.5000%)<br>0.50% to 1.00%: 0 (0.0000%)<br>1.00% to 2.00%: 0 (0.0000%)<br>2.00% to 5.00%: 0 (0.0000%)<br>>5.00%: 0 (0.0000%) |
| QQQ | 40 | 0%: 29 (72.5000%)<br>>0% to 0.25%: 6 (15.0000%)<br>0.25% to 0.50%: 5 (12.5000%)<br>0.50% to 1.00%: 0 (0.0000%)<br>1.00% to 2.00%: 0 (0.0000%)<br>2.00% to 5.00%: 0 (0.0000%)<br>>5.00%: 0 (0.0000%) |
| BTCUSDT | 52 | 0%: 49 (94.2308%)<br>>0% to 0.25%: 2 (3.8462%)<br>0.25% to 0.50%: 1 (1.9231%)<br>0.50% to 1.00%: 0 (0.0000%)<br>1.00% to 2.00%: 0 (0.0000%)<br>2.00% to 5.00%: 0 (0.0000%)<br>>5.00%: 0 (0.0000%) |
| ETHUSDT | 52 | 0%: 52 (100.0000%)<br>>0% to 0.25%: 0 (0.0000%)<br>0.25% to 0.50%: 0 (0.0000%)<br>0.50% to 1.00%: 0 (0.0000%)<br>1.00% to 2.00%: 0 (0.0000%)<br>2.00% to 5.00%: 0 (0.0000%)<br>>5.00%: 0 (0.0000%) |

## 13. Counterfactual Replay Results

Counterfactual variants:

1. Current production Kelly.
2. Remove only the tradeCount < 30 hard-zero and replace that trade-count portion with a diagnostic soft penalty: <10 = 0, 10-19 = 0.10, 20-29 = 0.20, then production multipliers above 30.
3. Replace the trade-count cliff with the diagnostic curve: <10 = 0, 10-19 = 0.10, 20-29 = 0.20, 30-49 = 0.35, 50-99 = 0.60, 100-199 = 0.80, 200+ = 1.00.

All variants keep EV-negative hard-zero, payoffRatio <= 0 hard-zero, sampleQuality production multipliers, crypto's stricter Kelly fraction, crypto caps, hard filters, validation evidence, and final decision gating.

| Symbol | Variant | Avg FractionalKellyAllocation | Avg finalPositionSize | Avg activeAllocation | % active > 0 | % active >= 0.25% | % active >= 0.50% | % active >= 1.00% | Total Return | Max Drawdown | Trades | Exposure Reckless? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AAPL | Current production Kelly | 0.1485% | 0.0586% | 0.0586% | 20.0000% | 17.5000% | 0.0000% | 0.0000% | 0.0056% | -0.1194% | 12 | No, exposure stayed small |
| AAPL | Diagnostic soft penalty below 30 trades only | 0.1485% | 0.0586% | 0.0586% | 20.0000% | 17.5000% | 0.0000% | 0.0000% | 0.0056% | -0.1194% | 12 | No, exposure stayed small |
| AAPL | Diagnostic full trade-count curve | 0.1710% | 0.0630% | 0.0630% | 20.0000% | 20.0000% | 0.0000% | 0.0000% | -0.0213% | -0.1338% | 12 | No, exposure stayed small |
| SPY | Current production Kelly | 0.1014% | 0.0625% | 0.0625% | 30.0000% | 2.5000% | 0.0000% | 0.0000% | 0.0486% | -0.0301% | 16 | No, exposure stayed small |
| SPY | Diagnostic soft penalty below 30 trades only | 0.1014% | 0.0625% | 0.0625% | 30.0000% | 2.5000% | 0.0000% | 0.0000% | 0.0486% | -0.0301% | 16 | No, exposure stayed small |
| SPY | Diagnostic full trade-count curve | 0.1201% | 0.0708% | 0.0708% | 30.0000% | 7.5000% | 0.0000% | 0.0000% | 0.0465% | -0.0301% | 16 | No, exposure stayed small |
| QQQ | Current production Kelly | 0.1161% | 0.0673% | 0.0673% | 27.5000% | 12.5000% | 0.0000% | 0.0000% | 0.0604% | -0.0584% | 14 | No, exposure stayed small |
| QQQ | Diagnostic soft penalty below 30 trades only | 0.1161% | 0.0673% | 0.0673% | 27.5000% | 12.5000% | 0.0000% | 0.0000% | 0.0604% | -0.0584% | 14 | No, exposure stayed small |
| QQQ | Diagnostic full trade-count curve | 0.1484% | 0.0815% | 0.0815% | 27.5000% | 15.0000% | 0.0000% | 0.0000% | 0.0631% | -0.0702% | 14 | No, exposure stayed small |
| BTCUSDT | Current production Kelly | 0.0516% | 0.0140% | 0.0140% | 5.7692% | 1.9231% | 0.0000% | 0.0000% | 0.0108% | -0.0789% | 5 | No, exposure stayed small |
| BTCUSDT | Diagnostic soft penalty below 30 trades only | 0.0516% | 0.0140% | 0.0140% | 5.7692% | 1.9231% | 0.0000% | 0.0000% | 0.0108% | -0.0789% | 5 | No, exposure stayed small |
| BTCUSDT | Diagnostic full trade-count curve | 0.0516% | 0.0140% | 0.0140% | 5.7692% | 1.9231% | 0.0000% | 0.0000% | 0.0108% | -0.0789% | 5 | No, exposure stayed small |
| ETHUSDT | Current production Kelly | 0.0701% | 0.0000% | 0.0000% | 0.0000% | 0.0000% | 0.0000% | 0.0000% | 0.0000% | 0.0000% | 0 | No, exposure stayed small |
| ETHUSDT | Diagnostic soft penalty below 30 trades only | 0.0701% | 0.0000% | 0.0000% | 0.0000% | 0.0000% | 0.0000% | 0.0000% | 0.0000% | 0.0000% | 0 | No, exposure stayed small |
| ETHUSDT | Diagnostic full trade-count curve | 0.0701% | 0.0000% | 0.0000% | 0.0000% | 0.0000% | 0.0000% | 0.0000% | 0.0000% | 0.0000% | 0 | No, exposure stayed small |

## 14. Is the Hard-Zero Below 30 Trades Justified?

It is justified as a safety rule, but it is too cliff-like as a sizing rule for a low-frequency trend-following system. The audit shows the 30-trade boundary is applied twice: first by `tradeCountMultiplier`, and again by `sampleQuality === "Poor"`. Because both derive from the same threshold, removing only the trade-count hard-zero does not fully test whether small positive Kelly would be mathematically justified; Poor sample quality still forces the final Kelly multiplier to zero.

The hard-zero is reasonable when EV is negative, payoff ratio is invalid, or raw Kelly is non-positive. It is less clearly justified when raw Kelly is positive, EV after costs is positive, and the only blocker is a small but nonzero closed-trade sample.

## 15. Is the 100-Trade Limited-Sample Cutoff Too Strict?

The 100-trade cutoff is conservative and cliff-like. Production applies both a Limited sample multiplier of 0.25x and a 30-99 trade-count multiplier of 0.35x, creating a combined 0.0875x multiplier before the base Kelly fraction. For equities/ETFs, that means raw Kelly is multiplied by 0.0175 in the 30-99 band. For crypto, raw Kelly is multiplied by 0.00875. That can easily shrink otherwise positive Kelly below 0.25% or 0.50%.

This may be appropriate for avoiding overconfidence, but it is the main mathematical mechanism behind capital starvation once EV and decision gates are passed.

## 16. Do Equities/ETFs and Crypto Need Separate Kelly Penalty Curves?

Yes, but not by relaxing crypto. Crypto already remains stricter through the lower 0.1 Kelly fraction and lower BTC/ETH allocation cap. The audit supports separate curves because equities/ETFs and crypto have different trading calendars, volatility, fee/slippage realities, and drawdown behavior. Any future production change should preserve crypto strictness and evaluate equity/ETF softening separately.

## 17. Recommended Next Action

Do not change Kelly production behavior yet.

The next action should be a targeted design review of the duplicate small-sample gates. Specifically, evaluate whether `sampleQuality === "Poor"` should remain a hard-zero if `tradeCountMultiplier` already handles the same threshold, or whether one of those should become a graded diagnostic penalty. Keep EV <= 0, payoffRatio <= 0, and rawKelly <= 0 as hard-zero conditions.
