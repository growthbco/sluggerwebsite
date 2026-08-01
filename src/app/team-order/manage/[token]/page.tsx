import type { Metadata } from "next";
import Image from "next/image";
import { dbEnabled } from "@/db";
import { getByManageToken, getRoster, getLinkedDesignPreview } from "@/lib/team-orders";
import { getStoreByDesignRequestId, teamRaisedCents } from "@/lib/team-stores";
import { TeamFundraiseCard } from "@/components/team-fundraise-card";
import { itemPriceCents } from "@/lib/team-order-pricing";
import { EXTRA_ADDON_KEYS } from "@/lib/order-items";
import { TeamOrderManage } from "@/components/team-order-manage";
import { TeamOrderAddon } from "@/components/team-order-addon";

export const metadata: Metadata = { title: "Manage Team Order", robots: { index: false } };

export default async function ManagePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!dbEnabled()) {
    return <Centered title="Not available yet">Team orders aren&apos;t turned on yet.</Centered>;
  }

  const order = await getByManageToken(token);
  if (!order) {
    return <Centered title="Link not found">This management link is invalid or has expired.</Centered>;
  }

  const [roster, design] = await Promise.all([
    getRoster(order.id),
    getLinkedDesignPreview(order.designRequestId),
  ]);
  const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const shareUrl = `${SITE}/team-order/join/${order.selfEntryToken}`;
  // If this team has a linked store, the coach can run a fundraiser on it.
  const store = order.designRequestId ? await getStoreByDesignRequestId(order.designRequestId) : null;
  const raisedCents = store ? await teamRaisedCents(store.id) : 0;
  const storeUrl = store?.storeToken ? `${SITE}/store/${store.storeToken}` : null;
  // Add-on menu: the order's own items plus the always-available add-on apparel
  // (hoodies etc.), so a jerseys-only order can still add a hoodie in the same
  // design. Deduped, order preserved.
  const addonItems = [...new Set([...(order.items ?? ["jersey"]), ...EXTRA_ADDON_KEYS])];

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-14 space-y-8">
      {/* Visual confirmation card so the coach (and screenshots they share with
          their players) make the team ↔ uniform connection obvious. */}
      {design?.imageUrl && (
        <section className="rounded-xl border border-foreground/10 bg-foreground/[0.02] overflow-hidden">
          <div className="flex flex-col sm:flex-row">
            {/* Click-through to full size - the inline preview is small. */}
            <a
              href={design.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Click to view full size"
              className="sm:w-72 aspect-[4/3] sm:aspect-auto sm:h-56 relative bg-white shrink-0 block hover:opacity-90 transition-opacity"
            >
              <Image
                src={design.imageUrl}
                alt={`${order.teamName} approved design`}
                fill
                sizes="(max-width: 640px) 100vw, 288px"
                className="object-contain p-1"
                unoptimized
              />
              <span className="absolute bottom-1 right-1 text-[10px] bg-ink/80 text-foreground px-1.5 py-0.5">🔍 enlarge</span>
            </a>
            <div className="px-4 py-3 flex-1">
              <p className="text-xs text-muted uppercase tracking-wider">
                {design.pending ? "Latest proof (pending approval)" : "Approved design"}
              </p>
              <p className="display text-lg text-foreground mt-1">{order.teamName}</p>
              <p className="text-xs text-muted mt-1">Design ref: <span className="font-mono">{design.reference}</span></p>
              <p className="text-xs text-muted mt-2">
                Every player entry on this roster is tied to this design.
              </p>
            </div>
          </div>
          {(design.designs?.length ?? 0) > 1 && (
            <div className="border-t border-line/60 px-4 py-3">
              <p className="text-xs text-muted uppercase tracking-wider mb-2">This team has {design.designs.length} approved designs - players pick which one(s) they want</p>
              <div className="flex flex-wrap gap-2">
                {design.designs.map((d) => (
                  <a key={d.image} href={d.image} target="_blank" rel="noopener noreferrer" className="w-24 border border-line rounded overflow-hidden hover:ring-2 hover:ring-brand" title={`View ${d.label}`}>
                    <Image src={d.image} alt={d.label} width={96} height={80} sizes="96px" className="h-20 w-full object-contain bg-white" unoptimized />
                    <span className="block px-1.5 py-1 text-[11px] text-muted leading-tight">{d.label}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <TeamOrderManage
        token={token}
        reference={order.reference}
        teamName={order.teamName}
        jerseyStyle={order.jerseyStyle}
        jerseyMaterial={order.jerseyMaterial}
        items={order.items ?? ["jersey"]}
        shareUrl={shareUrl}
        roster={roster.map((r) => ({
          id: r.id,
          playerName: r.playerName,
          playerNumber: r.playerNumber,
          size: r.size,
          sizes: r.sizes,
          notes: r.notes,
          design: r.design,
          quantity: r.quantity,
        }))}
        submitted={!["draft", "collecting"].includes(order.status)}
        contactName={order.contactName}
        contactEmail={order.contactEmail}
        contactPhone={order.contactPhone}
        colors={design?.colors ?? null}
        placedAt={order.createdAt ? new Date(order.createdAt).toISOString() : null}
      />

      {store && (
        <TeamFundraiseCard token={token} initialPercent={store.fundraisePercent ?? 0} raisedCents={raisedCents} storeUrl={storeUrl} />
      )}

      {/* Post-submission add-ons: pay for extra pieces on this same order. */}
      {!["draft", "collecting", "cancelled"].includes(order.status) && (
        <TeamOrderAddon
          token={token}
          items={addonItems}
          prices={Object.fromEntries(
            addonItems.map((k) => [k, itemPriceCents(k, order.jerseyStyle, order.localPricing)]),
          )}
          shipped={order.status === "shipped"}
        />
      )}
    </div>
  );
}

function Centered({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-24 text-center">
      <h1 className="display text-3xl text-foreground">{title}</h1>
      <p className="mt-3 text-muted">{children}</p>
    </div>
  );
}
