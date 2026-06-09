import type { AssetType, RiskProfile } from "./asset";

export type SampleQuality = "Poor" | "Limited" | "Acceptable" | "Strong";
export type RegimeLabel = "Trend Up" | "Trend Down" | "Range / Chop" | "High Volatility" | "Risk-Off" | "No Data / Avoid";
export type DrawdownStressLabel = "Normal" | "Elevated" | "Severe" | "Risk-Off";
export type DecisionLabel =
  | "Strong candidate"
  | "Position allowed"
  | "Small allocation only"
  | "Watchlist only"
  | "Avoid for now"
  | "Risk-off / no trade"
  | "No Data / Avoid";
export type MainStrategyDirection = "LONG_ELIGIBLE" | "SHORT_ELIGIBLE" | "NOT_TRADABLE";
export type EntryActionability = "WATCHLIST" | "ACTIONABLE" | "NO_TRADE";
export type EntrySide = "LONG" | "SHORT" | "NONE";

export interface DrawdownPoint {
  date: string;
  drawdown: number;
}

export interface DrawdownStats {
  currentDrawdown: number;
  maxDrawdown: number;
  averageDrawdown: number;
  maxDuration: number;
  recoveryTime: number | null;
  series: DrawdownPoint[];
}

export interface ExpectedValueResult {
  expectedValue: number;
  expectedValueAfterCosts: number;
  winRate: number;
  lossRate: number;
  averageWin: number;
  averageLoss: number;
  payoffRatio: number;
  profitFactor: number;
  tradeCount: number;
  sampleQuality: SampleQuality;
  passed: boolean;
  warnings: string[];
  costs: {
    fees: number;
    slippage: number;
    spread: number;
    averageTradeCost: number;
  };
}

export type ExpectedValueStats = ExpectedValueResult;

export interface RiskMetrics {
  annualizedReturn: number;
  annualizedVolatility: number;
  ewmaVolatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  valueAtRisk95: number;
  conditionalValueAtRisk95: number;
  expectedValue: number;
  profitFactor: number;
  maxDrawdown: number;
  currentDrawdown: number;
  recoveryTime: number | null;
  ratioWarnings: string[];
}

export interface PositionSizingResult {
  volatilityTargetAllocation: number;
  fractionalKellyAllocation: number;
  assetClassMaxAllocation: number;
  drawdownAdjustedAllocation: number;
  finalAllocation: number;
  finalPositionSize: number;
  limitingConstraint: string;
  limitingFactor: string;
  riskMode: string;
  exposureAdjustment: number;
  warnings: string[];
}

export interface StrategySignal {
  name: string;
  score: number;
  direction: "positive" | "neutral" | "negative";
  weight: number;
  contribution: number;
  explanation: string;
}

export interface InvestabilityResult {
  score: number;
  classification: string;
  confidence: "Low" | "Medium" | "High";
  riskMode: string;
  explanation: string;
  invalidation: string;
  monitor: string[];
  signals: StrategySignal[];
}

export interface BacktestTrade {
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  positionSize: number;
  quantity: number;
  allocationUsed: number;
  capitalDeployed: number;
  cashReserve: number;
  positionValue: number;
  grossReturnPct: number;
  netReturnPct: number;
  feesPaid: number;
  slippagePaid: number;
  fees: number;
  slippage: number;
  grossPnl: number;
  netPnl: number;
  returnPct: number;
  holdingPeriod: number;
  exitReason: string;
}

export interface BacktestSummary {
  assumptionLabel: string;
  allocation: number;
  totalReturn: number;
  annualizedReturn: number;
  cagr: number;
  annualizedVolatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  averageDrawdown: number;
  recoveryTime: number | null;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  payoffRatio: number;
  profitFactor: number;
  expectedValue: number;
  expectancy: number;
  numberOfTrades: number;
  totalTrades: number;
  averageHoldingPeriod: number;
  worstLosingStreak: number;
  longestLosingStreak: number;
  largestSingleLoss: number;
  bestTrade: number;
  worstTrade: number;
  fees: number;
  slippage: number;
  feesPaid: number;
  slippageCostEstimate: number;
  turnover: number;
  exposureTime: number;
  exposureAdjustedReturn: number;
  ratioWarnings: string[];
  trades: BacktestTrade[];
  equityCurve: Array<{ date: string; equity: number }>;
  drawdownCurve: DrawdownPoint[];
}

