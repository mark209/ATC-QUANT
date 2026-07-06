export function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value > 1000 ? 0 : 2
  }).format(value);
}

export function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "n/a";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Math.abs(value) > 100 ? 0 : 2
  }).format(value);
}

export function formatRatio(value: number, options: { meaningfulAbsLimit?: number } = {}): string {
  if (!Number.isFinite(value)) return "Not meaningful";
  const limit = options.meaningfulAbsLimit;
  if (typeof limit === "number" && Math.abs(value) >= limit) return "Not meaningful";
  return formatNumber(value);
}

export function compactNumber(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}
