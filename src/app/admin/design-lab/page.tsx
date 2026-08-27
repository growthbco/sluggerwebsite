import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin-page-header";
import { redirect } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { isAdmin, adminEnabled } from "@/lib/admin-auth";
import { dbEnabled, getDb } from "@/db";
import { designLabVisitors, designLabRenders, designRequests } from "@/db/schema";
import { AdminBulkLeadDelete } from "@/components/admin-bulk-lead-delete";
import { LabLeadConvertButton } from "@/components/lab-lead-convert-button";
import { AdminLabFilter } from "@/components/admin-lab-filter";
import { LabConcepts } from "@/components/lab-concepts";
import { LabRowMenu } from "@/components/lab-row-menu";

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
        .select({ id: designRequests.id, ref: designRequests.reference, email: designRequests.contactEmail, status: designRequests.status })
        .from(designRequests)
        .where(inArray(designRequests.contactEmail, emails))
    : [];
  const reqByEmail = new Map(requests.map((r) => [r.email.toLowerCase(), r]));

  const sorted = [...visitors].sort((a, b) => {
    if (Boolean(a.paidAt) !== Boolean(b.paidAt)) return a.paidAt ? -1 : 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  const junkCount = visitors.filter((v) => !(v.firstName ?? "").trim() && !(v.lastName ?? "").trim() && !v.paidAt).length;
  const filterCounts = {
    all: visitors.length,
    paid: visitors.filter((v) => v.paidAt).length,
    converted: visitors.filter((v) => v.email && reqByEmail.has(v.email.toLowerCase())).length,
    noname: visitors.filter((v) => !(v.firstName ?? "").trim() && !(v.lastName ?? "").trim()).length,
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
      <AdminPageHeader eyebrow="Operations" title="Design Lab Leads" />
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <p className="text-muted max-w-2xl">
          Everyone who used the AI jersey maker - what they made, how to reach them, and whether they
          became a design request. Paid sessions float to the top; those are your hottest leads.
        </p>
        <AdminBulkLeadDelete count={junkCount} />
      </div>

      <AdminLabFilter counts={filterCounts} />

      <div className="mt-6 overflow-x-auto border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-steel text-left text-xs text-muted uppercase tracking-wide">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Contact</th>
              <th className="px-3 py-2 whitespace-nowrap">Concepts</th>
              <th className="px-3 py-2">Paid</th>
              <th className="px-3 py-2 whitespace-nowrap">Converted / DR</th>
              <th className="px-3 py-2 whitespace-nowrap">First seen</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--line)]">
            {sorted.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-4 text-muted">No lab visitors yet.</td></tr>
            )}
            {sorted.map((v) => {
              const gallery = v.id ? byVisitor.get(v.id) ?? [] : [];
              const req = v.email ? reqByEmail.get(v.email.toLowerCase()) : undefined;
              const displayName = [v.firstName, v.lastName].filter(Boolean).join(" ").trim();
              const noName = !displayName;
              const paid = Boolean(v.paidAt);
              return (
                <tr
                  key={v.id}
                  className="hover:bg-steel/40 align-top"
                  data-section="lab"
                  data-search={`${displayName} ${v.email ?? ""} ${v.phone ?? ""}`.toLowerCase()}
                  data-paid={paid ? "1" : "0"}
                  data-converted={req ? "1" : "0"}
                  data-noname={noName ? "1" : "0"}
                >
                  <td className="px-3 py-2">
                    {displayName ? <span className="text-foreground">{displayName}</span> : <span className="text-muted/60 italic">No name</span>}
                  </td>
                  <td className="px-3 py-2">
                    {v.email ? <a href={`mailto:${v.email}`} className="text-foreground hover:text-brand break-all">{v.email}</a> : <span className="text-muted/50">no email</span>}
                    {v.phone && <div className="text-xs text-muted"><a href={`tel:${v.phone}`} className="hover:text-brand">{v.phone}</a></div>}
                  </td>
                  <td className="px-3 py-2"><LabConcepts concepts={gallery.map((r) => ({ url: r.url, note: r.note }))} /></td>
                  <td className="px-3 py-2">
                    {paid ? (
                      <span className="inline-block border border-brand bg-brand text-on-brand px-2 py-0.5 text-[11px] display uppercase tracking-wide rounded">Paid</span>
                    ) : v.email ? (
                      <span className="inline-block border border-line text-muted px-2 py-0.5 text-[11px] display uppercase tracking-wide rounded">Free</span>
                    ) : (
                      <span className="inline-block border border-line text-muted/60 px-2 py-0.5 text-[11px] display uppercase tracking-wide rounded">Anon</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {req ? (
                      <a href={`/admin/design-requests/${req.id}`} className="text-sky-400 hover:underline whitespace-nowrap">{req.ref} <span className="text-muted">({req.status})</span></a>
                    ) : v.email ? (
                      <LabLeadConvertButton visitorId={v.id} />
                    ) : (
                      <span className="text-muted/40">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted whitespace-nowrap">{fmt(v.createdAt)}</td>
                  <td className="px-3 py-2"><LabRowMenu id={v.id} name={displayName || v.email || "this lead"} /></td>
                </tr>
              );
            })}
            <tr data-empty-for="lab" style={{ display: "none" }}><td colSpan={7} className="px-3 py-4 text-muted">No leads match.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
