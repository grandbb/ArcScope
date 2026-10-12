import { mainnetResponse } from "@/lib/ascope-api";
import { readTokenAnalytics } from "@/lib/ascope-token";
export const maxDuration = 60;
export async function GET(request: Request, {params}: {params:{address:string}}) {return mainnetResponse(request,()=>readTokenAnalytics(params.address),params.address);}
