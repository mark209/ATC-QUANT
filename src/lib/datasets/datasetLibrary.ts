import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AssetType, MarketDataPoint } from "@/types/asset";
import { classifyRegime } from "@/lib/quant/signalLayer";
import { DEFAULT_QUANT_CONFIG } from "@/lib/quant/config";
import { periodsPerYear, volatilityRegime } from "@/lib/quant/riskRegime";
import { calculateLogReturns } from "@/lib/quant/returns";
import { annualizedVolatility } from "@/lib/quant/volatility";
import { canonicalJson } from "@/lib/trading/tradeJournal";
import { calculateHash } from "@/lib/quant/replayVerification";
import { createFrozenDataset, validateFrozenDataset, type FrozenDataset } from "@/lib/replay/frozenDataset";
import { resolveSessionModel, sessionModelForAssetType, validateSessionProgression, type AssetClass, type SessionValidationReport, type SessionType } from "@/lib/datasets/marketSession";

export const DATASET_LIBRARY_SCHEMA_VERSION = "1.0";
export const DATASET_LIBRARY_ROOT = "datasets";

export interface InstitutionalDatasetMetadata {
  dataset_id: string;
  dataset_version: string;
  symbol: string;
  exchange: string;
  asset_type: AssetType;
  timeframe: string;
  source: string;
  timezone: string;
  start_date: string;
  end_date: string;
  candle_count: number;
  schema_version: string;
  checksum: string;
  creation_timestamp: string;
  quality_status: "VALID";
  synthetic: false;
  asset_class?: AssetClass;
  trading_calendar?: string;
  calendar?: string;
  session_type?: SessionType;
  session_model?: SessionType;
  expected_session_frequency?: string;
}

export interface InstitutionalFrozenDataset extends FrozenDataset {
  exchange: string;
  asset_type: AssetType;
  start_date: string;
  end_date: string;
  quality_status: "VALID";
  synthetic: false;
  asset_class?: AssetClass;
  trading_calendar?: string;
  session_type?: SessionType;
  session_model?: SessionType;
  expected_session_frequency?: string;
}

export interface DatasetCatalogEntry {
  metadata: InstitutionalDatasetMetadata;
  path: string;
}

export interface DatasetCatalog {
  schema_version: string;
  datasets: readonly DatasetCatalogEntry[];
}

export interface DatasetQualityReport {
  dataset_id: string;
  valid: boolean;
  errors: readonly string[];
  warnings: readonly string[];
  duplicate_candles: number;
  missing_timestamps: number;
  unordered_candles: number;
  invalid_ohlc: number;
  invalid_volume: number;
  timezone_errors: number;
  checksum_valid: boolean;
  session_validation?: SessionValidationReport;
}

export interface DatasetCoverageReport {
  dataset_id: string;
  symbol: string;
  timeframe: string;
  candle_count: number;
  warmup_available: number;
  warmup_required: number;
  warmup_exclusions: number;
  regime_counts: Record<string, number>;
  volatility_counts: Record<string, number>;
  trending_periods: number;
  mean_reverting_periods: number;
}

export interface DatasetComparisonReport {
  generated_at: string;
  datasets: readonly DatasetCoverageReport[];
  note: string;
}

export interface HistoricalImportResult {
  candles: readonly MarketDataPoint[];
  duplicate_candles_removed: number;
  source_rows: number;
}

export interface HistoricalImportInput {
  dataset_id: string;
  dataset_version: string;
  symbol: string;
  exchange: string;
  asset_type: AssetType;
  timeframe: string;
  source: string;
  creation_timestamp: string;
  raw: string;
  timezone?: string;
  asset_class?: AssetClass;
  trading_calendar?: string;
  session_type?: SessionType;
  session_model?: SessionType;
  expected_session_frequency?: string;
}

function parseTimestamp(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value < 10_000_000_000 ? value * 1000 : value;
  if (typeof value !== "string" || !value.endsWith("Z")) throw new Error("timestamps must be UTC ISO-8601 values ending in Z or UTC epoch values");
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) throw new Error(`invalid UTC timestamp: ${value}`);
  return parsed;
}

function parseNumber(value: unknown, field: string): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) throw new Error(`${field} must be numeric`);
  return number;
}

function parseCsv(raw: string): Record<string, string>[] {
  const rows = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (rows.length < 2) throw new Error("CSV must contain a header and at least one data row");
  const headers = rows[0].split(",").map((header) => header.trim().toLowerCase());
  return rows.slice(1).map((line) => {
    const values = line.split(",");
    if (values.length !== headers.length) throw new Error("CSV row column count does not match header");
    return Object.fromEntries(headers.map((header, index) => [header, values[index].trim()]));
  });
}

