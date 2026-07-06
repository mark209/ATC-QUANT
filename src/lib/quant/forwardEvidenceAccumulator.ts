import type { AssetType } from "@/types/asset";
import type { ValidationEvidenceState } from "@/types/quant";
import type { CapitalStarvationDecision } from "./capitalStarvationAudit";

export type ForwardEvidenceVerdict =
  | "Continue collecting forward evidence."
  | "Preliminary positive, continue paper-only."
  | "Preliminary negative, keep production unchanged."
  | "Inconclusive; sample too small."
  | "Fragile; edge depends on outliers."
  | "Unsafe; disable shadow tracking."
  | "Ready for deeper paper-trading simulation, not live trading.";

export type ForwardOutcomeStatus = "pending outcome" | "outcome attached" | "invalid/missing data" | "evaluation-ready";
export type ForwardEvidenceMode = "production_current" | "frozen_floor_0_10";

export interface ForwardCostModel {
  name: string;
  costPerUnitAllocation: number;
}

export interface FrozenShadowPolicyManifest {
  policyName: "frozen_floor_0_10";
  policyVersion: string;
  allocationFloor: number;
  dateFrozen: string;
  sourceReport: string;
  ruleSummary: string;
  safetyRestrictions: string[];
  costAssumptions: ForwardCostModel[];
  productionStatus: "paper-only";
  productionPromotionStatus: "not approved";
}

export interface ForwardPriceReference {
  close: number | null;
  source: string;
  asOfDate: string;
}

export interface ForwardEvidenceJournalRow {
  rowId: string;
  timestamp: string;
  decisionDate: string;
  asset: string;
  assetType: AssetType;
  policyVersion: string;
  productionDecision: string;
  productionAllocation: number;
  productionDecisionHash: string;
  frozenShadowMode: "frozen_floor_0_10";
  frozenShadowAllocation: number;
  shadowDecisionHash: string;
  signalConfidence: number;
  evEstimate: number;
  validationEvidenceStatus: ValidationEvidenceState;
  regime: string;
  reasonCodes: string[];
  warnings: string[];
  priceReference: ForwardPriceReference;
  nextPeriodReturn: number | null;
  outcomeAttachedAt: string | null;
  costModel: ForwardCostModel;
  eligibleForEvaluation: boolean;
  outcomeStatus: ForwardOutcomeStatus;
}

export interface CreateForwardJournalRowInput {
  decision: CapitalStarvationDecision;
  manifest: FrozenShadowPolicyManifest;
  timestamp: string;
  costModel: ForwardCostModel;
  priceReference?: ForwardPriceReference;
}

export interface AppendForwardEvidenceResult {
  attemptedRows: number;
  appendedRows: number;
  skippedDuplicateRows: number;
  invalidRows: number;
  rowsToAppend: ForwardEvidenceJournalRow[];
}

export interface ForwardEvidenceThresholds {
  preliminaryRows: number;
  weakEvidenceRows: number;
  strongerEvidenceRows: number;
  minActiveShadowDecisions: number;
  minAssets: number;
  minRegimes: number;
}

export interface ForwardEvidenceThresholdStatus extends ForwardEvidenceThresholds {
  evaluationReadyRows: number;
  activeShadowDecisions: number;
  contributingAssets: number;
  representedRegimes: number;
  preliminaryReadMet: boolean;
  weakEvidenceMet: boolean;
  strongerEvidenceMet: boolean;
  activeShadowDecisionThresholdMet: boolean;
  assetRobustnessMet: boolean;
  regimeRobustnessMet: boolean;
  enoughEvidenceExists: boolean;
}

export interface ForwardEvidencePerformance {
  totalReturn: number;
  hitRate: number;
  profitFactor: number;
  expectancy: number;
  maxDrawdown: number;
  worst5DecisionSequence: number;
  activeRows: number;
  averageAllocation: number;
}

export interface ForwardEvidenceContributionBreakdown {
  rows: number;
  activeRows: number;
  totalReturn: number;
  hitRate: number;
  profitFactor: number;
  expectancy: number;
  maxDrawdown: number;
}

export interface ForwardEvidenceOutlierDependency {
  topTradeContributionShare: number;
  topAssetContributionShare: number;
  fragile: boolean;
}

