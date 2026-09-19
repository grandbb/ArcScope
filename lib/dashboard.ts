export interface DashboardMetrics {
  tvl: number | null;
  dexVolume24h: number | null;
  dexVolume7d: number | null;
  dexVolume30d: number | null;
  dexVolumeTotal: number | null;
  dexChange24h: number | null;
  dexChange7d: number | null;
  dexChange30d: number | null;
  dexProtocols: number | null;
  fees24h: number | null;
  feesChange24h: number | null;
  gasGwei: number | null;
  fetchedAt: string;
  unavailableSources: string[];
}

/** Keep missing provider values distinct from a reported zero. */
export function metricNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function metricChange(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Compare the latest complete UTC period with the equally sized period before it. */
export function periodChange(value: unknown, days: number, now = Date.now()): number | null {
  if (!Array.isArray(value) || days < 1) return null;
  const today = Math.floor(now / 86_400_000) * 86_400;
  const points = value
    .filter((point): point is [number, number] => Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]) && point[0] < today)
    .sort((a, b) => a[0] - b[0]);
  if (points.length < days * 2) return null;
  const window = points.slice(-days * 2);
  for (let i = 1; i < window.length; i++) if (window[i][0] - window[i - 1][0] !== 86_400) return null;
  const previous = window.slice(0, days).reduce((sum, point) => sum + point[1], 0);
  const current = window.slice(days).reduce((sum, point) => sum + point[1], 0);
  return previous > 0 ? (current - previous) / previous * 100 : null;
}

export function formatMetric(value: number | null, currency = false): string {
  if (value === null) return "Unavailable";
  return new Intl.NumberFormat("en-US", {
    ...(currency ? { style: "currency", currency: "USD" } : {}),
    notation: "compact", maximumFractionDigits: 2,
  }).format(value);
}
