/**
 * Revenue-share units (#43). Ports mobile's `bpsToPercent` / `percentToBps`.
 *
 * `shareBps` is basis points OF THE ORGANIZER'S CUT, not of gross:
 * 10000 bps = the organizer's whole share. A partner set at 20% of a host
 * who keeps 95% of gross receives 19% of gross. Both figures are always
 * shown side by side, because a partner told "20%" who sees 19% thinks
 * they were shorted.
 */
export const BPS_TOTAL = 10_000;

export function bpsToPercent(bps: number): number {
  return Math.round(bps) / 100;
}

/** `"12.5"` → 1250. Null for anything that isn't 0.01–100 with ≤2dp. */
export function percentToBps(input: string): number | null {
  const v = input.trim().replace(/%$/, "").trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(v)) return null;
  const bps = Math.round(Number(v) * 100);
  return bps >= 1 && bps <= BPS_TOTAL ? bps : null;
}

/** `12.5` → `"12.5%"`, `20` → `"20%"`. */
export function percentLabel(percent: number): string {
  return `${Number(percent.toFixed(2))}%`;
}

/** The gross share a cut share works out to, given the organizer's cut. */
export function grossPercentOf(sharePercent: number, organizerSharePercent: number): number {
  return (sharePercent * organizerSharePercent) / 100;
}
