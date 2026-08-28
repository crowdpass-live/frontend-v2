import type { Metadata } from "next";
import { StatusPage } from "@/components/admin/StatusPage";

export const metadata: Metadata = { title: "Status" };

export default function AdminStatusPage() {
  return <StatusPage />;
}
