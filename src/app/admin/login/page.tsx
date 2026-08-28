import type { Metadata } from "next";
import { AdminLogin } from "@/components/admin/AdminLogin";

export const metadata: Metadata = { title: "Sign in" };

export default function AdminLoginPage() {
  return <AdminLogin />;
}
