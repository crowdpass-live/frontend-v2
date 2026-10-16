import type { Metadata } from "next";
import Link from "next/link";
import { serverFetch } from "@/lib/api-server";
import { formatDate, money } from "@/lib/format";
import { APPLICATION_STATUS } from "@/lib/vendors";
import { ChevronRightIcon } from "@/components/icons";
import { Badge, ButtonLink, Container } from "@/components/ui";
import type { ApiVendorApplication } from "@/types/api";

export const metadata: Metadata = { title: "My stall applications" };

/**
 * Every vendor application this account has made, newest first. A list of
 * links: each row opens `/vendor-applications/:id`, which owns paying,
 * passes and the ticket link.
 */
export default async function MyVendorApplicationsPage() {
  const apps = await serverFetch<ApiVendorApplication[]>("/vendor-applications/mine");

  return (
    <Container size="page" className="flex flex-col gap-6 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-title font-bold text-text">My stall applications</h1>
        <p className="text-body text-text-dim">Stalls you&apos;ve applied for as a vendor. Open one to pay or get your door passes.</p>
      </header>

      {apps.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-card border border-dashed border-border px-5 py-10">
          <p className="text-body text-text-dim">
            You haven&apos;t applied for a stall yet. Events taking vendors show a
            “Vendor stalls” section on their page.
          </p>
          <ButtonLink href="/" variant="secondary" size="sm" className="w-full sm:w-auto">
            Browse events
          </ButtonLink>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {apps.map((a) => {
            const owes = a.status === "APPROVED" && a.paymentStatus === "UNPAID";
            const confirmed = a.status === "APPROVED" && a.paymentStatus === "PAID";
            const st = APPLICATION_STATUS[a.status];
            return (
              <li key={a.id}>
                <Link
                  href={`/vendor-applications/${a.id}`}
                  className="flex items-center gap-4 rounded-card border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-strong"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="truncate text-body font-bold text-text">{a.event.name}</p>
                    <p className="truncate text-label text-text-dim">
                      {a.businessName} · {a.stallType.name}
                    </p>
                    <p className="text-helper text-text-faint">
                      {formatDate(a.event.startTime)}
                      {owes ? ` · ${money(a.priceAtApproval ?? a.stallType.price)} to pay` : ""}
                    </p>
                  </div>
                  <Badge tone={confirmed ? "ok" : owes ? "accent" : st.tone} className="shrink-0">
                    {confirmed ? "Confirmed" : owes ? "Pay now" : st.label}
                  </Badge>
                  <ChevronRightIcon className="shrink-0 text-text-faint" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Container>
  );
}
