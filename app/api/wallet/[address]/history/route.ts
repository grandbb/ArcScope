import { mainnetResponse } from "@/lib/ascope-api";
import { readBalanceHistory } from "@/lib/ascope-history";
export const maxDuration=60;
export async function GET(request:Request,{params}:{params:{address:string}}){return mainnetResponse(request,()=>readBalanceHistory(params.address),params.address);}
