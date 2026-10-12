"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api";
import { verifyPayment } from "@/lib/crowdpass";
import { formatDate, formatDateTimeLong, money } from "@/lib/format";
import { APPLICATION_STATUS } from "@/lib/vendors";
import { BrandSpinner } from "@/components/BrandSpinner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CopyIcon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { Badge, Button, ButtonLink, Card, ErrorNote, SectionTitle, Spinner, cx } from "@/components/ui";
import type { ApiFiatMethod, ApiVendorApplicationDetail, ApiVendorPayResult, TransactionStatus } from "@/types/api";

const PROVIDER_LABEL: Record<string, string> = { PAYSTACK: "Paystack", MONNIFY: "Monnify" };

/** The checkout this browser last started for an application, by id. */
const payKey = (id: string) => `crowdpass:vendor-pay:${id}`;

function readPending(id: string): string | null {
  try {
    return sessionStorage.getItem(payKey(id));
  } catch {
    return null;
  }
}

function writePending(id: string, reference: string | null) {
  try {
    if (reference) sessionStorage.setItem(payKey(id), reference);
    else sessionStorage.removeItem(payKey(id));
  } catch {
    // Private browsing: the gateway's own query parameter still brings it back.
  }
}

/** The same cadence as the ticket checkout's return page. */
function delayFor(elapsedMs: number): number {
  if (elapsedMs < 60_000) return 4_000;
  if (elapsedMs < 180_000) return 8_000;
  if (elapsedMs < 420_000) return 15_000;
  return 30_000;
}
const GIVE_UP_AFTER_MS = 12 * 60 * 1000;

function message(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status === 0) return "No connection — check your signal and try again.";
  return err instanceof ApiError ? err.message : fallback;
}

/**
 * Everything a vendor does after applying (#43–#46): withdraw while
 * pending, pay once approved, then show the door passes and ticket link.
 *
 * **Payment is poll-only.** The gateway returns here with its reference;
 * `/payments/verify` settles it if the webhook hasn't, and the passes are
 * issued in the same step. Bank transfer can take minutes, so PENDING is
 * a waiting state, never a failure.
 *
 * The deadline (`paymentDueAt`) is shown but never blocks the Pay button:
 * nothing expires an unpaid approval yet, so a late payment still counts.
 */
