# SESSION_VALIDATION_REPORT

| Dataset | Session type | Accepted gaps | Weekend gaps | Holiday gaps | Rejected gaps | Out-of-session bars | Status |
|---|---|---:|---:|---:|---:|---:|---|
| binance-btcusdt-1d-real-2023-present | CRYPTO_24_7 | 0 | 0 | 0 | 0 | 0 | VALID |
| binance-ethusdt-1d-crypto-research-v1 | CRYPTO_24_7 | 0 | 0 | 0 | 0 | 0 | VALID |
| binance-btcusdt-1d-crypto-research-v2 | CRYPTO_24_7 | 0 | 0 | 0 | 0 | 0 | VALID |
| binance-bnbusdt-1d-crypto-research-v1 | CRYPTO_24_7 | 0 | 0 | 0 | 0 | 0 | VALID |
| binance-solusdt-1d-crypto-research-v1 | CRYPTO_24_7 | 0 | 0 | 0 | 0 | 0 | VALID |
| binance-xrpusdt-1d-crypto-research-v1 | CRYPTO_24_7 | 0 | 0 | 0 | 0 | 0 | VALID |
| binance-adausdt-1d-crypto-research-v1 | CRYPTO_24_7 | 0 | 0 | 0 | 0 | 0 | VALID |
| binance-dogeusdt-1d-crypto-research-v1 | CRYPTO_24_7 | 0 | 0 | 0 | 0 | 0 | VALID |
| binance-linkusdt-1d-crypto-research-v1 | CRYPTO_24_7 | 0 | 0 | 0 | 0 | 0 | VALID |
| binance-avaxusdt-1d-crypto-research-v1 | CRYPTO_24_7 | 0 | 0 | 0 | 0 | 0 | VALID |
| binance-btcusdt-1d-crypto-long-horizon-v1 | CRYPTO_24_7 | 0 | 0 | 0 | 0 | 0 | VALID |
| binance-ethusdt-1d-crypto-long-horizon-v1 | CRYPTO_24_7 | 0 | 0 | 0 | 0 | 0 | VALID |
| binance-bnbusdt-1d-crypto-long-horizon-v1 | CRYPTO_24_7 | 0 | 0 | 0 | 0 | 0 | VALID |

## Calendar assumptions
- `CRYPTO_24_7` requires continuous 24-hour progression.
- `US_EQUITY` uses NYSE/NASDAQ weekday sessions; weekends and recognized US exchange holidays are accepted gaps.
- `FOREX` and `FUTURES` accept weekends as closures but reject unexpected weekday gaps until a more specific exchange calendar is declared.
- No timestamps are changed and no candles are fabricated or interpolated.
