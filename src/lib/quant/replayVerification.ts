import { createHash } from "node:crypto";
import type { ExecutionEvent } from "@/lib/trading/executionEvent";
import { validateExecutionEvent } from "@/lib/trading/executionEvent";
import type { LifecycleEvent, LifecycleState } from "@/lib/trading/lifecycleEvent";
import type { TradeRecord } from "@/lib/trading/tradeJournal";
import { validateTradeRecord } from "@/lib/trading/tradeJournal";

export type VerificationStatus = "PASS" | "FAIL" | "UNAVAILABLE" | "INCONCLUSIVE";

export interface ReplayIdentity {
  replay_id: string;
  dataset_version: string;
  dataset_hash: string;
  strategy_version: string;
  execution_profile: string;
  random_seed: string;
  configuration: unknown;
  configuration_hash: string;
  source_git_commit?: string;
}

export interface ReplayArtifactMetadata extends ReplayIdentity {
  journal_hash?: string;
  execution_journal_hash?: string;
  lifecycle_journal_hash?: string;
  analytics_inputs_hash?: string;
}

export interface ReplayArtifacts {
  metadata: ReplayArtifactMetadata;
  trades: readonly TradeRecord[];
  execution_events: readonly ExecutionEvent[];
  lifecycle_events: readonly LifecycleEvent[];
  analytics_inputs?: unknown;
  replay_output?: unknown;
}

export interface ReplayRunner {
  run(identity: ReplayIdentity, dataset: unknown): Promise<ReplayArtifacts>;
}

export interface ReplayVerificationRequest {
  identity: ReplayIdentity;
  dataset: unknown;
  runner?: ReplayRunner;
  repetitions?: number;
}

export interface VerificationCheck {
  status: VerificationStatus;
  findings: string[];
}

export interface ArtifactComparison {
  equal: boolean;
  findings: string[];
}

export interface ReplayVerificationReport {
  status: VerificationStatus;
  replay_status: VerificationStatus;
  deterministic_status: VerificationStatus;
  replay_count: number;
  replay_duration_ms: number;
  hash_validation: VerificationCheck;
  journal_validation: VerificationCheck;
  lifecycle_validation: VerificationCheck;
  execution_validation: VerificationCheck;
  consistency_validation: VerificationCheck;
  analytics_validation: VerificationCheck;
  findings: string[];
  first_mismatch?: string;
  production_claim: string;
  summary: string;
}

const TERMINAL_STATES = new Set<LifecycleState>(["TRADE_COMPLETED", "TRADE_REJECTED"]);
const LIFECYCLE_TRANSITIONS: Record<string, readonly string[]> = {
  "null": ["SIGNAL_GENERATED"],
  SIGNAL_GENERATED: ["TRADE_PROPOSED"],
  TRADE_PROPOSED: ["RISK_VALIDATED", "TRADE_REJECTED"],
  RISK_VALIDATED: ["ORDER_CREATED"],
  ORDER_CREATED: ["ORDER_PENDING"],
  ORDER_PENDING: ["ORDER_PARTIALLY_FILLED", "POSITION_OPEN", "ORDER_CANCELLED"],
  ORDER_PARTIALLY_FILLED: ["POSITION_OPEN", "POSITION_UPDATED", "ORDER_FILLED", "ORDER_CANCELLED"],
  POSITION_OPEN: ["POSITION_UPDATED", "ORDER_FILLED", "ORDER_CANCELLED", "POSITION_CLOSED"],
  POSITION_UPDATED: ["POSITION_UPDATED", "ORDER_FILLED", "ORDER_CANCELLED", "POSITION_CLOSED"],
  ORDER_FILLED: ["POSITION_CLOSED"],
  ORDER_CANCELLED: ["POSITION_REMAINS_OPEN"],
  POSITION_REMAINS_OPEN: ["POSITION_CLOSED"],
  POSITION_CLOSED: ["TRADE_COMPLETED"]
};

function check(status: VerificationStatus, findings: string[] = []): VerificationCheck {
  return { status, findings };
}

function statusFromFindings(findings: string[], unavailable = false, inconclusive = false): VerificationStatus {
  if (findings.length > 0) return "FAIL";
  if (unavailable) return "UNAVAILABLE";
  if (inconclusive) return "INCONCLUSIVE";
  return "PASS";
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => [key, canonicalize(nested)]));
  }
  return value;
}

