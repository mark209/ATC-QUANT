import { mkdir, writeFile } from "node:fs/promises";
import { canonicalJson } from "../src/lib/trading/tradeJournal";

const symbols = ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "AMZN"];
const end = Math.floor(Date.parse("2026-07-14T00:00:00.000Z") / 1000);
const startBySymbol: Record<string, number> = {
  // Yahoo's first AAPL row is a zero-volume provider artifact. Start at the
  // first valid daily observation rather than altering or synthesizing it.
  AAPL: Math.floor(Date.parse("1981-08-11T00:00:00.000Z") / 1000)
};
await mkdir("data/incoming/equities", { recursive: true });
for (const symbol of symbols) {
  const period1 = startBySymbol[symbol] ?? 0;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${end}&interval=1d&events=history&includeAdjustedClose=true`;
  const response = await fetch(url, { headers: { "User-Agent": "ATC-research/2.1" } });
  if (!response.ok) throw new Error(`Yahoo ${symbol} request failed: ${response.status}`);
  const payload = await response.json() as { chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ open?: Array<number | null>; high?: Array<number | null>; low?: Array<number | null>; close?: Array<number | null>; volume?: Array<number | null> }> } }> } };
  const result = payload.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  if (!result?.timestamp || !quote) throw new Error(`Yahoo ${symbol} response has no daily bars`);
  const rows = result.timestamp.flatMap((timestamp, index) => {
    const open = quote.open?.[index];
    const high = quote.high?.[index];
    const low = quote.low?.[index];
    const close = quote.close?.[index];
    const volume = quote.volume?.[index];
    if (![open, high, low, close, volume].every((value) => typeof value === "number" && Number.isFinite(value))) return [];
    return [{ timestamp: new Date(timestamp * 1000).toISOString(), open, high, low, close, volume }];
  });
  if (rows.length === 0) throw new Error(`Yahoo ${symbol} returned no usable bars`);
  await writeFile(`data/incoming/equities/yahoo-${symbol.toLowerCase()}-1d.json`, canonicalJson(rows), "utf8");
  console.log(`${symbol}: ${rows.length} Yahoo daily bars`);
}
