import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders, designRequests } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";
import { getRoster } from "@/lib/team-orders";
import { PrintButton } from "@/components/print-button";
import { HatSheetTables, type HatRun } from "@/components/hat-sheet-tables";

export const metadata: Metadata = { title: "Hat Production Sheet", robots: { index: false } };
export const dynamic = "force-dynamic";

const HAT_LABEL: Record<string, string> = {
  fitted_hat: "Fitted (Flexfit i8503)",
  snapback_hat: "Snapback (Flexfit 110)",
};
// Machine-run order: smallest to largest, one-size last.
const SIZE_ORDER = ["XS", "S", "S/M", "M", "M/L", "L", "L/XL", "XL", "XXL", "One Size", "OSFM"];
const sizeRank = (s: string) => {
  const i = SIZE_ORDER.indexOf(s);
  return i === -1 ? SIZE_ORDER.length : i;
};

/** Print-ready embroidery checklist for every hat on a team order, grouped
 *  into machine runs by hat type + size, with Stitched / Cleaned / Bagged
 *  checkoffs per hat. Linked from the order page whenever the roster has hats. */
export default async function HatSheetPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) redirect("/admin");
  if (!dbEnabled()) notFound();
  const { id } = await params;

  const db = getDb();
  const [order] = await db.select().from(teamOrders).where(eq(teamOrders.id, id)).limit(1);
  if (!order) notFound();
  const design = order.designRequestId
    ? (await db.select().from(designRequests).where(eq(designRequests.id, order.designRequestId)).limit(1))[0] ?? null
    : null;

  const roster = await getRoster(order.id);
  // One entry per physical hat (quantity expanded). unitKey is stable across
  // reloads ("rosterRowId:itemKey:unitIndex") - it's what checkbox state is
  // stored under in teamOrders.hatChecklist.
  const hats: { unitKey: string; key: string; size: string; name: string; number: string; note: string }[] = [];
  for (const r of roster) {
    for (const [k, v] of Object.entries(r.sizes ?? {})) {
      if ((k === "fitted_hat" || k === "snapback_hat") && (v ?? "").trim()) {
        for (let i = 0; i < Math.max(1, r.quantity); i++) {
          hats.push({
            unitKey: `${r.id}:${k}:${i}`,
            key: k,
            size: (v as string).trim(),
            name: (r.playerName ?? "").trim(),
            number: (r.playerNumber ?? "").trim(),
            note: (r.design ?? "").trim(),
          });
        }
      }
    }
  }
  if (hats.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="display text-2xl text-foreground">No hats on this order</h1>
        <p className="mt-2 text-muted">
          <Link href={`/admin/team-order/${order.id}`} className="text-brand underline">Back to the order</Link>
        </p>
      </div>
    );
  }

  // Group into runs: hat type first, then size (small -> large).
  const runs = new Map<string, typeof hats>();
  for (const h of hats) {
    const k = `${h.key}|${h.size}`;
    runs.set(k, [...(runs.get(k) ?? []), h]);
  }
  const runKeys = [...runs.keys()].sort((a, b) => {
    const [ka, sa] = a.split("|");
    const [kb, sb] = b.split("|");
    return ka === kb ? sizeRank(sa) - sizeRank(sb) : ka.localeCompare(kb);
  });
  const hasNames = hats.some((h) => h.name);
  const hasNotes = hats.some((h) => h.note);
  const runList: HatRun[] = runKeys.map((k) => {
    const [key, size] = k.split("|");
    const rows = runs.get(k)!;
    return {
      runKey: k,
      size,
      label: HAT_LABEL[key] ?? key,
      rows: rows.map((h) => ({ unitKey: h.unitKey, number: h.number, name: h.name, note: h.note })),
    };
  });

  const neededBy = design?.neededBy ?? null;
  const daysOut = neededBy ? Math.ceil((neededBy.getTime() - Date.now()) / 86400000) : null;
  const urgent = Boolean(design?.rush) || (daysOut !== null && daysOut <= 7);
  const neededStr = neededBy
    ? neededBy.toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "long", month: "short", day: "numeric", year: "numeric" })
    : null;
  const designImages = (design?.approvedDesignUrls ?? (design?.approvedDesignUrl ? [design.approvedDesignUrl] : [])).slice(0, 3);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 print:p-0 print:max-w-none">
      {/* Hide the site chrome on paper; the sheet is always ink-on-white. */}
      <style>{`@media print { header, footer, .no-print { display: none !important; } body { background: #fff !important; } @page { margin: 12mm; } }`}</style>

      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <Link href={`/admin/team-order/${order.id}`} className="text-sm text-muted hover:text-foreground">← Back to {order.reference}</Link>
        <PrintButton />
      </div>

      <div className="bg-white text-black p-6 sm:p-8 print:p-0">
        <header className="border-b-4 border-black pb-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8f7a3f]">Slugger Athletics · Hat Production Checklist</p>
          <h1 className="text-3xl font-extrabold leading-tight mt-1">{order.teamName}</h1>
          <p className="mt-1.5 text-sm text-neutral-600 flex flex-wrap gap-x-5 gap-y-1">
            <span>Order <strong className="text-black">{order.reference}</strong></span>
            {design && <span>Design <strong className="text-black">{design.reference}</strong></span>}
            <span>Coach <strong className="text-black">{order.contactName}</strong></span>
            <span>Printed <strong className="text-black">{new Date().toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" })}</strong></span>
          </p>
          {neededStr && (
            <p className={`mt-2 text-sm font-bold ${urgent ? "text-[#a3271f]" : "text-black"}`}>
              {urgent ? "" : ""}Needed by {neededStr}
              {design?.rush ? " (RUSH)" : ""}
              {daysOut !== null && daysOut >= 0 ? ` - ${daysOut === 0 ? "TODAY" : `${daysOut} day${daysOut === 1 ? "" : "s"} out`}` : ""}
            </p>
          )}
        </header>

        <div className="flex flex-wrap gap-3 mt-5">
          {runKeys.map((k) => {
            const [, size] = k.split("|");
            return (
              <div key={k} className="flex-1 border-2 border-black px-3 py-2 flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.1em]">{size}</span>
                <span className="text-3xl font-extrabold tabular-nums">{runs.get(k)!.length}</span>
              </div>
            );
          })}
          <div className="flex-1 border-2 border-[#8f7a3f] text-[#8f7a3f] px-3 py-2 flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.1em]">Total</span>
            <span className="text-3xl font-extrabold tabular-nums">{hats.length}</span>
          </div>
        </div>

        <HatSheetTables
          teamOrderId={order.id}
          runs={runList}
          initialChecklist={order.hatChecklist ?? {}}
          hasNames={hasNames}
          hasNotes={hasNotes}
        />

        {designImages.length > 0 && (
          <div className="mt-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">Approved design reference</p>
            <div className="mt-2 flex flex-wrap gap-3">
              {designImages.map((u) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={u} src={u} alt="Approved design" className="h-32 max-w-full object-contain border border-neutral-300 bg-white" />
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 border border-neutral-300 px-4 py-3 text-sm text-neutral-600">
          <strong className="text-black">Count check:</strong>{" "}
          {runKeys.map((k) => `${runs.get(k)!.length} ${k.split("|")[1]}`).join(" + ")} = {hats.length} hats total.
          Count each run against its tile before bagging.
          {order.designerNote ? <> <strong className="text-black">Order note:</strong> {order.designerNote}</> : null}
        </div>

        <div className="mt-7 flex flex-col sm:flex-row gap-4 sm:gap-10 text-xs text-neutral-600">
          <div className="flex-1 border-t border-black pt-1.5">Stitched by / date</div>
          <div className="flex-1 border-t border-black pt-1.5">Cleaned by / date</div>
          <div className="flex-1 border-t border-black pt-1.5">Counted &amp; bagged by / date</div>
        </div>
      </div>
    </div>
  );
}
