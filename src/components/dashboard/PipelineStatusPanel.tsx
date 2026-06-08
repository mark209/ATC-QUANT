import type { LayerResult, QuantAnalysis } from "@/types/quant";

function badge(status: string): string {
  if (status === "pass") return "border-mint/40 bg-mint/10 text-mint";
  if (status === "fail") return "border-danger/40 bg-danger/10 text-danger";
  return "border-amber/40 bg-amber/10 text-amber";
}

export function PipelineStatusPanel({ analysis }: { analysis: QuantAnalysis }) {
  const layers: Array<[string, LayerResult]> = [
    ["Data quality", analysis.pipeline.layers.dataQuality],
    ["Hard filters", analysis.pipeline.layers.hardFilters],
    ["Signal", analysis.pipeline.layers.signal],
    ["Risk", analysis.pipeline.layers.risk],
    ["Validation", analysis.pipeline.layers.validation],
    ["Sizing", analysis.pipeline.layers.sizing],
    ["Portfolio risk", analysis.pipeline.layers.portfolioRisk],
    ["Decision", analysis.pipeline.layers.decision]
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {layers.map(([label, layer]) => (
        <div key={label} className="rounded-lg border border-line bg-white/[0.03] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-white">{label}</p>
            <span className={`rounded-md border px-2 py-1 text-[11px] font-bold uppercase ${badge(layer.status)}`}>{layer.status}</span>
          </div>
          <p className="mt-3 min-h-10 text-xs leading-5 text-slate-400">{layer.reason}</p>
          {typeof layer.score === "number" && <p className="mt-2 text-lg font-black text-white">{layer.score}/100</p>}
        </div>
      ))}
    </div>
  );
}
