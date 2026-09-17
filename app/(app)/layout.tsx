import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { MobileNav } from "@/components/layout/MobileNav";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-screen"><Sidebar /><div className="md:pl-[84px] xl:pl-[272px]"><TopBar /><main className="mx-auto max-w-[1680px] p-4 pb-24 md:p-7 md:pb-10 xl:p-8"><p className="mb-4 rounded-xl border p-3 text-sm text-muted-foreground">Arc Mainnet: Native USDC balance, current gas quotes, and blocks use live RPC data. Other analytics and history may contain demonstration data.</p><ErrorBoundary>{children}</ErrorBoundary></main></div><MobileNav /></div>;
}
