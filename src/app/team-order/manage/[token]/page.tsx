import type { Metadata } from "next";
import { dbEnabled } from "@/db";
import { getByManageToken, getRoster } from "@/lib/team-orders";
import { TeamOrderManage } from "@/components/team-order-manage";

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

  const roster = await getRoster(order.id);
  const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const shareUrl = `${SITE}/team-order/join/${order.selfEntryToken}`;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-14">
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
        submitted={order.status === "submitted"}
      />
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
