import type { AssetType, RiskProfile } from "@/types/asset";
import type { DecisionLabel } from "@/types/quant";
import { getLiveMarketAnalysis, type MarketAnalysisResponse } from "./marketDataAdapter";

export type ScanUniverse = "stocks" | "etfs" | "crypto" | "indexes" | "mixed";

export interface ScanCandidate {
  symbol: string;
  assetType: AssetType;
}

export interface MarketScanResult {
  symbol: string;
  name: string;
  assetType: AssetType;
  decisionLabel: DecisionLabel;
  finalScore: number;
  finalPositionSize: number;
  expectedValueAfterCosts: number;
  sampleQuality: string;
  validationLabel: string;
  limitingFactor: string;
  primaryReason: string;
  warning: string;
  passed: boolean;
  engineRangeUsed?: string;
  engineCandleCount?: number;
  fallbackUsed?: boolean;
  fallbackReason?: string;
  dataDensityStatus?: "Dense" | "Sparse" | "Unknown";
  error?: string;
}

export interface MarketScanResponse {
  universe: ScanUniverse;
  riskProfile: RiskProfile;
  scannedAt: string;
  scannedCount: number;
  candidates: MarketScanResult[];
  investableCandidates: MarketScanResult[];
  warnings: string[];
}

const stockUniverse: ScanCandidate[] = [
  { symbol: "AAPL", assetType: "stock" },
  { symbol: "MSFT", assetType: "stock" },
  { symbol: "NVDA", assetType: "stock" },
  { symbol: "AMZN", assetType: "stock" },
  { symbol: "META", assetType: "stock" },
  { symbol: "GOOGL", assetType: "stock" },
  { symbol: "AVGO", assetType: "stock" },
  { symbol: "LLY", assetType: "stock" },
  { symbol: "JPM", assetType: "stock" },
  { symbol: "XOM", assetType: "stock" }
];

const etfUniverse: ScanCandidate[] = [
  { symbol: "SPY", assetType: "etf" },
  { symbol: "QQQ", assetType: "etf" },
  { symbol: "IWM", assetType: "etf" },
  { symbol: "DIA", assetType: "etf" },
  { symbol: "VTI", assetType: "etf" },
  { symbol: "VOO", assetType: "etf" },
  { symbol: "XLK", assetType: "etf" },
  { symbol: "XLF", assetType: "etf" },
  { symbol: "XLE", assetType: "etf" },
  { symbol: "TLT", assetType: "etf" }
];

const cryptoUniverse: ScanCandidate[] = [
  { symbol: "BTCUSDT", assetType: "crypto" },
  { symbol: "ETHUSDT", assetType: "crypto" },
  { symbol: "BNBUSDT", assetType: "crypto" },
  { symbol: "SOLUSDT", assetType: "crypto" },
  { symbol: "XRPUSDT", assetType: "crypto" },
  { symbol: "ADAUSDT", assetType: "crypto" }
];

const indexUniverse: ScanCandidate[] = [
  { symbol: "^GSPC", assetType: "index" },
  { symbol: "^IXIC", assetType: "index" },
  { symbol: "^DJI", assetType: "index" },
  { symbol: "^RUT", assetType: "index" }
];

export const SCAN_UNIVERSES: Record<ScanUniverse, ScanCandidate[]> = {
  stocks: stockUniverse,
  etfs: etfUniverse,
  crypto: cryptoUniverse,
  indexes: indexUniverse,
  mixed: [...etfUniverse.slice(0, 5), ...stockUniverse.slice(0, 5), ...cryptoUniverse.slice(0, 3)]
};

const investableLabels = new Set<DecisionLabel>(["Strong candidate", "Position allowed", "Small allocation only"]);

