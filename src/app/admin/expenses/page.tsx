import type { Metadata } from "next";
import { ExpensesTracker } from "@/components/admin/ExpensesTracker";

export const metadata: Metadata = { title: "Expenses" };

export default function AdminExpensesPage() {
  return <ExpensesTracker />;
}
