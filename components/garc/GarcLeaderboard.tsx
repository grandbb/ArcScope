"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { isAddress } from "viem";
import { ArrowUpRight, ChevronLeft, ChevronRight, Loader2, RefreshCw, Search, Trophy } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { arcMainnet } from "@/lib/chains";
import { GARC_CONTRACT_ADDRESS } from "@/lib/garc";
import type { GarcLeaderboardResponse } from "@/lib/garc-leaderboard";

const number = (value: string | number) => BigInt(value).toLocaleString("en-US");

export function GarcLeaderboard({ initialWallet = "" }: { initialWallet?: string }) {
  const { address } = useAccount();
  const [page, setPage] = useState(1);
  const [input, setInput] = useState(initialWallet);
  const [wallet, setWallet] = useState(isAddress(initialWallet, { strict: false }) ? initialWallet : "");
  const [validation, setValidation] = useState("");
  const query = useQuery<GarcLeaderboardResponse>({
    queryKey: ["garc-leaderboard", page, wallet],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ page: String(page) });
      if (wallet) params.set("wallet", wallet);
      const response = await fetch(`/api/garc/leaderboard?${params}`, { signal, cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Leaderboard unavailable. Please retry.");
      return result.data;
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
    retry: 1,
  });
  const data = query.data;
  const search = data?.search;

  function findWallet(value: string) {
    const trimmed = value.trim();
    if (!isAddress(trimmed, { strict: false })) {
      setValidation("Enter your complete wallet address: 0x followed by 40 hexadecimal characters.");
      return;
    }
    setValidation("");
    setInput(trimmed);
    setWallet(trimmed);
  }

  return <div className="space-y-6">
    <PageHeader title="Leaderboard gARC" eyebrow="Arc Mainnet · On-chain greetings"
      description="Wallets ranked by confirmed gARC greetings on your ArcScope smart contract. 100 wallets per page. Equal counts are ordered by the first confirmed greeting."
      actions={<Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw className={query.isFetching ? "animate-spin" : ""} /> Refresh</Button>} />

    <div className="grid gap-3 sm:grid-cols-3">
      {[["Total gARC", data ? number(data.totalGreetings) : "—"], ["Participating wallets", data ? number(data.totalWallets) : "—"], ["Network", "Arc Mainnet · 5042"]].map(([label, value]) =>
        <div key={label} className="rounded-2xl border bg-card p-5"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-bold">{value}</p></div>)}
    </div>

    <section className="rounded-2xl border bg-card p-5" aria-label="Find your wallet rank">
      <h2 className="mb-3 font-semibold">Find your wallet rank</h2>
      <form onSubmit={event => { event.preventDefault(); findWallet(input); }} className="flex flex-wrap gap-2">
        <label htmlFor="garc-wallet" className="sr-only">Wallet address</label>
        <input id="garc-wallet" value={input} onChange={event => setInput(event.target.value)} placeholder="0x… wallet address" autoComplete="off" spellCheck={false}
          aria-invalid={!!validation} aria-describedby={validation ? "garc-wallet-error" : undefined}
          className="h-10 min-w-0 flex-[1_1_280px] rounded-lg border bg-background px-3 font-mono text-sm outline-none focus:ring-2 focus:ring-primary" />
        <Button type="submit" size="lg"><Search /> Search</Button>
        <Button type="button" variant="outline" size="lg" disabled={!address} onClick={() => address && findWallet(address)}>My wallet</Button>
        {wallet && <Button type="button" variant="ghost" size="lg" onClick={() => { setWallet(""); setInput(""); setValidation(""); }}>Clear</Button>}
      </form>
      {!address && <p className="mt-2 text-xs text-muted-foreground">Paste any wallet address, or connect your wallet to use My wallet.</p>}
      {validation && <p id="garc-wallet-error" role="alert" className="mt-3 text-sm text-destructive">{validation}</p>}
      <div aria-live="polite">
        {wallet && query.isPending && <p className="mt-3 text-sm text-muted-foreground">Looking up your rank across all pages…</p>}
        {search && <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="break-all font-mono text-xs text-muted-foreground">{search.wallet}</p>
          {search.entry ? <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold">Rank #{number(search.entry.rank)} <span className="ml-2 text-primary">{number(search.entry.count)} gARC</span></p>
            <Button variant="outline" onClick={() => setPage(search.page!)}>Show on page {search.page} <ChevronRight /></Button>
          </div> : <p className="mt-2 text-sm">This wallet has no confirmed gARC greetings on this contract yet.</p>}
        </div>}
      </div>
    </section>

    {query.isError && <div role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm"><p className="text-destructive">{query.error.message}</p><Button variant="outline" className="mt-3" onClick={() => void query.refetch()}>Retry</Button></div>}
    {query.isPending && <div role="status" className="flex items-center justify-center gap-2 rounded-2xl border p-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Reading confirmed gARC greetings…</div>}
    {data && <section className="overflow-hidden rounded-2xl border bg-card" aria-label="gARC rankings">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-5">
        <h2 className="flex items-center gap-2 font-semibold"><Trophy className="h-4 w-4 text-primary" /> Wallet rankings</h2>
        <p className="text-xs text-muted-foreground">{data.totalWallets ? `${(data.page - 1) * data.pageSize + 1}–${Math.min(data.page * data.pageSize, data.totalWallets)} of ${number(data.totalWallets)}` : "0 wallets"}</p>
      </div>
      {data.entries.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <thead className="bg-muted/30 text-xs text-muted-foreground"><tr><th scope="col" className="px-4 py-3 sm:px-5">Rank</th><th scope="col" className="px-4 py-3 sm:px-5">Wallet</th><th scope="col" className="whitespace-nowrap px-4 py-3 text-right sm:px-5">gARC count</th><th scope="col" className="hidden px-5 py-3 text-right lg:table-cell">Last gARC</th></tr></thead>
        <tbody>{data.entries.map(entry => <tr key={entry.wallet} className={`border-t ${entry.wallet.toLowerCase() === (wallet || address)?.toLowerCase() ? "bg-primary/10" : "hover:bg-muted/20"}`}>
          <td className="px-4 py-4 font-bold sm:px-5"><span className={entry.rank <= 3 ? "text-primary" : "text-muted-foreground"}>#{number(entry.rank)}</span></td>
          <td className="px-4 py-4 sm:px-5"><a href={`${arcMainnet.blockExplorers.default.url}/address/${entry.wallet}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"><span className="hidden sm:inline">{entry.wallet}</span><span className="sm:hidden" title={entry.wallet}>{entry.wallet.slice(0, 8)}…{entry.wallet.slice(-6)}</span><ArrowUpRight className="h-3 w-3 shrink-0" /></a>{entry.wallet.toLowerCase() === address?.toLowerCase() && <span className="ml-2 text-xs text-muted-foreground">You</span>}</td>
          <td className="px-4 py-4 text-right font-bold tabular-nums sm:px-5">{number(entry.count)}</td>
          <td className="hidden px-5 py-4 text-right text-xs text-muted-foreground lg:table-cell">{new Date(entry.lastGreetingAt * 1000).toLocaleString()}</td>
        </tr>)}</tbody>
      </table></div> : <p className="p-12 text-center text-sm text-muted-foreground">No confirmed gARC greetings yet. Send gARC to join the leaderboard.</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 sm:p-5">
        <p className="text-sm text-muted-foreground">Page {data.page} of {number(data.totalPages)} · 100 wallets per page</p>
        <div className="flex gap-2"><Button variant="outline" disabled={data.page <= 1 || query.isFetching} onClick={() => setPage(data.page - 1)}><ChevronLeft /> Previous</Button><Button variant="outline" disabled={data.page >= data.totalPages || query.isFetching} onClick={() => setPage(data.page + 1)}>Next <ChevronRight /></Button></div>
      </div>
    </section>}
    <div className="space-y-1 text-xs text-muted-foreground">
      <p className="break-all">Source: <a href={`${arcMainnet.blockExplorers.default.url}/address/${GARC_CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer" className="text-primary underline">ArcScope gARC contract · {GARC_CONTRACT_ADDRESS}</a></p>
      <p>Finalized transactions only · refreshes every 15 seconds{data && ` · Block ${number(data.blockNumber)} · Updated ${new Date(data.updatedAt).toLocaleTimeString()}`}. A new greeting may take a short time to appear.</p>
    </div>
  </div>;
}
