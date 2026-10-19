import { mainnetResponse } from "@/lib/ascope-api";
import { readNfts } from "@/lib/ascope-indexer";
export const maxDuration = 60;
export async function GET(request: Request, { params }: { params: { address: string } }) { return mainnetResponse(request, () => readNfts(params.address, new URL(request.url).searchParams.get("pageKey")), params.address); }
