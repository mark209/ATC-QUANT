import type { BacktestSummary, BacktestValidationResult } from "@/types/quant";
import { formatNumber, formatPercent } from "./format";
import { EquityCurveChart } from "./QuantCharts";

export function BacktestPanel({ backtest, validation }: { backtest: BacktestSummary; validation?: BacktestValidationResult }) {
  const stats = [
    ["Total return", formatPercent(backtest.totalReturn)],
    ["CAGR", formatPercent(backtest.cagr)],
    ["Annualized volatility", formatPercent(backtest.annualizedVolatility)],
    ["Sharpe", formatNumber(backtest.sharpeRatio)],
    ["Sortino", formatNumber(backtest.sortinoRatio)],
    ["Calmar", formatNumber(backtest.calmarRatio)],
    ["Max drawdown", formatPercent(backtest.maxDrawdown)],
    ["Total trades", formatNumber(backtest.totalTrades)],
    ["Exposure time", formatPercent(backtest.exposureTime)],
    ["Turnover", formatPercent(backtest.turnover)],
    ["Longest losing streak", formatNumber(backtest.longestLosingStreak)],
    ["Profit factor", formatNumber(backtest.profitFactor)],
    ["Expectancy", formatPercent(backtest.expectancy, 2)],
    ["Average win", formatPercent(backtest.averageWin, 2)],
    ["Average loss", formatPercent(backtest.averageLoss, 2)]
  ];

  return (
    <div>
      <EquityCurveChart backtest={backtest} />
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-md border border-line bg-white/[0.03] p-3">
            <p className="text-xs text-slate-400">{label}</p>
            <p className="mt-1 font-bold text-white">{value}</p>
          </div>
        ))}
      </div>
      {validation && (
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-line bg-white/[0.03] p-4">
            <p className="text-xs font-bold uppercase tracking-normal text-cyan">In-sample</p>
            <p className="mt-2 text-2xl font-black text-white">{formatPercent(validation.inSample.totalReturn)}</p>
            <p className="mt-1 text-xs text-slate-400">Max DD {formatPercent(validation.inSample.maxDrawdown)}</p>
          </div>
          <div className="rounded-lg border border-line bg-white/[0.03] p-4">
            <p className="text-xs font-bold uppercase tracking-normal text-cyan">Out-of-sample</p>
            <p className="mt-2 text-2xl font-black text-white">{formatPercent(validation.outOfSample.totalReturn)}</p>
            <p className="mt-1 text-xs text-slate-400">Max DD {formatPercent(validation.outOfSample.maxDrawdown)}</p>
          </div>
          <div className="rounded-lg border border-line bg-white/[0.03] p-4">
            <p className="text-xs font-bold uppercase tracking-normal text-cyan">Walk-forward</p>
            <p className="mt-2 text-2xl font-black text-white">{validation.walkForward.stabilityLabel}</p>
            <p className="mt-1 text-xs text-slate-400">
              {validation.walkForward.stableWindows}/{validation.walkForward.windowsTested} stable windows
            </p>
          </div>
          <div className="rounded-lg border border-line bg-white/[0.03] p-4 lg:col-span-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">Parameter sensitivity</p>
                <p className="mt-1 text-xs text-slate-400">{validation.parameterSensitivity.sensitivityLabel}</p>
              </div>
              <p className="text-sm font-bold text-white">Validation score {validation.validationScore}/100</p>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-5">
              {validation.parameterSensitivity.testedParameters.map((item) => (
                <div key={`${item.fastWindow}/${item.slowWindow}`} className="rounded-md border border-line bg-white/[0.03] p-3">
                  <p className="text-xs text-slate-400">
                    {item.fastWindow}/{item.slowWindow}
                  </p>
                  <p className="mt-1 font-bold text-white">{formatPercent(item.totalReturn)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <p className="mt-4 text-xs leading-5 text-slate-500">
        Historical simulation only. Fees and slippage are included as assumptions and do not imply future performance.
      </p>
    </div>
  );
}
