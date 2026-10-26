const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { isDeepStrictEqual } = require("node:util");

const root = path.resolve(__dirname, "..");
const snapshotPath = path.join(root, "public", "ascope-arc-snapshot.json");

function loadTrackerParser() {
  const file = path.join(root, "lib", "ascope-arc-tracker.ts");
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      resolveJsonModule: true,
    },
  }).outputText;
  const localRequire = name => name.startsWith("../public/")
    ? require(path.resolve(path.dirname(file), name))
    : require(name);
  new Function("require", "module", "exports", code)(localRequire, module, module.exports);
  return module.exports.parseArcTracker;
}

const token = "0xa12cd81d0f9988e3d60c4b6a0d52d368ef3c788d";
const scan = "https://arc.etherscan.io";
const source = `${scan}/token/${token}`;
const headers = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "user-agent": "Mozilla/5.0 (compatible; AScope-Snapshot/1.0; +https://arc-scope.vercel.app)",
};

async function html(url, extraHeaders = {}) {
  const response = await fetch(url, { headers: { ...headers, ...extraHeaders }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`ArcScan returned HTTP ${response.status}`);
  return { response, body: await response.text() };
}

function normalized(snapshot) {
  return {
    ...snapshot,
    holders: snapshot.holders.map(holder => ({ ...holder, address: holder.address.toLowerCase() })),
    transfers: snapshot.transfers.map(transfer => ({
      ...transfer,
      from: transfer.from.toLowerCase(),
      to: transfer.to.toLowerCase(),
    })),
  };
}

(async () => {
  const summary = await html(source);
  const sid = summary.body.match(/var sid = '([a-f0-9]+)'/)?.[1];
  if (!sid) throw new Error("ArcScan session ID is unavailable");
  const setCookies = typeof summary.response.headers.getSetCookie === "function"
    ? summary.response.headers.getSetCookie()
    : [summary.response.headers.get("set-cookie") ?? ""];
  const cookie = setCookies.filter(Boolean).map(value => value.split(";")[0]).join("; ");
  const paths = [
    `generic-tokenholders2?m=light&a=${token}&p=1`,
    `generic-tokentxns2?m=light&contractAddress=${token}&a=&sid=${sid}&p=1`,
  ];
  const pages = await Promise.all(paths.map(item => html(`${scan}/token/${item}`, { cookie, referer: source }).then(result => result.body)));
  const next = normalized(loadTrackerParser()(summary.body, pages[0], pages[1]));
  const current = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  const { updatedAt: _currentTime, ...currentData } = normalized(current);
  const { updatedAt: _nextTime, ...nextData } = next;
  if (isDeepStrictEqual(currentData, nextData)) {
    console.log(`ARC snapshot is current through block ${next.transfers[0].block}.`);
    return;
  }
  fs.writeFileSync(snapshotPath, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`Updated ARC snapshot through block ${next.transfers[0].block}.`);
})().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
