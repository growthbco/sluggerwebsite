import type { Metadata } from "next";
import { dbEnabled } from "@/db";
import { getBySelfEntryToken } from "@/lib/team-orders";
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

  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-14">
      <header className="text-center">
        <span className="display text-brand text-sm">{order.teamName}</span>
        <h1 className="display text-3xl sm:text-4xl text-foreground mt-1">Add Yourself to the Roster</h1>
        <p className="mt-3 text-muted">
          {order.jerseyStyle ? `${order.jerseyStyle} · ` : ""}Enter your name, number, and size.
          Your coach will review and submit the full order.
        </p>
      </header>
      <div className="mt-8">
        <SelfEntryForm token={token} items={order.items ?? ["jersey"]} />
      </div>
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
