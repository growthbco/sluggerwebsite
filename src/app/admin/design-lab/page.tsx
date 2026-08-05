import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { isAdmin, adminEnabled } from "@/lib/admin-auth";
import { dbEnabled, getDb } from "@/db";
import { designLabVisitors, designLabRenders, designRequests } from "@/db/schema";
import { ZoomableImage } from "@/components/zoomable-image";

export const metadata: Metadata = { title: "Design Lab Leads", robots: { index: false } };
export const dynamic = "force-dynamic";

const fmt = (d: Date) =>
  d.toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// Everyone who has used the AI jersey maker: contact info, whether they paid
// the $10 session, every concept they generated, and whether they became a
// design request. Sorted hottest-first (paid, then most recent).
export default async function DesignLabLeadsPage() {
  if (!adminEnabled()) redirect("/admin");
  if (!(await isAdmin())) redirect("/admin/login");
  if (!dbEnabled()) redirect("/admin");

  const db = getDb();
  const visitors = await db.select().from(designLabVisitors).orderBy(desc(designLabVisitors.createdAt));
  const renders = visitors.length
    ? await db
        .select()
        .from(designLabRenders)
        .where(inArray(designLabRenders.visitorId, visitors.map((v) => v.id)))
        .orderBy(desc(designLabRenders.createdAt))
    : [];
  const byVisitor = new Map<string, typeof renders>();
  for (const r of renders) {
    if (!r.visitorId) continue;
    const list = byVisitor.get(r.visitorId) ?? [];
    list.push(r);
    byVisitor.set(r.visitorId, list);
  }
  // Did they convert into a design request? Match on email.
  const emails = visitors.map((v) => v.email?.toLowerCase()).filter((e): e is string => Boolean(e));
  const requests = emails.length
    ? await db
        .select({ ref: designRequests.reference, email: designRequests.contactEmail, status: designRequests.status, manageToken: designRequests.manageToken })
        .from(designRequests)
        .where(inArray(designRequests.contactEmail, emails))
    : [];
  const reqByEmail = new Map(requests.map((r) => [r.email.toLowerCase(), r]));

  const sorted = [...visitors].sort((a, b) => {
    if (Boolean(a.paidAt) !== Boolean(b.paidAt)) return a.paidAt ? -1 : 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
      <Link href="/admin" className="text-sm text-muted hover:text-foreground">← Back to dashboard</Link>
      <h1 className="display text-4xl text-foreground mt-3">🧪 Design Lab Leads</h1>
      <p className="mt-2 text-muted">
        Everyone who used the AI jersey maker - what they made, how to reach them, and whether they
        became a design request. Paid sessions float to the top; those are your hottest leads.
      </p>

      <div className="mt-8 space-y-8">
        {sorted.length === 0 && <p className="text-muted">No lab visitors yet.</p>}
        {sorted.map((v) => {
          const gallery = v.id ? byVisitor.get(v.id) ?? [] : [];
          const req = v.email ? reqByEmail.get(v.email.toLowerCase()) : undefined;
          const name = [v.firstName, v.lastName].filter(Boolean).join(" ") || "(no name yet)";
          return (
            <section key={v.id} className="bg-steel border border-line p-5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <h2 className="display text-xl text-foreground">{name}</h2>
                {v.paidAt ? (
                  <span className="text-[11px] display bg-brand text-on-brand px-2 py-0.5">💰 PAID $10 SESSION</span>
                ) : v.email ? (
                  <span className="text-[11px] display border border-line text-muted px-2 py-0.5">FREE TIER LEAD</span>
                ) : (
                  <span className="text-[11px] display border border-line text-muted px-2 py-0.5">ANONYMOUS</span>
                )}
                {req && (
                  <a href={`/design/manage/${req.manageToken}`} className="text-xs display text-sky-400 underline decoration-dotted underline-offset-2">
                    → became {req.ref} ({req.status})
                  </a>
                )}
              </div>
              <p className="mt-1 text-sm text-muted">
                {v.email && (
                  <>
                    <a href={`mailto:${v.email}`} className="text-foreground hover:text-brand">{v.email}</a>
                    {" · "}
                  </>
                )}
                {v.phone && (
                  <>
                    <a href={`tel:${v.phone}`} className="text-foreground hover:text-brand">{v.phone}</a>
                    {" · "}
                  </>
                )}
                {v.generations} concepts · first seen {fmt(v.createdAt)}
                {v.paidAt ? ` · paid ${fmt(v.paidAt)}` : ""}
              </p>
              {gallery.length > 0 ? (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {gallery.map((r) => (
                    <figure key={r.id}>
                      <ZoomableImage src={r.url} alt={r.note ?? "AI concept"} />
                      {r.note && <figcaption className="mt-1 text-[11px] text-muted line-clamp-2">{r.note}</figcaption>}
                    </figure>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted">No saved concepts for this visitor.</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
