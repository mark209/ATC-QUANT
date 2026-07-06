import { NextResponse } from "next/server";
import type { AssetType } from "@/types/asset";
import { getLiveMarketAnalysis } from "@/lib/data/marketDataAdapter";
import {
  calculateBenchmarks,
  type BenchmarkResult,
  runHistoricalDecisionReplay,
  runMonteCarloStressTest,
  simulatePaperPortfolio
} from "@/lib/quant/historicalReplay";

const assetTypes = new Set<AssetType>(["crypto", "stock", "etf", "index"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.trim() || "SPY";
  const assetType = (searchParams.get("assetType") || "etf") as AssetType;
  const startingCapital = Number(searchParams.get("startingCapital") || 100000);
  const rebalanceEveryDays = Number(searchParams.get("rebalanceEveryDays") || 21);
  const simulations = Number(searchParams.get("simulations") || 1000);

  if (!assetTypes.has(assetType)) {
    return NextResponse.json({ error: "Unsupported asset type." }, { status: 400 });
  }

  try {
    const response = await getLiveMarketAnalysis({ symbol, assetType, riskProfile: "balanced" });
    const candles = response.analysis.dataRanges?.backtestCandles ?? response.dataset.prices;
    const replayRows = runHistoricalDecisionReplay({
      symbol: response.dataset.overview.symbol,
      assetType: response.dataset.overview.assetType,
      candles,
      rebalanceEveryDays: Number.isFinite(rebalanceEveryDays) ? rebalanceEveryDays : 21
    });
    const portfolio = simulatePaperPortfolio({
      symbol: response.dataset.overview.symbol,
      assetType: response.dataset.overview.assetType,
      candles,
      replayRows,
      startingCapital: Number.isFinite(startingCapital) ? startingCapital : 100000
    });
    const benchmarks = calculateBenchmarks(
      [{ symbol: response.dataset.overview.symbol, assetType: response.dataset.overview.assetType, candles }],
      Number.isFinite(startingCapital) ? startingCapital : 100000
    );
    const referenceSymbol = response.dataset.overview.assetType === "crypto" ? "BTCUSDT" : "SPY";
    let referenceBenchmark: BenchmarkResult | null = benchmarks.buyAndHold[0] ?? null;
    if (response.dataset.overview.symbol !== referenceSymbol) {
      try {
        const reference = await getLiveMarketAnalysis({
          symbol: referenceSymbol,
          assetType: response.dataset.overview.assetType === "crypto" ? "crypto" : "etf",
          riskProfile: "balanced"
        });
        referenceBenchmark =
          calculateBenchmarks(
            [
              {
                symbol: reference.dataset.overview.symbol,
                assetType: reference.dataset.overview.assetType,
                candles: reference.analysis.dataRanges?.backtestCandles ?? reference.dataset.prices
              }
            ],
            Number.isFinite(startingCapital) ? startingCapital : 100000
          ).buyAndHold[0] ?? null;
      } catch {
        referenceBenchmark = null;
      }
    }
    const monteCarlo = runMonteCarloStressTest(
      portfolio.trades.filter((trade) => trade.side === "SELL").map((trade) => trade.returnPct),
      {
        startingCapital: Number.isFinite(startingCapital) ? startingCapital : 100000,
        simulations: Number.isFinite(simulations) ? simulations : 1000
      }
    );

    return NextResponse.json(
      {
        symbol: response.dataset.overview.symbol,
        assetType: response.dataset.overview.assetType,
        candles: candles.length,
        replayRows: replayRows.length,
        portfolio,
        benchmarks,
        referenceBenchmark,
        monteCarlo
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Historical replay failed." },
      { status: 502 }
    );
  }
}
