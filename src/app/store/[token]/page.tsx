import type { Metadata } from "next";
import Image from "next/image";
import { dbEnabled } from "@/db";
import { getStoreByHandle, applyFundraise } from "@/lib/team-stores";
import { getById as getDesignById } from "@/lib/design-requests";
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

// Contrast-aware theming for team colors: dark text on light accents, white
// on dark ones, and a slightly darkened hover shade.
function themeVars(hex: string | null | undefined): React.CSSProperties | undefined {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return undefined;
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const darken = (v: number) => Math.max(0, Math.round(v * 0.8));
  const darkHex = `#${[darken(r), darken(g), darken(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  // Tailwind compiles brand utilities down to the base tokens (--brand-gold
  // etc.), so those are what we must override; the --color-* aliases are set
  // too for anything that still references them.
  const onBrand = luminance > 0.55 ? "#13160b" : "#ffffff";
  return {
    "--brand-gold": hex,
    "--brand-gold-dark": darkHex,
    "--on-brand": onBrand,
    "--color-brand": hex,
    "--color-brand-dark": darkHex,
    "--color-on-brand": onBrand,
  } as React.CSSProperties;
}

// Store contents (items, designs, gallery) change from the admin/DB side -
// always render fresh so updates appear immediately, never a cached page.
export const dynamic = "force-dynamic";

export default async function TeamStorePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ addTo?: string }> }) {
  const { token } = await params;
  const addToRef = (await searchParams)?.addTo?.trim().toUpperCase() || undefined;
  if (!dbEnabled()) return <Centered title="Not available yet">Team stores aren&apos;t turned on yet.</Centered>;

  const store = await getStoreByHandle(token);
  if (!store) return <Centered title="Store not found">This link is invalid or has expired.</Centered>;
  if (!store.storeActive) {
    return (
      <Centered title={`${store.name} store is closed`}>
        This team&apos;s store isn&apos;t taking orders right now. Reach out to your coach or
        email apparel@sluggerathletics.com.
      </Centered>
    );
  }

  // Gallery: built from the store's OWN design images (the colorways sold
  // here), NOT the linked design request's proofs - those belong to the
  // designer/approval flow and may move on to a new design entirely.
  const storeDesignImages = (store.storeItems ?? [])
    .flatMap((it) => (it.designs ?? []).map((d) => d.image))
    .filter(Boolean);
  const galleryImages = Array.from(
    new Set([store.approvedDesignUrl, ...storeDesignImages].filter(Boolean)),
  ) as string[];

  // Single source of truth for design names/SKUs: resolve each store design's
  // name + SKU from the linked design request (by image URL), so renaming a
  // design in the design panel flows to the store. Falls back to the stored
  // label. Also applies the fundraising markup to prices.
  const design = store.designRequestId ? await getDesignById(store.designRequestId) : null;
  const labelMap = design?.proofLabels ?? {};
  const skuMap = design?.designSkus ?? {};
  const resolvedItems = (store.storeItems ?? []).map((it) => ({
    ...it,
    priceCents: applyFundraise(it.priceCents, store.fundraisePercent),
    designs: (it.designs ?? []).map((d) => ({ label: labelMap[d.image] || d.label, image: d.image, sku: skuMap[d.image] ?? null })),
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-14" style={themeVars(store.primaryColor)}>
      <header className="text-center">
        {store.logoUrl && (
          <div className="relative h-24 w-24 mx-auto mb-4">
            <Image src={store.logoUrl} alt={`${store.name} logo`} fill sizes="96px" className="object-contain" unoptimized />
          </div>
        )}
        <span className="display text-brand text-sm">Official Team Store</span>
        <h1 className="display text-4xl sm:text-5xl text-foreground mt-1">{store.name}</h1>
        <p className="mt-3 text-muted max-w-xl mx-auto">
          This is your team&apos;s private gear shop. Order your own gear, in your team&apos;s
          custom design, delivered to your door.
        </p>
      </header>

      {(store.fundraisePercent ?? 0) > 0 && (
        <div className="mt-6 bg-brand/10 border border-brand/40 text-center px-4 py-3">
          <p className="display text-brand text-sm">🎉 Every order supports {store.name}</p>
          <p className="text-sm text-muted mt-0.5">A portion of each purchase goes straight to the team as a fundraiser. Thanks for chipping in!</p>
        </div>
      )}

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


      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="display text-xl text-foreground">Pick your gear</h2>
          <a href="#size-charts" className="text-sm text-brand hover:underline">Not sure on size? Size charts ↓</a>
        </div>
        <div className="mt-4">
          <TeamStoreShop
            token={token}
            items={resolvedItems}
            addToRef={addToRef}
          />
        </div>
      </section>

      {galleryImages.length > 0 && (
        <section className="mt-10">
          <h2 className="display text-xl text-foreground text-center">The full design collection</h2>
          <p className="text-sm text-muted text-center mt-1">Every piece is made in your team&apos;s custom designs. Tap to view up close.</p>
          <div className="mt-4">
            <ProofGallery images={galleryImages} teamName={store.name} />
          </div>
        </section>
      )}

      <details id="size-charts" className="mt-12 border border-line bg-steel group">
        <summary className="flex cursor-pointer items-center justify-between px-5 py-4 list-none">
          <span className="display text-lg text-foreground">📏 Size Charts</span>
          <span className="text-brand text-xl transition-transform group-open:rotate-45">+</span>
        </summary>
        <div className="px-5 pb-6">
          <p className="text-sm text-muted mb-5">
            All measurements in inches. Jerseys have a relaxed fit and run slightly large -
            when in doubt, size down or text us at (352) 414-7270.
          </p>
          <AllSizeCharts />
        </div>
      </details>

      <p className="mt-8 text-center text-sm text-muted">
        Questions about your order? Text us at{" "}
        <a href="sms:+13524147270" className="text-brand hover:underline">(352) 414-7270</a>{" "}
        or email{" "}
        <a href="mailto:apparel@sluggerathletics.com" className="text-brand hover:underline">apparel@sluggerathletics.com</a>
        . You&apos;ll get an email confirmation the moment you order.
      </p>
    </div>
  );
}
