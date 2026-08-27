import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin-page-header";
import { redirect } from "next/navigation";
import { isAdmin, adminEnabled } from "@/lib/admin-auth";
import { AdminConversations } from "@/components/admin-conversations";

export const metadata: Metadata = { title: "Conversations", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminTextsPage({ searchParams }: { searchParams: Promise<{ to?: string; name?: string; tab?: string; open?: string }> }) {
  if (!adminEnabled()) redirect("/admin");
  if (!(await isAdmin())) redirect("/admin/login");
  const { to, name, tab, open } = await searchParams;
  // ?open=<designId> deep-links an email thread (from an email alert) and
  // implies the Email tab.
  const initialTab = tab === "email" || open ? "email" : "texts";

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-14">
      <AdminPageHeader eyebrow="Menu" title="Conversations" />
      <p className="mt-2 text-muted">
        Everything customers send you, in one place. Texts and WhatsApp to your shop line (352) 414-7270,
        and email replies on their designs. Reply from here - texts send from your line, email replies go
        back on the design thread. STOP/HELP opt-outs are handled automatically.
      </p>
      <div className="mt-8">
        <AdminConversations initialTab={initialTab} initialPhone={to} initialName={name} initialOpen={open} />
      </div>
    </div>
  );
}
