// Use the same on-chain reader as the production API without a Next.js runtime.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
const { createPublicClient, custom, http } = require('viem');
const sourcePath = path.resolve(__dirname, '../lib/ascope-arc-chain.ts');
const moduleObject = { exports: {} };
const source = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
new Function('require', 'module', 'exports', source)(createRequire(sourcePath), moduleObject, moduleObject.exports);
const rpc = http(process.env.ASCOPE_ARC_RPC_URL || 'https://rpc.mainnet.arc.io', { timeout: 15000, retryCount: 2 })({ retryCount: 0 });
let nextRequest = 0;
const transport = custom({ request: async args => {
  const start = Math.max(Date.now(), nextRequest);
  nextRequest = start + 200;
  if (start > Date.now()) await new Promise(resolve => setTimeout(resolve, start - Date.now()));
  return rpc.request(args);
}}, { retryCount: 2, retryDelay: 1000 });
const client = createPublicClient({ transport });
async function main() {
  const snapshotPath = path.resolve(__dirname, '../public/ascope-arc-snapshot.json');
  const previous = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const snapshot = await moduleObject.exports.refreshArcOnChain(client, previous);
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2) + '\n');
  console.log(`Verified ARC at finalized block ${snapshot.checkedBlock}: ${snapshot.holderCount} holders, ${snapshot.transfers.length} latest transfers; checked ${snapshot.updatedAt}`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
