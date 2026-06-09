"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, BarChart3, Download, RefreshCw, Search, ShieldCheck } from "lucide-react";
import type { AssetType, MarketDataset, RiskProfile, Timeframe } from "@/types/asset";
import type { QuantAnalysis } from "@/types/quant";
import { AssetOverview } from "./AssetOverview";
import { BacktestPanel } from "./BacktestPanel";
import { DrawdownChart, PriceChart } from "./QuantCharts";
import { ExplanationPanel } from "./ExplanationPanel";
import { Panel } from "./Panel";
import { PipelineStatusPanel } from "./PipelineStatusPanel";
import { PositionSizingCard } from "./PositionSizingCard";
import { RiskMetricsTable } from "./RiskMetricsTable";
import { ScoreCard } from "./ScoreCard";
import { ScoreBreakdown } from "./ScoreBreakdown";
import { SignalBreakdown } from "./SignalBreakdown";
import { MarketScannerPanel } from "./MarketScannerPanel";
import { OptimalEntryZonePanel } from "./OptimalEntryZonePanel";
import { generateInvestorReport } from "@/lib/reports/reportGenerator";

interface ApiResponse {
  live: boolean;
  dataset?: MarketDataset;
  analysis?: QuantAnalysis;
  error?: string;
  sourcePolicy?: string;
}

const defaults: Record<AssetType, string> = {
  crypto: "BTCUSDT",
  stock: "AAPL",
  etf: "SPY",
  index: "^GSPC"
};

function timeframeLimit(timeframe: Timeframe): number | null {
  if (timeframe === "1y") return 365;
  if (timeframe === "3y") return 365 * 3;
  if (timeframe === "5y") return 365 * 5;
  if (timeframe === "10y") return 365 * 10;
  return null;
}

function timeframeLabel(timeframe: Timeframe): string {
  if (timeframe === "max") return "Max";
  return timeframe.toUpperCase();
}

