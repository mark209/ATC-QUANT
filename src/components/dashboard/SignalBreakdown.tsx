import type { StrategySignal } from "@/types/quant";

function color(direction: StrategySignal["direction"]) {
  if (direction === "positive") return "bg-mint";
  if (direction === "negative") return "bg-danger";
  return "bg-amber";
}

export function SignalBreakdown({ signals }: { signals: StrategySignal[] }) {
  return (
    <div className="space-y-3">
      {signals.map((signal) => (
        <div key={signal.name} className="rounded-lg border border-line bg-white/[0.03] p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-bold text-white">{signal.name}</p>
              <p className="mt-1 text-xs text-slate-400">Weight {(signal.weight * 100).toFixed(0)}%</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-white">{signal.score}</p>
              <p className="text-xs text-slate-400">+{signal.contribution.toFixed(1)}</p>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#091125]">
            <div className={`h-full ${color(signal.direction)}`} style={{ width: `${signal.score}%` }} />
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-400">{signal.explanation}</p>
        </div>
      ))}
    </div>
  );
}
