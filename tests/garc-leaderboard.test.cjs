const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const moduleUnderTest = { exports: {} };
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/garc-leaderboard.ts'), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
new Function('require', 'module', 'exports', code)(require, moduleUnderTest, moduleUnderTest.exports);
const { rankGarcEvents, paginateGarc } = moduleUnderTest.exports;
const wallet = n => `0x${'ab'.repeat(18)}${n.toString(16).padStart(4, '0')}`;
const event = (n, address, count = 1) => ({ wallet: address, walletCount: BigInt(count), totalCount: BigInt(n), timestamp: 1000n + BigInt(n), transactionHash: `0x${n.toString(16).padStart(64, '0')}`, logIndex: 0 });
const snapshot = entries => ({ entries, totalGreetings: '102', blockNumber: '25440000', updatedAt: '2026-10-11T16:00:00Z' });

test('ranks most greetings first and uses first greeting to break ties regardless of RPC order', () => {
  const events = [event(1, wallet(1)), event(2, wallet(2)), event(3, wallet(3)), event(4, wallet(3), 2), event(5, wallet(2), 2)];
  const result = rankGarcEvents(events.reverse(), 5n);
  assert.deepEqual(result.map(entry => [entry.rank, entry.wallet.toLowerCase(), entry.count]), [[1, wallet(2), '2'], [2, wallet(3), '2'], [3, wallet(1), '1']]);
  assert.equal(result[0].lastGreetingAt, 1005);
});

test('100 entries per page, rank 101 on page two; search looks across all pages and ignores address case', () => {
  const entries = rankGarcEvents(Array.from({ length: 102 }, (_, i) => event(i + 1, wallet(i + 1))), 102n);
  const first = paginateGarc(snapshot(entries), 1, wallet(101).toUpperCase().replace('0X', '0x'), wallet(500));
  assert.equal(first.entries.length, 100);
  assert.equal(first.entries[99].rank, 100);
  assert.equal(first.totalPages, 2);
  assert.equal(first.search.entry.rank, 101);
  assert.equal(first.search.page, 2);
  const second = paginateGarc(snapshot(entries), 2, null, wallet(500));
  assert.deepEqual(second.entries.map(entry => entry.rank), [101, 102]);
  assert.equal(paginateGarc(snapshot(entries), 999, null, wallet(500)).page, 2);
});

test('non-participants and an empty contract do not invent ranks', () => {
  const entries = rankGarcEvents([], 0n);
  const result = paginateGarc({ ...snapshot(entries), totalGreetings: '0' }, 1, wallet(10), wallet(500));
  assert.equal(result.totalWallets, 0);
  assert.equal(result.totalPages, 1);
  assert.equal(result.search.entry, null);
  assert.equal(result.search.page, null);
});

test('overlapping duplicate logs do not increase counts; incomplete or truncated histories are rejected', () => {
  const one = event(1, wallet(1));
  assert.equal(rankGarcEvents([one, one], 1n)[0].count, '1');
  assert.throws(() => rankGarcEvents([one], 2n), /Incomplete/);
  assert.throws(() => rankGarcEvents([event(2, wallet(1))], 1n), /Invalid/);
  assert.throws(() => rankGarcEvents([event(1, wallet(1), 2)], 1n), /Incomplete wallet/);
});

test('invalid page and wallet input is rejected before returning any ranking', () => {
  for (const page of [0, -1, 1.2, Infinity, NaN]) assert.throws(() => paginateGarc(snapshot([]), page, null, wallet(500)), /Invalid page/);
  assert.throws(() => paginateGarc(snapshot([]), 1, '0x123', wallet(500)), /complete EVM/);
});

function loadSource(file, dependencies = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', output)(name => dependencies[name] ?? require(name), module, module.exports);
  return module.exports;
}
const index = loadSource('lib/ascope-garc-index.ts', { './garc-leaderboard': moduleUnderTest.exports });
const bootstrap = require('../public/contracts/ascope-garc-index.json');
const serializedEvent = n => ({ ...event(n, wallet(1), n), walletCount: String(n), totalCount: String(n), timestamp: String(1000 + n) });

test('unchanged counters skip millions of empty blocks without history requests', async () => {
  let calls = 0;
  const result = await index.readChangedGarcEvents(1n, 20000000n, 10n, 10n, {
    countAt: async () => { calls++; return 10n; }, events: async () => { calls++; return []; },
  });
  assert.deepEqual(result, []);
  assert.equal(calls, 0);
});

