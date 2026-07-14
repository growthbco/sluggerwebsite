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
          This is your team&apos;s private gear shop. Order your own gear, in your team&apos;s
          custom design, delivered to your door.
        </p>
      </header>

      {/* How it works - most buyers land here cold from a text message. */}
      <div className="mt-8 grid sm:grid-cols-3 gap-3">
        {[
          { n: "1", t: "Pick your gear", d: "Choose items and sizes below - every piece is made in the team design you see here." },
          { n: "2", t: "Make it yours", d: "Add the name and number you want printed. Double-check spelling - it prints exactly as typed." },
          { n: "3", t: "Pay & relax", d: "Pay by card. Your gear is custom-made (2-3 weeks) and ships to you, or pick it up free in Ocala." },
        ].map((s) => (
          <div key={s.n} className="bg-steel border border-line p-4">
            <div className="flex items-center gap-2">
              <span className="grid place-items-center h-7 w-7 clip-slant bg-brand text-on-brand display text-sm shrink-0">{s.n}</span>
              <h2 className="display text-foreground">{s.t}</h2>
            </div>
            <p className="mt-2 text-sm text-muted">{s.d}</p>
          </div>
        ))}
      </div>

      {galleryImages.length > 0 && (
        <section className="mt-10">
          <h2 className="display text-xl text-foreground text-center">Your team&apos;s design</h2>
          <p className="text-sm text-muted text-center mt-1">Everything you order comes in this look. Tap the thumbnails for more views.</p>
          <div className="mt-4">
            <ProofGallery images={galleryImages} teamName={store.name} />
          </div>
        </section>
      )}

      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="display text-xl text-foreground">Pick your gear</h2>
          <a href="#size-charts" className="text-sm text-brand hover:underline">Not sure on size? Size charts ↓</a>
        </div>
        <div className="mt-4">
          <TeamStoreShop token={token} items={store.storeItems ?? []} />
        </div>
      </section>

      <details id="size-charts" className="mt-12 border border-line bg-steel group">
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

      <p className="mt-8 text-center text-sm text-muted">
        Questions about your order? Text us at{" "}
        <a href="sms:+13526601232" className="text-brand hover:underline">(352) 660-1232</a>{" "}
        or email{" "}
        <a href="mailto:apparel@sluggerathletics.com" className="text-brand hover:underline">apparel@sluggerathletics.com</a>
        . You&apos;ll get an email confirmation the moment you order.
      </p>
    </div>
  );
}
