import { rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { calculateHash, verifyReplayDeterminism } from "@/lib/quant/replayVerification";
import { createBundledResearchDataset } from "@/lib/replay/sampleDataset";
import { DeterministicReplayRunner, REPLAY_ENGINE_VERSION, type ProductionReplayIdentity } from "@/lib/replay/replayRunner";

const root = join(process.cwd(), "tmp-phase3-verification-tests");

afterEach(async () => { await rm(root, { recursive: true, force: true }); });

describe("Phase 2C and Phase 3 integration", () => {
  it("verifies deterministic production runner artifacts", async () => {
    const dataset = createBundledResearchDataset();
    const configuration = { asset_type: "stock", risk_profile: "balanced" };
    const identity: ProductionReplayIdentity = { replay_id: "phase3-verification-integration", dataset_id: dataset.dataset_id, dataset_version: dataset.dataset_version, dataset_hash: dataset.dataset_hash, strategy_version: "strategy-current", strategy_git_commit: "fixture-commit", execution_profile: "ideal", engine_version: REPLAY_ENGINE_VERSION, configuration, configuration_hash: calculateHash(configuration), random_seed: "seed", replay_timestamp: dataset.creation_timestamp };
    const runner = new DeterministicReplayRunner({ asset_type: "stock", risk_profile: "balanced", root_directory: root });
    const report = await verifyReplayDeterminism({ identity, dataset, runner, repetitions: 3 });
    expect(report.status).toBe("PASS");
    expect(report.replay_count).toBe(3);
    expect(report.deterministic_status).toBe("PASS");
  }, 60_000);
});
