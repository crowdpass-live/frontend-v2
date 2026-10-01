/**
 * The placeholder name an email signup gets, until the person edits it.
 * Ported from `v2-mobile/src/screens/SignupScreen.js` so both clients make
 * the same one: `ada.obi@x.com` → Ada Obi, `kemi@x.com` → Kemi User.
 *
 * Signup asks for an email and a password only, but `RegisterDto` requires
 * both names — so this fills them, and the account page asks for the real
 * one. It matters: identity verification (KYC) matches the PROFILE name
 * against the NIN/BVN, and a placeholder burns a limited daily attempt.
 */
export function provisionalName(email: string): { firstName: string; lastName: string } {
  const local = email.split("@")[0] || "there";
  const parts = local.split(/[._-]+/).filter(Boolean);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  return { firstName: cap(parts[0] || "New"), lastName: cap(parts[1] || "User") };
}

/**
 * Whether a name is still the signup placeholder — i.e. the person has not
 * told us their real one. Used to nudge them before identity verification.
 */
export function isProvisionalName(user: { email: string; firstName: string; lastName: string }): boolean {
  if (!user.email) return false;
  const p = provisionalName(user.email);
  return user.firstName === p.firstName && user.lastName === p.lastName;
}
