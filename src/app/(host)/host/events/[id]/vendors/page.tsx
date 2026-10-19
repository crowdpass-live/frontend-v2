import type { Metadata } from "next";
import Link from "next/link";
import { ApiError } from "@/lib/api";
import { requireUser } from "@/lib/session";
import {
  VENDOR_APPLICATION_STATUSES,
  fetchStallTypes,
  fetchVendorApplications,
  isVendorApplicationStatus,
  isVendorPaymentStatus,
  settle,
} from "@/lib/organizer";
import { formatDate, money } from "@/lib/format";
import { count } from "@/lib/metric-format";
import { APPLICATION_STATUS, PAYMENT_STATUS } from "@/lib/vendors";
import { CaretDownIcon } from "@/components/icons";
import { Pager } from "@/components/Pager";
import { VendorReviewActions } from "@/components/host/VendorReviewActions";
import { Badge, Button, ButtonLink, cx } from "@/components/ui";
import type { VendorApplicationStatus } from "@/types/api";

export const metadata: Metadata = { title: "Vendors" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Vendor applications (#43, #44) — carries vendors' email and phone, so it
 * is an organizer surface only.
 *
 * Server-rendered like the attendee list: the status tabs are links and the
 * search and filters a plain GET form, so every view is a URL. Tab counts
 * come from `summary`, which always covers the whole event.
 */
export default async function HostEventVendorsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; payment?: string; stall?: string; search?: string; page?: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const status = isVendorApplicationStatus(sp.status) ? sp.status : undefined;
  const payment = isVendorPaymentStatus(sp.payment) ? sp.payment : undefined;
  const stall = sp.stall && UUID.test(sp.stall) ? sp.stall : undefined;
  const search = sp.search?.trim().slice(0, 100) || undefined;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [result, stalls] = await Promise.all([
    settle(fetchVendorApplications(id, { status, paymentStatus: payment, stallTypeId: stall, search, page })),
    settle(fetchStallTypes(id)),
  ]);
  // The layout renders the 404 / not-yours state.
  if (!result.ok) {
    if (result.error instanceof ApiError && (result.error.status === 403 || result.error.status === 404)) return null;
    throw result.error;
  }
  const { applications, summary, pagination } = result.value;
  const stallTypes = stalls.ok ? stalls.value : [];

  const base = `/host/events/${id}/vendors`;
  const hrefFor = (next: { status?: VendorApplicationStatus; page?: number }) => {
    const p = new URLSearchParams();
    if (next.status) p.set("status", next.status);
    if (payment) p.set("payment", payment);
    if (stall) p.set("stall", stall);
    if (search) p.set("search", search);
    if (next.page && next.page > 1) p.set("page", String(next.page));
    const qs = p.toString();
    return qs ? `${base}?${qs}` : base;
  };

  if (summary.total === 0 && stalls.ok && stallTypes.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-card border border-dashed border-border px-5 py-10">
        <p className="text-body font-bold text-text">Take vendors at this event</p>
        <p className="max-w-xl text-label text-text-dim">
          Add the stalls you offer, then open registration. Vendors apply from your
          event page, you approve them here, and they pay their stall fee after
          you approve — so a rejection never needs a refund.
        </p>
        <ButtonLink href={`${base}/setup`} size="sm" className="w-full sm:w-auto">
          Set up stalls
        </ButtonLink>
      </div>
    );
  }

  const filtered = !!(status || payment || stall || search);

  return (
    <div className="flex flex-col gap-5">
      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-label">
        <Fact label="Applications" value={summary.total} />
        <Fact label="To review" value={summary.byStatus.PENDING} />
        <Fact label="Approved" value={summary.byStatus.APPROVED} />
        <Fact label="Paid" value={summary.byPaymentStatus.PAID} />
      </dl>

      <nav aria-label="Filter by status" className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-2">
          {[undefined, ...VENDOR_APPLICATION_STATUSES].map((s) => {
            const active = s === status;
            const n = s ? summary.byStatus[s] : summary.total;
            return (
              <li key={s ?? "all"}>
                <Link
                  href={hrefFor({ status: s })}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-label transition-colors",
                    active
                      ? "border-accent bg-accent-tint text-text"
                      : "border-border bg-surface text-text-dim hover:text-text",
                  )}
                >
                  {s ? APPLICATION_STATUS[s].label : "All"}
                  <span className="tabular-nums text-text-faint">{count(n)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form action={base} method="get" role="search" className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <label className="sr-only" htmlFor="vendor-search">
          Search by business, contact name or email
        </label>
        <input
          id="vendor-search"
          name="search"
          type="search"
          defaultValue={search}
          placeholder="Business, name or email"
          maxLength={100}
          className="h-10 min-w-0 rounded-control border border-border bg-surface px-4 text-body text-text placeholder:text-text-faint"
        />
        <div className={cx("grid gap-2 sm:contents", stallTypes.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
          <FilterSelect
            name="payment"
            label="Payment"
            value={payment}
            options={[
              { value: "", label: "Paid or unpaid" },
              { value: "UNPAID", label: `Unpaid · ${count(summary.byPaymentStatus.UNPAID)}` },
              { value: "PAID", label: `Paid · ${count(summary.byPaymentStatus.PAID)}` },
            ]}
          />
          {stallTypes.length > 1 ? (
            <FilterSelect
              name="stall"
              label="Stall"
              value={stall}
              options={[{ value: "", label: "Every stall" }, ...stallTypes.map((t) => ({ value: t.id, label: t.name }))]}
            />
          ) : null}
        </div>
        <Button type="submit" variant="secondary" size="sm" className="w-full sm:w-auto">
          Filter
        </Button>
      </form>

      {applications.length === 0 ? (
        <p className="rounded-card border border-dashed border-border px-5 py-10 text-center text-label text-text-faint">
          {filtered ? (
            <>
              No applications match that.{" "}
              <Link href={base} className="font-bold text-accent hover:text-accent-hi">
                Show all
              </Link>
            </>
          ) : (
            "No applications yet. They appear here as vendors apply from your event page."
          )}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {applications.map((a) => {
            const st = APPLICATION_STATUS[a.status] ?? { label: a.status, tone: "neutral" as const };
            const pay = PAYMENT_STATUS[a.paymentStatus] ?? { label: a.paymentStatus, tone: "neutral" as const };
            const fee = a.priceAtApproval ?? a.stallType.price;
            return (
              <li key={a.id} className="flex min-w-0 flex-col gap-3 rounded-card border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-body font-bold text-text">{a.businessName}</p>
                    <p className="text-label text-text-dim">
                      {a.stallType.name} · {money(fee)}
                      {a.category ? ` · ${a.category}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone={st.tone}>{st.label}</Badge>
                    {/* Payment only means something once a stall is held. */}
                    {a.status === "APPROVED" || (a.status === "CANCELLED" && a.paymentStatus === "PAID") ? (
                      <Badge tone={pay.tone}>{pay.label}</Badge>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col text-label">
                  <span className="truncate text-text">{a.contactName}</span>
                  <a
                    href={`mailto:${a.email}`}
                    className="-my-1 inline-flex min-h-10 w-fit max-w-full items-center truncate text-text-dim underline decoration-border underline-offset-4"
                  >
                    {a.email}
                  </a>
                  <a
                    href={`tel:${a.phone}`}
                    className="-my-1 inline-flex min-h-10 w-fit items-center text-text-dim underline decoration-border underline-offset-4"
                  >
                    {a.phone}
                  </a>
                </div>

                {a.description ? (
                  <p className="whitespace-pre-line break-words text-label text-text-dim">{a.description}</p>
                ) : null}

                <p className="text-helper text-text-faint">
                  Applied {formatDate(a.createdAt)}
                  {a.status === "APPROVED" && a.paymentStatus === "UNPAID" && a.paymentDueAt
                    ? ` · pay by ${formatDate(a.paymentDueAt)}`
                    : ""}
                  {a.paidAt && fee > 0 ? ` · paid ${formatDate(a.paidAt)}` : ""}
                  {a.marketingOptIn ? " · happy to hear about future editions" : ""}
                </p>
                {a.rejectionReason && (a.status === "REJECTED" || a.status === "CANCELLED") ? (
                  <p className="rounded-control bg-surface-strong px-3 py-2 text-label text-text-dim">
                    <span className="text-text-faint">Reason: </span>
                    {a.rejectionReason}
                  </p>
                ) : null}

                <VendorReviewActions eventId={id} application={a} />
              </li>
            );
          })}
        </ul>
      )}

      <Pager
        page={page}
        totalPages={pagination.totalPages}
        hrefFor={(n) => hrefFor({ status, page: n })}
        summary={`${count(pagination.total)} results · page ${page} of ${pagination.totalPages}`}
      />
    </div>
  );
}

function Fact({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-text-faint">{label}</dt>
      <dd className="font-bold tabular-nums text-text">{count(value)}</dd>
    </div>
  );
}

/** A native select in the search form — submitted with it, no JavaScript. */
function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string | undefined;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative min-w-0">
      <label className="sr-only" htmlFor={`vendor-${name}`}>
        {label}
      </label>
      <select
        id={`vendor-${name}`}
        name={name}
        defaultValue={value ?? ""}
        className="h-10 w-full min-w-0 appearance-none rounded-control border border-border bg-surface pl-4 pr-10 text-label text-text"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <CaretDownIcon className="pointer-events-none absolute inset-y-0 right-3 my-auto text-text-faint" />
    </div>
  );
}
