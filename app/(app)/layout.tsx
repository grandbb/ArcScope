import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { MobileNav } from "@/components/layout/MobileNav";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { Footer } from "@/components/layout/Footer";

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-screen"><Sidebar /><div className="flex min-h-screen flex-col md:pl-[84px] xl:pl-[272px]"><TopBar /><main className="mx-auto w-full max-w-[1680px] flex-1 p-4 md:p-7 md:pb-10 xl:p-8"><p className="mb-4 rounded-xl border p-3 text-sm text-muted-foreground">Arc Mainnet · Confirmed on-chain data and tracked market feeds. Coverage and unavailable data are shown in each view.</p><ErrorBoundary>{children}</ErrorBoundary></main><Footer /></div><MobileNav /></div>;
}
