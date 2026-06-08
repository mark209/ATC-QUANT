import type { AssetType } from "@/types/asset";
import type { PortfolioHolding, PortfolioRiskResult } from "@/types/quant";
import type { QuantConfig } from "./config";

export interface PortfolioRiskInput {
  candidateSymbol: string;
  candidateAssetType: AssetType;
  candidateAllocation: number;
  holdings?: PortfolioHolding[];
  estimatedPortfolioVolatility?: number;
}

function normalizedSymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/[-_/]/g, "");
}

function correlatedBucket(symbol: string, assetType: AssetType): string {
  const normalized = normalizedSymbol(symbol);
  if (assetType === "crypto") return "crypto-risk-on";
  if (["COIN", "MSTR", "MARA", "RIOT"].some((token) => normalized.includes(token))) return "crypto-risk-on";
  if (["QQQ", "XLK", "NVDA", "AMD", "MSFT", "AAPL"].some((token) => normalized.includes(token))) return "large-tech-growth";
  return `${assetType}:${normalized}`;
}

export function evaluatePortfolioRisk(input: PortfolioRiskInput, config: QuantConfig): PortfolioRiskResult {
  if (!input.holdings) {
    return {
      passed: true,
      totalExposure: input.candidateAllocation,
      assetClassExposure: { [input.candidateAssetType]: input.candidateAllocation },
      correlatedExposureWarnings: [],
      recommendedAdjustment: "Portfolio-level risk check unavailable because no portfolio holdings were provided.",
      warnings: ["Portfolio-level risk check unavailable because no portfolio holdings were provided."]
    };
  }

  const allHoldings: PortfolioHolding[] = [
    ...input.holdings,
    { symbol: input.candidateSymbol, assetType: input.candidateAssetType, allocation: input.candidateAllocation }
  ];
  const assetClassExposure = allHoldings.reduce<Record<string, number>>((acc, holding) => {
    acc[holding.assetType] = (acc[holding.assetType] ?? 0) + holding.allocation;
    return acc;
  }, {});
  const totalExposure = allHoldings.reduce((sum, holding) => sum + holding.allocation, 0);
  const candidateBucket = correlatedBucket(input.candidateSymbol, input.candidateAssetType);
  const correlatedExposure = allHoldings
    .filter((holding) => correlatedBucket(holding.symbol, holding.assetType) === candidateBucket)
    .reduce((sum, holding) => sum + holding.allocation, 0);
  const correlatedExposureWarnings: string[] = [];
  const warnings: string[] = [];

  if (correlatedExposure > config.correlationExposureCap) {
    correlatedExposureWarnings.push("Candidate increases an already concentrated correlated exposure bucket.");
  }
  if ((assetClassExposure.crypto ?? 0) > config.maxPortfolioCryptoExposure) warnings.push("Total crypto exposure exceeds the configured cap.");
  if ((assetClassExposure.stock ?? 0) > config.maxPortfolioEquityExposure) warnings.push("Total equity exposure exceeds the configured cap.");
  if (input.candidateAllocation > config.maxSingleAssetExposure) warnings.push("Candidate exceeds the single-asset exposure cap.");

  const maxPortfolioVolatilityWarning =
    input.estimatedPortfolioVolatility && input.estimatedPortfolioVolatility > config.maxTotalPortfolioVolatility
      ? "Estimated portfolio volatility exceeds the configured maximum."
      : undefined;

  return {
    passed: correlatedExposureWarnings.length === 0 && warnings.length === 0 && !maxPortfolioVolatilityWarning,
    totalExposure,
    assetClassExposure,
    correlatedExposureWarnings,
    maxPortfolioVolatilityWarning,
    recommendedAdjustment:
      correlatedExposureWarnings.length > 0 || warnings.length > 0 || maxPortfolioVolatilityWarning
        ? "Reduce candidate allocation or remove overlapping exposure before approval."
        : undefined,
    warnings
  };
}
