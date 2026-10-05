import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { fetchChains, settle } from "@/lib/organizer";
import { defaultDraft } from "@/lib/event-form";
import { EventForm } from "@/components/host/EventForm";
import { ArrowLeftIcon } from "@/components/icons";
import { Container } from "@/components/ui";

export const metadata: Metadata = { title: "Create an event" };

/**
 * Create an event (#38). Saves a DRAFT; publishing happens from the
 * event's page (#39), after the host has looked it over.
 */
export default async function NewEventPage() {
  const user = await requireUser();
  if (!user.organizerProfile) return <OrganizersOnly />;

  // The server default is the first active chain. If the list can't be
  // read, the field is omitted and the API picks the same default.
  const chains = await settle(fetchChains());
  const options = chains.ok ? chains.value : [];

  return (
    <Container size="page" className="flex flex-col gap-6 py-8 sm:py-10">
      <header className="flex flex-col gap-2">
        <Link
          href="/host"
          className="-my-2.5 inline-flex min-h-10 w-fit items-center gap-2 text-label text-text-dim hover:text-text"
        >
          <ArrowLeftIcon width={16} height={16} /> Dashboard
        </Link>
        <h1 className="text-title font-bold text-text">Create an event</h1>
        <p className="text-body text-text-dim">
          It saves as a draft. Nothing is public until you publish it.
        </p>
      </header>
      <EventForm mode="create" initial={defaultDraft(options[0]?.id ?? null)} chains={options} />
    </Container>
  );
}

function OrganizersOnly() {
  return (
    <Container className="flex flex-col items-center gap-4 py-20 text-center">
      <h1 className="text-title font-bold text-text">Organizer accounts only</h1>
      <p className="text-body text-text-dim">
        Events are created by organizers.{" "}
        <Link href="/host" className="font-bold text-accent hover:text-accent-hi">Back to the dashboard</Link>.
      </p>
    </Container>
  );
}
