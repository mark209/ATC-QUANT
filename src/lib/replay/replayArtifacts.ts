import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ExecutionEvent } from "@/lib/trading/executionEvent";
import type { LifecycleEvent } from "@/lib/trading/lifecycleEvent";
import type { TradeRecord } from "@/lib/trading/tradeJournal";
import { canonicalJson } from "@/lib/trading/tradeJournal";
import { calculateHash, hashJournal, type ReplayArtifacts, type ReplayIdentity } from "@/lib/quant/replayVerification";
import { createDatasetManifest, validateFrozenDataset, type FrozenDataset, type DatasetManifest } from "./frozenDataset";

export const REPLAY_ARTIFACT_SCHEMA_VERSION = "1.0";

export interface ReplayManifest extends ReplayIdentity {
  readonly dataset_id: string;
  readonly strategy_git_commit: string;
  readonly engine_version: string;
  readonly replay_timestamp: string;
  readonly artifact_schema_version: string;
}

export interface AnalyticsSnapshot {
  readonly replay_id: string;
  readonly dataset_hash: string;
  readonly generated_at: string;
  readonly trade_count: number;
  readonly trade_ids: readonly string[];
  readonly total_net_pnl: number;
  readonly total_return: number;
  readonly equity_curve: readonly { timestamp: string; equity: number }[];
  readonly input_trade_hashes: readonly string[];
}

export interface ReplayReportArtifact {
  readonly replay_id: string;
  readonly dataset_id: string;
  readonly dataset_hash: string;
  readonly strategy_version: string;
  readonly execution_profile: string;
  readonly decision_count: number;
  readonly trade_count: number;
  readonly execution_event_count: number;
  readonly lifecycle_event_count: number;
  readonly generated_at: string;
  readonly status: "COMPLETED";
}

export interface ArtifactManifest {
  readonly replay_id: string;
  readonly dataset_hash: string;
  readonly configuration_hash: string;
  readonly execution_journal_hash: string;
  readonly lifecycle_journal_hash: string;
  readonly trade_journal_hash: string;
  readonly analytics_hash: string;
  readonly replay_report_hash: string;
  readonly strategy_git_commit: string;
  readonly engine_version: string;
}

export interface ReplayArtifactBundle {
  readonly replay_manifest: ReplayManifest;
  readonly dataset_manifest: DatasetManifest;
  readonly dataset: FrozenDataset;
  readonly artifacts: ReplayArtifacts;
  readonly analytics: AnalyticsSnapshot;
  readonly replay_report: ReplayReportArtifact;
  readonly artifact_manifest: ArtifactManifest;
}

function lines(entries: readonly unknown[]): string {
  return entries.length === 0 ? "" : `${entries.map(canonicalJson).join("\n")}\n`;
}

function parseLines<T>(content: string): T[] {
  return content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => JSON.parse(line) as T);
}

export class ReplayArtifactStore {
  constructor(private readonly rootDirectory = "replays") {}

  private directory(replayId: string): string { return join(this.rootDirectory, `replay-${replayId}`); }

  async write(bundle: ReplayArtifactBundle): Promise<string> {
    const directory = this.directory(bundle.replay_manifest.replay_id);
    await mkdir(this.rootDirectory, { recursive: true });
    await mkdir(directory);
    const files: Array<[string, string]> = [
      ["manifest.json", canonicalJson(bundle.replay_manifest)],
      ["dataset.json", canonicalJson(bundle.dataset)],
      ["dataset-manifest.json", canonicalJson(bundle.dataset_manifest)],
      ["execution-events.jsonl", lines(bundle.artifacts.execution_events)],
      ["lifecycle-events.jsonl", lines(bundle.artifacts.lifecycle_events)],
      ["trades.jsonl", lines(bundle.artifacts.trades)],
      ["analytics.json", canonicalJson(bundle.analytics)],
      ["replay-report.json", canonicalJson(bundle.replay_report)],
      ["artifact-manifest.json", canonicalJson(bundle.artifact_manifest)]
    ];
    for (const [name, content] of files) await writeFile(join(directory, name), content, { encoding: "utf8", flag: "wx" });
    return directory;
  }

