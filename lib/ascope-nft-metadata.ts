import { unstable_cache } from "next/cache";
import { parseAbi, type Address } from "viem";
import { mainnetClient } from "./ascope-mainnet";
import type { NFTAsset } from "./types";

const nftMetadataAbi = parseAbi([
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function uri(uint256 tokenId) view returns (string)",
]);
const addressPattern = /^0x[0-9a-f]{40}$/i;
const ipfsPathPattern = /^[a-zA-Z0-9._~/-]+$/;
const maxDataUriLength = 2_000_000;

type RawMetadata = {
  name?: unknown;
  description?: unknown;
  image?: unknown;
  image_url?: unknown;
  attributes?: unknown;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function ipfsGatewayUri(uri: string) {
  const path = uri.slice("ipfs://".length).replace(/^ipfs\//, "");
  return path && ipfsPathPattern.test(path)
    ? `https://gateway.pinata.cloud/ipfs/${path}`
    : "";
}

export function browserNftUri(value: unknown) {
  const uri = text(value);
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) return ipfsGatewayUri(uri);
  if (uri.startsWith("ar://")) {
    const id = uri.slice(5);
    return /^[a-zA-Z0-9_-]+$/.test(id) ? `https://arweave.net/${id}` : "";
  }
  if (uri.startsWith("data:image/") && uri.length <= maxDataUriLength) return uri;
  try {
    const url = new URL(uri);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

export function parseNftMetadataDataUri(uri: string): RawMetadata | null {
  if (!uri.startsWith("data:application/json") || uri.length > maxDataUriLength) return null;
  const comma = uri.indexOf(",");
  if (comma < 0) return null;
  try {
    const body = uri.slice(comma + 1);
    const json = /;base64/i.test(uri.slice(0, comma))
      ? Buffer.from(body, "base64").toString("utf8")
      : decodeURIComponent(body);
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function metadataDocument(uri: string): Promise<RawMetadata | null> {
  const embedded = parseNftMetadataDataUri(uri);
  if (embedded) return embedded;

  let url = "";
  if (uri.startsWith("ipfs://")) url = ipfsGatewayUri(uri);
  else if (uri.startsWith("ar://")) url = browserNftUri(uri);
  if (!url) return null;

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > maxDataUriLength) return null;
    const body = await response.text();
    if (body.length > maxDataUriLength) return null;
    const parsed = JSON.parse(body);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function metadataFields(metadata: RawMetadata | null) {
  if (!metadata) return null;
  const attributes = Array.isArray(metadata.attributes) ? metadata.attributes : [];
  return {
    name: text(metadata.name),
    description: text(metadata.description),
    image: browserNftUri(metadata.image) || browserNftUri(metadata.image_url),
    traits: attributes.flatMap(attribute => {
      if (!attribute || typeof attribute !== "object") return [];
      const item = attribute as { trait_type?: unknown; value?: unknown };
      const traitType = text(item.trait_type);
      if (!traitType || item.value === undefined || item.value === null) return [];
      return [{ traitType, value: String(item.value) }];
    }),
  };
}

export const readNftMetadata = unstable_cache(async (contract: string, tokenId: string) => {
  if (!addressPattern.test(contract) || !/^\d+$/.test(tokenId)) return null;
  let uri = "";
  for (const functionName of ["tokenURI", "uri"] as const) {
    try {
      uri = await mainnetClient.readContract({
        address: contract as Address,
        abi: nftMetadataAbi,
        functionName,
        args: [BigInt(tokenId)],
      });
      if (uri) break;
    } catch {
      // Collections commonly implement only one of these metadata methods.
    }
  }
  return metadataFields(await metadataDocument(uri));
}, ["ascope-nft-metadata-v1"], { revalidate: 3600 });

export async function enrichNftAssets(items: NFTAsset[]) {
  const enriched: NFTAsset[] = [];
  for (let offset = 0; offset < items.length; offset += 8) {
    const batch = await Promise.all(items.slice(offset, offset + 8).map(async item => {
      const existingImage = browserNftUri(item.image);
      if (!item.contractAddress || !item.tokenId) return { ...item, image: existingImage };
      const metadata = await readNftMetadata(item.contractAddress, item.tokenId);
      if (!metadata) return { ...item, image: existingImage };
      return {
        ...item,
        name: metadata.name || item.name,
        description: metadata.description || item.description,
        image: existingImage || metadata.image,
        traits: item.traits.length ? item.traits : metadata.traits,
      };
    }));
    enriched.push(...batch);
  }
  return enriched;
}
