import type { AssetType } from "@/types/asset";
import type { DataQualityResult, HardFilterResult, RegimeLabel } from "@/types/quant";
import type { QuantConfig } from "./config";

export interface HardFilterInput {
  dataQuality: DataQualityResult;
  assetType: AssetType;
  averageDollarVolume: number;
  realizedVolatility: number;
  maxDrawdown: number;
  expectedValueAfterCosts: number;
  expectedValuePassed: boolean;
  regimeLabel: RegimeLabel;
}

export function evaluateHardFilters(input: HardFilterInput, config: QuantConfig): HardFilterResult {
  const failedFilters: string[] = [];
  const warnings: string[] = [...input.dataQuality.warnings];

  if (!input.dataQuality.passed) failedFilters.push("Data quality");
  if (input.averageDollarVolume < config.liquidityMinimums[input.assetType]) failedFilters.push("Minimum liquidity");
  if (input.realizedVolatility > config.maxRealizedVolatility[input.assetType]) failedFilters.push("Maximum realized volatility");
  if (input.maxDrawdown < config.maxDrawdown[input.assetType]) failedFilters.push("Maximum drawdown");
  if (!input.expectedValuePassed || input.expectedValueAfterCosts <= 0) failedFilters.push("Expected value after costs");
  if (input.regimeLabel === "Risk-Off") failedFilters.push("Risk-off regime");
  if (input.regimeLabel === "No Data / Avoid") failedFilters.push("No usable regime data");

  if (input.assetType === "crypto") {
    if (input.averageDollarVolume < config.liquidityMinimums.crypto * 2) warnings.push("Crypto liquidity is below the stricter preferred threshold.");
    if (input.realizedVolatility > config.maxRealizedVolatility.crypto * 0.8) warnings.push("Crypto volatility is near the hard limit.");
  }

  const blockingReason = failedFilters.length > 0 ? failedFilters[0] : undefined;

  return {
    passed: failedFilters.length === 0,
    failedFilters,
    warnings,
    blockingReason
  };
}