  async read(replayId: string): Promise<ReplayArtifactBundle> {
    const directory = this.directory(replayId);
    const readJson = async <T>(name: string): Promise<T> => JSON.parse(await readFile(join(directory, name), "utf8")) as T;
    const replayManifest = await readJson<ReplayManifest>("manifest.json");
    const dataset = await readJson<FrozenDataset>("dataset.json");
    const datasetManifest = await readJson<DatasetManifest>("dataset-manifest.json");
    const executionEvents = parseLines<ExecutionEvent>(await readFile(join(directory, "execution-events.jsonl"), "utf8"));
    const lifecycleEvents = parseLines<LifecycleEvent>(await readFile(join(directory, "lifecycle-events.jsonl"), "utf8"));
    const trades = parseLines<TradeRecord>(await readFile(join(directory, "trades.jsonl"), "utf8"));
    const analytics = await readJson<AnalyticsSnapshot>("analytics.json");
    const replayReport = await readJson<ReplayReportArtifact>("replay-report.json");
    const artifactManifest = await readJson<ArtifactManifest>("artifact-manifest.json");
    validateFrozenDataset(dataset);
    const expectedDatasetManifest = createDatasetManifest(dataset);
    if (canonicalJson(expectedDatasetManifest) !== canonicalJson(datasetManifest)) throw new Error("dataset manifest does not match dataset");
    if (artifactManifest.dataset_hash !== dataset.dataset_hash) throw new Error("artifact manifest dataset hash does not match dataset");
    if (artifactManifest.execution_journal_hash !== hashJournal(executionEvents)) throw new Error("execution journal hash does not match artifact manifest");
    if (artifactManifest.lifecycle_journal_hash !== hashJournal(lifecycleEvents)) throw new Error("lifecycle journal hash does not match artifact manifest");
    if (artifactManifest.trade_journal_hash !== hashJournal(trades)) throw new Error("trade journal hash does not match artifact manifest");
    if (artifactManifest.analytics_hash !== calculateHash(analytics)) throw new Error("analytics hash does not match artifact manifest");
    if (artifactManifest.replay_report_hash !== calculateHash(replayReport)) throw new Error("replay report hash does not match artifact manifest");
    const artifacts: ReplayArtifacts = {
      metadata: {
        ...replayManifest,
        journal_hash: artifactManifest.trade_journal_hash,
        execution_journal_hash: artifactManifest.execution_journal_hash,
        lifecycle_journal_hash: artifactManifest.lifecycle_journal_hash,
        analytics_inputs_hash: artifactManifest.analytics_hash
      },
      trades,
      execution_events: executionEvents,
      lifecycle_events: lifecycleEvents,
      analytics_inputs: analytics,
      replay_output: replayReport
    };
    return { replay_manifest: replayManifest, dataset_manifest: datasetManifest, dataset, artifacts, analytics, replay_report: replayReport, artifact_manifest: artifactManifest };
  }

  async latest(): Promise<ReplayArtifactBundle> {
    const entries = await readdir(this.rootDirectory, { withFileTypes: true });
    const replayIds = entries.filter((entry) => entry.isDirectory() && entry.name.startsWith("replay-")).map((entry) => entry.name.slice("replay-".length)).sort();
    const latest = replayIds.at(-1);
    if (!latest) throw new Error("no persisted replay artifacts exist");
    return this.read(latest);
  }
}

export function buildAnalyticsSnapshot(input: {
  replay_id: string;
  dataset_hash: string;
  generated_at: string;
  trades: readonly TradeRecord[];
}): AnalyticsSnapshot {
  let equity = 100_000;
  const equityCurve = [{ timestamp: input.generated_at, equity }];
  for (const trade of input.trades) {
    equity += trade.net_pnl;
    equityCurve.push({ timestamp: trade.exit_timestamp_utc, equity });
  }
  return Object.freeze({
    replay_id: input.replay_id,
    dataset_hash: input.dataset_hash,
    generated_at: input.generated_at,
    trade_count: input.trades.length,
    trade_ids: input.trades.map((trade) => trade.trade_id),
    total_net_pnl: input.trades.reduce((sum, trade) => sum + trade.net_pnl, 0),
    total_return: equity / 100_000 - 1,
    equity_curve: Object.freeze(equityCurve),
    input_trade_hashes: input.trades.map((trade) => trade.trade_hash)
  });
}

export function buildArtifactManifest(input: {
  replay_manifest: ReplayManifest;
  execution_events: readonly ExecutionEvent[];
  lifecycle_events: readonly LifecycleEvent[];
  trades: readonly TradeRecord[];
  analytics: AnalyticsSnapshot;
  replay_report: ReplayReportArtifact;
}): ArtifactManifest {
  return Object.freeze({
    replay_id: input.replay_manifest.replay_id,
    dataset_hash: input.replay_manifest.dataset_hash,
    configuration_hash: input.replay_manifest.configuration_hash,
    execution_journal_hash: hashJournal(input.execution_events),
    lifecycle_journal_hash: hashJournal(input.lifecycle_events),
    trade_journal_hash: hashJournal(input.trades),
    analytics_hash: calculateHash(input.analytics),
    replay_report_hash: calculateHash(input.replay_report),
    strategy_git_commit: input.replay_manifest.strategy_git_commit,
    engine_version: input.replay_manifest.engine_version
  });
}
