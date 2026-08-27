"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const SHOP_NUMBER = "(352) 414-7270";

/** The customer-portal chrome: a left rail on desktop, a bottom nav on mobile.
 *  Only portal sections - Orders / Address / Help - never the marketing nav.
 *  The main pane shows only the active section. */
export function PortalShell({
  token,
  teamLabel,
  name,
  orderCount,
  children,
}: {
  token: string;
  teamLabel: string;
  name: string;
  orderCount: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const base = `/portal/${token}`;
  const isAddress = pathname === `${base}/address`;
  const isRefer = pathname === `${base}/refer`;
  const isHelp = pathname === `${base}/help`;
  const isOrders = !isAddress && !isRefer && !isHelp; // orders list + any order detail

  const items = [
    { href: base, label: "Orders", active: isOrders, badge: orderCount },
    { href: `${base}/address`, label: "Address", active: isAddress, badge: 0 },
    { href: `${base}/refer`, label: "Refer", active: isRefer, badge: 0 },
    { href: `${base}/help`, label: "Help", active: isHelp, badge: 0 },
  ];

  return (
    <div className="min-h-screen lg:flex bg-background">
      {/* ── Desktop left rail ─────────────────────────────────────── */}
      <aside className="hidden lg:flex lg:flex-col w-60 shrink-0 border-r border-line bg-steel sticky top-0 h-screen">
        <div className="p-5 border-b border-line">
          <Link href="/" aria-label="Slugger Athletics" className="inline-block">
            <Image src="/slugger-logo.png" alt="Slugger Athletics" width={120} height={72} className="h-8 w-auto" />
          </Link>
          <h1 className="mt-4 display text-lg text-foreground leading-tight">{teamLabel || "Your orders"}</h1>
          <p className="text-sm text-muted">{name}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={`flex items-center justify-between rounded-md px-3 py-2.5 text-sm display transition-colors ${
                it.active ? "bg-brand/10 text-brand border-l-2 border-brand rounded-l-none" : "text-foreground/80 hover:bg-background/40 hover:text-foreground"
              }`}
            >
              <span>{it.label}</span>
              {it.badge > 0 && <span className="text-[11px] rounded-full bg-brand/20 text-brand px-2 py-0.5">{it.badge}</span>}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-line">
          <a href="sms:+13524147270" className="block text-center display text-sm text-brand border border-brand/50 px-3 py-2.5 rounded hover:bg-brand/10">
            Text us {SHOP_NUMBER}
          </a>
        </div>
      </aside>

      {/* ── Mobile top bar ────────────────────────────────────────── */}
      <header className="lg:hidden sticky top-0 z-30 border-b border-line bg-steel/95 backdrop-blur px-4 py-3 flex items-center justify-between gap-2">
        <span className="display text-foreground truncate">{teamLabel || "Your orders"}</span>
        <a href="sms:+13524147270" className="text-xs display text-brand border border-brand/50 px-2.5 py-1.5 rounded shrink-0">Text us</a>
      </header>

      {/* ── Main pane (active section only) ───────────────────────── */}
      <main className="flex-1 min-w-0">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-8 pb-28 lg:pb-10">{children}</div>
      </main>

      {/* ── Mobile bottom nav ─────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line bg-steel grid grid-cols-4">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={`relative flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] text-xs display ${it.active ? "text-brand" : "text-muted"}`}
          >
            <span>{it.label}</span>
            {it.badge > 0 && <span className="absolute top-1.5 right-[calc(50%-1.6rem)] text-[10px] rounded-full bg-brand text-on-brand px-1.5">{it.badge}</span>}
          </Link>
        ))}
      </nav>
    </div>
  );
}
