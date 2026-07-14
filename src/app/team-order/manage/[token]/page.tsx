import type { Metadata } from "next";
import Image from "next/image";
import { dbEnabled } from "@/db";
import { getByManageToken, getRoster, getLinkedDesignPreview } from "@/lib/team-orders";
import { itemPriceCents } from "@/lib/team-order-pricing";
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

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-14 space-y-8">
      {/* Visual confirmation card so the coach (and screenshots they share with
          their players) make the team ↔ uniform connection obvious. */}
      {design?.imageUrl && (
        <section className="rounded-xl border border-foreground/10 bg-foreground/[0.02] overflow-hidden">
          <div className="flex flex-col sm:flex-row">
            <div className="sm:w-56 aspect-[4/3] sm:aspect-auto sm:h-44 relative bg-black/5 shrink-0">
              <Image
                src={design.imageUrl}
                alt={`${order.teamName} approved design`}
                fill
                sizes="(max-width: 640px) 100vw, 224px"
                className="object-contain"
                unoptimized
              />
            </div>
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
        </section>
      )}

      <TeamOrderManage
        token={token}
        reference={order.reference}
        teamName={order.teamName}
        jerseyStyle={order.jerseyStyle}
        items={order.items ?? ["jersey"]}
        shareUrl={shareUrl}
        roster={roster.map((r) => ({
          id: r.id,
          playerName: r.playerName,
          playerNumber: r.playerNumber,
          size: r.size,
          sizes: r.sizes,
          notes: r.notes,
        }))}
        submitted={!["draft", "collecting"].includes(order.status)}
      />

      {/* Post-submission add-ons: pay for extra pieces on this same order. */}
      {!["draft", "collecting", "cancelled"].includes(order.status) && (
        <TeamOrderAddon
          token={token}
          items={order.items ?? ["jersey"]}
          prices={Object.fromEntries(
            (order.items ?? ["jersey"]).map((k) => [k, itemPriceCents(k, order.jerseyStyle)]),
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
