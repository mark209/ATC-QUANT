# ATC Statistical Edge Audit

Audit date: 2026-07-12

Scope: current repository implementation only. No strategy logic, parameters, execution behavior, or live-trading paths were modified.

## Executive Verdict

The current repository does **not provide evidence of a statistically significant trading edge**. This is not a finding that the strategy is unprofitable; it is a finding that profitability cannot be established from the available artifacts.

The repository contains an aggregate daily trend backtest, but it does not contain a completed-trade journal, replay trade log, CSV export, JSON trade log, or any persisted trade-level dataset. Therefore the extracted closed-trade dataframe contains **0 rows**. All statistics requiring closed trades, including confidence intervals, p-values, bootstrap results, Monte Carlo results, Kelly estimates, risk of ruin, and conditional expectancy, are not estimable without inventing data.

**Current status: inconclusive due to missing trade-level evidence. ATC should remain paper-only.**

## 1. System Discovery

### Located components

| Component | Location | Finding |
|---|---|---|
| Signal generation | `src/lib/quant/signalLayer.ts`, `trend.ts`, `momentum.ts` | Daily moving-average, slope, and multi-window momentum signal. |
| Risk generation | `src/lib/quant/riskLayer.ts`, `riskRegime.ts` | Volatility, drawdown, liquidity, and risk-regime scoring. |
| Validation | `src/lib/quant/validation.ts` | 70/30 split, conditional walk-forward, and fixed parameter sensitivity checks. |
| Execution decision | `src/lib/quant/decisionEngine.ts` | Labels and blocking reasons; no broker execution found. |
| Position sizing | `src/lib/quant/positionSizing.ts` | Volatility target, fractional Kelly, asset cap, drawdown control, and risk-profile multiplier. |
| Replay/backtest | `src/lib/quant/backtest.ts` | Aggregate daily equity-curve simulation. No persisted trade records. |
| Data adapters | `src/lib/data/equityAdapter.ts`, `binanceAdapter.ts` | Live public market-data adapters only. No brokerage execution adapter found. |
| Reports | `src/lib/reports/reportGenerator.ts`, dashboard components | Human-readable aggregate analysis and charts. |
| Tests | `tests/quant/*.test.ts` | Unit tests for functions and pipeline objects; no fixture of closed trades. |

### Not found

The repository contains no authoritative source for:

- completed trades;
- entry and exit timestamps;
- order/fill records;
- stop-loss or take-profit executions;
- commissions, spread, or realized slippage per trade;
- trade IDs or position lifecycle IDs;
- forward replay decisions;
- trade CSV, JSON, JSONL, or database exports;
- a trade-level dataframe.

The only trade-like values are transient arrays inside `runTrendBacktest`. They are not returned, persisted, or attributable to an instrument, decision, regime, or indicator state.

## 2. Data Availability and Quality

| Dataset | Rows available | Usable for closed-trade audit |
|---|---:|---|
| Completed trades | 0 | No |
| Forward trades | 0 | No |
| Trade journal | Not present | No |
| Trade CSV/JSON logs | Not present | No |
| Aggregate equity curves | Generated in memory only | Partially, not trade-level |
| Market OHLCV fixtures | No repository fixture found | No reproducible historical sample |

The application fetches current public market data from Yahoo and Binance adapters. That is not a historical trade ledger and cannot establish what the strategy actually did in the past. Re-running it against current data would also not be a valid untouched forward test.

## 3. Requested Core Statistics

The following metrics are **not computable** from the repository because there are zero closed trades:

- total, winning, losing, and breakeven trades;
- win/loss rate, average/median/largest win and loss;
- average/median/total R and expectancy in R, dollars, or percent;
- profit factor, recovery factor, payoff ratio;
- maximum, average, and longest trade drawdown;
- consecutive wins and losses;
- holding time and trade frequency;
- monthly and annualized realized return;
- realized Sharpe, Sortino, Calmar, MAR, Ulcer Index, and return volatility;
- Kelly fraction and risk of ruin.

