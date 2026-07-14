import type { AssetType } from "@/types/asset";

export type SessionType = "CRYPTO_24_7" | "US_EQUITY" | "FOREX" | "FUTURES" | "UNKNOWN";
export type AssetClass = "crypto" | "us_equity" | "forex" | "futures" | "unknown";

export interface MarketSessionModel {
  asset_class: AssetClass;
  exchange: string;
  timezone: string;
  trading_calendar: string;
  session_type: SessionType;
  expected_session_frequency: string;
}

export interface SessionValidationReport {
  session_model: MarketSessionModel;
  valid: boolean;
  accepted_gaps: number;
  rejected_gaps: number;
  weekend_gaps: number;
  holiday_gaps: number;
  unexpected_missing_sessions: number;
  duplicate_sessions: number;
  out_of_session_bars: number;
  accepted_gap_details: string[];
  rejected_gap_details: string[];
  errors: string[];
}

export interface SessionCandle {
  timestamp: number;
  date: string;
}

export function sessionModelForAssetType(assetType: AssetType | "forex" | "futures" | undefined, exchange = ""): MarketSessionModel {
  if (assetType === "crypto") return { asset_class: "crypto", exchange: exchange || "24/7", timezone: "UTC", trading_calendar: "24/7", session_type: "CRYPTO_24_7", expected_session_frequency: "continuous 24-hour intervals" };
  if (assetType === "stock" || assetType === "etf" || exchange.toUpperCase().includes("NYSE") || exchange.toUpperCase().includes("NASDAQ") || exchange.toUpperCase().includes("ARCA")) {
    const normalizedExchange = exchange.toUpperCase().includes("NASDAQ") ? "NASDAQ" : exchange || "NYSE";
    return { asset_class: "us_equity", exchange: normalizedExchange, timezone: "America/New_York", trading_calendar: normalizedExchange === "NASDAQ" ? "NASDAQ" : "NYSE", session_type: "US_EQUITY", expected_session_frequency: "one trading session per weekday" };
  }
  if (assetType === "forex") return { asset_class: "forex", exchange: exchange || "OTC_FOREX", timezone: "UTC", trading_calendar: "FOREX_24_5", session_type: "FOREX", expected_session_frequency: "one session per weekday" };
  if (assetType === "index") return { asset_class: "unknown", exchange: exchange || "UNKNOWN", timezone: "UTC", trading_calendar: "UNKNOWN", session_type: "UNKNOWN", expected_session_frequency: "declared by provider" };
  return { asset_class: "unknown", exchange: exchange || "UNKNOWN", timezone: "UTC", trading_calendar: "UNKNOWN", session_type: "UNKNOWN", expected_session_frequency: "declared by provider" };
}

export function resolveSessionModel(dataset: { asset_class?: AssetClass; exchange?: string; timezone?: string; trading_calendar?: string; calendar?: string; session_type?: SessionType; session_model?: SessionType; expected_session_frequency?: string; asset_type?: AssetType }): MarketSessionModel {
  if (dataset.session_type || dataset.session_model || dataset.trading_calendar || dataset.calendar || dataset.asset_class) {
    const inferred = sessionModelForAssetType(dataset.asset_type, dataset.exchange);
    return {
      asset_class: dataset.asset_class ?? inferred.asset_class,
      exchange: dataset.exchange ?? inferred.exchange,
      timezone: dataset.timezone ?? inferred.timezone,
      trading_calendar: dataset.trading_calendar ?? dataset.calendar ?? inferred.trading_calendar,
      session_type: dataset.session_type ?? dataset.session_model ?? inferred.session_type,
      expected_session_frequency: dataset.expected_session_frequency ?? inferred.expected_session_frequency
    };
  }
  if (dataset.asset_type === "crypto") return sessionModelForAssetType(dataset.asset_type, dataset.exchange);
  return { asset_class: "unknown", exchange: dataset.exchange ?? "UNKNOWN", timezone: dataset.timezone ?? "UTC", trading_calendar: "LEGACY_CONTINUOUS", session_type: "UNKNOWN", expected_session_frequency: "legacy continuous interval" };
}

function formatDate(timestamp: number, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function weekday(date: string): number { return new Date(`${date}T12:00:00.000Z`).getUTCDay(); }

function nthWeekday(year: number, month: number, day: number, occurrence: number): string {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (day - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month - 1, 1 + offset + (occurrence - 1) * 7)).toISOString().slice(0, 10);
}

function lastWeekday(year: number, month: number, day: number): string {
  const last = new Date(Date.UTC(year, month, 0));
  const offset = (last.getUTCDay() - day + 7) % 7;
  last.setUTCDate(last.getUTCDate() - offset);
  return last.toISOString().slice(0, 10);
}

