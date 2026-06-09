import type { MarketDataPoint } from "@/types/asset";
import type { EntryActionability, EntrySide, EntryTarget, MainStrategyDirection, OptimalEntryZoneResult } from "@/types/quant";
import { calculateATR } from "./atr";
import { boundedScore, DEFAULT_QUANT_CONFIG, type OptimalEntryZoneConfig } from "./config";
import { findMostRecentConfirmedSwingHigh, findMostRecentConfirmedSwingLow, type ConfirmedPivot } from "./pivots";
import { calculateRollingVWAP, calculateSessionVWAP, calculateVWAP, calculateVWAPBands } from "./vwap";

interface AnalyzeOptimalEntryZoneInput {
  symbol: string;
  timeframe: string;
  candles: MarketDataPoint[];
  mainStrategyDirection: MainStrategyDirection;
  requestedSide?: "LONG" | "SHORT";
  liquidityPassed: boolean;
  volatilityPassed: boolean;
  expectedValuePassed: boolean;
  config?: OptimalEntryZoneConfig;
}

interface ZoneContext {
  side: Exclude<EntrySide, "NONE">;
  currentPrice: number;
  atr: number;
  cluster: number[];
  anchoredVWAP: number | null;
  pivot: ConfirmedPivot | null;
  upperBand1: number | null;
  lowerBand1: number | null;
  upperBand2: number | null;
  lowerBand2: number | null;
  vwapZScore: number | null;
  config: OptimalEntryZoneConfig;
}

function emptyVWAPData() {
  return {
    sessionVWAP: null,
    rollingVWAP7D: null,
    rollingVWAP30D: null,
    rollingVWAP90D: null,
    anchoredVWAP: null,
    vwapStdDev: null,
    vwapZScore: null,
    upperBand1: null,
    lowerBand1: null,
    upperBand2: null,
    lowerBand2: null
  };
}

function distanceFromZonePercent(price: number, zone: { lower: number; upper: number }): number {
  if (price >= zone.lower && price <= zone.upper) return 0;
  const reference = price < zone.lower ? zone.lower : zone.upper;
  return reference === 0 ? 0 : ((price - reference) / reference) * 100;
}

function conservativeLongInvalidation(pivot: ConfirmedPivot | null, anchoredVWAP: number | null, atr: number): number | null {
  const candidates = [pivot?.price, anchoredVWAP === null ? null : anchoredVWAP - atr].filter((value): value is number => typeof value === "number");
  if (candidates.length === 0) return null;
  return Math.min(...candidates);
}

