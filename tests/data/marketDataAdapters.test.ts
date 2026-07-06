import { describe, expect, it, vi } from "vitest";
import { fetchBinanceMarketData } from "@/lib/data/binanceAdapter";
import { fetchEquityMarketData } from "@/lib/data/equityAdapter";
import { fetchMarketDataWithFallback } from "@/lib/data/marketDataAdapter";

const DAY_MS = 24 * 60 * 60 * 1000;

function yahooPayload(symbol: string, timestamps: number[], options: { adjusted?: boolean } = {}) {
  const adjusted = options.adjusted ?? true;
  return {
    chart: {
      result: [
        {
          meta: {
            symbol,
            longName: symbol,
            exchangeName: "Test Exchange",
            regularMarketPrice: 100,
            previousClose: 99,
            regularMarketTime: Math.floor(timestamps.at(-1)! / 1000)
          },
          timestamp: timestamps.map((timestamp) => Math.floor(timestamp / 1000)),
          indicators: {
            quote: [
              {
                open: timestamps.map((_, index) => 90 + index * 0.01),
                high: timestamps.map((_, index) => 101 + index * 0.01),
                low: timestamps.map((_, index) => 89 + index * 0.01),
                close: timestamps.map((_, index) => 100 + index * 0.01),
                volume: timestamps.map(() => 1000000)
              }
            ],
            ...(adjusted
              ? {
                  adjclose: [
                    {
                      adjclose: timestamps.map((_, index) => 100 + index * 0.01)
                    }
                  ]
                }
              : {})
          }
        }
      ]
    }
  };
}

function dailyTimestamps(count: number, start = Date.UTC(2016, 0, 1)): number[] {
  return Array.from({ length: count }, (_, index) => start + index * DAY_MS);
}

function quarterlyTimestamps(count: number, start = Date.UTC(1984, 11, 1)): number[] {
  return Array.from({ length: count }, (_, index) => start + index * DAY_MS * 91);
}

