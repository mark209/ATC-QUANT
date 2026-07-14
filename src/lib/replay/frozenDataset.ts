import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AssetType, MarketDataPoint } from "@/types/asset";
import { canonicalJson } from "@/lib/trading/tradeJournal";
import { calculateHash } from "@/lib/quant/replayVerification";
import { resolveSessionModel, validateSessionProgression, type AssetClass, type MarketSessionModel, type SessionType } from "@/lib/datasets/marketSession";

export const DATASET_SCHEMA_VERSION = "1.0";
export const DATASET_CHECKSUM_ALGORITHM = "sha256";

export interface FrozenDatasetInput {
  dataset_id: string;
  dataset_version: string;
  source: string;
  symbol: string;
  timeframe: string;
  timezone: string;
  candles: readonly MarketDataPoint[];
  creation_timestamp?: string;
  schema_version?: string;
  checksum_algorithm?: string;
  asset_class?: AssetClass;
  trading_calendar?: string;
  calendar?: string;
  session_type?: SessionType;
  session_model?: SessionType;
  expected_session_frequency?: string;
  exchange?: string;
  asset_type?: AssetType;
}

export interface FrozenDataset extends FrozenDatasetInput {
  readonly dataset_hash: string;
  readonly start_timestamp: string;
  readonly end_timestamp: string;
  readonly candle_count: number;
  readonly creation_timestamp: string;
  readonly schema_version: string;
  readonly checksum_algorithm: string;
}

export interface DatasetManifest {
  readonly dataset_id: string;
  readonly dataset_version: string;
  readonly dataset_hash: string;
  readonly creation_time: string;
  readonly source: string;
  readonly symbol: string;
  readonly timeframe: string;
  readonly candle_count: number;
  readonly schema_version: string;
  readonly checksum: string;
  readonly quality_status: "VALID";
  readonly asset_class?: AssetClass;
  readonly exchange?: string;
  readonly timezone?: string;
  readonly trading_calendar?: string;
  readonly calendar?: string;
  readonly session_type?: SessionType;
  readonly session_model?: SessionType;
  readonly expected_session_frequency?: string;
}

function datasetHashInput(dataset: Omit<FrozenDataset, "dataset_hash">): unknown {
  const { creation_timestamp: _creationTimestamp, dataset_hash: _datasetHash, ...stable } = dataset as FrozenDataset;
  return stable;
}

function assertUtc(value: string, field: string): void {
  if (!value.endsWith("Z") || Number.isNaN(Date.parse(value))) throw new Error(`${field} must be a valid UTC timestamp`);
}

export function validateFrozenDataset(dataset: FrozenDataset): FrozenDataset {
  if (!dataset.dataset_id || !dataset.dataset_version || !dataset.symbol || !dataset.source) throw new Error("dataset identity fields are required");
  if (dataset.schema_version !== DATASET_SCHEMA_VERSION) throw new Error(`unsupported dataset schema version ${dataset.schema_version}`);
  if (dataset.checksum_algorithm !== DATASET_CHECKSUM_ALGORITHM) throw new Error(`unsupported checksum algorithm ${dataset.checksum_algorithm}`);
  if (dataset.candle_count !== dataset.candles.length || dataset.candle_count === 0) throw new Error("candle_count does not match candles");
  assertUtc(dataset.start_timestamp, "start_timestamp");
  assertUtc(dataset.end_timestamp, "end_timestamp");
  assertUtc(dataset.creation_timestamp, "creation_timestamp");
  let previousTimestamp = 0;
  for (let index = 0; index < dataset.candles.length; index += 1) {
    const candle = dataset.candles[index];
    if (!Number.isInteger(candle.timestamp) || candle.timestamp <= 0) throw new Error(`invalid candle timestamp at index ${index}`);
    if (index > 0) {
      if (candle.timestamp === previousTimestamp) throw new Error(`duplicate candle timestamp ${candle.timestamp}`);
      if (candle.timestamp < previousTimestamp) throw new Error(`candles are unordered at index ${index}`);
    }
    if (![candle.open, candle.high, candle.low, candle.close, candle.volume].every(Number.isFinite)) throw new Error(`non-finite OHLCV at index ${index}`);
    if (candle.open <= 0 || candle.high <= 0 || candle.low <= 0 || candle.close <= 0) throw new Error(`non-positive OHLC value at index ${index}`);
    if (candle.high < Math.max(candle.open, candle.close) || candle.low > Math.min(candle.open, candle.close) || candle.low > candle.high) throw new Error(`invalid OHLC relationship at index ${index}`);
    if (candle.volume <= 0) throw new Error(`invalid volume at index ${index}`);
    if (candle.quoteVolume !== undefined && (!Number.isFinite(candle.quoteVolume) || candle.quoteVolume <= 0)) throw new Error(`invalid quote volume at index ${index}`);
    if (new Date(candle.timestamp).toISOString().slice(0, 10) !== candle.date) throw new Error(`candle date does not match timestamp at index ${index}`);
    previousTimestamp = candle.timestamp;
  }
  if (dataset.candles[0].timestamp !== Date.parse(dataset.start_timestamp) || dataset.candles.at(-1)?.timestamp !== Date.parse(dataset.end_timestamp)) throw new Error("dataset timestamp bounds do not match candles");
  const sessionModel = resolveSessionModel(dataset as FrozenDataset & { asset_type?: "crypto" | "stock" | "etf" | "index" });
  const sessionValidation = validateSessionProgression(dataset.candles, sessionModel);
  if (!sessionValidation.valid) throw new Error(sessionValidation.errors.join("; "));
  const expectedHash = calculateHash(datasetHashInput(dataset));
  if (dataset.dataset_hash !== expectedHash) throw new Error("dataset_hash does not match dataset contents");
  return Object.freeze({ ...dataset, candles: Object.freeze(dataset.candles.map((candle) => Object.freeze({ ...candle }))) });
}

