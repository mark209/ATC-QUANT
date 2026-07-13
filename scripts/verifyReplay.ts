import { writeFile } from "node:fs/promises";
import { createReplayVerificationReport, renderReplayVerificationReport } from "../src/lib/quant/replayVerification";
import { ReplayArtifactStore } from "../src/lib/replay/replayArtifacts";
import { DeterministicReplayRunner } from "../src/lib/replay/replayRunner";

const bundle = await new ReplayArtifactStore("replays").latest();
const runner = new DeterministicReplayRunner({ asset_type: "stock", risk_profile: "balanced", root_directory: "replays" });
const report = await createReplayVerificationReport({ identity: bundle.replay_manifest, dataset: bundle.dataset, runner });
await writeFile("ATC_REPLAY_VERIFICATION_REPORT.md", renderReplayVerificationReport(report), "utf8");
console.log("ATC REPLAY VERIFICATION");
console.log(`Replay status: ${report.replay_status}`);
console.log(`Deterministic status: ${report.deterministic_status}`);
console.log(`Replay count: ${report.replay_count}`);
console.log(`Final verdict: ${report.summary}`);
if (report.status !== "PASS") process.exitCode = 1;
