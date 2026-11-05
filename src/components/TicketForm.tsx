"use client";

import { useState } from "react";
import { submitTicketForm } from "@/lib/crowdpass";
import { ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { ApiTicketForm } from "@/types/api";
import { Chip } from "./Chip";
import { CheckIcon } from "./icons";
import { Badge, Button, Card, ErrorNote, Field, Spinner } from "./ui";

/**
 * The questions a ticket type asks once it is paid for — a merch tier's
 * T-shirt size and colour. Rendered on the ticket page, which is where the
 * payment result and the ticket email both send the buyer.
 *
 * One submission, no edits: the organizer places the print order from these
 * answers, so the form says so before the buyer commits. `canSubmit` from the
 * backend is the whole gate (paid, unanswered, still open); this component
 * only decides which of those to explain when it is false.
 */
export function TicketForm({
  reference,
  initial,
}: {
  reference: string;
  initial: ApiTicketForm;
}) {
  const [form, setForm] = useState(initial);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selects are always required; a text line only when the form says so.
  const complete = form.fields.every((f) =>
    f.type === "text" && !f.required ? true : !!picked[f.key]?.trim(),
  );

  async function submit() {
    if (!complete || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      // A blank optional line is left out rather than sent as "".
      const answers = Object.fromEntries(
        Object.entries(picked).filter(([, v]) => v.trim()),
      );
      const ticket = await submitTicketForm(reference, answers);
      if (ticket.form) setForm(ticket.form);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not save your answers. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (form.submittedAt && form.answers) {
    const answers = form.answers;
    return (
      <Card className="flex flex-col gap-4 p-5">
        <header className="flex items-center justify-between gap-4">
          <h2 className="text-label font-bold text-text">{form.title}</h2>
          <Badge tone="ok">Submitted</Badge>
        </header>
        <dl className="flex flex-col gap-2">
          {form.fields.map((f) => (
            <div key={f.key} className="flex items-baseline justify-between gap-4">
              <dt className="text-label text-text-faint">{f.label}</dt>
              <dd className="min-w-0 truncate text-label font-medium text-text">
                {answers[f.key] ?? (f.type === "text" ? "None" : "—")}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    );
  }

  if (!form.open) {
    return (
      <Card className="flex flex-col gap-2 p-5">
        <h2 className="text-label font-bold text-text">{form.title}</h2>
        <p className="text-label text-text-dim">
          This form closed
          {form.closesAt ? ` on ${formatDate(form.closesAt)}` : ""}. Contact
          the organizer if you still need to send your choice.
        </p>
      </Card>
    );
  }

  if (!form.canSubmit) {
    // Open and unanswered, so the only thing missing is the payment.
    return (
      <Card className="flex flex-col gap-2 p-5">
        <h2 className="text-label font-bold text-text">{form.title}</h2>
        <p className="text-label text-text-dim">
          You can fill this in as soon as your payment is confirmed.
        </p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-5 p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-label font-bold text-text">{form.title}</h2>
        <p className="text-label text-text-dim">
          Your ticket comes with merch. Tell us what you&apos;d like
          {form.closesAt ? ` by ${formatDate(form.closesAt)}` : ""}.
        </p>
      </div>

      {form.fields.map((f) =>
        f.type === "text" ? (
          <Field
            key={f.key}
            label={f.label}
            hint={
              f.hint ??
              `${f.required ? "" : "Optional · "}up to ${f.maxLength} characters`
            }
            value={picked[f.key] ?? ""}
            maxLength={f.maxLength}
            autoComplete="off"
            disabled={submitting}
            onChange={(e) =>
              setPicked((prev) => ({ ...prev, [f.key]: e.target.value }))
            }
          />
        ) : (
          <div key={f.key} className="flex flex-col gap-2">
            <p id={`form-${f.key}`} className="text-label text-text-faint">
              {f.label}
            </p>
            <div
              role="group"
              aria-labelledby={`form-${f.key}`}
              className="flex flex-wrap gap-2"
            >
              {f.options.map((option) => (
                <Chip
                  key={option}
                  active={picked[f.key] === option}
                  disabled={submitting}
                  onClick={() =>
                    setPicked((prev) => ({ ...prev, [f.key]: option }))
                  }
                >
                  {option}
                </Chip>
              ))}
            </div>
          </div>
        ),
      )}

      <ErrorNote>{error}</ErrorNote>

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          className="w-full"
          disabled={!complete || submitting}
          onClick={() => void submit()}
        >
          {submitting ? (
            <>
              <Spinner />
              Saving…
            </>
          ) : (
            <>
              <CheckIcon width={18} height={18} />
              Submit
            </>
          )}
        </Button>
        <p className="text-center text-helper text-text-faint">
          You can&apos;t change this after you submit.
        </p>
      </div>
    </Card>
  );
}
