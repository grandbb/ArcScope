import { mainnetResponse } from "@/lib/ascope-api";
import { readActivity } from "@/lib/ascope-activity";
export const maxDuration = 60;
export async function GET(request: Request, { params }: { params: { address: string } }) { return mainnetResponse(request, () => readActivity(params.address, new URL(request.url).searchParams.get("pageKey") ?? ""), params.address); }
