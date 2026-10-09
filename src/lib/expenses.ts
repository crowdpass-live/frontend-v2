import { z } from "zod";
import { ApiError } from "./api";

/**
 * The admin expenses tracker. The rows live in a Google Sheet, not the
 * backend: an Apps Script web app (`scripts/apps-script/expenses.gs`) appends
 * each entry and the sheet's own formula keeps the running total, so finance
 * can keep working in the sheet they already have.
 *
 * The browser never talks to the script. `/api/admin/expenses` checks the
 * session is an ADMIN and forwards with a shared secret — the script's URL
 * is public by necessity ("Anyone" access), so the secret is the only thing
 * standing between it and a stranger with the link.
 *
 * Sheet columns, A–H:
 *   Date | Description | Category | Amount (₦) | Paid by | Method | Receipt link | Running total
 */

/** Must match the sheet's dropdowns, if it has any. */
export const EXPENSE_CATEGORIES = [
  "Operations",
  "Marketing",
  "Salaries",
  "Software & tools",
  "Transport",
  "Events",
  "Legal & compliance",
  "Bank charges",
  "Other",
] as const;

export const EXPENSE_METHODS = ["Bank transfer", "Card", "Cash", "Other"] as const;

/** Exactly what the route forwards to the script. Shared by both ends. */
export const expenseInput = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Pick a valid date"),
  description: z
    .string()
    .trim()
    .min(2, "Say what the money was for")
    .max(200, "Keep it under 200 characters"),
  category: z.enum(EXPENSE_CATEGORIES, { message: "Pick a category" }),
  amount: z
    .number({ message: "Enter an amount" })
    .positive("The amount must be more than zero")
    .max(1_000_000_000, "That amount is too large")
    // Kobo at most: anything finer is a typo, and the sheet would hide it.
    .refine((v) => Math.round(v * 100) === v * 100, "Use at most two decimal places"),
  paidBy: z
    .string()
    .trim()
    .min(2, "Who paid?")
    .max(80, "Keep it under 80 characters"),
  method: z.enum(EXPENSE_METHODS, { message: "Pick a payment method" }),
  receipt: z
    .url({ protocol: /^https?$/, message: "Paste a full link, starting with https://" })
    .max(500, "That link is too long")
    .optional(),
});

export type ExpenseInput = z.infer<typeof expenseInput>;

export interface ExpenseRow {
  /** The sheet row number — stable, so it doubles as the list key. */
  row: number;
  date: string;
  description: string;
  category: string;
  amount: number;
  paidBy: string;
  method: string;
  receipt: string | null;
  /** Column H, from the sheet's formula. Null if the cell is empty. */
  runningTotal: number | null;
}

export interface ExpenseList {
  /** Newest first, at most the last 50. */
  rows: ExpenseRow[];
  /** Every entry in the sheet, not just the rows returned. */
  count: number;
  /** The last row's running total — the sheet's figure, not ours. */
  total: number | null;
}

export interface ExpenseAdded {
  row: ExpenseRow;
  total: number | null;
}

async function call<T>(init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch("/api/admin/expenses", { cache: "no-store", ...init });
  } catch {
    throw new ApiError(0, "Couldn't reach CrowdPass. Check your connection and try again.");
  }
  const body = (await res.json().catch(() => null)) as (T & { message?: string }) | null;
  if (!res.ok || !body) {
    // An ApiError, so the query client's retry policy applies: a 4xx shows
    // at once rather than after two retries.
    throw new ApiError(
      res.status,
      body?.message ?? "The expenses sheet didn't answer. Please try again.",
      body,
    );
  }
  return body;
}

export function fetchExpenses() {
  return call<ExpenseList>();
}

export function addExpense(input: ExpenseInput) {
  return call<ExpenseAdded>({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
