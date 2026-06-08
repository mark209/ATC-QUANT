import type { MarketDataset } from "@/types/asset";
import type { QuantAnalysis } from "@/types/quant";

export function generateInvestorReport(dataset: MarketDataset, analysis: QuantAnalysis): string {
  return [
    `ATC QuantEdge Report: ${dataset.overview.symbol}`,
    `Decision: ${analysis.pipeline.finalDecision.decisionLabel}`,
    `Final Score: ${analysis.pipeline.finalDecision.finalScore}/100`,
    `Signal Score: ${analysis.pipeline.finalDecision.signalScore}/100`,
    `Risk Score: ${analysis.pipeline.finalDecision.riskScore}/100`,
    `Validation Score: ${analysis.pipeline.finalDecision.validationScore}/100`,
    `Suggested Allocation: ${(analysis.pipeline.finalDecision.finalPositionSize * 100).toFixed(2)}%`,
    `Limiting Factor: ${analysis.positionSizing.limitingFactor}`,
    "",
    analysis.pipeline.explanation.why,
    "",
    "Disclaimer: This is a research and risk-analysis tool, not financial advice. The system does not guarantee returns."
  ].join("\n");
}
