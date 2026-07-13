# MASTER CRYPTO REPORT

Generated: 2026-07-13T22:48:38.022Z
Asset class: crypto
Timeframe: 1d
Conclusion: **CRYPTO EVIDENCE EXPANDED BUT NOT PRODUCTION-READY: sample sizes are small and verification failures remain.**

## Dataset Comparison
| Asset | Trades | Win Rate | Expectancy | Profit Factor | Max Drawdown | Sharpe | Sortino | MC Worst 5% | Bootstrap Expectancy | Confidence | Robustness |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|
| ADAUSDT | 7 | 14.29% | -52.83 | 0.40 | 0.41% | -8.39 | -14.02 | 99630.18 | -139.17 to 58.11 | 0.117 | 0.996 |
| AVAXUSDT | 7 | 14.29% | -56.91 | 0.48 | 0.47% | -5.45 | -10.53 | 99601.61 | -186.73 to 101.55 | 0.117 | 0.498 |
| BNBUSDT | 22 | 22.73% | 22.46 | 2.04 | 0.23% | 3.72 | 32.20 | 100494.21 | -29.55 to 96.47 | 0.367 | 0.000 |
| BTCUSDT | 14 | 28.57% | 1939.46 | 2.37 | 10.31% | 4.84 | 24.05 | 127152.49 | -1394.38 to 6104.14 | 0.233 | 0.195 |
| DOGEUSDT | 4 | 50.00% | 34.61 | 2.07 | 0.13% | 6.17 | 120.44 | 100138.43 | -64.43 to 184.16 | 0.067 | 0.000 |
| ETHUSDT | 7 | 14.29% | 19.71 | 1.22 | 0.64% | 2.40 | 26.48 | 100137.98 | -127.89 to 280.10 | 0.117 | 0.000 |
| LINKUSDT | 3 | 33.33% | -8.41 | 0.63 | 0.07% | 0.71 | 14.71 | 99974.76 | -35.34 to 42.58 | 0.050 | 0.500 |
| SOLUSDT | 8 | 25.00% | 62.44 | 2.05 | 0.37% | 3.29 | 17.80 | 100499.54 | -83.26 to 280.04 | 0.133 | 0.000 |
| XRPUSDT | 10 | 0.00% | -41.20 | 0.00 | 0.41% | -17.88 | -17.88 | 99588.00 | -74.52 to -16.52 | 0.167 | 0.498 |

## Research Highlights
Best composite dataset: binance-bnbusdt-1d-crypto-research-v1
Worst composite dataset: binance-linkusdt-1d-crypto-research-v1
Most robust dataset: binance-adausdt-1d-crypto-research-v1
Highest confidence dataset: binance-bnbusdt-1d-crypto-research-v1

## Known Limitations
- Each symbol currently has one daily dataset; asset-level independence is preserved, but cross-asset inference remains limited.
- A dataset with fewer than 30 completed trades is exploratory and should not support a production edge claim.
- Order-only Monte Carlo preserves total ending equity; it tests path and drawdown sensitivity, not outcome uncertainty.
- The existing verifier reports lifecycle timestamp ordering failures on these artifacts; verification must be remediated before production claims.
