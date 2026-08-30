import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminManualOrderForm } from "@/components/admin-manual-order-form";
import { canAccess, getAdminSession } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "New Manual Order", robots: { index: false } };

export default async function NewManualTeamOrderPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!canAccess(session.role, "/admin/team-order/new")) redirect("/admin");

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
      <Link href="/admin/team-orders" className="text-sm text-brand hover:underline">← Team orders</Link>
      <header className="mt-3 mb-7">
        <p className="text-xs display uppercase tracking-[0.18em] text-brand">Operations</p>
        <h1 className="display text-3xl sm:text-4xl text-foreground mt-1">Enter a manual order</h1>
        <p className="mt-2 max-w-2xl text-muted">Use this only when the order came through text, phone, email, or another path that bypassed the normal website workflow.</p>
      </header>
      <AdminManualOrderForm />
    </div>
  );
}
