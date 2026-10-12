import { mainnetResponse } from "@/lib/ascope-api";
import { readPortfolio } from "@/lib/ascope-mainnet";
export const maxDuration = 60;
export async function GET(request: Request, { params }: { params: { address: string } }) { return mainnetResponse(request, () => readPortfolio(params.address), params.address); }
