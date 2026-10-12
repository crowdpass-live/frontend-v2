"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api";
import { fromLocalInputValue, toLocalInputValue } from "@/lib/datetime-local";
import { formatDate, formatDateTimeLong, money, normalizePhone } from "@/lib/format";
import { count } from "@/lib/metric-format";
import { useHydrated } from "@/lib/use-hydrated";
import { DateTimeField } from "@/components/DateTimeField";
import { CopyIcon } from "@/components/icons";
import { Select } from "@/components/Select";
import { Sheet } from "@/components/Sheet";
import { TextField } from "@/components/TextField";
import { useToast } from "@/components/Toast";
import { Badge, Button, Spinner, cx } from "@/components/ui";
import type { ApiReferralLink, ApiReferralStats, ReferralLinkKind } from "@/types/api";

const KIND_LABEL: Record<ReferralLinkKind, string> = {
  VENDOR: "Vendor",
  INFLUENCER: "Influencer",
  PROMOTER: "Promoter",
  PARTNER: "Partner",
  OTHER: "Other",
};
/** VENDOR links are made on approval; the API refuses them here. */
const CREATABLE: ReferralLinkKind[] = ["INFLUENCER", "PROMOTER", "PARTNER", "OTHER"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type LinkRow = ApiReferralStats["links"][number] & {
  link: ApiReferralLink | null;
  /** Past its own expiry or the event end; computed on the server. */
  expired: boolean;
};

interface Draft {
  label: string;
  kind: ReferralLinkKind;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  /** ISO, or "" for "until the event ends". */
  expiresAt: string;
}

function message(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status === 0) return "No connection. Nothing was changed — try again when you have signal.";
  return err instanceof ApiError ? err.message : fallback;
}

/**
 * Referral links and the leaderboard (#48, #51), as one list: every link,
 * ranked by tickets sold, with what it brought in — and the sales that came
 * through no link at all, so the rows add up to the event's totals.
 *
 * The code never changes once created (it may be on a flyer); retiring a
 * link is "Disable". Revenue is gross — what buyers paid. Clicks are
 * informational and never a basis for paying anyone.
 */
