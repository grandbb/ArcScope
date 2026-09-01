import { formatDistanceToNow, format } from "date-fns";
export const formatAddress = (value: string, chars = 4) => value.length > chars * 2 + 3 ? `${value.slice(0, chars + 2)}…${value.slice(-chars)}` : value;
export const formatHash = (value: string) => formatAddress(value, 6);
export const formatCurrency = (value: number, currency = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: value < 1 ? 4 : 2 }).format(value);
export const formatNumber = (value: number) => new Intl.NumberFormat("en-US", { notation: Math.abs(value) >= 100_000 ? "compact" : "standard", maximumFractionDigits: 2 }).format(value);
export const formatDate = (value: Date | number) => format(value, "MMM d, yyyy");
export const formatGwei = (value: number) => `${value.toFixed(1)} Gwei`;
export const timeAgo = (timestamp: number) => formatDistanceToNow(new Date(timestamp), { addSuffix: true });
