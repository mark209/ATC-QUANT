import type { AssetType, MarketDataPoint } from "@/types/asset";
import type { EntryZoneAblationCase, EntryZoneAblationResult } from "@/types/quant";
import { runTrendBacktest } from "./backtest";
import type { QuantConfig } from "./config";

function buildCase(label: EntryZoneAblationCase["label"], points: MarketDataPoint[], assetType: AssetType, config: QuantConfig): EntryZoneAblationCase {
  if (label !== "Current system only") {
    return {
      label,
      status: "Scaffold only / not active",
      summary: null,
      missedTradeRate: 0,
      averageEntrySlippage: 0,
      feeSensitivity: 0,
      longOnlyPerformance: 0,
      shortOnlyPerformance: 0,
      bullRegimePerformance: 0,
      bearRegimePerformance: 0,
      sidewaysRegimePerformance: 0
    };
  }

  const summary = runTrendBacktest(points, assetType, config.feeRate, config.slippageRate);
  return {
    label,
    status: "Active",
    summary,
    missedTradeRate: 0,
    averageEntrySlippage: summary.slippageCostEstimate / Math.max(1, summary.totalTrades),
    feeSensitivity: summary.feesPaid,
    longOnlyPerformance: summary.totalReturn,
    shortOnlyPerformance: 0,
    bullRegimePerformance: summary.totalReturn,
    bearRegimePerformance: 0,
    sidewaysRegimePerformance: 0
  };
}

export function runEntryZoneAblation(points: MarketDataPoint[], assetType: AssetType, config: QuantConfig): EntryZoneAblationResult {
  const labels: EntryZoneAblationCase["label"][] = [
    "Current system only",
    "Current system + session VWAP entry filter",
    "Current system + rolling VWAP entry filter",
    "Current system + anchored VWAP entry filter",
    "Current system + full Optimal Entry Zone Engine"
  ];

  return {
    cases: labels.map((label) => buildCase(label, points, assetType, config)),
    warnings: [
      "VWAP ablation filters are scaffold-only and are not active in backtest results.",
      "Short-only performance is zero in this version because short eligibility is disabled until the main strategy supports true short trades."
    ]
  };
}