export function ReferralManager({
  eventId,
  eventEnd,
  canCreate,
  rows,
  stats,
}: {
  eventId: string;
  eventEnd: string | null;
  /** False once the event has ended or been cancelled. */
  canCreate: boolean;
  rows: LinkRow[];
  stats: Pick<ApiReferralStats, "totals" | "attributed" | "unattributed">;
}) {
  const router = useRouter();
  const toast = useToast();
  const hydrated = useHydrated();
  const base = `/organizer/events/${encodeURIComponent(eventId)}/referral-links`;

  const [editing, setEditing] = useState<ApiReferralLink | "new" | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  function open(link: ApiReferralLink | "new") {
    setEditing(link);
    setErrors({});
    setSaveError(null);
    setDraft(
      link === "new"
        ? { label: "", kind: "INFLUENCER", contactName: "", contactEmail: "", contactPhone: "", expiresAt: "" }
        : {
            label: link.label,
            kind: link.kind,
            contactName: link.contactName ?? "",
            contactEmail: link.contactEmail ?? "",
            contactPhone: link.contactPhone ?? "",
            expiresAt: link.expiresAt ?? "",
          },
    );
  }

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft((d) => (d ? { ...d, [k]: v } : d));
    setErrors((e) => ({ ...e, [k]: undefined }));
  }

  async function save() {
    if (!draft || !editing) return;
    const e: Partial<Record<keyof Draft, string>> = {};
    if (!draft.label.trim()) e.label = "Who is it for? e.g. Ada (Instagram)";
    if (draft.contactEmail.trim() && !EMAIL.test(draft.contactEmail.trim())) e.contactEmail = "That doesn't look like an email";
    if (draft.contactPhone.trim() && !normalizePhone(draft.contactPhone)) e.contactPhone = "A phone number, e.g. 08012345678";
    setErrors(e);
    if (Object.keys(e).length) return;

    const name = draft.contactName.trim();
    const email = draft.contactEmail.trim();
    const phone = normalizePhone(draft.contactPhone);
    let body: Record<string, unknown>;
    if (editing === "new") {
      // Empty optionals are left out, never sent as "".
      body = {
        label: draft.label.trim(),
        kind: draft.kind,
        ...(name ? { contactName: name } : {}),
        ...(email ? { contactEmail: email } : {}),
        ...(phone ? { contactPhone: phone } : {}),
        ...(draft.expiresAt ? { expiresAt: draft.expiresAt } : {}),
      };
    } else {
      // Only what changed. A cleared contact is sent as null — "" fails the
      // email and phone checks — and a cleared expiry as null, which runs
      // the link until the event ends.
      const was = editing;
      body = {};
      if (draft.label.trim() !== was.label) body.label = draft.label.trim();
      if (name !== (was.contactName ?? "")) body.contactName = name || null;
      if (email.toLowerCase() !== (was.contactEmail ?? "")) body.contactEmail = email || null;
      if ((phone ?? "") !== (was.contactPhone ?? "")) body.contactPhone = phone;
      if (draft.expiresAt !== (was.expiresAt ?? "")) body.expiresAt = draft.expiresAt || null;
      if (!Object.keys(body).length) {
        setEditing(null);
        return;
      }
    }

    setSaving(true);
    setSaveError(null);
    try {
      const link = await apiFetch<ApiReferralLink>(
        editing === "new" ? base : `${base}/${encodeURIComponent(editing.id)}`,
        { method: editing === "new" ? "POST" : "PATCH", auth: true, body },
      );
      setEditing(null);
      toast(editing === "new" ? `Link for ${link.label} created.` : `${link.label} saved.`);
      router.refresh();
    } catch (err) {
      setSaveError(message(err, "Couldn't save the link. Try again."));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(link: ApiReferralLink) {
    const status = link.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    setToggling(link.id);
    try {
      await apiFetch(`${base}/${encodeURIComponent(link.id)}`, { method: "PATCH", auth: true, body: { status } });
      toast(status === "DISABLED" ? `${link.label} disabled — new sales through it aren't credited.` : `${link.label} is live again.`);
      router.refresh();
    } catch (err) {
      toast(message(err, "Couldn't change that link. Try again."), { tone: "danger" });
    } finally {
      setToggling(null);
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied.");
    } catch {
      toast("Couldn't copy — press and hold the link to copy it.", { tone: "info" });
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-2xl text-label text-text-dim">
          Give each influencer, promoter or partner their own ticket link. A sale
          is credited to the last link the buyer opened. Approved vendors get one
          automatically.
        </p>
        {canCreate ? (
          <Button type="button" size="sm" onClick={() => open("new")} className="w-full shrink-0 sm:w-auto">
            Create a link
          </Button>
        ) : null}
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tally label="Through links" t={stats.attributed} />
        <Tally label="No link" t={stats.unattributed} />
        <Tally label="All ticket sales" t={stats.totals} />
      </dl>

      {rows.length === 0 ? (
        <p className="rounded-card border border-dashed border-border px-5 py-10 text-center text-label text-text-faint">
          No links yet.{canCreate ? " Create one for each person promoting your event, then share it." : ""}
        </p>
      ) : (
        <ol className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {rows.map((r) => {
            const off = r.status === "DISABLED" || r.expired;
            return (
              <li key={r.id} className="flex min-w-0 flex-col gap-3 rounded-card border border-border bg-surface p-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-strong text-label font-bold tabular-nums text-text-dim">
                    {r.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={cx("min-w-0 break-words text-body font-bold", off ? "text-text-faint" : "text-text")}>{r.label}</p>
                      <Badge tone={r.kind === "VENDOR" ? "info" : "neutral"}>{KIND_LABEL[r.kind] ?? r.kind}</Badge>
                      {r.status === "DISABLED" ? <Badge tone="danger">Disabled</Badge> : r.expired ? <Badge tone="warn">Expired</Badge> : null}
                    </div>
                    {r.link?.contactName || r.link?.contactPhone || r.link?.contactEmail ? (
                      <p className="truncate text-helper text-text-faint">
                        {[r.link.contactName, r.link.contactPhone, r.link.contactEmail].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-control border border-border bg-bg py-1 pl-4 pr-1">
                  <span className={cx("min-w-0 flex-1 truncate font-mono text-label", off ? "text-text-faint" : "text-text")}>{r.url}</span>
                  <button
                    type="button"
                    onClick={() => void copy(r.url)}
                    aria-label={`Copy ${r.label}'s link`}
                    className="inline-flex h-10 shrink-0 items-center gap-2 rounded-control px-3 text-label font-bold text-accent hover:bg-accent-tint"
                  >
                    <CopyIcon width={16} height={16} /> Copy
                  </button>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-label sm:grid-cols-4">
                  <Metric label="Tickets" value={count(r.tickets)} strong />
                  <Metric label="Revenue" value={r.revenue ? money(r.revenue) : "₦0"} />
                  <Metric label="Orders" value={count(r.orders)} />
                  <Metric label="Clicks" value={count(r.clicks)} />
                </dl>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-helper text-text-faint">
                    {r.link
                      ? r.link.expiresAt
                        ? `${r.expired ? "Expired" : "Expires"} ${formatDate(r.link.effectiveExpiresAt)}`
                        : "Runs until the event ends"
                      : null}
                  </p>
                  {r.link ? (
                    <div className="-mr-3 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => open(r.link!)}
                        className="h-10 rounded-full px-3 text-label font-bold text-accent hover:bg-accent-tint"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggle(r.link!)}
                        disabled={toggling === r.id}
                        className="h-10 rounded-full px-3 text-label text-text-dim hover:bg-surface-strong hover:text-text disabled:opacity-45"
                      >
                        {toggling === r.id ? "Saving…" : r.status === "ACTIVE" ? "Disable" : "Enable"}
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <p className="text-helper text-text-faint">
        Revenue is what buyers paid, before fees. Refunded and cancelled tickets
        aren&apos;t counted. Links plus “No link” add up to all ticket sales.
      </p>

      <Sheet
        open={!!editing}
        title={editing === "new" ? "Create a link" : `Edit ${editing?.label ?? "link"}`}
        onClose={() => !saving && setEditing(null)}
      >
        {draft ? (
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <TextField
              label="Who it's for"
              value={draft.label}
              onChange={(e) => set("label", e.target.value)}
              maxLength={100}
              placeholder="e.g. Ada (Instagram)"
              error={errors.label}
              disabled={saving}
            />
            {editing === "new" ? (
              <Select
                label="Kind"
                value={draft.kind}
                onChange={(e) => set("kind", e.target.value as ReferralLinkKind)}
                options={CREATABLE.map((k) => ({ value: k, label: KIND_LABEL[k] }))}
                disabled={saving}
              />
            ) : null}
            <TextField
              label="Contact name (optional)"
              value={draft.contactName}
              onChange={(e) => set("contactName", e.target.value)}
              maxLength={100}
              disabled={saving}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label="Phone (optional)"
                type="tel"
                inputMode="tel"
                value={draft.contactPhone}
                onChange={(e) => set("contactPhone", e.target.value)}
                error={errors.contactPhone}
                disabled={saving}
              />
              <TextField
                label="Email (optional)"
                type="email"
                inputMode="email"
                value={draft.contactEmail}
                onChange={(e) => set("contactEmail", e.target.value)}
                error={errors.contactEmail}
                disabled={saving}
              />
            </div>
            <DateTimeField
              label="Stops crediting sales (optional)"
              hint={eventEnd ? `blank = event end, ${formatDateTimeLong(eventEnd)}` : "blank = event end"}
              value={hydrated ? toLocalInputValue(draft.expiresAt) : ""}
              onChange={(e) => set("expiresAt", fromLocalInputValue(e.target.value) ?? "")}
              disabled={saving}
            />
            {editing === "new" ? (
              <p className="text-helper text-text-faint">
                The link&apos;s code is fixed once created, so it&apos;s safe to print.
              </p>
            ) : null}
            {saveError ? <p role="alert" className="text-label text-danger">{saveError}</p> : null}
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? <Spinner /> : null}
              {editing === "new" ? "Create link" : "Save link"}
            </Button>
          </form>
        ) : null}
      </Sheet>
    </div>
  );
}

function Tally({ label, t }: { label: string; t: { orders: number; tickets: number; revenue: number } }) {
  return (
    <div className="rounded-card border border-border bg-surface px-4 py-3">
      <dt className="text-helper text-text-faint">{label}</dt>
      <dd className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-section font-bold tabular-nums text-text">{count(t.tickets)}</span>
        <span className="text-label text-text-dim">
          ticket{t.tickets === 1 ? "" : "s"} · {t.revenue ? money(t.revenue) : "₦0"}
        </span>
      </dd>
    </div>
  );
}

function Metric({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 sm:flex-col sm:items-start sm:gap-0">
      <dt className="text-text-faint">{label}</dt>
      <dd className={cx("tabular-nums", strong ? "font-bold text-text" : "text-text-dim")}>{value}</dd>
    </div>
  );
}
