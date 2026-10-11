"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount, usePublicClient, useSendTransaction, useSwitchChain, useWaitForTransactionReceipt } from "wagmi";
import { BaseError, type Address, type Hash } from "viem";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { arcMainnet } from "@/lib/chains";
import { GARC_CONTRACT_ADDRESS, GARC_MESSAGE, hasGarcEvent, isGarcTransaction, prepareGarc } from "@/lib/garc";
import { garcAbi } from "@/lib/generated/garc";
import { useGarcStore } from "@/stores/useGarcStore";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function GarcButton() {
  const { address, isConnected, chainId } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const client = usePublicClient({ chainId: arcMainnet.id });
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState("");
  const [hash, setHash] = useState<Hash>();
  const [error, setError] = useState<string>();
  const [sentAddress, setSentAddress] = useState<Address>();
  const [sentContract, setSentContract] = useState<Address>();
  const [counts, setCounts] = useState<{ wallet: string; total: string }>();
  const [replaced, setReplaced] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const localContract = useGarcStore(state => state.contract);
  const contract = GARC_CONTRACT_ADDRESS ?? (hydrated ? localContract : undefined);
  useEffect(() => setHydrated(true), []);
  const lock = useRef(false);
  const receipt = useWaitForTransactionReceipt({ chainId: arcMainnet.id, hash, confirmations: 1, timeout: 120_000,
    onReplaced: ({ transaction }) => setReplaced(!sentAddress || !sentContract || !isGarcTransaction(transaction, sentAddress, sentContract)),
    query: { enabled: !!hash, retry: 1 } });
  const confirmed = receipt.data?.status === "success" && !replaced && !!sentAddress && !!sentContract && hasGarcEvent(receipt.data.logs, sentAddress, sentContract);
  const reverted = receipt.data?.status === "reverted";
  const busy = submitting || (!!hash && !receipt.data && !receipt.isError);
  const transactionHash = receipt.data?.transactionHash ?? hash;

  useEffect(() => {
    setCounts(undefined);
    if (!open || !address || !contract || !client) return;
    let active = true;
    Promise.all([
      client.readContract({ address: contract, abi: garcAbi, functionName: "greetings", args: [address] }),
      client.readContract({ address: contract, abi: garcAbi, functionName: "totalGreetings" }),
    ]).then(([wallet, total]) => { if (active) setCounts({ wallet: wallet.toString(), total: total.toString() }); }).catch(() => {});
    return () => { active = false; };
  }, [open, address, contract, client, confirmed]);

  async function send() {
    if (lock.current || busy || hash || !address || !contract || !client) return;
    lock.current = true;
    setSubmitting(true);
    setError(undefined);
    setHash(undefined);
    setSentAddress(address);
    setSentContract(contract);
    setReplaced(false);
    try {
      setStage("Switching to Arc Mainnet…");
      if (chainId !== arcMainnet.id) await switchChainAsync({ chainId: arcMainnet.id });
      setStage("Checking network and estimating gas…");
      const transaction = await prepareGarc(address, contract, client);
      setStage("Confirm the gARC transaction in your wallet…");
      const sent = await sendTransactionAsync(transaction);
      setHash(sent);
    } catch (cause) {
      const message = cause instanceof BaseError ? cause.shortMessage : cause instanceof Error ? cause.message : "Could not send gARC. Please retry.";
      setError(message);
    } finally {
      lock.current = false;
      setSubmitting(false);
      setStage("");
    }
  }

  return <>
    <Button variant="outline" className="border border-primary/40 px-3 font-bold text-primary" onClick={() => setOpen(true)} aria-label="gARC — on-chain greeting">
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />} gARC
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>Say gARC on Arc Mainnet</DialogTitle>
          <DialogDescription>Call the gARC smart contract to record your greeting and increase your on-chain count. Amount: 0 USDC. Your wallet shows the USDC network fee before confirmation.</DialogDescription>
        </DialogHeader>
        <dl className="space-y-2 rounded-xl border bg-muted/30 p-4 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Network</dt><dd>Arc Mainnet · 5042</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Message</dt><dd className="font-mono">{GARC_MESSAGE}</dd></div>
          {(sentContract ?? contract) && <div><dt className="text-muted-foreground">Smart contract</dt><dd className="mt-1 break-all font-mono text-xs"><a className="text-primary underline" href={`${arcMainnet.blockExplorers.default.url}/address/${sentContract ?? contract}`} target="_blank" rel="noreferrer">{sentContract ?? contract}</a></dd></div>}
          {counts && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Greetings</dt><dd>You: {counts.wallet} · Total: {counts.total}</dd></div>}
        </dl>
        <div aria-live="polite" className="space-y-2 text-sm">
          {submitting && <p className="text-muted-foreground">{stage}</p>}
          {hash && !receipt.data && !receipt.isError && <p className="text-muted-foreground">Submitted. Waiting for Arc confirmation…</p>}
          {confirmed && <p className="font-medium text-emerald-500">gARC confirmed on Arc Mainnet.</p>}
          {reverted && <p role="alert" className="text-destructive">The transaction reverted. gARC was not recorded.</p>}
          {replaced && <p role="alert" className="text-amber-500">The transaction was cancelled or replaced with a different transaction. gARC was not recorded.</p>}
          {receipt.data && !confirmed && !replaced && !reverted && <p role="alert" className="text-amber-500">No matching gARC event was found in this transaction. Check Arc Explorer.</p>}
          {error && <p role="alert" className="break-words text-destructive">{error}</p>}
          {hash && receipt.isError && !receipt.data && <div><p role="alert" className="text-amber-500">Confirmation is unavailable. Check your transaction on Arc Explorer before sending again.</p><button type="button" className="mt-2 underline" onClick={() => void receipt.refetch()}>Check confirmation again</button></div>}
          {transactionHash && <a className="inline-flex items-center gap-1 break-all text-xs text-primary underline" href={`${arcMainnet.blockExplorers.default.url}/tx/${transactionHash}`} target="_blank" rel="noreferrer">View transaction on Arc Explorer <ArrowUpRight className="h-3 w-3 shrink-0" /></a>}
        </div>
        {!contract && !hash && <p className="text-sm text-muted-foreground">The gARC contract must be deployed first. <Link href="/garc/deploy" onClick={() => setOpen(false)} className="text-primary underline">Deploy with your wallet or use an existing contract</Link>.</p>}
        {!isConnected ? <Button onClick={() => { setOpen(false); openConnectModal?.(); }}>Connect wallet</Button> :
          <Button onClick={() => void send()} disabled={busy || !!hash || !client || !contract}>
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> {submitting ? "Waiting for wallet…" : "Confirming…"}</> : hash ? confirmed ? "gARC confirmed" : "Transaction submitted" : "Send gARC · network fee only"}
          </Button>}
        {hash && receipt.data && <Button variant="outline" onClick={() => { setHash(undefined); setError(undefined); setReplaced(false); setSentAddress(undefined); setSentContract(undefined); }}>New gARC</Button>}
      </DialogContent>
    </Dialog>
  </>;
}
