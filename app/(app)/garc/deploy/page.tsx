"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount, useDeployContract, usePublicClient, useSwitchChain, useWaitForTransactionReceipt } from "wagmi";
import { BaseError, encodeDeployData, isAddress, type Address, type Hash } from "viem";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { arcMainnet } from "@/lib/chains";
import { garcAbi, garcBytecode } from "@/lib/generated/garc";
import { verifyGarcContract } from "@/lib/garc";
import { useGarcStore } from "@/stores/useGarcStore";

export default function DeployGarcPage() {
  const { address, isConnected, chainId } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();
  const { deployContractAsync } = useDeployContract();
  const client = usePublicClient({ chainId: arcMainnet.id });
  const setContract = useGarcStore(state => state.setContract);
  const [hash, setHash] = useState<Hash>();
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState<string>();
  const [verified, setVerified] = useState<Address>();
  const [candidate, setCandidate] = useState("");
  const lock = useRef(false);
  const receipt = useWaitForTransactionReceipt({ chainId: arcMainnet.id, hash, confirmations: 1, timeout: 120_000, query: { enabled: !!hash, retry: 1 } });
  const pending = busy || (!!hash && !receipt.data && !receipt.isError);
  const message = (cause: unknown) => cause instanceof BaseError ? cause.shortMessage : cause instanceof Error ? cause.message : "Please try again.";

  useEffect(() => {
    if (!receipt.data || !client) return;
    const contract = receipt.data.contractAddress;
    if (receipt.data.status !== "success" || !contract) { setError("Deployment did not create a contract. Check Arc Explorer."); return; }
    let active = true;
    verifyGarcContract(contract, client).then(() => {
      if (active) { setContract(contract); setVerified(contract); setError(undefined); }
    }).catch(cause => { if (active) setError(message(cause)); });
    return () => { active = false; };
  }, [receipt.data, client, setContract]);

  async function deploy() {
    if (lock.current || hash || !address || !client) return;
    lock.current = true; setBusy(true); setError(undefined); setVerified(undefined);
    try {
      setStage("Switching to Arc Mainnet…");
      if (chainId !== arcMainnet.id) await switchChainAsync({ chainId: arcMainnet.id });
      if (await client.getChainId() !== arcMainnet.id) throw Error("RPC network mismatch. Please use Arc Mainnet.");
      setStage("Estimating contract deployment gas…");
      const gas = await client.estimateGas({ account: address, data: encodeDeployData({ abi: garcAbi, bytecode: garcBytecode }) });
      setStage("Approve contract deployment in your wallet…");
      setHash(await deployContractAsync({ account: address, abi: garcAbi, bytecode: garcBytecode, chainId: arcMainnet.id, value: BigInt(0), gas: gas + gas / BigInt(5) }));
    } catch (cause) { setError(message(cause)); }
    finally { lock.current = false; setBusy(false); setStage(""); }
  }

  async function useExisting() {
    if (lock.current || pending || !client) return;
    lock.current = true; setBusy(true); setError(undefined);
    try {
      const value = candidate.trim();
      if (!isAddress(value)) throw Error("Enter a valid contract address.");
      await verifyGarcContract(value, client);
      setContract(value); setVerified(value);
    } catch (cause) { setError(message(cause)); }
    finally { lock.current = false; setBusy(false); }
  }

  return <div className="mx-auto max-w-3xl space-y-6">
    <PageHeader title="Deploy gARC on Arc Mainnet" description="Create the ArcScope greeting contract from your own wallet." />
    <section className="glass space-y-5 rounded-2xl p-5 sm:p-7">
      <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4"><h2 className="font-semibold">Deploy with your wallet</h2><p className="text-sm text-muted-foreground">Connect a browser wallet here to deploy the compiled contract. Mobile WalletConnect QR requires this site's own valid Reown project configuration. Remix's current WalletConnect network list does not include Arc; use a browser wallet connection in Remix instead.</p><p className="text-sm text-muted-foreground">For Remix, compile with Solidity 0.8.30, optimizer enabled (200 runs), EVM Paris. Confirm that Deploy & Run shows chain 5042, leave Value at 0, and approve the gas fee in your wallet. Paste the resulting contract address below.</p><a href="https://app.remix.live/#url=https://github.com/grandbb/ArcScope/blob/main/contracts/ArcGarc.sol" target="_blank" rel="noreferrer" className="inline-block text-sm font-semibold text-primary underline">Open gARC source in Remix</a></div>
      <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
        <li>Connect your browser wallet, or scan WalletConnect when the site's Reown project is configured.</li>
        <li>Deploy on Arc Mainnet (5042). Review and approve the USDC gas fee in your wallet.</li>
        <li>Wait for confirmation, then use gARC in the top bar to record greetings.</li>
      </ol>
      <p className="text-sm">The contract records the fixed message <strong>gARC | ArcScope</strong>, a counter for each wallet, the total greeting count, and the latest greeting time. Calls transfer 0 USDC. There are no token approvals, minting, admin actions, or upgrade functions.</p>
      <div className="rounded-xl border bg-muted/30 p-4 text-sm"><p>Deployment network: <strong>Arc Mainnet · 5042</strong></p><p className="mt-2 break-all">Deployer: {address ?? "Connect your wallet first"}</p>{isConnected && <p className="mt-2">Connected wallet chain: {chainId ?? "Unavailable"}{chainId !== arcMainnet.id && " · Switch to Arc Mainnet before approving deployment."}</p>}</div>
      <div className="flex flex-wrap gap-3 text-sm"><a href="/contracts/ArcGarc.sol" target="_blank" rel="noreferrer" className="text-primary underline">View Solidity source</a><a href="/contracts/ArcGarc.compiler-input.json" target="_blank" rel="noreferrer" className="text-primary underline">Compiler input for explorer verification</a></div>
      <p className="text-xs text-muted-foreground">Solidity 0.8.30 · optimizer 200 runs · EVM Paris. Never enter your recovery phrase or private key here.</p>
      <p className="text-xs text-muted-foreground">QR connections inside ArcScope require a valid WalletConnect project configuration. If QR connection fails, use a browser wallet or configure the site's Reown project ID.</p>
      {!isConnected ? <Button onClick={openConnectModal}>Connect wallet / scan QR</Button> : <Button onClick={() => void deploy()} disabled={pending || !!hash || !!verified || !client}>{pending ? <><Loader2 className="h-4 w-4 animate-spin" /> {busy ? "Waiting for wallet…" : "Confirming deployment…"}</> : hash ? "Deployment submitted" : "Deploy gARC · approve in wallet"}</Button>}
      <div aria-live="polite" className="space-y-2 text-sm">
        {stage && <p>{stage}</p>}
        {hash && !receipt.data && !receipt.isError && <p>Submitted. Waiting for Arc Mainnet confirmation…</p>}
        {hash && <a className="break-all text-primary underline" href={`${arcMainnet.blockExplorers.default.url}/tx/${receipt.data?.transactionHash ?? hash}`} target="_blank" rel="noreferrer">View deployment transaction</a>}
        {error && <p role="alert" className="break-words text-destructive">{error}</p>}
        {receipt.isError && !receipt.data && <div><p role="alert" className="text-amber-500">Confirmation is unavailable. Check the submitted transaction on Arc Explorer before deploying again.</p><Button variant="outline" className="mt-2" onClick={() => void receipt.refetch()}>Check confirmation again</Button></div>}
        {verified && <div className="space-y-3 rounded-xl border border-emerald-500/30 p-4"><p className="font-semibold text-emerald-500">gARC contract verified on Arc Mainnet.</p><a className="block break-all font-mono text-xs text-primary underline" href={`${arcMainnet.blockExplorers.default.url}/address/${verified}`} target="_blank" rel="noreferrer">{verified}</a><p>This browser now uses this contract. Share this address with the site maintainer to configure it for all visitors.</p><Link href="/dashboard" className="inline-block text-primary underline">Return to Dashboard and send gARC</Link></div>}
      </div>
    </section>
    <section className="glass space-y-3 rounded-2xl p-5">
      <h2 className="font-semibold">Already deployed?</h2><p className="text-sm text-muted-foreground">Use an existing ArcGarc address. Its deployed code must match this project’s compiled contract.</p>
      <input aria-label="Existing gARC contract address" value={candidate} onChange={event => setCandidate(event.target.value)} placeholder="0x…" className="h-10 w-full rounded-lg border bg-background px-3 font-mono text-sm" />
      <Button variant="outline" onClick={() => void useExisting()} disabled={pending || !candidate.trim() || (!!hash && !receipt.data)}>Verify and use contract</Button>
    </section>
  </div>;
}
