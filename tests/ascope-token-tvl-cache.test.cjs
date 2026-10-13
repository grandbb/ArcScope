const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
global.AsyncLocalStorage ??= require("node:async_hooks").AsyncLocalStorage;
const { unstable_cache } = require("next/cache");
const { staticGenerationAsyncStorage } = require("next/dist/client/components/static-generation-async-storage.external");
const ResponseCache = require("next/dist/server/response-cache").default;

// Exercise the installed Next.js cache machinery, not a replacement memoizer.
// Only persistence and the provider are substituted; no external API traffic.
test("Next ISR serves a shared snapshot during failed refreshes and recovers without a request storm", async () => {
  let now = 0, reads = 0, offline = false, routeWrites = 0;
  const entries = new Map();
  const incrementalCache = {
    fetchCacheKey: async key => key,
    get: async key => {
      const entry = entries.get(key);
      return entry ? { value: entry.value, isStale: now >= entry.expires,
        curRevalidate: entry.revalidate, revalidate: entry.revalidate } : null;
    },
    set: async (key, value, { revalidate }) => {
      entries.set(key, { value, expires: now + revalidate * 1000, revalidate });
      if (value.kind === "ROUTE") routeWrites++;
    },
  };
  const snapshot = n => ({ data: [{ rank: 1, tvlUsd: n }], meta: { source: "GeckoTerminal", fetchedAt: String(n) } });
  const provider = async () => {
    reads++;
    if (offline) throw new Error("429");
    return snapshot(reads);
  };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../app/api/token-tvl/route.ts"), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const instance = () => {
    const module = { exports: {} };
    new Function("require", "module", "exports", source)(name => ({
      "next/server": { NextResponse: { json: body => ({ body }) } },
      "next/cache": { unstable_cache },
      "@/lib/ascope-token-tvl": { readArcTokenTvl: provider },
    })[name], module, module.exports);
    return module.exports;
  };
  const responses = new ResponseCache(false);
  const invoke = () => responses.get("/api/token-tvl", async () => {
    const store = { urlPathname: "/api/token-tvl", incrementalCache, revalidate: 60, tags: [] };
    const response = await staticGenerationAsyncStorage.run(store, () => instance().GET());
    await Promise.all(Object.values(store.pendingRevalidates ?? {}));
    return { revalidate: 60, value: { kind: "ROUTE", status: 200, body: response.body, headers: {} } };
  }, { incrementalCache, routeKind: "APP_ROUTE" });
  const settle = async target => {
    for (let i = 0; i < 50 && routeWrites < target; i++) await new Promise(setImmediate);
    assert.ok(routeWrites >= target, "background ISR must settle");
    await new Promise(setImmediate);
  };

  const first = await Promise.all(Array.from({ length: 500 }, invoke));
  await settle(1);
  assert.equal(reads, 1);
  assert.ok(first.every(response => response.value.body.meta.fetchedAt === "1"));

  offline = true; now = 301000;
  const stale = await Promise.all(Array.from({ length: 500 }, invoke));
  await settle(2);
  assert.equal(reads, 2);
  assert.ok(stale.every(response => response.value.body.meta.fetchedAt === "1"));

  now += 61000;
  const duringFailure = await Promise.all(Array.from({ length: 500 }, invoke));
  await settle(3);
  assert.equal(reads, 2, "cached failures must stop upstream calls across new handler instances");
  assert.ok(duringFailure.every(response => response.value.status === 200));
  assert.ok(duringFailure.every(response => response.value.body.meta.fetchedAt === "1"));

  offline = false; now = 602000;
  await invoke(); await settle(4);
  assert.equal(reads, 3);
  now += 31000;
  await invoke(); await settle(5);
  const recovered = await invoke();
  assert.equal(recovered.value.body.meta.fetchedAt, "3");
});
