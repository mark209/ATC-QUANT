import type { AssetType, MarketDataset, RiskProfile } from "@/types/asset";
import type { QuantAnalysis } from "@/types/quant";
import { analyzeMarketData } from "@/lib/quant/scoring";
import { fetchBinanceMarketData } from "./binanceAdapter";
import { fetchEquityMarketData } from "./equityAdapter";

export interface MarketAnalysisResponse {
  dataset: MarketDataset;
  analysis: QuantAnalysis;
}

export async function getLiveMarketAnalysis(input: {
  symbol: string;
  assetType: AssetType;
  riskProfile: RiskProfile;
}): Promise<MarketAnalysisResponse> {
  const dataset =
    input.assetType === "crypto"
      ? await fetchBinanceMarketData(input.symbol)
      : await fetchEquityMarketData(input.symbol, input.assetType);

  if (dataset.prices.length < 60) {
    throw new Error("Live provider returned fewer than 60 observations; quant analysis needs more history.");
  }

  return {
    dataset,
    analysis: analyzeMarketData(dataset.prices, dataset.overview.assetType, dataset.overview.symbol, input.riskProfile)
  };
}
