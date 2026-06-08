import type { QuantAnalysis } from "@/types/quant";
import { formatPercent } from "./format";

export function ScoreCard({ analysis }: { analysis: QuantAnalysis }) {
  const decision = analysis.pipeline.finalDecision;
  const score = decision.finalScore;
  const ring = `conic-gradient(#35e58b ${score * 3.6}deg, rgba(47,108,255,0.18) 0deg)`;
  const mainReason = decision.primaryReasons[0] ?? analysis.pipeline.explanation.why;
  const mainWarning = decision.warnings[0] ?? analysis.pipeline.hardFilters.warnings[0] ?? "No primary warning from current checks.";

  return (
    <div className="panel-frame rounded-lg p-5">
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-cyan">Final Decision</p>
          <h1 className="mt-2 text-3xl font-black text-white">{decision.decisionLabel}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">Risk mode: {analysis.investability.riskMode}</p>
        </div>
        <div className="grid h-28 w-28 place-items-center rounded-full p-2" style={{ background: ring }}>
          <div className="grid h-full w-full place-items-center rounded-full bg-[#0a1022]">
            <div className="text-center">
              <div className="text-3xl font-black">{score}</div>
              <div className="text-xs text-slate-400">/ 100</div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-md border border-line bg-white/5 p-3">
          <p className="text-xs text-slate-400">Allocation</p>
          <p className="mt-1 font-bold text-white">{formatPercent(decision.finalPositionSize, 2)}</p>
        </div>
        <div className="rounded-md border border-line bg-white/5 p-3">
          <p className="text-xs text-slate-400">Regime</p>
          <p className="mt-1 font-bold text-white">{analysis.pipeline.signal.regimeLabel}</p>
        </div>
        <div className="rounded-md border border-line bg-white/5 p-3">
          <p className="text-xs text-slate-400">EV status</p>
          <p className="mt-1 font-bold text-white">{analysis.pipeline.expectedValue.passed ? "Positive" : "Caution"}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-md border border-line bg-white/[0.03] p-3">
          <p className="text-xs font-bold uppercase tracking-normal text-cyan">Main reason</p>
          <p className="mt-2 leading-5 text-slate-300">{mainReason}</p>
        </div>
        <div className="rounded-md border border-line bg-white/[0.03] p-3">
          <p className="text-xs font-bold uppercase tracking-normal text-amber">Main warning</p>
          <p className="mt-2 leading-5 text-slate-300">{mainWarning}</p>
        </div>
      </div>
    </div>
  );
}
