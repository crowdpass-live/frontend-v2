import { formatDateTimeLong, money } from "@/lib/format";
import { ButtonLink, Card, SectionTitle, cx } from "@/components/ui";
import type { ApiPublicStalls } from "@/types/api";

/** Whether vendors can apply right now, with something to apply for. */
export function takingVendors(stalls: ApiPublicStalls | null): boolean {
  return !!stalls?.registration.acceptingApplications && stalls.stallTypes.some((s) => s.remaining > 0);
}

/**
 * The event page's vendor section (#43): the stalls on offer and the way in.
 * Vendors apply first and pay only once approved, so the copy says so — it
 * is the question every vendor asks before filling in a form.
 *
 * `closedNote` renders a closed state instead of nothing: on a vendors-only
 * event this section IS the page's purpose, and an empty rail would read as
 * a broken page.
 */
export function VendorStalls({
  slug,
  stalls,
  currency,
  closedNote = false,
}: {
  slug: string;
  stalls: ApiPublicStalls | null;
  currency: string;
  closedNote?: boolean;
}) {
  const open = takingVendors(stalls);
  if (!open && !closedNote) return null;

  return (
    <section aria-labelledby="vendor-stalls" className="flex flex-col gap-3">
      <SectionTitle>
        <span id="vendor-stalls">Vendor stalls</span>
      </SectionTitle>
      {!open || !stalls ? (
        <Card className="p-4 text-body text-text-dim">
          {stalls?.registration.acceptingApplications
            ? "Every stall has been taken."
            : "Vendor applications aren't open right now."}
        </Card>
      ) : (
        <>
          {stalls.stallTypes.map((s) => {
            const full = s.remaining <= 0;
            return (
              <Card key={s.id} className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className={cx("break-words text-body font-semibold", full ? "text-text-faint" : "text-text")}>
                    {s.name}
                  </p>
                  <p className="mt-0.5 text-helper text-text-faint">
                    {full ? "All taken" : `${s.remaining} left`} · {s.passesPerStall} door pass
                    {s.passesPerStall === 1 ? "" : "es"}
                  </p>
                  {s.description ? (
                    <p className="mt-1 whitespace-pre-line break-words text-label text-text-dim">{s.description}</p>
                  ) : null}
                </div>
                <p className={cx("shrink-0 text-body font-bold", full ? "text-text-faint line-through" : "text-text")}>
                  {money(s.price, currency)}
                </p>
              </Card>
            );
          })}
          <ButtonLink href={`/events/${slug}/apply`} variant="secondary" className="w-full">
            Apply for a stall
          </ButtonLink>
          <p className="text-center text-helper text-text-faint">
            Applying is free — you pay only once the organizer approves you.
            {stalls.registration.closesAt
              ? ` Applications close ${formatDateTimeLong(stalls.registration.closesAt)}.`
              : ""}
          </p>
        </>
      )}
    </section>
  );
}