describe("market data adapters", () => {
  it("requests max daily equity history by default for validation", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        chart: {
          result: [
            {
              meta: {
                symbol: "SPY",
                longName: "SPDR S&P 500 ETF",
                exchangeName: "NYSE Arca",
                regularMarketPrice: 500,
                previousClose: 495,
                regularMarketTime: 1780876800
              },
              timestamp: [1780790400, 1780876800],
              indicators: {
                quote: [
                  {
                    open: [490, 496],
                    high: [501, 502],
                    low: [489, 494],
                    close: [495, 500],
                    volume: [1000000, 1100000]
                  }
                ]
              }
            }
          ]
        }
      })
    }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchEquityMarketData("SPY", "etf");

    expect(fetchMock).toHaveBeenCalledOnce();
    const equityUrl = String((fetchMock.mock.calls as unknown as Array<[string]>)[0][0]);
    expect(equityUrl).toContain("range=max");
    expect(equityUrl).toContain("interval=1d");
    vi.unstubAllGlobals();
  });

  it("allows configurable equity history lookback", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        chart: {
          result: [
            {
              meta: { symbol: "AAPL", regularMarketPrice: 200, previousClose: 198, regularMarketTime: 1780876800 },
              timestamp: [1780790400, 1780876800],
              indicators: {
                quote: [{ open: [198, 199], high: [201, 202], low: [197, 198], close: [199, 200], volume: [1000000, 1100000] }]
              }
            }
          ]
        }
      })
    }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchEquityMarketData("AAPL", "stock", { range: "10y" });

    const equityUrl = String((fetchMock.mock.calls as unknown as Array<[string]>)[0][0]);
    expect(equityUrl).toContain("range=10y");
    vi.unstubAllGlobals();
  });

  it("uses adjusted close for equity return calculations and scales OHLC when adjusted close is available", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        chart: {
          result: [
            {
              meta: { symbol: "AAPL", regularMarketPrice: 100, previousClose: 98, regularMarketTime: 1780876800 },
              timestamp: [1780790400, 1780876800],
              indicators: {
                quote: [{ open: [100, 102], high: [110, 112], low: [90, 92], close: [100, 104], volume: [1000000, 1100000] }],
                adjclose: [{ adjclose: [50, 52] }]
              }
            }
          ]
        }
      })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const dataset = await fetchEquityMarketData("AAPL", "stock");

    expect(dataset.prices[0]).toMatchObject({
      open: 50,
      high: 55,
      low: 45,
      close: 50,
      rawClose: 100,
      adjustedClose: 50,
      closeAdjustmentSource: "adjusted",
      ohlcAdjustmentSource: "derived-from-adjusted-close"
    });
    vi.unstubAllGlobals();
  });

  it("marks equity candles as unadjusted when adjusted close is unavailable", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        chart: {
          result: [
            {
              meta: { symbol: "AAPL", regularMarketPrice: 100, previousClose: 98, regularMarketTime: 1780876800 },
              timestamp: [1780790400, 1780876800],
              indicators: {
                quote: [{ open: [98, 99], high: [101, 102], low: [97, 98], close: [99, 100], volume: [1000000, 1100000] }]
              }
            }
          ]
        }
      })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const dataset = await fetchEquityMarketData("AAPL", "stock");

    expect(dataset.prices[0]).toMatchObject({
      close: 99,
      closeAdjustmentSource: "unadjusted",
      ohlcAdjustmentSource: "unadjusted"
    });
    vi.unstubAllGlobals();
  });

  it("paginates daily crypto candles instead of using a single 1000-candle request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => Array.from({ length: 1000 }, (_, index) => [
          1609459200000 + index * 86400000,
          "100",
          "110",
          "95",
          "105",
          "1000",
          1609545599999 + index * 86400000,
          "105000",
          100,
          "500",
          "52500",
          "0"
        ])
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          [
            1609459200000 + 1000 * 86400000,
            "100",
            "110",
            "95",
            "105",
            "1000",
            1609545599999 + 1000 * 86400000,
            "105000",
            100,
            "500",
            "52500",
            "0"
          ]
        ]
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          symbol: "BTCUSDT",
          lastPrice: "105",
          priceChangePercent: "1.5",
          volume: "1000",
          quoteVolume: "105000",
          closeTime: 1780876799999
        })
      });
    vi.stubGlobal("fetch", fetchMock);

    await fetchBinanceMarketData("BTCUSDT");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const cryptoUrl = String((fetchMock.mock.calls as unknown as Array<[string]>)[0][0]);
    expect(cryptoUrl).toContain("limit=1000");
    expect(cryptoUrl).toContain("interval=1d");
    const nextCryptoUrl = String((fetchMock.mock.calls as unknown as Array<[string]>)[1][0]);
    expect(nextCryptoUrl).toContain("startTime=");
    vi.unstubAllGlobals();
  });

  it("detects sparse max stock data and falls back to dense 10y data for engine ranges", async () => {
    const sparseMax = quarterlyTimestamps(168);
    const denseTenYear = dailyTimestamps(2514);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => yahooPayload("AAPL", sparseMax) })
      .mockResolvedValueOnce({ ok: true, json: async () => yahooPayload("AAPL", denseTenYear) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchMarketDataWithFallback({ symbol: "AAPL", assetType: "stock", chartRangeRequested: "max" });

    expect(result.chartCandles).toHaveLength(168);
    expect(result.engineCandles).toHaveLength(2514);
    expect(result.backtestCandles).toHaveLength(2514);
    expect(result.validationCandles).toHaveLength(2514);
    expect(result.chartDataRangeUsed).toBe("max");
    expect(result.engineRangeUsed).toBe("10y");
    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackReason).toContain("Chart range max was sparse");
    expect(result.density.chart.isSparse).toBe(true);
    expect(result.density.engine.isSparse).toBe(false);
    vi.unstubAllGlobals();
  });

  it("detects sparse max ETF data and falls back through preferred dense ranges", async () => {
    const sparseMax = quarterlyTimestamps(168);
    const sparseTenYear = dailyTimestamps(180);
    const denseFiveYear = dailyTimestamps(1260);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => yahooPayload("SPY", sparseMax) })
      .mockResolvedValueOnce({ ok: true, json: async () => yahooPayload("SPY", sparseTenYear) })
      .mockResolvedValueOnce({ ok: true, json: async () => yahooPayload("SPY", denseFiveYear) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchMarketDataWithFallback({ symbol: "SPY", assetType: "etf", chartRangeRequested: "max" });

    expect(result.chartCandles).toHaveLength(168);
    expect(result.engineRangeUsed).toBe("5y");
    expect(result.engineCandles).toHaveLength(1260);
    expect(result.fallbackUsed).toBe(true);
    expect(result.density.chart.isSparse).toBe(true);
    expect(result.density.engine.isSparse).toBe(false);
    vi.unstubAllGlobals();
  });
});
