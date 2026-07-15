import type { AssetType, MarketDataPoint, RiskProfile } from "@/types/asset";
import type { InvestabilityResult, LayerResult, QuantAnalysis, RiskMetrics, StrategySignal } from "@/types/quant";
import { averageDollarVolume, boundedScore, DEFAULT_QUANT_CONFIG } from "./config";
import { calculateDrawdowns } from "./drawdown";
import { calculateExpectedValue } from "./expectedValue";
import { calculateMomentumScore, calculateTrendScore, overextensionPenalty } from "./trend";
import { calculatePositionSizing } from "./positionSizing";
import { calculateLogReturns, calculateSimpleReturns, annualizedReturn } from "./returns";
import { calmarRatio, conditionalValueAtRisk, sharpeRatio, sortinoRatio, valueAtRisk } from "./ratios";
import { periodsPerYear, volatilityRegime } from "./riskRegime";
import { annualizedVolatility, ewmaVolatility } from "./volatility";
import { runTrendBacktest } from "./backtest";
import type { TrendBacktestCache } from "./backtest";
import { validateDataQuality } from "./dataQuality";
import { evaluateHardFilters } from "./hardFilters";
import { calculateSignalLayer } from "./signalLayer";
import { calculateRiskLayer } from "./riskLayer";
import { validateTrendBacktest } from "./validation";
import { evaluatePortfolioRisk } from "./portfolioRisk";
import { buildFinalDecision } from "./decisionEngine";
import { buildDecisionExplanation } from "./explanation";

function confidence(score: number, points: number): "Low" | "Medium" | "High" {
  if (points < 120) return "Low";
  if (score >= 70) return "High";
  return "Medium";
}

function liquidityScore(points: MarketDataPoint[], assetType: AssetType): number {
  const latest = points.at(-1);
  const averageQuoteVolume =
    points.reduce((sum, point) => sum + (point.quoteVolume ?? point.volume * point.close), 0) / Math.max(1, points.length);
  if (!latest) return 0;
  const thresholds = assetType === "crypto" ? [10_000_000, 100_000_000, 500_000_000] : [5_000_000, 50_000_000, 200_000_000];
  if (averageQuoteVolume >= thresholds[2]) return 95;
  if (averageQuoteVolume >= thresholds[1]) return 80;
  if (averageQuoteVolume >= thresholds[0]) return 60;
  return 30;
}

function riskAdjustedScore(sharpe: number, sortino: number, calmar: number): number {
  return boundedScore(45 + sharpe * 12 + sortino * 8 + calmar * 6);
}

function volatilityScore(volatility: number, assetType: AssetType): number {
  const preferred = assetType === "crypto" ? 0.35 : 0.18;
  return boundedScore(100 - Math.max(0, volatility - preferred) * 120);
}

function drawdownScore(maxDrawdown: number): number {
  return boundedScore(100 - Math.abs(maxDrawdown) * 220);
}

function expectedValueScore(expectedValue: number): number {
  return boundedScore(50 + expectedValue * 1800);
}

function buildSignals(input: {
  assetType: AssetType;
  expectedValueScore: number;
  trendMomentumScore: number;
  riskAdjustedScore: number;
  volatilityScore: number;
  drawdownScore: number;
  liquidityScore: number;
  finalScore: number;
}): StrategySignal[] {
  const weights =
    input.assetType === "crypto"
      ? [
          ["Expected value", input.expectedValueScore, 0.2],
          ["Trend / momentum", input.trendMomentumScore, 0.2],
          ["Volatility regime", input.volatilityScore, 0.2],
          ["Liquidity", input.liquidityScore, 0.15],
          ["Drawdown risk", input.drawdownScore, 0.15],
          ["Market regime / BTC correlation", input.assetType === "crypto" ? 65 : 50, 0.1]
        ]
      : [
          ["Expected value", input.expectedValueScore, 0.25],
          ["Trend / momentum", input.trendMomentumScore, 0.2],
          ["Risk-adjusted return", input.riskAdjustedScore, 0.15],
          ["Volatility regime", input.volatilityScore, 0.15],
          ["Drawdown risk", input.drawdownScore, 0.1],
          ["Liquidity", input.liquidityScore, 0.1],
          ["Fundamental / valuation", 50, 0.05]
        ];

  return weights.map(([name, score, weight]) => {
    const numericScore = Number(score);
    return {
      name: String(name),
      score: boundedScore(numericScore),
      direction: numericScore >= 65 ? "positive" : numericScore >= 45 ? "neutral" : "negative",
      weight: Number(weight),
      contribution: boundedScore(numericScore) * Number(weight),
      explanation:
        numericScore >= 65
          ? "Supports the setup within the model ensemble."
          : numericScore >= 45
            ? "Neutral contribution; not enough evidence to increase conviction."
            : "Reduces conviction and can limit allocation."
    };
  });
}

