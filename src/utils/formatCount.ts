export function formatCount(value: number | null | undefined): string {
  const count = Math.max(0, Number(value) || 0);
  if (count < 10_000) return count.toLocaleString("zh-CN");
  return formatUnit(count, 10_000, "w");
}

function formatUnit(count: number, unit: number, suffix: string): string {
  const scaled = count / unit;
  const precision = scaled < 10 ? 1 : 0;
  const formatted = Number(scaled.toFixed(precision));
  return `${formatted.toLocaleString("zh-CN")}${suffix}`;
}
