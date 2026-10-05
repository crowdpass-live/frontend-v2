import type { Metadata } from "next";
import Link from "next/link";
import { fetchChains, fetchOwnDraft, settle } from "@/lib/organizer";
import { draftFromEvent } from "@/lib/event-form";
import { EventForm } from "@/components/host/EventForm";

export const metadata: Metadata = { title: "Edit event" };

/**
 * Edit a DRAFT (#38). The API refuses `PUT /events/:id` for anything else,
 * so a published event gets an explanation here, never a form that can't
 * save. Its price changes go through the ticket-fee route (#42, app-only
 * for now).
 */
export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [draft, chains] = await Promise.all([fetchOwnDraft(id), settle(fetchChains())]);

  if (!draft) {
    return (
      <section className="flex max-w-xl flex-col gap-3 rounded-card border border-border bg-surface p-5">
        <h2 className="text-section font-bold text-text">Only drafts can be edited</h2>
        <p className="text-body text-text-dim">
          Once an event is published its details are fixed — buyers have tickets
          for them. Ticket prices can still be changed in the CrowdPass app.
        </p>
        <Link href={`/host/events/${id}`} className="inline-flex min-h-10 w-fit items-center text-body font-bold text-accent hover:text-accent-hi">
          Back to the event
        </Link>
      </section>
    );
  }

  return (
    <EventForm mode="edit" eventId={id} initial={draftFromEvent(draft)} chains={chains.ok ? chains.value : []} />
  );
}
