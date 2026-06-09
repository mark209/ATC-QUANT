import type { RiskMetrics } from "@/types/quant";
import { formatNumber, formatPercent } from "./format";

export function RiskMetricsTable({ metrics }: { metrics: RiskMetrics }) {
  const rows = [
    ["Annualized volatility", formatPercent(metrics.annualizedVolatility)],
    ["EWMA volatility", formatPercent(metrics.ewmaVolatility)],
    ["Max drawdown", formatPercent(metrics.maxDrawdown)],
    ["Current drawdown", formatPercent(metrics.currentDrawdown)],
    ["Sharpe ratio", formatNumber(metrics.sharpeRatio)],
    ["Sortino ratio", formatNumber(metrics.sortinoRatio)],
    ["Calmar ratio", formatNumber(metrics.calmarRatio)],
    ["VaR 95", formatPercent(metrics.valueAtRisk95, 2)],
    ["CVaR 95", formatPercent(metrics.conditionalValueAtRisk95, 2)],
    ["EV after costs", formatPercent(metrics.expectedValue, 2)],
    ["Profit factor", formatNumber(metrics.profitFactor)]
  ];

  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-line">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} className="border-b border-line last:border-b-0">
                <td className="bg-white/[0.03] px-4 py-3 text-slate-400">{label}</td>
                <td className="px-4 py-3 text-right font-bold text-slate-100">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {metrics.ratioWarnings.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber/30 bg-amber/10 p-3 text-xs leading-5 text-slate-300">
          {metrics.ratioWarnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}
    </div>
  );
}
