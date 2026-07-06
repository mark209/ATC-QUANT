import type { AssetOverview, AssetType, MarketDataPoint, MarketDataset } from "@/types/asset";
import { DEFAULT_QUANT_CONFIG } from "@/lib/quant/config";

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
        adjclose?: Array<{
          adjclose?: Array<number | null>;
        }>;
      };
    }>;
    error?: { description?: string };
  };
}

interface ParsedEquityPoint {
  timestamp: number;
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  rawClose?: number;
  adjustedClose?: number;
  closeAdjustmentSource: "adjusted" | "unadjusted";
  ohlcAdjustmentSource: "derived-from-adjusted-close" | "unadjusted";
  volume: number | null;
}

interface CompleteParsedEquityPoint extends ParsedEquityPoint {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
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

export interface EquityHistoryOptions {
  range?: "1y" | "3y" | "5y" | "10y" | "max";
}

async function fetchYahooChart(symbol: string, options: EquityHistoryOptions = {}): Promise<YahooChartResponse> {
  const range = options.range ?? DEFAULT_QUANT_CONFIG.dataHistory.yahooDefaultRange;
  const params = new URLSearchParams({ range, interval: "1d", includePrePost: "false" });
  const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${params}`, {
    cache: "no-store",
    headers: { "User-Agent": "ATC QuantEdge research dashboard" }
  });
  if (!response.ok) {
    throw new Error(`Equity live chart request failed with ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<YahooChartResponse>;
}

export async function fetchEquityMarketData(symbol: string, assetType: AssetType, options: EquityHistoryOptions = {}): Promise<MarketDataset> {
  const normalized = normalizeEquitySymbol(symbol, assetType);
  const payload = await fetchYahooChart(normalized, options);
  const result = payload.chart.result?.[0];

  if (!result) {
    throw new Error(payload.chart.error?.description ?? "Live equity provider returned no chart data.");
  }

  const quote = result.indicators.quote?.[0];
  const adjustedClose = result.indicators.adjclose?.[0]?.adjclose;
  const timestamps = result.timestamp ?? [];
  if (!quote || timestamps.length === 0) {
    throw new Error("Live equity provider returned incomplete OHLCV data.");
  }

  const parsedPoints: ParsedEquityPoint[] = timestamps.map((timestamp, index): ParsedEquityPoint => {
    const rawClose = quote.close?.[index] ?? null;
    const adjClose = adjustedClose?.[index] ?? null;
    const adjustmentRatio = rawClose && adjClose && rawClose > 0 ? adjClose / rawClose : 1;
    const hasAdjustedClose = adjClose !== null && Number.isFinite(adjClose);

    return {
      timestamp: timestamp * 1000,
      date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      open: quote.open?.[index] === null || quote.open?.[index] === undefined ? null : (quote.open[index] as number) * adjustmentRatio,
      high: quote.high?.[index] === null || quote.high?.[index] === undefined ? null : (quote.high[index] as number) * adjustmentRatio,
      low: quote.low?.[index] === null || quote.low?.[index] === undefined ? null : (quote.low[index] as number) * adjustmentRatio,
      close: hasAdjustedClose ? adjClose : rawClose,
      rawClose: rawClose ?? undefined,
      adjustedClose: hasAdjustedClose ? adjClose : undefined,
      closeAdjustmentSource: hasAdjustedClose ? "adjusted" : "unadjusted",
      ohlcAdjustmentSource: hasAdjustedClose ? "derived-from-adjusted-close" : "unadjusted",
      volume: quote.volume?.[index] ?? null
    };
  });

  const completePoints: CompleteParsedEquityPoint[] = parsedPoints
    .filter(
      (point): point is CompleteParsedEquityPoint =>
        point.open !== null && point.high !== null && point.low !== null && point.close !== null && point.volume !== null
    );

  const prices: MarketDataPoint[] = completePoints.map((point) => ({ ...point, quoteVolume: point.volume * point.close }));

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
