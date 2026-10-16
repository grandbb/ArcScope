import { load } from "cheerio";

export const ARC_TOKEN = "0xa12cd81d0f9988e3d60c4b6a0d52d368ef3c788d";
export const ARC_SCAN = "https://arc.etherscan.io";
export const ARC_SOURCE = `${ARC_SCAN}/token/${ARC_TOKEN}`;
const addressPattern = /^0x[0-9a-f]{40}$/i;
function number(text: string) {
  const value = Number(text.replace(/,/g, "").trim());
  if (!text.trim() || !Number.isFinite(value) || value < 0) throw Error("Invalid explorer number");
  return value;
}
export function parseArcTracker(summary: string, holderHtml: string, transferHtml: string) {
  const page = load(summary), h = load(holderHtml), t = load(transferHtml);
  const supply = number(page("#ContentPlaceHolder1_hdnTotalSupply").attr("value") ?? "");
  const holderCount = number(page("#ContentPlaceHolder1_tr_tokenHolders .d-flex > div").first().text());
  if (!/Arc\s*\(ARC\)/.test(page("title").text()) || !page(`a[href='/address/${ARC_TOKEN}']`).length || supply <= 0) throw Error("Unexpected ARC token summary");
  const holders = h("tbody tr").slice(0, 10).toArray().map(row => {
    const cells = h(row).find("td"), link = cells.eq(1).find('a[href*="?a="]').first();
    const address = new URL(link.attr("href") ?? "", ARC_SCAN).searchParams.get("a") ?? "";
    if (!addressPattern.test(address)) throw Error("Invalid holder address");
    const balance = number(cells.eq(2).find("span[title]").attr("title") ?? cells.eq(2).text());
    const label = link.text().trim();
    return { address, balance, share: balance / supply * 100, label: label.startsWith("0x") ? null : label };
  });
  if (holders.length !== Math.min(10, holderCount) || holders.some((item, i) => i > 0 && item.balance > holders[i - 1].balance)) throw Error("Incomplete holder rankings");
  const other = supply - holders.reduce((sum, item) => sum + item.balance, 0);
  if (other < -0.000001) throw Error("Holder balances exceed supply");
  const transfers = t("tbody tr").slice(0, 10).toArray().map(row => {
    const item = t(row), hash = item.find('a[href^="/tx/"]').first().text().trim();
    const addresses = item.find('a[href*="?a="]').toArray().map(a => new URL(t(a).attr("href")!, ARC_SOURCE).searchParams.get("a")!);
    const timestamp = number(item.find(".showLocalDate").text()) * 1000;
    const block = number(item.find('a[href^="/block/"]').text());
    if (!/^0x[0-9a-f]{64}$/i.test(hash) || addresses.length !== 2 || !addresses.every(a => addressPattern.test(a)) || !Number.isFinite(new Date(timestamp).getTime())) throw Error("Invalid transfer row");
    return { hash, from: addresses[0], to: addresses[1], amount: number(item.find(".td_showAmount").text()), timestamp, block };
  });
  if (transfers.length !== 10 || transfers.some((item, i) => i > 0 && item.block > transfers[i - 1].block)) throw Error("Incomplete latest transfers");
  return { supply, holderCount, holders, other: Math.max(0, other), transfers, updatedAt: new Date().toISOString() };
}
export type ArcTrackerSnapshot = ReturnType<typeof parseArcTracker>;
