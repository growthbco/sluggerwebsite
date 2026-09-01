import type { Metadata } from "next";
import Image from "next/image";
import { dbEnabled } from "@/db";
import { getStoreByHandle, applyFundraise } from "@/lib/team-stores";
import { getById as getDesignById } from "@/lib/design-requests";
import { TeamStoreShop } from "@/components/team-store-shop";
import { SizeChartsFor } from "@/components/size-charts";

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

  // An open store with no products yet must not render blank tiles - show a
  // simple "not open yet" instead of a broken-looking shop.
  if (resolvedItems.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 sm:px-6 py-24 text-center" style={themeVars(store.primaryColor)}>
        <h1 className="display text-3xl text-foreground">{store.name}</h1>
        <p className="mt-3 text-muted">This team store isn&apos;t open yet - check back soon, or reach out to your coach.</p>
        <p className="mt-10 text-xs text-muted/60">Powered by Slugger Athletics</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-14" style={themeVars(store.primaryColor)}>
      <header className="text-center">
        <span className="display text-muted text-sm uppercase tracking-wide">Official team store</span>
        {store.logoUrl ? (
          <h1 className="mt-3">
            <span className="sr-only">{store.name}</span>
            <span className="relative block h-28 w-44 sm:h-32 sm:w-52 mx-auto">
              <Image
                src={store.logoUrl}
                alt=""
                fill
                sizes="(max-width: 640px) 176px, 208px"
                className="object-contain"
                loading="eager"
                unoptimized
              />
            </span>
          </h1>
        ) : (
          <h1 className="display text-4xl sm:text-5xl text-brand mt-1">{store.name}</h1>
        )}
        <p className="mt-3 text-sm text-muted max-w-xl mx-auto">
          Your team&apos;s gear, in your team&apos;s design. Pay here, we make it.
        </p>
        <p className="mt-2 text-xs text-muted/70">
          Private team link · <a href="#size-charts" className="text-brand hover:underline">Size chart</a>
        </p>
      </header>

      {(store.fundraisePercent ?? 0) > 0 && (
        <div className="mt-6 bg-brand/10 border border-brand/40 text-center px-4 py-3">
          <p className="display text-brand text-sm">🎉 Every order supports {store.name}</p>
          <p className="text-sm text-muted mt-0.5">A portion of each purchase goes straight to the team as a fundraiser. Thanks for chipping in!</p>
        </div>
      )}

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
          <h3 className="display text-sm text-muted uppercase tracking-wide text-center">Design collection</h3>
          {/* Slim thumbnail strip, not a second full gallery. Tap to enlarge. */}
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 sm:justify-center">
            {galleryImages.map((img, i) => (
              <a key={i} href={img} target="_blank" rel="noopener noreferrer" className="shrink-0 h-20 w-20 bg-white border border-line rounded overflow-hidden block">
                <Image src={img} alt={`${store.name} design ${i + 1}`} width={80} height={80} sizes="80px" className="h-full w-full object-contain p-0.5" unoptimized />
              </a>
            ))}
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
            {/basketball/i.test(store.sport ?? "")
              ? "All measurements are in inches. Use the basketball-specific chart for this uniform."
              : "All measurements are in inches. Jerseys have a relaxed fit and run slightly large. When in doubt, size down or text us at (352) 414-7270."}
          </p>
          <SizeChartsFor items={(store.storeItems ?? []).map((it) => it.key)} sport={store.sport} />
        </div>
      </details>

      <p className="mt-8 text-center text-sm text-muted">
        Questions about your order? Text us at{" "}
        <a href="sms:+13524147270" className="text-brand hover:underline">(352) 414-7270</a>{" "}
        or email{" "}
        <a href="mailto:apparel@sluggerathletics.com" className="text-brand hover:underline">apparel@sluggerathletics.com</a>
        . You&apos;ll get an email confirmation the moment you order.
      </p>

      {/* The only Slugger branding on a private store: a small credit line. */}
      <p className="mt-10 pt-6 border-t border-line text-center text-xs text-muted/60">
        Powered by Slugger Athletics
      </p>
    </div>
  );
}
