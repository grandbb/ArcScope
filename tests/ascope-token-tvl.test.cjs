const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(file, dependencies = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function("require", "module", "exports", code)(name => dependencies[name] ?? require(name), module, module.exports);
  return module.exports;
}
const tvl = load("lib/ascope-token-tvl.ts");
const address = n => `0x${n.toString(16).padStart(40, "0")}`;
const token = (n, reserve, extra = {}) => ({
  id: `arc_${address(n)}`, type: "token",
  attributes: { address: address(n), name: `Token ${n}`, symbol: `T${n}`,
    total_reserve_in_usd: reserve, price_usd: null, volume_usd: { h24: null }, ...extra },
});
const pool = (n, base, quote, network = "arc") => ({
  id: `${network}_${address(n)}`, type: "pool", attributes: { reserve_in_usd: "999999999" },
  relationships: {
    base_token: { data: { id: `${network}_${address(base)}` } },
    quote_token: { data: { id: `${network}_${address(quote)}` } },
  },
});

test("discovery includes quote tokens, deduplicates pools and addresses, and excludes other chains", () => {
  const result = tvl.discoverArcTvlTokens([
    { data: [pool(100, 1, 2), pool(101, 1, 3), pool(102, 5, 6, "eth")] },
    { data: [pool(100, 1, 2)] },
  ]);
  assert.deepEqual(result, { addresses: [address(1), address(2), address(3)], poolsScanned: 2 });
  assert.throws(() => tvl.discoverArcTvlTokens([{}]), /Invalid/);
  assert.throws(() => tvl.discoverArcTvlTokens([{ data: [{ ...pool(100, 1, 2), relationships: {} }] }]), /addresses unavailable/);
});

test("ranking uses token reserves, limits to 10, and never sums duplicate token or pair TVL", () => {
  const tokens = Array.from({ length: 12 }, (_, i) => token(i + 1, String((i + 1) * 100)));
  const result = tvl.rankArcTvlTokens([{ data: [...tokens, token(12, "1200"), pool(100, 1, 2)] }], tokens.map(t => t.attributes.address));
  assert.equal(result.data.length, 10);
  assert.deepEqual(result.data.map(t => t.tvlUsd), [1200, 1100, 1000, 900, 800, 700, 600, 500, 400, 300]);
  assert.deepEqual(result.data.map(t => t.rank), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(result.data[0].sourceUrl, `https://www.geckoterminal.com/arc/tokens/${address(12)}`);
  assert.equal(result.unavailableTokens, 0);
});

test("invalid or missing TVL stays unavailable while real zero is reported but unranked", () => {
  const result = tvl.rankArcTvlTokens([{ data: [
    token(1, "20", { price_usd: "1.25", volume_usd: { h24: "0" } }),
    token(2, null), token(3, ""), token(4, "NaN"), token(5, -10), token(6, "0"),
    { ...token(7, "1000"), id: `eth_${address(7)}` },
    token(8, "1000", { address: address(9) }), token(9, "Infinity"),
  ] }], Array.from({ length: 9 }, (_, i) => address(i + 1)));
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].tvlUsd, 20);
  assert.equal(result.data[0].priceUsd, 1.25);
  assert.equal(result.data[0].volume24hUsd, 0);
  assert.equal(result.unavailableTokens, 7);
  const missing = tvl.rankArcTvlTokens([{ data: [token(1, "20")] }], [address(1)]).data[0];
  assert.equal(missing.priceUsd, null);
  assert.equal(missing.volume24hUsd, null);
});

test("ties are stable by address and identical symbols remain separate contracts", () => {
  const result = tvl.rankArcTvlTokens([{ data: [token(2, 100, { symbol: "SAME" }), token(1, 100, { symbol: "SAME" })] }], [address(1), address(2)]);
  assert.deepEqual(result.data.map(t => t.address), [address(1), address(2)]);
});

test("reader batches discovered tokens and returns actual coverage metadata", async () => {
  const calls = [];
  const feed = await tvl.readArcTokenTvl(async endpoint => {
    calls.push(endpoint);
    if (endpoint.includes("/pools?")) return { data: Array.from({ length: 35 }, (_, i) => pool(100 + i, i + 1, 36)) };
    const addresses = endpoint.split("/").at(-1).split(",");
    assert.ok(addresses.length <= 30);
    return { data: addresses.map(a => token(parseInt(a.slice(2), 16), "1")) };
  });
  assert.equal(calls.filter(c => c.includes("/pools?")).length, 3);
  assert.equal(calls.filter(c => c.includes("/tokens/multi/")).length, 2);
  assert.equal(feed.meta.poolsScanned, 35);
  assert.equal(feed.meta.tokensScanned, 36);
  assert.equal(feed.meta.unavailableTokens, 0);
  assert.ok(Number.isFinite(Date.parse(feed.meta.fetchedAt)));
  const empty = await tvl.readArcTokenTvl(async () => ({ data: [] }));
  assert.deepEqual(empty.data, []);
  assert.equal(empty.meta.tokensScanned, 0);
});

