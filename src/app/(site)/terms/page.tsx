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
  title: "Terms of service",
  description:
    "The terms you agree to when you buy a ticket on CrowdPass or list an event.",
};

/**
 * Written against what the product actually does — guest checkout keyed on an
 * email, per-event refundability set by the organizer, an organizer-side
 * platform fee, tickets minted on a public chain. A policy that describes a
 * different product is worse than none: it is the document someone quotes
 * back at you in a dispute.
 *
 * Not legal advice, and not reviewed by a lawyer. Treat it as a first draft.
 */
export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" updated="1 September 2026">
      <LegalText>
        These terms are an agreement between you and {BUSINESS.legalName},
        the business trading as {BUSINESS.name}, whose contact details are at
        the bottom of this page. They apply whenever you use crowdpazz.com, buy
        a ticket through it, or list an event on it. If you don&apos;t accept
        them, don&apos;t use the service.
      </LegalText>

      <LegalSection heading="1. What CrowdPass is">
        <LegalText>
          CrowdPass is a ticketing platform. Events are created and run by
          independent organizers; we sell and issue the tickets, take payment
          on the organizer&apos;s behalf, and provide the tools to check
          tickets at the door. We are not the organizer or the host of any
          event listed here unless we say so explicitly, and we do not control
          the event, the venue, the line-up, the door policy or whether the
          event happens at all.
        </LegalText>
      </LegalSection>

      <LegalSection heading="2. Buying a ticket">
        <LegalText>
          There is no account to create. You buy as a guest, giving the name
          that should appear on the ticket, an email address and — optionally —
          a phone number. The email address is how we identify your order and
          where the ticket is delivered, so an address with a typo in it means
          a ticket you cannot reach. Check it before you pay.
        </LegalText>
        <LegalList
          items={[
            "A ticket is only valid once payment has settled. Until then it is held as pending, and a pending ticket does not reserve a seat indefinitely.",
            "Tiers may cap how many tickets one buyer can take. Attempts to work around that cap — several orders under different addresses for the same event — may be cancelled.",
            "Availability shown on the site accounts for tickets already sold and for seats held part-way through another buyer's purchase. It can still change between the moment you load a page and the moment you pay.",
          ]}
        />
      </LegalSection>

      <LegalSection heading="3. Prices, fees and payment">
        <LegalText>
          Prices are set by the organizer and shown in full, in the currency on
          the event page, before you pay. You pay the advertised price and
          nothing on top: our platform fee is charged to the organizer and
          deducted when we settle to them, not added to your total.
        </LegalText>
        <LegalText>
          Payments are processed by licensed third-party providers — card, bank
          transfer and USSD through our Nigerian payment processors, and
          supported crypto tokens where an organizer has enabled them. We never
          see or store your card details. Your payment is also subject to the
          provider&apos;s own terms, and a provider may decline or reverse a
          transaction independently of us.
        </LegalText>
      </LegalSection>

      <LegalSection heading="4. Refunds, cancellations and changes">
        <LegalText>
          Refundability is set per event by the organizer and is shown on the
          event page before you pay — a ticket marked non-refundable is
          non-refundable, including if you simply change your mind or cannot
          attend.
        </LegalText>
        <LegalList
          items={[
            "If an event is cancelled by the organizer, you are entitled to a refund of what you paid for the ticket. We will process it to the payment method used, where the provider allows it.",
            "If an event is postponed or materially changed — a different date, city or venue — your ticket normally remains valid for the rescheduled event. Where the organizer offers refunds instead, we will tell you how to claim.",
            <>
              To ask about a refund, email{" "}
              <a
                href={`mailto:${BUSINESS.email}`}
                className="text-accent hover:underline"
              >
                {BUSINESS.email}
              </a>{" "}
              with your ticket reference. Refunds are returned to the original
              payment method and can take several working days to appear.
            </>,
            "A refunded or cancelled ticket stops working at the door immediately.",
          ]}
        />
      </LegalSection>

      <LegalSection heading="5. Using your ticket">
        <LegalText>
          Your ticket carries a QR code that is scanned once, at entry. Treat it
          like cash: anyone holding the code can be admitted with it, and we
          cannot tell a forwarded screenshot from the buyer&apos;s own phone.
          The organizer may also ask for ID matching the name on the ticket,
          and may refuse entry under their own door policy, age restrictions or
          venue rules.
        </LegalText>
        <LegalText>
          Do not copy, sell on, or attempt to duplicate a ticket. Where we find
          a ticket has been resold fraudulently or reproduced, we may void it
          without a refund.
        </LegalText>
      </LegalSection>

      <LegalSection heading="6. Blockchain-issued tickets">
        <LegalText>
          Tickets on CrowdPass are issued as tokens on a public blockchain.
          Anything written to that chain is public and permanent: it cannot be
          edited or deleted afterwards, by us or by you. Public blockchains are
          operated by independent networks, and we are not responsible for
          congestion, downtime or fees on a network we do not control. Nothing
          on this platform is an investment, and a ticket token confers no
          rights beyond entry to the event it was issued for.
        </LegalText>
      </LegalSection>

      <LegalSection heading="7. For organizers">
        <LegalText>
          If you list an event, you confirm you have the right to run it and to
          sell tickets to it, that the details you publish are accurate, and
          that you will honour every valid ticket sold. You are responsible for
          delivering the event, for your own door and refund policies, and for
          any permits, taxes or licences it requires. We settle ticket revenue
          to you net of the platform fee, and may withhold settlement where an
          event is under dispute or where we reasonably suspect fraud.
        </LegalText>
      </LegalSection>

      <LegalSection heading="8. Acceptable use">
        <LegalList
          items={[
            "Don't use CrowdPass for anything unlawful, or to sell tickets to an event you have no right to sell.",
            "Don't scrape, overload, probe or interfere with the service or the systems behind it.",
            "Don't impersonate another person, or pay with a card or account that isn't yours.",
          ]}
        />
        <LegalText>
          We may suspend access, cancel orders or void tickets where these terms
          are broken.
        </LegalText>
      </LegalSection>

      <LegalSection heading="9. Availability and liability">
        <LegalText>
          We work to keep the service running, but we do not promise it will be
          uninterrupted or error-free. To the fullest extent permitted by
          Nigerian law, our total liability to you in connection with a ticket
          is limited to the amount you actually paid for that ticket, and we are
          not liable for the event itself — its cancellation, its quality, or
          anything that happens at the venue. Nothing in these terms limits any
          liability that cannot lawfully be limited.
        </LegalText>
      </LegalSection>

      <LegalSection heading="10. Changes to these terms">
        <LegalText>
          We may update these terms as the service changes. The date at the top
          of this page tells you when it last changed, and the terms that apply
          to a purchase are the ones published when you made it.
        </LegalText>
      </LegalSection>

      <LegalSection heading="11. Governing law">
        <LegalText>
          These terms are governed by the laws of the Federal Republic of
          Nigeria, and disputes are subject to the jurisdiction of the Nigerian
          courts.
        </LegalText>
      </LegalSection>

      <LegalSection heading="12. Contact">
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
          . How we handle your personal data is set out in our{" "}
          <Link href="/privacy" className="text-accent hover:underline">
            privacy policy
          </Link>
          .
        </LegalText>
      </LegalSection>
    </LegalPage>
  );
}
