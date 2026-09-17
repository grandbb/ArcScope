export interface DashboardMetrics {
  tvl: number | null;
  dexVolume24h: number | null;
  dexVolume7d: number | null;
  dexVolume30d: number | null;
  dexVolumeTotal: number | null;
  dexChange24h: number | null;
  dexProtocols: number | null;
  fees24h: number | null;
  gasGwei: number | null;
  fetchedAt: string;
  unavailableSources: string[];
}

/** Keep missing provider values distinct from a reported zero. */
export function metricNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function formatMetric(value: number | null, currency = false): string {
  if (value === null) return "Unavailable";
  return new Intl.NumberFormat("en-US", {
    ...(currency ? { style: "currency", currency: "USD" } : {}),
    notation: "compact", maximumFractionDigits: 2,
  }).format(value);
}
