import { VendorNav } from "@/components/host/VendorNav";

/**
 * Vendors (#42–#44): applications to review, and the stalls and switch
 * behind them. Vendors apply from the public event page; there is no vendor
 * role — any signed-in account can apply.
 */
export default async function HostEventVendorsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="flex flex-col gap-5">
      <VendorNav eventId={id} />
      {children}
    </div>
  );
}
