import type { Metadata } from "next";
import Image from "next/image";
import { dbEnabled } from "@/db";
import { getByStoreToken } from "@/lib/team-stores";
import { TeamStoreShop } from "@/components/team-store-shop";

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

      {store.approvedDesignUrl && (
        <div className="mt-8 relative bg-white border border-line mx-auto max-w-2xl" style={{ aspectRatio: "4 / 3" }}>
          <Image
            src={store.approvedDesignUrl}
            alt={`${store.name} approved design`}
            fill
            sizes="(max-width: 768px) 100vw, 672px"
            className="object-contain p-2"
            unoptimized
          />
        </div>
      )}

      <div className="mt-10">
        <TeamStoreShop token={token} items={store.storeItems ?? []} />
      </div>
    </div>
  );
}
