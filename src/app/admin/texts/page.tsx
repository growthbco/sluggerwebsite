import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin, adminEnabled } from "@/lib/admin-auth";
import { AdminTextsInbox } from "@/components/admin-texts-inbox";

export const metadata: Metadata = { title: "Texts", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminTextsPage() {
  if (!adminEnabled()) redirect("/admin");
  if (!(await isAdmin())) redirect("/admin/login");

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
      <Link href="/admin" className="text-sm text-muted hover:text-foreground">← Back to dashboard</Link>
      <h1 className="display text-4xl text-foreground mt-3">💬 Texts</h1>
      <p className="mt-2 text-muted">
        Your shop texting line, (352) 414-7270. Customer texts and WhatsApp messages land here -
        reply directly, or start a new conversation. STOP/HELP opt-outs are handled automatically.
      </p>
      <div className="mt-8">
        <AdminTextsInbox />
      </div>
    </div>
  );
}
