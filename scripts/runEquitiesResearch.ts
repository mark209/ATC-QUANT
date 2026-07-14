import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson } from "../src/lib/trading/tradeJournal";
import { calculateHash } from "../src/lib/quant/replayVerification";

type RawBar = { timestamp: string; open: number; high: number; low: number; close: number; volume: number };
type EquityResult = {
  symbol: string;
  source_file: string;
  provider: string;
  timeframe: "1d";
  asset_type: "stock" | "etf";
  candle_count: number;
  start_date: string;
  end_date: string;
  checksum: string;
  duplicate_timestamps: number;
  unordered_timestamps: number;
  irregular_session_intervals: number;
  invalid_ohlc: number;
  invalid_volume: number;
  quality_status: "REAL_INPUT_REQUIRES_SESSION_AWARE_FREEZE";
  freeze_status: "BLOCKED";
  replay_status: "NOT_RUN";
  statistical_status: "NOT_RUN";
  blocker: string;
};

const symbols = [
  { symbol: "SPY", asset_type: "etf" as const },
  { symbol: "QQQ", asset_type: "etf" as const },
  { symbol: "AAPL", asset_type: "stock" as const },
  { symbol: "MSFT", asset_type: "stock" as const },
  { symbol: "NVDA", asset_type: "stock" as const },
  { symbol: "AMZN", asset_type: "stock" as const }
];

function date(value: string): string { return new Date(value).toISOString().slice(0, 10); }

function inspect(symbol: string, assetType: "stock" | "etf", bars: RawBar[]): EquityResult {
  const timestamps = bars.map((bar) => Date.parse(bar.timestamp));
  const seen = new Set<number>();
  let duplicates = 0;
  let unordered = 0;
  let irregular = 0;
  let invalidOhlc = 0;
  let invalidVolume = 0;
  for (let index = 0; index < bars.length; index += 1) {
    const bar = bars[index];
    const timestamp = timestamps[index];
    if (seen.has(timestamp)) duplicates += 1;
    seen.add(timestamp);
    if (index > 0) {
      const delta = timestamp - timestamps[index - 1];
      if (delta < 0) unordered += 1;
      if (delta !== 86_400_000) irregular += 1;
    }
    if (![bar.open, bar.high, bar.low, bar.close].every(Number.isFinite) || bar.high < Math.max(bar.open, bar.close) || bar.low > Math.min(bar.open, bar.close) || bar.low > bar.high) invalidOhlc += 1;
    if (!Number.isFinite(bar.volume) || bar.volume <= 0) invalidVolume += 1;
  }
  const blocker = "The frozen 1d validator requires every adjacent candle timestamp to be exactly 24 hours apart. US equity sessions omit weekends and exchange holidays, so the real Alpaca bars cannot be frozen without changing timestamps or synthesizing candles. Both actions are prohibited.";
  return {
    symbol,
    source_file: `data/incoming/equities/alpaca-${symbol.toLowerCase()}-1d.json`,
    provider: "Alpaca historical stock bars, IEX feed",
    timeframe: "1d",
    asset_type: assetType,
    candle_count: bars.length,
    start_date: date(bars[0].timestamp),
    end_date: date(bars.at(-1)!.timestamp),
    checksum: calculateHash(bars),
    duplicate_timestamps: duplicates,
    unordered_timestamps: unordered,
    irregular_session_intervals: irregular,
    invalid_ohlc: invalidOhlc,
    invalid_volume: invalidVolume,
    quality_status: "REAL_INPUT_REQUIRES_SESSION_AWARE_FREEZE",
    freeze_status: "BLOCKED",
    replay_status: "NOT_RUN",
    statistical_status: "NOT_RUN",
    blocker
  };
}