export interface EntryZoneRange {
  lower: number;
  upper: number;
}

export interface EntryTarget {
  label: string;
  price: number;
  rMultiple: number;
}

export interface OptimalEntryZoneVWAPData {
  sessionVWAP: number | null;
  rollingVWAP7D: number | null;
  rollingVWAP30D: number | null;
  rollingVWAP90D: number | null;
  anchoredVWAP: number | null;
  vwapStdDev: number | null;
  vwapZScore: number | null;
  upperBand1: number | null;
  lowerBand1: number | null;
  upperBand2: number | null;
  lowerBand2: number | null;
}

export interface OptimalEntryZoneRiskData {
  atr: number | null;
  stopDistancePercent: number | null;
  estimatedRewardRisk: number | null;
}

export interface OptimalEntryZoneResult {
  symbol: string;
  timeframe: string;
  regimeDirection: MainStrategyDirection;
  actionability: EntryActionability;
  entrySide: EntrySide;
  entryQualityScore: number;
  entryZone: EntryZoneRange | null;
  currentPrice: number | null;
  distanceFromEntryZonePercent: number | null;
  invalidationPrice: number | null;
  suggestedStop: number | null;
  targets: EntryTarget[];
  vwapData: OptimalEntryZoneVWAPData;
  riskData: OptimalEntryZoneRiskData;
  explanation: string[];
  warnings: string[];
  reasonNoTrade?: string;
}

export interface EntryZoneAblationCase {
  label:
    | "Current system only"
    | "Current system + session VWAP entry filter"
    | "Current system + rolling VWAP entry filter"
    | "Current system + anchored VWAP entry filter"
    | "Current system + full Optimal Entry Zone Engine";
  status: "Active" | "Scaffold only / not active";
  summary: BacktestSummary | null;
  missedTradeRate: number;
  averageEntrySlippage: number;
  feeSensitivity: number;
  longOnlyPerformance: number;
  shortOnlyPerformance: number;
  bullRegimePerformance: number;
  bearRegimePerformance: number;
  sidewaysRegimePerformance: number;
}

export interface EntryZoneAblationResult {
  cases: EntryZoneAblationCase[];
  warnings: string[];
}

export interface LayerResult {
  status: "pass" | "fail" | "warn" | "neutral";
  reason: string;
  warnings: string[];
  rawMetrics: Record<string, number | string | boolean | null>;
  score?: number;
  normalizedScore?: number;
}

export interface DataQualityResult {
  passed: boolean;
  score: number;
  issues: string[];
  warnings: string[];
  dataPoints: number;
  requiredDataPoints: number;
  totalCandles: number;
  usableCandlesAfterWarmup: number;
  estimatedTrades: number;
  outOfSampleTrades: number;
  walkForwardTradesPerWindow: number[];
  dataStartDate?: string;
  dataEndDate?: string;
}

export interface HardFilterResult {
  passed: boolean;
  failedFilters: string[];
  warnings: string[];
  blockingReason?: string;
}

export interface SignalResult {
  trendScore: number;
  momentumScore: number;
  regimeScore: number;
  combinedSignalScore: number;
  regimeLabel: RegimeLabel;
  reasons: string[];
  warnings: string[];
}

export interface RiskResult {
  volatilityScore: number;
  drawdownScore: number;
  liquidityScore: number;
  riskAdjustedScore: number;
  combinedRiskScore: number;
  volatilityLabel: string;
  drawdownLabel: DrawdownStressLabel;
  liquidityLabel: string;
  warnings: string[];
}

