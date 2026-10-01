"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api";
import { normalizePhone } from "@/lib/format";
import { isProvisionalName } from "@/lib/names";
import { TextField } from "@/components/TextField";
import { LockIcon, MailIcon, PersonIcon, PhoneIcon } from "@/components/icons";
import { Button, Spinner } from "@/components/ui";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_MIN = 2;

/**
 * Edit profile (#27). Ports `EditProfileScreen.js`; `PATCH /auth/me`.
 *
 * The backend's rules, shown rather than discovered by a failed save:
 * - **The name is editable until identity verification succeeds**, then it
 *   is locked — it was matched against the ID. Until then, this is where an
 *   email signup replaces its placeholder name, and the page says why it
 *   matters: verification compares THIS name with the NIN/BVN.
 * - **Email and phone are add-only.** An account without one can add it; an
 *   existing one cannot be changed here (swapping either is how accounts
 *   get taken over, so it goes through support).
 *
 * Sends only fields that changed — `forbidNonWhitelisted` rejects strays,
 * and re-sending a locked value is pointless.
 */
export function ProfileForm({
  user,
}: {
  user: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    kycVerified: boolean;
  };
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const nameLocked = user.kycVerified;
  const placeholder = !nameLocked && isProvisionalName(user);
  const phoneNormalized = phone.trim() ? normalizePhone(phone) : null;

  const problems = {
    firstName: !nameLocked && firstName.trim().length < NAME_MIN ? "At least 2 letters" : undefined,
    lastName: !nameLocked && lastName.trim().length < NAME_MIN ? "At least 2 letters" : undefined,
    email: !user.email && email.trim() && !EMAIL.test(email.trim()) ? "Enter a valid email address" : undefined,
    phone: !user.phone && phone.trim() && !phoneNormalized ? "Enter a Nigerian number, e.g. 08012345678" : undefined,
  };

  const changes: Record<string, string> = {};
  if (!nameLocked && firstName.trim() !== user.firstName) changes.firstName = firstName.trim();
  if (!nameLocked && lastName.trim() !== user.lastName) changes.lastName = lastName.trim();
  if (!user.email && email.trim()) changes.email = email.trim().toLowerCase();
  if (!user.phone && phoneNormalized) changes.phone = phoneNormalized;
  const dirty = Object.keys(changes).length > 0;

  async function save() {
    setTouched(true);
    setSaved(null);
    if (Object.values(problems).some(Boolean) || !dirty) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/auth/me", { method: "PATCH", auth: true, body: changes });
      setSaved("Saved.");
      setEmail("");
      setPhone("");
      // The header, account menu and this page all read /auth/me.
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const show = (k: keyof typeof problems) => (touched ? problems[k] : undefined);

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {placeholder ? (
        <p className="rounded-control border border-warn/40 bg-warn/10 px-4 py-3 text-label text-warn">
          We filled in a name from your email. Change it to your name exactly as
          it appears on your NIN or BVN — if you host events, identity
          verification checks it, and a mismatch uses up one of your limited
          attempts.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
        <TextField
          label="First name"
          icon={nameLocked ? <LockIcon /> : <PersonIcon />}
          autoComplete="given-name"
          autoCapitalize="words"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          readOnly={nameLocked}
          error={show("firstName")}
          maxLength={100}
        />
        <TextField
          label="Last name"
          icon={nameLocked ? <LockIcon /> : undefined}
          autoComplete="family-name"
          autoCapitalize="words"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          readOnly={nameLocked}
          error={show("lastName")}
          maxLength={100}
        />
      </div>
      <p className="-mt-2 text-helper text-text-faint">
        {nameLocked
          ? "Locked — it was verified against your ID. Contact support to change it."
          : "As it appears on your NIN or BVN."}
      </p>

      {user.email ? (
        <TextField label="Email" icon={<LockIcon />} value={user.email} readOnly />
      ) : (
        <TextField
          label="Email"
          icon={<MailIcon />}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Add an email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={show("email")}
        />
      )}
      {user.phone ? (
        <TextField label="Phone" icon={<LockIcon />} value={user.phone} readOnly />
      ) : (
        <TextField
          label="Phone"
          icon={<PhoneIcon />}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="Add a phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={show("phone")}
        />
      )}
      {user.email || user.phone ? (
        <p className="-mt-2 text-helper text-text-faint">
          An email or phone number already on your account can&apos;t be changed
          here — that protects it from being taken over. Contact support to change one.
        </p>
      ) : null}

      {error ? <p role="alert" className="text-label text-danger">{error}</p> : null}
      {saved ? <p role="status" className="text-label text-ok">{saved}</p> : null}

      <Button type="submit" disabled={busy || !dirty} className="w-full sm:w-fit">
        {busy ? <Spinner /> : null}
        Save changes
      </Button>
    </form>
  );
}
