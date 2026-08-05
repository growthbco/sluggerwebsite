import Link from "next/link";
import type { Metadata } from "next";
import { readPortalToken, getCustomerOrders } from "@/lib/portal";
import { trackingUrlFor } from "@/lib/tracking";
import { PortalAccount } from "@/components/portal-account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My Orders", robots: { index: false } };

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const titleCase = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
const shortDate = (d: Date) => new Date(d).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" });

function Receipt({ items, subtotalCents, shippingCents, totalCents }: { items: { name: string; quantity: number; unitPriceCents: number }[]; subtotalCents: number; shippingCents: number; totalCents: number }) {
  if (!items.length) return null;
  return (
    <details className="mt-3 border-t border-line pt-3 group/receipt">
      <summary className="flex cursor-pointer items-center justify-between list-none text-sm text-brand">
        <span className="underline underline-offset-2">View receipt</span>
        <span className="transition-transform group-open/receipt:rotate-45">+</span>
      </summary>
      <table className="mt-3 w-full text-sm">
        <tbody>
          {items.map((it, i) => (
            <tr key={i} className="text-muted">
              <td className="py-1 pr-2">{it.name}</td>
              <td className="py-1 px-2 text-right whitespace-nowrap">{it.quantity} &times; {money(it.unitPriceCents)}</td>
              <td className="py-1 pl-2 text-right whitespace-nowrap text-foreground">{money(it.quantity * it.unitPriceCents)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-line">
          <tr className="text-muted"><td className="pt-2" colSpan={2}>Subtotal</td><td className="pt-2 text-right">{money(subtotalCents)}</td></tr>
          <tr className="text-muted"><td colSpan={2}>Shipping</td><td className="text-right">{shippingCents ? money(shippingCents) : "Free"}</td></tr>
          <tr className="display text-foreground"><td className="pt-1" colSpan={2}>Total</td><td className="pt-1 text-right">{money(totalCents)}</td></tr>
        </tfoot>
      </table>
    </details>
  );
}

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
  const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";
  const referralUrl = `${SITE}/r/${data.profile.referralCode}`;

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-14 space-y-8">
      <header>
        <span className="display text-brand text-sm">Order Portal</span>
        <h1 className="display text-3xl sm:text-4xl text-foreground mt-1">{data.name ? `Welcome back, ${data.name.split(" ")[0]}` : "Your Orders"}</h1>
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
            <div key={s.reference} className="border border-line bg-steel p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="display text-foreground">{titleCase(s.type)} order {s.reference}</p>
                  <p className="text-sm text-muted mt-0.5">{shortDate(s.createdAt)} &middot; {money(s.totalCents)}</p>
                  {s.trackingNumber && (
                    <a href={trackingUrlFor(s.trackingNumber)} target="_blank" rel="noopener noreferrer" className="text-sm text-brand underline underline-offset-2 mt-1 inline-block">
                      Track shipment ({s.trackingNumber})
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs display text-brand border border-brand/40 px-2.5 py-1 rounded whitespace-nowrap">{titleCase(s.status)}</span>
                  {s.addUrl && (
                    <Link href={s.addUrl} className="text-sm display text-on-brand bg-brand hover:bg-brand-dark px-4 py-2 rounded whitespace-nowrap">Add items</Link>
                  )}
                </div>
              </div>
              <Receipt items={s.items} subtotalCents={s.subtotalCents} shippingCents={s.shippingCents} totalCents={s.totalCents} />
            </div>
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

      <div className="pt-4 border-t border-line">
        <PortalAccount token={token} profile={data.profile} referralUrl={referralUrl} />
      </div>

      <p className="text-xs text-muted pt-4 border-t border-line">
        Questions? Text (352) 660-1232 or email <a href="mailto:apparel@sluggerathletics.com" className="text-brand hover:underline">apparel@sluggerathletics.com</a>.
      </p>
    </div>
  );
}