export function QuantDashboard({ initialData }: { initialData?: ApiResponse }) {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [submittedSymbol, setSubmittedSymbol] = useState("BTCUSDT");
  const [assetType, setAssetType] = useState<AssetType>("crypto");
  const [riskProfile, setRiskProfile] = useState<RiskProfile>("balanced");
  const [timeframe, setTimeframe] = useState<Timeframe>("1y");
  const [data, setData] = useState<ApiResponse | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const hasHydratedInitialData = useRef(Boolean(initialData));

  useEffect(() => {
    if (hasHydratedInitialData.current) {
      hasHydratedInitialData.current = false;
      return;
    }
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      const params = new URLSearchParams({ symbol: submittedSymbol, assetType, riskProfile });
      try {
        const response = await fetch(`/api/market-data?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store"
        });
        const payload = (await response.json()) as ApiResponse;
        setData(payload);
      } catch (error) {
        if (!controller.signal.aborted) {
          setData({
            live: false,
            error: error instanceof Error ? error.message : "Live market request failed.",
            sourcePolicy: "No mock market data is substituted when a live provider fails."
          });
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [assetType, riskProfile, submittedSymbol]);

  const visibleDataset = useMemo(() => {
    if (!data?.dataset) return null;
    const limit = timeframeLimit(timeframe);
    return {
      ...data.dataset,
      prices: limit === null ? data.dataset.prices : data.dataset.prices.slice(-limit)
    };
  }, [data?.dataset, timeframe]);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedSymbol(symbol);
  }

  function updateAssetType(nextType: AssetType) {
    setAssetType(nextType);
    setSymbol(defaults[nextType]);
    setSubmittedSymbol(defaults[nextType]);
  }

  function openScannerCandidate(nextSymbol: string, nextAssetType: AssetType) {
    setAssetType(nextAssetType);
    setSymbol(nextSymbol);
    setSubmittedSymbol(nextSymbol);
  }

  function exportReport() {
    if (!data?.dataset || !data.analysis) return;
    const report = generateInvestorReport(data.dataset, data.analysis);
    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ATC-QuantEdge-${data.dataset.overview.symbol}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen terminal-grid px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-5 flex flex-col gap-4 rounded-lg border border-line bg-[#090f20]/90 p-4 shadow-terminal lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg border border-electric/50 bg-electric/15 text-cyan">
              <Activity size={22} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-normal text-slate-400">Institutional Quant Research</p>
              <h1 className="text-2xl font-black text-white">ATC QuantEdge</h1>
            </div>
          </div>

          <form onSubmit={submitSearch} className="grid gap-3 lg:grid-cols-[minmax(220px,320px)_150px_150px_150px_auto]">
            <label className="flex items-center gap-2 rounded-lg border border-line bg-white/[0.04] px-3 py-2">
              <Search size={18} className="text-slate-500" />
              <input
                value={symbol}
                onChange={(event) => setSymbol(event.target.value)}
                className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-600"
                placeholder="BTCUSDT"
              />
            </label>
            <select
              value={assetType}
              onChange={(event) => updateAssetType(event.target.value as AssetType)}
              className="rounded-lg border border-line bg-[#0d1528] px-3 py-2 text-sm font-semibold text-white outline-none"
            >
              <option value="crypto">Crypto</option>
              <option value="stock">Stock</option>
              <option value="etf">ETF</option>
              <option value="index">Index</option>
            </select>
            <select
              value={timeframe}
              onChange={(event) => setTimeframe(event.target.value as Timeframe)}
              className="rounded-lg border border-line bg-[#0d1528] px-3 py-2 text-sm font-semibold text-white outline-none"
            >
              <option value="1y">1Y</option>
              <option value="3y">3Y</option>
              <option value="5y">5Y</option>
              <option value="10y">10Y</option>
              <option value="max">Max</option>
            </select>
            <select
              value={riskProfile}
              onChange={(event) => setRiskProfile(event.target.value as RiskProfile)}
              className="rounded-lg border border-line bg-[#0d1528] px-3 py-2 text-sm font-semibold text-white outline-none"
            >
              <option value="conservative">Conservative</option>
              <option value="balanced">Balanced</option>
              <option value="aggressive">Aggressive</option>
            </select>
            <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-electric px-4 py-2 text-sm font-bold text-white shadow-glow">
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Run
            </button>
          </form>
        </header>

        {loading && (
          <section className="panel-frame grid min-h-[420px] place-items-center rounded-lg">
            <div className="text-center">
              <RefreshCw className="mx-auto animate-spin text-cyan" size={34} />
              <p className="mt-4 text-sm font-semibold uppercase tracking-normal text-slate-400">Loading live market data</p>
            </div>
          </section>
        )}

        {!loading && data?.error && (
          <section className="panel-frame rounded-lg p-8">
            <div className="flex items-start gap-4">
              <ShieldCheck className="mt-1 text-amber" size={28} />
              <div>
                <h2 className="text-2xl font-black text-white">Live provider unavailable</h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{data.error}</p>
                <p className="mt-2 text-sm text-slate-500">{data.sourcePolicy}</p>
              </div>
            </div>
          </section>
        )}

        {!loading && data?.dataset && data.analysis && visibleDataset && (
          <div className="grid gap-5">
            {timeframe === "max" && (
              <section className="rounded-lg border border-amber/30 bg-amber/10 p-4 text-sm leading-6 text-slate-200">
                Max history is useful for context, but may include structural regime shifts, stock splits, and old market conditions. Current decision uses recent configured lookbacks.
              </section>
            )}

            <section className="grid gap-3 rounded-lg border border-line bg-[#090f20]/90 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-slate-500">Chart range</p>
                <p className="mt-1 text-sm font-bold text-white">{timeframeLabel(timeframe)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Current signal range</p>
                <p className="mt-1 text-sm font-bold text-white">{data.analysis.rangeUsage.currentSignal}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Backtest range</p>
                <p className="mt-1 text-sm font-bold text-white">{data.analysis.rangeUsage.backtest}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Validation range</p>
                <p className="mt-1 text-sm font-bold text-white">{data.analysis.rangeUsage.validation}</p>
              </div>
            </section>

            <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <AssetOverview overview={data.dataset.overview} />
              <ScoreCard analysis={data.analysis} />
            </div>

            <Panel title="Market Scanner">
              <MarketScannerPanel riskProfile={riskProfile} onSelectCandidate={openScannerCandidate} />
            </Panel>

            <Panel title="Decision Pipeline">
              <PipelineStatusPanel analysis={data.analysis} />
            </Panel>

            <Panel title="Optimal Entry Zone">
              <OptimalEntryZonePanel result={data.analysis.optimalEntryZone} />
            </Panel>

            <div className="grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
              <Panel
                title="Price Trend"
                action={<span className="text-xs text-slate-500">20D / 50D / 200D moving averages</span>}
              >
                <PriceChart points={visibleDataset.prices} />
              </Panel>
              <Panel title="Explanation">
                <ExplanationPanel analysis={data.analysis} />
              </Panel>
            </div>

            <Panel title="Score Breakdown">
              <ScoreBreakdown analysis={data.analysis} />
            </Panel>

            <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <Panel title="Risk Diagnostics">
                <RiskMetricsTable metrics={data.analysis.riskMetrics} />
              </Panel>
              <Panel title="Strategy Signal Breakdown">
                <SignalBreakdown signals={data.analysis.investability.signals} />
              </Panel>
            </div>

            <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
              <Panel title="Sizing Breakdown">
                <PositionSizingCard sizing={data.analysis.positionSizing} />
              </Panel>
              <Panel title="Drawdown Control">
                <DrawdownChart drawdown={data.analysis.drawdown} />
              </Panel>
            </div>

            <Panel
              title="Backtest Diagnostics"
              action={
                <button
                  onClick={exportReport}
                  className="inline-flex items-center gap-2 rounded-lg border border-line bg-white/[0.04] px-3 py-2 text-xs font-bold text-white"
                >
                  <Download size={15} />
                  Export Report
                </button>
              }
            >
              <BacktestPanel
                backtest={data.analysis.backtest}
                allocationAdjustedBacktest={data.analysis.allocationAdjustedBacktest}
                validation={data.analysis.pipeline.validation}
                dataQuality={data.analysis.pipeline.dataQuality}
                entryZoneAblation={data.analysis.entryZoneAblation}
              />
            </Panel>

            <section className="rounded-lg border border-line bg-[#090f20]/90 p-4">
              <div className="flex items-start gap-3">
                <BarChart3 className="mt-1 text-cyan" size={20} />
                <div>
                  <p className="text-sm font-bold text-slate-100">Backtest assumptions</p>
                  <div className="mt-2 grid gap-2 text-xs leading-5 text-slate-500 md:grid-cols-2">
                    {data.analysis.assumptions.map((assumption) => (
                      <p key={assumption}>{assumption}</p>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-line bg-[#090f20]/90 p-4 text-xs leading-5 text-slate-500">
              This is a research and risk-analysis tool, not financial advice. The system does not guarantee returns.
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
