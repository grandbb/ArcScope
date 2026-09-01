"use client";

import Link from "next/link";
import { BarChart3, Gauge, PieChart, Sparkles } from "lucide-react";
export function MobileNav() { return <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t bg-card/95 p-2 backdrop-blur-xl md:hidden">{[["Home","/dashboard",Gauge],["Portfolio","/portfolio",PieChart],["Analytics","/analytics",BarChart3],["Trending","/trending",Sparkles]].map(([label,href,Icon]) => <Link key={String(href)} href={String(href)} className="flex flex-col items-center gap-1 p-1 text-[10px] text-muted-foreground"><Icon className="h-5 w-5"/>{String(label)}</Link>)}</nav>; }
