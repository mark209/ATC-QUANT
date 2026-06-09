import type { AssetOverview, MarketDataPoint, MarketDataset } from "@/types/asset";
import { DEFAULT_QUANT_CONFIG } from "@/lib/quant/config";

type BinanceKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string
];

interface BinanceTicker {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  volume: string;
  quoteVolume: string;
  closeTime: number;
}

const cryptoNames: Record<string, string> = {
  BTCUSDT: "Bitcoin / Tether",
  ETHUSDT: "Ethereum / Tether",
  BNBUSDT: "BNB / Tether",
  SOLUSDT: "Solana / Tether",
  XRPUSDT: "XRP / Tether",
  ADAUSDT: "Cardano / Tether"
};

export function normalizeBinanceSymbol(rawSymbol: string): string {
  const cleaned = rawSymbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.endsWith("USDT") || cleaned.endsWith("BUSD") || cleaned.endsWith("FDUSD") || cleaned.endsWith("USDC")) {
    return cleaned;
  }
  return `${cleaned}USDT`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Binance request failed with ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export interface BinanceHistoryOptions {
  lookbackDays?: number | "max";
  pageLimit?: number;
  maxPages?: number;
}

function klineToMarketDataPoint(row: BinanceKline): MarketDataPoint {
  return {
    timestamp: row[0],
    date: new Date(row[0]).toISOString().slice(0, 10),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
    quoteVolume: Number(row[7])
  };
}

async function fetchPaginatedDailyKlines(symbol: string, options: BinanceHistoryOptions): Promise<BinanceKline[]> {
  const pageLimit = options.pageLimit ?? DEFAULT_QUANT_CONFIG.dataHistory.cryptoPageLimit;
  const maxPages = options.maxPages ?? DEFAULT_QUANT_CONFIG.dataHistory.cryptoMaxPages;
  const lookbackDays = options.lookbackDays ?? DEFAULT_QUANT_CONFIG.dataHistory.cryptoLookbackDays;
  const allRows: BinanceKline[] = [];
  let startTime =
    lookbackDays === "max"
      ? 0
      : Date.now() - Math.max(DEFAULT_QUANT_CONFIG.dataHistory.cryptoMinimumTargetDays, lookbackDays) * 86400000;

  for (let page = 0; page < maxPages; page += 1) {
    const params = new URLSearchParams({
      symbol,
      interval: "1d",
      limit: String(pageLimit),
      startTime: String(Math.max(0, Math.floor(startTime)))
    });
    const rows = await fetchJson<BinanceKline[]>(`https://api.binance.com/api/v3/klines?${params.toString()}`);
    if (rows.length === 0) break;
    allRows.push(...rows);
    if (rows.length < pageLimit) break;
    startTime = rows[rows.length - 1][0] + 86400000;
  }

  const uniqueRows = new Map<number, BinanceKline>();
  for (const row of allRows) uniqueRows.set(row[0], row);
  return Array.from(uniqueRows.values()).sort((a, b) => a[0] - b[0]);
}

export async function fetchBinanceMarketData(symbol: string, options: BinanceHistoryOptions | number = {}): Promise<MarketDataset> {
  const normalized = normalizeBinanceSymbol(symbol);
  const historyOptions = typeof options === "number" ? { lookbackDays: options } : options;
  const klines = await fetchPaginatedDailyKlines(normalized, historyOptions);
  const ticker = await fetchJson<BinanceTicker>(`https://api.binance.com/api/v3/ticker/24hr?symbol=${normalized}`);

  const prices = klines.map(klineToMarketDataPoint);

  const overview: AssetOverview = {
    symbol: normalized,
    name: cryptoNames[normalized] ?? normalized,
    assetType: "crypto",
    market: "Spot crypto",
    exchange: "Binance",
    currentPrice: Number(ticker.lastPrice),
    dailyChangePercent: Number(ticker.priceChangePercent) / 100,
    dailyVolume: Number(ticker.volume),
    quoteVolume: Number(ticker.quoteVolume),
    lastUpdated: new Date(ticker.closeTime).toISOString(),
    liveSource: "Live Binance Spot API via Binance-compatible adapter"
  };

  return { overview, prices };
}
