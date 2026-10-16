const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const mod = { exports: {} };
new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/ascope-arc-tracker.ts'), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText)(require, mod, mod.exports);
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
