const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
const sourcePath = path.resolve(__dirname, '../lib/ascope-arc-chain.ts');
const mod = { exports: {} };
new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText)(createRequire(sourcePath), mod, mod.exports);
const { refreshArcOnChain } = mod.exports;
const a = '0x1111111111111111111111111111111111111111';
const b = '0x2222222222222222222222222222222222222222';
const c = '0x3333333333333333333333333333333333333333';
const hash = '0x' + 'a'.repeat(64);
const previous = { supply: 100, holderCount: 1, holders: [{ address: a, balance: 100, share: 100, label: null }], other: 0, transfers: [], checkedBlock: 100, holderAddresses: [a], updatedAt: '2026-10-26T00:00:00Z' };
function provider(head, balances, logs = []) {
  const ranges = [];
  return {
    ranges,
    getChainId: async () => 5042,
    getBlock: async () => ({ number: BigInt(head), timestamp: BigInt(1793000000) }),
    getLogs: async ({ fromBlock, toBlock }) => {
      ranges.push([fromBlock, toBlock]);
      return logs.filter(log => log.blockNumber >= fromBlock && log.blockNumber <= toBlock);
    },
    readContract: async ({ functionName, args, blockNumber }) => {
      assert.equal(blockNumber, BigInt(head));
      if (functionName === 'decimals') return 0;
      if (functionName === 'totalSupply') return BigInt(100);
      return BigInt(balances[args[0]] ?? 0);
    },
  };
}
function log(from, to, blockNumber, logIndex) {
  return { transactionHash: hash, blockNumber: BigInt(blockNumber), logIndex, args: { from, to, value: BigInt(10) } };
}
test('scans all ranges, discovers holders, retains multiple transfers in one transaction and persists the registry', async () => {
  const client = provider(20101, { [a]: 80, [b]: 10, [c]: 10 }, [log(a, b, 101, 0), log(a, c, 20101, 1)]);
  const data = await refreshArcOnChain(client, previous);
  assert.deepEqual(client.ranges, [[101n, 10100n], [10101n, 20100n], [20101n, 20101n]]);
  assert.equal(data.holderCount, 3);
  assert.equal(data.transfers.length, 2);
  assert.deepEqual(data.holderAddresses, [a, b, c]);
  assert.equal(data.checkedBlock, 20101);
  assert.equal(data.transfers[0].to, c);
  const next = await refreshArcOnChain(provider(20102, { [a]: 80, [b]: 10, [c]: 10 }), data);
  assert.equal(next.holderCount, 3);
  assert.deepEqual(next.holderAddresses, [a, b, c]);
  assert.equal(next.transfers.length, 2);
});
test('rejects incomplete registry instead of publishing an incorrect holder count', async () => {
  await assert.rejects(refreshArcOnChain(provider(101, { [a]: 90 }), previous), /reconcile/);
});
test('rejects the wrong chain, regressed finalized block and incomplete logs', async () => {
  const wrongChain = provider(101, { [a]: 100 });
  wrongChain.getChainId = async () => 5042002;
  await assert.rejects(refreshArcOnChain(wrongChain, previous), /not Arc Mainnet/);
  await assert.rejects(refreshArcOnChain(provider(99, { [a]: 100 }), previous), /behind/);
  const incomplete = { ...log(a, b, 101, 0), transactionHash: null };
  await assert.rejects(refreshArcOnChain(provider(101, { [a]: 90, [b]: 10 }, [incomplete]), previous), /Incomplete finalized/);
});
