export function movingAverage(values: number[], window: number): number | null {
  if (values.length < window) return null;
  const slice = values.slice(-window);
  return slice.reduce((sum, value) => sum + value, 0) / window;
}

export function momentum(values: number[], periods: number): number {
  if (values.length <= periods) return 0;
  const current = values.at(-1) ?? 0;
  const past = values[values.length - 1 - periods];
  return past === 0 ? 0 : current / past - 1;
}

export function zScore(values: number[], window = 50): number {
  if (values.length < window) return 0;
  const slice = values.slice(-window);
  const average = slice.reduce((sum, value) => sum + value, 0) / slice.length;
  const variance = slice.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / slice.length;
  const deviation = Math.sqrt(variance);
  return deviation === 0 ? 0 : ((values.at(-1) ?? average) - average) / deviation;
}
