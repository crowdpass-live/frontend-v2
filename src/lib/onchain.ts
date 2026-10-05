/**
 * Chains, explorers and USDC balances. Ported from `v2-mobile/src/lib/onchain.js`
 * (#26); the explorer half arrived earlier with payouts.
 *
 * Wallets are custodial (Circle). This module only READS: a public JSON-RPC
 * `eth_call` to the USDC contract's `balanceOf`. No signing, no keys, no
 * wallet SDK — and there is no user-facing wallet endpoint on the backend to
 * ask instead.
 *
 * Keyed by the backend's chain id. An unknown chain yields no link and no
 * balance rather than a guess: mobile defaults every payout to the Base
 * Sepolia explorer, which sends a mainnet hash to a testnet explorer that has
 * never heard of it.
 */

export interface ChainInfo {
  /** The backend's id, e.g. `BASE-SEPOLIA`. */
  id: string;
  name: string;
  explorer: string;
  /** Public RPC. Override per deploy with `RPC_URL_<ID>` (server-side). */
  rpc: string;
  /** The USDC ERC-20 contract. 6 decimals on all three. */
  usdc: string;
  testnet: boolean;
  /** How the explorer addresses one NFT — the two families differ. */
  explorerKind: "etherscan" | "blockscout";
}

/**
 * Verified 2026-10-04 against each RPC: `symbol()` is `USDC`, `decimals()` is
 * 6. On Arc, USDC is the native gas token and `0x3600…` is its ERC-20 face.
 */
export const CHAINS: Record<string, ChainInfo> = {
  BASE: {
    id: "BASE",
    name: "Base",
    explorer: "https://basescan.org",
    rpc: "https://mainnet.base.org",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    testnet: false,
    explorerKind: "etherscan",
  },
  "BASE-SEPOLIA": {
    id: "BASE-SEPOLIA",
    name: "Base Sepolia",
    explorer: "https://sepolia.basescan.org",
    rpc: "https://sepolia.base.org",
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    testnet: true,
    explorerKind: "etherscan",
  },
  "ARC-TESTNET": {
    id: "ARC-TESTNET",
    name: "Arc Testnet",
    explorer: "https://testnet.arcscan.app",
    rpc: "https://rpc.testnet.arc.network",
    usdc: "0x3600000000000000000000000000000000000000",
    testnet: true,
    explorerKind: "blockscout",
  },
};

export const USDC_DECIMALS = 6;

export function chainInfo(chain: string | null | undefined): ChainInfo | undefined {
  return chain ? CHAINS[chain.toUpperCase()] : undefined;
}

export interface ExplorerLinks {
  tx?: string;
  address?: string;
}

export function explorerLinks(
  chain: string | null | undefined,
  { tx, address }: { tx?: string | null; address?: string | null },
): ExplorerLinks {
  const base = chainInfo(chain)?.explorer;
  if (!base) return {};
  return {
    ...(tx ? { tx: `${base}/tx/${tx}` } : null),
    ...(address ? { address: `${base}/address/${address}` } : null),
  };
}

/** `0x1234…abcd` — enough to recognise, short enough for a table cell. */
export function shortHash(value: string | null | undefined): string {
  if (!value) return "";
  return value.length > 14 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/**
 * USDC held by `address` on `chain`, as an exact decimal string
 * (`"128.5"`), or null when it could not be read — unknown chain, bad
 * address, RPC down. Null is "we don't know", never zero.
 *
 * Server-side: `fetch` here is Node's, so browser CORS on public RPCs never
 * comes into it, and the RPC override stays out of the bundle.
 */
export async function fetchUsdcBalance(
  chain: string,
  address: string,
  { timeoutMs = 6000 }: { timeoutMs?: number } = {},
): Promise<string | null> {
  const info = chainInfo(chain);
  if (!info || !ADDRESS.test(address)) return null;
  const rpc = process.env[`RPC_URL_${info.id.replace(/-/g, "_")}`] || info.rpc;

  // balanceOf(address): selector + the address left-padded to 32 bytes.
  const data = `0x70a08231${address.slice(2).toLowerCase().padStart(64, "0")}`;
  try {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to: info.usdc, data }, "latest"],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: unknown };
    if (typeof body.result !== "string" || !/^0x[0-9a-fA-F]*$/.test(body.result)) return null;
    return unitsToDecimal(BigInt(body.result === "0x" ? "0" : body.result).toString(), USDC_DECIMALS);
  } catch {
    return null;
  }
}

/** `"128500000"` at 6 decimals → `"128.5"`. String math: no float rounding. */
export function unitsToDecimal(units: string, decimals: number): string {
  const padded = units.replace(/^0+/, "").padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const frac = padded.slice(-decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

/**
 * A balance for display: at least two decimals, never rounded away —
 * `"128.5"` → `"128.50"`, `"0.000001"` stays. Thousands separated.
 */
export function formatUsdc(decimal: string): string {
  const [whole, frac = ""] = decimal.split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${frac.padEnd(2, "0")}`;
}

/**
 * Where a minted ticket lives on-chain, as explorer links (#31). Ports the
 * provenance links from `TicketScreen.js`.
 *
 * Built only from what is certain: the ticket's own on-chain fields when the
 * API sends them, else the ticket contract configured for the chain
 * (`TICKET_CONTRACT_<CHAIN>`, server-side). A link that can't be built is
 * left out, never guessed. `tokenId` stays a string — the backend serialises
 * BigInt that way, and `Number()` would corrupt a large id.
 */
export interface TicketOnchainLinks {
  chainName: string;
  nft?: string;
  contract?: string;
  wallet?: string;
  mintTx?: string;
}

const HASH = /^0x[0-9a-fA-F]{64}$/;

export function ticketOnchain(
  chain: string | null | undefined,
  ticket: {
    tokenId: string | number | null;
    contractAddress?: string | null;
    ownerAddress?: string | null;
    walletAddress?: string | null;
    mintTxHash?: string | null;
    txHash?: string | null;
  },
): TicketOnchainLinks | null {
  const info = chainInfo(chain);
  const tokenId = ticket.tokenId == null ? "" : String(ticket.tokenId);
  if (!info || !/^\d+$/.test(tokenId)) return null;

  const configured = process.env[`TICKET_CONTRACT_${info.id.replace(/-/g, "_")}`];
  const contract = [ticket.contractAddress, configured].find(
    (a): a is string => typeof a === "string" && ADDRESS.test(a),
  );
  const owner = [ticket.ownerAddress, ticket.walletAddress].find(
    (a): a is string => typeof a === "string" && ADDRESS.test(a),
  );
  const tx = [ticket.mintTxHash, ticket.txHash].find(
    (h): h is string => typeof h === "string" && HASH.test(h),
  );

  const links: TicketOnchainLinks = { chainName: info.name };
  if (contract) {
    links.contract = `${info.explorer}/address/${contract}`;
    links.nft =
      info.explorerKind === "blockscout"
        ? `${info.explorer}/token/${contract}/instance/${tokenId}`
        : `${info.explorer}/nft/${contract}/${tokenId}`;
  }
  if (owner) links.wallet = `${info.explorer}/address/${owner}`;
  if (tx) links.mintTx = `${info.explorer}/tx/${tx}`;
  return links;
}
