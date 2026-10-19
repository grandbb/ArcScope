const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const viem=require('viem');
const chain={rpcUrls:{default:{http:['https://rpc.mainnet.arc.io']}}};
function source(file,deps={}){
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
 new Function('require','module','exports',code)(name=> name in deps?deps[name]:require(name),module,module.exports);
 return module.exports;
}
const cache={'next/cache':{unstable_cache:fn=>fn},'./ascope-wallet-discovery':{readWalletDiscovery:async()=>{throw Error('indexer unavailable')},readCollectionInventory:async()=>{throw Error('indexer unavailable')}}};
const clientDeps=client=>({...cache,'viem':{...viem,createPublicClient:()=>client},'./chains':{arcMainnet:chain}});
const emptyMarket=async()=>({ok:true,json:async()=>({data:[],included:[]})});
test('portfolio reads 18-decimal native USDC once, omits the ERC-20 facade and leaves unknown metrics null',async()=>{
 const saved=global.fetch;global.fetch=emptyMarket;
 try{
  let ercCalls=0;
  const api=source('lib/ascope-mainnet.ts',clientDeps({getChainId:async()=>5042,getBlock:async()=>({number:100n}),getBalance:async()=>1234500000000000000n,getTransactionCount:async()=>9,readContract:async()=>{ercCalls++;throw new Error('unexpected facade read')} }));
  const p=await api.readPortfolio('0x'+'11'.repeat(20));
  assert.equal(p.tokens.length,1);assert.equal(p.totalValue,1.2345);assert.equal(p.tokens[0].price,1);assert.equal(p.transactionCount,9);
  assert.equal(p.nftCount,null);assert.equal(p.change24h,null);assert.equal(p.tokens[0].change24h,null);assert.equal(ercCalls,0);
  assert.doesNotThrow(()=>JSON.stringify(p));
 }finally{global.fetch=saved;}
});
test('a wrong-chain RPC and RPC failure cannot produce a demo portfolio',async()=>{
 const base={getChainId:async()=>1};
 const api=source('lib/ascope-mainnet.ts',clientDeps(base));
 await assert.rejects(()=>api.readPortfolio('0x'+'11'.repeat(20)),/not Arc Mainnet/);
 base.getChainId=async()=>{throw new Error('RPC offline')};
 await assert.rejects(()=>api.readPortfolio('0x'+'11'.repeat(20)),/RPC offline/);
});
test('unpriced real tokens retain balances but are not valued as zero-price assets',async()=>{
 const saved=global.fetch;const other='0x'+'22'.repeat(20);
 global.fetch=async url=>({ok:true,json:async()=>String(url).includes('/pools?')?{included:[{type:'token',id:'arc_'+other,attributes:{address:other}}]}:{data:{id:'arc_'+other,attributes:{price_usd:null}}}});
 try{
  const api=source('lib/ascope-mainnet.ts',clientDeps({getChainId:async()=>5042,getBlock:async()=>({number:100n}),getBalance:async()=>1000000000000000000n,getTransactionCount:async()=>0,getCode:async()=> '0x6000',readContract:async args=>({balanceOf:2000000n,name:'Actual token',symbol:'REAL',decimals:6,totalSupply:100000000n})[args.functionName]}));
  const p=await api.readPortfolio('0x'+'11'.repeat(20));
  assert.equal(p.tokens[1].balance,2);assert.equal(p.tokens[1].price,null);assert.equal(p.tokens[1].value,null);assert.equal(p.totalValue,1);
 }finally{global.fetch=saved;}
});
const activity=()=>source('lib/ascope-activity.ts',{...cache,'./ascope-mainnet':{},'./chains':{arcMainnet:chain},'./live-feeds':{TRANSFER_TOPIC:'',USDC_EMITTER:''}});
test('nonce indexing locates a sparse outgoing transaction over twenty million blocks without scanning blocks',async()=>{
 const {outgoingBlocks}=activity();let calls=0;
 const blocks=await outgoingBlocks(1,20000000,0,1,0,async b=>{calls++;return b>=17000123?1:0});
 assert.deepEqual(blocks,[17000123]);assert.ok(calls<30);
});
test('transaction pages prune old nonce ranges and reject invalid historical counters',async()=>{
 const {outgoingBlocks}=activity();
 const blocks=await outgoingBlocks(1,1000,0,3,2,async b=>b>=900?3:b>=700?2:b>=300?1:0);
 assert.deepEqual(blocks,[900]);
 await assert.rejects(()=>outgoingBlocks(1,1000,0,3,0,async()=>4),/Invalid historical/);
 await assert.rejects(()=>outgoingBlocks(1,1000,3,1,0,async()=>1),/backwards/);
});
test('archive history chooses actual timestamp boundaries including repeated timestamps, and excludes pre-genesis dates',async()=>{
 const {blockAtTime}=source('lib/ascope-history.ts',{...cache,'./ascope-mainnet':{},'./chains':{arcMainnet:chain}});
 const times=[100,101,101,103,105,105,110];
 assert.equal(await blockAtTime(101,0,6,async n=>times[n]),2);
 assert.equal(await blockAtTime(104,0,6,async n=>times[n]),3);
 assert.equal(await blockAtTime(105,0,6,async n=>times[n]),5);
 assert.equal(await blockAtTime(99,0,6,async n=>times[n]),null);
 assert.equal(await blockAtTime(110,0,6,async n=>times[n]),6);
});
test('unconfigured DeFi and DAO coverage reports unavailable rather than empty positions or invented memberships',async()=>{
 const savedVaults=process.env.ASCOPE_ERC4626_VAULTS,savedTokens=process.env.ASCOPE_GOVERNANCE_TOKENS;
 delete process.env.ASCOPE_ERC4626_VAULTS;delete process.env.ASCOPE_GOVERNANCE_TOKENS;
 try{
  const api=source('lib/ascope-indexer.ts',{...cache,'./ascope-mainnet':{verifyMainnet:async()=>true}});
  await assert.rejects(()=>api.readDefi('0x'+'11'.repeat(20)),/not been configured/);
  await assert.rejects(()=>api.readDaos('0x'+'11'.repeat(20)),/not been configured/);
 }finally{if(savedVaults!==undefined)process.env.ASCOPE_ERC4626_VAULTS=savedVaults;if(savedTokens!==undefined)process.env.ASCOPE_GOVERNANCE_TOKENS=savedTokens;}
});
test('an inaccessible NFT index is an error, not a false no-NFT result',async()=>{
 const saved=global.fetch;global.fetch=async()=>({ok:false,status:403});
 try{
  const api=source('lib/ascope-indexer.ts',{...cache,'./ascope-mainnet':{verifyMainnet:async()=>true}});
  await assert.rejects(()=>api.readNfts('0x'+'11'.repeat(20),null),/indexer unavailable/);
 }finally{global.fetch=saved;}
});

test('historical nonce at genesis sends 0x0 explicitly rather than reading latest',async()=>{let params;const api=source('lib/ascope-activity.ts',{...cache,'./ascope-mainnet':{mainnetClient:{request:async args=>{params=args.params;return '0x0'}}},'./chains':{arcMainnet:chain},'./live-feeds':{TRANSFER_TOPIC:'',USDC_EMITTER:''}});assert.equal(await api.readHistoricalNonce('0x'+'11'.repeat(20),'0'),0);assert.equal(params[1],'0x0');});

test('earlier transaction pages skip all newer nonce ranges',async()=>{const {outgoingBlocks}=activity();const readCount=async b=>b>=900?3:b>=700?2:b>=300?1:0;assert.deepEqual(await outgoingBlocks(1,1000,0,3,1,readCount,2),[700]);});
