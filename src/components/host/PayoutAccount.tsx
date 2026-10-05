"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { isMockSubaccount, isRealSubaccount } from "@/lib/payout-setup";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Sheet } from "@/components/Sheet";
import { TextField } from "@/components/TextField";
import { useToast } from "@/components/Toast";
import {
  CardIcon,
  CheckIcon,
  ChevronRightIcon,
  LockIcon,
  SearchIcon,
} from "@/components/icons";
import { Badge, Button, ButtonLink, ErrorNote, Spinner, cx } from "@/components/ui";
import type {
  ApiBank,
  ApiBankHistory,
  ApiBankUpdateResult,
  KycStatus,
  PayoutProvider,
} from "@/types/api";

const PROVIDERS: { id: PayoutProvider; label: string; sub: string }[] = [
  { id: "PAYSTACK", label: "Paystack", sub: "Card, bank transfer and USSD" },
  { id: "MONNIFY", label: "Monnify", sub: "Card and bank transfer" },
];

const LABEL: Record<PayoutProvider, string> = { PAYSTACK: "Paystack", MONNIFY: "Monnify" };

const ACCOUNT_LENGTH = 10;

/** What the page needs from `organizerProfile` (via `/auth/me`). */
export interface PayoutProfile {
  kycStatus: KycStatus;
  bankName: string | null;
  bankCode: string | null;
  /** MASKED by `/auth/me` — display only, never send it back. */
  accountNumber: string | null;
  accountName: string | null;
  bankVerified: boolean;
  paystackSubaccountCode: string | null;
  monnifySubAccountCode: string | null;
}

/** The backend's messages, said the way a host can act on them. */
function friendly(err: unknown): string {
  if (!(err instanceof ApiError)) return "Couldn't reach CrowdPass. Please try again.";
  if (/bank account verification failed/i.test(err.message)) {
    return "We couldn't verify that account. Check the bank and the 10-digit number — it must be an account in your name.";
  }
  return err.message;
}

/**
 * Connect a payout account (#35). Ports `ConnectPayoutScreen.js`, plus the
 * bank change and history mobile doesn't have.
 *
 * - **KYC first.** Both enable routes 403 until identity is VERIFIED, so an
 *   unverified host sees the way to /host/verify, never the 403.
 * - **A `DEV_` subaccount is not a connection.** It reads as "reconnect
 *   needed", and the backend lets it be replaced.
 * - **One bank for every provider.** The second provider reuses the bank
 *   the first one verified (the backend ignores the body once a bank is
 *   verified), so it asks the host to confirm that account's number —
 *   checked against the last four digits — rather than offering a field
 *   whose value would be silently dropped.
 * - **Changing bank** goes through Paystack name-resolution and is pushed to
 *   every enabled provider before it is saved. A provider that didn't take
 *   it still settles to the OLD account, and the page says so by name.
 */