function conservativeShortInvalidation(pivot: ConfirmedPivot | null, anchoredVWAP: number | null, atr: number): number | null {
  const candidates = [pivot?.price, anchoredVWAP === null ? null : anchoredVWAP + atr].filter((value): value is number => typeof value === "number");
  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

function buildTargets(input: {
  side: Exclude<EntrySide, "NONE">;
  entryReference: number;
  stop: number;
  upperBand1: number | null;
  lowerBand1: number | null;
}): EntryTarget[] {
  const risk = Math.abs(input.entryReference - input.stop);
  if (risk === 0) return [];
  const target1 = input.side === "LONG" ? input.entryReference + risk : input.entryReference - risk;
  const target2 = input.side === "LONG" ? input.entryReference + risk * 2 : input.entryReference - risk * 2;
  const bandTarget = input.side === "LONG" ? input.upperBand1 : input.lowerBand1;
  const targets: EntryTarget[] = [
    { label: "Target 1", price: target1, rMultiple: 1 },
    { label: "Target 2", price: target2, rMultiple: 2 }
  ];
  if (bandTarget !== null) {
    const rMultiple = input.side === "LONG" ? (bandTarget - input.entryReference) / risk : (input.entryReference - bandTarget) / risk;
    if (rMultiple > 0) targets.push({ label: "Target 3", price: bandTarget, rMultiple });
  }
  return targets;
}

function confluenceScore(cluster: number[], atr: number): number {
  if (cluster.length < 2 || atr <= 0) return 8;
  const spread = Math.max(...cluster) - Math.min(...cluster);
  return boundedScore(20 - (spread / atr) * 10);
}

function priceLocationScore(price: number, zone: { lower: number; upper: number }, atr: number): number {
  const distance = Math.abs(distanceFromZonePercent(price, zone)) / 100;
  const atrDistance = atr <= 0 ? 2 : Math.abs(price < zone.lower ? zone.lower - price : price > zone.upper ? price - zone.upper : 0) / atr;
  if (price >= zone.lower && price <= zone.upper) return 20;
  if (atrDistance <= 0.5) return 15;
  if (atrDistance <= 1) return 8;
  return distance > 0 ? 2 : 0;
}

function stopQualityScore(price: number, stop: number, atr: number): number {
  const distance = Math.abs(price - stop);
  if (atr <= 0 || distance <= 0) return 0;
  const atrMultiple = distance / atr;
  if (atrMultiple <= 1.5) return 15;
  if (atrMultiple <= 2.5) return 10;
  if (atrMultiple <= 3.5) return 5;
  return 0;
}

function confirmationScore(input: ZoneContext, zone: { lower: number; upper: number }): number {
  if (input.side === "LONG") {
    const reclaimedZone = input.currentPrice >= zone.lower;
    const notBelowAnchor = input.anchoredVWAP === null || input.currentPrice >= input.anchoredVWAP - input.atr * 0.5;
    return reclaimedZone && notBelowAnchor ? 8 : 4;
  }
  const rejectedZone = input.currentPrice <= zone.upper;
  const notAboveAnchor = input.anchoredVWAP === null || input.currentPrice <= input.anchoredVWAP + input.atr * 0.5;
  return rejectedZone && notAboveAnchor ? 8 : 4;
}

function analyzeZone(input: ZoneContext): {
  actionability: EntryActionability;
  entryQualityScore: number;
  entryZone: { lower: number; upper: number };
  distancePercent: number;
  invalidation: number | null;
  stop: number | null;
  targets: EntryTarget[];
  estimatedRewardRisk: number | null;
  reasonNoTrade?: string;
  explanation: string[];
  warnings: string[];
} {
  const zone = {
    lower: Math.min(...input.cluster) - input.config.atrZoneBuffer * input.atr,
    upper: Math.max(...input.cluster) + input.config.atrZoneBuffer * input.atr
  };
  const invalidation =
    input.side === "LONG"
      ? conservativeLongInvalidation(input.pivot, input.anchoredVWAP, input.atr)
      : conservativeShortInvalidation(input.pivot, input.anchoredVWAP, input.atr);
  const stop =
    invalidation === null
      ? null
      : input.side === "LONG"
        ? invalidation - input.config.stopATRBuffer * input.atr
        : invalidation + input.config.stopATRBuffer * input.atr;
  const entryReference = input.side === "LONG" ? Math.max(input.currentPrice, zone.lower) : Math.min(input.currentPrice, zone.upper);
  const targets = stop === null ? [] : buildTargets({ side: input.side, entryReference, stop, upperBand1: input.upperBand1, lowerBand1: input.lowerBand1 });
  const risk = stop === null ? null : Math.abs(entryReference - stop);
  const bestReward = risk === null || risk === 0 ? null : Math.max(0, ...targets.map((target) => target.rMultiple));
  const distancePercent = distanceFromZonePercent(input.currentPrice, zone);
  const warnings: string[] = [];
  const explanation: string[] = [];
  let reasonNoTrade: string | undefined;

  if (input.side === "LONG" && input.vwapZScore !== null && input.vwapZScore > input.config.maxVWAPZScoreForLong) {
    reasonNoTrade = "Price is more than 2 standard deviations above VWAP.";
    warnings.push("Too extended above VWAP confluence.");
  }
  if (input.side === "SHORT" && input.vwapZScore !== null && input.vwapZScore < input.config.maxVWAPZScoreForShort) {
    reasonNoTrade = "Price is more than 2 standard deviations below VWAP.";
    warnings.push("Too extended below VWAP confluence.");
  }
  if (bestReward !== null && bestReward < input.config.minimumRewardRisk) {
    reasonNoTrade = reasonNoTrade ?? "Reward-to-risk is below the minimum threshold.";
    warnings.push("Bad reward/risk.");
  }

  const score = boundedScore(
    25 +
      confluenceScore(input.cluster, input.atr) +
      priceLocationScore(input.currentPrice, zone, input.atr) +
      (stop === null ? 0 : stopQualityScore(input.currentPrice, stop, input.atr)) +
      (bestReward !== null && bestReward >= 2 ? 10 : bestReward !== null && bestReward >= input.config.minimumRewardRisk ? 7 : 0) +
      confirmationScore(input, zone)
  );
  const actionability: EntryActionability =
    reasonNoTrade !== undefined
      ? "NO_TRADE"
      : score >= input.config.actionableScoreThreshold
        ? "ACTIONABLE"
        : score >= input.config.watchlistScoreThreshold
          ? "WATCHLIST"
          : "NO_TRADE";

  explanation.push(`Price is ${distancePercent === 0 ? "inside" : "near or outside"} the preferred ${input.side.toLowerCase()} execution zone.`);
  explanation.push("VWAP references are used for execution quality only, not as a standalone signal.");
  if (actionability !== "ACTIONABLE") warnings.push("Entry zone is actionable only after confirmation.");

  return {
    actionability,
    entryQualityScore: score,
    entryZone: zone,
    distancePercent,
    invalidation,
    stop,
    targets,
    estimatedRewardRisk: bestReward,
    reasonNoTrade,
    explanation,
    warnings
  };
}

export function analyzeOptimalEntryZone(input: AnalyzeOptimalEntryZoneInput): OptimalEntryZoneResult {
  const config = input.config ?? DEFAULT_QUANT_CONFIG.optimalEntryZone;
  const asOfIndex = input.candles.length - 1;
  const current = input.candles[asOfIndex];
  const warnings: string[] = [];
  const explanation = [`Main strategy classifies asset as ${input.mainStrategyDirection}.`];
  const sessionVWAP = calculateSessionVWAP(input.candles, asOfIndex);
  const rolling7 = calculateRollingVWAP(input.candles, asOfIndex, 7);
  const rolling30 = calculateRollingVWAP(input.candles, asOfIndex, 30);
  const rolling90 = calculateRollingVWAP(input.candles, asOfIndex, 90);
  const bands = calculateVWAPBands(input.candles.slice(0, asOfIndex + 1), current?.close ?? null);
  const atr = calculateATR(input.candles, config.atrPeriod, asOfIndex);
  warnings.push(...sessionVWAP.warnings, ...rolling7.warnings, ...rolling30.warnings, ...rolling90.warnings, ...bands.warnings, ...atr.warnings);

  const baseVWAPData = {
    ...emptyVWAPData(),
    sessionVWAP: sessionVWAP.value,
    rollingVWAP7D: rolling7.value,
    rollingVWAP30D: rolling30.value,
    rollingVWAP90D: rolling90.value,
    vwapStdDev: bands.weightedStdDev,
    vwapZScore: bands.vwapZScore,
    upperBand1: bands.upperBand1,
    lowerBand1: bands.lowerBand1,
    upperBand2: bands.upperBand2,
    lowerBand2: bands.lowerBand2
  };

  if (!current || atr.value === null) {
    return {
      symbol: input.symbol,
      timeframe: input.timeframe,
      regimeDirection: input.mainStrategyDirection,
      actionability: "NO_TRADE",
      entrySide: "NONE",
      entryQualityScore: 0,
      entryZone: null,
      currentPrice: current?.close ?? null,
      distanceFromEntryZonePercent: null,
      invalidationPrice: null,
      suggestedStop: null,
      targets: [],
      vwapData: baseVWAPData,
      riskData: { atr: atr.value, stopDistancePercent: null, estimatedRewardRisk: null },
      explanation: [...explanation, "Insufficient candle or ATR data for execution analysis."],
      warnings: Array.from(new Set(warnings)),
      reasonNoTrade: "Insufficient candle or ATR data."
    };
  }

  if (input.mainStrategyDirection !== "LONG_ELIGIBLE") {
    if (input.requestedSide === "SHORT") warnings.push("VWAP is not a standalone short signal.");
    return {
      symbol: input.symbol,
      timeframe: input.timeframe,
      regimeDirection: input.mainStrategyDirection,
      actionability: "NO_TRADE",
      entrySide: "NONE",
      entryQualityScore: 0,
      entryZone: null,
      currentPrice: current.close,
      distanceFromEntryZonePercent: null,
      invalidationPrice: null,
      suggestedStop: null,
      targets: [],
      vwapData: baseVWAPData,
      riskData: { atr: atr.value, stopDistancePercent: null, estimatedRewardRisk: null },
      explanation: [...explanation, "Main strategy does not allow a trade; VWAP data is context only."],
      warnings: Array.from(new Set(warnings)),
      reasonNoTrade: "Main strategy does not allow a trade."
    };
  }

  if (!input.liquidityPassed || !input.volatilityPassed || !input.expectedValuePassed) {
    if (!input.liquidityPassed) warnings.push("Liquidity too weak.");
    if (!input.volatilityPassed) warnings.push("Volatility too high.");
    if (!input.expectedValuePassed) warnings.push("Expected-value filter is not positive.");
  }

  const pivot = findMostRecentConfirmedSwingLow(input.candles, config.pivotLeft, config.pivotRight, asOfIndex);
  const anchorPoints = pivot ? input.candles.slice(pivot.pivotIndex, asOfIndex + 1) : input.candles.slice(0, asOfIndex + 1);
  const anchoredVWAP = calculateVWAP(anchorPoints);
  warnings.push(...anchoredVWAP.warnings);
  const cluster = [rolling7.value, rolling30.value, anchoredVWAP.value].filter((value): value is number => typeof value === "number");

  if (cluster.length === 0) {
    return {
      symbol: input.symbol,
      timeframe: input.timeframe,
      regimeDirection: input.mainStrategyDirection,
      actionability: "NO_TRADE",
      entrySide: "NONE",
      entryQualityScore: 0,
      entryZone: null,
      currentPrice: current.close,
      distanceFromEntryZonePercent: null,
      invalidationPrice: null,
      suggestedStop: null,
      targets: [],
      vwapData: { ...baseVWAPData, anchoredVWAP: anchoredVWAP.value },
      riskData: { atr: atr.value, stopDistancePercent: null, estimatedRewardRisk: null },
      explanation: [...explanation, "VWAP support cluster could not be built from available volume data."],
      warnings: Array.from(new Set(warnings)),
      reasonNoTrade: "VWAP support cluster unavailable."
    };
  }

  const zone = analyzeZone({
    side: "LONG",
    currentPrice: current.close,
    atr: atr.value,
    cluster,
    anchoredVWAP: anchoredVWAP.value,
    pivot,
    upperBand1: bands.upperBand1,
    lowerBand1: bands.lowerBand1,
    upperBand2: bands.upperBand2,
    lowerBand2: bands.lowerBand2,
    vwapZScore: bands.vwapZScore,
    config
  });
  let actionability = zone.actionability;
  let reasonNoTrade = zone.reasonNoTrade;
  if (!input.liquidityPassed || !input.volatilityPassed || !input.expectedValuePassed) {
    actionability = "NO_TRADE";
    reasonNoTrade = reasonNoTrade ?? "One or more upstream risk filters are failing.";
  }
  const stopDistancePercent =
    zone.stop === null || current.close === 0 ? null : (Math.abs(current.close - zone.stop) / current.close) * 100;

  return {
    symbol: input.symbol,
    timeframe: input.timeframe,
    regimeDirection: input.mainStrategyDirection,
    actionability,
    entrySide: "LONG",
    entryQualityScore: zone.entryQualityScore,
    entryZone: zone.entryZone,
    currentPrice: current.close,
    distanceFromEntryZonePercent: zone.distancePercent,
    invalidationPrice: zone.invalidation,
    suggestedStop: zone.stop,
    targets: zone.targets,
    vwapData: { ...baseVWAPData, anchoredVWAP: anchoredVWAP.value },
    riskData: {
      atr: atr.value,
      stopDistancePercent,
      estimatedRewardRisk: zone.estimatedRewardRisk
    },
    explanation: [...explanation, ...zone.explanation],
    warnings: Array.from(new Set([...warnings, ...zone.warnings])),
    reasonNoTrade
  };
}

export function findMostRecentShortAnchorForContext(
  candles: MarketDataPoint[],
  config: OptimalEntryZoneConfig = DEFAULT_QUANT_CONFIG.optimalEntryZone
): ConfirmedPivot | null {
  return findMostRecentConfirmedSwingHigh(candles, config.pivotLeft, config.pivotRight, candles.length - 1);
}
