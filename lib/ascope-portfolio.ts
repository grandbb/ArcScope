import { unstable_cache } from "next/cache";
import { encodeAbiParameters, encodePacked, erc20Abi, formatUnits, keccak256, parseAbi, toHex, type Address } from "viem";
import { mainnetClient, readPortfolio, tokenFacts, USDC_ADDRESS } from "./ascope-mainnet";
import { readCollectionInventory, readWalletDiscovery } from "./ascope-wallet-discovery";
import type { DefiPosition, Portfolio } from "./types";

async function graphql(url: string, query: string) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query }), next: { revalidate: 60 }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw Error("Protocol API unavailable");
  const body = await r.json();
  if (body.errors || !body.data) throw Error("Protocol data unavailable");
  return body.data;
}
function usd(value: unknown): number {
  if (value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) || Number(value) < 0) throw Error("Invalid protocol USD value");
  return Number(value);
}
export async function aavePositions(address: string): Promise<DefiPosition[]> {
  const d = await graphql("https://api.v4.aave.com/graphql", `{ userSummary(request:{user:"${address}",filter:{chainIds:[5042]}}){ totalPositions totalSupplied{value} totalDebt{value} } }`);
  const s = d.userSummary;
  if (!s || !Number.isInteger(s.totalPositions)) throw Error("Aave summary unavailable");
  if (!s.totalPositions) return [];
  return [{ id: "aave-v4-arc", protocol: "Aave v4", type: "Lending", deposited: null, value: usd(s.totalSupplied?.value), debt: usd(s.totalDebt?.value), pnl: null, apy: null, sourceUrl: "https://app.aave.com/", detail: "Arc supplied assets and outstanding debt · Aave API" }];
}
export async function morphoPositions(address: string): Promise<DefiPosition[]> {
  const d = await graphql("https://api.morpho.org/graphql", `{ userByAddress(address:"${address}",chainId:5042){ vaultPositions{vault{address name}state{assetsUsd}} vaultV2Positions{assetsUsd vault{address name}} marketPositions{state{supplyAssetsUsd borrowAssetsUsd collateralUsd}} } }`);
  const u = d.userByAddress;
  if (!u) throw Error("Morpho user data unavailable");
  const positions: DefiPosition[] = [];
  for (const v of [...u.vaultPositions.map((p: any) => ({ ...p, assetsUsd: p.state?.assetsUsd })), ...u.vaultV2Positions]) {
    const value = usd(v.assetsUsd);
    if (value > 0) positions.push({ id: `morpho:${v.vault.address.toLowerCase()}`, protocol: `Morpho · ${v.vault.name}`, type: "Lending", value, deposited: null, pnl: null, apy: null, receiptToken: v.vault.address.toLowerCase(), detail: "Vault assets · Morpho API", sourceUrl: `https://app.morpho.org/arc/vault/${v.vault.address}` });
  }
  u.marketPositions.forEach((p: any, i: number) => {
    const value = usd(p.state?.supplyAssetsUsd) + usd(p.state?.collateralUsd), debt = usd(p.state?.borrowAssetsUsd);
    if (value > 0 || debt > 0) positions.push({ id: `morpho-market:${i}`, protocol: "Morpho Blue market", type: debt ? "Borrowing" : "Lending", value, debt, deposited: null, pnl: null, apy: null, detail: "Direct market supply + collateral, less borrow debt", sourceUrl: "https://app.morpho.org/" });
  });
  return positions;
}

