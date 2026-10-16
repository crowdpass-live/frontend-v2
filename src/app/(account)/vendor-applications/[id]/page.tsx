import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api";
import { serverFetch } from "@/lib/api-server";
import { fetchFiatProviders } from "@/lib/crowdpass";
import { formatDate } from "@/lib/format";
import { ArrowLeftIcon } from "@/components/icons";
import { Container } from "@/components/ui";
import type { ApiVendorApplicationDetail } from "@/types/api";
import { VendorApplicationView } from "./VendorApplicationView";

export const metadata: Metadata = { title: "Vendor application" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One vendor's application (#43–#46) — the page every vendor email links
 * to. Where it stands, what to do next, and once paid, the door passes and
 * the vendor's own ticket link. Another account's application is a 404.
 */
export default async function VendorApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // A malformed id is a 400 from ParseUUIDPipe; it is just as missing.
  if (!UUID.test(id)) notFound();

  let app: ApiVendorApplicationDetail;
  try {
    app = await serverFetch<ApiVendorApplicationDetail>(`/vendor-applications/${id}`);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  }

  // Only an approved, unpaid stall needs the providers.
  const owes = app.status === "APPROVED" && app.paymentStatus === "UNPAID";
  const providers = owes ? await fetchFiatProviders(app.event.id).catch(() => null) : [];

  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-10">
      <Link
        href="/account/vendor-applications"
        className="-my-2.5 inline-flex min-h-10 w-fit items-center gap-2 text-label text-text-dim hover:text-text"
      >
        <ArrowLeftIcon width={16} height={16} /> My stall applications
      </Link>
      <header className="flex flex-col gap-1">
        <p className="text-label text-text-faint">
          {app.event.name} · {formatDate(app.event.startTime)}
          {app.event.venue ? ` · ${app.event.venue}` : ""}
        </p>
        <h1 className="break-words text-title font-bold text-text">{app.businessName}</h1>
      </header>
      <VendorApplicationView application={app} providers={providers} />
    </Container>
  );
}
