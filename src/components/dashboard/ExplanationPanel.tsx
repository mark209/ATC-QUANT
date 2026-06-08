import type { QuantAnalysis } from "@/types/quant";

export function ExplanationPanel({ analysis }: { analysis: QuantAnalysis }) {
  const explanation = analysis.pipeline.explanation;

  return (
    <div className="space-y-4 text-sm leading-6 text-slate-300">
      <div>
        <p className="text-xs font-bold uppercase tracking-normal text-cyan">Why this decision?</p>
        <p className="mt-2 text-base text-slate-100">{explanation.why}</p>
      </div>
      <div className="rounded-lg border border-line bg-white/[0.03] p-4">
        <p className="text-xs font-bold uppercase tracking-normal text-amber">What would improve the rating?</p>
        <div className="mt-3 grid gap-2">
          {explanation.improvements.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-normal text-danger">What blocks the trade/investment?</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(explanation.blockers.length > 0 ? explanation.blockers : ["No hard blocker from current checks."]).map((item) => (
            <span key={item} className="rounded-md border border-line bg-white/[0.04] px-3 py-2 text-xs text-slate-300">
              {item}
            </span>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-line bg-white/[0.03] p-4">
        <p className="text-xs font-bold uppercase tracking-normal text-danger">Invalidation</p>
        <p className="mt-2">{analysis.investability.invalidation}</p>
      </div>
    </div>
  );
}
