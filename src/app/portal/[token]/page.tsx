import Link from "next/link";
import type { Metadata } from "next";
import { readPortalToken, getCustomerOrders } from "@/lib/portal";
import { trackingUrlFor } from "@/lib/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My Orders", robots: { index: false } };

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const titleCase = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

function Row({ title, sub, status, href, cta, track }: { title: string; sub?: string; status: string; href?: string; cta?: string; track?: string | null }) {
  return (
    <div className="border border-line bg-steel p-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="display text-foreground">{title}</p>
        {sub && <p className="text-sm text-muted mt-0.5">{sub}</p>}
        {track && (
          <a href={trackingUrlFor(track)} target="_blank" rel="noopener noreferrer" className="text-sm text-brand underline underline-offset-2 mt-1 inline-block">
            Track shipment ({track})
          </a>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs display text-brand border border-brand/40 px-2.5 py-1 rounded whitespace-nowrap">{titleCase(status)}</span>
        {href && cta && (
          <Link href={href} className="text-sm display text-on-brand bg-brand hover:bg-brand-dark px-4 py-2 rounded whitespace-nowrap">{cta}</Link>
        )}
      </div>
    </div>
  );
}

export default async function PortalTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const email = readPortalToken(token);

  if (!email) {
    return (
      <div className="mx-auto max-w-xl px-4 sm:px-6 py-20 text-center">
        <h1 className="display text-3xl text-foreground">This link expired</h1>
        <p className="mt-3 text-muted">Portal links are valid for 45 minutes for your security. Request a fresh one.</p>
        <Link href="/portal" className="inline-block mt-6 rounded bg-brand text-on-brand display px-6 py-3 hover:bg-brand-dark">Get a new link</Link>
      </div>
    );
  }

  const data = await getCustomerOrders(email);

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-14 space-y-8">
      <header>
        <span className="display text-brand text-sm">Order Portal</span>
        <h1 className="display text-3xl sm:text-4xl text-foreground mt-1">Your Orders</h1>
        <p className="mt-2 text-muted">{email}</p>
      </header>

      {data.empty && <p className="text-muted">We couldn&apos;t find any orders for this email. If you ordered under a different address, request a link with that one.</p>}

      {data.teamOrders.length > 0 && (
        <section className="space-y-3">
          <h2 className="display text-xl text-foreground">Team Orders</h2>
          {data.teamOrders.map((o) => (
            <Row key={o.reference} title={o.teamName} sub={o.reference} status={o.status} track={o.trackingNumber}
              href={o.manageToken ? `/team-order/manage/${o.manageToken}` : undefined} cta={o.manageToken ? "Manage / add players" : undefined} />
          ))}
        </section>
      )}

      {data.designs.length > 0 && (
        <section className="space-y-3">
          <h2 className="display text-xl text-foreground">Design Requests</h2>
          {data.designs.map((d) => (
            <Row key={d.reference} title={d.teamName} sub={d.reference} status={d.status}
              href={d.statusToken ? `/design/status/${d.statusToken}` : undefined} cta={d.statusToken ? "View / approve" : undefined} />
          ))}
        </section>
      )}

      {data.shop.length > 0 && (
        <section className="space-y-3">
          <h2 className="display text-xl text-foreground">Store & Shop Orders</h2>
          {data.shop.map((s) => (
            <Row key={s.reference} title={`${titleCase(s.type)} order ${s.reference}`} sub={money(s.totalCents)} status={s.status} track={s.trackingNumber}
              href={s.addUrl ?? undefined} cta={s.addUrl ? "Add items" : undefined} />
          ))}
        </section>
      )}

      {data.invoices.length > 0 && (
        <section className="space-y-3">
          <h2 className="display text-xl text-foreground">Invoices</h2>
          {data.invoices.map((i) => (
            <Row key={i.reference} title={`Invoice ${i.reference}`} sub={money(i.totalCents)} status={i.status}
              href={i.status !== "paid" && i.payUrl ? i.payUrl : undefined} cta={i.status !== "paid" && i.payUrl ? "Pay now" : undefined} />
          ))}
        </section>
      )}

      <p className="text-xs text-muted pt-4 border-t border-line">
        Questions? Text (352) 660-1232 or email <a href="mailto:apparel@sluggerathletics.com" className="text-brand hover:underline">apparel@sluggerathletics.com</a>.
      </p>
    </div>
  );
}
