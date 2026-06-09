import type { ExpectedValueResult, QuantAnalysis } from "@/types/quant";
import { formatNumber, formatPercent } from "./format";

function meterColor(score: number): string {
  if (score >= 70) return "bg-mint";
  if (score >= 45) return "bg-amber";
  return "bg-danger";
}

export function expectedValueStatusLabel(ev: ExpectedValueResult): "EV failed" | "EV limited" | "EV passed" {
  if (ev.expectedValueAfterCosts <= 0) return "EV failed";
  if (!ev.passed || ev.sampleQuality === "Poor" || ev.sampleQuality === "Limited") return "EV limited";
  return "EV passed";
}

function expectedValueStatusReason(ev: ExpectedValueResult): string {
  if (ev.expectedValueAfterCosts <= 0) return "Expected value after costs is negative.";
  if (!ev.passed || ev.sampleQuality === "Poor" || ev.sampleQuality === "Limited") {
    return "Expected value is positive but sample quality limits confidence.";
  }
  return "Trade-derived expected value after costs passed.";
}

export function ScoreBreakdown({ analysis }: { analysis: QuantAnalysis }) {
  const decision = analysis.pipeline.finalDecision;
  const rows = [
    ["Raw model score", decision.rawModelScore, "Uncapped score from signal, risk, validation, and liquidity"],
    ["Final decision score", decision.finalScore, decision.decisionLabel],
    ["Signal score", decision.signalScore, "Trend, momentum, and regime"],
    ["Risk score", decision.riskScore, "Volatility, drawdown, liquidity, diagnostics"],
    ["Validation score", decision.validationScore, analysis.pipeline.validation.robustnessLabel],
    ["Liquidity score", analysis.pipeline.risk.liquidityScore, analysis.pipeline.risk.liquidityLabel]
  ];
  const ev = analysis.pipeline.expectedValue;
  const evStatus = expectedValueStatusLabel(ev);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map(([label, score, detail]) => (
          <div key={label} className="rounded-lg border border-line bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-white">{label}</p>
                <p className="mt-1 text-xs text-slate-400">{detail}</p>
              </div>
              <p className="text-xl font-black text-white">{Number(score).toFixed(0)}</p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#091125]">
              <div className={`h-full ${meterColor(Number(score))}`} style={{ width: `${Number(score)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-line bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-white">Expected value status</p>
            <p className="mt-1 text-xs text-slate-400">{expectedValueStatusReason(ev)}</p>
          </div>
          <span className="rounded-md border border-line bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-100">
            {evStatus} | {ev.sampleQuality} sample
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-slate-400">EV after costs</p>
            <p className="mt-1 font-bold text-white">{formatPercent(ev.expectedValueAfterCosts, 2)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Trades / samples</p>
            <p className="mt-1 font-bold text-white">{ev.tradeCount}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Profit factor</p>
            <p className="mt-1 font-bold text-white">{formatNumber(ev.profitFactor)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
