import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin-page-header";
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
      <AdminPageHeader eyebrow="Settings" title="Users & Settings" />
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