function observedFixedHoliday(year: number, month: number, day: number): string {
  const value = new Date(Date.UTC(year, month - 1, day));
  const weekdayValue = value.getUTCDay();
  if (weekdayValue === 6) value.setUTCDate(value.getUTCDate() - 1);
  if (weekdayValue === 0) value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

export function usExchangeHolidays(year: number): Set<string> {
  const easter = new Date(`${easterSunday(year)}T12:00:00.000Z`);
  easter.setUTCDate(easter.getUTCDate() - 2);
  return new Set([
    observedFixedHoliday(year, 1, 1),
    nthWeekday(year, 1, 1, 3),
    nthWeekday(year, 2, 1, 3),
    easter.toISOString().slice(0, 10),
    lastWeekday(year, 5, 1),
    ...(year >= 2022 ? [observedFixedHoliday(year, 6, 19)] : []),
    observedFixedHoliday(year, 7, 4),
    nthWeekday(year, 9, 1, 1),
    nthWeekday(year, 11, 4, 4),
    observedFixedHoliday(year, 12, 25)
  ]);
}

function isUsHoliday(date: string): boolean { return usExchangeHolidays(Number(date.slice(0, 4))).has(date); }
function isWeekend(date: string): boolean { const day = weekday(date); return day === 0 || day === 6; }
function expectedUsSession(date: string): boolean { return !isWeekend(date) && !isUsHoliday(date); }

export function validateSessionProgression(candles: readonly SessionCandle[], model: MarketSessionModel): SessionValidationReport {
  const acceptedGapDetails: string[] = [];
  const rejectedGapDetails: string[] = [];
  const errors: string[] = [];
  let acceptedGaps = 0;
  let rejectedGaps = 0;
  let weekendGaps = 0;
  let holidayGaps = 0;
  let unexpectedMissingSessions = 0;
  let duplicateSessions = 0;
  let outOfSessionBars = 0;
  let outOfOrderTimestamps = 0;
  const sessionDates = new Set<string>();
  const timestamps = candles.map((candle) => candle.timestamp);
  for (let index = 1; index < timestamps.length; index += 1) if (timestamps[index] < timestamps[index - 1]) outOfOrderTimestamps += 1;

  for (const candle of candles) {
    const date = formatDate(candle.timestamp, model.timezone);
    if (sessionDates.has(date)) duplicateSessions += 1;
    sessionDates.add(date);
    if (model.session_type === "US_EQUITY" && !expectedUsSession(date)) outOfSessionBars += 1;
    if (model.session_type === "FOREX" && isWeekend(date)) outOfSessionBars += 1;
  }

  for (let index = 1; index < candles.length; index += 1) {
    const previousDate = formatDate(candles[index - 1].timestamp, model.timezone);
    const currentDate = formatDate(candles[index].timestamp, model.timezone);
    if (currentDate <= previousDate) continue;
    let date = addDays(previousDate, 1);
    const missing: string[] = [];
    const accepted: string[] = [];
    while (date < currentDate) {
      if (model.session_type === "CRYPTO_24_7" || model.session_type === "UNKNOWN") missing.push(date);
      else if (model.session_type === "US_EQUITY") {
        if (isWeekend(date)) accepted.push(date);
        else if (isUsHoliday(date)) accepted.push(date);
        else missing.push(date);
      } else if (model.session_type === "FOREX") {
        if (isWeekend(date)) accepted.push(date);
        else missing.push(date);
      } else if (model.session_type === "FUTURES") {
        if (isWeekend(date)) accepted.push(date);
        else missing.push(date);
      }
      date = addDays(date, 1);
    }
    if (accepted.length) {
      acceptedGaps += accepted.length;
      weekendGaps += accepted.filter(isWeekend).length;
      holidayGaps += accepted.filter(isUsHoliday).length;
      if (acceptedGapDetails.length < 20) acceptedGapDetails.push(`${previousDate} -> ${currentDate}: accepted ${accepted.join(", ")}`);
    }
    if (missing.length) {
      rejectedGaps += missing.length;
      unexpectedMissingSessions += missing.length;
      if (rejectedGapDetails.length < 20) rejectedGapDetails.push(`${previousDate} -> ${currentDate}: missing ${missing.slice(0, 8).join(", ")}`);
    }
  }

  if (duplicateSessions) errors.push(`duplicate sessions: ${duplicateSessions}`);
  if (outOfOrderTimestamps) errors.push(`out-of-order timestamps: ${outOfOrderTimestamps}`);
  if (outOfSessionBars) errors.push(`out-of-session bars: ${outOfSessionBars}`);
  if (rejectedGaps) errors.push(`unexpected missing sessions: ${rejectedGaps}`);
  const exactIntervalErrors = model.session_type === "CRYPTO_24_7" || model.session_type === "UNKNOWN" ? timestamps.slice(1).filter((timestamp, index) => timestamp - timestamps[index] !== 86_400_000).length : 0;
  if (exactIntervalErrors) errors.push(`invalid continuous interval progression: ${exactIntervalErrors}`);
  return { session_model: model, valid: errors.length === 0, accepted_gaps: acceptedGaps, rejected_gaps: rejectedGaps, weekend_gaps: weekendGaps, holiday_gaps: holidayGaps, unexpected_missing_sessions: unexpectedMissingSessions, duplicate_sessions: duplicateSessions, out_of_session_bars: outOfSessionBars, accepted_gap_details: acceptedGapDetails, rejected_gap_details: rejectedGapDetails, errors };
}
