/**
 * Block-explorer links. Ported from `v2-mobile/src/lib/onchain.js` (the
 * explorer half; the RPC balance read arrives with the wallet card, #26).
 *
 * Explorer URLs are static public facts, keyed by the backend's chain id.
 * An unknown chain yields no link rather than a guess: mobile defaults every
 * payout to the Base Sepolia explorer, which sends a mainnet hash to a
 * testnet explorer that has never heard of it.
 */

const EXPLORERS: Record<string, string> = {
  "BASE-SEPOLIA": "https://sepolia.basescan.org",
  BASE: "https://basescan.org",
  "ARC-TESTNET": "https://testnet.arcscan.app",
};

export interface ExplorerLinks {
  tx?: string;
  address?: string;
}

export function explorerLinks(
  chain: string | null | undefined,
  { tx, address }: { tx?: string | null; address?: string | null },
): ExplorerLinks {
  const base = chain ? EXPLORERS[chain.toUpperCase()] : undefined;
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