function parseRawRows(raw: string): Record<string, unknown>[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    const rows = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" && "candles" in parsed ? (parsed as { candles: unknown[] }).candles : null;
    if (!Array.isArray(rows)) throw new Error("JSON must be an array of OHLCV rows or an object with candles");
    return rows as Record<string, unknown>[];
  } catch (jsonError) {
    if (raw.trimStart().startsWith("{") || raw.trimStart().startsWith("[")) throw jsonError;
    return parseCsv(raw);
  }
}

export function importHistoricalOhlcv(input: HistoricalImportInput): HistoricalImportResult {
  const rows = parseRawRows(input.raw);
  const byTimestamp = new Map<number, MarketDataPoint>();
  let duplicates = 0;
  for (const row of rows) {
    const timestamp = parseTimestamp(row.timestamp ?? row.time ?? row.datetime ?? row.date);
    const candle: MarketDataPoint = {
      timestamp,
      date: new Date(timestamp).toISOString().slice(0, 10),
      open: parseNumber(row.open, "open"),
      high: parseNumber(row.high, "high"),
      low: parseNumber(row.low, "low"),
      close: parseNumber(row.close, "close"),
      volume: parseNumber(row.volume, "volume"),
      quoteVolume: row.quotevolume === undefined && row.quote_volume === undefined ? undefined : parseNumber(row.quotevolume ?? row.quote_volume, "quoteVolume")
    };
    if (byTimestamp.has(timestamp)) duplicates += 1;
    else byTimestamp.set(timestamp, candle);
  }
  const candles = [...byTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp);
  return { candles, duplicate_candles_removed: duplicates, source_rows: rows.length };
}

export function freezeInstitutionalDataset(input: HistoricalImportInput, imported: HistoricalImportResult): InstitutionalFrozenDataset {
  if (imported.candles.length === 0) throw new Error("cannot freeze an empty historical dataset");
  if (!input.source || !input.exchange || input.source.toLowerCase().includes("synthetic") || input.source.toLowerCase().includes("fixture")) throw new Error("institutional snapshots require a real source and cannot be synthetic fixtures");
  const inferredSession = sessionModelForAssetType(input.asset_type, input.exchange);
  const session = { ...inferredSession, exchange: input.exchange, timezone: input.timezone ?? inferredSession.timezone, asset_class: input.asset_class ?? inferredSession.asset_class, trading_calendar: input.trading_calendar ?? inferredSession.trading_calendar, session_type: input.session_type ?? inferredSession.session_type, session_model: input.session_model ?? input.session_type ?? inferredSession.session_type, expected_session_frequency: input.expected_session_frequency ?? inferredSession.expected_session_frequency };
  const base = createFrozenDataset({ dataset_id: input.dataset_id, dataset_version: input.dataset_version, source: input.source, symbol: input.symbol, timeframe: input.timeframe, candles: imported.candles, creation_timestamp: input.creation_timestamp, asset_type: input.asset_type, ...session, start_date: new Date(imported.candles[0].timestamp).toISOString().slice(0, 10), end_date: new Date(imported.candles.at(-1)!.timestamp).toISOString().slice(0, 10), quality_status: "VALID", synthetic: false } as never);
  return { ...base, exchange: input.exchange, asset_type: input.asset_type, start_date: base.candles[0].date, end_date: base.candles.at(-1)!.date, quality_status: "VALID", synthetic: false } as InstitutionalFrozenDataset;
}

export function validateInstitutionalDataset(dataset: InstitutionalFrozenDataset): DatasetQualityReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  let duplicate = 0;
  let missing = 0;
  let unordered = 0;
  let invalidOhlc = 0;
  let invalidVolume = 0;
  let timezoneErrors = 0;
  let previous = 0;
  const seen = new Set<number>();
  for (const candle of dataset.candles) {
    if (seen.has(candle.timestamp)) duplicate += 1;
    seen.add(candle.timestamp);
    if (candle.timestamp < previous) unordered += 1;
    if (![candle.open, candle.high, candle.low, candle.close].every(Number.isFinite) || candle.high < Math.max(candle.open, candle.close) || candle.low > Math.min(candle.open, candle.close) || candle.low > candle.high) invalidOhlc += 1;
    if (!Number.isFinite(candle.volume) || candle.volume <= 0) invalidVolume += 1;
    if (new Date(candle.timestamp).toISOString().slice(0, 10) !== candle.date) timezoneErrors += 1;
    previous = candle.timestamp;
  }
  const sessionValidation = validateSessionProgression(dataset.candles, resolveSessionModel(dataset));
  missing = sessionValidation.unexpected_missing_sessions;
  try { validateFrozenDataset(dataset); } catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
  if (duplicate > 0) errors.push(`duplicate candles: ${duplicate}`);
  if (unordered > 0) errors.push(`unordered candles: ${unordered}`);
  if (invalidOhlc > 0) errors.push(`invalid OHLC candles: ${invalidOhlc}`);
  if (invalidVolume > 0) errors.push(`invalid volume candles: ${invalidVolume}`);
  if (timezoneErrors > 0) errors.push(`timezone/date consistency errors: ${timezoneErrors}`);
  if (sessionValidation.accepted_gaps > 0) warnings.push(`accepted session gaps: ${sessionValidation.accepted_gaps}`);
  if (missing > 0) warnings.push(`unexpected missing sessions: ${missing}`);
  const checksumValid = errors.every((error) => !error.includes("dataset_hash"));
  return { dataset_id: dataset.dataset_id, valid: errors.length === 0 && checksumValid, errors, warnings, duplicate_candles: duplicate, missing_timestamps: missing, unordered_candles: unordered, invalid_ohlc: invalidOhlc, invalid_volume: invalidVolume, timezone_errors: timezoneErrors, checksum_valid: checksumValid, session_validation: sessionValidation };
}

