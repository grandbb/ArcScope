import { metricNumber, metricChange } from "./dashboard";

export function parseTvlHistory(value: unknown) {
  if (!Array.isArray(value)) throw Error("TVL history unavailable");
  const points = value.filter(p => Number.isFinite(p?.date) && metricNumber(p?.tvl) !== null).map(p => ({ date: Number(p.date), tvl: Number(p.tvl) })).sort((a,b) => a.date-b.date);
  if (!points.length) throw Error("TVL history unavailable");
  return points.slice(-90);
}
export function arcProtocols(value: unknown) {
  if (!Array.isArray(value)) throw Error("Protocol rankings unavailable");
  return value.filter(p => typeof p?.slug === "string" && metricNumber(p?.chainTvls?.Arc) !== null)
    .map(p => ({ name: String(p.name), slug: String(p.slug), category: String(p.category ?? "Other"), tvl: Number(p.chainTvls.Arc), change1d: metricChange(p.change_1d), change7d: metricChange(p.change_7d) }))
    .sort((a,b) => b.tvl-a.tvl);
}
export function stablecoinSummary(value: unknown) {
  if (!Array.isArray(value) || !value.length) throw Error("Stablecoin data unavailable");
  const points = value.map(p => ({ date: Number(p.date), value: Object.values(p.totalCirculatingUSD ?? {}).reduce<number>((sum,v) => sum + (metricNumber(v) ?? 0), 0) })).filter(p => Number.isFinite(p.date) && p.value > 0).sort((a,b) => a.date-b.date);
  const latest = points.at(-1);
  if (!latest) throw Error("Stablecoin data unavailable");
  const previous = [...points].reverse().find(p => p.date <= latest.date - 7 * 86400);
  return { value: latest.value, change7d: previous ? (latest.value / previous.value - 1) * 100 : null };
}
export interface ArcEcosystem {
  history: ReturnType<typeof parseTvlHistory>;
  protocols: ReturnType<typeof arcProtocols>;
  stablecoins: ReturnType<typeof stablecoinSummary> | null;
  revenue24h: number | null;
  perps24h: number | null;
  fetchedAt: string;
  unavailable: string[];
}
