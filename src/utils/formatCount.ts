export function formatCount(value: number | null | undefined): string {
  const count = Math.max(0, Number(value) || 0);
  if (count < 10_000) return count.toLocaleString("zh-CN");
  if (count < 100_000_000) return formatUnit(count, 10_000, "w");
  return formatUnit(count, 100_000_000, "b");
}

function formatUnit(count: number, unit: number, suffix: string): string {
  const scaled = count / unit;
  const precision = scaled < 10 ? 1 : 0;
  const formatted = Number(scaled.toFixed(precision));
  return `${formatted.toLocaleString("zh-CN")}${suffix}`;
}
