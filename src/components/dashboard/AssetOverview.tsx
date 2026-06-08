import type { AssetOverview as Overview } from "@/types/asset";
import { compactNumber, formatCurrency, formatPercent } from "./format";

export function AssetOverview({ overview }: { overview: Overview }) {
  return (
    <div className="panel-frame rounded-lg p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-400">{overview.market}</p>
          <h2 className="mt-2 text-3xl font-black text-white">{overview.symbol}</h2>
          <p className="mt-1 text-sm text-slate-300">{overview.name}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black text-white">{formatCurrency(overview.currentPrice)}</p>
          <p className={overview.dailyChangePercent >= 0 ? "text-sm font-semibold text-mint" : "text-sm font-semibold text-danger"}>
            {formatPercent(overview.dailyChangePercent, 2)} today
          </p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <div>
          <p className="text-xs text-slate-500">Exchange</p>
          <p className="mt-1 font-semibold text-slate-100">{overview.exchange}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Volume</p>
          <p className="mt-1 font-semibold text-slate-100">{compactNumber(overview.dailyVolume)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Dollar Volume</p>
          <p className="mt-1 font-semibold text-slate-100">{compactNumber(overview.quoteVolume ?? 0)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Live Source</p>
          <p className="mt-1 font-semibold text-slate-100">{overview.liveSource}</p>
        </div>
      </div>
    </div>
  );
}