export function PayoutAccount({
  profile,
  banks,
  history,
}: {
  profile: PayoutProfile;
  banks: ApiBank[];
  history: ApiBankHistory["data"];
}) {
  const router = useRouter();
  const toast = useToast();

  const connected: Record<PayoutProvider, boolean> = {
    PAYSTACK: isRealSubaccount(profile.paystackSubaccountCode),
    MONNIFY: isRealSubaccount(profile.monnifySubAccountCode),
  };
  const stale: Record<PayoutProvider, boolean> = {
    PAYSTACK: isMockSubaccount(profile.paystackSubaccountCode),
    MONNIFY: isMockSubaccount(profile.monnifySubAccountCode),
  };
  const anyConnected = connected.PAYSTACK || connected.MONNIFY;
  const verified = profile.kycStatus === "VERIFIED";

  // --- Not verified: the gate, nothing else ------------------------------------
  if (!verified) {
    const blocked = profile.kycStatus === "REJECTED";
    return (
      <section className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5">
        <div className="flex items-start gap-3">
          <LockIcon className="mt-0.5 shrink-0 text-warn" />
          <div className="min-w-0">
            <h2 className="text-body font-bold text-text">Verify your identity first</h2>
            <p className="mt-1 text-label text-text-dim">
              {blocked
                ? "Verification is blocked on this account. Contact CrowdPass support to reopen it — crypto events keep working in the meantime."
                : "Banks and payment providers need to know who they're paying. It's a one-time check and takes about a minute — then come straight back here."}
            </p>
          </div>
        </div>
        {blocked ? null : (
          <ButtonLink href="/host/verify" size="sm" className="w-full sm:w-fit">
            Verify your identity
          </ButtonLink>
        )}
      </section>
    );
  }

  // --- Verified, nothing connected yet: the connect form -------------------------
  if (!anyConnected) {
    return (
      <ConnectForm
        banks={banks}
        stale={stale}
        onConnected={(provider) => {
          toast(`${LABEL[provider]} is connected. Your NGN events can take card and bank transfer.`, { tone: "ok" });
          router.refresh();
        }}
      />
    );
  }

  // --- Connected -------------------------------------------------------------------
  return (
    <Connected
      profile={profile}
      banks={banks}
      history={history}
      connected={connected}
      stale={stale}
      onChange={(message) => {
        if (message) toast(message, { tone: "ok" });
        router.refresh();
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// First connection
// ---------------------------------------------------------------------------

function ConnectForm({
  banks,
  stale,
  onConnected,
}: {
  banks: ApiBank[];
  stale: Record<PayoutProvider, boolean>;
  onConnected: (provider: PayoutProvider) => void;
}) {
  const [provider, setProvider] = useState<PayoutProvider>("PAYSTACK");
  const [bank, setBank] = useState<ApiBank | null>(null);
  const [account, setAccount] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problems = {
    bank: bank ? undefined : "Pick your bank from the list",
    account: account.length === ACCOUNT_LENGTH ? undefined : `Enter all ${ACCOUNT_LENGTH} digits`,
  };

  async function connect() {
    setTouched(true);
    if (problems.bank || problems.account || !bank) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/organizer/providers/${provider === "MONNIFY" ? "monnify" : "paystack"}/enable`, {
        method: "POST",
        auth: true,
        body: { bankCode: bank.code, accountNumber: account },
        // Name enquiry + subaccount creation at the gateway.
        timeout: 60_000,
      });
      onConnected(provider);
    } catch (err) {
      setError(friendly(err));
      setBusy(false);
    }
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        void connect();
      }}
    >
      {stale.PAYSTACK || stale.MONNIFY ? (
        <p className="rounded-control border border-warn/40 bg-warn/10 px-4 py-3 text-label text-warn">
          A payout account was set up for you before verification existed, but it
          was never really created, so card payments are off for your events.
          Connecting below fixes it.
        </p>
      ) : null}

      <fieldset disabled={busy} className="flex min-w-0 flex-col gap-2">
        <legend className="mb-2 text-label text-text-dim">Payment provider</legend>
        <div role="radiogroup" className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
          {PROVIDERS.map((p) => {
            const on = p.id === provider;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setProvider(p.id);
                  setError(null);
                }}
                className={cx(
                  "flex min-h-16 items-center justify-between gap-3 rounded-control border px-4 py-3 text-left transition-colors",
                  on ? "border-accent bg-accent-tint" : "border-border bg-surface hover:border-border-strong",
                )}
              >
                <span className="min-w-0">
                  <span className="block text-body font-bold text-text">{p.label}</span>
                  <span className="block text-helper text-text-faint">{p.sub}</span>
                </span>
                {on ? <CheckIcon className="shrink-0 text-accent" /> : null}
              </button>
            );
          })}
        </div>
        <p className="text-helper text-text-faint">
          You can add the other one afterwards — both settle to the same bank account.
        </p>
      </fieldset>

      <BankFields
        banks={banks}
        bank={bank}
        onBank={setBank}
        account={account}
        onAccount={setAccount}
        disabled={busy}
        errors={touched ? problems : {}}
      />

      <ErrorNote>{error}</ErrorNote>

      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={busy} className="w-full sm:w-fit">
          {busy ? <Spinner /> : null}
          {busy ? "Verifying your account…" : `Connect ${LABEL[provider]}`}
        </Button>
        {busy ? (
          <p role="status" className="text-helper text-text-faint">
            We&apos;re checking the account with your bank. This can take up to a minute.
          </p>
        ) : null}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Connected: the account, the providers, changes
// ---------------------------------------------------------------------------

function Connected({
  profile,
  banks,
  history,
  connected,
  stale,
  onChange,
}: {
  profile: PayoutProfile;
  banks: ApiBank[];
  history: ApiBankHistory["data"];
  connected: Record<PayoutProvider, boolean>;
  stale: Record<PayoutProvider, boolean>;
  onChange: (message?: string) => void;
}) {
  const [adding, setAdding] = useState<PayoutProvider | null>(null);
  const [changing, setChanging] = useState(false);
  /** Providers a bank change didn't reach — they still pay the old account. */
  const [lagging, setLagging] = useState<string[]>([]);
  const last4 = (profile.accountNumber ?? "").replace(/\D/g, "").slice(-4);

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="settles-to" className="flex flex-col gap-3">
        <h2 id="settles-to" className="text-section font-bold text-text">Settles to</h2>
        <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5">
          <div className="flex items-start gap-3">
            <CardIcon className="mt-0.5 shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <p className="break-words text-body font-bold text-text">{profile.accountName ?? "Your account"}</p>
              <p className="text-label text-text-dim">
                {profile.bankName ?? "Bank"}
                {last4 ? ` · ending ${last4}` : ""}
              </p>
            </div>
            {profile.bankVerified ? <Badge tone="ok">Verified</Badge> : null}
          </div>
          {lagging.length ? (
            <p role="alert" className="rounded-control border border-warn/40 bg-warn/10 px-4 py-3 text-label text-warn">
              {lagging.join(" and ")} didn&apos;t take the change and still pays your
              previous account. Change the bank again to retry.
            </p>
          ) : null}
          {changing ? (
            <ChangeBank
              banks={banks}
              onCancel={() => setChanging(false)}
              onDone={(res) => {
                setChanging(false);
                const behind = res.providers.filter((p) => !p.synced).map((p) => LABEL[p.provider] ?? p.provider);
                setLagging(behind);
                onChange(behind.length ? undefined : `Payouts now go to ${res.bankName ?? "your new bank"}.`);
              }}
            />
          ) : (
            <Button type="button" variant="secondary" size="sm" onClick={() => setChanging(true)} className="w-full sm:w-fit">
              Change bank account
            </Button>
          )}
        </div>
      </section>

      <section aria-labelledby="providers" className="flex flex-col gap-3">
        <h2 id="providers" className="text-section font-bold text-text">Payment providers</h2>
        <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
          {PROVIDERS.map((p) => (
            <li key={p.id} className="flex flex-col gap-3 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-body font-bold text-text">{p.label}</span>
                  <span className="block text-helper text-text-faint">{p.sub}</span>
                </span>
                {connected[p.id] ? (
                  <Badge tone="ok">Connected</Badge>
                ) : adding === p.id ? null : (
                  <Button type="button" size="sm" variant="secondary" onClick={() => setAdding(p.id)} className="w-auto shrink-0">
                    {stale[p.id] ? "Reconnect" : "Connect"}
                  </Button>
                )}
              </div>
              {adding === p.id ? (
                <AddProvider
                  provider={p.id}
                  last4={last4}
                  bankCode={profile.bankCode}
                  bankName={profile.bankName}
                  onCancel={() => setAdding(null)}
                  onDone={() => {
                    setAdding(null);
                    onChange(`${p.label} is connected too.`);
                  }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {history.length ? (
        <section aria-labelledby="bank-history" className="flex flex-col gap-3">
          <h2 id="bank-history" className="text-section font-bold text-text">Bank changes</h2>
          <ol className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
            {history.map((h) => (
              <li key={h.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block break-words text-label font-bold text-text">
                    {h.current.bankName ?? h.current.bankCode ?? "Settlement bank"}
                    {h.current.accountNumber ? ` · ${h.current.accountNumber}` : ""}
                  </span>
                  <span className="block text-helper text-text-faint">
                    {h.reason === "INITIAL_SETUP"
                      ? "First connected"
                      : h.previous?.bankName
                        ? `Was ${h.previous.bankName}${h.previous.accountNumber ? ` · ${h.previous.accountNumber}` : ""}`
                        : "Changed"}
                  </span>
                </span>
                <span className="shrink-0 text-helper text-text-dim">{formatDate(h.changedAt)}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

/**
 * The second provider, on the bank already on file. `/auth/me` masks the
 * account number, and the enable DTOs need all ten digits — Paystack
 * re-verifies the body it is sent; Monnify reuses the verified bank — so
 * the host confirms the number, checked against the last four. That sends
 * the right value to both, and never invites a different account here
 * (changing bank is its own, confirmed, flow).
 */
function AddProvider({
  provider,
  last4,
  bankCode,
  bankName,
  onCancel,
  onDone,
}: {
  provider: PayoutProvider;
  last4: string;
  bankCode: string | null;
  bankName: string | null;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [account, setAccount] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problem =
    account.length !== ACCOUNT_LENGTH
      ? `Enter all ${ACCOUNT_LENGTH} digits`
      : last4 && !account.endsWith(last4)
        ? `That isn't the account ending ${last4}`
        : undefined;

  async function connect() {
    setTouched(true);
    if (problem || !bankCode) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/organizer/providers/${provider === "MONNIFY" ? "monnify" : "paystack"}/enable`, {
        method: "POST",
        auth: true,
        body: { bankCode, accountNumber: account },
        timeout: 60_000,
      });
      onDone();
    } catch (err) {
      setError(friendly(err));
      setBusy(false);
    }
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void connect();
      }}
    >
      <p className="text-label text-text-dim">
        {LABEL[provider]} pays the same account
        {bankName ? ` at ${bankName}` : ""}
        {last4 ? ` ending ${last4}` : ""}. Confirm its number to connect.
      </p>
      <TextField
        label="Account number"
        icon={<LockIcon />}
        inputMode="numeric"
        autoComplete="off"
        placeholder={last4 ? `······${last4}` : "10 digits"}
        value={account}
        onChange={(e) => setAccount(e.target.value.replace(/\D/g, "").slice(0, ACCOUNT_LENGTH))}
        error={touched ? problem : undefined}
        maxLength={ACCOUNT_LENGTH}
        disabled={busy}
      />
      <ErrorNote>{error}</ErrorNote>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" size="sm" disabled={busy} className="w-full sm:w-auto">
          {busy ? <Spinner /> : null}
          {busy ? "Connecting…" : `Connect ${LABEL[provider]}`}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onCancel} className="w-full sm:w-auto">
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ChangeBank({
  banks,
  onCancel,
  onDone,
}: {
  banks: ApiBank[];
  onCancel: () => void;
  onDone: (res: ApiBankUpdateResult) => void;
}) {
  const [bank, setBank] = useState<ApiBank | null>(null);
  const [account, setAccount] = useState("");
  const [touched, setTouched] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problems = {
    bank: bank ? undefined : "Pick your bank from the list",
    account: account.length === ACCOUNT_LENGTH ? undefined : `Enter all ${ACCOUNT_LENGTH} digits`,
  };

  async function save() {
    if (!bank) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<ApiBankUpdateResult>("/organizer/bank-details", {
        method: "PUT",
        auth: true,
        body: { bankCode: bank.code, accountNumber: account },
        timeout: 60_000,
      });
      setConfirming(false);
      onDone(res);
    } catch (err) {
      setError(friendly(err));
      setBusy(false);
    }
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4 border-t border-border pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (problems.bank || problems.account) return;
        setError(null);
        setConfirming(true);
      }}
    >
      <BankFields
        banks={banks}
        bank={bank}
        onBank={setBank}
        account={account}
        onAccount={setAccount}
        disabled={busy}
        errors={touched ? problems : {}}
      />
      {!confirming ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" size="sm" disabled={busy} className="w-full sm:w-auto">
          Continue
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onCancel} className="w-full sm:w-auto">
          Cancel
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        title="Change where you're paid?"
        confirmLabel="Change bank"
        busy={busy}
        error={error}
        onConfirm={() => void save()}
        onCancel={() => {
          setConfirming(false);
          setError(null);
        }}
      >
        Card and transfer sales will settle to the {bank?.name ?? "new"} account
        ending {account.slice(-4)} from now on. We check the account name with
        the bank first. You can&apos;t change it while a payout is processing.
      </ConfirmDialog>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Bank + account number, with a searchable picker
// ---------------------------------------------------------------------------

function BankFields({
  banks,
  bank,
  onBank,
  account,
  onAccount,
  disabled,
  errors,
}: {
  banks: ApiBank[];
  bank: ApiBank | null;
  onBank: (b: ApiBank) => void;
  account: string;
  onAccount: (v: string) => void;
  disabled: boolean;
  errors: { bank?: string; account?: string };
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? banks.filter((b) => b.name.toLowerCase().includes(q)) : banks;
  }, [banks, query]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span id="bank-label" className="text-label text-text-dim">Bank</span>
        <button
          type="button"
          aria-labelledby="bank-label"
          aria-describedby={errors.bank ? "bank-error" : undefined}
          aria-haspopup="dialog"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className={cx(
            "flex h-14 items-center justify-between gap-3 rounded-control border bg-surface px-4 text-left text-body transition-colors disabled:opacity-60",
            errors.bank ? "border-danger" : "border-border hover:border-border-strong",
          )}
        >
          <span className={cx("min-w-0 truncate", bank ? "text-text" : "text-text-faint")}>
            {bank ? bank.name : "Choose your bank"}
          </span>
          <ChevronRightIcon className="shrink-0 text-text-faint" />
        </button>
        {errors.bank ? <span id="bank-error" role="alert" className="text-helper text-danger">{errors.bank}</span> : null}
      </div>

      <div className="flex flex-col gap-2">
        <TextField
          label="Account number"
          icon={<LockIcon />}
          inputMode="numeric"
          autoComplete="off"
          placeholder="10-digit NUBAN"
          value={account}
          onChange={(e) => onAccount(e.target.value.replace(/\D/g, "").slice(0, ACCOUNT_LENGTH))}
          error={errors.account}
          maxLength={ACCOUNT_LENGTH}
          disabled={disabled}
        />
        <p className="text-helper text-text-faint">
          We confirm the account name with your bank — no need to type it.
        </p>
      </div>

      <Sheet
        open={open}
        title="Choose your bank"
        onClose={() => {
          setOpen(false);
          setQuery("");
        }}
      >
        <div className="flex flex-col gap-3">
          <label className="flex h-12 items-center gap-3 rounded-control border border-border bg-bg px-4 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
            <SearchIcon className="shrink-0 text-text-faint" />
            <span className="sr-only">Search banks</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search banks"
              autoComplete="off"
              className="h-full min-w-0 flex-1 bg-transparent text-body text-text placeholder:text-text-faint focus-visible:outline-none"
            />
          </label>
          <ul className="flex flex-col">
            {filtered.map((b) => (
              <li key={b.code}>
                <button
                  type="button"
                  onClick={() => {
                    onBank(b);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex min-h-12 w-full items-center justify-between gap-3 border-b border-border py-3 text-left text-body text-text hover:text-accent"
                >
                  <span className="min-w-0">{b.name}</span>
                  {bank?.code === b.code ? <CheckIcon className="shrink-0 text-accent" /> : null}
                </button>
              </li>
            ))}
          </ul>
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-label text-text-dim">
              No banks match &ldquo;{query}&rdquo;.
            </p>
          ) : null}
        </div>
      </Sheet>
    </div>
  );
}
