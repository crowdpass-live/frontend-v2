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
  type ExpenseList,
  type ExpenseRow,
} from "@/lib/expenses";
import { count, ngn, ngnCompact, NO_VALUE } from "@/lib/metric-format";
import { Panel, StatTile } from "@/components/StatTile";
import { TextField } from "@/components/TextField";
import { Select } from "@/components/Select";
import { BrandSpinner } from "@/components/BrandSpinner";
import { ExternalLinkIcon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";
import { Button, Card, Container, ErrorNote, Spinner } from "@/components/ui";

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
    // "₦25,000" and "25 000" are how people type money; the sheet wants 25000.
    .transform((v) => Number(v.replace(/[₦,\s]/g, "")))
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
  return (
    <Container size="page" className="flex flex-col gap-8 pt-8">
      <header>
        <h1 className="text-title font-bold text-text">Expenses</h1>
        <p className="mt-1 text-helper text-text-faint">
          Every entry goes straight into the finance sheet. The totals come from the sheet&apos;s own
          formula.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:max-w-2xl">
        <StatTile
          label="Total spent"
          value={ngnCompact(data.total)}
          title={ngn(data.total)}
          hint={data.total === null ? "No running total in the sheet yet" : "Running total, column H"}
          tone="accent"
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
    </Container>
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
        <p className="text-label font-bold tabular-nums text-text">{ngn(entry.amount)}</p>
        <p className="text-helper tabular-nums text-text-faint" title="Running total after this entry">
          {entry.runningTotal === null ? NO_VALUE : ngn(entry.runningTotal)}
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
          label="Amount (₦)"
          inputMode="decimal"
          placeholder="25,000"
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