The backtest exposes aggregate fields with these names, but those fields are not equivalent to completed-trade statistics. In particular, `calculateExpectedValue` receives daily strategy returns, not closed-trade returns, and `runTrendBacktest` counts signal state changes rather than completed round trips.

## 4. Probability and Monte Carlo Analysis

No valid Monte Carlo distribution can be generated. A 10,000-path simulation requires an observed return or trade sample. With zero observations, any simulated curve would be an assumption rather than a resampling analysis.

The following are therefore unavailable:

- probability of consecutive losses or wins;
- probability of 10 or 15 losing trades;
- probability of a new equity high;
- expected losing or winning streak;
- worst, best, median, and 95% equity curves;
- probability of ruin, drawdown beyond 10% or 20%, or doubling.

## 5. Statistical Significance

Bootstrap confidence intervals, Student's t-test, binomial test, and permutation test were not run because their required input sample is empty. Reporting a p-value or confidence interval from zero trades would be invalid.

The minimum evidence needed before significance testing is meaningful is:

1. A deterministic trade-level dataset with at least 100 closed trades for a preliminary estimate.
2. At least 250 to 500 closed trades across multiple assets and regimes for a more credible robustness assessment.
3. An untouched chronological holdout that was not used for signal design, threshold selection, or report selection.
4. Explicit cost and fill records, including spread, commissions, slippage, and execution delay.

## 6. Current Implementation Findings

### High-severity evidence limitations

1. **No completed-trade persistence.** `runTrendBacktest` maintains `tradeReturns` internally but returns only aggregate fields and an equity curve. There is no entry/exit record to audit.
2. **Aggregate expected value is mislabeled for a trade audit.** `calculateExpectedValue` is called with daily simple returns in `backtest.ts` and `scoring.ts`. It does not calculate closed-trade expectancy.
3. **Trade count is not closed-trade count.** The backtest increments `trades` whenever the signal changes, including both entry and exit transitions. This can count one round trip as two state changes.
4. **Win/loss metrics are daily-return metrics.** The backtest passes strategy equity-curve returns to `calculateExpectedValue`; those are not the same as independent trade outcomes.
5. **Best/worst trade fields are not trade-level.** `largestSingleLoss` uses strategy daily returns, while `bestTrade` and `worstTrade` use transient holding aggregates. The fields are not defined consistently.
6. **No reproducible historical data artifact.** The adapters request live provider data. There is no frozen input dataset with a data version, retrieval timestamp, adjustment policy, and survivorship universe.

### Lookahead and execution observations

- The backtest computes the signal from `closes[index]` and applies the associated return at `simpleReturns[index]`, which is a one-bar signal-delay proxy. This is directionally safer than using the same close for both decision and fill, but it is not a recorded order/fill model.
- The simulation applies `fees` and `slippage` on every signal state transition, but spread is not applied by the backtest call path. Costs are assumptions, not realized transaction records.
- There is no explicit latency model, bid/ask model, partial-fill model, gap-through-stop model, or missing-trade model.
- There is no proof that the source universe avoids survivorship bias. The adapters accept symbols selected by the caller and do not maintain a historical constituent universe.
- Validation uses fixed windows and fixed parameter candidates. It is not evidence of significance and should not be interpreted as an independent statistical test.

### Risk and sizing observations

- `fractionalKelly` returns zero for non-positive expected value, non-positive payoff, or `Poor` sample quality. For fewer than 30 observations, the sample multiplier is zero.
- `Limited` sample quality receives a 0.25 multiplier, so the allocation can be heavily suppressed before there is any trade-level evidence.
- The final allocation is the minimum of volatility targeting, fractional Kelly, asset cap, and drawdown control. The limiting factor is exposed, which is useful diagnostically, but no historical distribution of limiting factors is stored.
- Risk-off regimes can reduce allocation to zero. This may be prudent, but its opportunity cost cannot be assessed without rejected-opportunity and subsequent-return records.

## 7. Expectancy and Edge Discovery

Expectancy by regime, time of day, weekday, instrument, evidence score, confidence, trend strength, volatility, liquidity, and indicator contribution is unavailable because the system does not persist these fields alongside completed trades.

