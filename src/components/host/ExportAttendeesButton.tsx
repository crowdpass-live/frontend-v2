"use client";

import { useState } from "react";
import { ApiError, apiDownload } from "@/lib/api";
import { Button, Spinner } from "@/components/ui";

/**
 * Downloads every attendee as CSV — the whole event, not the filtered page,
 * which is what the export endpoint returns. Says so on the button.
 */
export function ExportAttendeesButton({ eventId }: { eventId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await apiDownload(
        `/organizer/events/${encodeURIComponent(eventId)}/attendees/export`,
        "attendees.csv",
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The download failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <Button
        type="button"
        variant="secondary"
        onClick={run}
        disabled={busy}
        className="h-11 w-full px-4 text-label sm:w-auto"
      >
        {busy ? <Spinner /> : null}
        Export all as CSV
      </Button>
      {error ? (
        <p role="alert" className="text-helper text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
