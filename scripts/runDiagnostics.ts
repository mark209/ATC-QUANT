import { ReplayArtifactStore } from "@/lib/replay/replayArtifacts";
import { generateDecisionPipelineDiagnostics, renderDecisionPipelineReport } from "@/lib/replay/decisionPipelineDiagnostics";
import { buildStrategyTraceReport, generateStrategyTrace, renderStrategyTraceReport } from "@/lib/replay/strategyTrace";

const store = new ReplayArtifactStore("replays");
const bundle = await store.latest();
const configuration = bundle.replay_manifest.configuration as { asset_type: "crypto" | "stock" | "etf" | "index"; risk_profile: "conservative" | "balanced" | "aggressive" };
const diagnostics = generateDecisionPipelineDiagnostics({
  replayId: bundle.replay_manifest.replay_id,
  generatedAt: new Date().toISOString(),
  dataset: bundle.dataset,
  assetType: configuration.asset_type,
  riskProfile: configuration.risk_profile,
  executionEvents: bundle.artifacts.execution_events,
  lifecycleEvents: bundle.artifacts.lifecycle_events,
  trades: bundle.artifacts.trades
});
await store.writeDiagnostics(bundle.replay_manifest.replay_id, diagnostics);
console.log(renderDecisionPipelineReport(diagnostics));
const traces = generateStrategyTrace({ replayId: bundle.replay_manifest.replay_id, dataset: bundle.dataset, assetType: configuration.asset_type, riskProfile: configuration.risk_profile, executionEvents: bundle.artifacts.execution_events, lifecycleEvents: bundle.artifacts.lifecycle_events, trades: bundle.artifacts.trades });
const explainabilityReport = buildStrategyTraceReport({ replayId: bundle.replay_manifest.replay_id, datasetId: bundle.dataset.dataset_id, generatedAt: new Date().toISOString(), traces });
await store.writeExplainability(bundle.replay_manifest.replay_id, traces, explainabilityReport);
console.log(renderStrategyTraceReport(explainabilityReport));
