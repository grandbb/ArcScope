import { NextResponse } from "next/server";
import { isAddress,parseUnits,type Address } from "viem";
import { mainnetClient,verifyMainnet } from "@/lib/ascope-mainnet";
export async function POST(request:Request) {
 let body;
 try {body=await request.json();}catch{return NextResponse.json({error:"Invalid transaction input"},{status:400});}
 if(!body || typeof body !== "object" || !isAddress(body.from??"")||!isAddress(body.to??"")||typeof body.amount!=="string"||!/^\d+(\.\d{1,18})?$/.test(body.amount)||body.amount.length>50)return NextResponse.json({error:"Enter valid Arc addresses and a USDC amount with up to 18 decimals"},{status:400});
 try {await verifyMainnet();const units=await mainnetClient.estimateGas({account:body.from as Address,to:body.to as Address,value:parseUnits(body.amount,18)});const gasPrice=await mainnetClient.getGasPrice();return NextResponse.json({data:{gasUnits:units.toString(),estimatedUsdc:Number(units*gasPrice)/1e18,gasPriceGwei:Number(gasPrice)/1e9,updatedAt:new Date().toISOString()}});}
 catch(error){return NextResponse.json({error:error instanceof Error?error.message.split("\n")[0]:"Arc gas estimation unavailable"},{status:502});}
}
