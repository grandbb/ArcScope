const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const viem = require('viem');
const root = path.join(__dirname, '..');
function load(file, dependencies = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'module', 'exports', code)(name => dependencies[name] ?? require(name), module, module.exports);
  return module.exports;
}
const rankings = load('lib/garc-leaderboard.ts');
const index = load('lib/ascope-garc-index.ts', { './garc-leaderboard': rankings });
const { garcAbi } = load('lib/generated/garc.ts');
const deployment = require('../public/contracts/ArcGarc.mainnet.json');
const client = viem.createPublicClient({ transport: viem.http(process.env.NEXT_PUBLIC_ARC_RPC_URL || 'https://rpc.mainnet.arc.io', { batch: true, timeout: 10000, retryCount: 2, retryDelay: 1000 }) });

(async () => {
  if (await client.getChainId() !== deployment.chainId) throw Error('RPC chain mismatch');
  const [code, block] = await Promise.all([client.getCode({ address: deployment.contractAddress }), client.getBlock({ blockTag: 'finalized' })]);
  if (!code || viem.keccak256(code) !== deployment.runtimeCodeHash) throw Error('Existing deployed runtime does not match');
  const countAt = blockNumber => client.readContract({ address: deployment.contractAddress, abi: garcAbi, functionName: 'totalGreetings', blockNumber });
  const total = await countAt(block.number);
  const events = await index.readChangedGarcEvents(BigInt(deployment.blockNumber), block.number, 0n, total, {
    countAt,
    events: async (fromBlock, toBlock) => {
      const logs = await client.getContractEvents({ address: deployment.contractAddress, abi: garcAbi, eventName: 'Garc', fromBlock, toBlock, strict: true });
      return logs.filter(log => !log.removed && log.args.message === index.DEPLOYED_GARC_EVENT_MESSAGE).map(log => ({ wallet: log.args.wallet, walletCount: String(log.args.walletCount), totalCount: String(log.args.totalCount), timestamp: String(log.args.timestamp), transactionHash: log.transactionHash, logIndex: log.logIndex }));
    },
  });
  const checkpoint = { chainId: deployment.chainId, contract: deployment.contractAddress, blockNumber: String(block.number), blockHash: block.hash, totalGreetings: String(total), updatedAt: new Date().toISOString(), events };
  const snapshot = index.checkpointSnapshot(checkpoint);
  fs.writeFileSync(path.join(root, 'public/contracts/ascope-garc-index.json'), JSON.stringify(checkpoint, null, 2) + '\n');
  console.log(JSON.stringify({ verifiedBlock: checkpoint.blockNumber, totalGreetings: checkpoint.totalGreetings, wallets: snapshot.entries.length }));
})().catch(error => { console.error(error.shortMessage || error.message); process.exitCode = 1; });