// Uniswap v4 PositionInfo encodes signed int24 ticks at offsets 8 and 32.
export function positionTicks(info: bigint) {
  const signed = (n: bigint) => Number(n >= BigInt("0x800000") ? n - BigInt("0x1000000") : n);
  return [signed((info >> BigInt("8")) & BigInt("0xffffff")), signed((info >> BigInt("32")) & BigInt("0xffffff"))] as const;
}
/** Token principal at the current pool price. */
export function liquidityPrincipal(liquidity: bigint, sqrtPriceX96: bigint, lower: number, upper: number) {
  if (lower >= upper || lower < -887272 || upper > 887272 || liquidity < BigInt("0") || sqrtPriceX96 <= BigInt("0")) throw Error("Invalid liquidity position");
  const a = Math.pow(1.0001, lower / 2), b = Math.pow(1.0001, upper / 2), p = Math.max(a, Math.min(b, Number(sqrtPriceX96) / 2 ** 96));
  const l = Number(liquidity);
  return [l * (b - p) / (p * b), l * (p - a)] as const;
}
export function accruedFees(liquidity: bigint, currentTick: number, lower: number, upper: number, global: bigint, outsideLower: bigint, outsideUpper: bigint, lastInside: bigint) {
  const mod = BigInt(1) << BigInt(256), wrap = (v: bigint) => (v % mod + mod) % mod;
  const inside = currentTick < lower ? outsideLower-outsideUpper : currentTick >= upper ? outsideUpper-outsideLower : global-outsideLower-outsideUpper;
  return liquidity * wrap(inside-lastInside) / (BigInt(1) << BigInt(128));
}
const posmAbi = parseAbi([
  "function ownerOf(uint256) view returns (address)",
  "function poolManager() view returns (address)",
  "function getPositionLiquidity(uint256) view returns (uint128)",
  "function getPoolAndPositionInfo(uint256) view returns ((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,uint256 info)",
]);
async function assetFacts(address: string, tokens: Portfolio["tokens"]) {
  if (address.toLowerCase() === USDC_ADDRESS) return { symbol: "USDC", decimals: 6, price: 1 };
  if (/^0x0{40}$/i.test(address)) return { symbol: "USDC", decimals: 18, price: 1 };
  const facts = await tokenFacts(address);
  const walletQuote = tokens.find(t => t.address.toLowerCase() === address.toLowerCase())?.price;
  return { ...facts, price: facts.price ?? walletQuote ?? null };
}
export async function uniswapV4Positions(address: string, tokens: Portfolio["tokens"], blockNumber: bigint): Promise<DefiPosition[]> {
  const discovery = await readWalletDiscovery(address);
  const collections = discovery.collections.filter(c => c.symbol === "UNI-V4-POSM");
  const result: DefiPosition[] = [];
  for (const collection of collections) {
    // Arc's verified v4 deployment. Do not apply v4 storage decoding to lookalike NFTs.
    if (collection.address !== "0x6049c9a0e26405c0985f9e3685c87d0ae917f82b") throw Error("Unrecognized Uniswap position manager");
    const items = await readCollectionInventory(address, collection.address, collection.name);
    if (items.length !== collection.count) throw Error("Incomplete Uniswap inventory");
    for (const nft of items) {
      const contract = collection.address as Address, id = BigInt(nft.tokenId!);
      const [owner, pool, liquidity, manager] = await Promise.all([
        mainnetClient.readContract({ address: contract, abi: posmAbi, functionName: "ownerOf", args: [id], blockNumber }),
        mainnetClient.readContract({ address: contract, abi: posmAbi, functionName: "getPoolAndPositionInfo", args: [id], blockNumber }),
        mainnetClient.readContract({ address: contract, abi: posmAbi, functionName: "getPositionLiquidity", args: [id], blockNumber }),
        mainnetClient.readContract({ address: contract, abi: posmAbi, functionName: "poolManager", blockNumber }),
      ]);
      if (owner.toLowerCase() !== address.toLowerCase()) throw Error("NFT ownership changed since discovery");
      if (!liquidity) continue;
      if (manager.toLowerCase() !== "0x8366a39cc670b4001a1121b8f6a443a643e40951") throw Error("Unrecognized Uniswap pool manager");
      const [key, info] = pool;
      const poolId = keccak256(encodeAbiParameters([{type:"address"},{type:"address"},{type:"uint24"},{type:"int24"},{type:"address"}], [key.currency0,key.currency1,key.fee,key.tickSpacing,key.hooks]));
      const slot = keccak256(encodeAbiParameters([{type:"bytes32"},{type:"uint256"}], [poolId,BigInt("6")]));
      const packed = await mainnetClient.readContract({ address: manager, abi: parseAbi(["function extsload(bytes32) view returns (bytes32)"]), functionName: "extsload", args: [slot], blockNumber });
      const sqrtPrice = BigInt(packed) & ((BigInt("1") << BigInt("160"))-BigInt("1")), [lower,upper] = positionTicks(info);
      const [raw0,raw1] = liquidityPrincipal(liquidity,sqrtPrice,lower,upper);
      const unsignedTick = Number((BigInt(packed) >> BigInt(160)) & BigInt("0xffffff"));
      const currentTick = unsignedTick >= 0x800000 ? unsignedTick-0x1000000 : unsignedTick;
      const addSlot = (base: string, n: number) => toHex(BigInt(base)+BigInt(n),{size:32});
      const tickSlot = (tick: number) => keccak256(encodeAbiParameters([{type:"int256"},{type:"uint256"}], [BigInt(tick),BigInt(slot)+BigInt(4)]));
      const lowerSlot=tickSlot(lower), upperSlot=tickSlot(upper);
      const positionKey = keccak256(encodePacked(["address","int24","int24","bytes32"],[contract,lower,upper,toHex(id,{size:32})]));
      const positionSlot = keccak256(encodeAbiParameters([{type:"bytes32"},{type:"uint256"}],[positionKey,BigInt(slot)+BigInt(6)]));
      const stored = await mainnetClient.readContract({address:manager,abi:parseAbi(["function extsload(bytes32[]) view returns (bytes32[])"]),functionName:"extsload",args:[[addSlot(slot,1),addSlot(slot,2),addSlot(lowerSlot,1),addSlot(lowerSlot,2),addSlot(upperSlot,1),addSlot(upperSlot,2),addSlot(positionSlot,1),addSlot(positionSlot,2)]],blockNumber});
      const growth=stored.map(v=>BigInt(v));
      const fee0=accruedFees(liquidity,currentTick,lower,upper,growth[0],growth[2],growth[4],growth[6]);
      const fee1=accruedFees(liquidity,currentTick,lower,upper,growth[1],growth[3],growth[5],growth[7]);
      const [f0,f1] = await Promise.all([assetFacts(key.currency0,tokens),assetFacts(key.currency1,tokens)]);
      const amount0 = (raw0+Number(fee0))/10**f0.decimals, amount1 = (raw1+Number(fee1))/10**f1.decimals;
      const value = (amount0 > 0 && f0.price === null) || (amount1 > 0 && f1.price === null) ? null : amount0*(f0.price??0)+amount1*(f1.price??0);
      result.push({ id: `uni-v4:${nft.tokenId}`, protocol: `Uniswap v4 · ${f0.symbol}/${f1.symbol}`, type: "LP", deposited: null, value, debt: 0, pnl: null, apy: null, detail: `Position #${nft.tokenId} · ${amount0.toPrecision(6)} ${f0.symbol} + ${amount1.toPrecision(6)} ${f1.symbol}. Includes accrued unclaimed LP fees.`, sourceUrl: nft.sourceUrl });
    }
  }
  return result;
}
const vaultAbi = parseAbi(["function asset() view returns (address)", "function balanceOf(address) view returns (uint256)", "function convertToAssets(uint256) view returns (uint256)"]);
export async function vaultPositions(address: string, tokens: Portfolio["tokens"], known: Set<string>, blockNumber: bigint) {
  const result: DefiPosition[] = [], failed: string[] = [];
  for (let offset=0;offset<tokens.length;offset+=5) await Promise.all(tokens.slice(offset,offset+5).map(async token => {
    if (token.address === USDC_ADDRESS || known.has(token.address.toLowerCase())) return;
    const vault = token.address as Address;
    let asset: Address;
    try { asset = await mainnetClient.readContract({ address: vault, abi: vaultAbi, functionName: "asset", blockNumber }); } catch { return; }
    try {
      const shares = await mainnetClient.readContract({ address: vault, abi: vaultAbi, functionName: "balanceOf", args: [address as Address], blockNumber });
      if (!shares) return;
      const amount = await mainnetClient.readContract({ address: vault, abi: vaultAbi, functionName: "convertToAssets", args: [shares], blockNumber });
      const facts = await assetFacts(asset,tokens);
      result.push({ id: `vault:${vault}`, protocol: token.name, type: "Lending", deposited: null, value: facts.price === null ? null : Number(formatUnits(amount,facts.decimals))*facts.price, receiptToken: vault.toLowerCase(), pnl: null, apy: null, detail: "ERC-4626 vault · underlying assets", sourceUrl: `https://explorer.arc.io/address/${vault}` });
    } catch { failed.push(token.symbol); }
  }));
  return { positions: result, failed };
}

