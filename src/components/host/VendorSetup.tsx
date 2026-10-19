"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api";
import { fromLocalInputValue, toLocalInputValue } from "@/lib/datetime-local";
import { formatDateTimeLong, money } from "@/lib/format";
import { count } from "@/lib/metric-format";
import { useHydrated } from "@/lib/use-hydrated";
import {
  STALL_LIMITS,
  emptyStallDraft,
  organizerVendorsPath,
  stallCreateBody,
  stallDraftFrom,
  stallUpdateBody,
  validateStall,
  type StallDraft,
  type StallErrors,
} from "@/lib/vendors";
import { DateTimeField } from "@/components/DateTimeField";
import { Sheet } from "@/components/Sheet";
import { TextField } from "@/components/TextField";
import { useToast } from "@/components/Toast";
import { Badge, Button, Spinner, cx } from "@/components/ui";
import type { ApiStallType, ApiVendorRegistration } from "@/types/api";

function message(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status === 0) {
    return "No connection. Nothing was changed — try again when you have signal.";
  }
  return err instanceof ApiError ? err.message : fallback;
}

/**
 * An event's vendor setup (#42): the stalls on offer and the switch that
 * takes applications.
 *
 * - **No delete.** Applications reference their stall type, so a type is
 *   retired instead: it keeps its vendors but takes no new ones.
 * - **Quantity can't drop below what's promised.** Stalls are taken at
 *   approval; the form says how many before the API has to.
 * - **`acceptingApplications` is the truth.** The switch can be on while a
 *   passed cut-off has closed registration anyway.
 */
