import type { PositionSizingResult } from "@/types/quant";
import { formatPercent } from "./format";

export function PositionSizingCard({ sizing }: { sizing: PositionSizingResult }) {
  const rows = [
    ["Volatility-targeted allocation", sizing.volatilityTargetAllocation],
    ["Fractional Kelly allocation", sizing.fractionalKellyAllocation],
    ["Asset-class max allocation", sizing.assetClassMaxAllocation],
    ["Drawdown-adjusted allocation", sizing.drawdownAdjustedAllocation]
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-electric/40 bg-electric/10 p-4">
        <p className="text-xs uppercase tracking-normal text-cyan">Final position size</p>
        <p className="mt-2 text-4xl font-black text-white">{formatPercent(sizing.finalPositionSize, 2)}</p>
        <p className="mt-2 text-sm text-slate-300">
          Limiting factor: <span className="font-semibold text-white">{sizing.limitingFactor}</span>.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-md border border-line bg-white/[0.03] p-3">
            <p className="text-xs text-slate-400">{label}</p>
            <p className="mt-1 text-lg font-bold text-white">{formatPercent(Number(value), 2)}</p>
          </div>
        ))}
      </div>
      <div className="rounded-md border border-line bg-white/[0.03] p-3 text-sm text-slate-300">
        Exposure adjustment: <span className="font-semibold text-white">{formatPercent(sizing.exposureAdjustment, 0)}</span>
      </div>
      {sizing.warnings.length > 0 && (
        <div className="rounded-md border border-amber/30 bg-amber/10 p-3 text-sm leading-6 text-slate-300">
          {sizing.warnings[0]}
        </div>
      )}
    </div>
  );
}