test("page and batch failures reject rather than presenting partial rankings", async () => {
  await assert.rejects(() => tvl.readArcTokenTvl(async endpoint => {
    if (endpoint.endsWith("page=2")) throw new Error("429");
    return { data: [pool(100, 1, 2)] };
  }), /discovery unavailable/);
  await assert.rejects(() => tvl.readArcTokenTvl(async endpoint => {
    if (endpoint.includes("/tokens/multi/")) throw new Error("timeout");
    return { data: [pool(100, 1, 2)] };
  }), /reserves unavailable/);
});

test("provider failures throw so ISR preserves the previous successful snapshot", async () => {
  const route = load("app/api/token-tvl/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => ({ body, ...options }) } },
    "next/cache": { unstable_cache: fn => fn },
    "@/lib/ascope-token-tvl": { readArcTokenTvl: async () => { throw new Error("provider offline"); } },
  });
  assert.equal(route.revalidate, 60);
  assert.equal(route.preferredRegion, "sin1");
  await assert.rejects(route.GET(), /temporarily unavailable/);
});

test("concurrent API requests share a cold provider read and return the same snapshot", async () => {
  let reads = 0, finish;
  const snapshot = { data: [token(1, "20")], meta: { source: "GeckoTerminal" } };
  const route = load("app/api/token-tvl/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => ({ body, ...options }) } },
    "next/cache": { unstable_cache: fn => fn },
    "@/lib/ascope-token-tvl": { readArcTokenTvl: () => {
      reads++;
      return new Promise(resolve => { finish = () => resolve(snapshot); });
    } },
  });
  const requests = Array.from({ length: 500 }, () => route.GET());
  assert.equal(reads, 1);
  finish();
  const responses = await Promise.all(requests);
  assert.ok(responses.every(r => r.body === snapshot));
});

test("rate limiting enforces a cooldown and recovers with live reads after it expires", async () => {
  const savedFetch = global.fetch, savedNow = Date.now;
  let now = 1000, calls = 0, limited = true;
  Date.now = () => now;
  global.fetch = async url => {
    calls++;
    return {
      ok: !limited, status: limited ? 429 : 200, headers: { get: () => "0" },
      json: async () => String(url).includes("/pools?")
        ? { data: [pool(100, 1, 2)] } : { data: [token(1, "200"), token(2, "100")] },
    };
  };
  try {
    const route = load("app/api/token-tvl/route.ts", {
      "next/server": { NextResponse: { json: (body, options) => ({ body, ...options }) } },
      "next/cache": { unstable_cache: fn => fn },
      "@/lib/ascope-token-tvl": tvl,
    });
    await assert.rejects(route.GET(), /temporarily unavailable/);
    const coldCalls = calls;
    await assert.rejects(route.GET(), /cooldown/);
    assert.equal(calls, coldCalls, "cooldown must not call the provider again");
    limited = false; now += 300001;
    const recovered = await route.GET();
    assert.equal(recovered.body.data.length, 2);
    assert.equal(recovered.body.data[0].tvlUsd, 200);
  } finally {
    global.fetch = savedFetch; Date.now = savedNow;
  }
});

test("a cached failed attempt protects newly started instances, then recovers after cache expiry", async () => {
  let now = 0, reads = 0, limited = true;
  const entries = new Map();
  const snapshot = { data: [], meta: { source: "GeckoTerminal" } };
  const cache = (fn, keys, { revalidate }) => async () => {
    const key = keys.join(":"), entry = entries.get(key);
    if (entry && now < entry.expires) return entry.value;
    const value = await fn();
    entries.set(key, { value, expires: now + revalidate * 1000 });
    return value;
  };
  const instance = () => load("app/api/token-tvl/route.ts", {
    "next/server": { NextResponse: { json: body => ({ body }) } },
    "next/cache": { unstable_cache: cache },
    "@/lib/ascope-token-tvl": { readArcTokenTvl: async () => {
      reads++;
      if (limited) throw new Error("429");
      return snapshot;
    } },
  });
  await assert.rejects(instance().GET(), /temporarily unavailable/);
  const freshInstances = Array.from({ length: 20 }, () => instance());
  const results = await Promise.allSettled(freshInstances.map(route => route.GET()));
  assert.ok(results.every(result => result.status === "rejected"));
  assert.equal(reads, 1, "failed outcomes must be shared, not just module-local cooldowns");
  limited = false; now = 300001;
  assert.deepEqual((await instance().GET()).body, snapshot);
  assert.equal(reads, 2);
});
