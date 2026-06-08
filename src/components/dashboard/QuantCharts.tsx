"use client";

import type { MarketDataPoint } from "@/types/asset";
import type { BacktestSummary, DrawdownStats } from "@/types/quant";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { formatCurrency, formatPercent } from "./format";
import { movingAverage } from "@/lib/quant/momentum";

function chartData(points: MarketDataPoint[]) {
  return points.map((point, index) => {
    const closes = points.slice(0, index + 1).map((item) => item.close);
    return {
      date: point.date.slice(5),
      price: point.close,
      ma20: movingAverage(closes, 20),
      ma50: movingAverage(closes, 50),
      ma200: movingAverage(closes, 200)
    };
  });
}

export function PriceChart({ points }: { points: MarketDataPoint[] }) {
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData(points)}>
          <CartesianGrid stroke="rgba(72, 104, 160, 0.18)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: "#7f91ad", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={28} />
          <YAxis
            tick={{ fill: "#7f91ad", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            domain={["dataMin", "dataMax"]}
            tickFormatter={(value) => `$${Number(value).toLocaleString()}`}
          />
          <Tooltip
            contentStyle={{ background: "#0b1225", border: "1px solid #20304a", borderRadius: 8, color: "#fff" }}
            formatter={(value) => formatCurrency(Number(value))}
          />
          <Line type="monotone" dataKey="price" stroke="#18d3ff" strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="ma20" stroke="#35e58b" strokeWidth={1.2} dot={false} />
          <Line type="monotone" dataKey="ma50" stroke="#f5b94d" strokeWidth={1.2} dot={false} />
          <Line type="monotone" dataKey="ma200" stroke="#ff6262" strokeWidth={1.2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DrawdownChart({ drawdown }: { drawdown: DrawdownStats }) {
  const data = drawdown.series.map((point) => ({ date: point.date.slice(5), drawdown: point.drawdown }));
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="drawdownFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#ff6262" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#ff6262" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(72, 104, 160, 0.18)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: "#7f91ad", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={28} />
          <YAxis tickFormatter={(value) => `${(Number(value) * 100).toFixed(0)}%`} tick={{ fill: "#7f91ad", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: "#0b1225", border: "1px solid #20304a", borderRadius: 8, color: "#fff" }}
            formatter={(value) => formatPercent(Number(value), 2)}
          />
          <Area type="monotone" dataKey="drawdown" stroke="#ff6262" fill="url(#drawdownFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EquityCurveChart({ backtest }: { backtest: BacktestSummary }) {
  const data = backtest.equityCurve.map((point) => ({ date: point.date.slice(5), equity: point.equity }));
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="equityFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#2f6cff" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#2f6cff" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(72, 104, 160, 0.18)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: "#7f91ad", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={32} />
          <YAxis tick={{ fill: "#7f91ad", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`} />
          <Tooltip
            contentStyle={{ background: "#0b1225", border: "1px solid #20304a", borderRadius: 8, color: "#fff" }}
            formatter={(value) => formatCurrency(Number(value))}
          />
          <Area type="monotone" dataKey="equity" stroke="#2f6cff" fill="url(#equityFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
