import Link from "next/link";
import type { Metadata } from "next";
import { and, eq, sql } from "drizzle-orm";
import { readPortalToken } from "@/lib/portal";
import { getDb } from "@/db";
import { teamOrders } from "@/db/schema";
import { TeamOrderManageSection } from "@/components/team-order-manage-section";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Order", robots: { index: false } };

export default async function PortalOrderPage({ params }: { params: Promise<{ token: string; ref: string }> }) {
  const { token, ref } = await params;
  const email = readPortalToken(token);
  if (!email) {
    return (
      <div className="text-center py-16">
        <h1 className="display text-2xl text-foreground">This link expired</h1>
        <Link href="/portal" className="inline-block mt-5 rounded bg-brand text-on-brand display px-6 py-3 hover:bg-brand-dark">Get a new link</Link>
      </div>
    );
  }

  // Scope to THIS customer's orders (email match) so a ref can't reach another
  // customer's order.
  const [order] = await getDb()
    .select()
    .from(teamOrders)
    .where(and(eq(teamOrders.reference, decodeURIComponent(ref)), sql`lower(${teamOrders.contactEmail}) = ${email}`))
    .limit(1);

  if (!order) {
    return (
      <div className="space-y-4">
        <Link href={`/portal/${token}`} className="text-sm text-brand hover:underline">‹ All orders</Link>
        <p className="text-muted">We couldn&apos;t find that order on this account.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href={`/portal/${token}`} className="inline-flex items-center text-sm text-brand hover:underline">‹ All orders</Link>
      <TeamOrderManageSection order={order} />
    </div>
  );
}
