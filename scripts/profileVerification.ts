import { performance } from "node:perf_hooks";
import { readFile, writeFile } from "node:fs/promises";
import { ReplayArtifactStore } from "../src/lib/replay/replayArtifacts";
import { hashJournal, verifyReplayArtifacts } from "../src/lib/quant/replayVerification";

const replayId = process.argv[2] ?? "equities-spy-v1";
const started = performance.now();
const store = new ReplayArtifactStore("replays");
const readStarted = performance.now();
const bundle = await store.read(replayId);
const readDuration = performance.now() - readStarted;
const verifyStarted = performance.now();
const report = verifyReplayArtifacts(bundle.replay_manifest, bundle.artifacts);
const verifyDuration = performance.now() - verifyStarted;
const totalDuration = performance.now() - started;
const peakRss = process.memoryUsage().rss;
const legacyStarted = performance.now();
for (const name of ["execution-events.jsonl", "lifecycle-events.jsonl", "trades.jsonl"]) {
  const content = await readFile(`replays/replay-${replayId}/${name}`, "utf8");
  const entries = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => JSON.parse(line) as unknown);
  hashJournal(entries);
}
const legacyJournalProcessingMs = performance.now() - legacyStarted;

const profile = {
  replay_id: replayId,
  lifecycle_events: bundle.artifacts.lifecycle_events.length,
  execution_events: bundle.artifacts.execution_events.length,
  trades: bundle.artifacts.trades.length,
  jsonl_read_ms: Number(readDuration.toFixed(2)),
  legacy_buffered_journal_processing_ms: Number(legacyJournalProcessingMs.toFixed(2)),
  verification_ms: Number(verifyDuration.toFixed(2)),
  total_ms: Number(totalDuration.toFixed(2)),
  peak_rss_mb: Number((peakRss / 1024 / 1024).toFixed(2)),
  status: report.status,
  deterministic_status: report.deterministic_status,
  findings: report.findings
};

await writeFile("VERIFICATION_PROFILE.json", `${JSON.stringify(profile, null, 2)}\n`, "utf8");
await writeFile("VERIFICATION_PROFILE.md", [
  "# Replay Verification Profile",
  "",
  "This profile measures artifact loading and static verification independently from replay execution.",
  "",
  "| Metric | Value |",
  "|---|---:|",
  `| Replay | ${profile.replay_id} |`,
  `| Lifecycle events | ${profile.lifecycle_events} |`,
  `| Execution events | ${profile.execution_events} |`,
  `| Trades | ${profile.trades} |`,
  `| JSONL read | ${profile.jsonl_read_ms} ms |`,
  `| Legacy buffered journal parse/hash | ${profile.legacy_buffered_journal_processing_ms} ms |`,
  `| Verification | ${profile.verification_ms} ms |`,
  `| Total | ${profile.total_ms} ms |`,
  `| Peak RSS | ${profile.peak_rss_mb} MB |`,
  `| Static verification | ${profile.status} |`,
  `| Deterministic status | ${profile.deterministic_status} |`,
  "",
  profile.findings.length === 0 ? "No findings." : `Findings: ${profile.findings.join("; ")}`,
  ""
].join("\n"), "utf8");

console.log(JSON.stringify(profile, null, 2));
if (report.status !== "PASS") process.exitCode = 1;
