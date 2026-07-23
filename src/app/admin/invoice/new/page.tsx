import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin, adminEnabled } from "@/lib/admin-auth";
import { AdminCustomInvoiceForm } from "@/components/admin-custom-invoice-form";

export const metadata: Metadata = { title: "New Custom Invoice", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NewCustomInvoicePage() {
  if (!adminEnabled()) redirect("/admin");
  if (!(await isAdmin())) redirect("/admin/login");

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-14">
      <Link href="/admin" className="text-sm text-muted hover:text-foreground">← Back to dashboard</Link>
      <h1 className="display text-4xl text-foreground mt-3">New Custom Invoice</h1>
      <p className="mt-2 text-muted">
        Build an invoice from scratch - name the items, price them, and send. The customer gets a
        branded email with a secure Stripe payment link. Use the AI buttons for help writing
        descriptions or the notes/terms block.
      </p>
      <div className="mt-8">
        <AdminCustomInvoiceForm />
      </div>
    </div>
  );
}
