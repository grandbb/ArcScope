import { mainnetResponse } from "@/lib/ascope-api";
import { readDefi } from "@/lib/ascope-indexer";
export async function GET(request: Request, { params }: { params: { address: string } }) { return mainnetResponse(request, () => readDefi(params.address), params.address); }
