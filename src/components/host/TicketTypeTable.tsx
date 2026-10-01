import { count, ngn, NO_VALUE, tokenAmount } from "@/lib/metric-format";
import { chainName } from "@/lib/format";
import type {
  ApiEventAnalytics,
  ApiOnchainBalance,
  ApiOnchainCheckins,
} from "@/types/api";

type Onchain<T> = { ok: true; value: T } | { ok: false };

/**
 * Per-ticket-type sales, joined to the on-chain figures.
 *
 * **Two sources, shown side by side and labelled as such.** Sold and revenue
 * come from the database; check-ins and the claimable USDC escrow are read
 * from the chain. They can legitimately disagree — a check-in is queued to
 * the chain after the door marks the ticket used, and the escrow is drained
 * by a payout — so they are never merged into one number.
 *
 * The analytics breakdown carries no ticket-type id, so the join is by name,
 * which the backend keeps unique within an event. A type that is not on
 * chain (a draft, or a free tier) simply has no on-chain row.
 */
export function TicketTypeTable({
  breakdown,
  balance,
  checkins,
}: {
  breakdown: ApiEventAnalytics["ticketTypeBreakdown"];
  balance: Onchain<ApiOnchainBalance>;
  checkins: Onchain<ApiOnchainCheckins>;
}) {
  const balanceBy = new Map(
    balance.ok ? balance.value.tickets.map((t) => [t.name, t] as const) : [],
  );
  const checkinBy = new Map(
    checkins.ok ? checkins.value.tickets.map((t) => [t.name, t] as const) : [],
  );
  const chain = balance.ok ? balance.value.chain : checkins.ok ? checkins.value.chain : null;

  function checkedIn(name: string): string {
    if (!checkins.ok) return "Unavailable";
    const row = checkinBy.get(name);
    if (!row) return NO_VALUE;
    return "error" in row ? "Unavailable" : count(row.checkedIn);
  }

  function claimable(name: string): string {
    if (!balance.ok) return "Unavailable";
    const row = balanceBy.get(name);
    if (!row) return NO_VALUE;
    return "error" in row ? "Unavailable" : tokenAmount(row.balanceUsdc, "USDC");
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Phones: one block per ticket type. A 6-column table would only fit
          by scrolling sideways, and half the figures would be off-screen. */}
      <ul className="flex flex-col divide-y divide-border sm:hidden">
        {breakdown.map((t) => (
          <li key={t.name} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-body font-bold text-text">{t.name}</span>
              <span className="shrink-0 text-label tabular-nums text-text-dim">
                {t.price ? ngn(t.price) : "Free"}
              </span>
            </div>
            <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-label">
              <dt className="text-text-faint">Sold</dt>
              <dd className="text-right tabular-nums text-text">
                {count(t.sold)}
                <span className="text-text-faint"> / {count(t.total)}</span>
              </dd>
              <dt className="text-text-faint">Revenue</dt>
              <dd className="text-right tabular-nums text-text">{ngn(t.revenue)}</dd>
              <dt className="text-text-faint">Checked in · on-chain</dt>
              <dd className="text-right tabular-nums text-text-dim">{checkedIn(t.name)}</dd>
              <dt className="text-text-faint">Claimable · on-chain</dt>
              <dd className="text-right tabular-nums text-text-dim">{claimable(t.name)}</dd>
            </dl>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[640px] border-collapse text-left text-label">
          <thead>
            <tr className="text-helper text-text-faint">
              <th scope="col" rowSpan={2} className="pb-2 pr-4 align-bottom font-normal">
                Ticket type
              </th>
              <th scope="colgroup" colSpan={3} className="border-b border-border pb-1.5 font-normal">
                Sales · database
              </th>
              <th scope="colgroup" colSpan={2} className="border-b border-border pb-1.5 pl-6 font-normal">
                On-chain{chain ? ` · ${chainName(chain)}` : ""}
              </th>
            </tr>
            <tr className="text-helper text-text-faint">
              <th scope="col" className="pt-1.5 pb-2 pr-4 text-right font-normal">Price</th>
              <th scope="col" className="pt-1.5 pb-2 pr-4 text-right font-normal">Sold</th>
              <th scope="col" className="pt-1.5 pb-2 text-right font-normal">Revenue</th>
              <th scope="col" className="pt-1.5 pb-2 pl-6 text-right font-normal">Checked in</th>
              <th scope="col" className="pt-1.5 pb-2 text-right font-normal">Claimable</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((t) => (
              <tr key={t.name} className="border-t border-border">
                <th scope="row" className="py-3 pr-4 font-medium text-text">{t.name}</th>
                <td className="py-3 pr-4 text-right tabular-nums text-text-dim">
                  {t.price ? ngn(t.price) : "Free"}
                </td>
                <td className="py-3 pr-4 text-right tabular-nums text-text">
                  {count(t.sold)}
                  <span className="text-text-faint"> / {count(t.total)}</span>
                </td>
                <td className="py-3 text-right tabular-nums text-text">{ngn(t.revenue)}</td>
                <td className="py-3 pl-6 text-right tabular-nums text-text-dim">{checkedIn(t.name)}</td>
                <td className="py-3 text-right tabular-nums text-text-dim">{claimable(t.name)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!balance.ok || !checkins.ok ? (
        <p className="text-helper text-text-faint">
          Couldn&apos;t read the chain just now, so some on-chain figures are
          unavailable. The database figures are unaffected — refresh to try again.
        </p>
      ) : null}
    </div>
  );
}
