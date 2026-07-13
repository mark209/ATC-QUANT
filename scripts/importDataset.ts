import { readFile } from "node:fs/promises";
import { createProviderAdapter } from "../src/lib/datasets/providerAdapters";
import { DatasetLibrary, freezeInstitutionalDataset, importHistoricalOhlcv, validateInstitutionalDataset, type HistoricalImportInput } from "../src/lib/datasets/datasetLibrary";

function argument(name: string): string | undefined { return process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3); }
const inputPath = argument("input");
const provider = argument("provider") ?? "csv";
if (!inputPath) throw new Error("usage: npm run import-dataset -- --provider=<provider> --input=<file> --dataset-id=<id> --symbol=<symbol> --exchange=<exchange> --asset-type=<asset_type> --timeframe=<timeframe> --source=<source>");
const required = ["dataset-id", "symbol", "exchange", "asset-type", "timeframe", "source"];
for (const name of required) if (!argument(name)) throw new Error(`missing required argument: --${name}=...`);
const base: HistoricalImportInput = {
  dataset_id: argument("dataset-id")!,
  dataset_version: argument("version") ?? "v1",
  symbol: argument("symbol")!,
  exchange: argument("exchange")!,
  asset_type: argument("asset-type") as HistoricalImportInput["asset_type"],
  timeframe: argument("timeframe")!,
  source: argument("source")!,
  creation_timestamp: argument("creation-timestamp") ?? new Date().toISOString(),
  raw: await readFile(inputPath, "utf8")
};
const normalized = createProviderAdapter(provider).toImportInput(base);
const imported = importHistoricalOhlcv(normalized);
const dataset = freezeInstitutionalDataset(normalized, imported);
const quality = validateInstitutionalDataset(dataset);
if (!quality.valid) throw new Error(`imported dataset failed quality validation: ${quality.errors.join("; ")}`);
const library = new DatasetLibrary("datasets");
const entry = await library.register(dataset);
await library.writeReports(await library.validateAll());
console.log("DATASET IMPORTED");
console.log(`Dataset ID: ${entry.metadata.dataset_id}`);
console.log(`Candles: ${entry.metadata.candle_count}`);
console.log(`Range: ${entry.metadata.start_date} to ${entry.metadata.end_date}`);
console.log(`Duplicates removed: ${imported.duplicate_candles_removed}`);
console.log(`Checksum: ${entry.metadata.checksum}`);
