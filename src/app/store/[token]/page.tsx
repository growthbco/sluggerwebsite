import type { Metadata } from "next";
import { dbEnabled } from "@/db";
import { getByStoreToken } from "@/lib/team-stores";
import { getById } from "@/lib/design-requests";
import { TeamStoreShop } from "@/components/team-store-shop";
import { ProofGallery } from "@/components/proof-gallery";
import { AllSizeCharts } from "@/components/size-charts";

export const metadata: Metadata = { title: "Team Store", robots: { index: false } };

function Centered({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-24 text-center">
      <h1 className="display text-3xl text-foreground">{title}</h1>
      <p className="mt-3 text-muted">{children}</p>
    </div>
  );
}

export default async function TeamStorePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!dbEnabled()) return <Centered title="Not available yet">Team stores aren&apos;t turned on yet.</Centered>;

  const store = await getByStoreToken(token);
  if (!store) return <Centered title="Store not found">This link is invalid or has expired.</Centered>;
  if (!store.storeActive) {
    return (
      <Centered title={`${store.name} store is closed`}>
        This team&apos;s store isn&apos;t taking orders right now. Reach out to your coach or
        email apparel@sluggerathletics.com.
      </Centered>
    );
  }

  // Gallery: the approved design first, then every proof view from the linked
  // design request (front/back/detail shots), deduped.
  const design = store.designRequestId ? await getById(store.designRequestId) : null;
  const galleryImages = Array.from(
    new Set([store.approvedDesignUrl, design?.approvedDesignUrl, ...(design?.proofImages ?? [])].filter(Boolean)),
  ) as string[];

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-14">
      <header className="text-center">
        <span className="display text-brand text-sm">Official Team Store</span>
        <h1 className="display text-4xl sm:text-5xl text-foreground mt-1">{store.name}</h1>
        <p className="mt-3 text-muted max-w-xl mx-auto">
          Pick your gear, add your name and number, and pay for your own order.
          Everything is made in your team&apos;s custom design.
        </p>
      </header>

      {galleryImages.length > 0 && (
        <div className="mt-8">
          <ProofGallery images={galleryImages} teamName={store.name} />
        </div>
      )}

      <div className="mt-10">
        <TeamStoreShop token={token} items={store.storeItems ?? []} />
      </div>

      <details className="mt-12 border border-line bg-steel group">
        <summary className="flex cursor-pointer items-center justify-between px-5 py-4 list-none">
          <span className="display text-lg text-foreground">📏 Size Charts</span>
          <span className="text-brand text-xl transition-transform group-open:rotate-45">+</span>
        </summary>
        <div className="px-5 pb-6">
          <p className="text-sm text-muted mb-5">
            All measurements in inches. Jerseys have a relaxed fit and run slightly large -
            when in doubt, size down or text us at (352) 660-1232.
          </p>
          <AllSizeCharts />
        </div>
      </details>
    </div>
  );
}