export function VendorSetup({
  eventId,
  eventEnd,
  editable,
  initialStalls,
  initialRegistration,
}: {
  eventId: string;
  /** The latest a cut-off may be. */
  eventEnd: string | null;
  /** False once the event has ended or been cancelled. */
  editable: boolean;
  initialStalls: ApiStallType[];
  initialRegistration: ApiVendorRegistration | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [stalls, setStalls] = useState(initialStalls);
  const activeCount = stalls.filter((s) => s.isActive).length;

  // ---- registration -------------------------------------------------------
  const [registration, setRegistration] = useState(initialRegistration);
  const [regBusy, setRegBusy] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [closesAt, setClosesAt] = useState(initialRegistration?.closesAt ?? "");
  // The input speaks the browser's local time; the server render can't know it.
  const hydrated = useHydrated();

  async function saveRegistration(body: { open: boolean; closesAt?: string | null }, done: string) {
    setRegBusy(true);
    setRegError(null);
    try {
      const next = await apiFetch<ApiVendorRegistration>(organizerVendorsPath(eventId, "/vendor-registration"), {
        method: "PATCH",
        auth: true,
        body,
      });
      setRegistration(next);
      setClosesAt(next.closesAt ?? "");
      toast(done);
      router.refresh();
    } catch (err) {
      setRegError(message(err, "Couldn't change vendor registration. Try again."));
    } finally {
      setRegBusy(false);
    }
  }

  const savedClose = registration?.closesAt ?? "";
  const closeChanged = closesAt !== savedClose;

  // ---- stall form ---------------------------------------------------------
  const [editing, setEditing] = useState<ApiStallType | "new" | null>(null);
  const [draft, setDraft] = useState<StallDraft>(emptyStallDraft);
  const [errors, setErrors] = useState<StallErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  function openForm(stall: ApiStallType | "new") {
    setEditing(stall);
    setDraft(stall === "new" ? emptyStallDraft() : stallDraftFrom(stall));
    setErrors({});
    setSaveError(null);
  }

  function setField(k: keyof StallDraft, v: string) {
    setDraft((d) => ({ ...d, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  }

  function upsert(row: ApiStallType) {
    setStalls((all) => (all.some((s) => s.id === row.id) ? all.map((s) => (s.id === row.id ? row : s)) : [...all, row]));
  }

  async function saveStall() {
    if (!editing) return;
    const was = editing === "new" ? null : editing;
    const errs = validateStall(draft, was?.allocatedCount ?? 0);
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const body = was ? stallUpdateBody(draft, was) : stallCreateBody(draft);
    if (was && Object.keys(body).length === 0) {
      setEditing(null);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const row = await apiFetch<ApiStallType>(
        organizerVendorsPath(eventId, was ? `/stall-types/${encodeURIComponent(was.id)}` : "/stall-types"),
        { method: was ? "PATCH" : "POST", auth: true, body },
      );
      upsert(row);
      setEditing(null);
      toast(was ? `${row.name} saved.` : `${row.name} added.`);
      router.refresh();
    } catch (err) {
      setSaveError(message(err, "Couldn't save the stall. Try again."));
    } finally {
      setSaving(false);
    }
  }

  async function setActive(stall: ApiStallType, isActive: boolean) {
    setToggling(stall.id);
    try {
      const row = await apiFetch<ApiStallType>(
        organizerVendorsPath(eventId, `/stall-types/${encodeURIComponent(stall.id)}`),
        { method: "PATCH", auth: true, body: { isActive } },
      );
      upsert(row);
      toast(isActive ? `${row.name} is taking applications again.` : `${row.name} retired — it takes no new applications.`);
      router.refresh();
    } catch (err) {
      toast(message(err, "Couldn't change that stall. Try again."), { tone: "danger" });
    } finally {
      setToggling(null);
    }
  }

  const accepting = registration?.acceptingApplications ?? false;
  const switchOnButClosed = !!registration?.open && !accepting;

  return (
    <div className="flex flex-col gap-6">
      {/* Registration */}
      <section aria-labelledby="vendor-reg" className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="vendor-reg" className="text-section font-bold text-text">Vendor registration</h2>
              <Badge tone={accepting ? "ok" : "neutral"}>{accepting ? "Taking applications" : "Closed"}</Badge>
            </div>
            <p className="text-label text-text-dim">
              {accepting
                ? registration?.closesAt
                  ? `Vendors can apply until ${formatDateTimeLong(registration.closesAt)}.`
                  : "Vendors can apply from your event page until you close it."
                : switchOnButClosed
                  ? "The cut-off has passed, so no one new can apply. Set a later one, or clear it, to reopen."
                  : "Vendors can't apply yet. Open registration when your stalls are ready."}
            </p>
          </div>
          {editable && registration ? (
            <Button
              type="button"
              size="sm"
              variant={registration.open ? "secondary" : "primary"}
              disabled={regBusy || (!registration.open && activeCount === 0)}
              onClick={() =>
                void saveRegistration(
                  { open: !registration.open },
                  registration.open ? "Vendor registration closed." : "Vendor registration is open.",
                )
              }
              className="w-full shrink-0 sm:w-auto"
            >
              {regBusy ? <Spinner /> : null}
              {registration.open ? "Close registration" : "Open registration"}
            </Button>
          ) : null}
        </div>

        {editable && registration && !registration.open && activeCount === 0 ? (
          <p className="text-helper text-text-faint">Add a stall below first — vendors need something to apply for.</p>
        ) : null}

        {editable && registration ? (
          <form
            className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              const iso = closesAt || null;
              void saveRegistration(
                { open: registration.open, closesAt: iso },
                iso ? "Cut-off saved." : "Cut-off cleared.",
              );
            }}
          >
            <DateTimeField
              label="Applications close (optional)"
              hint={eventEnd ? `by ${formatDateTimeLong(eventEnd)}` : undefined}
              value={hydrated ? toLocalInputValue(closesAt) : ""}
              onChange={(e) => setClosesAt(fromLocalInputValue(e.target.value) ?? "")}
              disabled={regBusy}
              className="min-w-0 flex-1"
            />
            <div className="flex gap-2">
              {savedClose ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={regBusy}
                  onClick={() => void saveRegistration({ open: registration.open, closesAt: null }, "Cut-off cleared.")}
                  className="w-auto"
                >
                  Clear
                </Button>
              ) : null}
              <Button type="submit" variant="secondary" size="sm" disabled={regBusy || !closeChanged} className="w-full sm:w-auto">
                Save cut-off
              </Button>
            </div>
          </form>
        ) : null}

        {!editable ? (
          <p className="text-label text-text-faint">This event is over, so its vendor setup can no longer change.</p>
        ) : !registration ? (
          <p className="text-label text-text-faint">Only the event&apos;s organizer can open or close registration.</p>
        ) : null}
        {regError ? <p role="alert" className="text-label text-danger">{regError}</p> : null}
      </section>

      {/* Stall types */}
      <section aria-labelledby="stall-types" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="stall-types" className="text-section font-bold text-text">
            Stalls{stalls.length ? ` · ${stalls.length}` : ""}
          </h2>
          {editable ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => openForm("new")} className="w-auto">
              Add a stall
            </Button>
          ) : null}
        </div>

        {stalls.length === 0 ? (
          <p className="rounded-card border border-dashed border-border px-5 py-10 text-center text-label text-text-faint">
            No stalls yet. Add the kinds of stall you offer — e.g. “Food stall 3×3m”, ₦50,000, 20 available.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
            {stalls.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={cx("min-w-0 break-words text-body font-bold", s.isActive ? "text-text" : "text-text-faint")}>
                      {s.name}
                    </p>
                    {!s.isActive ? <Badge>Retired</Badge> : s.remaining === 0 ? <Badge tone="warn">All taken</Badge> : null}
                  </div>
                  <p className="text-label text-text-dim">
                    <span className="font-bold text-text">{money(s.price)}</span>
                    {" · "}
                    {count(s.allocatedCount)} of {count(s.quantity)} taken · {count(s.remaining)} left
                  </p>
                  <p className="text-helper text-text-faint">
                    {s.passesPerStall} door pass{s.passesPerStall === 1 ? "" : "es"} per stall
                    {s.description ? ` · ${s.description}` : ""}
                  </p>
                </div>
                {editable ? (
                  <div className="-ml-3 flex items-center gap-1 sm:ml-0 sm:shrink-0">
                    <button
                      type="button"
                      onClick={() => openForm(s)}
                      className="h-10 rounded-full px-3 text-label font-bold text-accent hover:bg-accent-tint"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void setActive(s, !s.isActive)}
                      disabled={toggling === s.id}
                      className="h-10 rounded-full px-3 text-label text-text-dim hover:bg-surface-strong hover:text-text disabled:opacity-45"
                    >
                      {toggling === s.id ? "Saving…" : s.isActive ? "Retire" : "Reactivate"}
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {stalls.length ? (
          <p className="text-helper text-text-faint">
            Stalls are held when you approve a vendor, not when they pay. A retired
            stall keeps its vendors but takes no new applications.
          </p>
        ) : null}
      </section>

      <Sheet
        open={!!editing}
        title={editing === "new" ? "Add a stall" : `Edit ${editing?.name ?? "stall"}`}
        onClose={() => !saving && setEditing(null)}
      >
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void saveStall();
          }}
        >
          <TextField
            label="Name"
            value={draft.name}
            onChange={(e) => setField("name", e.target.value)}
            maxLength={STALL_LIMITS.name}
            placeholder="e.g. Food stall 3×3m"
            error={errors.name}
            disabled={saving}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Fee (₦)"
              inputMode="decimal"
              value={draft.price}
              onChange={(e) => setField("price", e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="0 = free"
              error={errors.price}
              disabled={saving}
            />
            <TextField
              label="How many"
              inputMode="numeric"
              value={draft.quantity}
              onChange={(e) => setField("quantity", e.target.value.replace(/\D/g, ""))}
              placeholder="e.g. 20"
              error={errors.quantity}
              disabled={saving}
            />
          </div>
          <TextField
            label="Door passes per stall"
            inputMode="numeric"
            value={draft.passesPerStall}
            onChange={(e) => setField("passesPerStall", e.target.value.replace(/\D/g, "").slice(0, 2))}
            error={errors.passesPerStall}
            disabled={saving}
          />
          <DescriptionField
            value={draft.description}
            onChange={(v) => setField("description", v)}
            error={errors.description}
            disabled={saving}
          />
          {editing !== "new" && editing && editing.allocatedCount > 0 ? (
            <p className="text-helper text-text-faint">
              {count(editing.allocatedCount)} approved vendor{editing.allocatedCount === 1 ? " keeps" : "s keep"} the fee
              they were approved at — a new fee applies to later approvals only.
            </p>
          ) : null}
          {saveError ? <p role="alert" className="text-label text-danger">{saveError}</p> : null}
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? <Spinner /> : null}
            {editing === "new" ? "Add stall" : "Save stall"}
          </Button>
        </form>
      </Sheet>
    </div>
  );
}

function DescriptionField({
  value,
  onChange,
  error,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="stall-description" className="text-label text-text-dim">
        What&apos;s included <span className="text-text-faint">· optional</span>
      </label>
      <textarea
        id="stall-description"
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={STALL_LIMITS.description}
        disabled={disabled}
        placeholder="e.g. One table, two chairs, power point"
        aria-invalid={!!error}
        aria-describedby={error ? "stall-description-error" : undefined}
        className={cx(
          "resize-y rounded-control border bg-surface px-4 py-3 text-body text-text placeholder:text-text-faint",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          error ? "border-danger" : "border-border",
        )}
      />
      {error ? (
        <span id="stall-description-error" role="alert" className="text-helper text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}
