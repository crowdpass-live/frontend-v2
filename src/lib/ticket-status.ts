import type { TicketStatus } from "@/types/api";

/**
 * How a ticket's status reads to its holder — one table for the ticket page
 * and the My tickets list (#25), so the two can never disagree.
 *
 * Tones map onto `Badge`'s tinted fills; status pills are never solid.
 */
export const TICKET_STATUS: Record<
  TicketStatus,
  { label: string; tone: "ok" | "warn" | "info" | "danger" | "neutral"; note: string }
> = {
  CONFIRMED: {
    label: "Valid",
    tone: "ok",
    // Only used by the ticket page's non-CONFIRMED branch; TicketCredential
    // owns the confirmed case, including the wait before the QR is minted.
    note: "Show this at the door.",
  },
  PENDING: {
    // Not "Pending payment": a paid ticket stays PENDING until its mint lands,
    // so most buyers see this badge after their payment has already cleared.
    // PendingTicket owns the body copy for this case.
    label: "Processing",
    tone: "warn",
    note: "This ticket is still being issued.",
  },
  USED: {
    label: "Checked in",
    tone: "info",
    note: "This ticket has already been scanned at the door.",
  },
  CANCELLED: {
    label: "Cancelled",
    tone: "danger",
    note: "This ticket was cancelled and cannot be used for entry.",
  },
  REFUNDED: {
    label: "Refunded",
    tone: "danger",
    note: "This ticket was refunded and cannot be used for entry.",
  },
};
