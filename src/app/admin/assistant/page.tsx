import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { dbEnabled, getDb } from "@/db";
import { assistantFacts } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";
import { AdminAssistantFacts } from "@/components/admin-assistant-facts";

export const metadata: Metadata = { title: "Train the AI Assistant", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminAssistantPage() {
  if (!dbEnabled()) notFound();
  if (!(await isAdmin())) redirect("/admin");

  const aiFacts = await getDb().select().from(assistantFacts).orderBy(assistantFacts.createdAt);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
      <Link href="/admin" className="text-sm text-brand hover:underline">← Back to dashboard</Link>
      <h1 className="display text-3xl text-foreground mt-2">🤖 Train the AI assistant</h1>
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
