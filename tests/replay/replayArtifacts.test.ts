import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { calculateHash, verifyReplayArtifacts } from "@/lib/quant/replayVerification";
import { createBundledResearchDataset } from "@/lib/replay/sampleDataset";
import { ReplayArtifactStore } from "@/lib/replay/replayArtifacts";
import { DeterministicReplayRunner, REPLAY_ENGINE_VERSION, type ProductionReplayIdentity } from "@/lib/replay/replayRunner";

const root = join(process.cwd(), "tmp-phase3-replay-tests");

function identity(dataset: ReturnType<typeof createBundledResearchDataset>): ProductionReplayIdentity {
  const configuration = { asset_type: "stock", risk_profile: "balanced" };
  return {
    replay_id: "phase3-fixture-replay",
    dataset_id: dataset.dataset_id,
    dataset_version: dataset.dataset_version,
    dataset_hash: dataset.dataset_hash,
    strategy_version: "strategy-current",
    strategy_git_commit: "fixture-commit",
    execution_profile: "ideal",
    engine_version: REPLAY_ENGINE_VERSION,
    configuration,
    configuration_hash: calculateHash(configuration),
    random_seed: "fixture-seed",
    replay_timestamp: "2026-01-02T00:00:00.000Z"
  };
}

afterEach(async () => { await rm(root, { recursive: true, force: true }); });

describe("production replay artifacts", () => {
  it("runs the current quant engine and persists a complete immutable artifact bundle", async () => {
    const dataset = createBundledResearchDataset();
    const runner = new DeterministicReplayRunner({ asset_type: "stock", risk_profile: "balanced", root_directory: root });
    const bundle = await runner.runAndPersist(identity(dataset), dataset);
    expect(bundle.replay_manifest.dataset_hash).toBe(dataset.dataset_hash);
    expect(bundle.dataset_manifest.quality_status).toBe("VALID");
    expect(bundle.artifact_manifest.execution_journal_hash).toHaveLength(64);
    expect(bundle.artifact_manifest.lifecycle_journal_hash).toHaveLength(64);
    expect(bundle.artifacts.lifecycle_events.length).toBeGreaterThan(0);
    expect(bundle.artifacts.trades.length).toBe(0);
    expect(verifyReplayArtifacts(identity(dataset), bundle.artifacts).status).toBe("PASS");
    const loaded = await new ReplayArtifactStore(root).read(identity(dataset).replay_id);
    expect(loaded.artifact_manifest).toEqual(bundle.artifact_manifest);
    await expect(runner.runAndPersist(identity(dataset), dataset)).rejects.toThrow();
  }, 60_000);

  it("rejects a tampered artifact manifest", async () => {
    const dataset = createBundledResearchDataset();
    const replayIdentity = identity(dataset);
    const runner = new DeterministicReplayRunner({ asset_type: "stock", risk_profile: "balanced", root_directory: root });
    await runner.runAndPersist(replayIdentity, dataset);
    const manifestPath = join(root, `replay-${replayIdentity.replay_id}`, "artifact-manifest.json");
    const original = await readFile(manifestPath, "utf8");
    await writeFile(manifestPath, original.replace(/"replay_report_hash":"[^"]+"/, `"replay_report_hash":"${"0".repeat(64)}"`), "utf8");
    await expect(new ReplayArtifactStore(root).read(replayIdentity.replay_id)).rejects.toThrow("replay report hash");
  }, 60_000);
});
