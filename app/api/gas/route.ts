import { mainnetResponse } from "@/lib/ascope-api";
import { readGas } from "@/lib/ascope-mainnet";
export const maxDuration = 60;
export async function GET(request: Request) { return mainnetResponse(request, readGas); }