export interface WalkForwardResult {
  windowsTested: number;
  stableWindows: number;
  tradesPerWindow: number[];
  averageOutOfSampleReturn: number;
  averageOutOfSampleDrawdown: number;
  stabilityLabel: "Stable" | "Mixed" | "Unstable" | "Insufficient Data" | "Insufficient trades per window";
  warnings: string[];
}

export interface ParameterSensitivityResult {
  testedParameters: Array<{
    fastWindow: number;
    slowWindow: number;
  }>;
  results: BacktestSummary[];
  metrics: Array<{
    fastWindow: number;
    slowWindow: number;
    totalReturn: number;
    annualizedReturn: number;
    maxDrawdown: number;
    sharpeRatio: number;
    tradeCount: number;
    robustnessScore: number;
  }>;
  rangeLabel: string;
  robustnessLabel: "Robust" | "Moderately Sensitive" | "Highly Sensitive / Overfit Risk" | "Insufficient Data";
  sensitivityLabel: "Robust" | "Moderately Sensitive" | "Highly Sensitive / Overfit Risk" | "Insufficient Data";
  warnings: string[];
}

export interface BacktestValidationResult {
  inSample: BacktestSummary;
  outOfSample: BacktestSummary;
  outOfSampleLabel: "Reliable" | "Inconclusive" | "Insufficient Data";
  walkForward: WalkForwardResult;
  parameterSensitivity: ParameterSensitivityResult;
  range: {
    validationRange: string;
    minimumOutOfSampleTrades: number;
  };
  robustnessLabel: "Robust" | "Moderate" | "Unstable" | "Insufficient Data";
  validationScore: number;
  warnings: string[];
}

export interface PortfolioHolding {
  symbol: string;
  assetType: AssetType;
  allocation: number;
}

export interface PortfolioRiskResult {
  passed: boolean;
  totalExposure: number;
  assetClassExposure: Record<string, number>;
  correlatedExposureWarnings: string[];
  maxPortfolioVolatilityWarning?: string;
  recommendedAdjustment?: string;
  warnings: string[];
}

export interface FinalDecisionResult {
  decisionLabel: DecisionLabel;
  rawModelScore: number;
  finalScore: number;
  scoreAdjustmentReason: string;
  signalScore: number;
  riskScore: number;
  validationScore: number;
  finalPositionSize: number;
  primaryReasons: string[];
  blockingReasons: string[];
  warnings: string[];
}

export interface QuantDecisionPipeline {
  dataQuality: DataQualityResult;
  hardFilters: HardFilterResult;
  signal: SignalResult;
  risk: RiskResult;
  expectedValue: ExpectedValueStats;
  validation: BacktestValidationResult;
  positionSizing: PositionSizingResult;
  portfolioRisk: PortfolioRiskResult;
  finalDecision: FinalDecisionResult;
  explanation: {
    why: string;
    improvements: string[];
    blockers: string[];
  };
  layers: {
    dataQuality: LayerResult;
    hardFilters: LayerResult;
    signal: LayerResult;
    risk: LayerResult;
    validation: LayerResult;
    sizing: LayerResult;
    portfolioRisk: LayerResult;
    decision: LayerResult;
  };
}

export interface QuantAnalysis {
  assetType: AssetType;
  riskProfile: RiskProfile;
  rangeUsage: {
    chart: string;
    currentSignal: string;
    backtest: string;
    validation: string;
  };
  riskMetrics: RiskMetrics;
  drawdown: DrawdownStats;
  positionSizing: PositionSizingResult;
  investability: InvestabilityResult;
  backtest: BacktestSummary;
  allocationAdjustedBacktest: BacktestSummary;
  pipeline: QuantDecisionPipeline;
  optimalEntryZone: OptimalEntryZoneResult;
  entryZoneAblation: EntryZoneAblationResult;
  assumptions: string[];
}
