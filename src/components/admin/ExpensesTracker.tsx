"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_METHODS,
  addExpense,
  expenseInput,
  fetchExpenses,
  type CategorySummary,
  type ExpenseList,
  type ExpenseRow,
  type ExpenseSummary,
} from "@/lib/expenses";
import { count, percent, usd, usdCompact, NO_VALUE } from "@/lib/metric-format";
import { Panel, StatTile } from "@/components/StatTile";
import { TextField } from "@/components/TextField";
import { Select } from "@/components/Select";
import { BrandSpinner } from "@/components/BrandSpinner";
import { ExternalLinkIcon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";
import { Button, Card, Container, ErrorNote, Spinner, cx } from "@/components/ui";

const QUERY_KEY = ["admin", "expenses"] as const;

/**
 * The form's strings, checked and converted into exactly `expenseInput` —
 * the same schema the route enforces, so the two can't drift.
 */
const formSchema = expenseInput.extend({
  amount: z
    .string()
    .trim()
    .min(1, "Enter an amount")
    // "$2,500" and "2 500" are how people type money; the sheet wants 2500.
    .transform((v) => Number(v.replace(/[$,\s]/g, "")))
    .pipe(expenseInput.shape.amount),
  receipt: z
    .string()
    .trim()
    .transform((v) => v || undefined)
    .pipe(expenseInput.shape.receipt),
});

type FormIn = z.input<typeof formSchema>;
type FormOut = z.output<typeof formSchema>;

/** Today in Lagos, as the date input wants it. Same on server and client. */
function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}

/** `2026-10` → `Oct 2026`. */
function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function day(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function ExpensesTracker() {
  const list = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchExpenses,
    // 503 here means the sheet isn't configured, which no retry will fix.
    retry: (failures, err) =>
      !(err instanceof ApiError && (!err.isRetryable || err.status === 503)) && failures < 2,
  });
  const notConnected = list.error instanceof ApiError && list.error.status === 503;

  if (list.isPending) {
    return (
      <Container size="page" className="grid place-items-center py-24">
        <BrandSpinner width={92} label="Opening the expenses sheet" />
      </Container>
    );
  }

  if (list.isError) {
    return (
      <Container size="page" className="pt-10">
        <Card className="flex flex-col items-start gap-4 p-6">
          <ErrorNote>{list.error.message}</ErrorNote>
          {notConnected ? (
            <p className="text-label text-text-dim">
              Set <code className="text-text">EXPENSES_SCRIPT_URL</code> and{" "}
              <code className="text-text">EXPENSES_SCRIPT_SECRET</code> on this deployment. Setup steps
              are in <code className="text-text">scripts/apps-script/README.md</code>.
            </p>
          ) : (
            <Button
              type="button"
              variant="secondary"
              className="w-auto min-w-[160px]"
              onClick={() => list.refetch()}
            >
              Try again
            </Button>
          )}
        </Card>
      </Container>
    );
  }

  return <Tracker data={list.data} refreshing={list.isFetching} />;
}