export interface ForwardEvidencePassFail {
  mediumCostTotalReturnPositive: { passed: boolean; value: number };
  profitFactorAboveOneTen: { passed: boolean; value: number };
  expectancyPositiveAfterCosts: { passed: boolean; value: number };
  maxDrawdownBelowFivePercent: { passed: boolean; value: number };
  noSingleTradeAboveHalfProfit: { passed: boolean; value: number };
  noSingleAssetAboveEightyPercentProfit: { passed: boolean; value: number };
  riskOffDowntrendLossesAcceptable: { passed: boolean; value: number };
}

export interface ForwardEvidenceJournalStatus {
  totalRows: number;
  pendingOutcomeRows: number;
  outcomeAttachedRows: number;
  invalidRows: number;
  evaluationReadyRows: number;
}

export interface ForwardEvidenceEvaluation {
  journalStatus: ForwardEvidenceJournalStatus;
  thresholdStatus: ForwardEvidenceThresholdStatus;
  production: { mode: "production_current"; performance: ForwardEvidencePerformance };
  shadow: { mode: "frozen_floor_0_10"; performance: ForwardEvidencePerformance };
  passFail: ForwardEvidencePassFail;
  outlierDependency: ForwardEvidenceOutlierDependency;
  assetBreakdown: Record<string, ForwardEvidenceContributionBreakdown>;
  regimeBreakdown: Record<string, ForwardEvidenceContributionBreakdown>;
  costSensitivity: Array<{ costModel: string; performance: ForwardEvidencePerformance; survives: boolean }>;
  finalVerdict: ForwardEvidenceVerdict;
}

export interface EvaluateForwardEvidenceOptions {
  thresholds?: Partial<ForwardEvidenceThresholds>;
  costModels?: ForwardCostModel[];
}

const DEFAULT_THRESHOLDS: ForwardEvidenceThresholds = {
  preliminaryRows: 100,
  weakEvidenceRows: 250,
  strongerEvidenceRows: 500,
  minActiveShadowDecisions: 30,
  minAssets: 3,
  minRegimes: 2
};

