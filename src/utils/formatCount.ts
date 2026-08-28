export function formatCount(value: number | null | undefined): string {
  const count = Math.max(0, Number(value) || 0);
  if (count < 10_000) return count.toLocaleString("zh-CN");
  const wan = Math.floor(count / 10_000);
  return `${wan}w+`;
}
