"use client";

import { useCallback, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api";
import { fromLocalInputValue, toLocalInputValue } from "@/lib/datetime-local";
import { useHydrated } from "@/lib/use-hydrated";
import {
  CATEGORIES,
  LIMITS,
  defaultTimes,
  earliestStart,
  endAfterStart,
  hasErrors,
  newTier,
  toPayload,
  validate,
  type DraftErrors,
  type EventDraft,
  type TierDraft,
} from "@/lib/event-form";
import { Chip } from "@/components/Chip";
import { DateTimeField } from "@/components/DateTimeField";
import { Select } from "@/components/Select";
import { TextField } from "@/components/TextField";
import { useToast } from "@/components/Toast";
import { CoverPicker } from "@/components/host/CoverPicker";
import { LockIcon } from "@/components/icons";
import { Button, ErrorNote, Spinner, cx } from "@/components/ui";
import type { ApiEvent } from "@/types/api";

export interface ChainOption {
  id: string;
  displayName: string;
  isTestnet: boolean;
}

/**
 * Create or edit an event (#38). Ports `CreateEventScreen.js`.
 *
 * - **Create** makes a DRAFT (`POST /events`) and opens its page, where it
 *   is published (#39). **Edit** is DRAFT-only (`PUT /events/:id`); the page
 *   refuses to render this form for anything else.
 * - **The chain is create-only and immutable** — a picker on create, a
 *   locked line on edit, and never in the update body.
 * - Every `CreateEventDto` limit is checked here first (`lib/event-form`),
 *   so a host meets a rule beside the field, not as a 400 after saving.
 * - Members-only ticket types aren't set here: uploading a member list on
 *   the event's Members tab is what makes a type members-only.
 */
export function EventForm({
  mode,
  eventId,
  initial,
  chains,
}: {
  mode: "create" | "edit";
  eventId?: string;
  initial: EventDraft;
  chains: ChainOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const formId = useId();
  // A new event's default times are the host's 8pm. The initializer runs
  // again in the browser on hydration, so the browser's zone wins; the
  // server's pass renders nothing date-dependent (see `local` below).
  const [draft, setDraft] = useState(() => (initial.start ? initial : { ...initial, ...defaultTimes() }));
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverPending, setCoverPending] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  // Dates are ISO in state; the inputs show the BROWSER's local time, so
  // they render empty on the server and fill in once hydrated.
  const hydrated = useHydrated();
  const local = (iso: string) => (hydrated ? toLocalInputValue(iso) : "");

  const errors: DraftErrors = touched ? validate(draft) : { tier: {} };
  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const setTier = (key: string, patch: Partial<TierDraft>) =>
    setDraft((d) => ({ ...d, tiers: d.tiers.map((t) => (t.key === key ? { ...t, ...patch } : t)) }));
  const onCoverPending = useCallback((p: boolean) => setCoverPending(p), []);

  const allFree = draft.tiers.length > 0 && draft.tiers.every((t) => t.price.trim() !== "" && Number(t.price) === 0);
  const chain = chains.find((c) => c.id === draft.chain);

  async function submit() {
    setTouched(true);
    setError(null);
    if (coverPending) {
      setError("Finish the cover first — tap “Use this cover”, or cancel it.");
      return;
    }
    const found = validate(draft);
    if (hasErrors(found)) {
      setError("Some details need fixing — they're marked below.");
      // The first marked field, not the top of a long form.
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(`#${CSS.escape(formId)} [aria-invalid="true"]`)?.focus(),
      );
      return;
    }
    setBusy(true);
    try {
      const body = toPayload(draft, mode);
      if (mode === "create") {
        const event = await apiFetch<ApiEvent>("/events", { method: "POST", auth: true, body, timeout: 45_000 });
        toast("Draft saved. Check it over, then publish when you're ready.", { tone: "ok" });
        router.push(`/host/events/${event.id}`);
      } else {
        await apiFetch<ApiEvent>(`/events/${encodeURIComponent(eventId!)}`, {
          method: "PUT",
          auth: true,
          body,
          timeout: 45_000,
        });
        toast("Changes saved.", { tone: "ok" });
        router.push(`/host/events/${eventId}`);
        router.refresh();
      }
    } catch (err) {
      setBusy(false);
      setError(err instanceof ApiError ? err.message : "Couldn't save. Please try again.");
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <form
      id={formId}
      noValidate
      className="flex flex-col gap-8"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div ref={topRef} className="scroll-mt-24">
        <ErrorNote>{error}</ErrorNote>
      </div>

      <CoverPicker
        value={draft.coverImage}
        onChange={(url) => set("coverImage", url)}
        onPendingChange={onCoverPending}
        disabled={busy}
      />

      <Section title="The basics">
        <Counted value={draft.name} max={LIMITS.name}>
          <TextField
            label="Event name"
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            maxLength={LIMITS.name}
            placeholder="e.g. Lagos Jazz Night"
            error={errors.name}
            disabled={busy}
          />
        </Counted>

        <div className="flex flex-col gap-2">
          <span id={`${formId}-cat`} className="text-label text-text-dim">Category</span>
          <div role="group" aria-labelledby={`${formId}-cat`} className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Chip key={c.value} active={draft.category === c.value} disabled={busy} onClick={() => set("category", c.value)}>
                {c.label}
              </Chip>
            ))}
          </div>
        </div>

        <Counted value={draft.description} max={LIMITS.description}>
          <TextArea
            label="Description"
            value={draft.description}
            onChange={(v) => set("description", v)}
            maxLength={LIMITS.description}
            placeholder="What's happening, who's performing, what to bring…"
            error={errors.description}
            disabled={busy}
          />
        </Counted>
      </Section>

      <Section title="When and where">
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
          <TextField
            label="Venue"
            value={draft.venue}
            onChange={(e) => set("venue", e.target.value)}
            maxLength={LIMITS.venue}
            placeholder="e.g. Muri Okunola Park"
            error={errors.venue}
            disabled={busy}
          />
          <TextField
            label="City"
            value={draft.location}
            onChange={(e) => set("location", e.target.value)}
            maxLength={LIMITS.location}
            placeholder="e.g. Lagos"
            error={errors.location}
            disabled={busy}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
          <DateTimeField
            label="Starts"
            value={local(draft.start)}
            min={hydrated ? toLocalInputValue(earliestStart()) : undefined}
            onChange={(e) => {
              const start = fromLocalInputValue(e.target.value) ?? "";
              setDraft((d) => ({ ...d, start, end: endAfterStart(start, d.end) }));
            }}
            error={errors.start}
            disabled={busy}
          />
          <DateTimeField
            label="Ends"
            value={local(draft.end)}
            onChange={(e) => set("end", fromLocalInputValue(e.target.value) ?? "")}
            error={errors.end}
            disabled={busy}
          />
        </div>
        <p className="-mt-2 text-helper text-text-faint">
          Events start at least 24 hours from now and run for at least a day.
          Ticket sales open as soon as you publish.
        </p>
      </Section>

      <Section
        title="Tickets"
        note={allFree ? "Every ticket is ₦0, so this is a free event." : "Set a ticket to ₦0 to make it free."}
      >
        {errors.tiers ? <p role="alert" className="text-helper text-danger">{errors.tiers}</p> : null}
        <ol className="flex flex-col gap-3">
          {draft.tiers.map((t, i) => {
            const te = errors.tier[t.key] ?? {};
            const locked = !!t.soldCount;
            return (
              <li key={t.key} className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-label font-bold text-text">
                    Ticket type {i + 1}
                    {t.claimOnly ? <span className="font-normal text-text-faint"> · members only</span> : null}
                  </span>
                  {draft.tiers.length > 1 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy || locked}
                      title={locked ? "It has sales, so it can't be removed" : undefined}
                      onClick={() => setDraft((d) => ({ ...d, tiers: d.tiers.filter((x) => x.key !== t.key) }))}
                      aria-label={`Remove ticket type ${i + 1}${t.name.trim() ? ` (${t.name.trim()})` : ""}`}
                      className="w-auto"
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
                <TextField
                  label="Name"
                  value={t.name}
                  onChange={(e) => setTier(t.key, { name: e.target.value })}
                  maxLength={LIMITS.tierName}
                  placeholder="e.g. Regular, VIP, Early bird"
                  error={te.name}
                  disabled={busy}
                />
                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    label="Price (₦)"
                    inputMode="decimal"
                    value={t.price}
                    onChange={(e) => setTier(t.key, { price: e.target.value.replace(/[^\d.]/g, "") })}
                    placeholder="0 = free"
                    error={te.price}
                    disabled={busy}
                  />
                  <TextField
                    label="Quantity"
                    inputMode="numeric"
                    value={t.quantity}
                    onChange={(e) => setTier(t.key, { quantity: e.target.value.replace(/\D/g, "") })}
                    placeholder="e.g. 100"
                    error={te.quantity}
                    disabled={busy}
                  />
                </div>
                <TextField
                  label="Max per person (optional)"
                  inputMode="numeric"
                  value={t.maxPerUser}
                  onChange={(e) => setTier(t.key, { maxPerUser: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                  placeholder="5"
                  error={te.maxPerUser}
                  disabled={busy}
                />
              </li>
            );
          })}
        </ol>
        {draft.tiers.length < LIMITS.tiers ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => setDraft((d) => ({ ...d, tiers: [...d.tiers, newTier()] }))}
            className="w-full sm:w-fit"
          >
            Add a ticket type
          </Button>
        ) : (
          <p className="text-helper text-text-faint">That&apos;s the maximum of {LIMITS.tiers} ticket types.</p>
        )}
        <p className="text-helper text-text-faint">
          Want a members-only ticket (matric number + name)? Create it here at ₦0,
          then add its member list on the event&apos;s Members tab before publishing.
        </p>
      </Section>

      <Section title="Options">
        <Toggle
          label="Refundable"
          checked={draft.isRefundable}
          onChange={(v) => set("isRefundable", v)}
          disabled={busy}
          description="If you cancel the event, crypto (USDC) tickets are refunded on-chain automatically. Card and transfer refunds are handled by support."
        />
        {mode === "create" ? (
          chains.length > 1 ? (
            <Select
              label="Settlement chain"
              value={draft.chain ?? ""}
              onChange={(e) => set("chain", e.target.value)}
              options={chains.map((c) => ({ value: c.id, label: `${c.displayName}${c.isTestnet ? " (testnet)" : ""}` }))}
              hint="Where crypto tickets are recorded. It can't be changed after you save."
              disabled={busy}
            />
          ) : chain ? (
            <ChainLine name={chain.displayName} testnet={chain.isTestnet} note="Crypto tickets are recorded here." />
          ) : null
        ) : (
          <ChainLine
            name={chain?.displayName ?? draft.chain ?? "Default chain"}
            testnet={!!chain?.isTestnet}
            note="Set when the event was created and can't be changed."
            locked
          />
        )}
      </Section>

      <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
        <Button type="submit" disabled={busy} className="w-full sm:w-auto">
          {busy ? <Spinner /> : null}
          {busy ? "Saving…" : mode === "create" ? "Save as draft" : "Save changes"}
        </Button>
        <Link
          href={mode === "create" ? "/host" : `/host/events/${eventId}`}
          className="inline-flex min-h-10 items-center justify-center text-label text-text-dim hover:text-text"
        >
          Cancel
        </Link>
        {mode === "create" ? (
          <p className="text-helper text-text-faint sm:ml-auto sm:max-w-56 sm:text-right">
            Nothing goes live yet — you&apos;ll check it over, then publish.
          </p>
        ) : null}
      </div>
    </form>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <div>
        <h2 id={id} className="text-section font-bold text-text">{title}</h2>
        {note ? <p className="text-helper text-text-faint">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** A field with a "12 / 100" count under it, warning near the limit. */
function Counted({ value, max, children }: { value: string; max: number; children: React.ReactNode }) {
  const n = value.length;
  return (
    <div className="flex flex-col gap-1">
      {children}
      <span aria-hidden className={cx("self-end text-helper tabular-nums", n > max * 0.9 ? "text-warn" : "text-text-faint")}>
        {n} / {max}
      </span>
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  error,
  ...props
}: Omit<React.ComponentProps<"textarea">, "onChange" | "value"> & {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-label text-text-dim">{label}</label>
      <textarea
        {...props}
        id={id}
        rows={5}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cx(
          "min-h-32 resize-y rounded-control border bg-surface px-4 py-3 text-body text-text placeholder:text-text-faint",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          error ? "border-danger" : "border-border",
        )}
      />
      {error ? <span id={`${id}-error`} role="alert" className="text-helper text-danger">{error}</span> : null}
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 rounded-card border border-border bg-surface p-4">
      <div className="min-w-0">
        <p id={id} className="text-body font-bold text-text">{label}</p>
        <p className="text-label text-text-dim">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="grid h-10 w-14 shrink-0 place-items-center disabled:opacity-60"
      >
        <span
          aria-hidden
          className={cx(
            "relative h-7 w-12 rounded-full transition-colors",
            checked ? "bg-accent" : "bg-surface-strong",
          )}
        >
          <span
            className={cx(
              "absolute left-0 top-1 size-5 rounded-full bg-text transition-transform",
              checked ? "translate-x-6" : "translate-x-1",
            )}
          />
        </span>
      </button>
    </div>
  );
}

function ChainLine({ name, testnet, note, locked = false }: { name: string; testnet: boolean; note: string; locked?: boolean }) {
  return (
    <div className="flex items-start gap-3 rounded-card border border-border bg-surface p-4">
      {locked ? <LockIcon className="mt-0.5 shrink-0 text-text-faint" /> : null}
      <div className="min-w-0">
        <p className="text-body font-bold text-text">
          Settles on {name}
          {testnet ? <span className="font-normal text-text-faint"> (testnet)</span> : null}
        </p>
        <p className="text-label text-text-dim">{note}</p>
      </div>
    </div>
  );
}