export function VendorApplicationView({
  application: a,
  providers,
}: {
  application: ApiVendorApplicationDetail;
  /** Null when the lookup failed; empty when the organizer has none. */
  providers: ApiFiatMethod[] | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();

  const owes = a.status === "APPROVED" && a.paymentStatus === "UNPAID";
  const fee = a.priceAtApproval ?? a.stallType.price;

  // ---- return from the gateway -------------------------------------------
  // Paystack sends `reference` and `trxref`, Monnify `paymentReference`.
  const returned = params.get("reference") ?? params.get("trxref") ?? params.get("paymentReference");
  const [polling, setPolling] = useState<{ reference: string; status: TransactionStatus; stalled: boolean } | null>(null);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!owes) {
      writePending(a.id, null);
      return;
    }
    const reference = returned ?? readPending(a.id);
    // Seeded from the URL or storage, which only exist in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (reference) setPolling({ reference, status: "PENDING", stalled: false });
  }, [owes, returned, a.id]);

  const settledRef = useRef(false);
  const check = useCallback(
    async (reference: string) => {
      try {
        const r = await verifyPayment(reference);
        setPolling((p) => (p ? { ...p, status: r.status } : p));
        if (r.status === "SUCCESS" && !settledRef.current) {
          settledRef.current = true;
          writePending(a.id, null);
          toast("Payment received — your stall is confirmed.");
          // Dropping the gateway's query re-renders this dynamic page from
          // the server, which now has the passes. (A refresh() on top of it
          // would cancel the navigation.)
          router.replace(pathname, { scroll: false });
        }
        if (r.status === "FAILED") writePending(a.id, null);
        return r.status;
      } catch {
        // A failed verify says nothing about the payment; the next tick retries.
        return null;
      }
    },
    [a.id, pathname, router, toast],
  );

  const pollRef = polling?.reference;
  const pollStatus = polling?.status;
  const pollStalled = polling?.stalled;
  useEffect(() => {
    if (!pollRef || pollStatus !== "PENDING" || pollStalled) return;
    let cancelled = false;
    let timer: number | undefined;
    if (!startedAt.current) startedAt.current = Date.now();
    const tick = async () => {
      const next = await check(pollRef);
      if (cancelled || next === "SUCCESS" || next === "FAILED") return;
      if (Date.now() - startedAt.current > GIVE_UP_AFTER_MS) {
        setPolling((p) => (p ? { ...p, stalled: true } : p));
        return;
      }
      timer = window.setTimeout(tick, delayFor(Date.now() - startedAt.current));
    };
    void tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pollRef, pollStatus, pollStalled, check]);

  // ---- pay ----------------------------------------------------------------
  const options = providers ?? [];
  const [provider, setProvider] = useState(
    () => (options.find((p) => p.default) ?? options[0])?.provider ?? null,
  );
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  async function pay() {
    if (!provider) return;
    setPaying(true);
    setPayError(null);
    try {
      const res = await apiFetch<ApiVendorPayResult>(`/vendor-applications/${encodeURIComponent(a.id)}/pay`, {
        method: "POST",
        auth: true,
        body: { paymentProvider: provider, returnUrl: `${window.location.origin}/vendor-applications/${a.id}` },
        timeout: 60_000,
      });
      writePending(a.id, res.reference);
      window.location.assign(res.checkoutUrl);
    } catch (err) {
      setPaying(false);
      // 409: it was paid meanwhile (another tab, a webhook) — show what's true.
      if (err instanceof ApiError && err.status === 409) router.refresh();
      setPayError(message(err, "Couldn't start the payment. Try again."));
    }
  }

  // ---- withdraw -----------------------------------------------------------
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  async function withdraw() {
    setWithdrawBusy(true);
    setWithdrawError(null);
    try {
      await apiFetch(`/vendor-applications/${encodeURIComponent(a.id)}/withdraw`, { method: "POST", auth: true });
      setWithdrawing(false);
      toast("Application withdrawn.");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) router.refresh();
      setWithdrawError(message(err, "Couldn't withdraw. Try again."));
    } finally {
      setWithdrawBusy(false);
    }
  }

  const st = APPLICATION_STATUS[a.status];
  const paidMoney = a.paymentStatus === "PAID" && (a.priceAtApproval ?? 0) > 0;
  const confirming = owes && polling && polling.status !== "FAILED";
  const received = polling?.status === "SUCCESS";

  return (
    <div className="flex flex-col gap-6">
      {params.get("applied") ? (
        <p role="status" className="rounded-control border border-ok/40 bg-ok/10 px-4 py-3 text-label text-ok">
          Application sent. We&apos;ve emailed {a.email} a copy, and we&apos;ll email again when the organizer decides.
        </p>
      ) : null}

      {/* Where it stands */}
      <Card className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>{headline(a)}</SectionTitle>
          <Badge tone={a.status === "APPROVED" && a.paymentStatus === "PAID" ? "ok" : st.tone}>
            {a.status === "APPROVED" ? (a.paymentStatus === "PAID" ? "Confirmed" : "Approved · unpaid") : st.label}
          </Badge>
        </div>

        <dl className="flex flex-col gap-2 text-label">
          <Row label="Stall" value={a.stallType.name} />
          <Row label={a.priceAtApproval !== null ? "Fee" : "Listed fee"} value={money(fee)} />
          <Row label="Applied" value={formatDate(a.createdAt)} />
          {a.paidAt && fee > 0 ? <Row label="Paid" value={formatDate(a.paidAt)} /> : null}
        </dl>

        {a.status === "PENDING" ? (
          <>
            <p className="text-body text-text-dim">
              The organizer is reviewing it. You haven&apos;t been charged — if they
              approve you, you&apos;ll pay then. We&apos;ll email {a.email} either way.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setWithdrawError(null);
                setWithdrawing(true);
              }}
              className="w-full sm:w-fit"
            >
              Withdraw application
            </Button>
          </>
        ) : a.status === "REJECTED" ? (
          <>
            {a.rejectionReason ? <Reason text={a.rejectionReason} /> : null}
            <p className="text-body text-text-dim">You have not been charged.</p>
          </>
        ) : a.status === "WITHDRAWN" ? (
          <>
            <p className="text-body text-text-dim">You withdrew this application. You can apply again while registration is open.</p>
            <ButtonLink href={`/events/${a.event.slug}/apply`} size="sm" className="w-full sm:w-fit">
              Apply again
            </ButtonLink>
          </>
        ) : a.status === "CANCELLED" ? (
          <>
            {a.rejectionReason ? <Reason text={a.rejectionReason} /> : null}
            <p className="text-body text-text-dim">
              The organizer cancelled your stall, so your door passes no longer work.
              {paidMoney ? " Your stall fee will be refunded — the CrowdPass team handles it by hand, so it may take a few days." : ""}
            </p>
          </>
        ) : null}
      </Card>

      {/* Pay */}
      {owes ? (
        <section aria-labelledby="pay" className="flex flex-col gap-4 rounded-card border border-accent/30 bg-accent-tint p-4 sm:p-5">
          {confirming ? (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              {polling.stalled ? null : <BrandSpinner width={72} label="Confirming your payment" />}
              <h2 id="pay" className="text-section font-bold text-text">
                {received ? "Payment received" : polling.stalled ? "Still waiting on your bank" : "Confirming your payment"}
              </h2>
              <p className="text-label text-text-dim">
                {received
                  ? "Getting your door passes…"
                  : polling.stalled
                  ? "Bank transfers can take a while. Your passes will be emailed the moment it clears — no need to pay again."
                  : "Bank transfers can take a few minutes. Keep this page open — it updates on its own."}
              </p>
              <p className="font-mono text-helper text-text-faint">{polling.reference}</p>
              {polling.stalled ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    startedAt.current = Date.now();
                    setPolling((p) => (p ? { ...p, stalled: false } : p));
                  }}
                  className="w-full sm:w-fit"
                >
                  Check again
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <h2 id="pay" className="text-section font-bold text-text">
                  You&apos;re approved — pay {money(fee)} to confirm your stall
                </h2>
                {a.paymentDueAt ? (
                  <p className="text-label text-text-dim">Please pay by {formatDateTimeLong(a.paymentDueAt)}.</p>
                ) : null}
                {polling?.status === "FAILED" ? (
                  <p className="text-label text-danger">Your last payment didn&apos;t go through. Nothing was charged — try again.</p>
                ) : null}
              </div>

              {providers === null ? (
                <p className="text-label text-text-dim">We couldn&apos;t load the payment options. Refresh the page to try again.</p>
              ) : options.length === 0 ? (
                <p className="text-label text-text-dim">
                  The organizer hasn&apos;t set up card or bank-transfer payments yet. Check back
                  soon — your stall is held in the meantime.
                </p>
              ) : (
                <>
                  {options.length > 1 ? (
                    <div role="radiogroup" aria-label="Pay with" className="flex flex-wrap gap-2">
                      {options.map((o) => (
                        <button
                          key={o.provider}
                          type="button"
                          role="radio"
                          aria-checked={provider === o.provider}
                          onClick={() => setProvider(o.provider)}
                          className={cx(
                            "h-10 rounded-full border px-4 text-label transition-colors",
                            provider === o.provider
                              ? "border-accent bg-accent text-ink"
                              : "border-border bg-surface text-text-dim hover:text-text",
                          )}
                        >
                          {PROVIDER_LABEL[o.provider] ?? o.provider}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <ErrorNote>{payError}</ErrorNote>
                  <Button type="button" onClick={() => void pay()} disabled={paying || !provider} className="w-full sm:w-fit">
                    {paying ? <Spinner /> : null}
                    {paying ? "Opening checkout…" : `Pay ${money(fee)}`}
                  </Button>
                  <p className="text-helper text-text-faint">Card or bank transfer. Your door passes arrive as soon as it clears.</p>
                </>
              )}
            </>
          )}
        </section>
      ) : null}

      {/* Ticket link */}
      {a.referralLink && a.status === "APPROVED" ? <TicketLink link={a.referralLink} /> : null}

      {/* Passes */}
      {a.passes.length ? (
        <section aria-labelledby="passes" className="flex flex-col gap-3">
          <h2 id="passes" className="text-section font-bold text-text">
            Door passes · {a.passes.filter((p) => p.status !== "CANCELLED").length}
          </h2>
          <p className="text-label text-text-dim">
            Show one at the gate each time you come in — a pass works for re-entry, for
            setup and restocking. Passes scan from 24 hours before the event starts.
          </p>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {a.passes.map((p, i) => {
              const voided = p.status === "CANCELLED";
              return (
                <li key={p.reference}>
                  <Card className={cx("flex flex-col items-center gap-3 p-4", voided && "opacity-50")}>
                    <p className="self-start text-label font-bold text-text">
                      Pass {i + 1}
                      {voided ? <span className="font-normal text-danger"> · void</span> : null}
                    </p>
                    <div className={cx("rounded-xl bg-white p-2", voided && "grayscale")}>
                      {/* A data: URL has nothing for next/image to optimise. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.qrDataUrl}
                        alt={`Door pass ${i + 1} QR code`}
                        width={200}
                        height={200}
                        className="size-[200px]"
                      />
                    </div>
                    <p className={cx("max-w-full break-all text-center font-mono text-helper text-text-faint", voided && "line-through")}>
                      {p.reference}
                    </p>
                    <p className="text-helper text-text-dim">
                      {voided
                        ? "Cancelled — this pass no longer works"
                        : p.checkInCount
                          ? `Scanned ${p.checkInCount} time${p.checkInCount === 1 ? "" : "s"}`
                          : "Not used yet"}
                    </p>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <ConfirmDialog
        open={withdrawing}
        title="Withdraw your application?"
        confirmLabel="Withdraw"
        cancelLabel="Keep it"
        tone="danger"
        busy={withdrawBusy}
        error={withdrawError}
        onConfirm={() => void withdraw()}
        onCancel={() => setWithdrawing(false)}
      >
        <p>The organizer won&apos;t review it. You can apply again later while registration is open.</p>
      </ConfirmDialog>
    </div>
  );
}

function headline(a: ApiVendorApplicationDetail): string {
  switch (a.status) {
    case "PENDING":
      return "Under review";
    case "APPROVED":
      return a.paymentStatus === "PAID" ? "You're in" : "Approved";
    case "REJECTED":
      return "Not approved";
    case "WITHDRAWN":
      return "Withdrawn";
    case "CANCELLED":
      return "Stall cancelled";
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-text-faint">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium text-text">{value}</dd>
    </div>
  );
}

function Reason({ text }: { text: string }) {
  return (
    <p className="rounded-control bg-surface-strong px-3 py-2 text-label text-text-dim">
      <span className="text-text-faint">From the organizer: </span>
      {text}
    </p>
  );
}

function TicketLink({ link }: { link: NonNullable<ApiVendorApplicationDetail["referralLink"]> }) {
  const toast = useToast();
  const off = link.status === "DISABLED";
  async function copy() {
    try {
      await navigator.clipboard.writeText(link.url);
      toast("Link copied.");
    } catch {
      toast("Couldn't copy — press and hold the link to copy it.", { tone: "info" });
    }
  }
  return (
    <section aria-labelledby="ticket-link" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 sm:p-5">
      <h2 id="ticket-link" className="text-section font-bold text-text">Your ticket link</h2>
      <p className="text-label text-text-dim">
        {off
          ? "This link has been switched off."
          : "Share it with your customers. Tickets bought through this link are credited to you."}
      </p>
      <div className="flex items-center gap-2 rounded-control border border-border bg-bg py-1 pl-4 pr-1">
        <span className={cx("min-w-0 flex-1 truncate font-mono text-label", off ? "text-text-faint line-through" : "text-text")}>
          {link.url}
        </span>
        {!off ? (
          <button
            type="button"
            onClick={() => void copy()}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-control px-3 text-label font-bold text-accent hover:bg-accent-tint"
          >
            <CopyIcon width={16} height={16} /> Copy
          </button>
        ) : null}
      </div>
    </section>
  );
}
