import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin-page-header";
import { adminEnabled, getAdminSession, canAccess } from "@/lib/admin-auth";
import { AdminCustomInvoiceForm } from "@/components/admin-custom-invoice-form";

export const metadata: Metadata = { title: "New Custom Invoice", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NewCustomInvoicePage() {
  if (!adminEnabled()) redirect("/admin");
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!canAccess(session.role, "/admin/invoice/new")) redirect("/admin");

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-14">
      <AdminPageHeader eyebrow="Financials" title="New Custom Invoice" />
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
