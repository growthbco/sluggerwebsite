import type { Metadata } from "next";
import Image from "next/image";
import { dbEnabled } from "@/db";
import { getBySelfEntryToken, getLinkedDesignPreview } from "@/lib/team-orders";
import { SelfEntryForm } from "@/components/self-entry-form";

export const metadata: Metadata = { title: "Add Yourself to the Roster", robots: { index: false } };

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!dbEnabled()) {
    return (
      <Centered title="Not available yet">
        Self-entry links aren&apos;t turned on yet. Please check back soon.
      </Centered>
    );
  }

  const order = await getBySelfEntryToken(token);
  if (!order) {
    return <Centered title="Link not found">This roster link is invalid or has expired.</Centered>;
  }
  if (!order.selfEntryOpen) {
    return (
      <Centered title="Roster closed">
        This team order has already been submitted, so the roster is closed.
      </Centered>
    );
  }

  // Pull the approved design (or latest proof) so the player can visually
  // confirm which uniform they're being added to.
  const design = await getLinkedDesignPreview(order.designRequestId);

  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-14">
      <header className="text-center">
        <span className="display text-brand text-sm uppercase tracking-wider">{order.teamName}</span>
        <h1 className="display text-3xl sm:text-4xl text-foreground mt-1">Add Yourself to the Roster</h1>
        <p className="mt-3 text-muted">
          {order.jerseyStyle ? `${order.jerseyStyle} · ` : ""}Enter your name, number, and size.
          Your coach will review and submit the full order.
        </p>
      </header>

      {/* Visual confirmation: this is the uniform you're being added to. */}
      {design?.imageUrl ? (
        <section className="mt-8 rounded-xl border border-foreground/10 bg-foreground/[0.02] overflow-hidden">
          <div className="aspect-[4/3] relative bg-black/5">
            <Image
              src={design.imageUrl}
              alt={`${order.teamName} approved design`}
              fill
              sizes="(max-width: 640px) 100vw, 512px"
              className="object-contain"
              unoptimized
            />
          </div>
          <div className="px-4 py-3 flex items-center justify-between text-xs">
            <span className="text-muted">
              {design.pending ? "Latest proof (pending approval)" : "Approved design"}
            </span>
            <span className="font-mono text-muted/80">{design.reference}</span>
          </div>
        </section>
      ) : (
        <section className="mt-8 rounded-xl border border-foreground/10 bg-foreground/[0.02] px-4 py-3 text-xs text-muted text-center">
          You&apos;re being added to <span className="text-foreground font-semibold">{order.teamName}</span>.
          Your coach will confirm the design before the order ships.
        </section>
      )}

      <div className="mt-6">
        <SelfEntryForm token={token} items={order.items ?? ["jersey"]} />
      </div>

      <p className="mt-4 text-center text-xs text-muted">
        Not your team? Close this page - your coach can send you the right link.
      </p>
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
