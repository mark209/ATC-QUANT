import type { AssetOverview, MarketDataPoint, MarketDataset } from "@/types/asset";

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

export async function fetchBinanceMarketData(symbol: string, limit = 365): Promise<MarketDataset> {
  const normalized = normalizeBinanceSymbol(symbol);
  const params = new URLSearchParams({ symbol: normalized, interval: "1d", limit: String(limit) });
  const [klines, ticker] = await Promise.all([
    fetchJson<BinanceKline[]>(`https://api.binance.com/api/v3/klines?${params.toString()}`),
    fetchJson<BinanceTicker>(`https://api.binance.com/api/v3/ticker/24hr?symbol=${normalized}`)
  ]);

  const prices: MarketDataPoint[] = klines.map((row) => ({
    timestamp: row[0],
    date: new Date(row[0]).toISOString().slice(0, 10),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
    quoteVolume: Number(row[7])
  }));

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
