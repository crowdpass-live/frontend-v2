import type { Metadata } from "next";
import Link from "next/link";
import { BUSINESS } from "@/lib/business";
import { Card, Container } from "@/components/ui";
import { MailIcon, PhoneIcon, PinIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Contact us",
  description:
    "Reach CrowdPass support by email or phone, or write to our registered address in Kaduna, Nigeria.",
};

/**
 * A page whose whole job is to be findable.
 *
 * The details are already in the footer of every page, but a payment
 * processor's onboarding review — and a buyer in a hurry — both look for a
 * page at `/contact`, so the same facts get a surface of their own. There is
 * deliberately no contact *form*: a form needs an endpoint, and a form that
 * silently drops messages is worse than an email address that works.
 */
export default function ContactPage() {
  return (
    <main className="flex flex-1 flex-col pb-20">
      <Container className="flex flex-col gap-8 pt-10 lg:pt-16">
        <header className="flex flex-col gap-3">
          <h1 className="text-display font-bold tracking-tight text-text text-balance">
            Contact us
          </h1>
          <p className="text-body text-text-dim text-balance">
            Something wrong with a ticket, a payment or an event you&apos;re
            hosting? Reach a person here. Email is the fastest route — include
            your ticket reference if you have one.
          </p>
        </header>

        <div className="flex flex-col gap-3">
          <ContactRow
            icon={<MailIcon />}
            label="Email"
            value={BUSINESS.email}
            href={`mailto:${BUSINESS.email}`}
          />
          <ContactRow
            icon={<PhoneIcon />}
            label="Phone"
            value={BUSINESS.phone.display}
            href={`tel:${BUSINESS.phone.href}`}
          />
          <ContactRow icon={<PinIcon />} label="Address">
            <address className="flex flex-col not-italic">
              {/* Registered name above the address — together they are what a
               * compliance review and a courier both need. */}
              <span>{BUSINESS.legalName}</span>
              {BUSINESS.address.lines.map((line) => (
                <span key={line} className="text-text-dim">
                  {line}
                </span>
              ))}
            </address>
          </ContactRow>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-section font-bold text-text">
            What we can help with
          </h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-body text-text-dim marker:text-text-faint">
            <li>A ticket that never arrived, or a payment you can&apos;t see.</li>
            <li>
              A refund request — refunds follow the organizer&apos;s policy for
              that event, shown on the event page before you pay.
            </li>
            <li>Trouble at the door with a ticket that won&apos;t scan.</li>
            <li>Listing your own event on CrowdPass.</li>
            <li>
              A data request under the Nigeria Data Protection Act — see our{" "}
              <Link href="/privacy" className="text-accent hover:underline">
                privacy policy
              </Link>
              .
            </li>
          </ul>
        </section>
      </Container>
    </main>
  );
}

/**
 * One detail per row. The whole row is the link where there is one, so it is
 * a comfortable tap target on a phone rather than a 12px run of text.
 */
function ContactRow({
  icon,
  label,
  value,
  href,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  href?: string;
  children?: React.ReactNode;
}) {
  // Divs rather than spans: the address row nests an `<address>`, which is
  // flow content and invalid inside phrasing content.
  const body = (
    <>
      <span className="mt-0.5 text-accent">{icon}</span>
      <div className="flex flex-col gap-1">
        <span className="text-helper text-text-faint">{label}</span>
        <div className="text-body text-text">{value ?? children}</div>
      </div>
    </>
  );

  const className = "flex items-start gap-4 p-5";

  if (!href) return <Card className={className}>{body}</Card>;

  return (
    <Card className="transition-colors hover:bg-surface-strong">
      <a href={href} className={className}>
        {body}
      </a>
    </Card>
  );
}