The current code can produce some contemporaneous signal and risk scores, but it does not prove that those scores predict subsequent returns. A score contribution is not evidence of causal or incremental edge.

No filters should be removed or changed based on this audit.

## 8. Robustness Analysis

Sensitivity to spread, commission, slippage, latency, missing trades, skipped winners, and skipped losers is not estimable from observed trade records. The existing backtest can vary fee and slippage arguments, but without a frozen historical input and trade-level output, those scenarios are model assumptions rather than an audit of realized execution behavior.

## 9. Equity-Curve Analysis

An in-memory equity curve is produced by the backtest, but there is no persisted market-data fixture or report snapshot from which to reproduce and independently inspect it. Rolling profit factor, rolling expectancy, rolling win rate, rolling Sharpe, and rolling drawdown are not produced by the repository.

Consequently, performance decay, regime dependence, and outlier dependence cannot be distinguished from data selection or current-data effects.

## 10. Objective Ratings

These are evidence-quality ratings, not claims about the underlying strategy's future performance:

| Dimension | Rating | Reason |
|---|---:|---|
| Statistical edge | 0/100 | No closed-trade observations. |
| Robustness | 5/100 | Some validation scaffolding exists, but no independent trade evidence. |
| Consistency | 0/100 | No realized trade sequence. |
| Risk measurement | 15/100 | Aggregate drawdown and volatility functions exist, but no realized execution record. |
| Generalization | 5/100 | No frozen historical universe or untouched trade sample. |

The ratings must not be interpreted as a measured strategy return or as a claim that the system has no predictive value. They reflect the absence of evidence required to measure it.

| Forecast item | Result |
|---|---|
| Probability edge is real | Not estimable |
| Probability results are overfit | Not estimable; overfit risk is material because evidence is absent |
| Probability strategy survives live trading | Not estimable; do not assume survival |
| Expected monthly return | Not estimable |
| Expected annual return | Not estimable |
| Expected maximum drawdown | Not estimable |
| Expected profit factor | Not estimable |
| Expected Sharpe ratio | Not estimable |
| Long-term expectancy | Not estimable |

## 11. Final Answers

### 1. Does the system currently have a measurable statistical edge?

No. The repository does not contain the trade-level observations required to measure one.

### 2. Is the edge statistically significant?

No conclusion is possible. Significance tests cannot be validly run with zero closed trades.

### 3. Is the sample size sufficient?

No. The closed-trade sample available to this audit is zero.

### 4. Would I trust this system on a live account?

No. It should remain paper-only until a separate, frozen, cost-aware forward dataset demonstrates positive expectancy with uncertainty bounds and regime coverage.

### 5. What evidence is still missing?

Every completed position needs a durable record containing at least:

```text
trade_id
strategy_version
data_snapshot_id
instrument
direction
entry_timestamp
exit_timestamp
entry_decision_timestamp
entry_price
exit_price
stop_loss
take_profit
quantity
notional_value
risk_fraction
gross_pnl
net_pnl
return_pct
r_multiple
commission
spread_cost
slippage_cost
execution_delay_ms
entry_reason
exit_reason
signal_scores
indicator_values_used_at_entry
evidence_score
validation_grade
confidence_score
market_regime
volatility_regime
liquidity_condition
planned_fill_price
actual_fill_price
fill_status
```

The log must be append-only, deterministically keyed, timestamped in UTC, and linked to an immutable market-data snapshot. Pending positions must be recorded separately from closed trades; missing outcomes must not be treated as zero returns.

## Recommended Next Step

Add paper-only, append-only trade lifecycle logging and freeze a historical replay dataset. Do not change the strategy or parameters. After at least 100 closed trades, run a preliminary audit; after 250 to 500 trades across multiple assets and regimes, run the full bootstrap, permutation, Monte Carlo, and robustness analysis on an untouched forward window.

Until then, the only defensible conclusion is:

> **ATC's statistical edge is unproven. Keep it paper-only and do not allocate real capital.**

## Verification

- `npm run typecheck`: passed.
- `npm test`: passed, 8 test files and 21 tests.
- No trading logic or parameters were modified.