function layerResult(input: {
  status: LayerResult["status"];
  reason: string;
  warnings: string[];
  rawMetrics: LayerResult["rawMetrics"];
  score?: number;
}): LayerResult {
  return {
    status: input.status,
    reason: input.reason,
    warnings: input.warnings,
    rawMetrics: input.rawMetrics,
    score: input.score,
    normalizedScore: input.score
  };
}

export function analyzeMarketData(points: MarketDataPoint[], assetType: AssetType, symbol: string, riskProfile: RiskProfile, backtestCache?: TrendBacktestCache): QuantAnalysis {
  const config = DEFAULT_QUANT_CONFIG;
  const prices = points.map((point) => point.close);
  const simpleReturns = calculateSimpleReturns(prices);
  const logReturns = calculateLogReturns(prices);
  const periods = periodsPerYear(assetType);
  const annualReturn = annualizedReturn(simpleReturns, periods);
  const volatility = annualizedVolatility(logReturns, periods);
  const ewma = ewmaVolatility(logReturns, 0.94, periods);
  const drawdown = calculateDrawdowns(points.map((point) => ({ date: point.date, value: point.close })));
  const ev = calculateExpectedValue(simpleReturns, config.feeRate, config.slippageRate, config.spreadRate);
  const sharpe = sharpeRatio(annualReturn, volatility);
  const sortino = sortinoRatio(simpleReturns, annualReturn);
  const calmar = calmarRatio(annualReturn, drawdown.maxDrawdown);
  const metrics: RiskMetrics = {
    annualizedReturn: annualReturn,
    annualizedVolatility: volatility,
    ewmaVolatility: ewma,
    sharpeRatio: sharpe,
    sortinoRatio: sortino,
    calmarRatio: calmar,
    valueAtRisk95: valueAtRisk(simpleReturns),
    conditionalValueAtRisk95: conditionalValueAtRisk(simpleReturns),
    expectedValue: ev.expectedValueAfterCosts,
    profitFactor: ev.profitFactor,
    maxDrawdown: drawdown.maxDrawdown,
    currentDrawdown: drawdown.currentDrawdown,
    recoveryTime: drawdown.recoveryTime
  };

  const dataQuality = validateDataQuality(points, assetType, config);
  const signalLayer = calculateSignalLayer({
    prices,
    realizedVolatility: Math.max(volatility, ewma),
    currentDrawdown: drawdown.currentDrawdown,
    assetType,
    config
  });
  const riskLayer = calculateRiskLayer({
    points,
    assetType,
    realizedVolatility: volatility,
    ewmaVolatility: ewma,
    currentDrawdown: drawdown.currentDrawdown,
    maxDrawdown: drawdown.maxDrawdown,
    sharpeRatio: sharpe,
    sortinoRatio: sortino,
    calmarRatio: calmar,
    config
  });
  const hardFilters = evaluateHardFilters(
    {
      dataQuality,
      assetType,
      averageDollarVolume: averageDollarVolume(points),
      realizedVolatility: Math.max(volatility, ewma),
      maxDrawdown: drawdown.maxDrawdown,
      expectedValueAfterCosts: ev.expectedValueAfterCosts,
      expectedValuePassed: ev.passed,
      regimeLabel: signalLayer.regimeLabel
    },
    config
  );
  const fullBacktest = runTrendBacktest(points, assetType, config.feeRate, config.slippageRate, 50, 200, backtestCache);
  const validation = validateTrendBacktest(points, assetType, config, fullBacktest, backtestCache);

  const trend = calculateTrendScore(prices, assetType);
  const momentum = calculateMomentumScore(prices, assetType);
  const trendMomentum = boundedScore((trend + momentum) / 2 - overextensionPenalty(prices));
  const evScore = expectedValueScore(ev.expectedValueAfterCosts);
  const riskScore = riskAdjustedScore(sharpe, sortino, calmar);
  const volScore = volatilityScore(Math.max(volatility, ewma), assetType);
  const ddScore = drawdownScore(drawdown.maxDrawdown);
  const liqScore = riskLayer.liquidityScore;

  const signals = buildSignals({
    assetType,
    expectedValueScore: evScore,
    trendMomentumScore: trendMomentum,
    riskAdjustedScore: riskScore,
    volatilityScore: volScore,
    drawdownScore: ddScore,
    liquidityScore: liqScore,
    finalScore: 0
  });
  const legacyWeightedScore = boundedScore(signals.reduce((sum, signal) => sum + signal.contribution, 0));
  const volRegime = volatilityRegime(Math.max(volatility, ewma), assetType);
  const positionSizing = calculatePositionSizing({
    assetType,
    symbol,
    realizedVolatility: Math.max(volatility, ewma),
    currentDrawdown: drawdown.currentDrawdown,
    winRate: ev.winRate,
    payoffRatio: ev.payoffRatio,
    expectedValueAfterCosts: ev.expectedValueAfterCosts,
    tradeCount: ev.tradeCount,
    sampleQuality: ev.sampleQuality,
    riskProfile
  });
  const portfolioRisk = evaluatePortfolioRisk(
    {
      candidateSymbol: symbol,
      candidateAssetType: assetType,
      candidateAllocation: positionSizing.finalAllocation
    },
    config
  );
  const finalDecision = buildFinalDecision({
    dataQualityPassed: dataQuality.passed,
    hardFiltersPassed: hardFilters.passed,
    hardFilterBlockingReason: hardFilters.blockingReason,
    regimeLabel: signalLayer.regimeLabel,
    expectedValuePassed: ev.passed,
    signalScore: signalLayer.combinedSignalScore,
    riskScore: riskLayer.combinedRiskScore,
    validationScore: validation.validationScore,
    liquidityScore: riskLayer.liquidityScore,
    finalPositionSize: positionSizing.finalAllocation,
    riskWarnings: riskLayer.warnings,
    validationWarnings: validation.warnings,
    portfolioWarnings: [...portfolioRisk.warnings, ...portfolioRisk.correlatedExposureWarnings],
    primaryReasons: [...signalLayer.reasons],
    blockingReasons: hardFilters.failedFilters
  });
  const explanation = buildDecisionExplanation({
    symbol,
    signal: signalLayer,
    risk: riskLayer,
    hardFilters,
    decision: finalDecision,
    sizing: positionSizing
  });

  const investability: InvestabilityResult = {
    score: finalDecision.finalScore,
    classification: finalDecision.decisionLabel,
    confidence: confidence(finalDecision.finalScore, points.length),
    riskMode: positionSizing.riskMode,
    explanation: explanation.why,
    invalidation:
      assetType === "crypto"
        ? "A break below the 200-day moving average, extreme volatility expansion, or crypto strategy drawdown below -25% shifts the model to no new position."
        : "A close below the 200-day moving average, negative expected value after costs, or strategy drawdown below -15% shifts the model to risk-off.",
    monitor: ["200-day moving average", "EWMA volatility", "current drawdown", "liquidity stability", "expected value after fees and slippage"],
    signals
  };

  return {
    assetType,
    riskProfile,
    riskMetrics: metrics,
    drawdown,
    positionSizing,
    investability,
    backtest: fullBacktest,
    pipeline: {
      dataQuality,
      hardFilters,
      signal: signalLayer,
      risk: riskLayer,
      expectedValue: ev,
      validation,
      positionSizing,
      portfolioRisk,
      finalDecision,
      explanation,
      layers: {
        dataQuality: layerResult({
          status: dataQuality.passed ? "pass" : "fail",
          reason: dataQuality.passed ? "Market data is usable for quant analysis." : "Market data failed required quality checks.",
          warnings: dataQuality.warnings,
          rawMetrics: { dataPoints: dataQuality.dataPoints, requiredDataPoints: dataQuality.requiredDataPoints },
          score: dataQuality.score
        }),
        hardFilters: layerResult({
          status: hardFilters.passed ? "pass" : "fail",
          reason: hardFilters.passed ? "No hard filters blocked the setup." : hardFilters.blockingReason ?? "One or more hard filters failed.",
          warnings: hardFilters.warnings,
          rawMetrics: { failedFilters: hardFilters.failedFilters.join(", ") }
        }),
        signal: layerResult({
          status: signalLayer.combinedSignalScore >= 65 ? "pass" : signalLayer.combinedSignalScore >= 45 ? "warn" : "fail",
          reason: `Regime: ${signalLayer.regimeLabel}.`,
          warnings: signalLayer.warnings,
          rawMetrics: {
            trendScore: signalLayer.trendScore,
            momentumScore: signalLayer.momentumScore,
            regimeScore: signalLayer.regimeScore
          },
          score: signalLayer.combinedSignalScore
        }),
        risk: layerResult({
          status: riskLayer.combinedRiskScore >= 65 ? "pass" : riskLayer.combinedRiskScore >= 45 ? "warn" : "fail",
          reason: `Volatility is ${riskLayer.volatilityLabel}; drawdown stress is ${riskLayer.drawdownLabel}.`,
          warnings: riskLayer.warnings,
          rawMetrics: {
            volatilityScore: riskLayer.volatilityScore,
            drawdownScore: riskLayer.drawdownScore,
            liquidityScore: riskLayer.liquidityScore
          },
          score: riskLayer.combinedRiskScore
        }),
        validation: layerResult({
          status: validation.validationScore >= 65 ? "pass" : validation.validationScore >= 45 ? "warn" : "fail",
          reason: `Validation robustness: ${validation.robustnessLabel}.`,
          warnings: validation.warnings,
          rawMetrics: {
            inSampleReturn: validation.inSample.totalReturn,
            outOfSampleReturn: validation.outOfSample.totalReturn,
            walkForwardWindows: validation.walkForward.windowsTested
          },
          score: validation.validationScore
        }),
        sizing: layerResult({
          status: positionSizing.finalAllocation > 0 ? "pass" : "fail",
          reason: `Final allocation is limited by ${positionSizing.limitingFactor}.`,
          warnings: positionSizing.warnings,
          rawMetrics: {
            volatilityTargetAllocation: positionSizing.volatilityTargetAllocation,
            fractionalKellyAllocation: positionSizing.fractionalKellyAllocation,
            assetClassMaxAllocation: positionSizing.assetClassMaxAllocation,
            drawdownAdjustedAllocation: positionSizing.drawdownAdjustedAllocation
          }
        }),
        portfolioRisk: layerResult({
          status: portfolioRisk.passed ? "pass" : "warn",
          reason: portfolioRisk.recommendedAdjustment ?? "Portfolio risk check did not identify a cap breach.",
          warnings: [...portfolioRisk.warnings, ...portfolioRisk.correlatedExposureWarnings],
          rawMetrics: { totalExposure: portfolioRisk.totalExposure }
        }),
        decision: layerResult({
          status: ["Strong candidate", "Position allowed"].includes(finalDecision.decisionLabel) ? "pass" : "warn",
          reason: finalDecision.decisionLabel,
          warnings: finalDecision.warnings,
          rawMetrics: { legacyWeightedScore },
          score: finalDecision.finalScore
        })
      }
    },
    assumptions: [
      "Historical simulation only; results are not a forecast or guarantee.",
      "Daily close-to-close data is used for the first version.",
      "Backtest applies a one-bar signal delay proxy through daily trend state changes.",
      "Fees and slippage are included through the central quant configuration.",
      "Live provider values are used when returned by the upstream source; no mock market values are substituted."
    ]
  };
}
