import type { AssetOverview, AssetType, MarketDataPoint, MarketDataset } from "@/types/asset";

interface YahooChartResponse {
  chart: {
    result?: Array<{
      meta: {
        symbol: string;
        longName?: string;
        shortName?: string;
        exchangeName?: string;
        regularMarketPrice?: number;
        previousClose?: number;
        regularMarketTime?: number;
      };
      timestamp?: number[];
      indicators: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
    error?: { description?: string };
  };
}

function normalizeEquitySymbol(rawSymbol: string, assetType: AssetType): string {
  const cleaned = rawSymbol.trim().toUpperCase();
  if (assetType === "index") {
    if (cleaned === "SPX" || cleaned === "SP500" || cleaned === "S&P500") return "^GSPC";
    if (cleaned === "NDX" || cleaned === "NASDAQ") return "^IXIC";
    if (cleaned === "DJI" || cleaned === "DOW") return "^DJI";
  }
  return cleaned;
}

async function fetchYahooChart(symbol: string): Promise<YahooChartResponse> {
  const params = new URLSearchParams({ range: "1y", interval: "1d", includePrePost: "false" });
  const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${params}`, {
    cache: "no-store",
    headers: { "User-Agent": "ATC QuantEdge research dashboard" }
  });
  if (!response.ok) {
    throw new Error(`Equity live chart request failed with ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<YahooChartResponse>;
}

export async function fetchEquityMarketData(symbol: string, assetType: AssetType): Promise<MarketDataset> {
  const normalized = normalizeEquitySymbol(symbol, assetType);
  const payload = await fetchYahooChart(normalized);
  const result = payload.chart.result?.[0];

  if (!result) {
    throw new Error(payload.chart.error?.description ?? "Live equity provider returned no chart data.");
  }

  const quote = result.indicators.quote?.[0];
  const timestamps = result.timestamp ?? [];
  if (!quote || timestamps.length === 0) {
    throw new Error("Live equity provider returned incomplete OHLCV data.");
  }

  const prices: MarketDataPoint[] = timestamps
    .map((timestamp, index) => ({
      timestamp: timestamp * 1000,
      date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      open: quote.open?.[index] ?? null,
      high: quote.high?.[index] ?? null,
      low: quote.low?.[index] ?? null,
      close: quote.close?.[index] ?? null,
      volume: quote.volume?.[index] ?? null
    }))
    .filter(
      (point): point is MarketDataPoint =>
        point.open !== null && point.high !== null && point.low !== null && point.close !== null && point.volume !== null
    )
    .map((point) => ({ ...point, quoteVolume: point.volume * point.close }));

  const currentPrice = result.meta.regularMarketPrice ?? prices.at(-1)?.close ?? 0;
  const previousClose = result.meta.previousClose ?? prices.at(-2)?.close ?? currentPrice;

  const overview: AssetOverview = {
    symbol: result.meta.symbol,
    name: result.meta.longName ?? result.meta.shortName ?? result.meta.symbol,
    assetType,
    market: assetType === "index" ? "Index" : assetType === "etf" ? "ETF" : "Public equity",
    exchange: result.meta.exchangeName ?? "Live market data provider",
    currentPrice,
    dailyChangePercent: previousClose === 0 ? 0 : currentPrice / previousClose - 1,
    dailyVolume: prices.at(-1)?.volume ?? 0,
    quoteVolume: (prices.at(-1)?.volume ?? 0) * currentPrice,
    lastUpdated: new Date((result.meta.regularMarketTime ?? Date.now() / 1000) * 1000).toISOString(),
    liveSource: "Live public equity chart adapter"
  };

  return { overview, prices };
}
