import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { adminEnabled, canAccess, getAdminSession } from "@/lib/admin-auth";
import { dbEnabled } from "@/db";
import { getContactFollowUps } from "@/lib/contact-follow-ups";
import { FollowUpQueue } from "@/components/follow-up-queue";

export const metadata: Metadata = { title: "Call Queue", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function FollowUpsPage() {
  if (!adminEnabled()) redirect("/admin");
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!canAccess(session.role, "/admin/follow-ups")) redirect("/admin");
  if (!dbEnabled()) {
    return <div className="mx-auto max-w-lg px-4 py-24 text-center text-muted">Database not configured.</div>;
  }

  const contacts = await getContactFollowUps();
  return <FollowUpQueue contacts={contacts} asOf={new Date().toISOString()} canText={session.role !== "follow_up"} />;
}