export function canonicalSerialize(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function calculateHash(value: unknown): string {
  return createHash("sha256").update(canonicalSerialize(value)).digest("hex");
}

export function hashJournal(entries: readonly unknown[]): string {
  return calculateHash(entries);
}

function validateIdentity(identity: ReplayIdentity): string[] {
  const findings: string[] = [];
  for (const [field, value] of Object.entries(identity)) {
    if (field !== "configuration" && typeof value !== "string" || field !== "configuration" && value.trim().length === 0) findings.push(`identity field ${field} is missing`);
  }
  if (identity.configuration_hash !== calculateHash(identity.configuration)) findings.push("configuration_hash does not match configuration");
  return findings;
}

function metadataConsistency(identity: ReplayIdentity, artifacts: ReplayArtifacts): string[] {
  const findings: string[] = [];
  const keys: Array<keyof ReplayIdentity> = ["replay_id", "dataset_version", "dataset_hash", "strategy_version", "execution_profile", "random_seed", "configuration_hash"];
  for (const key of keys) if (artifacts.metadata[key] !== identity[key]) findings.push(`${key} is inconsistent with replay identity`);
  if (identity.source_git_commit !== undefined && artifacts.metadata.source_git_commit !== identity.source_git_commit) findings.push("source_git_commit is inconsistent with replay identity");
  return findings;
}

function validateHashes(identity: ReplayIdentity, artifacts: ReplayArtifacts): VerificationCheck {
  const findings = validateIdentity(identity);
  if (artifacts.metadata.configuration_hash !== calculateHash(identity.configuration)) findings.push("artifact configuration_hash does not match configuration");
  if (artifacts.metadata.journal_hash !== undefined && artifacts.metadata.journal_hash !== hashJournal(artifacts.trades)) findings.push("journal_hash does not match trade journal");
  if (artifacts.metadata.execution_journal_hash !== undefined && artifacts.metadata.execution_journal_hash !== hashJournal(artifacts.execution_events)) findings.push("execution_journal_hash does not match execution events");
  if (artifacts.metadata.lifecycle_journal_hash !== undefined && artifacts.metadata.lifecycle_journal_hash !== hashJournal(artifacts.lifecycle_events)) findings.push("lifecycle_journal_hash does not match lifecycle events");
  if (artifacts.metadata.analytics_inputs_hash !== undefined && artifacts.metadata.analytics_inputs_hash !== calculateHash(artifacts.analytics_inputs)) findings.push("analytics_inputs_hash does not match analytics inputs");
  for (const trade of artifacts.trades) {
    try { validateTradeRecord(trade); } catch (error) { findings.push(`invalid trade record ${trade.trade_id ?? "unknown"}: ${error instanceof Error ? error.message : String(error)}`); }
  }
  for (const event of artifacts.execution_events) {
    try { validateExecutionEvent(event); } catch (error) { findings.push(`invalid execution event ${event.event_id ?? "unknown"}: ${error instanceof Error ? error.message : String(error)}`); }
  }
  return check(statusFromFindings(findings), findings);
}

function duplicateFindings(values: readonly string[], label: string): string[] {
  const seen = new Set<string>();
  const findings: string[] = [];
  for (const value of values) {
    if (seen.has(value)) findings.push(`duplicate ${label} ${value}`);
    seen.add(value);
  }
  return findings;
}

function validateJournal(artifacts: ReplayArtifacts): VerificationCheck {
  const findings = duplicateFindings(artifacts.trades.map((trade) => trade.trade_id), "trade ID");
  const completed = new Set(artifacts.lifecycle_events.filter((event) => event.state_after === "TRADE_COMPLETED").map((event) => event.trade_id));
  for (const trade of artifacts.trades) if (!completed.has(trade.trade_id)) findings.push(`trade ${trade.trade_id} has no completed lifecycle`);
  return check(statusFromFindings(findings, false, artifacts.trades.length === 0), findings);
}

function validateLifecycle(artifacts: ReplayArtifacts): VerificationCheck {
  const findings = duplicateFindings(artifacts.lifecycle_events.map((event) => event.event_id), "event ID");
  const grouped = new Map<string, LifecycleEvent[]>();
  for (const event of artifacts.lifecycle_events) grouped.set(event.trade_id, [...(grouped.get(event.trade_id) ?? []), event]);
  for (const [tradeId, events] of grouped) {
    const ordered = [...events].sort((a, b) => a.lifecycle_sequence - b.lifecycle_sequence);
    const expectedSequences = Array.from({ length: ordered.length }, (_, index) => index + 1);
    if (ordered.some((event, index) => event.lifecycle_sequence !== expectedSequences[index])) findings.push(`lifecycle sequence is not contiguous for ${tradeId}`);
    for (let index = 0; index < ordered.length; index += 1) {
      const event = ordered[index];
      if (index > 0 && Date.parse(event.timestamp_utc) < Date.parse(ordered[index - 1].timestamp_utc)) findings.push(`lifecycle timestamps are out of order for ${tradeId}`);
      const expectedBefore = index === 0 ? null : ordered[index - 1].state_after;
      if (event.state_before !== expectedBefore) findings.push(`lifecycle state_before is inconsistent for ${tradeId} sequence ${event.lifecycle_sequence}`);
      const allowed = LIFECYCLE_TRANSITIONS[String(event.state_before)];
      if (!allowed?.includes(event.state_after)) findings.push(`invalid lifecycle transition ${event.state_before ?? "null"} -> ${event.state_after} for ${tradeId}`);
      if (index > 0 && TERMINAL_STATES.has(ordered[index - 1].state_after)) findings.push(`lifecycle continues after terminal state for ${tradeId}`);
    }
    const completed = ordered.filter((event) => event.state_after === "TRADE_COMPLETED");
    if (completed.length > 1) findings.push(`trade ${tradeId} has multiple completed lifecycle events`);
    if (completed.length === 1 && ordered.at(-1)?.state_after !== "TRADE_COMPLETED") findings.push(`trade ${tradeId} has events after completion`);
  }
  const tradeIds = new Set(artifacts.trades.map((trade) => trade.trade_id));
  for (const event of artifacts.lifecycle_events) if (!tradeIds.has(event.trade_id)) findings.push(`orphan lifecycle event ${event.event_id}`);
  return check(statusFromFindings(findings, false, artifacts.lifecycle_events.length === 0), findings);
}

function validateExecution(artifacts: ReplayArtifacts): VerificationCheck {
  const findings = duplicateFindings(artifacts.execution_events.map((event) => event.event_id), "event ID");
  const allEventIds = new Set(artifacts.lifecycle_events.map((event) => event.event_id));
  for (const event of artifacts.execution_events) {
    if (allEventIds.has(event.event_id)) findings.push(`duplicate event ID across journals ${event.event_id}`);
    if (!event.metadata.order_id || typeof event.metadata.order_id !== "string") findings.push(`execution event ${event.event_id} has no order reference`);
  }
  const orderCreatedTrades = new Set(artifacts.lifecycle_events.filter((event) => event.state_after === "ORDER_CREATED").map((event) => event.trade_id));
  const grouped = new Map<string, ExecutionEvent[]>();
  for (const event of artifacts.execution_events) grouped.set(event.trade_id, [...(grouped.get(event.trade_id) ?? []), event]);
  for (const [tradeId, events] of grouped) {
    const ordered = [...events].sort((a, b) => a.event_sequence - b.event_sequence);
    if (ordered.some((event, index) => event.event_sequence !== index + 1)) findings.push(`execution sequence is not contiguous for ${tradeId}`);
    if (!orderCreatedTrades.has(tradeId)) findings.push(`execution events for ${tradeId} have no lifecycle order`);
    let cancelled = false;
    for (let index = 0; index < ordered.length; index += 1) {
      const event = ordered[index];
      if (index > 0 && Date.parse(event.timestamp_utc) < Date.parse(ordered[index - 1].timestamp_utc)) findings.push(`execution timestamps are out of order for ${tradeId}`);
      if (cancelled && event.filled_quantity > 0) findings.push(`fill after cancellation for ${tradeId}`);
      if (event.event_type === "ORDER_CANCELLED" || event.status === "cancelled") cancelled = true;
    }
  }
  const knownTradeIds = new Set(artifacts.trades.map((trade) => trade.trade_id));
  for (const event of artifacts.execution_events) if (!knownTradeIds.has(event.trade_id)) findings.push(`orphan execution event ${event.event_id}`);
  return check(statusFromFindings(findings, false, artifacts.execution_events.length === 0), findings);
}

function validateConsistency(identity: ReplayIdentity, artifacts: ReplayArtifacts): VerificationCheck {
  const findings = [...metadataConsistency(identity, artifacts)];
  for (const trade of artifacts.trades) {
    if (trade.replay_id !== identity.replay_id) findings.push(`trade ${trade.trade_id} has inconsistent replay_id`);
    if (trade.strategy_version !== identity.strategy_version) findings.push(`trade ${trade.trade_id} has inconsistent strategy_version`);
  }
  for (const event of [...artifacts.execution_events, ...artifacts.lifecycle_events]) {
    if (event.metadata.replay_id !== identity.replay_id) findings.push(`event ${event.event_id} has inconsistent replay_id`);
  }
  return check(statusFromFindings(findings), findings);
}

function validateAnalytics(artifacts: ReplayArtifacts): VerificationCheck {
  if (artifacts.analytics_inputs === undefined) return check("INCONCLUSIVE", ["analytics inputs are unavailable"]);
  const tradeIds = new Set(artifacts.trades.map((trade) => trade.trade_id));
  if (artifacts.analytics_inputs && typeof artifacts.analytics_inputs === "object" && !Array.isArray(artifacts.analytics_inputs)) {
    const referenced = (artifacts.analytics_inputs as { trade_ids?: unknown }).trade_ids;
    if (Array.isArray(referenced)) {
      const findings = referenced.filter((id): id is string => typeof id === "string" && !tradeIds.has(id)).map((id) => `analytics input references unknown trade ${id}`);
      return check(statusFromFindings(findings), findings);
    }
  }
  return check("PASS");
}

function combineStatus(checks: readonly VerificationCheck[], inconclusiveWhenEmpty: boolean): VerificationStatus {
  if (checks.some((item) => item.status === "FAIL")) return "FAIL";
  if (checks.some((item) => item.status === "UNAVAILABLE")) return "UNAVAILABLE";
  if (checks.some((item) => item.status === "INCONCLUSIVE") || inconclusiveWhenEmpty) return "INCONCLUSIVE";
  return "PASS";
}

export function verifyReplayArtifacts(identity: ReplayIdentity, artifacts: ReplayArtifacts): ReplayVerificationReport {
  const hashValidation = validateHashes(identity, artifacts);
  const journalValidation = validateJournal(artifacts);
  const lifecycleValidation = validateLifecycle(artifacts);
  const executionValidation = validateExecution(artifacts);
  const consistencyValidation = validateConsistency(identity, artifacts);
  const analyticsValidation = validateAnalytics(artifacts);
  const checks = [hashValidation, journalValidation, lifecycleValidation, executionValidation, consistencyValidation, analyticsValidation];
  const findings = checks.flatMap((item) => item.findings);
  const status = combineStatus(checks, artifacts.trades.length === 0 && artifacts.execution_events.length === 0 && artifacts.lifecycle_events.length === 0);
  return {
    status,
    replay_status: status,
    deterministic_status: "INCONCLUSIVE",
    replay_count: 1,
    replay_duration_ms: 0,
    hash_validation: hashValidation,
    journal_validation: journalValidation,
    lifecycle_validation: lifecycleValidation,
    execution_validation: executionValidation,
    consistency_validation: consistencyValidation,
    analytics_validation: analyticsValidation,
    findings,
    production_claim: "Production replay determinism is not verified until a production runner and real replay artifacts exist.",
    summary: status === "PASS" ? "Replay artifacts are internally consistent." : "Replay artifacts require further verification before institutional use."
  };
}

export function compareReplayArtifacts(first: ReplayArtifacts, second: ReplayArtifacts): ArtifactComparison {
  const findings: string[] = [];
  const compare = (label: string, left: unknown, right: unknown): void => { if (canonicalSerialize(left) !== canonicalSerialize(right)) findings.push(`${label} differs between replays`); };
  compare("trade IDs or trade records", first.trades, second.trades);
  compare("execution events", first.execution_events, second.execution_events);
  compare("lifecycle events", first.lifecycle_events, second.lifecycle_events);
  compare("analytics inputs", first.analytics_inputs, second.analytics_inputs);
  compare("replay output", first.replay_output, second.replay_output);
  compare("journal metadata", first.metadata, second.metadata);
  return { equal: findings.length === 0, findings };
}

export async function verifyReplayDeterminism(request: ReplayVerificationRequest): Promise<ReplayVerificationReport> {
  if (!request.runner) return createUnavailableReport(request);
  const repetitions = request.repetitions ?? 100;
  if (!Number.isInteger(repetitions) || repetitions < 2) throw new Error("repetitions must be an integer of at least two");
  const started = Date.now();
  let first: ReplayArtifacts;
  try {
    first = await request.runner.run(request.identity, request.dataset);
  } catch (error) {
    return createUnavailableReport(request, `replay runner failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  const base = verifyReplayArtifacts(request.identity, first);
  if (base.status === "FAIL") return { ...base, deterministic_status: "FAIL", replay_status: "FAIL", replay_duration_ms: Date.now() - started };
  for (let index = 1; index < repetitions; index += 1) {
    const current = await request.runner.run(request.identity, request.dataset);
    const comparison = compareReplayArtifacts(first, current);
    if (!comparison.equal) return {
      ...base,
      status: "FAIL",
      replay_status: "FAIL",
      deterministic_status: "FAIL",
      replay_count: index + 1,
      replay_duration_ms: Date.now() - started,
      first_mismatch: comparison.findings[0],
      findings: [...base.findings, ...comparison.findings],
      summary: "Deterministic replay verification failed."
    };
  }
  const deterministicStatus: VerificationStatus = base.status === "PASS" ? "PASS" : base.status;
  return { ...base, status: deterministicStatus, replay_status: deterministicStatus, deterministic_status: deterministicStatus, replay_count: repetitions, replay_duration_ms: Date.now() - started, summary: deterministicStatus === "PASS" ? `All ${repetitions} replay outputs matched exactly.` : base.summary };
}

export function createUnavailableReport(request: Pick<ReplayVerificationRequest, "identity">, reason = "production replay runner and artifacts are unavailable"): ReplayVerificationReport {
  const unavailable = check("UNAVAILABLE", [reason]);
  return {
    status: "UNAVAILABLE",
    replay_status: "UNAVAILABLE",
    deterministic_status: "UNAVAILABLE",
    replay_count: 0,
    replay_duration_ms: 0,
    hash_validation: unavailable,
    journal_validation: unavailable,
    lifecycle_validation: unavailable,
    execution_validation: unavailable,
    consistency_validation: unavailable,
    analytics_validation: unavailable,
    findings: [reason],
    production_claim: "Production replay determinism is not verified because the production replay runner and artifacts do not yet exist.",
    summary: "UNAVAILABLE: supply a production replay runner, frozen dataset, journals, trade records, and analytics inputs."
  };
}

export async function createReplayVerificationReport(request: ReplayVerificationRequest): Promise<ReplayVerificationReport> {
  return verifyReplayDeterminism(request);
}

export function renderReplayVerificationReport(report: ReplayVerificationReport): string {
  const row = (label: string, value: string): string => `| ${label} | ${value} |`;
  return [
    "# ATC Replay Verification Report",
    "",
    `**Status:** ${report.status}`,
    "",
    "This report verifies replay artifacts only. It does not execute or alter trading logic.",
    "",
    "## Verification Summary",
    "",
    "| Check | Result |",
    "|---|---|",
    row("Replay status", report.replay_status),
    row("Deterministic replay", report.deterministic_status),
    row("Replay count", String(report.replay_count)),
    row("Replay duration", `${report.replay_duration_ms} ms`),
    row("Hash validation", report.hash_validation.status),
    row("Journal validation", report.journal_validation.status),
    row("Lifecycle validation", report.lifecycle_validation.status),
    row("Execution validation", report.execution_validation.status),
    row("Consistency validation", report.consistency_validation.status),
    row("Analytics validation", report.analytics_validation.status),
    "",
    "## Findings",
    "",
    ...(report.findings.length === 0 ? ["No findings."] : report.findings.map((finding) => `- ${finding}`)),
    "",
    "## Production Claim",
    "",
    report.production_claim,
    "",
    report.summary,
    ""
  ].join("\n");
}
