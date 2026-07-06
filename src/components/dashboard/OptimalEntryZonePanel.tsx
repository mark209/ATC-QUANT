import type { OptimalEntryZoneResult } from "@/types/quant";
import { formatCurrency, formatNumber } from "./format";

function maybeCurrency(value: number | null): string {
  return value === null ? "n/a" : formatCurrency(value);
}

function maybeNumber(value: number | null): string {
  return value === null ? "n/a" : formatNumber(value);
}

function actionBadge(actionability: OptimalEntryZoneResult["actionability"]): string {
  if (actionability === "ACTIONABLE") return "border-mint/40 bg-mint/10 text-mint";
  if (actionability === "WATCHLIST") return "border-amber/40 bg-amber/10 text-amber";
  return "border-danger/40 bg-danger/10 text-danger";
}

export function OptimalEntryZonePanel({ result }: { result: OptimalEntryZoneResult }) {
  const bias =
    result.regimeDirection === "LONG_ELIGIBLE"
      ? "Long allowed"
      : result.regimeDirection === "SHORT_ELIGIBLE"
        ? "Short allowed"
        : "No trade";
  const zoneLabel = result.entrySide === "LONG" ? "Buy zone" : result.entrySide === "SHORT" ? "Short zone" : "Suggested zone";
  const target1 = result.targets.find((target) => target.label === "Target 1");
  const target2 = result.targets.find((target) => target.label === "Target 2");
  const distance =
    result.distanceFromEntryZonePercent === null ? "n/a" : `${formatNumber(Math.abs(result.distanceFromEntryZonePercent))}%`;
  const vwapRows = [
    ["Session VWAP", result.vwapData.sessionVWAP],
    ["7D VWAP", result.vwapData.rollingVWAP7D],
    ["30D VWAP", result.vwapData.rollingVWAP30D],
    ["90D VWAP", result.vwapData.rollingVWAP90D],
    ["Anchored VWAP", result.vwapData.anchoredVWAP]
  ];

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-line bg-white/[0.03] p-4">
          <p className="text-xs font-bold uppercase tracking-normal text-cyan">Layer 1</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-400">Main Strategy Decision</p>
              <p className="mt-1 text-xl font-black text-white">{result.regimeDirection}</p>
            </div>
            <span className="rounded-md border border-line bg-white/[0.04] px-3 py-1 text-xs font-bold text-white">{bias}</span>
          </div>
        </div>
        <div className="rounded-lg border border-line bg-white/[0.03] p-4">
          <p className="text-xs font-bold uppercase tracking-normal text-cyan">Layer 2</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-400">Optimal Entry Zone / Execution Quality</p>
              <p className="mt-1 text-xl font-black text-white">{result.entryQualityScore}/100</p>
            </div>
            <span className={`rounded-md border px-3 py-1 text-xs font-bold ${actionBadge(result.actionability)}`}>{result.actionability}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-line bg-white/[0.03] p-3">
          <p className="text-xs text-slate-400">{zoneLabel}</p>
          <p className="mt-1 font-bold text-white">
            {result.entryZone ? `${formatCurrency(result.entryZone.lower)} - ${formatCurrency(result.entryZone.upper)}` : "No actionable zone"}
          </p>
        </div>
        <div className="rounded-md border border-line bg-white/[0.03] p-3">
          <p className="text-xs text-slate-400">Distance from zone</p>
          <p className="mt-1 font-bold text-white">{distance}</p>
        </div>
        <div className="rounded-md border border-line bg-white/[0.03] p-3">
          <p className="text-xs text-slate-400">Invalidation</p>
          <p className="mt-1 font-bold text-white">{maybeCurrency(result.invalidationPrice)}</p>
        </div>
        <div className="rounded-md border border-line bg-white/[0.03] p-3">
          <p className="text-xs text-slate-400">Suggested stop</p>
          <p className="mt-1 font-bold text-white">{maybeCurrency(result.suggestedStop)}</p>
        </div>
        <div className="rounded-md border border-line bg-white/[0.03] p-3">
          <p className="text-xs text-slate-400">Target 1</p>
          <p className="mt-1 font-bold text-white">{target1 ? maybeCurrency(target1.price) : "n/a"}</p>
        </div>
        <div className="rounded-md border border-line bg-white/[0.03] p-3">
          <p className="text-xs text-slate-400">Target 2</p>
          <p className="mt-1 font-bold text-white">{target2 ? maybeCurrency(target2.price) : "n/a"}</p>
        </div>
        <div className="rounded-md border border-line bg-white/[0.03] p-3">
          <p className="text-xs text-slate-400">ATR</p>
          <p className="mt-1 font-bold text-white">{maybeNumber(result.riskData.atr)}</p>
        </div>
        <div className="rounded-md border border-line bg-white/[0.03] p-3">
          <p className="text-xs text-slate-400">Estimated reward/risk</p>
          <p className="mt-1 font-bold text-white">{maybeNumber(result.riskData.estimatedRewardRisk)}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-lg border border-line bg-white/[0.03] p-4">
          <p className="text-sm font-bold text-white">VWAP references</p>
          <div className="mt-3 grid gap-2">
            {vwapRows.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-400">{label}</span>
                <span className="font-bold text-white">{maybeCurrency(value as number | null)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-line bg-white/[0.03] p-4">
          <p className="text-sm font-bold text-white">Execution notes</p>
          <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-400">
            {result.explanation.map((item, index) => (
              <p key={`entry-explanation-${index}-${item}`}>{item}</p>
            ))}
            {result.reasonNoTrade && <p>No trade: {result.reasonNoTrade}</p>}
          </div>
          {result.warnings.length > 0 && (
            <div className="mt-4 rounded-md border border-amber/30 bg-amber/10 p-3 text-xs leading-5 text-amber">
              {result.warnings.slice(0, 5).map((warning, index) => (
                <p key={`entry-warning-${index}-${warning}`}>{warning}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
