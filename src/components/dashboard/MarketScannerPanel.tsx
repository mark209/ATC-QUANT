"use client";

import { useState } from "react";
import { Radar, RefreshCw, Search } from "lucide-react";
import type { AssetType, RiskProfile } from "@/types/asset";
import type { MarketScanResponse, ScanUniverse } from "@/lib/data/marketScanner";
import { formatNumber, formatPercent } from "./format";

interface MarketScannerPanelProps {
  riskProfile: RiskProfile;
  onSelectCandidate: (symbol: string, assetType: AssetType) => void;
}

const universeLabels: Array<{ value: ScanUniverse; label: string }> = [
  { value: "mixed", label: "Mixed" },
  { value: "stocks", label: "Stocks" },
  { value: "etfs", label: "ETFs" },
  { value: "crypto", label: "Crypto" },
  { value: "indexes", label: "Indexes" }
];

function decisionClass(label: string): string {
  if (label === "Strong candidate" || label === "Position allowed") return "border-mint/40 bg-mint/10 text-mint";
  if (label === "Small allocation only" || label === "Watchlist only") return "border-amber/40 bg-amber/10 text-amber";
  return "border-danger/40 bg-danger/10 text-danger";
}

export function MarketScannerPanel({ riskProfile, onSelectCandidate }: MarketScannerPanelProps) {
  const [universe, setUniverse] = useState<ScanUniverse>("mixed");
  const [limit, setLimit] = useState(8);
  const [scan, setScan] = useState<MarketScanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runScan() {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ universe, riskProfile, limit: String(limit) });
    try {
      const response = await fetch(`/api/market-scan?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Market scanner failed.");
      setScan(payload as MarketScanResponse);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Market scanner failed.");
      setScan(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg border border-cyan/40 bg-cyan/10 text-cyan">
            <Radar size={20} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Research scanner</p>
            <p className="text-xs leading-5 text-slate-500">
              Finds assets with positive final-decision output from the existing validation engine.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[150px_120px_auto]">
          <select
            value={universe}
            onChange={(event) => setUniverse(event.target.value as ScanUniverse)}
            className="rounded-lg border border-line bg-[#0d1528] px-3 py-2 text-sm font-semibold text-white outline-none"
          >
            {universeLabels.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value))}
            className="rounded-lg border border-line bg-[#0d1528] px-3 py-2 text-sm font-semibold text-white outline-none"
          >
            <option value={5}>5 assets</option>
            <option value={8}>8 assets</option>
            <option value={12}>12 assets</option>
          </select>
          <button
            onClick={runScan}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-electric px-4 py-2 text-sm font-bold text-white shadow-glow disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
            Scan
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {scan && (
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-line bg-white/[0.03] p-4">
              <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Scanned</p>
              <p className="mt-2 text-2xl font-black text-white">{scan.scannedCount}</p>
            </div>
            <div className="rounded-lg border border-line bg-white/[0.03] p-4">
              <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Candidate Count</p>
              <p className="mt-2 text-2xl font-black text-mint">{scan.investableCandidates.length}</p>
            </div>
            <div className="rounded-lg border border-line bg-white/[0.03] p-4">
              <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Risk Profile</p>
              <p className="mt-2 text-2xl font-black capitalize text-white">{scan.riskProfile}</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead className="bg-white/[0.04] text-xs uppercase tracking-normal text-slate-500">
                <tr>
                  <th className="px-3 py-3">Asset</th>
                  <th className="px-3 py-3">Decision</th>
                  <th className="px-3 py-3">Score</th>
                  <th className="px-3 py-3">Size</th>
                  <th className="px-3 py-3">EV After Costs</th>
                  <th className="px-3 py-3">Validation</th>
                  <th className="px-3 py-3">Limiter</th>
                  <th className="px-3 py-3">Review</th>
                </tr>
              </thead>
              <tbody>
                {scan.candidates.map((candidate) => (
                  <tr key={`${candidate.assetType}-${candidate.symbol}`} className="border-t border-line">
                    <td className="px-3 py-3">
                      <p className="font-bold text-white">{candidate.symbol}</p>
                      <p className="text-xs text-slate-500">{candidate.assetType.toUpperCase()}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${decisionClass(candidate.decisionLabel)}`}>
                        {candidate.decisionLabel}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-semibold text-white">{formatNumber(candidate.finalScore)}</td>
                    <td className="px-3 py-3 font-semibold text-white">{formatPercent(candidate.finalPositionSize)}</td>
                    <td className="px-3 py-3 font-semibold text-white">{formatPercent(candidate.expectedValueAfterCosts, 2)}</td>
                    <td className="px-3 py-3 text-slate-300">{candidate.validationLabel}</td>
                    <td className="px-3 py-3 text-slate-300">{candidate.limitingFactor}</td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => onSelectCandidate(candidate.symbol, candidate.assetType)}
                        className="rounded-lg border border-line bg-white/[0.04] px-3 py-2 text-xs font-bold text-white"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-2 text-xs leading-5 text-slate-500">
            {scan.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
