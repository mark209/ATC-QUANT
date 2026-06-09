# AGENTS.md

You are working on ATC Quant, a research and risk-analysis system.

Do not rebuild the app from scratch.
Do not replace the current core strategy.
Preserve the Regime-Based Volatility-Targeted Trend Following architecture.

Main priority:
- Add validation, backtesting, risk, and audit features.
- Keep calculations pure and testable.
- Do not add RSI, MACD, sentiment, neural networks, or fake confidence scores.
- Avoid dangerous wording like guaranteed buy, guaranteed profit, risk-free, or certainty.
- Use decision labels such as Strong candidate, Position allowed, Small allocation only, Watchlist only, Avoid for now, Risk-off / no trade.

Before changing code:
1. Inspect the repo structure.
2. Identify existing scoring, sizing, backtest, data, and UI files.
3. Explain the current architecture.
4. Propose a small implementation plan.
5. Make minimal, safe changes.
6. Add tests where possible.
