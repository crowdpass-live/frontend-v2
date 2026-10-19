"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api";
import { money, normalizePhone } from "@/lib/format";
import { TextField } from "@/components/TextField";
import { Button, ErrorNote, Spinner, cx } from "@/components/ui";
import type { ApiPublicStalls, ApiVendorApplication } from "@/types/api";

/** `CreateVendorApplicationDto` limits. */
const LIMITS = { businessName: 120, contactName: 100, category: 60, description: 1000 } as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Fields = "stall" | "businessName" | "contactName" | "email" | "phone" | "category" | "description";

/**
 * One application per vendor per event. Every vendor email goes to the
 * address given here, not the account's, so it is asked for (prefilled)
 * rather than assumed. The marketing opt-in starts unticked: under the NDPA
 * the organizer may only contact vendors who ticked it themselves.
 */
export function ApplyForm({
  eventId,
  stalls,
  currency,
  initialStall,
  prefill,
}: {
  eventId: string;
  stalls: ApiPublicStalls["stallTypes"];
  currency: string;
  initialStall: string | null;
  prefill: { contactName: string; email: string; phone: string };
}) {
  const router = useRouter();
  const [stallId, setStallId] = useState<string | null>(
    initialStall ?? (stalls.filter((s) => s.remaining > 0).length === 1 ? stalls.find((s) => s.remaining > 0)!.id : null),
  );
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState(prefill.contactName);
  const [email, setEmail] = useState(prefill.email);
  const [phone, setPhone] = useState(prefill.phone);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Fields, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate() {
    const e: Partial<Record<Fields, string>> = {};
    if (!stallId) e.stall = "Pick the stall you want";
    if (!businessName.trim()) e.businessName = "Your business or brand name";
    if (!contactName.trim()) e.contactName = "Who should the organizer talk to?";
    if (!EMAIL.test(email.trim())) e.email = "An email you check — updates and passes go here";
    if (!normalizePhone(phone)) e.phone = "A phone number, e.g. 08012345678";
    if (description.trim().length > LIMITS.description) e.description = `At most ${LIMITS.description} characters`;
    return e;
  }

  async function submit() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    setError(null);
    try {
      const app = await apiFetch<ApiVendorApplication>(`/events/${encodeURIComponent(eventId)}/vendor-applications`, {
        method: "POST",
        auth: true,
        // Exactly the DTO's fields; empty optionals are left out.
        body: {
          stallTypeId: stallId,
          businessName: businessName.trim(),
          contactName: contactName.trim(),
          email: email.trim(),
          phone: normalizePhone(phone),
          ...(category.trim() ? { category: category.trim() } : {}),
          ...(description.trim() ? { description: description.trim() } : {}),
          marketingOptIn: optIn,
        },
        timeout: 45_000,
      });
      router.push(`/vendor-applications/${app.id}?applied=1`);
    } catch (err) {
      setBusy(false);
      setError(
        err instanceof ApiError
          ? err.status === 0
            ? "No connection — check your signal and try again."
            : err.message
          : "Your application didn't go through. Try again.",
      );
    }
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-section font-bold text-text">Which stall?</legend>
        {stalls.map((s) => {
          const full = s.remaining <= 0;
          const picked = stallId === s.id;
          return (
            <label
              key={s.id}
              className={cx(
                "flex cursor-pointer items-start gap-3 rounded-card border p-4 transition-colors",
                full && "cursor-not-allowed opacity-50",
                picked ? "border-accent bg-accent-tint" : "border-border bg-surface hover:border-border-strong",
              )}
            >
              <input
                type="radio"
                name="stall"
                value={s.id}
                checked={picked}
                disabled={full || busy}
                onChange={() => {
                  setStallId(s.id);
                  setErrors((x) => ({ ...x, stall: undefined }));
                }}
                className="mt-1 size-4 shrink-0 accent-accent"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-start justify-between gap-3">
                  <span className="break-words text-body font-semibold text-text">{s.name}</span>
                  <span className="shrink-0 text-body font-bold text-text">{money(s.price, currency)}</span>
                </span>
                <span className="text-helper text-text-faint">
                  {full ? "All taken" : `${s.remaining} left`} · {s.passesPerStall} door pass
                  {s.passesPerStall === 1 ? "" : "es"}
                </span>
                {s.description ? (
                  <span className="whitespace-pre-line break-words text-label text-text-dim">{s.description}</span>
                ) : null}
              </span>
            </label>
          );
        })}
        {errors.stall ? <p role="alert" className="text-helper text-danger">{errors.stall}</p> : null}
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-3 text-section font-bold text-text">Your business</legend>
        <TextField
          label="Business name"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          maxLength={LIMITS.businessName}
          autoComplete="organization"
          placeholder="e.g. Mama Put Grills"
          error={errors.businessName}
          disabled={busy}
        />
        <TextField
          label="What you sell (optional)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          maxLength={LIMITS.category}
          placeholder="e.g. Grills, Drinks, Crafts"
          disabled={busy}
        />
        <div className="flex flex-col gap-2">
          <label htmlFor="vendor-description" className="text-label text-text-dim">
            Tell the organizer about it <span className="text-text-faint">· optional</span>
          </label>
          <textarea
            id="vendor-description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={LIMITS.description}
            disabled={busy}
            placeholder="What you'll sell, what you'll bring, anything they should know"
            aria-invalid={!!errors.description}
            className={cx(
              "resize-y rounded-control border bg-surface px-4 py-3 text-body text-text placeholder:text-text-faint",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              errors.description ? "border-danger" : "border-border",
            )}
          />
          {errors.description ? <span role="alert" className="text-helper text-danger">{errors.description}</span> : null}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-section font-bold text-text">Contact</legend>
        <p className="text-label text-text-dim">
          The organizer uses these to reach you, and every update — approval,
          payment, your door passes — goes to this email.
        </p>
        <TextField
          label="Contact name"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          maxLength={LIMITS.contactName}
          autoComplete="name"
          error={errors.contactName}
          disabled={busy}
        />
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          inputMode="email"
          error={errors.email}
          disabled={busy}
        />
        <TextField
          label="Phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          inputMode="tel"
          placeholder="08012345678"
          error={errors.phone}
          disabled={busy}
        />
        <label className="flex cursor-pointer items-start gap-3 text-label text-text-dim">
          <input
            type="checkbox"
            checked={optIn}
            onChange={(e) => setOptIn(e.target.checked)}
            disabled={busy}
            className="mt-0.5 size-5 shrink-0 accent-accent"
          />
          The organizer may contact me about future editions of this event.
        </label>
      </fieldset>

      <ErrorNote>{error}</ErrorNote>

      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? <Spinner /> : null}
          {busy ? "Sending…" : "Send application"}
        </Button>
        <p className="text-center text-helper text-text-faint">
          Applying is free. If the organizer approves you, you&apos;ll pay the
          stall fee then — so a no costs you nothing.
        </p>
      </div>
    </form>
  );
}
