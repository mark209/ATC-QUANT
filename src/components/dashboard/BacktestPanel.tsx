import type { BacktestSummary, BacktestValidationResult, DataQualityResult, EntryZoneAblationResult } from "@/types/quant";
import { formatNumber, formatPercent } from "./format";
import { EquityCurveChart } from "./QuantCharts";

export function BacktestPanel({
  backtest,
  allocationAdjustedBacktest,
  validation,
  dataQuality,
  entryZoneAblation
}: {
  backtest: BacktestSummary;
  allocationAdjustedBacktest?: BacktestSummary;
  validation?: BacktestValidationResult;
  dataQuality?: DataQualityResult;
  entryZoneAblation?: EntryZoneAblationResult;
}) {
  const primaryBacktest = allocationAdjustedBacktest ?? backtest;
  const hasAllocationAdjusted = Boolean(allocationAdjustedBacktest);
  const diagnostics = [
    ["Max drawdown", formatPercent(primaryBacktest.maxDrawdown)],
    ["Longest losing streak", formatNumber(primaryBacktest.longestLosingStreak)],
    ["Profit factor", formatNumber(primaryBacktest.profitFactor)],
    ["Expectancy", formatPercent(primaryBacktest.expectancy, 2)],
    ["Total trades", formatNumber(primaryBacktest.totalTrades)]
  ];

  return (
    <div>
      <div className="mb-3 rounded-md border border-line bg-white/[0.03] p-3 text-xs leading-5 text-slate-400">
        <p className="font-bold text-slate-200">
          {hasAllocationAdjusted
            ? "Allocation-Adjusted Backtest - model-sized exposure"
            : "Signal Backtest - 100% exposure assumption"}
        </p>
        <p className="mt-1">
          Showing {primaryBacktest.assumptionLabel} at {formatPercent(primaryBacktest.allocation, 0)} exposure.
        </p>
        {hasAllocationAdjusted ? (
          <p className="mt-1">
            The 100% signal backtest is retained below as a raw signal diagnostic, not as model-sized performance.
          </p>
        ) : (
          <p className="mt-1">Only one backtest is available for this analysis run.</p>
        )}
      </div>
      <EquityCurveChart backtest={primaryBacktest} />
      {hasAllocationAdjusted && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-cyan/30 bg-cyan/10 p-3">
            <p className="text-xs font-bold uppercase tracking-normal text-cyan">
              Allocation-Adjusted Backtest - model-sized exposure
            </p>
            <p className="mt-2 text-lg font-black text-white">{formatPercent(primaryBacktest.totalReturn)}</p>
            <p className="mt-1 text-xs text-slate-400">
              Exposure {formatPercent(primaryBacktest.allocation, 0)} | Max DD {formatPercent(primaryBacktest.maxDrawdown)} | Trades{" "}
              {formatNumber(primaryBacktest.totalTrades)}
            </p>
          </div>
          <div className="rounded-md border border-line bg-white/[0.03] p-3">
            <p className="text-xs font-bold uppercase tracking-normal text-slate-300">
              Signal Backtest - 100% exposure assumption
            </p>
            <p className="mt-2 text-lg font-black text-white">{formatPercent(backtest.totalReturn)}</p>
            <p className="mt-1 text-xs text-slate-500">
              Exposure {formatPercent(backtest.allocation, 0)} | Max DD {formatPercent(backtest.maxDrawdown)} | Trades{" "}
              {formatNumber(backtest.totalTrades)}
            </p>
          </div>
        </div>
      )}
      {dataQuality && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-md border border-line bg-white/[0.03] p-3">
            <p className="text-xs text-slate-400">Data range</p>
            <p className="mt-1 font-bold text-white">
              {dataQuality.dataStartDate ?? "n/a"} to {dataQuality.dataEndDate ?? "n/a"}
            </p>
          </div>
          <div className="rounded-md border border-line bg-white/[0.03] p-3">
            <p className="text-xs text-slate-400">Total candles</p>
            <p className="mt-1 font-bold text-white">{formatNumber(dataQuality.totalCandles)}</p>
          </div>
          <div className="rounded-md border border-line bg-white/[0.03] p-3">
            <p className="text-xs text-slate-400">Usable after warmup</p>
            <p className="mt-1 font-bold text-white">{formatNumber(dataQuality.usableCandlesAfterWarmup)}</p>
          </div>
          <div className="rounded-md border border-line bg-white/[0.03] p-3">
            <p className="text-xs text-slate-400">Estimated trades</p>
            <p className="mt-1 font-bold text-white">{formatNumber(dataQuality.estimatedTrades)}</p>
          </div>
          <div className="rounded-md border border-line bg-white/[0.03] p-3">
            <p className="text-xs text-slate-400">OOS estimated trades</p>
            <p className="mt-1 font-bold text-white">{formatNumber(dataQuality.outOfSampleTrades)}</p>
          </div>
        </div>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {diagnostics.map(([label, value]) => (
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
            <p className="mt-1 text-xs text-slate-400">
              Max DD {formatPercent(validation.inSample.maxDrawdown)} | Trades {formatNumber(validation.inSample.totalTrades)}
            </p>
          </div>
          <div className="rounded-lg border border-line bg-white/[0.03] p-4">
            <p className="text-xs font-bold uppercase tracking-normal text-cyan">Chronological OOS split</p>
            <p className="mt-2 text-2xl font-black text-white">{formatPercent(validation.outOfSample.totalReturn)}</p>
            <p className="mt-1 text-xs text-slate-400">
              Max DD {formatPercent(validation.outOfSample.maxDrawdown)} | Trades {formatNumber(validation.outOfSample.totalTrades)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {validation.outOfSample.totalTrades < validation.range.minimumOutOfSampleTrades
                ? "Insufficient OOS trades"
                : validation.outOfSampleLabel}
            </p>
          </div>
          <div className="rounded-lg border border-line bg-white/[0.03] p-4">
            <p className="text-xs font-bold uppercase tracking-normal text-cyan">Simplified walk-forward diagnostic</p>
            <p className="mt-2 text-2xl font-black text-white">{validation.walkForward.stabilityLabel}</p>
            <p className="mt-1 text-xs text-slate-400">
              {validation.walkForward.stableWindows}/{validation.walkForward.windowsTested} stable windows
            </p>
            {validation.walkForward.tradesPerWindow.length > 0 && (
              <p className="mt-1 text-xs text-slate-500">
                Trades/window {validation.walkForward.tradesPerWindow.map((count) => formatNumber(count)).join(", ")}
              </p>
            )}
          </div>
          <div className="rounded-lg border border-line bg-white/[0.03] p-4 lg:col-span-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">Validation diagnostic</p>
                <p className="mt-1 text-xs text-slate-400">
                  {validation.parameterSensitivity.robustnessLabel} | Range {validation.parameterSensitivity.rangeLabel} | Not a full train/test optimizer
                </p>
              </div>
              <p className="text-sm font-bold text-white">Validation diagnostic score {validation.validationScore}/100</p>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-5">
              {validation.parameterSensitivity.testedParameters.map((item, index) => (
                <div key={`${item.fastWindow}/${item.slowWindow}`} className="rounded-md border border-line bg-white/[0.03] p-3">
                  <p className="text-xs text-slate-400">
                    {item.fastWindow}/{item.slowWindow}
                  </p>
                  <p className="mt-1 font-bold text-white">{formatPercent(validation.parameterSensitivity.metrics[index]?.annualizedReturn ?? 0)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Total {formatPercent(validation.parameterSensitivity.metrics[index]?.totalReturn ?? 0)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    DD {formatPercent(validation.parameterSensitivity.metrics[index]?.maxDrawdown ?? 0)} | Sharpe{" "}
                    {formatNumber(validation.parameterSensitivity.metrics[index]?.sharpeRatio ?? 0)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Trades {formatNumber(validation.parameterSensitivity.metrics[index]?.tradeCount ?? 0)} | Score{" "}
                    {formatNumber(validation.parameterSensitivity.metrics[index]?.robustnessScore ?? 0)}
                  </p>
                </div>
              ))}
            </div>
          </div>
          {validation.warnings.length > 0 && (
            <div className="rounded-lg border border-amber/30 bg-amber/10 p-4 text-xs leading-5 text-slate-300 lg:col-span-3">
              {validation.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          )}
        </div>
      )}
      {entryZoneAblation && (
        <div className="mt-5 rounded-lg border border-line bg-white/[0.03] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-white">Optimal Entry Zone ablation</p>
              <p className="mt-1 text-xs text-slate-400">Comparative entry-filter cases. Improvement is not assumed without validation.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-5">
            {entryZoneAblation.cases.map((item) => (
              <div key={item.label} className="rounded-md border border-line bg-white/[0.03] p-3">
                <p className="min-h-10 text-xs font-bold text-slate-300">{item.label}</p>
                {item.summary ? (
                  <>
                    <p className="mt-2 text-lg font-black text-white">{formatPercent(item.summary.totalReturn)}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      DD {formatPercent(item.summary.maxDrawdown)} | Sharpe {formatNumber(item.summary.sharpeRatio)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      PF {formatNumber(item.summary.profitFactor)} | Trades {formatNumber(item.summary.totalTrades)}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-xs font-bold text-amber">{item.status}</p>
                )}
              </div>
            ))}
          </div>
          {entryZoneAblation.warnings.length > 0 && (
            <div className="mt-4 grid gap-2 text-xs leading-5 text-slate-500">
              {entryZoneAblation.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          )}
        </div>
      )}
      <p className="mt-4 text-xs leading-5 text-slate-500">
        Historical simulation only. Fees and slippage are included as assumptions and do not imply future performance.
      </p>
    </div>
  );
}