function Tracker({ data, refreshing }: { data: ExpenseList; refreshing: boolean }) {
  const sum = data.summary;
  return (
    <Container size="page" className="flex flex-col gap-8 pt-8">
      <header>
        <h1 className="text-title font-bold text-text">Expenses</h1>
        <p className="mt-1 text-helper text-text-faint">
          Every entry goes straight into the finance sheet, in US dollars. Every figure here is the
          sheet&apos;s own formula.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="This month"
          value={sum ? usdCompact(sum.thisMonth) : NO_VALUE}
          title={sum ? usd(sum.thisMonth) : undefined}
          hint={sum ? changeHint(sum) : "Summary tab unavailable"}
          tone="accent"
        />
        <StatTile
          label="Budget used"
          value={sum?.budget?.used == null ? NO_VALUE : percent(sum.budget.used, 0)}
          hint={budgetHint(sum)}
        />
        <StatTile
          label="Total spent"
          value={usdCompact(data.total ?? sum?.allTime)}
          title={usd(data.total ?? sum?.allTime)}
          hint={data.total === null && !sum ? "No running total in the sheet yet" : "All time"}
        />
        <StatTile
          label="Entries"
          value={count(data.count)}
          hint={data.count > data.rows.length ? `Showing the last ${data.rows.length}` : "In the sheet"}
        />
      </section>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <Panel title="Add an expense">
          <ExpenseForm />
        </Panel>

        <Panel
          title="Recent entries"
          note={refreshing ? "Refreshing from the sheet…" : "Newest first, as they are in the sheet"}
        >
          {data.rows.length === 0 ? (
            <p className="py-2 text-label text-text-faint">
              No expenses yet. The first one you add will show up here.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {data.rows.map((r) => (
                <EntryRow key={r.row} entry={r} />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {sum ? (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <Panel
            title="By category"
            note="This month against its budget. Budgets are typed into the sheet's Summary tab."
          >
            <CategoryList categories={sum.categories} />
          </Panel>
          <Panel title="By month" note="The last 12 months, newest first">
            <MonthBars months={sum.months} />
          </Panel>
        </div>
      ) : (
        <Card className="p-5">
          <p className="text-label text-text-dim">
            The breakdowns come from the sheet&apos;s Summary tab, which couldn&apos;t be read. Check
            the tab exists, or delete it and reload this page to have it rebuilt.
          </p>
        </Card>
      )}
    </Container>
  );
}

function changeHint(sum: ExpenseSummary): string {
  if (sum.lastMonth === 0) return "Nothing spent last month";
  if (sum.changePct === null || sum.change === null) return `Last month ${usd(sum.lastMonth)}`;
  if (sum.change === 0) return `Same as last month`;
  return `${sum.change > 0 ? "Up" : "Down"} ${percent(Math.abs(sum.changePct), 0)} on last month (${usdCompact(sum.lastMonth)})`;
}

function budgetHint(sum: ExpenseSummary | null): string {
  const b = sum?.budget;
  if (!sum || !b) return "Summary tab unavailable";
  if (b.total === null || b.remaining === null) return "No budgets set in the Summary tab";
  return b.remaining < 0
    ? `Over by ${usdCompact(-b.remaining)} this month`
    : `${usdCompact(b.remaining)} left of ${usdCompact(b.total)}`;
}

/**
 * Spend against budget, per category. The bar is the budget, so its fill is
 * "% used"; a category with no budget gets no bar rather than one on some
 * other scale. Over budget is said in words as well as in red.
 */
function CategoryList({ categories }: { categories: CategorySummary[] }) {
  const shown = categories.filter((c) => c.budget !== null || c.spentAllTime > 0);
  if (shown.length === 0) {
    return (
      <p className="py-2 text-label text-text-faint">
        Nothing spent yet, and no budgets set.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-4">
      {shown.map((c) => {
        const over = c.remaining !== null && c.remaining < 0;
        return (
          <li key={c.name} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-4">
              <span className="min-w-0 truncate text-label text-text">{c.name}</span>
              <span className="shrink-0 text-label tabular-nums text-text">
                <span className="font-bold">{usd(c.spentThisMonth)}</span>
                {c.budget !== null ? (
                  <span className="text-text-faint"> / {usd(c.budget)}</span>
                ) : null}
              </span>
            </div>
            {c.budget !== null && c.budget > 0 ? (
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-surface-strong"
                role="img"
                aria-label={`${percent(c.used, 0)} of the ${c.name} budget used`}
                title={`${percent(c.used, 0)} used`}
              >
                <div
                  className={cx("h-full rounded-full", over ? "bg-danger" : "bg-accent")}
                  style={{ width: `${Math.min(100, Math.max(c.spentThisMonth > 0 ? 2 : 0, (c.used ?? 0) * 100))}%` }}
                />
              </div>
            ) : null}
            <span className={cx("text-helper", over ? "text-danger" : "text-text-faint")}>
              {c.budget === null
                ? "No budget"
                : over
                  ? `Over budget by ${usd(-(c.remaining ?? 0))}`
                  : `${usd(c.remaining)} left · ${percent(c.used, 0)} used`}
              {" · "}
              <span className="text-text-faint">All time {usd(c.spentAllTime)}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** One measure over time, one colour, values written out — a bar list. */
function MonthBars({ months }: { months: ExpenseSummary["months"] }) {
  const max = Math.max(...months.map((m) => m.spent), 0);
  if (max === 0) {
    return <p className="py-2 text-label text-text-faint">Nothing spent in the last 12 months.</p>;
  }
  return (
    <ul className="flex flex-col gap-2.5">
      {months.map((m) => (
        <li
          key={m.month}
          className="grid grid-cols-[4.5rem_minmax(0,1fr)_5.75rem] items-center gap-3"
          title={`${monthLabel(m.month)}: ${usd(m.spent)}`}
        >
          <span className="text-helper text-text-dim">{monthLabel(m.month)}</span>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-strong">
            {m.spent > 0 ? (
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.max(2, (m.spent / max) * 100)}%` }}
              />
            ) : null}
          </div>
          <span
            className={cx(
              "text-right text-label tabular-nums",
              m.spent > 0 ? "font-bold text-text" : "text-text-faint",
            )}
          >
            {usd(m.spent)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function EntryRow({ entry }: { entry: ExpenseRow }) {
  return (
    <li className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="break-words text-label text-text">{entry.description}</p>
        <p className="mt-0.5 text-helper text-text-faint">
          {day(entry.date)} · {entry.category} · {entry.paidBy} · {entry.method}
        </p>
        {entry.receipt ? (
          <a
            href={entry.receipt}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-helper text-accent hover:text-accent-hi"
          >
            Receipt <ExternalLinkIcon width={14} height={14} />
          </a>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-label font-bold tabular-nums text-text">{usd(entry.amount)}</p>
        <p className="text-helper tabular-nums text-text-faint" title="Running total after this entry">
          {entry.runningTotal === null ? NO_VALUE : usd(entry.runningTotal)}
        </p>
      </div>
    </li>
  );
}

function ExpenseForm() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    defaultValues: {
      date: today(),
      description: "",
      category: "" as FormIn["category"],
      amount: "",
      paidBy: "",
      method: "Bank transfer",
      receipt: "",
    },
  });
  const { errors } = form.formState;

  const save = useMutation({
    mutationFn: addExpense,
    onSuccess: ({ row }) => {
      // Date, payer and method usually repeat across a batch of receipts.
      const { date, paidBy, method } = form.getValues();
      form.reset({ date, paidBy, method, description: "", category: "" as FormIn["category"], amount: "", receipt: "" });
      toast(`Saved to row ${row.row} of the sheet.`, { tone: "ok" });
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    // Never retried: a timeout can still have written the row, and a second
    // try would enter the expense twice.
    onError: (err) => setSubmitError(err.message),
  });

  const onSubmit = form.handleSubmit((values) => {
    setSubmitError(null);
    save.mutate(values);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <TextField
        label="Description"
        placeholder="e.g. Venue deposit, Lagos meetup"
        autoComplete="off"
        error={errors.description?.message}
        {...form.register("description")}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Amount ($)"
          inputMode="decimal"
          placeholder="250.00"
          autoComplete="off"
          error={errors.amount?.message}
          {...form.register("amount")}
        />
        <TextField
          label="Date"
          type="date"
          max={today()}
          error={errors.date?.message}
          {...form.register("date")}
        />
      </div>

      <Select
        label="Category"
        placeholder="Pick a category"
        options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))}
        error={errors.category?.message}
        {...form.register("category")}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Paid by"
          placeholder="Name"
          autoComplete="off"
          error={errors.paidBy?.message}
          {...form.register("paidBy")}
        />
        <Select
          label="Method"
          options={EXPENSE_METHODS.map((m) => ({ value: m, label: m }))}
          error={errors.method?.message}
          {...form.register("method")}
        />
      </div>

      <TextField
        label="Receipt link (optional)"
        type="url"
        inputMode="url"
        placeholder="https://drive.google.com/…"
        autoComplete="off"
        error={errors.receipt?.message}
        {...form.register("receipt")}
      />

      <ErrorNote>{submitError}</ErrorNote>

      <Button type="submit" className="w-full" disabled={save.isPending}>
        {save.isPending ? (
          <>
            <Spinner /> Saving to the sheet…
          </>
        ) : (
          "Add expense"
        )}
      </Button>
    </form>
  );
}
