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

export interface ExpectedValueStats {
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

export interface BacktestSummary {
  totalReturn: number;
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
  equityCurve: Array<{ date: string; equity: number }>;
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
  averageOutOfSampleReturn: number;
  averageOutOfSampleDrawdown: number;
  stabilityLabel: "Stable" | "Mixed" | "Unstable" | "Insufficient sample";
  warnings: string[];
}

export interface ParameterSensitivityResult {
  testedParameters: Array<{
    fastWindow: number;
    slowWindow: number;
    totalReturn: number;
    maxDrawdown: number;
    sharpeRatio: number;
  }>;
  sensitivityLabel: "Robust" | "Moderately sensitive" | "Highly sensitive / overfit risk" | "Insufficient sample";
  warnings: string[];
}

export interface BacktestValidationResult {
  inSample: BacktestSummary;
  outOfSample: BacktestSummary;
  walkForward: WalkForwardResult;
  parameterSensitivity: ParameterSensitivityResult;
  robustnessLabel: string;
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
  finalScore: number;
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
  riskMetrics: RiskMetrics;
  drawdown: DrawdownStats;
  positionSizing: PositionSizingResult;
  investability: InvestabilityResult;
  backtest: BacktestSummary;
  pipeline: QuantDecisionPipeline;
  assumptions: string[];
}
