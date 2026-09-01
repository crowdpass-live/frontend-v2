/**
 * The operating business behind CrowdPass.
 *
 * These are compliance details, not decoration: a Nigerian payment processor
 * (Paystack, Flutterwave) checks that a live site publishes a reachable
 * support email, a phone number and a physical address before it will keep a
 * merchant account open, and a buyer disputing a charge has to be able to
 * find them without asking.
 *
 * One module so the footer, any future contact page and structured data can
 * never drift apart — a support address that is right in one place and stale
 * in another is worse than one that is only in one place.
 */
export const BUSINESS = {
  /** The brand, as it appears in product copy. */
  name: "CrowdPass",
  /**
   * The registered entity that actually contracts with buyers and holds the
   * merchant account. The policies name this one — "CrowdPass" is what the
   * product is called, not who you are agreeing with.
   */
  legalName: "CrowdPass Event Ventures",
  email: "support@crowdpazz.com",
  phone: {
    /** Spaced for reading. */
    display: "+234 907 939 0551",
    /** `tel:` wants E.164 — no spaces, no punctuation. */
    href: "+2349079390551",
  },
  /**
   * Written out in title case rather than the all-caps of the registration
   * document: the requirement is that the address is legible and complete,
   * and a line of shouting capitals in 12px is neither.
   */
  address: {
    lines: [
      "No. 12, Ibrahim Yerima Street",
      "Ungwan Pama, Sabo Tasha",
      "Kaduna, Kaduna State",
      "Nigeria",
    ],
    /** Single-line form, for `title` attributes and structured data. */
    get oneLine() {
      return this.lines.join(", ");
    },
  },
} as const;
