"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { MarketDataset } from "@/types/asset";
import type { QuantAnalysis } from "@/types/quant";
import {
  calculateBenchmarks,
  runHistoricalDecisionReplay,
  runMonteCarloStressTest,
  simulatePaperPortfolio
} from "@/lib/quant/historicalReplay";
import { formatCurrency, formatNumber, formatPercent, formatRatio } from "./format";

function numberInput(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function HistoricalReplayPanel({ dataset, analysis }: { dataset: MarketDataset; analysis: QuantAnalysis }) {
  const replayCandles = analysis.dataRanges?.backtestCandles ?? dataset.prices;
  const firstDate = replayCandles[0]?.date ?? "";
  const lastDate = replayCandles.at(-1)?.date ?? "";
  const [symbols, setSymbols] = useState(dataset.overview.symbol);
  const [startDate, setStartDate] = useState(replayCandles[Math.max(0, replayCandles.length - 756)]?.date ?? firstDate);
  const [endDate, setEndDate] = useState(lastDate);
  const [startingCapital, setStartingCapital] = useState("100000");
  const [feeRate, setFeeRate] = useState("0.001");
  const [slippageRate, setSlippageRate] = useState("0.001");
  const [rebalanceDays, setRebalanceDays] = useState("21");
  const [simulations, setSimulations] = useState("1000");

  const replay = useMemo(() => {
    const rows = runHistoricalDecisionReplay({
      symbol: dataset.overview.symbol,
      assetType: dataset.overview.assetType,
      candles: replayCandles,
      startDate,
      endDate,
      rebalanceEveryDays: Math.max(1, Math.floor(numberInput(rebalanceDays, 21)))
    });
    const portfolio = simulatePaperPortfolio({
      symbol: dataset.overview.symbol,
      assetType: dataset.overview.assetType,
      candles: replayCandles,
      replayRows: rows,
      startingCapital: numberInput(startingCapital, 100000),
      feeRate: numberInput(feeRate, 0.001),
      slippageRate: numberInput(slippageRate, 0.001)
    });
    const benchmarks = calculateBenchmarks(
      [{ symbol: dataset.overview.symbol, assetType: dataset.overview.assetType, candles: replayCandles }],
      numberInput(startingCapital, 100000)
    );
    const monteCarlo = runMonteCarloStressTest(
      portfolio.trades.filter((trade) => trade.side === "SELL").map((trade) => trade.returnPct),
      {
        startingCapital: numberInput(startingCapital, 100000),
        simulations: Math.max(1, Math.floor(numberInput(simulations, 1000)))
      }
    );
    return { rows, portfolio, benchmarks, monteCarlo };
  }, [dataset.overview.assetType, dataset.overview.symbol, endDate, feeRate, rebalanceDays, replayCandles, simulations, slippageRate, startDate, startingCapital]);

  const equityData = replay.portfolio.equityCurve.map((point) => ({ date: point.date.slice(5), equity: point.equity }));
  const drawdownData = replay.portfolio.drawdownCurve.map((point) => ({ date: point.date.slice(5), drawdown: point.drawdown }));
  const recentDecisions = replay.rows.slice(-8).reverse();
  const recentTrades = replay.portfolio.trades.slice(-8).reverse();

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-line bg-white/[0.03] p-3 text-xs leading-5 text-slate-400">
        Historical replay uses past data and is not live paper trading. It is designed to test whether the system would have made
        consistent decisions using only information available at each date.
      </div>
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <label className="grid gap-1 text-xs text-slate-400">
          Symbols
          <input
            value={symbols}
            onChange={(event) => setSymbols(event.target.value)}
            className="rounded-md border border-line bg-[#0d1528] px-3 py-2 text-sm font-semibold text-white outline-none"
          />
        </label>
        <label className="grid gap-1 text-xs text-slate-400">
          Start date
          <input
            type="date"
            value={startDate}
            min={firstDate}
            max={lastDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="rounded-md border border-line bg-[#0d1528] px-3 py-2 text-sm font-semibold text-white outline-none"
          />
        </label>
        <label className="grid gap-1 text-xs text-slate-400">
          End date
          <input
            type="date"
            value={endDate}
            min={firstDate}
            max={lastDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="rounded-md border border-line bg-[#0d1528] px-3 py-2 text-sm font-semibold text-white outline-none"
          />
        </label>
        <label className="grid gap-1 text-xs text-slate-400">
          Capital
          <input
            value={startingCapital}
            onChange={(event) => setStartingCapital(event.target.value)}
            className="rounded-md border border-line bg-[#0d1528] px-3 py-2 text-sm font-semibold text-white outline-none"
          />
        </label>
        <label className="grid gap-1 text-xs text-slate-400">
          Fees / slippage
          <input
            value={`${feeRate}/${slippageRate}`}
            onChange={(event) => {
              const [fee, slip] = event.target.value.split("/");
              setFeeRate(fee ?? "0.001");
              setSlippageRate(slip ?? fee ?? "0.001");
            }}
            className="rounded-md border border-line bg-[#0d1528] px-3 py-2 text-sm font-semibold text-white outline-none"
          />
        </label>
        <label className="grid gap-1 text-xs text-slate-400">
          Rebalance days
          <input
            value={rebalanceDays}
            onChange={(event) => setRebalanceDays(event.target.value)}
            className="rounded-md border border-line bg-[#0d1528] px-3 py-2 text-sm font-semibold text-white outline-none"
          />
        </label>
      </div>
      {symbols.trim().toUpperCase() !== dataset.overview.symbol.toUpperCase() && (
        <div className="rounded-md border border-amber/30 bg-amber/10 p-3 text-xs leading-5 text-slate-300">
          This report section uses the currently loaded dataset: {dataset.overview.symbol}. Load another asset from the main search to replay it.
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {[
          ["Total return", formatPercent(replay.portfolio.totalReturn, 2)],
          ["Max drawdown", formatPercent(replay.portfolio.maxDrawdown, 2)],
          ["Sharpe", formatRatio(replay.portfolio.sharpeRatio, { meaningfulAbsLimit: 10 })],
          ["Trades", formatNumber(replay.portfolio.totalTrades)],
          ["Avg allocation", formatPercent(replay.portfolio.averageAllocation, 2)],
          ["Ending equity", formatCurrency(replay.portfolio.endingEquity)]
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-line bg-white/[0.03] p-3">
            <p className="text-xs text-slate-400">{label}</p>
            <p className="mt-1 font-bold text-white">{value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-normal text-cyan">Replay equity curve</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityData}>
                <CartesianGrid stroke="rgba(72, 104, 160, 0.18)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#7f91ad", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={30} />
                <YAxis tick={{ fill: "#7f91ad", fontSize: 11 }} tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`} />
                <Tooltip contentStyle={{ background: "#0b1225", border: "1px solid #20304a", borderRadius: 8 }} formatter={(value) => formatCurrency(Number(value))} />
                <Area type="monotone" dataKey="equity" stroke="#2f6cff" fill="#2f6cff33" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-normal text-cyan">Replay drawdown</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={drawdownData}>
                <CartesianGrid stroke="rgba(72, 104, 160, 0.18)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#7f91ad", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={30} />
                <YAxis tick={{ fill: "#7f91ad", fontSize: 11 }} tickFormatter={(value) => formatPercent(Number(value), 0)} />
                <Tooltip contentStyle={{ background: "#0b1225", border: "1px solid #20304a", borderRadius: 8 }} formatter={(value) => formatPercent(Number(value), 2)} />
                <Area type="monotone" dataKey="drawdown" stroke="#ff6262" fill="#ff626233" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-md border border-line bg-white/[0.03] p-3">
          <p className="text-sm font-bold text-white">Benchmark comparison</p>
          <p className="mt-2 text-xs text-slate-400">
            Buy and hold {dataset.overview.symbol}: {formatPercent(replay.benchmarks.buyAndHold[0]?.totalReturn ?? 0, 2)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Equal-weight portfolio: {formatPercent(replay.benchmarks.equalWeightPortfolio?.totalReturn ?? 0, 2)}
          </p>
        </div>
        <div className="rounded-md border border-line bg-white/[0.03] p-3">
          <p className="text-sm font-bold text-white">Monte Carlo stress</p>
          <p className="mt-2 text-xs text-slate-400">Median ending equity {formatCurrency(replay.monteCarlo.medianEndingEquity)}</p>
          <p className="mt-1 text-xs text-slate-400">5th percentile {formatCurrency(replay.monteCarlo.percentile5EndingEquity)}</p>
          <p className="mt-1 text-xs text-slate-400">Worst simulated drawdown {formatPercent(replay.monteCarlo.worstSimulatedDrawdown, 2)}</p>
        </div>
        <div className="rounded-md border border-line bg-white/[0.03] p-3">
          <p className="text-sm font-bold text-white">Monthly extremes</p>
          <p className="mt-2 text-xs text-slate-400">
            Best month {replay.portfolio.bestMonth?.month ?? "n/a"} {formatPercent(replay.portfolio.bestMonth?.returnPct ?? 0, 2)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Worst month {replay.portfolio.worstMonth?.month ?? "n/a"} {formatPercent(replay.portfolio.worstMonth?.returnPct ?? 0, 2)}
          </p>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-md border border-line bg-white/[0.03] p-3">
          <p className="text-sm font-bold text-white">Decision log</p>
          <div className="mt-3 grid gap-2 text-xs text-slate-400">
            {recentDecisions.map((row) => (
              <div key={`${row.date}-${row.finalDecision}`} className="grid grid-cols-[90px_1fr_80px] gap-2">
                <span>{row.date}</span>
                <span>{row.finalDecision}</span>
                <span>{formatPercent(row.activeAllocation, 2)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-md border border-line bg-white/[0.03] p-3">
          <p className="text-sm font-bold text-white">Trade log</p>
          <div className="mt-3 grid gap-2 text-xs text-slate-400">
            {recentTrades.map((trade, index) => (
              <div key={`${trade.executionDate}-${trade.side}-${index}`} className="grid grid-cols-[90px_50px_1fr_90px] gap-2">
                <span>{trade.executionDate}</span>
                <span>{trade.side}</span>
                <span>{trade.decision}</span>
                <span>{formatCurrency(trade.grossNotional)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