function render(result: EquityResult): string {
  return [
    `# ${result.symbol}_REPORT`,
    "",
    "## Dataset Summary",
    `- Provider: ${result.provider}`,
    `- Source file: ${result.source_file}`,
    `- Asset type: ${result.asset_type}`,
    `- Timeframe: ${result.timeframe}`,
    `- Candles acquired: ${result.candle_count}`,
    `- Date range: ${result.start_date} to ${result.end_date}`,
    `- Input checksum: ${result.checksum}`,
    "",
    "## Validation",
    `- Duplicate timestamps: ${result.duplicate_timestamps}`,
    `- Unordered timestamps: ${result.unordered_timestamps}`,
    `- Irregular session intervals: ${result.irregular_session_intervals}`,
    `- Invalid OHLC rows: ${result.invalid_ohlc}`,
    `- Invalid volume rows: ${result.invalid_volume}`,
    `- Quality status: **${result.quality_status}**`,
    "",
    "## Replay and Statistics",
    "Replay was not run because the real input could not be frozen under the existing session-unaware `1d` validator. Consequently completed trades, win rate, expectancy, profit factor, drawdown, Monte Carlo, bootstrap, risk of ruin, and confidence are not available.",
    "",
    "## Freeze Blocker",
    result.blocker,
    "",
    "## Known Limitations",
    "- Alpaca returned real session bars, not synthetic calendar-day bars.",
    "- The existing frozen-dataset and replay architecture is unchanged per the phase constraints.",
    "- No equity result should be compared with crypto until session-aware freezing is supplied by a future platform phase.",
    ""
  ].join("\n");
}

const results: EquityResult[] = [];
for (const { symbol, asset_type } of symbols) {
  const source = `data/incoming/equities/alpaca-${symbol.toLowerCase()}-1d.json`;
  const bars = JSON.parse(await readFile(source, "utf8")) as RawBar[];
  results.push(inspect(symbol, asset_type, bars));
}

const generatedAt = new Date().toISOString();
const master = {
  schema_version: "1.0",
  generated_at: generatedAt,
  report: "MASTER_EQUITIES_REPORT",
  asset_class: "US equities",
  timeframe: "1d",
  datasets: results,
  conclusion: "EQUITIES RESEARCH BLOCKED: six real Alpaca inputs were acquired, but the frozen dataset validator rejects legitimate weekend and holiday session gaps. No replay or statistical result is claimed.",
  highest_expectancy: null,
  highest_confidence: null,
  lowest_drawdown: null,
  most_stable_equity: null,
  recommendation: "Do not infer equities strategy behavior yet. Add a session-aware frozen-dataset contract that preserves exchange trading calendars, then re-import and independently replay these same raw inputs."
};

await mkdir("reports/equities", { recursive: true });
for (const result of results) {
  await writeFile(join("reports/equities", `${result.symbol}_REPORT.json`), canonicalJson(result), "utf8");
  await writeFile(join("reports/equities", `${result.symbol}_REPORT.md`), render(result), "utf8");
}
await writeFile("reports/equities/MASTER_EQUITIES_REPORT.json", canonicalJson(master), "utf8");
await writeFile("reports/equities/MASTER_EQUITIES_REPORT.md", [
  "# MASTER_EQUITIES_REPORT",
  "",
  `Generated: ${generatedAt}`,
  "",
  `**Conclusion:** ${master.conclusion}`,
  "",
  "## Acquired Inputs",
  "| Symbol | Candles | Date range | Irregular session intervals | Freeze | Replay | Statistics |",
  "|---|---:|---|---:|---|---|---|",
  ...results.map((result) => `| ${result.symbol} | ${result.candle_count} | ${result.start_date} to ${result.end_date} | ${result.irregular_session_intervals} | ${result.freeze_status} | ${result.replay_status} | ${result.statistical_status} |`),
  "",
  "## Findings",
  "- Six real Alpaca daily equity inputs were acquired and checksummed.",
  "- Dataset freezing is blocked by the existing exact-24-hour `1d` validation rule, which is incompatible with legitimate exchange sessions.",
  "- No completed trades, replay verification, or statistical findings are reported because doing so would require a frozen dataset that has not passed validation.",
  "",
  "## Recommendation",
  `${master.recommendation}`,
  ""
].join("\n"), "utf8");
console.log("US EQUITIES RESEARCH");
console.log(master.conclusion);
console.log("Report: reports/equities/MASTER_EQUITIES_REPORT.md");