export function buildCoverageReport(dataset: InstitutionalFrozenDataset, warmupRequired = 60): DatasetCoverageReport {
  const regimeCounts: Record<string, number> = {};
  const volatilityCounts: Record<string, number> = {};
  let trending = 0;
  let meanReverting = 0;
  for (let index = warmupRequired; index < dataset.candles.length; index += 1) {
    const history = dataset.candles.slice(0, index);
    const prices = history.map((candle) => candle.close);
    const returns = calculateLogReturns(prices);
    const volatility = annualizedVolatility(returns, periodsPerYear(dataset.asset_type));
    const regime = classifyRegime({ prices, realizedVolatility: volatility, currentDrawdown: 0, assetType: dataset.asset_type, config: DEFAULT_QUANT_CONFIG });
    const volatilityLabel = volatilityRegime(volatility, dataset.asset_type);
    regimeCounts[regime] = (regimeCounts[regime] ?? 0) + 1;
    volatilityCounts[volatilityLabel] = (volatilityCounts[volatilityLabel] ?? 0) + 1;
    if (regime === "Trend Up" || regime === "Trend Down") trending += 1;
    if (regime === "Range / Chop") meanReverting += 1;
  }
  return { dataset_id: dataset.dataset_id, symbol: dataset.symbol, timeframe: dataset.timeframe, candle_count: dataset.candle_count, warmup_available: Math.max(0, dataset.candle_count - warmupRequired), warmup_required: warmupRequired, warmup_exclusions: Math.min(warmupRequired, dataset.candle_count), regime_counts: regimeCounts, volatility_counts: volatilityCounts, trending_periods: trending, mean_reverting_periods: meanReverting };
}

export function compareCoverageReports(reports: readonly DatasetCoverageReport[]): DatasetComparisonReport {
  return { generated_at: new Date().toISOString(), datasets: reports, note: reports.length === 0 ? "No real institutional datasets are available; signal, proposal, execution, and completed-trade comparison is blocked until supplied snapshots are validated and replayed." : "Replay outcome comparison is generated after each validated dataset is replayed." };
}

