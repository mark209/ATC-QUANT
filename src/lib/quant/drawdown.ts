import type { DrawdownStats } from "@/types/quant";

export function calculateDrawdowns(values: Array<{ date: string; value: number }>): DrawdownStats {
  let peak = values[0]?.value ?? 1;
  let currentDuration = 0;
  let maxDuration = 0;
  let recoveryTime: number | null = null;

  const series = values.map((point) => {
    if (point.value >= peak) {
      if (currentDuration > 0) recoveryTime = currentDuration;
      peak = point.value;
      currentDuration = 0;
    } else {
      currentDuration += 1;
      maxDuration = Math.max(maxDuration, currentDuration);
    }

    return {
      date: point.date,
      drawdown: peak === 0 ? 0 : (point.value - peak) / peak
    };
  });

  const drawdowns = series.map((point) => point.drawdown);
  const negativeDrawdowns = drawdowns.filter((value) => value < 0);

  return {
    currentDrawdown: drawdowns.at(-1) ?? 0,
    maxDrawdown: Math.min(0, ...drawdowns),
    averageDrawdown:
      negativeDrawdowns.length === 0
        ? 0
        : negativeDrawdowns.reduce((sum, value) => sum + value, 0) / negativeDrawdowns.length,
    maxDuration,
    recoveryTime,
    series
  };
}
