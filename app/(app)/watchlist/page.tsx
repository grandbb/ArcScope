import { PageHeader } from "@/components/layout/PageHeader"; import { WatchlistManager } from "@/components/watchlist/WatchlistManager";
export default function WatchlistPage(){return <div className="space-y-6"><PageHeader title="Watchlist" description="Wallets and assets you want to keep in view."/><WatchlistManager/></div>;}