export function portfolioTotals(tokens: Portfolio["tokens"], positions: DefiPosition[]) {
  const receipts = new Set(positions.flatMap(p => p.receiptToken ? [p.receiptToken.toLowerCase()] : []));
  const walletValue = tokens.filter(t=>!receipts.has(t.address.toLowerCase())).reduce((sum,t)=>sum+(t.value??0),0);
  const defiValue = positions.reduce((sum,p)=>sum+(p.value??0),0), defiDebt = positions.reduce((sum,p)=>sum+(p.debt??0),0);
  return { walletValue, defiValue, defiDebt, totalValue: walletValue+defiValue-defiDebt, receipts };
}

export const readFullPortfolio = unstable_cache(async (address: string): Promise<Portfolio> => {
  const base = await readPortfolio(address), block = BigInt(base.blockNumber!);
  const providers = await Promise.allSettled([aavePositions(address),morphoPositions(address),uniswapV4Positions(address,base.tokens,block)]);
  const names = ["Aave v4", "Morpho", "Uniswap v4"];
  const issues = [...base.coverageIssues??[]], positions: DefiPosition[] = [], sources: string[] = [];
  providers.forEach((p,i)=>{ if(p.status==="fulfilled"){positions.push(...p.value);sources.push(names[i]);}else issues.push(`${names[i]} positions unavailable.`); });
  const known = new Set(positions.flatMap(p=>p.receiptToken?[p.receiptToken]:[]));
  const vaults = await vaultPositions(address,base.tokens,known,block);
  positions.push(...vaults.positions);
  if (vaults.positions.length) sources.push("ERC-4626");
  if (vaults.failed.length) issues.push(`Unable to value vaults: ${vaults.failed.join(", ")}.`);
  const unpriced = base.tokens.filter(t=>t.value===null).length;
  if (unpriced) issues.push(`${unpriced} wallet tokens have no USD quote and are excluded from the estimate.`);
  if (positions.some(p=>p.value===null)) issues.push("Some DeFi positions have no USD price and are excluded from totals.");
  const totals = portfolioTotals(base.tokens,positions);
  const tokens = base.tokens.filter(t=>!totals.receipts.has(t.address.toLowerCase())).map(t=>({...t}));
  for(const token of tokens) token.allocation = totals.walletValue ? (token.value??0)/totals.walletValue*100 : 0;
  return { ...base, walletValue: totals.walletValue, defiValue: sources.length ? totals.defiValue : null, defiDebt: sources.length ? totals.defiDebt : null, totalValue: totals.totalValue, tokens, tokenCount: tokens.length, defiPositions: positions, defiSources: sources, coverageIssues: issues, coverage: `${base.coverage} DeFi: Aave v4, Morpho, held ERC-4626 vaults and Uniswap v4 positions including accrued fees. Other protocols, staked/transferred-away LP NFTs and NFT market prices are not covered.` };
}, ["ascope-full-portfolio-v1"], { revalidate: 60 });