export function createFrozenDataset(input: FrozenDatasetInput): FrozenDataset {
  if (input.candles.length === 0) throw new Error("cannot create an empty frozen dataset");
  const candles = input.candles.map((candle) => ({ ...candle }));
  const base = {
    ...input,
    candles,
    candle_count: candles.length,
    start_timestamp: new Date(candles[0].timestamp).toISOString(),
    end_timestamp: new Date(candles.at(-1)!.timestamp).toISOString(),
    creation_timestamp: input.creation_timestamp ?? new Date().toISOString(),
    schema_version: input.schema_version ?? DATASET_SCHEMA_VERSION,
    checksum_algorithm: input.checksum_algorithm ?? DATASET_CHECKSUM_ALGORITHM
  } as Omit<FrozenDataset, "dataset_hash">;
  const dataset = { ...base, dataset_hash: calculateHash(datasetHashInput(base)) } as FrozenDataset;
  return validateFrozenDataset(dataset);
}

export function createDatasetManifest(dataset: FrozenDataset): DatasetManifest {
  validateFrozenDataset(dataset);
  const base = {
    dataset_id: dataset.dataset_id,
    dataset_version: dataset.dataset_version,
    dataset_hash: dataset.dataset_hash,
    creation_time: dataset.creation_timestamp,
    source: dataset.source,
    symbol: dataset.symbol,
    timeframe: dataset.timeframe,
    candle_count: dataset.candle_count,
    schema_version: dataset.schema_version,
    checksum: dataset.dataset_hash,
    quality_status: "VALID"
  } as DatasetManifest;
  const hasSessionMetadata = Boolean(dataset.asset_class || dataset.trading_calendar || dataset.calendar || dataset.session_type || dataset.session_model || dataset.expected_session_frequency);
  if (!hasSessionMetadata) return Object.freeze(base);
  const sessionModel = resolveSessionModel(dataset as FrozenDataset & { asset_type?: "crypto" | "stock" | "etf" | "index" });
  return Object.freeze({ ...base, asset_class: sessionModel.asset_class, exchange: sessionModel.exchange, timezone: sessionModel.timezone, trading_calendar: sessionModel.trading_calendar, calendar: sessionModel.trading_calendar, session_type: sessionModel.session_type, session_model: sessionModel.session_type, expected_session_frequency: sessionModel.expected_session_frequency });
}

export class FrozenDatasetStore {
  constructor(private readonly filePath: string) {}

  async write(dataset: FrozenDataset): Promise<void> {
    validateFrozenDataset(dataset);
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, canonicalJson(dataset), { encoding: "utf8", flag: "wx" });
  }

  async read(): Promise<FrozenDataset> {
    const raw = JSON.parse(await readFile(this.filePath, "utf8")) as FrozenDataset;
    return validateFrozenDataset(raw);
  }
}