export function summarizeScanAnalysis(response: MarketAnalysisResponse): MarketScanResult {
  const { dataset, analysis } = response;
  const finalDecision = analysis.pipeline.finalDecision;
  const expectedValue = analysis.pipeline.expectedValue;
  const validation = analysis.pipeline.validation;
  const sizing = analysis.pipeline.positionSizing;
  const dataRanges = dataset.dataRanges ?? analysis.dataRanges;
  const passed =
    investableLabels.has(finalDecision.decisionLabel) &&
    finalDecision.finalPositionSize > 0 &&
    expectedValue.expectedValueAfterCosts > 0;

  return {
    symbol: dataset.overview.symbol,
    name: dataset.overview.name,
    assetType: dataset.overview.assetType,
    decisionLabel: finalDecision.decisionLabel,
    finalScore: finalDecision.finalScore,
    finalPositionSize: finalDecision.finalPositionSize,
    expectedValueAfterCosts: expectedValue.expectedValueAfterCosts,
    sampleQuality: expectedValue.sampleQuality,
    validationLabel: validation.robustnessLabel,
    limitingFactor: sizing.limitingFactor,
    primaryReason: finalDecision.primaryReasons[0] ?? analysis.pipeline.explanation.why,
    warning: finalDecision.warnings[0] ?? validation.warnings[0] ?? expectedValue.warnings[0] ?? "",
    passed,
    engineRangeUsed: dataRanges?.engineRangeUsed,
    engineCandleCount: dataRanges?.engineCandles.length || dataRanges?.density.engine.actualCandleCount,
    fallbackUsed: dataRanges?.fallbackUsed,
    fallbackReason: dataRanges?.fallbackReason,
    dataDensityStatus: dataRanges ? (dataRanges.density.engine.isSparse ? "Sparse" : "Dense") : "Unknown"
  };
}

export function rankScanResults(results: MarketScanResult[]): MarketScanResult[] {
  return [...results].sort((left, right) => {
    if (left.passed !== right.passed) return left.passed ? -1 : 1;
    if (right.finalScore !== left.finalScore) return right.finalScore - left.finalScore;
    return right.finalPositionSize - left.finalPositionSize;
  });
}

export function candidatesForUniverse(universe: ScanUniverse, limit: number): ScanCandidate[] {
  return SCAN_UNIVERSES[universe].slice(0, Math.max(1, Math.min(limit, SCAN_UNIVERSES[universe].length)));
}

export async function scanMarketUniverse(input: {
  universe: ScanUniverse;
  riskProfile: RiskProfile;
  limit: number;
}): Promise<MarketScanResponse> {
  const candidates = candidatesForUniverse(input.universe, input.limit);
  const settled = await Promise.allSettled(
    candidates.map(async (candidate) =>
      summarizeScanAnalysis(
        await getLiveMarketAnalysis({
          symbol: candidate.symbol,
          assetType: candidate.assetType,
          riskProfile: input.riskProfile
        })
      )
    )
  );

  const results = settled.map((result, index): MarketScanResult => {
    if (result.status === "fulfilled") return result.value;
    const candidate = candidates[index];
    return {
      symbol: candidate.symbol,
      name: candidate.symbol,
      assetType: candidate.assetType,
      decisionLabel: "No Data / Avoid",
      finalScore: 0,
      finalPositionSize: 0,
      expectedValueAfterCosts: 0,
      sampleQuality: "Poor",
      validationLabel: "Insufficient Data",
      limitingFactor: "Data quality",
      primaryReason: "Live provider did not return usable data.",
      warning: result.reason instanceof Error ? result.reason.message : "Live provider request failed.",
      passed: false,
      error: result.reason instanceof Error ? result.reason.message : "Live provider request failed."
    };
  });

  const ranked = rankScanResults(results);
  return {
    universe: input.universe,
    riskProfile: input.riskProfile,
    scannedAt: new Date().toISOString(),
    scannedCount: ranked.length,
    candidates: ranked,
    investableCandidates: ranked.filter((candidate) => candidate.passed),
    warnings: [
      "Scanner output is a research filter, not financial advice.",
      "The system does not guarantee returns and should not be treated as certainty."
    ]
  };
}
