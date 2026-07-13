import { DatasetLibrary } from "../src/lib/datasets/datasetLibrary";

const entries = await new DatasetLibrary("datasets").list();
if (entries.length === 0) console.log("No institutional historical datasets are registered. Supply real immutable snapshots before replay coverage or statistical validation.");
else for (const entry of entries) console.log(`${entry.metadata.dataset_id} | ${entry.metadata.symbol} | ${entry.metadata.exchange} | ${entry.metadata.timeframe} | ${entry.metadata.dataset_version} | ${entry.metadata.start_date}..${entry.metadata.end_date}`);
