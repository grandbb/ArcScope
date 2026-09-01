import { NextResponse } from "next/server";
import { alchemyRpc, hexToEther } from "@/lib/alchemy";
import { CACHE_HEADER } from "@/lib/constants";
import { makePortfolio } from "@/lib/mock-data";
import { isValidAddress } from "@/lib/validators";
import { CHAINS, getChain } from "@/lib/chains";
import type { ChainSlug } from "@/lib/types";

export async function GET(request: Request, { params }: { params: { address: string } }) {
  if (!isValidAddress(params.address)) return NextResponse.json({ data: null, error: "Invalid wallet address" }, { status: 400 });
  const requested = new URL(request.url).searchParams.get("chain") ?? "arc";
  if (!CHAINS.some((item) => item.slug === requested)) return NextResponse.json({ data: null, error: "Unsupported chain" }, { status: 400 });
  try { const chain = requested as ChainSlug; const portfolio = makePortfolio(params.address); const balanceHex = await alchemyRpc<string>("eth_getBalance", [params.address, "latest"], chain); const nativeBalance = hexToEther(balanceHex); const config = getChain(chain); portfolio.tokens[0] = { ...portfolio.tokens[0], name: `${config.nativeCurrency} (${config.name})`, symbol: config.nativeCurrency, balance: nativeBalance, value: nativeBalance * (chain === "arc" ? 1 : portfolio.tokens[0].price) }; portfolio.totalValue = portfolio.tokens.reduce((sum, token) => sum + token.value, 0); portfolio.tokens = portfolio.tokens.map((token) => ({ ...token, allocation: portfolio.totalValue ? token.value / portfolio.totalValue * 100 : 0 })); return NextResponse.json({ data: portfolio }, { headers: { "Cache-Control": CACHE_HEADER } }); } catch (error) { return NextResponse.json({ data: makePortfolio(params.address), error: error instanceof Error ? error.message : "Portfolio provider failed" }, { headers: { "Cache-Control": CACHE_HEADER } }); }
}
