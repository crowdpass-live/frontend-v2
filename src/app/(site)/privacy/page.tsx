import type { Metadata } from "next";
import Link from "next/link";
import { BUSINESS } from "@/lib/business";
import {
  LegalPage,
  LegalSection,
  LegalText,
  LegalList,
} from "@/components/Legal";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "What personal data CrowdPass collects when you buy a ticket, why, who it is shared with, and your rights under the Nigeria Data Protection Act.",
};

/**
 * Describes the data this site actually handles: three fields at checkout,
 * no cookies, no third-party analytics, one `localStorage` key holding the
 * reference of a purchase in flight. Written against the code rather than
 * from a template, because the claims here are the ones a regulator or a
 * processor will check.
 *
 * Not legal advice, and not reviewed by a lawyer. Treat it as a first draft.
 */
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="1 September 2026">
      <LegalText>
        This policy explains what {BUSINESS.legalName} — the business trading
        as {BUSINESS.name} — does with personal data when you use
        crowdpazz.com. We are the data controller for that data, and we handle
        it under the Nigeria Data Protection Act 2023.
      </LegalText>

      <LegalSection heading="1. What we collect">
        <LegalList
          items={[
            "What you type at checkout: the name that goes on the ticket, your email address, and your phone number if you choose to give one.",
            "Your order: the event, the tier, the quantity, the amount, the payment method and the status of the transaction.",
            "Your ticket: its reference, its QR code, and — if you are scanned in — the time you were checked in.",
            "Technical data our servers log in the ordinary course, such as IP address, browser and the pages requested, used to keep the service up and to investigate abuse.",
          ]}
        />
        <LegalText>
          We do not collect card numbers, bank credentials or crypto private
          keys. Card and transfer details are entered on the payment
          provider&apos;s own page and never reach us.
        </LegalText>
      </LegalSection>

      <LegalSection heading="2. Why we use it, and on what basis">
        <LegalList
          items={[
            "To perform our contract with you — issuing your ticket, delivering it to your email, letting you look it up later, and admitting you at the door.",
            "To handle payments, verify them and process refunds, which is both contractual and a legal obligation on us and our processors.",
            "Our legitimate interests: keeping the platform secure, preventing fraud and duplicate tickets, and fixing faults.",
            "Legal obligations: financial records we are required to keep, and requests we are legally required to answer.",
          ]}
        />
        <LegalText>
          We do not sell your data, and we do not send marketing email unless
          you ask us to.
        </LegalText>
      </LegalSection>

      <LegalSection heading="3. Who we share it with">
        <LegalList
          items={[
            "The organizer of the event you bought a ticket to — they receive the attendee details they need to run the door and their own guest list.",
            "Our payment processors, who handle the transaction and its verification.",
            "The infrastructure providers who host the site, the database and the email that delivers your ticket.",
            "Anyone we are legally required to disclose to, such as a court order or a regulator.",
          ]}
        />
      </LegalSection>

      <LegalSection heading="4. Blockchain records">
        <LegalText>
          Tickets are issued as tokens on a public blockchain. Data written to a
          public chain is visible to anyone and is permanent — it cannot be
          altered or erased on request, by us or by anyone else. This is a
          limit on the erasure right below that we cannot engineer around, so
          it is worth knowing before you buy.
        </LegalText>
      </LegalSection>

      <LegalSection heading="5. Cookies and analytics">
        <LegalText>
          The buyer-facing site sets no advertising cookies and runs no
          third-party analytics or tracking scripts. Your browser does keep one
          thing locally: the reference of a purchase you have started, so we can
          take you back to it if you return before it settles. It stays on your
          device and is never sent anywhere.
        </LegalText>
      </LegalSection>

      <LegalSection heading="6. How long we keep it">
        <LegalText>
          Order and ticket records are kept while the event is live and
          afterwards for as long as we need them for financial records,
          dispute resolution and our legal obligations. Technical logs are kept
          for a short period. Records on a public blockchain remain there
          permanently, as described above.
        </LegalText>
      </LegalSection>

      <LegalSection heading="7. Your rights">
        <LegalText>
          Under the Nigeria Data Protection Act 2023 you may ask us for a copy
          of the personal data we hold about you, ask us to correct it, ask us
          to delete it, object to or restrict how we use it, ask for it in a
          portable form, and withdraw any consent you gave. Email{" "}
          <a
            href={`mailto:${BUSINESS.email}`}
            className="text-accent hover:underline"
          >
            {BUSINESS.email}
          </a>{" "}
          and we will respond within the timeframe the Act requires. If you
          think we have handled your data badly, you can complain to the
          Nigeria Data Protection Commission.
        </LegalText>
      </LegalSection>

      <LegalSection heading="8. Security">
        <LegalText>
          Data is transmitted over encrypted connections, payment details are
          handled entirely by licensed processors, and access to attendee data
          is restricted to the accounts that need it. No system is perfectly
          secure, but if a breach affects your data we will notify you and the
          Commission as the Act requires.
        </LegalText>
      </LegalSection>

      <LegalSection heading="9. Children">
        <LegalText>
          CrowdPass is not intended for children under 18. Where an event admits
          under-18s, the ticket should be bought by a parent or guardian.
        </LegalText>
      </LegalSection>

      <LegalSection heading="10. Contact">
        <LegalText>
          {BUSINESS.legalName} — {BUSINESS.address.oneLine}. Email{" "}
          <a
            href={`mailto:${BUSINESS.email}`}
            className="text-accent hover:underline"
          >
            {BUSINESS.email}
          </a>{" "}
          or call{" "}
          <a
            href={`tel:${BUSINESS.phone.href}`}
            className="text-accent hover:underline"
          >
            {BUSINESS.phone.display}
          </a>
          . Our{" "}
          <Link href="/terms" className="text-accent hover:underline">
            terms of service
          </Link>{" "}
          cover the rest of the relationship.
        </LegalText>
      </LegalSection>
    </LegalPage>
  );
}
