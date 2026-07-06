# ATC Allocation Distribution Audit

This report answers when the system allocates 0%, sub-0.25%, 0.25%, 0.5%, 1%, and larger sizes. It is diagnostic only and does not change production sizing.

## Allocation Buckets

| Symbol | Rows | 0% Days | Active Days | >= 1% Days | Avg Allocation | Avg Nonzero Allocation | Bucket Distribution |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SPY | 120 | 84 | 36 | 0 | 0.07% | 0.23% | 0%: 84 (70.00%)<br>>0% to 0.25%: 26 (21.67%)<br>0.25% to 0.50%: 10 (8.33%)<br>0.50% to 1.00%: 0 (0.00%)<br>1.00% to 2.00%: 0 (0.00%)<br>2.00% to 5.00%: 0 (0.00%)<br>>5.00%: 0 (0.00%) |
| QQQ | 120 | 82 | 38 | 0 | 0.08% | 0.25% | 0%: 82 (68.33%)<br>0.25% to 0.50%: 22 (18.33%)<br>>0% to 0.25%: 16 (13.33%)<br>0.50% to 1.00%: 0 (0.00%)<br>1.00% to 2.00%: 0 (0.00%)<br>2.00% to 5.00%: 0 (0.00%)<br>>5.00%: 0 (0.00%) |
| AAPL | 120 | 94 | 26 | 0 | 0.06% | 0.29% | 0%: 94 (78.33%)<br>0.25% to 0.50%: 19 (15.83%)<br>>0% to 0.25%: 7 (5.83%)<br>0.50% to 1.00%: 0 (0.00%)<br>1.00% to 2.00%: 0 (0.00%)<br>2.00% to 5.00%: 0 (0.00%)<br>>5.00%: 0 (0.00%) |
| BTCUSDT | 155 | 144 | 11 | 0 | 0.02% | 0.25% | 0%: 144 (92.90%)<br>>0% to 0.25%: 6 (3.87%)<br>0.25% to 0.50%: 5 (3.23%)<br>0.50% to 1.00%: 0 (0.00%)<br>1.00% to 2.00%: 0 (0.00%)<br>2.00% to 5.00%: 0 (0.00%)<br>>5.00%: 0 (0.00%) |
| ETHUSDT | 155 | 154 | 1 | 0 | 0.00% | 0.24% | 0%: 154 (99.35%)<br>>0% to 0.25%: 1 (0.65%)<br>0.25% to 0.50%: 0 (0.00%)<br>0.50% to 1.00%: 0 (0.00%)<br>1.00% to 2.00%: 0 (0.00%)<br>2.00% to 5.00%: 0 (0.00%)<br>>5.00%: 0 (0.00%) |

## Blocking Rules

| Symbol | Main Blocking Rule | Blocking Distribution |
| --- | --- | --- |
| SPY | Sub-meaningful allocation | Sub-meaningful allocation: 36 (30.00%)<br>Kelly/sample-size sizing: 20 (16.67%)<br>No validation evidence: 18 (15.00%)<br>Final decision zeroed allocation: 14 (11.67%)<br>Expected value failed: 13 (10.83%)<br>Data quality failed: 12 (10.00%)<br>Risk-off regime: 7 (5.83%) |
| QQQ | Sub-meaningful allocation | Sub-meaningful allocation: 38 (31.67%)<br>Kelly/sample-size sizing: 22 (18.33%)<br>No validation evidence: 21 (17.50%)<br>Final decision zeroed allocation: 13 (10.83%)<br>Data quality failed: 12 (10.00%)<br>Risk-off regime: 11 (9.17%)<br>Failed validation evidence: 2 (1.67%)<br>Expected value failed: 1 (0.83%) |
| AAPL | Sub-meaningful allocation | Sub-meaningful allocation: 26 (21.67%)<br>Failed validation evidence: 24 (20.00%)<br>No validation evidence: 17 (14.17%)<br>Final decision zeroed allocation: 14 (11.67%)<br>Kelly/sample-size sizing: 13 (10.83%)<br>Data quality failed: 12 (10.00%)<br>Expected value failed: 7 (5.83%)<br>Risk-off regime: 7 (5.83%) |
| BTCUSDT | Risk-off regime | Risk-off regime: 75 (48.39%)<br>Kelly/sample-size sizing: 27 (17.42%)<br>Failed validation evidence: 18 (11.61%)<br>Data quality failed: 12 (7.74%)<br>Sub-meaningful allocation: 11 (7.10%)<br>No validation evidence: 6 (3.87%)<br>Final decision zeroed allocation: 6 (3.87%) |
| ETHUSDT | Risk-off regime | Risk-off regime: 95 (61.29%)<br>Failed validation evidence: 43 (27.74%)<br>Data quality failed: 12 (7.74%)<br>No validation evidence: 3 (1.94%)<br>Kelly/sample-size sizing: 1 (0.65%)<br>Sub-meaningful allocation: 1 (0.65%) |

## Interpretation

- 0% allocation usually means one of: data quality failed, risk-off regime, EV failed, validation evidence was absent/failed, Kelly was zero, or final decision labels zeroed exposure.
- 0.25% to 1% allocation means the system is technically deploying capital but may still be economically too small after fees, slippage, and opportunity cost.
- 1% or greater allocation is the first bucket treated here as meaningful deployment.
- If most rows sit below 1%, the system can be analytically right and still unable to produce meaningful monthly profits.
