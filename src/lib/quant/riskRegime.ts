import type { AssetType } from "@/types/asset";

export function periodsPerYear(assetType: AssetType): number {
  return assetType === "crypto" ? 365 : 252;
}

export function volatilityRegime(volatility: number, assetType: AssetType): string {
  const limits = assetType === "crypto" ? [0.35, 0.65, 1.0] : [0.12, 0.25, 0.4];
  if (volatility <= limits[0]) return "Low volatility";
  if (volatility <= limits[1]) return "Normal volatility";
  if (volatility <= limits[2]) return "Elevated volatility";
  return "Extreme volatility";
}

export function drawdownRiskMode(currentDrawdown: number, assetType: AssetType): { mode: string; adjustment: number } {
  const dd = Math.abs(currentDrawdown);
  if (assetType === "crypto") {
    if (dd <= 0.08) return { mode: "Normal crypto risk", adjustment: 1 };
    if (dd <= 0.15) return { mode: "Caution", adjustment: 0.65 };
    if (dd <= 0.25) return { mode: "Defensive", adjustment: 0.4 };
    return { mode: "Risk-off", adjustment: 0 };
  }

  if (dd <= 0.05) return { mode: "Normal risk", adjustment: 1 };
  if (dd <= 0.1) return { mode: "Caution", adjustment: 0.75 };
  if (dd <= 0.15) return { mode: "Defensive", adjustment: 0.5 };
  return { mode: "Risk-off", adjustment: 0 };
}
