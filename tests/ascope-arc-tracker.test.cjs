const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const mod = { exports: {} };
new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/ascope-arc-tracker.ts'), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText)(require, mod, mod.exports);
const parse = mod.exports.parseArcTracker;
const fixtures = ['source', 'holders', 'transfers'].map(key => fs.readFileSync(path.join(__dirname, 'fixtures/ascope-arc', `${key}.html`), 'utf8'));
test('parses observed ArcScan supply, ranked holders and latest 10 transfers', () => {
  const data = parse(...fixtures);
  assert.equal(data.supply, 10000000000);
  assert.equal(data.holderCount, 36);
  assert.equal(data.holders.length, 10);
  assert.equal(data.holders[0].balance, 1500000000);
  assert.equal(data.holders[0].share, 15);
  assert.equal(data.holders[0].label, null);
  assert.equal(data.other + data.holders.reduce((sum, h) => sum + h.balance, 0), data.supply);
  assert.equal(data.transfers.length, 10);
  assert.equal(data.transfers[0].amount, 25163231.45);
  assert.equal(data.transfers[0].to, '0xea7705a14aeba2633c3aa33646ed83dd2cd7bbd0');
  assert.equal(new Date(data.transfers[0].timestamp).toISOString(), '2026-10-14T22:51:10.000Z');
});
test('rejects error pages and truncated rankings rather than showing empty data', () => {
  for (let i = 0; i < 3; i++) { const broken = [...fixtures]; broken[i] = '<html>Unavailable</html>'; assert.throws(() => parse(...broken)); }
  assert.throws(() => parse(fixtures[0], fixtures[1].replace(/<tr>[\s\S]*?<\/tr>/, ''), fixtures[2]));
});
test('rejects a different token, invalid balances and invalid transfer destinations', () => {
  assert.throws(() => parse(fixtures[0].replace('Arc (ARC)', 'Other (OTHER)'), fixtures[1], fixtures[2]));
  assert.throws(() => parse(fixtures[0], fixtures[1].replace('title="1,500,000,000"', 'title="-1"'), fixtures[2]));
  assert.throws(() => parse(fixtures[0], fixtures[1], fixtures[2].replace('a=0xea7705a14aeba2633c3aa33646ed83dd2cd7bbd0', 'a=bad')));
});
test('reads full public names and reuses them across holders and transfer endpoints', () => {
  const sender = '0x67e2a7ad4e9c2cfe63a265a053f87fb675ac1269';
  const recipient = '0xea7705a14aeba2633c3aa33646ed83dd2cd7bbd0';
  // Synthetic names test parser behavior; they are not real owner attributions.
  const holders = fixtures[1].replace(`title="${sender}"`, `title="Example Treasury (${sender})"`);
  const transfers = fixtures[2].replace(`title="${recipient}"`, `title="Example Custodian (${recipient})"`);
  const data = parse(fixtures[0], holders, transfers);
  assert.equal(data.holders[9].label, 'Example Treasury');
  assert.ok(data.transfers.every(tx => tx.fromLabel === 'Example Treasury'));
  assert.equal(data.transfers[0].toLabel, 'Example Custodian');
  assert.equal(data.transfers[1].toLabel, null);
  assert.equal(data.transfers[0].from, sender);
  assert.equal(data.transfers[0].to, recipient);
});
test('a public name in transfers also labels its holder and repeated sender', () => {
  const sender = '0x67e2a7ad4e9c2cfe63a265a053f87fb675ac1269';
  const transfers = fixtures[2].replace(`title="${sender}"`, 'title="Example Distribution"');
  const data = parse(fixtures[0], fixtures[1], transfers);
  assert.equal(data.holders[9].label, 'Example Distribution');
  assert.ok(data.transfers.every(tx => tx.fromLabel === 'Example Distribution'));
});
test('unlabeled and shortened addresses never become public names', () => {
  const data = parse(...fixtures);
  assert.ok(data.holders.slice(0, 9).every(h => h.label === null));
  assert.equal(data.holders[9].label, 'FBO ARC presale');
  assert.ok(data.transfers.every(tx => tx.fromLabel === 'FBO ARC presale' && tx.toLabel === null));
});
test('Arc Explorer names match mixed-case addresses in both live and fallback data', () => {
  const sender = '0x67e2a7ad4e9c2cfe63a265a053f87fb675ac1269';
  const mixed = '0x67E2a7Ad4e9c2cFE63A265a053F87Fb675AC1269';
  const data = parse(...fixtures.map(html => html.replaceAll(`a=${sender}`, `a=${mixed}`)));
  assert.equal(data.holders[9].address, mixed);
  assert.equal(data.holders[9].label, 'FBO ARC presale');
  assert.ok(data.transfers.every(tx => tx.from === mixed && tx.fromLabel === 'FBO ARC presale'));
  const fallback = require('../public/ascope-arc-snapshot.json');
  assert.equal(fallback.holders[9].label, data.holders[9].label);
  assert.ok(fallback.transfers.every(tx => tx.fromLabel === 'FBO ARC presale'));
});
