import type { Metadata } from "next";
import Link from "next/link";
import { dbEnabled } from "@/db";
import { getByManageToken } from "@/lib/design-requests";
import { getStoreByDesignRequestId, STORE_ITEM_PRESETS } from "@/lib/team-stores";
import { TeamStorePanel } from "@/components/team-store-panel";

export const metadata: Metadata = { title: "Team Store Setup", robots: { index: false } };

function Centered({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-24 text-center">
      <h1 className="display text-3xl text-foreground">{title}</h1>
      <p className="mt-3 text-muted">{children}</p>
    </div>
  );
}

export default async function TeamStoreSetupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!dbEnabled()) return <Centered title="Not available yet">Team stores aren&apos;t turned on yet.</Centered>;

  const request = await getByManageToken(token);
  if (!request) return <Centered title="Link not found">This management link is invalid or has expired.</Centered>;
  if (request.status !== "approved" && request.status !== "ordered") {
    return (
      <Centered title="Not yet">
        The design needs to be approved before a team store can open.{" "}
        <Link href={`/design/manage/${token}`} className="text-brand hover:underline">Back to the design</Link>
      </Centered>
    );
  }

  const store = await getStoreByDesignRequestId(request.id);
  const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-14">
      <Link href={`/design/manage/${token}`} className="text-sm text-brand hover:underline">
        ← Back to {request.teamName} ({request.reference})
      </Link>
      <h1 className="display text-3xl sm:text-4xl text-foreground mt-3">Team Store Setup</h1>
      <p className="mt-2 text-muted">{request.teamName}</p>

      <div className="mt-8">
        <TeamStorePanel
          manageToken={token}
          presets={STORE_ITEM_PRESETS.map((p) => ({ key: p.key, label: p.label, priceCents: p.priceCents }))}
          initialStore={
            store
              ? {
                  url: `${SITE}/store/${store.slug ?? store.storeToken}`,
                  active: store.storeActive,
                  itemLabels: (store.storeItems ?? []).map((i) => i.label),
                  slug: store.slug ?? undefined,
                  color: store.primaryColor,
                  logoUrl: store.logoUrl,
                }
              : null
          }
        />
      </div>
    </div>
  );
}
