import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { adminEnabled, getAdminSession } from "@/lib/admin-auth";
import { AdminUsersPanel } from "@/components/admin-users-panel";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };
export const dynamic = "force-dynamic";

// Owner-only: user accounts + roles.
export default async function AdminSettingsPage() {
  if (!adminEnabled()) redirect("/admin");
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (session.role !== "owner") redirect("/admin");

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-foreground">← Dashboard</Link>
      <h1 className="display text-4xl text-foreground mt-3">⚙️ Settings</h1>
      <p className="mt-2 text-muted">
        Give each person their own login and role. Designers see design work only - no money, customer,
        or store pages.
      </p>
      <div className="mt-8">
        <AdminUsersPanel />
      </div>
    </div>
  );
}
