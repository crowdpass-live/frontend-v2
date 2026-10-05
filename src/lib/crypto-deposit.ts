import { chainInfo, USDC_DECIMALS } from "./onchain";

/**
 * The USDC deposit instruction from a crypto purchase (#29, #30).
 *
 * `POST /tickets/purchase` with `paymentProvider: 'CRYPTO'` returns
 * `checkoutUrl: null` and either `paidFromBalance: true` (already settled
 * from the buyer's custodial wallet — no deposit) or a `crypto` object saying
 * where to send what. Its field names have moved between backend versions
 * (`amountUsdc`/`usdcAddress`/`decimals`/`expiresAt` now; `amount`/`token`
 * before), so it is read through here and nowhere else.
 */
export interface CryptoDeposit {
  chain: string;
  /** Where to send. */
  address: string;
  /** Exact decimal string — never rounded for display. */
  amountUsdc: string;
  /** The USDC contract on `chain`. */
  usdcAddress: string | null;
  decimals: number;
  /** ISO; null when the backend gave no window. */
  expiresAt: string | null;
}

type Loose = Record<string, unknown>;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

function decimalString(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return String(v);
  if (typeof v === "string" && /^\d+(\.\d+)?$/.test(v.trim()) && Number(v) > 0) return v.trim();
  return null;
}

export function normalizeCryptoDeposit(raw: unknown): CryptoDeposit | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Loose;
  const chain = typeof c.chain === "string" ? c.chain : "";
  const address = typeof c.address === "string" ? c.address : "";
  const amountUsdc = decimalString(c.amountUsdc ?? c.amount);
  if (!chain || !ADDRESS.test(address) || !amountUsdc) return null;

  // `token` was a symbol ("USDC") on older backends; only trust an address.
  const token = [c.usdcAddress, c.token].find(
    (t): t is string => typeof t === "string" && ADDRESS.test(t),
  );
  return {
    chain,
    address,
    amountUsdc,
    usdcAddress: token ?? chainInfo(chain)?.usdc ?? null,
    decimals: typeof c.decimals === "number" ? c.decimals : USDC_DECIMALS,
    expiresAt: typeof c.expiresAt === "string" ? c.expiresAt : null,
  };
}
