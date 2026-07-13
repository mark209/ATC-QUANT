import { writeFile } from "node:fs/promises";
import { calculateHash, createReplayVerificationReport, renderReplayVerificationReport, type ReplayIdentity } from "../src/lib/quant/replayVerification";

const identity: ReplayIdentity = {
  replay_id: "production-replay-unavailable",
  dataset_version: "unavailable",
  dataset_hash: "unavailable",
  strategy_version: "unavailable",
  execution_profile: "unavailable",
  random_seed: "unavailable",
  configuration: { status: "unavailable" },
  configuration_hash: calculateHash({ status: "unavailable" })
};

const report = await createReplayVerificationReport({ identity, dataset: null });
await writeFile("ATC_REPLAY_VERIFICATION_REPORT.md", renderReplayVerificationReport(report), "utf8");

console.log("ATC REPLAY VERIFICATION");
console.log(`Replay status: ${report.replay_status}`);
console.log(`Deterministic status: ${report.deterministic_status}`);
console.log(`Replay count: ${report.replay_count}`);
console.log(`Final verdict: ${report.summary}`);
