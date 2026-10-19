import { mainnetResponse } from "@/lib/ascope-api";
import { readFullPortfolio } from "@/lib/ascope-portfolio";
export const maxDuration = 60;
export async function GET(request: Request, { params }: { params: { address: string } }) { return mainnetResponse(request, async () => (await readFullPortfolio(params.address)).defiPositions, params.address); }
