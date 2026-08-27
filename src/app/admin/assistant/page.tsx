import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin-page-header";
import { redirect, notFound } from "next/navigation";
import { dbEnabled, getDb } from "@/db";
import { assistantFacts } from "@/db/schema";
import { getAdminSession, canAccess } from "@/lib/admin-auth";
import { AdminAssistantFacts } from "@/components/admin-assistant-facts";

export const metadata: Metadata = { title: "Train the AI Assistant", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminAssistantPage() {
  if (!dbEnabled()) notFound();
  const session = await getAdminSession();
  if (!session || !canAccess(session.role, "/admin/assistant")) redirect("/admin");

  const aiFacts = await getDb().select().from(assistantFacts).orderBy(assistantFacts.createdAt);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
      <AdminPageHeader eyebrow="Settings" title="AI Assistant" />
      <p className="text-sm text-muted mt-2 max-w-2xl">
        Teach the bot shop facts it should use when answering clients and drafting replies -
        pricing nuances, policies, product details. It treats these as official and they win
        over its built-in knowledge. Remove one and it forgets immediately.
      </p>
      <div className="mt-6">
        <AdminAssistantFacts initial={aiFacts.map((f) => ({ id: f.id, fact: f.fact }))} />
      </div>
    </div>
  );
}
