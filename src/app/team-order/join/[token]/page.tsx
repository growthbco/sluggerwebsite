import type { Metadata } from "next";
import { dbEnabled } from "@/db";
import { getBySelfEntryToken, getLinkedDesignPreview } from "@/lib/team-orders";
import { SelfEntryForm } from "@/components/self-entry-form";
import { SizeChartsFor } from "@/components/size-charts";
import { ZoomableImage } from "@/components/zoomable-image";

export const metadata: Metadata = { title: "Add Yourself to the Roster", robots: { index: false } };
// Always render fresh so a newly-linked design/mockup shows immediately.
export const dynamic = "force-dynamic";

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
  const orderItems = order.items ?? ["jersey"];
  const hasJersey = orderItems.some((item) => item.includes("jersey"));
  const isBasketball = /basketball/i.test(order.sport ?? "");

  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-14">
      <header className="text-center">
        <span className="display text-brand text-sm uppercase tracking-wider">{order.teamName}</span>
        <h1 className="display text-3xl sm:text-4xl text-foreground mt-1">Add Yourself to the Roster</h1>
        <p className="mt-3 text-muted">
          {order.jerseyStyle ? `${order.jerseyStyle} · ` : ""}{order.requiresNames ? "Enter your name, number, and size." : "Choose your size."}
          Your coach will review and submit the full order.
        </p>
      </header>

      {/* Visual confirmation: this is the uniform you're being added to. */}
      {design?.imageUrl && (design.designs?.length ?? 0) <= 1 ? (
        <section className="mt-8 rounded-xl border border-foreground/10 bg-foreground/[0.02] overflow-hidden">
          <ZoomableImage src={design.imageUrl} alt={`${order.teamName} uniform design`} />
          <div className="px-4 py-3 border-t border-line/60">
            <div className="flex items-center justify-between text-xs">
              <span className="display text-brand">This is the design</span>
              <span className="font-mono text-muted/80">{design.reference}</span>
            </div>
            <p className="mt-1 text-xs text-muted">Some details may vary slightly on the final uniform.</p>
          </div>
        </section>
      ) : (
        <section className="mt-8 rounded-xl border border-foreground/10 bg-foreground/[0.02] px-4 py-3 text-xs text-muted text-center">
          You&apos;re being added to <span className="text-foreground font-semibold">{order.teamName}</span>.
          Your coach will confirm the design before the order ships.
        </section>
      )}

      <div className="mt-6">
        <SelfEntryForm token={token} items={orderItems} sport={order.sport} designs={design?.designs ?? []} requiresNames={order.requiresNames} />
      </div>

      <details className="mt-6 border border-line bg-steel group">
        <summary className="flex cursor-pointer items-center justify-between px-4 py-3 list-none">
          <span className="display text-foreground">📏 Not sure on size? Size charts</span>
          <span className="text-brand text-xl transition-transform group-open:rotate-45">+</span>
        </summary>
        <div className="px-4 pb-5">
          <p className="text-sm text-muted mb-4">
            {isBasketball
              ? "All measurements are in inches. Use the basketball-specific chart for this uniform."
              : hasJersey
              ? "All measurements in inches. Jerseys run slightly large - when in doubt, size down."
              : "All measurements are in inches. Use the chart for the items in this order."}
          </p>
          <SizeChartsFor items={orderItems} sport={order.sport} />
        </div>
      </details>

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