const DEFAULT_COST_MODELS: ForwardCostModel[] = [
  { name: "no cost", costPerUnitAllocation: 0 },
  { name: "low cost", costPerUnitAllocation: 0.001 },
  { name: "medium cost", costPerUnitAllocation: 0.004 },
  { name: "high cost", costPerUnitAllocation: 0.008 }
];

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(",")}}`;
}

function stableHash(value: unknown): string {
  const text = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function maxDrawdown(contributions: number[]): number {
  let equity = 1;
  let peak = 1;
  let worst = 0;
  for (const contribution of contributions) {
    equity *= 1 + contribution;
    peak = Math.max(peak, equity);
    worst = Math.min(worst, equity / peak - 1);
  }
  return worst;
}

function windowWorst(values: number[], window: number): number {
  if (values.length === 0) return 0;
  if (values.length < window) return values.reduce((sum, value) => sum + value, 0);
  let worst = Number.POSITIVE_INFINITY;
  for (let index = 0; index + window <= values.length; index += 1) {
    worst = Math.min(worst, values.slice(index, index + window).reduce((sum, value) => sum + value, 0));
  }
  return worst === Number.POSITIVE_INFINITY ? 0 : worst;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function assertString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`Invalid frozen policy manifest: ${field}`);
  return value;
}

function assertNumber(value: unknown, field: string): number {
  if (!isFiniteNumber(value)) throw new Error(`Invalid frozen policy manifest: ${field}`);
  return value;
}

export function loadFrozenPolicyManifest(raw: unknown): FrozenShadowPolicyManifest {
  const input = raw as Partial<FrozenShadowPolicyManifest>;
  if (!input || typeof input !== "object") throw new Error("Invalid frozen policy manifest");
  if (input.policyName !== "frozen_floor_0_10") throw new Error("Invalid frozen policy manifest: policyName");
  if (input.productionStatus !== "paper-only") throw new Error("Invalid frozen policy manifest: productionStatus");
  if (input.productionPromotionStatus !== "not approved") throw new Error("Invalid frozen policy manifest: productionPromotionStatus");

  return {
    policyName: "frozen_floor_0_10",
    policyVersion: assertString(input.policyVersion, "policyVersion"),
    allocationFloor: assertNumber(input.allocationFloor, "allocationFloor"),
    dateFrozen: assertString(input.dateFrozen, "dateFrozen"),
    sourceReport: assertString(input.sourceReport, "sourceReport"),
    ruleSummary: assertString(input.ruleSummary, "ruleSummary"),
    safetyRestrictions: Array.isArray(input.safetyRestrictions) ? input.safetyRestrictions.map((item) => assertString(item, "safetyRestrictions")) : [],
    costAssumptions: Array.isArray(input.costAssumptions)
      ? input.costAssumptions.map((cost) => ({
          name: assertString((cost as ForwardCostModel).name, "costAssumptions.name"),
          costPerUnitAllocation: assertNumber((cost as ForwardCostModel).costPerUnitAllocation, "costAssumptions.costPerUnitAllocation")
        }))
      : [],
    productionStatus: "paper-only",
    productionPromotionStatus: "not approved"
  };
}

function strictFrozenPolicySafetyPassed(decision: CapitalStarvationDecision): boolean {
  return (
    decision.dataQualityPassed &&
    decision.regimeLabel !== "Risk-Off" &&
    decision.evAfterCosts > 0 &&
    decision.signalScore >= 60 &&
    decision.validationEvidenceState !== "Failed Evidence" &&
    decision.validationEvidenceState !== "No Evidence"
  );
}

function frozenShadowAllocation(decision: CapitalStarvationDecision, manifest: FrozenShadowPolicyManifest): number {
  const production = Math.max(0, decision.activeAllocation);
  if (!strictFrozenPolicySafetyPassed(decision)) return production;
  return Math.max(production, manifest.allocationFloor);
}

function duplicateKey(row: Pick<ForwardEvidenceJournalRow, "asset" | "decisionDate" | "policyVersion" | "productionDecisionHash" | "shadowDecisionHash">): string {
  return [row.asset, row.decisionDate, row.policyVersion, row.productionDecisionHash, row.shadowDecisionHash].join("|");
}

export function createForwardJournalRow(input: CreateForwardJournalRowInput): ForwardEvidenceJournalRow {
  const policy = loadFrozenPolicyManifest(input.manifest);
  const productionAllocation = Math.max(0, input.decision.activeAllocation);
  const shadowAllocation = frozenShadowAllocation(input.decision, policy);
  const productionDecisionHash = stableHash({
    decision: input.decision.finalDecision,
    allocation: productionAllocation,
    signalScore: input.decision.signalScore,
    evAfterCosts: input.decision.evAfterCosts,
    validationEvidenceState: input.decision.validationEvidenceState,
    regimeLabel: input.decision.regimeLabel,
    reasonCodes: input.decision.blockingReasons
  });
  const shadowDecisionHash = stableHash({
    policyName: policy.policyName,
    policyVersion: policy.policyVersion,
    allocationFloor: policy.allocationFloor,
    allocation: shadowAllocation,
    safetyPassed: strictFrozenPolicySafetyPassed(input.decision)
  });
  const key = duplicateKey({
    asset: input.decision.symbol,
    decisionDate: input.decision.date,
    policyVersion: policy.policyVersion,
    productionDecisionHash,
    shadowDecisionHash
  });

  return {
    rowId: stableHash(key),
    timestamp: input.timestamp,
    decisionDate: input.decision.date,
    asset: input.decision.symbol,
    assetType: input.decision.assetType,
    policyVersion: policy.policyVersion,
    productionDecision: input.decision.finalDecision,
    productionAllocation,
    productionDecisionHash,
    frozenShadowMode: policy.policyName,
    frozenShadowAllocation: shadowAllocation,
    shadowDecisionHash,
    signalConfidence: input.decision.signalScore,
    evEstimate: input.decision.evAfterCosts,
    validationEvidenceStatus: input.decision.validationEvidenceState,
    regime: input.decision.regimeLabel,
    reasonCodes: [...input.decision.blockingReasons],
    warnings: [...input.decision.warnings],
    priceReference: input.priceReference ?? { close: null, source: "not recorded", asOfDate: input.decision.date },
    nextPeriodReturn: null,
    outcomeAttachedAt: null,
    costModel: { ...input.costModel },
    eligibleForEvaluation: false,
    outcomeStatus: "pending outcome"
  };
}

export function classifyForwardJournalRow(row: ForwardEvidenceJournalRow): ForwardOutcomeStatus {
  if (!row.asset || !row.decisionDate || !row.policyVersion || !row.productionDecisionHash || !row.shadowDecisionHash) return "invalid/missing data";
  if (row.nextPeriodReturn === null) return "pending outcome";
  if (!Number.isFinite(row.nextPeriodReturn)) return "invalid/missing data";
  return row.eligibleForEvaluation ? "evaluation-ready" : "outcome attached";
}

export function attachForwardOutcome(row: ForwardEvidenceJournalRow, nextPeriodReturn: number, outcomeAttachedAt: string): ForwardEvidenceJournalRow {
  return {
    ...row,
    nextPeriodReturn,
    outcomeAttachedAt,
    eligibleForEvaluation: Number.isFinite(nextPeriodReturn),
    outcomeStatus: Number.isFinite(nextPeriodReturn) ? "evaluation-ready" : "invalid/missing data"
  };
}

export function appendForwardEvidenceRows(
  existingRows: ForwardEvidenceJournalRow[],
  candidateRows: ForwardEvidenceJournalRow[]
): AppendForwardEvidenceResult {
  const seen = new Set(existingRows.map(duplicateKey));
  const rowsToAppend: ForwardEvidenceJournalRow[] = [];
  let skippedDuplicateRows = 0;
  let invalidRows = 0;

  for (const row of candidateRows) {
    if (classifyForwardJournalRow(row) === "invalid/missing data") {
      invalidRows += 1;
      continue;
    }
    const key = duplicateKey(row);
    if (seen.has(key)) {
      skippedDuplicateRows += 1;
      continue;
    }
    seen.add(key);
    rowsToAppend.push(row);
  }

  return {
    attemptedRows: candidateRows.length,
    appendedRows: rowsToAppend.length,
    skippedDuplicateRows,
    invalidRows,
    rowsToAppend
  };
}

function thresholdConfig(input?: Partial<ForwardEvidenceThresholds>): ForwardEvidenceThresholds {
  return { ...DEFAULT_THRESHOLDS, ...(input ?? {}) };
}

function evaluationReadyRows(rows: ForwardEvidenceJournalRow[]): ForwardEvidenceJournalRow[] {
  return rows.filter((row) => classifyForwardJournalRow(row) === "evaluation-ready");
}

export function assessForwardEvidenceThresholds(
  rows: ForwardEvidenceJournalRow[],
  inputThresholds?: Partial<ForwardEvidenceThresholds>
): ForwardEvidenceThresholdStatus {
  const thresholds = thresholdConfig(inputThresholds);
  const ready = evaluationReadyRows(rows);
  const activeShadow = ready.filter((row) => row.frozenShadowAllocation > 0);
  const contributingAssets = new Set(activeShadow.map((row) => row.asset));
  const representedRegimes = new Set(activeShadow.map((row) => row.regime));
  return {
    ...thresholds,
    evaluationReadyRows: ready.length,
    activeShadowDecisions: activeShadow.length,
    contributingAssets: contributingAssets.size,
    representedRegimes: representedRegimes.size,
    preliminaryReadMet: ready.length >= thresholds.preliminaryRows,
    weakEvidenceMet: ready.length >= thresholds.weakEvidenceRows,
    strongerEvidenceMet: ready.length >= thresholds.strongerEvidenceRows,
    activeShadowDecisionThresholdMet: activeShadow.length >= thresholds.minActiveShadowDecisions,
    assetRobustnessMet: contributingAssets.size >= thresholds.minAssets,
    regimeRobustnessMet: representedRegimes.size >= thresholds.minRegimes,
    enoughEvidenceExists: ready.length >= thresholds.preliminaryRows && activeShadow.length >= thresholds.minActiveShadowDecisions
  };
}

function allocationForMode(row: ForwardEvidenceJournalRow, mode: ForwardEvidenceMode): number {
  return mode === "production_current" ? row.productionAllocation : row.frozenShadowAllocation;
}

function contributionFor(row: ForwardEvidenceJournalRow, mode: ForwardEvidenceMode, costPerUnitAllocation?: number): number {
  const allocation = allocationForMode(row, mode);
  const nextReturn = row.nextPeriodReturn ?? 0;
  const cost = costPerUnitAllocation ?? row.costModel.costPerUnitAllocation;
  return allocation * (nextReturn - (allocation > 0 ? cost : 0));
}

function performance(rows: ForwardEvidenceJournalRow[], mode: ForwardEvidenceMode, costPerUnitAllocation?: number): ForwardEvidencePerformance {
  const contributions = rows.map((row) => contributionFor(row, mode, costPerUnitAllocation));
  const activeContributions = rows.filter((row) => allocationForMode(row, mode) > 0).map((row) => contributionFor(row, mode, costPerUnitAllocation));
  const wins = activeContributions.filter((value) => value > 0);
  const losses = activeContributions.filter((value) => value < 0);
  const grossWin = wins.reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(losses.reduce((sum, value) => sum + value, 0));
  return {
    totalReturn: contributions.reduce((sum, value) => sum + value, 0),
    hitRate: activeContributions.length === 0 ? 0 : wins.length / activeContributions.length,
    profitFactor: grossLoss === 0 ? (grossWin > 0 ? Number.POSITIVE_INFINITY : 0) : grossWin / grossLoss,
    expectancy: average(activeContributions),
    maxDrawdown: maxDrawdown(contributions),
    worst5DecisionSequence: windowWorst(contributions, 5),
    activeRows: rows.filter((row) => allocationForMode(row, mode) > 0).length,
    averageAllocation: average(rows.map((row) => allocationForMode(row, mode)))
  };
}

function breakdown(rows: ForwardEvidenceJournalRow[], mode: ForwardEvidenceMode, keyFor: (row: ForwardEvidenceJournalRow) => string): Record<string, ForwardEvidenceContributionBreakdown> {
  const grouped = new Map<string, ForwardEvidenceJournalRow[]>();
  for (const row of rows) grouped.set(keyFor(row), [...(grouped.get(keyFor(row)) ?? []), row]);
  return Object.fromEntries(
    [...grouped.entries()].map(([key, value]) => {
      const stats = performance(value, mode);
      return [key, { rows: value.length, ...stats }];
    })
  );
}

function outlierDependency(rows: ForwardEvidenceJournalRow[]): ForwardEvidenceOutlierDependency {
  const positiveTrades = rows.map((row) => Math.max(0, contributionFor(row, "frozen_floor_0_10"))).sort((a, b) => b - a);
  const totalPositive = positiveTrades.reduce((sum, value) => sum + value, 0);
  const byAsset = breakdown(rows, "frozen_floor_0_10", (row) => row.asset);
  const positiveAssetReturns = Object.values(byAsset).map((asset) => Math.max(0, asset.totalReturn));
  const topTradeContributionShare = totalPositive === 0 ? 0 : (positiveTrades[0] ?? 0) / totalPositive;
  const topAssetContributionShare =
    totalPositive === 0 ? 0 : Math.max(0, ...positiveAssetReturns) / positiveAssetReturns.reduce((sum, value) => sum + value, 0);
  return {
    topTradeContributionShare,
    topAssetContributionShare,
    fragile: topTradeContributionShare > 0.5 || topAssetContributionShare > 0.8
  };
}

function passFail(rows: ForwardEvidenceJournalRow[], shadow: ForwardEvidencePerformance, outliers: ForwardEvidenceOutlierDependency): ForwardEvidencePassFail {
  const regime = breakdown(rows, "frozen_floor_0_10", (row) => row.regime);
  const harmfulRegimeReturn = Object.entries(regime)
    .filter(([label]) => label === "Risk-Off" || label.toLowerCase().includes("down"))
    .reduce((sum, [, value]) => sum + value.totalReturn, 0);
  return {
    mediumCostTotalReturnPositive: { passed: shadow.totalReturn > 0, value: shadow.totalReturn },
    profitFactorAboveOneTen: { passed: shadow.profitFactor > 1.1, value: shadow.profitFactor },
    expectancyPositiveAfterCosts: { passed: shadow.expectancy > 0, value: shadow.expectancy },
    maxDrawdownBelowFivePercent: { passed: shadow.maxDrawdown > -0.05, value: shadow.maxDrawdown },
    noSingleTradeAboveHalfProfit: { passed: outliers.topTradeContributionShare <= 0.5, value: outliers.topTradeContributionShare },
    noSingleAssetAboveEightyPercentProfit: { passed: outliers.topAssetContributionShare <= 0.8, value: outliers.topAssetContributionShare },
    riskOffDowntrendLossesAcceptable: { passed: harmfulRegimeReturn > -0.002, value: harmfulRegimeReturn }
  };
}

function journalStatus(rows: ForwardEvidenceJournalRow[]): ForwardEvidenceJournalStatus {
  const statuses = rows.map(classifyForwardJournalRow);
  return {
    totalRows: rows.length,
    pendingOutcomeRows: statuses.filter((status) => status === "pending outcome").length,
    outcomeAttachedRows: statuses.filter((status) => status === "outcome attached").length,
    invalidRows: statuses.filter((status) => status === "invalid/missing data").length,
    evaluationReadyRows: statuses.filter((status) => status === "evaluation-ready").length
  };
}

function verdict(input: {
  thresholdStatus: ForwardEvidenceThresholdStatus;
  shadow: ForwardEvidencePerformance;
  passFail: ForwardEvidencePassFail;
  outliers: ForwardEvidenceOutlierDependency;
}): ForwardEvidenceVerdict {
  if (!input.thresholdStatus.enoughEvidenceExists) return "Inconclusive; sample too small.";
  if (input.shadow.maxDrawdown <= -0.05 || input.passFail.riskOffDowntrendLossesAcceptable.value <= -0.01) return "Unsafe; disable shadow tracking.";
  if (input.shadow.totalReturn < 0 || input.shadow.profitFactor < 1 || input.shadow.expectancy < 0) {
    return "Preliminary negative, keep production unchanged.";
  }
  if (input.outliers.fragile) return "Fragile; edge depends on outliers.";
  if (Object.values(input.passFail).every((criterion) => criterion.passed) && input.thresholdStatus.strongerEvidenceMet) {
    return "Ready for deeper paper-trading simulation, not live trading.";
  }
  if (Object.values(input.passFail).every((criterion) => criterion.passed) && input.thresholdStatus.preliminaryReadMet) {
    return "Preliminary positive, continue paper-only.";
  }
  return "Continue collecting forward evidence.";
}

export function evaluateForwardEvidenceJournal(
  rows: ForwardEvidenceJournalRow[],
  options: EvaluateForwardEvidenceOptions = {}
): ForwardEvidenceEvaluation {
  const ready = evaluationReadyRows(rows);
  const thresholds = assessForwardEvidenceThresholds(rows, options.thresholds);
  const production = performance(ready, "production_current");
  const shadow = performance(ready, "frozen_floor_0_10");
  const outliers = outlierDependency(ready);
  const gates = passFail(ready, shadow, outliers);
  const costModels = options.costModels ?? DEFAULT_COST_MODELS;

  return {
    journalStatus: journalStatus(rows),
    thresholdStatus: thresholds,
    production: { mode: "production_current", performance: production },
    shadow: { mode: "frozen_floor_0_10", performance: shadow },
    passFail: gates,
    outlierDependency: outliers,
    assetBreakdown: breakdown(ready, "frozen_floor_0_10", (row) => row.asset),
    regimeBreakdown: breakdown(ready, "frozen_floor_0_10", (row) => row.regime),
    costSensitivity: costModels.map((costModel) => {
      const costPerformance = performance(ready, "frozen_floor_0_10", costModel.costPerUnitAllocation);
      return {
        costModel: costModel.name,
        performance: costPerformance,
        survives:
          costPerformance.totalReturn > 0 &&
          costPerformance.profitFactor > 1.1 &&
          costPerformance.expectancy > 0 &&
          costPerformance.maxDrawdown > -0.05
      };
    }),
    finalVerdict: verdict({ thresholdStatus: thresholds, shadow, passFail: gates, outliers })
  };
}
