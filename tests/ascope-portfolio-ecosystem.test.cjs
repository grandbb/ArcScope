const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
function source(file,deps={}){
 const mod={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
 new Function('require','module','exports',code)(name=> name in deps?deps[name]:name==='next/cache'?{unstable_cache:fn=>fn}:name.startsWith('.')?source('lib/'+name.slice(2)+'.ts',deps):require(name),mod,mod.exports);return mod.exports;
}
const discovery=source('lib/ascope-wallet-discovery.ts');
const address='0x11315Cce8f009e4CB4234FFEAF2E860b84E5b0f6';
const fixture=fs.readFileSync(path.join(__dirname,'fixtures/ascope-portfolio/wallet.html'),'utf8');
test('discovers every reported ERC20 and NFT collection, without the former 30-token cap',()=>{
 const d=discovery.parseWalletDiscovery(fixture,address);
 assert.equal(d.tokens.length,31);assert.equal(d.collections.length,10);
 assert.equal(d.collections.reduce((n,c)=>n+c.count,0),38);
 assert.equal(d.collections.find(c=>c.symbol==='UNI-V4-POSM').address,'0x6049c9a0e26405c0985f9e3685c87d0ae917f82b');
 assert.ok(d.tokens.some(t=>t.symbol==='EURC'&&t.price>0));
 assert.ok(d.tokens.some(t=>t.price===null));
});
test('fails closed for missing/truncated holdings and address mismatches',()=>{
 assert.throws(()=>discovery.parseWalletDiscovery('<html>Error</html>',address));
 assert.throws(()=>discovery.parseWalletDiscovery(fixture.replace('ERC-20 Tokens (31)','ERC-20 Tokens (32)'),address));
 assert.throws(()=>discovery.parseWalletDiscovery(fixture,'0x'+'22'.repeat(20)));
});
test('blocked discovery uses a contract catalog without embedding wallet balances or quotes',async()=>{
 const saved=global.fetch;global.fetch=async()=>({ok:false,status:403});
 try{const d=await discovery.readWalletDiscovery(address);assert.equal(d.discovery,'catalog');assert.equal(d.tokens.length,31);assert.equal(d.collections.length,10);assert.ok(d.tokens.every(t=>t.price===null));assert.ok(!JSON.stringify(d).includes(address));assert.match(d.discoveryIssue,/403/);}finally{global.fetch=saved;}
});
test('NFT inventory uses token IDs rather than collection counts or transfer counts',()=>{
 const html=fs.readFileSync(path.join(__dirname,'fixtures/ascope-portfolio/inventory.html'),'utf8');
 const data=discovery.parseNftInventory(html,'0x6049c9a0e26405c0985f9e3685c87d0ae917f82b','Uniswap v4 Positions NFT');
 assert.equal(data.total,1);assert.equal(data.items.length,1);assert.equal(data.items[0].tokenId,'293963');assert.equal(data.pageCount,1);
 assert.throws(()=>discovery.parseNftInventory('<html>Unavailable</html>','0x'+'11'.repeat(20),'NFT'));
});
const deps={'./ascope-mainnet':{USDC_ADDRESS:'0x3600000000000000000000000000000000000000'},'./ascope-wallet-discovery':{}};
const {liquidityPrincipal,positionTicks,accruedFees,portfolioTotals}=source('lib/ascope-portfolio.ts',deps);
test('Uniswap principal respects both tick boundaries and signed position ticks',()=>{
 const l=1000000n,a=liquidityPrincipal(l,2n**96n,-100,100);assert.ok(a[0]>0&&a[1]>0);assert.ok(Math.abs(a[0]-a[1])<1e-7);
 assert.equal(liquidityPrincipal(l,2n**95n,-100,100)[1],0);
 assert.equal(liquidityPrincipal(l,2n**97n,-100,100)[0],0);
 const info=(BigInt.asUintN(24,-100n)<<8n)|(100n<<32n);assert.deepEqual(positionTicks(info),[-100,100]);
 assert.throws(()=>liquidityPrincipal(l,0n,-100,100));assert.throws(()=>liquidityPrincipal(l,2n**96n,100,-100));
});
test('fee growth handles in-range, out-of-range and uint256 rollover',()=>{
 const q=2n**128n;
 assert.equal(accruedFees(100n,0,-10,10,10n*q,1n*q,2n*q,4n*q),300n);
 assert.equal(accruedFees(100n,-20,-10,10,0n,8n*q,2n*q,4n*q),200n);
 assert.equal(accruedFees(100n,20,-10,10,0n,2n*q,8n*q,4n*q),200n);
 assert.equal(accruedFees(1n,0,-10,10,1n*q,0n,0n,(2n**256n)-q),2n);
});
test('wallet plus DeFi subtracts debt and excludes receipt tokens exactly once',()=>{
 const tokens=[{address:'0xAa',value:100},{address:'0xBb',value:50},{address:'0xCc',value:null}];
 const positions=[{value:60,debt:20,receiptToken:'0xbb'},{value:5}];
 const p=portfolioTotals(tokens,positions);assert.equal(p.walletValue,100);assert.equal(p.defiValue,65);assert.equal(p.defiDebt,20);assert.equal(p.totalValue,145);
 assert.equal(portfolioTotals([{address:'a',value:1}],[{value:1,debt:5}]).totalValue,-3);
});
const llama=source('lib/ascope-defillama.ts');
test('DefiLlama ranks by Arc TVL, without confusing global or borrowed TVL',()=>{
 const p=llama.arcProtocols([{name:'Global giant',slug:'a',tvl:1e12,chainTvls:{Arc:2,'Arc-borrowed':99}},{name:'Arc leader',slug:'b',tvl:3,chainTvls:{Arc:3}},{name:'Not on Arc',slug:'c',tvl:1e15,chainTvls:{Ethereum:1e15}}]);
 assert.deepEqual(p.map(x=>x.tvl),[3,2]);assert.deepEqual(p.map(x=>x.slug),['b','a']);
});
test('stablecoin capitalization sums USD-converted currencies and uses a seven-day baseline',()=>{
 const p=llama.stablecoinSummary([{date:'100',totalCirculatingUSD:{peggedUSD:100,peggedEUR:20}},{date:String(100+7*86400),totalCirculatingUSD:{peggedUSD:120,peggedEUR:24}}]);assert.equal(p.value,144);assert.ok(Math.abs(p.change7d-20)<1e-9);
 assert.throws(()=>llama.stablecoinSummary([]));assert.throws(()=>llama.parseTvlHistory({}));
});
test('complete provider failures retain priced wallet assets and mark DeFi unavailable',async()=>{
 const saved=global.fetch;global.fetch=async()=>{throw Error('offline')};
 try{const api=source('lib/ascope-portfolio.ts',{'./ascope-mainnet':{...deps['./ascope-mainnet'],readPortfolio:async()=>({tokens:[{address:deps['./ascope-mainnet'].USDC_ADDRESS,value:10}],blockNumber:'1',coverage:'wallet',coverageIssues:[],totalValue:10})},'./ascope-wallet-discovery':{readWalletDiscovery:async()=>{throw Error('offline')}}});const p=await api.readFullPortfolio(address);assert.equal(p.totalValue,10);assert.equal(p.defiValue,null);assert.equal(p.defiDebt,null);assert.equal(p.coverageIssues.length,3);assert.deepEqual(p.defiSources,[]);}finally{global.fetch=saved;}
});