test('sparse updates fetch one small log range instead of scanning the whole chain gap', async () => {
  let counters = 0; const ranges = []; const eventBlock = 15000001n;
  const result = await index.readChangedGarcEvents(1n, 20000000n, 10n, 11n, {
    countAt: async block => { counters++; return block >= eventBlock ? 11n : 10n; },
    events: async (from, to) => { ranges.push([from, to]); return [serializedEvent(11)]; },
  });
  assert.equal(result.length, 1);
  assert.ok(counters <= 13);
  assert.equal(ranges.length, 1);
  assert.ok(ranges[0][1] - ranges[0][0] < 5000n);
  assert.ok(ranges[0][0] <= eventBlock && ranges[0][1] >= eventBlock);
});

test('incremental history rejects dropped events and counters moving backwards', async () => {
  await assert.rejects(index.readChangedGarcEvents(1n, 50n, 10n, 12n, { countAt: async () => 10n, events: async () => [serializedEvent(11)] }), /Incomplete/);
  await assert.rejects(index.readChangedGarcEvents(1n, 50n, 10n, 9n, { countAt: async () => 9n, events: async () => [] }), /backwards/);
});

function serverHarness(options = {}) {
  const calls = { logs: 0, blocks: 0, counters: 0 }; const start = BigInt(bootstrap.blockNumber);
  const seedCount = BigInt(bootstrap.totalGreetings); const head = start + 100n;
  const cached = new Map();
  const rpc = {
    getBlock: async () => { calls.blocks++; if (options.outage) throw Error('RPC unavailable'); return { number: head, hash: `0x${'b'.repeat(64)}` }; },
    readContract: async () => { calls.counters++; return seedCount + BigInt(options.additional ?? 0); },
    getContractEvents: async args => {
      calls.logs++;
      assert.ok(args.fromBlock > start, 'must not scan already verified bootstrap blocks');
      const last = bootstrap.events.at(-1);
      const extra = { wallet: last.wallet, walletCount: BigInt(last.walletCount) + 1n, totalCount: seedCount + 1n, timestamp: BigInt(last.timestamp) + 1n, message: index.DEPLOYED_GARC_EVENT_MESSAGE };
      return [{ removed: false, args: extra, transactionHash: `0x${'c'.repeat(64)}`, logIndex: 0 }];
    },
  };
  const server = loadSource('lib/garc-leaderboard-server.ts', {
    'next/cache': { unstable_cache: (fn, keys) => async (...args) => {
      const key = JSON.stringify([keys, args]);
      if (!cached.has(key)) cached.set(key, await fn(...args));
      return cached.get(key);
    } },
    viem: { createPublicClient: () => rpc, http: () => ({}) },
    './chains': { arcMainnet: { id: 5042, rpcUrls: { default: { http: ['https://test.invalid'] } } } },
    './garc': { GARC_CONTRACT_ADDRESS: bootstrap.contract, verifyGarcContract: async () => {} },
    './generated/garc': { garcAbi: [] },
    './ascope-garc-index': index,
    '@/public/contracts/ascope-garc-index.json': bootstrap,
  });
  return { server, calls };
}

test('server reuses its verified checkpoint without any historical log requests when unchanged', async () => {
  const h = serverHarness();
  const [first, concurrent] = await Promise.all([h.server.getGarcLeaderboard(), h.server.getGarcLeaderboard()]);
  assert.deepEqual(concurrent, first);
  const second = await h.server.getGarcLeaderboard();
  assert.equal(first.totalGreetings, bootstrap.totalGreetings);
  assert.deepEqual(second, first);
  assert.equal(h.calls.logs, 0);
  assert.equal(h.calls.blocks, 1);
  assert.equal(h.calls.counters, 1);
});

test('one newly confirmed greeting extends the checkpoint and changes the true wallet count', async () => {
  const h = serverHarness({ additional: 1 });
  const result = await h.server.getGarcLeaderboard();
  assert.equal(result.totalGreetings, String(BigInt(bootstrap.totalGreetings) + 1n));
  assert.equal(result.entries[0].count, String(BigInt(bootstrap.events.at(-1).walletCount) + 1n));
  assert.equal(h.calls.logs, 1);
  assert.equal(result.syncDelayed, undefined);
});

test('RPC outages and truncated updates preserve verified rankings instead of erasing them', async () => {
  for (const options of [{ outage: true }, { additional: 2 }]) {
    const h = serverHarness(options);
    const result = await h.server.getGarcLeaderboard();
    assert.equal(result.totalGreetings, bootstrap.totalGreetings);
    assert.equal(result.blockNumber, bootstrap.blockNumber);
    assert.equal(result.updatedAt, bootstrap.updatedAt);
    assert.equal(result.syncDelayed, true);
    assert.deepEqual(result.entries, index.checkpointSnapshot(bootstrap).entries);
  }
});
