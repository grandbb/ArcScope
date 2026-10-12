import { mainnetResponse } from "@/lib/ascope-api";
import { readDaos } from "@/lib/ascope-indexer";
export async function GET(request: Request, { params }: { params: { address: string } }) { return mainnetResponse(request, () => readDaos(params.address), params.address); }
