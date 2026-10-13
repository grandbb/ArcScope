const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), ts = require("typescript");
function load(file, deps = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function("require", "module", "exports", code)(name => deps[name] ?? require(name), module, module.exports);
  return module.exports;
}
const movers = load("lib/ascope-dex-movers.ts");
const address = n => `0x${n.toString(16).padStart(40, "0")}`;
const pair = (n, change, liquidity = 20000, extra = {}) => ({
  chainId: "arc", pairAddress: address(n + 100), baseToken: { address: address(n), name: `Token ${n}`, symbol: `T${n}` },
  quoteToken: { address: movers.ARC_MOVERS_QUOTES[0] }, priceUsd: "1.25",
  liquidity: { usd: liquidity }, volume: { h24: 500 }, priceChange: { h24: change }, ...extra,
});
test("movers rank absolute gains and losses using the most liquid pool per contract", () => {
  const data = movers.dexScreenerMovers([[pair(1, 90, 15000), pair(2, -40), pair(1, 20, 30000), pair(3, 35)]]);
  assert.deepEqual(data.map(t => t.address), [address(2), address(3), address(1)]);
  assert.deepEqual(data.map(t => t.rank), [1, 2, 3]);
  assert.equal(data[0].sourceUrl, `https://dexscreener.com/arc/${address(102)}`);
  assert.equal(data[0].change1h, null);
  assert.equal(data[0].change7d, null);
  assert.equal(data[0].marketCap, null);
});
test("foreign chains, invalid prices, low liquidity, and missing movement do not enter rankings", () => {
  const data = movers.dexScreenerMovers([[pair(1, 20, 9999), pair(2, 20, 20000, { chainId: "ethereum" }),
    pair(3, 20, 20000, { priceUsd: null }), pair(4, null), pair(5, 20, 20000, { priceUsd: "NaN" }),
    pair(6, 20, 20000, { quoteToken: { address: address(999) } }), pair(7, -12, 20000, {
      pairAddress: `0x${"ab".repeat(32)}`, quoteToken: { address: movers.ARC_MOVERS_QUOTES[1] },
    })]]);
  assert.equal(data.length, 1);
  assert.equal(data[0].address, address(7));
  assert.match(data[0].sourceUrl, /abab/);
  assert.throws(() => movers.dexScreenerMovers([{}]), /Invalid/);
});
test("ranking caps at ten and never fabricates data after a provider failure", async () => {
  const data = movers.dexScreenerMovers([Array.from({ length: 12 }, (_, n) => pair(n + 1, n + 1))]);
  assert.equal(data.length, 10);
  assert.equal(data[0].change24h, 12);
  await assert.rejects(() => movers.readArcDexMovers(async () => { throw new Error("offline"); }), /unavailable/);
});
test("movers API calls only DEX Screener, including both USDC representations", async () => {
  const saved = global.fetch, calls = [];
  global.fetch = async url => { calls.push(url); return { ok: true, json: async () => [pair(1, -25)] }; };
  try {
    const route = load("app/api/trending/route.ts", {
      "next/server": { NextResponse: { json: (body, options) => ({ body, ...options }) } },
      "@/lib/ascope-dex-movers": movers,
    });
    const response = await route.GET();
    assert.equal(response.body.meta.source, "DEX Screener");
    assert.equal(response.body.data.length, 1);
    assert.equal(calls.length, 2);
    assert.ok(calls.every(url => url.startsWith("https://api.dexscreener.com/token-pairs/v1/arc/")));
  } finally { global.fetch = saved; }
});
