"use client";

import Link from "next/link";
import Image from "next/image";
import { BarChart3, Bookmark, Gauge, PieChart, Settings, Sparkles, Activity } from "lucide-react";
import { usePathname } from "next/navigation";
import { useWatchlistStore } from "@/stores/useWatchlistStore";
import { formatAddress } from "@/lib/formatters";

const nav = [
  ["Dashboard", "/dashboard", Gauge], ["My Portfolio", "/portfolio", PieChart],
  ["Analytics", "/analytics", BarChart3], ["Gas Tracker", "/analytics/gas", Activity],
  ["Trending", "/trending", Sparkles], ["Watchlist", "/watchlist", Bookmark],
] as const;

export function Sidebar() {
  const path = usePathname();
  const watchlist = useWatchlistStore((state) => state.items);
  return <aside className="fixed inset-y-0 left-0 z-40 hidden w-[84px] border-r border-white/5 bg-background/85 backdrop-blur-2xl md:flex md:flex-col xl:w-[272px]">
    <Link href="/dashboard" className="flex h-[76px] items-center gap-3 border-b border-white/5 px-4 xl:px-5">
      <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 shadow-[0_0_32px_hsl(var(--primary)/.18)]"><Image src="/ascope-mark.png" alt="AScope" width={52} height={50} className="h-10 w-10 object-contain" priority /></span>
      <span className="hidden xl:block"><strong className="brand-text text-xl font-black tracking-[-.04em]">AScope</strong><small className="block text-[9px] font-semibold uppercase tracking-[.2em] text-muted-foreground">Network intelligence</small></span>
    </Link>
    <div className="px-4 pb-2 pt-6 text-[9px] font-bold uppercase tracking-[.22em] text-muted-foreground/70 xl:px-5">Explore</div>
    <nav className="space-y-1.5 px-3">{nav.map(([label, href, Icon]) => { const active = path === href || (href !== "/dashboard" && path.startsWith(`${href}/`)); return <Link key={href} href={href} title={label} className={`group relative flex h-11 items-center gap-3 overflow-hidden rounded-xl px-3 text-sm font-medium transition-all ${active ? "bg-primary/10 text-foreground shadow-[inset_0_0_0_1px_hsl(var(--primary)/.12)]" : "text-muted-foreground hover:bg-white/[.035] hover:text-foreground"}`}>{active && <span className="brand-gradient absolute inset-y-2 left-0 w-0.5 rounded-full"/>}<Icon className={`h-[18px] w-[18px] shrink-0 transition-colors ${active ? "text-primary" : "group-hover:text-accent"}`}/><span className="hidden xl:block">{label}</span></Link>; })}</nav>
    <div className="hidden flex-1 border-t p-4 xl:block"><p className="mb-3 text-[10px] font-bold tracking-[.16em] text-muted-foreground">WATCHLIST</p><div className="space-y-1">{watchlist.slice(0,3).map((item)=><Link key={item.id} href={item.type==="address"?`/portfolio/${item.address}`:`/analytics/token/${item.address}`} className="flex items-center justify-between rounded-lg px-2 py-2 text-xs hover:bg-muted"><span className="truncate">{item.label||formatAddress(item.address)}</span><span className="ml-2 text-emerald-500">+2.8%</span></Link>)}{watchlist.length===0&&<p className="px-2 text-xs leading-relaxed text-muted-foreground">Saved wallets and tokens appear here.</p>}</div></div>
    <div className="m-3 border-t border-white/5 pt-3"><Link href="/settings" className="flex h-11 items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground transition-colors hover:bg-white/[.035] hover:text-foreground"><Settings className="h-[18px] w-[18px]"/><span className="hidden xl:block">Settings</span></Link></div>
  </aside>;
}