export class DatasetLibrary {
  constructor(private readonly root = DATASET_LIBRARY_ROOT) {}
  private catalogPath(): string { return join(this.root, "catalog.json"); }
  async catalog(): Promise<DatasetCatalog> {
    try { return JSON.parse(await readFile(this.catalogPath(), "utf8")) as DatasetCatalog; }
    catch { return { schema_version: DATASET_LIBRARY_SCHEMA_VERSION, datasets: [] }; }
  }
  async list(): Promise<readonly DatasetCatalogEntry[]> { return (await this.catalog()).datasets; }
  async get(datasetId: string): Promise<{ metadata: InstitutionalDatasetMetadata; dataset: InstitutionalFrozenDataset }> {
    const entry = (await this.catalog()).datasets.find((candidate) => candidate.metadata.dataset_id === datasetId);
    if (!entry) throw new Error(`unknown institutional dataset: ${datasetId}`);
    const dataset = JSON.parse(await readFile(join(this.root, entry.path), "utf8")) as InstitutionalFrozenDataset;
    const quality = validateInstitutionalDataset(dataset);
    if (!quality.valid) throw new Error(`dataset ${datasetId} failed quality validation: ${quality.errors.join("; ")}`);
    if (dataset.dataset_hash !== entry.metadata.checksum) throw new Error(`dataset ${datasetId} checksum does not match catalog metadata`);
    return { metadata: entry.metadata, dataset };
  }
  async validateAll(): Promise<{ reports: readonly DatasetQualityReport[]; coverage: readonly DatasetCoverageReport[] }> {
    const reports: DatasetQualityReport[] = [];
    const coverage: DatasetCoverageReport[] = [];
    for (const entry of await this.list()) {
      try { const loaded = await this.get(entry.metadata.dataset_id); reports.push(validateInstitutionalDataset(loaded.dataset)); coverage.push(buildCoverageReport(loaded.dataset)); }
      catch (error) { reports.push({ dataset_id: entry.metadata.dataset_id, valid: false, errors: [error instanceof Error ? error.message : String(error)], warnings: [], duplicate_candles: 0, missing_timestamps: 0, unordered_candles: 0, invalid_ohlc: 0, invalid_volume: 0, timezone_errors: 0, checksum_valid: false }); }
    }
    return { reports, coverage };
  }
  async writeCatalog(catalog: DatasetCatalog): Promise<void> { await mkdir(this.root, { recursive: true }); await writeFile(this.catalogPath(), canonicalJson(catalog), "utf8"); }
  async register(dataset: InstitutionalFrozenDataset): Promise<DatasetCatalogEntry> {
    const catalog = await this.catalog();
    if (catalog.datasets.some((entry) => entry.metadata.dataset_id === dataset.dataset_id)) throw new Error(`dataset already registered: ${dataset.dataset_id}`);
    const relativePath = join(dataset.symbol, dataset.timeframe, `${dataset.dataset_version}.json`);
    const absolutePath = join(this.root, relativePath);
    await mkdir(join(this.root, dataset.symbol, dataset.timeframe), { recursive: true });
    await writeFile(absolutePath, canonicalJson(dataset), { encoding: "utf8", flag: "wx" });
    const metadata: InstitutionalDatasetMetadata = { dataset_id: dataset.dataset_id, dataset_version: dataset.dataset_version, symbol: dataset.symbol, exchange: dataset.exchange, asset_type: dataset.asset_type, timeframe: dataset.timeframe, source: dataset.source, timezone: dataset.timezone, start_date: dataset.start_date, end_date: dataset.end_date, candle_count: dataset.candle_count, schema_version: DATASET_LIBRARY_SCHEMA_VERSION, checksum: dataset.dataset_hash, creation_timestamp: dataset.creation_timestamp, quality_status: "VALID", synthetic: false, asset_class: dataset.asset_class, trading_calendar: dataset.trading_calendar, calendar: dataset.calendar, session_type: dataset.session_type, session_model: dataset.session_model, expected_session_frequency: dataset.expected_session_frequency };
    const entry = { metadata, path: relativePath };
    await this.writeCatalog({ ...catalog, datasets: [...catalog.datasets, entry] });
    return entry;
  }
  async writeReports(result: { reports: readonly DatasetQualityReport[]; coverage: readonly DatasetCoverageReport[] }): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await writeFile(join(this.root, "validation-report.json"), canonicalJson(result.reports), "utf8");
    await writeFile(join(this.root, "coverage-report.json"), canonicalJson(compareCoverageReports(result.coverage)), "utf8");
    const sessionRows = result.reports.map((report) => {
      const session = report.session_validation;
      return session ? `| ${report.dataset_id} | ${session.session_model.session_type} | ${session.accepted_gaps} | ${session.weekend_gaps} | ${session.holiday_gaps} | ${session.rejected_gaps} | ${session.out_of_session_bars} | ${report.valid ? "VALID" : "INVALID"} |` : `| ${report.dataset_id} | legacy/inferred | n/a | n/a | n/a | n/a | n/a | ${report.valid ? "VALID" : "INVALID"} |`;
    });
    await writeFile("SESSION_VALIDATION_REPORT.md", [`# SESSION_VALIDATION_REPORT`, "", "| Dataset | Session type | Accepted gaps | Weekend gaps | Holiday gaps | Rejected gaps | Out-of-session bars | Status |", "|---|---|---:|---:|---:|---:|---:|---|", ...sessionRows, "", "## Calendar assumptions", "- `CRYPTO_24_7` requires continuous 24-hour progression.", "- `US_EQUITY` uses NYSE/NASDAQ weekday sessions; weekends and recognized US exchange holidays are accepted gaps.", "- `FOREX` and `FUTURES` accept weekends as closures but reject unexpected weekday gaps until a more specific exchange calendar is declared.", "- No timestamps are changed and no candles are fabricated or interpolated.", ""].join("\n"), "utf8");
  }
  async discoverJsonDatasets(): Promise<string[]> { try { return (await readdir(this.root)).filter((name) => name.endsWith(".json") && !name.includes("catalog") && !name.includes("report")); } catch { return []; } }
}
