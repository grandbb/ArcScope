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
